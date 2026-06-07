import { createClient } from 'npm:@supabase/supabase-js@2'

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const speechAudioBucket = 'speech-audio'
const maxAudioFileSize = 25 * 1024 * 1024
const missingValue = '언급 없음'

const fieldKeys = [
  'visitPurpose',
  'diagnosis',
  'testTreatment',
  'prescription',
  'precautions',
  'followUpPlan',
  'otherMemo',
] as const

type SpeechFieldKey = (typeof fieldKeys)[number]
type SpeechScope = 'record' | 'review'
type AdminClient = ReturnType<typeof createClient>

const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
const transcriptionModel = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') ?? 'gpt-4o-mini-transcribe'
const summaryModel =
  Deno.env.get('OPENAI_SPEECH_SUMMARY_MODEL') ??
  Deno.env.get('OPENAI_SUMMARY_MODEL') ??
  'gpt-5.4-mini'

console.info('[speech-summary:start]', {
  hasOpenAiApiKey: Boolean(openAiApiKey),
  transcriptionModel,
  summaryModel,
})

interface SpeechSummary {
  fields: Record<SpeechFieldKey, string>
  transcript: string
  warnings: string[]
}

interface SpeechJobRequest {
  scope?: SpeechScope
  audioPath?: string
  audioName?: string
  audioType?: string
  audioSize?: number
}

interface ProcessSpeechJobInput {
  adminClient: AdminClient
  apiKey: string
  jobId: string
  scope: SpeechScope
  audioPath: string
  audioName: string
  audioType: string
  transcriptionModel: string
  summaryModel: string
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const response = payload as {
    output_text?: string
    output?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }>
  }

  if (typeof response.output_text === 'string') {
    return response.output_text
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .join('') ?? ''
  )
}

function normalizeSummary(payload: unknown, transcript: string): SpeechSummary {
  const parsed = payload && typeof payload === 'object' ? payload as Partial<SpeechSummary> : {}
  const fields = fieldKeys.reduce<Record<SpeechFieldKey, string>>((acc, key) => {
    const value = parsed.fields?.[key]
    acc[key] = typeof value === 'string' && value.trim() ? value.trim() : missingValue
    return acc
  }, {
    visitPurpose: missingValue,
    diagnosis: missingValue,
    testTreatment: missingValue,
    prescription: missingValue,
    precautions: missingValue,
    followUpPlan: missingValue,
    otherMemo: missingValue,
  })

  return {
    fields,
    transcript,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [],
  }
}

function getPayloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return ''
  }

  const error = payload.error

  if (typeof error === 'string') {
    return redactSecrets(error)
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return redactSecrets(error.message)
  }

  return ''
}

function redactSecrets(message: string) {
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED_OPENAI_KEY]')
}

async function updateJob(
  adminClient: AdminClient,
  jobId: string,
  values: Record<string, unknown>,
) {
  const { error } = await adminClient
    .from('speech_summary_jobs')
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    console.error('[speech-summary:update-job]', jobId, error.message)
  }
}

