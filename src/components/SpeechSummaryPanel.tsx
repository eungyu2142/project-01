import { Icon } from './Icon';
import type { ChangeEvent } from 'react';
import type { SpeechSummaryResult } from '../lib/speechSummary';

type SpeechSummaryScope = 'record' | 'review';

interface SpeechSummaryPanelProps {
  scope?: SpeechSummaryScope;
  applyLabel?: string;
  audioMessage?: string;
  canRequestSummary?: boolean;
  isRecording?: boolean;
  isSummarizing?: boolean;
  selectedAudioLabel?: string;
  statusMessage?: string;
  summary?: SpeechSummaryResult | null;
  unavailableReason?: string;
  onApplySummary?: () => void;
  onAudioFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveSummary?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onSummaryChange?: (summary: SpeechSummaryResult) => void;
  onSummarize?: () => void;
}

const supportedAudioExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

const speechSummaryCategories = [
  { key: 'visitPurpose', label: '방문 목적' },
  { key: 'diagnosis', label: '진단 내용' },
  { key: 'testTreatment', label: '검사/치료 내용' },
  { key: 'prescription', label: '처방 내용' },
  { key: 'precautions', label: '주의사항' },
  { key: 'followUpPlan', label: '방문 계획' },
  { key: 'otherMemo', label: '기타 메모' },
] as const;

export function SpeechSummaryPanel({
  scope = 'record',
  applyLabel,
  audioMessage = '',
  canRequestSummary = false,
  isRecording = false,
  isSummarizing = false,
  selectedAudioLabel = '',
  statusMessage = '',
  summary = null,
  unavailableReason = '음성 인식 요약 기능은 아직 연결되지 않았어요.',
  onApplySummary,
  onAudioFileChange,
  onSaveSummary,
  onStartRecording,
  onStopRecording,
  onSummaryChange,
  onSummarize,
}: SpeechSummaryPanelProps) {
  const scopeLabel = scope === 'record' ? '진료 기록' : '리뷰 작성';
  const uploadEnabled = Boolean(onAudioFileChange && !isRecording && !isSummarizing);
  const recordEnabled = Boolean(onStartRecording && onStopRecording && !isSummarizing);
  const shouldDisableSummary = !canRequestSummary || isSummarizing;
  const summaryFields = summary?.fields;

  function updateSummaryField(key: keyof SpeechSummaryResult['fields'], value: string) {
    if (!summary || !onSummaryChange) {
      return;
    }

    onSummaryChange({
      ...summary,
      fields: {
        ...summary.fields,
        [key]: value,
      },
    });
  }

  function updateTranscript(value: string) {
    if (!summary || !onSummaryChange) {
      return;
    }

    onSummaryChange({
      ...summary,
      transcript: value,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">수의사 의견 음성 인식 요약</p>
            <span className="inline-flex min-h-6 items-center rounded-md bg-emerald-50 px-2 text-[11px] font-semibold leading-none text-emerald-700">
              {scopeLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            녹음하거나 음성 파일을 올리면 대화 내용을 항목별 초안으로 정리하는 자리예요.
          </p>
        </div>
        <Icon name="sparkles" className="h-5 w-5 shrink-0 text-emerald-600" />
      </div>

      {unavailableReason ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          지금은 준비 중이에요. {unavailableReason}
        </div>
      ) : null}

      {audioMessage ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {audioMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {!isRecording ? (
          <button
            type="button"
            onClick={onStartRecording}
            disabled={!recordEnabled}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="mic" className="h-4 w-4" />
            녹음 시작
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopRecording}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-3 text-sm font-semibold text-white"
          >
            <Icon name="stop" className="h-4 w-4" />
            녹음 중지
          </button>
        )}

        <label
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-3 text-sm font-semibold text-emerald-700 ${
            uploadEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
          }`}
        >
          <Icon name="upload" className="h-4 w-4" />
          녹음 파일 올리기
          <input
            type="file"
            accept={supportedAudioExtensions.map((extension) => `.${extension}`).join(',')}
            disabled={!uploadEnabled}
            className="hidden"
            onChange={onAudioFileChange}
          />
        </label>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        지원 파일: mp3, mp4, mpeg, mpga, m4a, wav, webm · 최대 25MB
      </p>

      {selectedAudioLabel ? (
        <div className="rounded-lg bg-emerald-50/70 px-3 py-2 text-xs font-medium text-slate-700">
          선택된 음성: {selectedAudioLabel}
        </div>
      ) : null}

      {summaryFields ? (
        <div className="space-y-2 rounded-lg bg-emerald-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-emerald-700">음성 인식 요약 결과</p>
            <span className="text-[11px] font-medium text-slate-400">없는 내용은 언급 없음</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {speechSummaryCategories.map((category) => (
              <div key={category} className="rounded-md bg-white px-3 py-2 text-sm">
                <p className="font-semibold text-slate-700">{category}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {getSummaryFieldValue(category, summaryFields)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSummarize}
        disabled={shouldDisableSummary}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Icon name="sparkles" className="h-4 w-4" />
        {isSummarizing ? '음성 인식 요약 중...' : '음성 인식 요약하기'}
      </button>

      {statusMessage ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {statusMessage}
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">전체 전사문</p>
            <p className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
              {summary.transcript || '전사문이 비어 있어요.'}
            </p>
          </div>

          {summary.warnings.length > 0 ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {summary.warnings.join(' ')}
            </div>
          ) : null}

          {onApplySummary ? (
            <button
              type="button"
              onClick={onApplySummary}
              className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700"
            >
              {applyLabel ?? '리뷰 폼에 적용하기'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getSummaryFieldValue(category: string, fields?: SpeechSummaryResult['fields']) {
  if (!fields) {
    return '언급 없음';
  }

  const fieldMap: Record<string, string> = {
    '방문 목적': fields.visitPurpose,
    '진단 내용': fields.diagnosis,
    '검사/치료 내용': fields.testTreatment,
    '처방 내용': fields.prescription,
    주의사항: fields.precautions,
    '방문 계획': fields.followUpPlan,
    '기타 메모': fields.otherMemo,
  };

  return fieldMap[category]?.trim() || '언급 없음';
}
