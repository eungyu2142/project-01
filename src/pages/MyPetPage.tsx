import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ModalSheet } from '../components/ModalSheet';
import { PetEditor } from '../components/PetEditor';
import { RecordEditor } from '../components/RecordEditor';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate } from '../lib/format';
import { isImageAvatar } from '../lib/petAvatar';
import type { MedicalRecord, MedicalRecordDraft, Pet } from '../types';

interface MyPetRouteState {
  openRecordEditor?: boolean;
  draftRecord?: MedicalRecordDraft;
}

interface PetCardsProps {
  pets: Pet[];
  selectedPetId: string;
  onSelect: (petId: string) => void;
}

interface RecordCardsProps {
  records: MedicalRecord[];
  hospitalNames: Record<string, string>;
  activeRecordId: string;
  onSelect: (recordId: string) => void;
}

interface RecordDetailCardProps {
  record: MedicalRecord;
  hospitalNames: Record<string, string>;
  onOpenReview?: () => void;
  actionSlot?: ReactNode;
}

const animalName = {
  reptile: '파충류',
  rodent: '설치류',
  bird: '조류',
} as const;

function truncateWithDots(value: string, maxLength = 18) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}.......`;
}

function RecordDetailCard({
  record,
  hospitalNames,
  onOpenReview,
  actionSlot,
}: RecordDetailCardProps) {
  return (
    <div className="rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{formatDate(record.date)}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{record.diagnosis}</h3>
        </div>
        {actionSlot ? <div className="flex gap-2">{actionSlot}</div> : null}
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600">
        <div className="rounded-2xl bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">병원</p>
          <p className="mt-1 font-medium text-slate-800">{hospitalNames[record.hospitalId]}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">수의사 소견</p>
          <p className="mt-1 leading-6 text-slate-800">{record.veterinarianNote}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-50/70 p-4">
            <p className="text-xs text-slate-400">처방</p>
            <p className="mt-1 text-slate-800">{record.prescription || '없음'}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50/70 p-4">
            <p className="text-xs text-slate-400">진료 비용</p>
            <p className="mt-1 overflow-hidden whitespace-nowrap text-slate-800" title={formatCurrency(record.cost)}>
              {truncateWithDots(formatCurrency(record.cost))}
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">메모</p>
          <p className="mt-1 leading-6 text-slate-800">{record.memo || '아직 메모가 없어요'}</p>
        </div>
      </div>

      {onOpenReview ? (
        <button
          type="button"
          onClick={onOpenReview}
          className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-4 py-3 font-semibold text-white"
        >
          이 경험을 리뷰로 작성하기
        </button>
      ) : null}
    </div>
  );
}

function PetCards({ pets, selectedPetId, onSelect }: PetCardsProps) {
  const [visibleCount, setVisibleCount] = useState(2);
  const visiblePets = pets.slice(0, visibleCount);
  const hasMore = pets.length > visibleCount;

  if (pets.length === 0) {
    return (
      <div className="mt-4 rounded-[1.8rem] bg-white/90 px-4 py-8 text-center shadow-[0_14px_35px_rgba(15,118,110,0.08)]">
        <p className="text-base font-semibold text-slate-800">등록된 반려동물이 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">등록 버튼으로 첫 반려동물을 추가해보세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {visiblePets.map((pet) => (
          <button
            key={pet.id}
            type="button"
            onClick={() => onSelect(pet.id)}
            className={`flex w-full items-center justify-between rounded-[1.8rem] border bg-white px-4 py-4 text-left shadow-[0_14px_35px_rgba(15,118,110,0.08)] ${
              pet.id === selectedPetId ? 'border-emerald-400' : 'border-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,_#ecfdf5,_#bbf7d0)] text-3xl">
                {isImageAvatar(pet.avatar) ? (
                  <img src={pet.avatar} alt={`${pet.name} 사진`} className="h-full w-full object-cover" />
                ) : (
                  pet.avatar
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{pet.name}</p>
                <p className="text-sm text-slate-500">{pet.species}</p>
                <div className="mt-2 flex gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    {animalName[pet.animalType]}
                  </span>
                  <span>{pet.gender}</span>
                  <span>{pet.ageLabel}</span>
                </div>
              </div>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Icon name="chevron" className="h-6 w-6" />
            </span>
          </button>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 2)}
          className="mt-4 w-full rounded-[1.6rem] border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_12px_30px_rgba(15,118,110,0.08)]"
        >
          반려동물 더보기
        </button>
      ) : null}
    </>
  );
}

