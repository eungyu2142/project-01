import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAppContext } from '../context/AppContext';
import { validateReviewText } from '../lib/contentModeration';
import { getTodayDateValue } from '../lib/date';
import { getAnimalLabel } from '../lib/format';
import {
  getHospitalClassificationLabel,
  isDatasetHospital,
} from '../lib/hospitalDataset';
import { findRecordForReview } from '../lib/recordReviewLink';
import type { Hospital, Review, ReviewDraft } from '../types';
import { Icon } from './Icon';
import { ModalSheet } from './ModalSheet';

const reviewTagOptions = [
  { emoji: '🩺', label: '수의사 설명이 친절해요' },
  { emoji: '✨', label: '병원이 위생적이에요' },
  { emoji: '📋', label: '설명이 자세해요' },
  { emoji: '💸', label: '가격이 합리적이에요' },
  { emoji: '🤍', label: '아이를 조심스럽게 다뤄줘요' },
  { emoji: '💊', label: '진료 소비가 과하지 않았어요' },
  { emoji: '⏰', label: '예약 시간이 잘 지켜져요' },
  { emoji: '🪑', label: '대기 시간이 짧아요' },
  { emoji: '🚨', label: '응급 상황도 빠르게 대응해요' },
  { emoji: '🧪', label: '검사 결과를 쉽게 알려줘요' },
  { emoji: '🏠', label: '집에서 관리하는 법을 알려줘요' },
  { emoji: '🐾', label: '특수동물 특성을 잘 이해해요' },
  { emoji: '🥼', label: '과잉진료가 없었어요' },
  { emoji: '🪙', label: '비용 안내가 명확해요' },
  { emoji: '🌿', label: '병원 분위기가 차분해요' },
  { emoji: '🤝', label: '보호자를 안심시켜줘요' },
];

interface ReviewComposerProps {
  open: boolean;
  onClose: () => void;
  initialDraft?: ReviewDraft;
  editingReview?: Review | null;
}

