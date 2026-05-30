import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppContext } from '../context/AppContext';
import { validateMedicalRecordText } from '../lib/contentModeration';
import { getTodayDateValue } from '../lib/date';
import type {
  Hospital,
  MedicalRecord,
  MedicalRecordDraft,
  MedicalRecordInput,
  Pet,
} from '../types';
import { Icon } from './Icon';
import { ModalSheet } from './ModalSheet';
import { reviewTagOptions } from './ReviewComposer';

interface RecordEditorProps {
  open: boolean;
  record?: MedicalRecord | null;
  draft?: MedicalRecordDraft | null;
  pets: Pet[];
  hospitals: Hospital[];
  onClose: () => void;
  onSave: (input: MedicalRecordInput) => void;
}

export function RecordEditor({
  open,
  record,
  draft,
  pets,
  hospitals,
  onClose,
  onSave,
}: RecordEditorProps) {
  const { saveMedicalRecordDraft, deleteMedicalRecordDraft } = useAppContext();
  const [petId, setPetId] = useState(record?.petId ?? draft?.petId ?? '');
  const [hospitalId, setHospitalId] = useState(record?.hospitalId ?? draft?.hospitalId ?? '');
  const [hospitalSearchText, setHospitalSearchText] = useState('');
  const [showHospitalOptions, setShowHospitalOptions] = useState(false);
  const [date, setDate] = useState(record?.date ?? draft?.date ?? getTodayDateValue());
  const [diagnosis, setDiagnosis] = useState(record?.diagnosis ?? draft?.diagnosis ?? '');
  const [veterinarianNote, setVeterinarianNote] = useState(
    record?.veterinarianNote ?? draft?.veterinarianNote ?? '',
  );
  const [prescription, setPrescription] = useState(record?.prescription ?? draft?.prescription ?? '');
  const [costText, setCostText] = useState(
    typeof record?.cost === 'number'
      ? record.cost.toLocaleString('ko-KR')
      : typeof draft?.cost === 'number'
        ? draft.cost.toLocaleString('ko-KR')
        : '',
  );
  const [memo, setMemo] = useState(record?.memo ?? draft?.memo ?? '');
  const [saveToReview, setSaveToReview] = useState(false);
  const [reviewBody, setReviewBody] = useState(record?.memo ?? draft?.memo ?? '');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [moderationMessage, setModerationMessage] = useState('');
  const [requiredMessage, setRequiredMessage] = useState('');

  const selectedHospital = hospitals.find((hospital) => hospital.id === hospitalId);
  const hospitalMatches = useMemo(() => {
    const keyword = hospitalSearchText.trim().toLowerCase();

    if (!keyword) {
      return hospitals;
    }

    return hospitals.filter((hospital) => {
      const name = hospital.name.toLowerCase();
      const address = hospital.address.toLowerCase();

      return name.includes(keyword) || address.includes(keyword);
    });
  }, [hospitalSearchText, hospitals]);

  function selectHospital(hospitalToSelect: Hospital) {
    setHospitalId(hospitalToSelect.id);
    setHospitalSearchText(hospitalToSelect.name);
    setShowHospitalOptions(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!petId || !hospitalId || !date) {
      setRequiredMessage('반려동물, 병원, 날짜를 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    if (saveToReview && !record && !diagnosis.trim()) {
      setRequiredMessage('리뷰에도 저장하려면 병명을 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    const moderation = validateMedicalRecordText([
      { label: '진료 내용', value: diagnosis },
      { label: '수의사 소견', value: veterinarianNote },
      { label: '처방', value: prescription },
      { label: '메모', value: memo },
      { label: '리뷰 본문', value: saveToReview ? reviewBody : '' },
    ]);

    if (!moderation.ok) {
      setModerationMessage(moderation.message);
      return;
    }

    onSave({
      id: record?.id,
      petId,
      hospitalId,
      date,
      diagnosis: diagnosis.trim(),
      veterinarianNote: veterinarianNote.trim(),
      prescription: prescription.trim(),
      cost: costText ? Number(costText.replaceAll(',', '')) : null,
      memo: memo.trim(),
      saveToReview: saveToReview && !record,
      saveToReviewBody: reviewBody,
      saveToReviewRating: reviewRating,
      saveToReviewTags: reviewTags,
    });

    if (draft?.id) {
      deleteMedicalRecordDraft(draft.id);
    }

    setRequiredMessage('');
    setModerationMessage('');
    onClose();
  }

  function handleSaveDraft() {
    const savedDraftId = saveMedicalRecordDraft({
      id: draft?.id,
      petId,
      hospitalId,
      date,
      diagnosis,
      veterinarianNote,
      prescription,
      cost: costText ? Number(costText.replaceAll(',', '')) : null,
      memo,
    });

    if (!savedDraftId) {
      setRequiredMessage('임시 저장할 내용이 아직 없어요.');
      setModerationMessage('');
      return;
    }

    setRequiredMessage('');
    setModerationMessage('');
    onClose();
  }

  function handleClose() {
    if (!record && draft?.id) {
      saveMedicalRecordDraft({
        id: draft.id,
        petId,
        hospitalId,
        date,
        diagnosis,
        veterinarianNote,
        prescription,
        cost: costText ? Number(costText.replaceAll(',', '')) : null,
        memo,
      });
    }

    onClose();
  }

  function toggleReviewTag(tag: string) {
    setReviewTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  return (
    <ModalSheet
      open={open}
      onClose={handleClose}
      title={record ? '진료 기록 수정' : '진료 기록 추가'}
      description="리뷰에서 선택한 병원과 반려동물 정보에 맞춰 진료 기록을 남길 수 있어요."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {requiredMessage ? (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {requiredMessage}
          </div>
        ) : null}

        {moderationMessage ? (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {moderationMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">반려동물</span>
            <select
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            >
              <option value="">선택</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">날짜</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
          </label>
        </div>

        <div
          className="relative space-y-2"
          onBlur={() => {
            window.setTimeout(() => setShowHospitalOptions(false), 120);
          }}
        >
          <span className="text-sm font-medium">병원</span>
          <label className="relative flex items-center gap-3 rounded-lg border border-emerald-100 bg-white px-4 py-3">
            <Icon name="search" className="h-5 w-5 text-emerald-600" />
            <input
              type="text"
              value={hospitalSearchText || (selectedHospital ? selectedHospital.name : '')}
              onChange={(event) => {
                setHospitalSearchText(event.target.value);
                setHospitalId('');
                setShowHospitalOptions(true);
              }}
              onFocus={() => setShowHospitalOptions(true)}
              placeholder=""
              className="w-full bg-transparent pr-8 text-slate-700 placeholder:text-slate-400"
            />
            {hospitalSearchText ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setHospitalSearchText('');
                  setHospitalId('');
                  setShowHospitalOptions(false);
                }}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-slate-100 text-slate-500"
                aria-label="병원 검색어 지우기"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          {showHospitalOptions ? (
            <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-y-auto rounded-lg bg-white text-slate-700 shadow-[0_22px_50px_rgba(15,118,110,0.18)]">
              {hospitalMatches.length > 0 ? (
                hospitalMatches.map((hospital) => (
                  <button
                    key={hospital.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectHospital(hospital)}
                    className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{hospital.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{hospital.address}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      선택
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-5 text-center text-sm text-slate-500">
                  검색한 병원이 없어요. 다른 이름이나 주소로 다시 찾아 주세요.
                </div>
              )}
            </div>
          ) : null}
        </div>

        {selectedHospital ? (
          <div className="rounded-lg bg-emerald-50/70 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{selectedHospital.name}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedHospital.address}</p>
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium">
            병명 {saveToReview && !record ? <span className="text-rose-500">*</span> : null}
          </span>
          <input
            type="text"
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            placeholder=""
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">수의사 소견</span>
          <textarea
            rows={3}
            value={veterinarianNote}
            onChange={(event) => setVeterinarianNote(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">처방</span>
            <input
              type="text"
              value={prescription}
              onChange={(event) => setPrescription(event.target.value)}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">진료 비용</span>
            <input
              type="text"
              inputMode="numeric"
              value={costText}
              onChange={(event) => {
                const numberOnly = event.target.value.replace(/\D/g, '');
                setCostText(numberOnly ? Number(numberOnly).toLocaleString('ko-KR') : '');
              }}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
              placeholder=""
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">메모</span>
          <textarea
            rows={3}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        {!record ? (
          <label className="flex items-center gap-3 rounded-lg bg-emerald-50/80 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={saveToReview}
              onChange={(event) => setSaveToReview(event.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span>리뷰에도 저장하기</span>
          </label>
        ) : null}

        {saveToReview && !record ? (
          <div className="space-y-4 rounded-lg border border-emerald-100 bg-white/80 p-4">
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">리뷰 별점</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`rounded-md p-2 ${
                      value <= reviewRating ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon name="star" className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">리뷰 태그</span>
              <div className="flex flex-wrap gap-2">
                {reviewTagOptions.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => toggleReviewTag(tag.label)}
                    className={`rounded-md px-3 py-2 text-sm ${
                      reviewTags.includes(tag.label)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span className="mr-1">{tag.emoji}</span>#{tag.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">직접 작성란</span>
              <textarea
                rows={4}
                value={reviewBody}
                onChange={(event) => setReviewBody(event.target.value)}
                className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
              />
            </label>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {!record ? (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-3 font-semibold text-emerald-700"
            >
              {draft?.id ? '임시 저장 업데이트' : '임시 저장'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white"
          >
            저장하기
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