function RecordCards({ records, hospitalNames, activeRecordId, onSelect }: RecordCardsProps) {
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = records.length > visibleCount;

  if (records.length === 0) {
    return (
      <div className="mt-4 rounded-[1.8rem] bg-white/90 px-4 py-8 text-center shadow-[0_14px_35px_rgba(15,118,110,0.08)]">
        <p className="text-base font-semibold text-slate-800">아직 진료 기록이 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">기록 추가 버튼으로 첫 진료 이력을 남겨보세요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {visibleRecords.map((record) => (
          <button
            key={record.id}
            type="button"
            onClick={() => onSelect(record.id)}
            className={`w-full rounded-[1.8rem] border px-4 py-4 text-left shadow-[0_14px_35px_rgba(15,118,110,0.08)] ${
              activeRecordId === record.id ? 'border-emerald-300 bg-white' : 'border-white bg-white/90'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Icon name="calendar" className="h-4 w-4" />
                  {formatDate(record.date)}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{record.diagnosis}</p>
                <p className="mt-1 text-sm text-slate-500">{hospitalNames[record.hospitalId]}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <Icon name="chevron" className="h-6 w-6" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 3)}
          className="mt-4 w-full rounded-[1.6rem] border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_12px_30px_rgba(15,118,110,0.08)]"
        >
          진료 기록 더보기
        </button>
      ) : null}
    </>
  );
}

export function MyPetPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as MyPetRouteState | null;
  const {
    hospitals,
    medicalRecords,
    pets,
    saveMedicalRecord,
    deleteMedicalRecord,
    savePet,
    deletePet,
  } = useAppContext();
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? '');
  const [petEditorOpen, setPetEditorOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [recordEditorOpen, setRecordEditorOpen] = useState(Boolean(routeState?.openRecordEditor));
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [draftRecord, setDraftRecord] = useState<MedicalRecordDraft | null>(routeState?.draftRecord ?? null);
  const [allRecordsOpen, setAllRecordsOpen] = useState(false);

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedPetId('');
      return;
    }

    if (!pets.some((pet) => pet.id === selectedPetId)) {
      setSelectedPetId(pets[0].id);
    }
  }, [pets, selectedPetId]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0];
  const selectedPetRecords = [...medicalRecords]
    .filter((record) => record.petId === selectedPet?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [expandedRecordId, setExpandedRecordId] = useState(selectedPetRecords[0]?.id ?? '');
  const activeRecordId = selectedPetRecords.some((record) => record.id === expandedRecordId)
    ? expandedRecordId
    : (selectedPetRecords[0]?.id ?? '');
  const expandedRecord =
    selectedPetRecords.find((record) => record.id === activeRecordId) ?? selectedPetRecords[0];

  const hospitalNames = hospitals.reduce<Record<string, string>>((acc, hospital) => {
    acc[hospital.id] = hospital.name;
    return acc;
  }, {});

  function startRecordToReview(record: MedicalRecord, pet: Pet) {
    navigate('/reviews', {
      state: {
        hospitalId: record.hospitalId,
        animalType: pet.animalType,
        openComposer: true,
        draft: {
          hospitalId: record.hospitalId,
          petId: record.petId,
          date: record.date,
          diagnosis: record.diagnosis,
          cost: record.cost,
          medicine: record.prescription,
        },
      },
    });
  }

  function handleDeleteSelectedPet() {
    if (!selectedPet) {
      return;
    }

    const shouldDelete = window.confirm('정말 삭제하시겠습니까?');

    if (!shouldDelete) {
      return;
    }

    deletePet(selectedPet.id);
    return;

    const confirmed = window.confirm(
      `${selectedPet.name} 프로필을 삭제할까요?\n연결된 진료 기록과 리뷰도 함께 삭제됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    deletePet(selectedPet.id);
  }

  function handleDeleteRecord(recordId: string) {
    const confirmed = window.confirm('정말 삭제하시겠습니까?');

    if (!confirmed) {
      return;
    }

    deleteMedicalRecord(recordId);
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,_#18c19a_0%,_#0faa8c_100%)]" />
      <div className="relative">
        <section className="flex min-h-[11rem] flex-col justify-center pb-4 text-white">
          <p className="text-sm text-emerald-50/90">보호자 관리</p>
          <h1 className="mt-1 text-[2.2rem] font-semibold tracking-[-0.03em]">마이 펫</h1>
          <p className="mt-3 text-sm text-emerald-50/90">우리 아이들의 건강 기록</p>
        </section>

        <section className="mt-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">내 반려동물</h2>
            <div className="flex gap-2">
              {selectedPet ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPet(selectedPet);
                    setPetEditorOpen(true);
                  }}
                  className="rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-emerald-700"
                >
                  수정
                </button>
              ) : null}
              {selectedPet ? (
                <button
                  type="button"
                  onClick={handleDeleteSelectedPet}
                  className="rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
                >
                  삭제
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditingPet(null);
                  setPetEditorOpen(true);
                }}
                className="rounded-full bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-4 py-2 text-sm font-medium text-white"
              >
                + 등록
              </button>
            </div>
          </div>

          <PetCards
            key={`pets-${pets.length}`}
            pets={pets}
            selectedPetId={selectedPetId}
            onSelect={setSelectedPetId}
          />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedPet ? `${selectedPet.name}의 진료 기록` : '진료 기록'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">최신순으로 정렬됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftRecord(null);
                setEditingRecord(null);
                setRecordEditorOpen(true);
              }}
              disabled={!selectedPet}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                selectedPet
                  ? 'bg-[linear-gradient(135deg,_#10b981,_#0f766e)] text-white'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              }`}
            >
              + 기록 추가
            </button>
          </div>

          <RecordCards
            key={`records-${selectedPet?.id ?? 'none'}-${selectedPetRecords.length}`}
            records={selectedPetRecords}
            hospitalNames={hospitalNames}
            activeRecordId={activeRecordId}
            onSelect={setExpandedRecordId}
          />

          {selectedPetRecords.length > 0 ? (
            <button
              type="button"
              onClick={() => setAllRecordsOpen(true)}
              className="mt-4 w-full rounded-[1.6rem] border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_12px_30px_rgba(15,118,110,0.08)]"
            >
              기록 전체 보기
            </button>
          ) : null}

          {expandedRecord && selectedPet ? (
            <div className="mt-5 rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">{formatDate(expandedRecord.date)}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {expandedRecord.diagnosis}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftRecord(null);
                      setEditingRecord(expandedRecord);
                      setRecordEditorOpen(true);
                    }}
                    className="rounded-full bg-emerald-50 p-2 text-emerald-700"
                  >
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(expandedRecord.id)}
                    className="rounded-full bg-rose-50 p-2 text-rose-500"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-emerald-50/70 p-4">
                  <p className="text-xs text-slate-400">병원</p>
                  <p className="mt-1 font-medium text-slate-800">
                    {hospitalNames[expandedRecord.hospitalId]}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50/70 p-4">
                  <p className="text-xs text-slate-400">수의사 소견</p>
                  <p className="mt-1 leading-6 text-slate-800">{expandedRecord.veterinarianNote}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-emerald-50/70 p-4">
                    <p className="text-xs text-slate-400">처방</p>
                    <p className="mt-1 text-slate-800">{expandedRecord.prescription || '없음'}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50/70 p-4">
                    <p className="text-xs text-slate-400">진료 비용</p>
                    <p
                      className="mt-1 overflow-hidden whitespace-nowrap text-slate-800"
                      title={formatCurrency(expandedRecord.cost)}
                    >
                      {truncateWithDots(formatCurrency(expandedRecord.cost))}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-emerald-50/70 p-4">
                  <p className="text-xs text-slate-400">메모</p>
                  <p className="mt-1 leading-6 text-slate-800">
                    {expandedRecord.memo || '아직 메모가 없어요.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => startRecordToReview(expandedRecord, selectedPet)}
                className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-4 py-3 font-semibold text-white"
              >
                이 경험을 리뷰로 작성하기
              </button>
            </div>
          ) : null}
        </section>

        <ModalSheet
          open={allRecordsOpen}
          title={selectedPet ? `${selectedPet.name} 진료 기록 전체` : '진료 기록 전체'}
          description="선택한 반려동물의 진료 기록을 한 번에 볼 수 있어요."
          onClose={() => setAllRecordsOpen(false)}
        >
          <div className="space-y-4">
            {selectedPetRecords.map((record) => (
              <div key={record.id} className="space-y-3">
                <RecordDetailCard
                  record={record}
                  hospitalNames={hospitalNames}
                  onOpenReview={
                    selectedPet ? () => startRecordToReview(record, selectedPet) : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    setExpandedRecordId(record.id);
                    setAllRecordsOpen(false);
                  }}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700"
                >
                  이 기록 선택하기
                </button>
              </div>
            ))}
          </div>
        </ModalSheet>

        <PetEditor
          key={`pet-editor-${editingPet?.id ?? 'new'}-${petEditorOpen ? 'open' : 'closed'}`}
          open={petEditorOpen}
          pet={editingPet}
          onClose={() => {
            setPetEditorOpen(false);
            setEditingPet(null);
          }}
          onSave={savePet}
        />
        <RecordEditor
          key={`${editingRecord?.id ?? draftRecord?.id ?? 'new'}-${recordEditorOpen ? 'open' : 'closed'}`}
          open={recordEditorOpen}
          record={editingRecord}
          draft={draftRecord}
          pets={pets}
          hospitals={hospitals}
          presetPetId={selectedPet?.id}
          onClose={() => {
            setRecordEditorOpen(false);
            setEditingRecord(null);
            setDraftRecord(null);
            if (location.state) {
              navigate(location.pathname, { replace: true, state: null });
            }
          }}
          onSave={saveMedicalRecord}
        />
      </div>
    </div>
  );
}