function buildCostText(cost: number | null | undefined) {
  if (typeof cost !== 'number') {
    return '';
  }

  return cost.toLocaleString('ko-KR');
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

function getDistanceValueKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ReviewComposer({
  open,
  onClose,
  initialDraft,
  editingReview,
}: ReviewComposerProps) {
  const {
    hospitals,
    medicalRecords,
    pets,
    saveReview,
    saveReviewDraft,
    deleteReviewDraft,
    user,
  } = useAppContext();
  const availableHospitals = useMemo(
    () => hospitals.filter((hospital) => isDatasetHospital(hospital)),
    [hospitals],
  );
  const sourcePet = editingReview
    ? pets.find((pet) => pet.id === editingReview.petId)
    : pets.find((pet) => pet.id === initialDraft?.petId);
  const [petId, setPetId] = useState(sourcePet?.id ?? '');
  const [hospitalId, setHospitalId] = useState(
    editingReview?.hospitalId ?? initialDraft?.hospitalId ?? '',
  );
  const [hospitalSearchText, setHospitalSearchText] = useState('');
  const [showHospitalOptions, setShowHospitalOptions] = useState(false);
  const [date, setDate] = useState(editingReview?.date ?? initialDraft?.date ?? getTodayDateValue());
  const [diagnosis, setDiagnosis] = useState(editingReview?.diagnosis ?? initialDraft?.diagnosis ?? '');
  const [medicine, setMedicine] = useState(editingReview?.medicine ?? initialDraft?.medicine ?? '');
  const [costText, setCostText] = useState(buildCostText(editingReview?.cost ?? initialDraft?.cost));
  const [rating, setRating] = useState(editingReview?.rating ?? initialDraft?.rating ?? 5);
  const [body, setBody] = useState(editingReview?.body ?? initialDraft?.body ?? '');
  const [tags, setTags] = useState<string[]>(editingReview?.tags ?? initialDraft?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [customTags, setCustomTags] = useState<string[]>(
    editingReview?.customTags ?? initialDraft?.customTags ?? [],
  );
  const [imageUrls, setImageUrls] = useState<string[]>(
    editingReview?.imageUrls ?? initialDraft?.imageUrls ?? [],
  );
  const [saveToRecord, setSaveToRecord] = useState(false);
  const [saveToRecordMemo, setSaveToRecordMemo] = useState('');
  const [moderationMessage, setModerationMessage] = useState('');
  const [requiredMessage, setRequiredMessage] = useState('');
  const draftId = initialDraft?.id;

  const selectedPet = pets.find((pet) => pet.id === petId);
  const selectedHospital = availableHospitals.find((hospital) => hospital.id === hospitalId);
  const existingLinkedRecord = selectedPet
    ? findRecordForReview(medicalRecords, {
        petId: selectedPet.id,
        hospitalId,
        date,
        diagnosis,
        cost: costText ? Number(costText.replaceAll(',', '')) : null,
      })
    : null;
  const hospitalMatches = useMemo(() => {
    const keyword = hospitalSearchText.trim().toLowerCase();
    const sortedHospitals = [...availableHospitals].sort((left, right) =>
      getDistanceValueKm(user.location.lat, user.location.lng, left.lat, left.lng) -
        getDistanceValueKm(user.location.lat, user.location.lng, right.lat, right.lng) ||
      left.name.localeCompare(right.name, 'ko'),
    );

    if (!keyword) {
      return sortedHospitals;
    }

    return sortedHospitals
      .filter((hospital) => {
        const name = hospital.name.toLowerCase();
        const address = hospital.address.toLowerCase();

        return name.includes(keyword) || address.includes(keyword);
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
  }, [availableHospitals, hospitalSearchText, user.location.lat, user.location.lng]);

  function selectHospital(hospitalIdToSelect: string) {
    const hospital = availableHospitals.find((item) => item.id === hospitalIdToSelect);

    if (!hospital) {
      return;
    }

    setHospitalId(hospital.id);
    setHospitalSearchText(hospital.name);
    setShowHospitalOptions(false);
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function addCustomTag() {
    const cleaned = customTag.trim();

    if (!cleaned || customTags.includes(cleaned)) {
      return;
    }

    const moderation = validateReviewText([{ label: '직접 태그', value: cleaned }]);

    if (!moderation.ok) {
      setModerationMessage(moderation.message);
      return;
    }

    setCustomTags((current) => [...current, cleaned]);
    setCustomTag('');
    setModerationMessage('');
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setImageUrls((current) => [...current, ...nextUrls].slice(0, 3));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPet || !hospitalId || !date) {
      setRequiredMessage('필수 항목을 입력해 주세요.');
      setModerationMessage('');
      return;
    }

    setRequiredMessage('');

    const moderation = validateReviewText([
      { label: '진단 항목', value: diagnosis },
      { label: '진료 기록', value: medicine },
      { label: '직접 태그', value: customTags.join(' ') },
      { label: '리뷰 본문', value: body },
    ]);

    if (!moderation.ok) {
      setModerationMessage(moderation.message);
      return;
    }

    saveReview({
      id: editingReview?.id,
      hospitalId,
      petId: selectedPet.id,
      animalType: selectedPet.animalType,
      species: selectedPet.species,
      petName: selectedPet.name,
      diagnosis,
      cost: costText ? Number(costText.replaceAll(',', '')) : null,
      date,
      medicine,
      tags,
      customTags,
      body,
      imageUrls,
      rating,
      saveToRecord: saveToRecord && !existingLinkedRecord,
      saveToRecordMemo,
    });

    if (draftId) {
      deleteReviewDraft(draftId);
    }

    setModerationMessage('');
    onClose();
  }

  function handleSaveDraft() {
    const savedDraftId = saveReviewDraft({
      id: draftId,
      hospitalId,
      petId,
      date,
      diagnosis,
      cost: costText ? Number(costText.replaceAll(',', '')) : null,
      medicine,
      tags,
      customTags,
      body,
      rating,
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
    if (!editingReview && draftId) {
      saveReviewDraft({
        id: draftId,
        hospitalId,
        petId,
        date,
        diagnosis,
        cost: costText ? Number(costText.replaceAll(',', '')) : null,
        medicine,
        tags,
        customTags,
        body,
        rating,
        imageUrls,
      });
    }

    onClose();
  }

  return (
    <ModalSheet
      open={open}
      onClose={handleClose}
      title={editingReview ? '리뷰 수정' : '리뷰 작성'}
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

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            어떤 아이가 진료받았나요? <span className="text-rose-500">*</span>
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
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-emerald-50/70 p-4 text-sm text-slate-600">
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
              value={hospitalSearchText || (hospitalId && selectedHospital ? selectedHospital.name : '')}
              onChange={(event) => {
                setHospitalSearchText(event.target.value);
                setHospitalId('');
                setShowHospitalOptions(true);
              }}
              onFocus={() => setShowHospitalOptions(true)}
              placeholder="병원 이름을 검색해 선택해 주세요"
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
            <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 max-h-[26rem] overflow-y-auto rounded-lg bg-white text-slate-700 shadow-[0_22px_50px_rgba(15,118,110,0.18)]">
              {hospitalMatches.length > 0 ? (
                hospitalMatches.map((hospital) => (
                  <button
                    key={hospital.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectHospital(hospital.id)}
                    className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{hospital.name}</p>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {getSupportedAnimalSummary(hospital)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{hospital.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {getHospitalClassificationLabel(hospital.classification)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {getHospitalSourceSummary(hospital)}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      선택
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-5 text-center text-sm text-slate-500">
                  병원 데이터가 아직 없어요. 병원 목록이 로드됐는지 먼저 확인해 주세요.
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
              placeholder="85,000"
              value={costText}
              onChange={(event) => {
                const numberOnly = event.target.value.replace(/\D/g, '');
                setCostText(numberOnly ? Number(numberOnly).toLocaleString('ko-KR') : '');
              }}
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">병명</span>
          <input
            type="text"
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            placeholder="예: 장염, 식욕 부진, 체중 검사"
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">직접 작성란 (진료 기록)</span>
          <input
            type="text"
            value={medicine}
            onChange={(event) => setMedicine(event.target.value)}
            placeholder="예: 진통제 3일치"
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">리뷰 별점</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-md p-2 ${
                  value <= rating ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'
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
                onClick={() => toggleTag(tag.label)}
                className={`rounded-md px-3 py-2 text-sm ${
                  tags.includes(tag.label)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <span className="mr-1">{tag.emoji}</span>#{tag.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">직접 태그 작성</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              placeholder="예: 야간진료, 입원 가능"
              className="flex-1 rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="rounded-lg bg-emerald-600 px-4 py-3 text-white"
            >
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCustomTags((current) => current.filter((item) => item !== tag))}
                className="rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-600"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">리뷰 본문</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="진료 경험을 자유롭게 적어 주세요."
            className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
          />
        </label>

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
                  <img src={imageUrl} alt="리뷰 미리보기" className="h-20 w-full object-cover" />
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

        {existingLinkedRecord ? (
          <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
            이미 같은 진료 기록이 있어요.
          </div>
        ) : (
          <label className="flex items-center gap-3 rounded-lg bg-emerald-50/80 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={saveToRecord}
              onChange={(event) => setSaveToRecord(event.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span>마이펫 기록에도 저장하기</span>
          </label>
        )}

        {saveToRecord && !existingLinkedRecord ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">기록 메모</span>
            <textarea
              rows={3}
              value={saveToRecordMemo}
              onChange={(event) => setSaveToRecordMemo(event.target.value)}
              placeholder="마이펫 진료 기록에 남길 메모를 적어주세요."
              className="w-full rounded-lg border border-emerald-100 bg-white px-4 py-3"
            />
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {!editingReview ? (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-3 font-semibold text-emerald-700"
            >
              {draftId ? '임시 저장 업데이트' : '임시 저장'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)]"
          >
            {editingReview ? '리뷰 수정 완료' : '리뷰 등록하기'}
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
