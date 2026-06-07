import type { ChangeEvent } from 'react';
import { Icon } from './Icon';
import type { SpeechSummaryResult } from '../lib/speechSummary';

interface SpeechSummaryPanelProps {
  applyLabel?: string;
  audioMessage?: string;
  canRequestSummary?: boolean;
  isRecording?: boolean;
  isSummarizing?: boolean;
  summary?: SpeechSummaryResult | null;
  onApplySummary?: () => void;
  onAudioFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onSummaryChange?: (summary: SpeechSummaryResult) => void;
  onSummarize?: () => void;
}

const supportedAudioExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

const speechSummaryCategories = [
  { key: 'visitPurpose', label: '방문 목적' },
  { key: 'diagnosis', label: '진단 내용' },
  { key: 'testTreatment', label: '검사·치료 내용' },
  { key: 'prescription', label: '처방 내용' },
  { key: 'precautions', label: '주의사항' },
  { key: 'followUpPlan', label: '방문 계획' },
  { key: 'otherMemo', label: '기타 메모' },
] as const;

export function SpeechSummaryPanel({
  applyLabel,
  audioMessage = '',
  canRequestSummary = false,
  isRecording = false,
  isSummarizing = false,
  summary = null,
  onApplySummary,
  onAudioFileChange,
  onStartRecording,
  onStopRecording,
  onSummaryChange,
  onSummarize,
}: SpeechSummaryPanelProps) {
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
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="mic" className="h-4 w-4" />
            직접 녹음
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopRecording}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-3 text-sm font-semibold text-white"
          >
            <Icon name="stop" className="h-4 w-4" />
            녹음 중지
          </button>
        )}

        <label
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-3 text-sm font-semibold text-emerald-700 ${
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

      <button
        type="button"
        onClick={onSummarize}
        disabled={shouldDisableSummary}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Icon name="sparkles" className="h-4 w-4" />
        {isSummarizing ? '음성 인식 요약 중...' : '음성 인식 요약하기'}
      </button>

      {summaryFields ? (
        <div className="space-y-2 rounded-lg bg-emerald-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-emerald-700">요약 결과 수정</p>
            <span className="text-[11px] font-medium text-slate-400">없는 내용은 언급 없음</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {speechSummaryCategories.map((category) => (
              <label key={category.key} className="block rounded-md bg-white px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">{category.label}</span>
                <textarea
                  rows={2}
                  value={summaryFields[category.key] || '언급 없음'}
                  onChange={(event) => updateSummaryField(category.key, event.target.value)}
                  readOnly={!onSummaryChange}
                  className="mt-1 w-full resize-none rounded-md border border-transparent bg-slate-50 px-2 py-2 text-xs leading-5 text-slate-600 outline-none focus:border-emerald-200 focus:bg-white"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
          <label className="block">
            <span className="text-xs font-semibold text-emerald-700">전체 전사문</span>
            <textarea
              rows={4}
              value={summary.transcript}
              onChange={(event) => updateTranscript(event.target.value)}
              readOnly={!onSummaryChange}
              placeholder="전사문이 비어 있어요."
              className="mt-1 w-full resize-none rounded-lg border border-transparent bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-200"
            />
          </label>

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
              {applyLabel ?? '진료 기록으로 열기'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
