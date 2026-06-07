import type { SpeechSummaryFields } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

const SPEECH_AUDIO_BUCKET = 'speech-audio';
const SPEECH_JOB_POLL_INTERVAL_MS = 2_000;
const SPEECH_JOB_MAX_WAIT_MS = 30 * 60_000;
const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const supportedAudioExtensions = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']);

export interface SpeechSummaryResult {
  fields: SpeechSummaryFields;
  transcript: string;
  warnings: string[];
}

interface SpeechSummaryJobResponse {
  job?: {
    id?: string;
    status?: 'processing';
  };
  error?: string;
  detail?: unknown;
}

interface SpeechSummaryJobRow {
  status: 'processing' | 'completed' | 'failed';
  summary: SpeechSummaryResult | null;
  error_message: string | null;
  updated_at: string;
}

export async function summarizeSpeechAudio(scope: 'record' | 'review', audioFile: File) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 연결이 필요해요. 환경 변수를 설정한 뒤 음성 요약을 사용할 수 있어요.');
  }

  if (audioFile.size <= 0) {
    throw new Error('음성 파일이 비어 있어요. 다시 녹음하거나 다른 파일을 선택해 주세요.');
  }

  if (audioFile.size > MAX_AUDIO_FILE_SIZE) {
    throw new Error('음성 파일은 최대 25MB까지 사용할 수 있어요.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인 상태를 확인하지 못했어요. 다시 로그인한 뒤 시도해 주세요.');
  }

  const audioName = normalizeAudioFileName(audioFile);
  const audioPath = `${user.id}/${crypto.randomUUID()}-${audioName}`;
  const { error: uploadError } = await supabase.storage
    .from(SPEECH_AUDIO_BUCKET)
    .upload(audioPath, audioFile, {
      contentType: audioFile.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(translateSpeechSummaryError(uploadError.message || '음성 파일을 업로드하지 못했어요.'));
  }

  const { data, error } = await supabase.functions.invoke<SpeechSummaryJobResponse>('speech-summary', {
    body: {
      scope,
      audioPath,
      audioName,
      audioType: audioFile.type,
      audioSize: audioFile.size,
    },
  });

  if (error) {
    await removeUploadedAudio(audioPath);
    throw new Error(await getSpeechSummaryErrorMessage(error));
  }

  const jobId = data?.job?.id;

  if (!jobId) {
    await removeUploadedAudio(audioPath);
    throw new Error(translateSpeechSummaryError(data?.error || '음성 요약 작업 정보를 읽지 못했어요.'));
  }

  return pollSpeechSummaryJob(jobId, audioPath);
}

async function pollSpeechSummaryJob(jobId: string, audioPath: string) {
  if (!supabase) {
    throw new Error('Supabase 연결이 필요해요.');
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < SPEECH_JOB_MAX_WAIT_MS) {
    const { data, error } = await supabase
      .from('speech_summary_jobs')
      .select('status, summary, error_message, updated_at')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(translateSpeechSummaryError(error.message || '음성 요약 작업 상태를 확인하지 못했어요.'));
    }

    const job = data as SpeechSummaryJobRow;

    if (job.status === 'completed') {
      if (!isSpeechSummaryResult(job.summary)) {
        throw new Error('완료된 음성 요약 결과를 읽지 못했어요.');
      }

      return job.summary;
    }

    if (job.status === 'failed') {
      throw new Error(translateSpeechSummaryError(job.error_message || '음성 요약 처리에 실패했어요.'));
    }

    if (Date.now() - new Date(job.updated_at).getTime() > 8 * 60_000) {
      const { data: markedFailed, error: staleJobError } = await supabase.rpc(
        'fail_stale_speech_summary_job',
        { job_id: jobId },
      );

      if (staleJobError) {
        throw new Error(translateSpeechSummaryError(staleJobError.message));
      }

      if (markedFailed) {
        await removeUploadedAudio(audioPath);
        throw new Error('음성 요약 작업이 서버 제한 시간을 초과했어요. 다시 시도해 주세요.');
      }
    }

    await delay(SPEECH_JOB_POLL_INTERVAL_MS);
  }

  await removeUploadedAudio(audioPath);
  throw new Error('음성 요약 작업이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.');
}