async function processSpeechJob({
  adminClient,
  apiKey,
  jobId,
  scope,
  audioPath,
  audioName,
  audioType,
  transcriptionModel,
  summaryModel,
}: ProcessSpeechJobInput) {
  await updateJob(adminClient, jobId, {
    status: 'processing',
    started_at: new Date().toISOString(),
    error_message: null,
  })

  try {
    const { data: audioBlob, error: downloadError } = await adminClient.storage
      .from(speechAudioBucket)
      .download(audioPath)

    if (downloadError || !audioBlob) {
      throw new Error(downloadError?.message || '저장된 음성 파일을 불러오지 못했어요.')
    }

    const audioFile = new File([audioBlob], audioName || 'recording.webm', {
      type: audioType || audioBlob.type || 'audio/webm',
    })
    const transcriptionForm = new FormData()
    transcriptionForm.append('model', transcriptionModel)
    transcriptionForm.append('file', audioFile, audioFile.name)
    transcriptionForm.append('language', 'ko')
    transcriptionForm.append('response_format', 'json')
    transcriptionForm.append(
      'prompt',
      '특수동물 병원 진료 대화입니다. 진단, 검사, 치료, 처방, 주의사항, 다음 방문 계획을 한국어로 정확히 전사해 주세요.',
    )

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: transcriptionForm,
    })
    const transcriptionPayload = await transcriptionResponse.json().catch(() => null)

    if (!transcriptionResponse.ok) {
      console.error('[speech-summary:transcription-failed]', {
        jobId,
        status: transcriptionResponse.status,
      })
      throw new Error(
        getPayloadError(transcriptionPayload) ||
          `음성을 텍스트로 변환하지 못했어요. 상태 코드: ${transcriptionResponse.status}`,
      )
    }

    const transcript =
      transcriptionPayload &&
      typeof transcriptionPayload === 'object' &&
      'text' in transcriptionPayload &&
      typeof transcriptionPayload.text === 'string'
        ? transcriptionPayload.text.trim()
        : ''

    if (!transcript) {
      throw new Error('전사된 텍스트가 비어 있어요.')
    }

    const summaryResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: summaryModel,
        input: [
          {
            role: 'system',
            content:
              '너는 특수동물 병원 진료 대화를 보호자 기록용으로 정리하는 한국어 의료 기록 보조자야. 진단을 새로 만들지 말고, 전사문에 나온 내용만 분류해.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              scope,
              transcript,
              task:
                '전사문을 방문 목적, 진단 내용, 검사/치료 내용, 처방 내용, 주의사항, 방문 계획, 기타 메모로 분류해줘. 전사문에 없는 내용은 반드시 "언급 없음"으로 써줘. 보호자가 확인 후 진료 기록이나 리뷰 초안으로 사용할 거야.',
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'speech_summary',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                fields: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    visitPurpose: { type: 'string' },
                    diagnosis: { type: 'string' },
                    testTreatment: { type: 'string' },
                    prescription: { type: 'string' },
                    precautions: { type: 'string' },
                    followUpPlan: { type: 'string' },
                    otherMemo: { type: 'string' },
                  },
                  required: [...fieldKeys],
                },
                warnings: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['fields', 'warnings'],
            },
          },
        },
      }),
    })
    const summaryPayload = await summaryResponse.json().catch(() => null)

    if (!summaryResponse.ok) {
      console.error('[speech-summary:summary-failed]', {
        jobId,
        status: summaryResponse.status,
      })
      throw new Error(
        getPayloadError(summaryPayload) ||
          `전사문을 항목별로 정리하지 못했어요. 상태 코드: ${summaryResponse.status}`,
      )
    }

    const outputText = getOutputText(summaryPayload)
    const summary = normalizeSummary(JSON.parse(outputText), transcript)

    await updateJob(adminClient, jobId, {
      status: 'completed',
      transcript,
      summary,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '음성 요약 처리 중 오류가 발생했어요.'

    console.error('[speech-summary:process-job]', jobId, errorMessage)
    await updateJob(adminClient, jobId, {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
  } finally {
    const { error: removeError } = await adminClient.storage
      .from(speechAudioBucket)
      .remove([audioPath])

    if (removeError) {
      console.error('[speech-summary:remove-audio]', jobId, removeError.message)
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = request.headers.get('Authorization')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Supabase function secrets are not configured.' })
  }

  if (!openAiApiKey) {
    return jsonResponse(501, { error: '음성 인식 서버에 OpenAI API 키가 설정되지 않았어요.' })
  }

  if (!authHeader) {
    return jsonResponse(401, { error: 'Authorization header is missing.' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(401, { error: '로그인한 사용자 정보를 확인하지 못했어요.' })
  }

  let body: SpeechJobRequest

  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { error: '음성 요약 작업 요청 형식이 올바르지 않아요.' })
  }

  const scope: SpeechScope = body.scope === 'review' ? 'review' : 'record'
  const audioPath = body.audioPath?.trim() ?? ''
  const audioName = body.audioName?.trim() || 'recording.webm'
  const audioType = body.audioType?.trim() || 'audio/webm'
  const audioSize = typeof body.audioSize === 'number' ? body.audioSize : 0

  if (!audioPath || !audioPath.startsWith(`${user.id}/`)) {
    return jsonResponse(400, { error: '본인이 업로드한 음성 파일 경로가 필요해요.' })
  }

  if (!Number.isFinite(audioSize) || audioSize <= 0) {
    return jsonResponse(400, { error: '음성 파일이 비어 있어요.' })
  }

  if (audioSize > maxAudioFileSize) {
    return jsonResponse(413, { error: '음성 파일은 최대 25MB까지 사용할 수 있어요.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const { data: job, error: jobError } = await adminClient
    .from('speech_summary_jobs')
    .insert({
      user_id: user.id,
      scope,
      status: 'processing',
      audio_path: audioPath,
      audio_name: audioName,
      audio_type: audioType,
      audio_size: audioSize,
    })
    .select('id, status')
    .single()

  if (jobError || !job) {
    return jsonResponse(500, {
      error: jobError?.message || '음성 요약 작업을 생성하지 못했어요.',
    })
  }

  EdgeRuntime.waitUntil(
    processSpeechJob({
      adminClient,
      apiKey: openAiApiKey,
      jobId: job.id,
      scope,
      audioPath,
      audioName,
      audioType,
      transcriptionModel,
      summaryModel,
    }),
  )

  return jsonResponse(202, {
    job: {
      id: job.id,
      status: job.status,
    },
  })
})
