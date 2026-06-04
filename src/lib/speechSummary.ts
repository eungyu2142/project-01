import { isSupabaseConfigured, supabase } from './supabase';
import type { SpeechSummaryFields } from '../types';

export interface SpeechSummaryResult {
  fields: SpeechSummaryFields;
  transcript: string;
  warnings: string[];
}

interface SpeechSummaryResponse {
  summary?: SpeechSummaryResult;
  error?: string;
  detail?: unknown;
}

export async function summarizeSpeechAudio(scope: 'record' | 'review', audioFile: File) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 연결이 필요해요. 환경 변수 설정 후 음성 요약을 사용할 수 있어요.');
  }

  const formData = new FormData();
  formData.append('scope', scope);
  formData.append('audio', audioFile);

  const { data, error } = await supabase.functions.invoke<SpeechSummaryResponse>('speech-summary', {
    body: formData,
  });

  if (error) {
    throw new Error(await getSpeechSummaryErrorMessage(error));
  }

  if (!data?.summary) {
    throw new Error(data?.error || '음성 요약 결과를 읽지 못했어요.');
  }

  return data.summary;
}

async function getSpeechSummaryErrorMessage(error: unknown) {
  const functionError = error as {
    context?: Response;
    message?: string;
    name?: string;
  };

  const response = functionError.context;

  if (response) {
    const payload = await response.clone().json().catch(() => null) as SpeechSummaryResponse | null;

    if (payload?.error) {
      return payload.error;
    }

    if (response.status === 404) {
      return 'speech-summary Edge Function이 아직 배포되지 않았어요. Supabase Functions 배포가 필요해요.';
    }

    if (response.status === 501) {
      return 'Edge Function에 OPENAI_API_KEY가 설정되지 않았어요.';
    }

    return `Edge Function이 오류를 반환했어요. 상태 코드: ${response.status}`;
  }

  if (functionError.name === 'FunctionsFetchError') {
    return 'Edge Function에 연결하지 못했어요. speech-summary 함수가 배포됐는지, Supabase 프로젝트 URL이 맞는지 확인해 주세요.';
  }

  if (functionError.message?.includes('Failed to send')) {
    return 'Edge Function에 요청을 보내지 못했어요. speech-summary 함수 배포 또는 네트워크 연결을 확인해 주세요.';
  }

  return functionError.message || '음성 요약을 요청하지 못했어요.';
}
