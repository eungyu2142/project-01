import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAppContext } from '../context/AppContext';
import { validateMedicalRecordText } from '../lib/contentModeration';
import { getTodayDateValue } from '../lib/date';
import { getAnimalLabel } from '../lib/format';
import {
  getHospitalClassificationLabel,
} from '../lib/hospitalDataset';
import type {
  Hospital,
  MedicalRecord,
  MedicalRecordDraft,
  MedicalRecordInput,
  Pet,
} from '../types';
import { Icon } from './Icon';
import { ModalSheet } from './ModalSheet';

const classificationBadgeClass = 'inline-flex min-h-6 items-center rounded-md px-2 text-[11px] font-medium leading-none';

interface RecordEditorProps {
  open: boolean;
  record?: MedicalRecord | null;
  draft?: MedicalRecordDraft | null;
  initialPetId?: string;
  pets: Pet[];
  hospitals: Hospital[];
  onClose: () => void;
  onSave: (input: MedicalRecordInput) => void;
}

export function RecordEditor({
  open,
  record,
  draft,
  initialPetId = '',
  pets,
  hospitals,
  onClose,
  onSave,
}: RecordEditorProps) {
  const { medicalRecordDrafts, saveMedicalRecordDraft, deleteMedicalRecordDraft } = useAppContext();
  const [petId, setPetId] = useState(record?.petId ?? draft?.petId ?? initialPetId);
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
  const [imageUrls, setImageUrls] = useState<string[]>(record?.imageUrls ?? draft?.imageUrls ?? []);
  const [moderationMessage, setModerationMessage] = useState('');
  const [requiredMessage, setRequiredMessage] = useState('');

  const selectedPet = pets.find((pet) => pet.id === petId);
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

  function applyDraftToForm(draftToApply: MedicalRecordDraft) {
    const draftHospital = hospitals.find((hospital) => hospital.id === draftToApply.hospitalId);

    setPetId(draftToApply.petId ?? '');
    setHospitalId(draftToApply.hospitalId ?? '');
    setHospitalSearchText(draftHospital?.name ?? '');
    setDate(draftToApply.date ?? getTodayDateValue());
    setDiagnosis(draftToApply.diagnosis ?? '');
    setVeterinarianNote(draftToApply.veterinarianNote ?? '');
    setPrescription(draftToApply.prescription ?? '');
    setCostText(typeof draftToApply.cost === 'number' ? draftToApply.cost.toLocaleString('ko-KR') : '');
    setMemo(draftToApply.memo ?? '');
    setImageUrls(draftToApply.imageUrls ?? []);
    setRequiredMessage('');
    setModerationMessage('');
  }

  function getSupportedAnimalSummary(hospital: Hospital) {
    if (!hospital.supportedAnimals || hospital.supportedAnimals.length === 0) {
      return '특수동물 진료 가능';
    }

    return hospital.supportedAnimals
      .map((animalType) => {
        if (animalType === 'reptile') {
          return '파충류';
        }

        if (animalType === 'rodent') {
          return '소동물';
        }

        return '조류';
      })
      .join(', ');
  }

  function getHospitalSourceSummary(hospital: Hospital) {
    if (!hospital.sources || hospital.sources.length === 0) {
      return '데이터셋';
    }

    return hospital.sources.map((source) => source.label).slice(0, 2).join(', ');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!petId || !hospitalId || !date) {
      setRequiredMessage('반려동물, 병원, 날짜를 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    if (!diagnosis.trim()) {
      setRequiredMessage('병명을 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    if (!prescription.trim()) {
      setRequiredMessage('처방을 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    const moderation = validateMedicalRecordText([
      { label: '진료 내용', value: diagnosis },
      { label: '수의사 소견', value: veterinarianNote },
      { label: '처방', value: prescription },
      { label: '메모', value: memo },
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
      imageUrls,
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
      imageUrls,
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
        imageUrls,
      });
    }

    onClose();
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setImageUrls((current) => [...current, ...nextUrls].slice(0, 3));
  }

  return (
    <ModalSheet
      open={open}
      onClose={handleClose}
      title={record ? '진료 기록 수정' : '진료 기록 추가'}
      description="반려동물과 병원을 선택하면 종 정보와 병원 이름을 자동으로 연결해드려요."
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

        {!record && medicalRecordDrafts.length > 0 ? (
          <label className="block space-y-2 border-y border-slate-100 py-4">
            <span className="text-sm font-semibold text-slate-700">저장된 진료 기록 초안 불러오기</span>
            <select
              value=""
              onChange={(event) => {
                const selectedDraft = medicalRecordDrafts.find((item) => item.id === event.target.value);

                if (selectedDraft) {
                  applyDraftToForm(selectedDraft);
                }
              }}
              className="w-full rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-slate-700"
            >
              <option value="">초안을 선택해 주세요</option>
              {medicalRecordDrafts.map((item) => {
                const draftPet = pets.find((pet) => pet.id === item.petId);
                const draftHospital = hospitals.find((hospital) => hospital.id === item.hospitalId);
                const label = [
                  item.date,
                  draftPet?.name,
                  draftHospital?.name,
                  item.diagnosis || '음성 요약 초안',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <option key={item.id} value={item.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
        ) : null}

        <div
          className="relative space-y-2"
          onBlur={() => {
            window.setTimeout(() => setShowHospitalOptions(false), 120);
          }}
        >
          <span className="text-sm font-medium text-slate-700">
            방문한 병원 <span className="text-rose-500">*</span>
          </span>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{hospital.name}</p>
                        <span className={`${classificationBadgeClass} bg-emerald-50 text-emerald-700`}>
                          {getSupportedAnimalSummary(hospital)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{hospital.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`${classificationBadgeClass} bg-slate-100 text-slate-600`}>
                          {getHospitalClassificationLabel(hospital.classification)}
                        </span>
                        <span className={`${classificationBadgeClass} bg-slate-100 text-slate-600`}>
                          {getHospitalSourceSummary(hospital)}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-slate-50 px-2.5 text-[11px] font-medium leading-none text-emerald-700">
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
          <div className="border-l-2 border-emerald-400 py-1 pl-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{selectedHospital.name}</p>
            <p className="mt-1 text-xs text-slate-500">{selectedHospital.address}</p>
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            반려동물 <span className="text-rose-500">*</span>
          </span>
          <select
            value={petId}
            onChange={(event) => setPetId(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3"
          >
            <option value="">반려동물을 선택해 주세요</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {pet.species}
              </option>
            ))}
          </select>
        </label>

        {selectedPet ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 border-y border-slate-100 py-4 text-sm text-slate-600">
            <div>
              <p className="text-xs text-slate-400">동물 분류</p>
              <p className="mt-1 font-medium text-slate-800">
                {getAnimalLabel(selectedPet.animalType)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">반려동물 이름</p>
              <p className="mt-1 font-medium text-slate-800">{selectedPet.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-400">종</p>
              <p className="mt-1 font-medium text-slate-800">{selectedPet.species}</p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              진료 날짜 <span className="text-rose-500">*</span>
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">비용</span>
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

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">사진 첨부</span>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-4 text-sm text-emerald-700">
            <Icon name="camera" className="h-5 w-5" />
            <span>최대 3장 업로드</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
          </label>
          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((imageUrl) => (
                <div key={imageUrl} className="relative overflow-hidden rounded-lg">
                  <img src={imageUrl} alt="진료 기록 미리보기" className="h-20 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setImageUrls((current) => current.filter((item) => item !== imageUrl))
                    }
                    className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            병명 <span className="text-rose-500">*</span>
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
          <span className="text-sm font-medium text-slate-700">
            처방 <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            value={prescription}
            onChange={(event) => setPrescription(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">수의사의 의견</span>
          <textarea
            rows={3}
            value={veterinarianNote}
            onChange={(event) => setVeterinarianNote(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">메모</span>
          <textarea
            rows={4}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

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
