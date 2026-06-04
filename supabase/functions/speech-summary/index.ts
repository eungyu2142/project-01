const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

interface SpeechSummary {
  fields: Record<SpeechFieldKey, string>
  transcript: string
  warnings: string[]
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const transcriptionModel = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') ?? 'gpt-4o-mini-transcribe'
  const summaryModel = Deno.env.get('OPENAI_SPEECH_SUMMARY_MODEL') ?? Deno.env.get('OPENAI_SUMMARY_MODEL') ?? 'gpt-5.4-mini'

  if (!apiKey) {
    return jsonResponse(501, { error: 'OPENAI_API_KEY is not configured.' })
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return jsonResponse(400, { error: 'Invalid multipart form body.' })
  }

  const scope = formData.get('scope') === 'review' ? 'review' : 'record'
  const audio = formData.get('audio')

  if (!(audio instanceof File)) {
    return jsonResponse(400, { error: '음성 파일이 필요해요.' })
  }

  if (audio.size > 25 * 1024 * 1024) {
    return jsonResponse(413, { error: '음성 파일은 최대 25MB까지 사용할 수 있어요.' })
  }

  const transcriptionForm = new FormData()
  transcriptionForm.append('model', transcriptionModel)
  transcriptionForm.append('file', audio, audio.name || 'recording.webm')
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
    return jsonResponse(transcriptionResponse.status, {
      error: '음성을 텍스트로 변환하지 못했어요.',
      detail:
        transcriptionPayload && typeof transcriptionPayload === 'object' && 'error' in transcriptionPayload
          ? transcriptionPayload.error
          : transcriptionPayload,
    })
  }

  const transcript =
    transcriptionPayload &&
    typeof transcriptionPayload === 'object' &&
    'text' in transcriptionPayload &&
    typeof transcriptionPayload.text === 'string'
      ? transcriptionPayload.text.trim()
      : ''

  if (!transcript) {
    return jsonResponse(422, { error: '전사된 텍스트가 비어 있어요.' })
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
              '전사문을 방문 목적, 진단 내용, 검사/치료 내용, 처방 내용, 주의사항, 방문 계획, 기타 메모로 분류해줘. 전사문에 없는 내용은 반드시 "언급 없음"으로 써줘. 리뷰 작성 화면에서 보호자가 확인 후 붙여넣을 초안으로 사용할 거야.',
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
    return jsonResponse(summaryResponse.status, {
      error: '전사문을 항목별로 정리하지 못했어요.',
      detail:
        summaryPayload && typeof summaryPayload === 'object' && 'error' in summaryPayload
          ? summaryPayload.error
          : summaryPayload,
    })
  }

  try {
    const outputText = getOutputText(summaryPayload)
    const parsedSummary = JSON.parse(outputText)

    return jsonResponse(200, {
      summary: normalizeSummary(parsedSummary, transcript),
    })
  } catch {
    return jsonResponse(502, { error: 'AI 요약 응답을 읽지 못했어요.' })
  }
})