function normalizeAudioFileName(audioFile: File) {
  const rawName = audioFile.name.trim();
  const rawExtension = rawName.split('.').pop()?.toLowerCase() ?? '';
  const extension = supportedAudioExtensions.has(rawExtension)
    ? rawExtension
    : getExtensionFromMimeType(audioFile.type);
  const baseName = rawName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'recording';

  return `${baseName}.${extension}`;
}

function getExtensionFromMimeType(mimeType: string) {
  const normalizedType = mimeType.toLowerCase();

  if (normalizedType.includes('mp4') || normalizedType.includes('m4a')) {
    return 'mp4';
  }

  if (normalizedType.includes('mpeg') || normalizedType.includes('mp3')) {
    return 'mp3';
  }

  if (normalizedType.includes('wav')) {
    return 'wav';
  }

  return 'webm';
}

function isSpeechSummaryResult(value: unknown): value is SpeechSummaryResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<SpeechSummaryResult>;
  return Boolean(
    summary.fields &&
      typeof summary.fields === 'object' &&
      typeof summary.transcript === 'string' &&
      Array.isArray(summary.warnings),
  );
}

async function removeUploadedAudio(audioPath: string) {
  if (!supabase) {
    return;
  }

  await supabase.storage.from(SPEECH_AUDIO_BUCKET).remove([audioPath]);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function getSpeechSummaryErrorMessage(error: unknown) {
  const functionError = error as {
    context?: Response;
    message?: string;
    name?: string;
  };

  const response = functionError.context;

  if (response) {
    const payload = (await response.clone().json().catch(() => null)) as SpeechSummaryJobResponse | null;

    if (payload?.error) {
      return translateSpeechSummaryError(payload.error);
    }

    if (response.status === 404) {
      return 'speech-summary Edge Function이 아직 배포되지 않았어요. Supabase Functions 배포가 필요해요.';
    }

    if (response.status === 501) {
      return '음성 인식 서버에 OpenAI API 키가 설정되지 않았어요. Supabase Edge Function 환경 변수에 OPENAI_API_KEY를 추가해 주세요.';
    }

    return `Edge Function이 오류를 반환했어요. 상태 코드: ${response.status}`;
  }

  if (functionError.name === 'FunctionsFetchError') {
    return 'Edge Function에 연결하지 못했어요. speech-summary 함수 배포 상태와 Supabase 프로젝트 URL을 확인해 주세요.';
  }

  if (functionError.message?.includes('Failed to send')) {
    return 'Edge Function 요청을 보내지 못했어요. speech-summary 함수 배포 또는 네트워크 연결을 확인해 주세요.';
  }

  return translateSpeechSummaryError(functionError.message || '음성 요약을 요청하지 못했어요.');
}

function translateSpeechSummaryError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return '음성 인식 시간이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.';
  }

  if (
    lowerMessage.includes('openai_api_key') ||
    lowerMessage.includes('api key is not configured') ||
    lowerMessage.includes('api key is not set') ||
    lowerMessage.includes('api 키가 설정되지')
  ) {
    return '음성 인식 서버에 OpenAI API 키가 설정되지 않았어요. Supabase Edge Function 환경 변수에 OPENAI_API_KEY를 추가해 주세요.';
  }

  if (
    lowerMessage.includes('incorrect api key') ||
    lowerMessage.includes('invalid api key') ||
    lowerMessage.includes('invalid_api_key') ||
    lowerMessage.includes('api key provided')
  ) {
    return '등록된 OpenAI API 키가 유효하지 않아요. 키가 만료되었거나 잘못 입력되지 않았는지 확인해 주세요.';
  }

  if (
    lowerMessage.includes('insufficient_quota') ||
    lowerMessage.includes('exceeded your current quota') ||
    lowerMessage.includes('billing')
  ) {
    return 'OpenAI API 사용 한도 또는 결제 설정을 확인해 주세요.';
  }

  if (
    lowerMessage.includes('model_not_found') ||
    (lowerMessage.includes('model') && lowerMessage.includes('access'))
  ) {
    return '설정된 OpenAI 모델을 사용할 권한이 없거나 모델명이 올바르지 않아요.';
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return '음성 인식 서버와 연결이 불안정해요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
  }

  if (lowerMessage.includes('invalid') || lowerMessage.includes('unsupported')) {
    return '지원하지 않는 음성 파일일 수 있어요. mp3, m4a, wav, webm 파일로 다시 시도해 주세요.';
  }

  return message;
}
