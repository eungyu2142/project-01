import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimalTabs } from '../components/AnimalTabs';
import { Icon } from '../components/Icon';
import { ModalSheet } from '../components/ModalSheet';
import { PetEditor } from '../components/PetEditor';
import { RecordEditor } from '../components/RecordEditor';
import { SearchBar } from '../components/SearchBar';
import { SpeechSummaryPanel } from '../components/SpeechSummaryPanel';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate } from '../lib/format';
import { isImageAvatar } from '../lib/petAvatar';
import { findReviewForRecord } from '../lib/recordReviewLink';
import { getTodayDateValue } from '../lib/date';
import { summarizeSpeechAudio, type SpeechSummaryResult } from '../lib/speechSummary';
import type { AnimalFilter, MedicalRecord, MedicalRecordDraft, Pet } from '../types';

interface MyPetRouteState {
  openRecordEditor?: boolean;
  draftRecord?: MedicalRecordDraft;
  returnTo?: string;
}

interface PetCardsProps {
  pets: Pet[];
  selectedPetId: string;
  onSelect: (petId: string) => void;
}

interface RecordCardsProps {
  records: MedicalRecord[];
  hospitalNames: Record<string, string>;
  petNames: Record<string, string>;
  activeRecordId: string;
  onDelete: (recordId: string) => void;
  onEdit: (record: MedicalRecord) => void;
  onSelect: (recordId: string) => void;
}

interface RecordDetailCardProps {
  record: MedicalRecord;
  hospitalNames: Record<string, string>;
  petNames: Record<string, string>;
  onOpenReview?: () => void;
  actionSlot?: ReactNode;
}

const animalName = {
  reptile: '파충류',
  rodent: '설치류',
  bird: '조류',
} as const;
const missingSpeechValue = '언급 없음';

function isMentioned(value: string | undefined) {
  return Boolean(value?.trim() && value.trim() !== missingSpeechValue);
}

function getMentionedValue(value: string | undefined) {
  return isMentioned(value) ? value?.trim() ?? '' : '';
}

function makeRecordDraftId() {
  return `record-draft-${crypto.randomUUID()}`;
}

function getRecordingFileExtension(mimeType: string) {
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

function truncateWithDots(value: string, maxLength = 18) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}.......`;
}

function RecordDetailCard({
  record,
  hospitalNames,
  petNames,
  onOpenReview,
  actionSlot,
}: RecordDetailCardProps) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white p-5 shadow-[0_8px_20px_rgba(15,118,110,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{formatDate(record.date)}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{record.diagnosis}</h3>
          <p className="mt-1 text-sm font-medium text-emerald-700">{petNames[record.petId] ?? '반려동물 미선택'}</p>
        </div>
        {actionSlot ? <div className="flex gap-2">{actionSlot}</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div className="col-span-2 rounded-lg bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">병원</p>
          <p className="mt-1 font-medium text-slate-800">{hospitalNames[record.hospitalId]}</p>
        </div>
        <div className="col-span-2 rounded-lg bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">수의사 의견</p>
          <p className="mt-1 leading-6 text-slate-800">{record.veterinarianNote}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">처방</p>
          <p className="mt-1 break-words text-slate-800">{record.prescription || '없음'}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">진료 비용</p>
          <p className="mt-1 overflow-hidden whitespace-nowrap text-slate-800" title={formatCurrency(record.cost)}>
            {truncateWithDots(formatCurrency(record.cost))}
          </p>
        </div>
        <div className="col-span-2 rounded-lg bg-emerald-50/70 p-4">
          <p className="text-xs text-slate-400">메모</p>
          <p className="mt-1 leading-6 text-slate-800">{record.memo || '아직 메모가 없어요'}</p>
        </div>
      </div>

      {(record.imageUrls ?? []).length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(record.imageUrls ?? []).map((imageUrl) => (
            <img
              key={imageUrl}
              src={imageUrl}
              alt="진료 기록 이미지"
              className="h-24 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}

      {onOpenReview ? (
        <button
          type="button"
          onClick={onOpenReview}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white"
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
    return null;
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {visiblePets.map((pet) => (
          <button
            key={pet.id}
            type="button"
            onClick={() => onSelect(pet.id)}
            className={`flex w-full items-center rounded-lg border bg-white px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,118,110,0.07)] ${
              pet.id === selectedPetId ? 'border-emerald-400' : 'border-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-emerald-100 text-3xl">
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
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                    {animalName[pet.animalType]}
                  </span>
                  <span>{pet.gender}</span>
                  <span>{pet.ageLabel}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 2)}
          className="mt-4 w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_6px_14px_rgba(15,118,110,0.06)]"
        >
          반려동물 더보기
        </button>
      ) : null}
    </>
  );
}

function RecordCards({
  records,
  hospitalNames,
  petNames,
  activeRecordId,
  onDelete,
  onEdit,
  onSelect,
}: RecordCardsProps) {
  const [visibleCount, setVisibleCount] = useState(3);
  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = records.length > visibleCount;

  if (records.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        {visibleRecords.map((record) => (
          <article
            key={record.id}
            className={`w-full rounded-lg border px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,118,110,0.07)] ${
              activeRecordId === record.id ? 'border-emerald-300 bg-white' : 'border-white bg-white/90'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onSelect(record.id)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Icon name="calendar" className="h-4 w-4" />
                  {formatDate(record.date)}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{record.diagnosis}</p>
                <p className="mt-1 text-sm font-medium text-emerald-700">{petNames[record.petId] ?? '반려동물 미선택'}</p>
                <p className="mt-1 text-sm text-slate-500">{hospitalNames[record.hospitalId]}</p>
              </button>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(record)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
                  aria-label="진료 기록 수정"
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(record.id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500"
                  aria-label="진료 기록 삭제"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 3)}
          className="mt-4 w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_6px_14px_rgba(15,118,110,0.06)]"
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
    reviews,
    saveMedicalRecord,
    deleteMedicalRecord,
    savePet,
    deletePet,
  } = useAppContext();
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalFilter>('all');
  const [petSearchText, setPetSearchText] = useState('');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [petEditorOpen, setPetEditorOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [recordEditorOpen, setRecordEditorOpen] = useState(Boolean(routeState?.openRecordEditor));
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [draftRecord, setDraftRecord] = useState<MedicalRecordDraft | null>(routeState?.draftRecord ?? null);
  const [returnTo] = useState(routeState?.returnTo ?? '');
  const [allRecordsOpen, setAllRecordsOpen] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState('');
  const [speechModalOpen, setSpeechModalOpen] = useState(false);
  const [speechAudioFile, setSpeechAudioFile] = useState<File | null>(null);
  const [speechSummary, setSpeechSummary] = useState<SpeechSummaryResult | null>(null);
  const [speechMessage, setSpeechMessage] = useState('');
  const [speechIsRecording, setSpeechIsRecording] = useState(false);
  const [speechIsSummarizing, setSpeechIsSummarizing] = useState(false);
  const speechRecorderRef = useRef<MediaRecorder | null>(null);
  const speechChunksRef = useRef<Blob[]>([]);

  const petCounts = useMemo(
    () => ({
      all: pets.length,
      reptile: pets.filter((pet) => pet.animalType === 'reptile').length,
      rodent: pets.filter((pet) => pet.animalType === 'rodent').length,
      bird: pets.filter((pet) => pet.animalType === 'bird').length,
    }),
    [pets],
  );

  const filteredPets = useMemo(() => {
    const keyword = petSearchText.trim().toLowerCase();
    const animalFilteredPets =
      selectedAnimal === 'all' ? pets : pets.filter((pet) => pet.animalType === selectedAnimal);

    if (!keyword) {
      return animalFilteredPets;
    }

    return animalFilteredPets.filter(
      (pet) =>
        pet.name.toLowerCase().includes(keyword) ||
        pet.species.toLowerCase().includes(keyword),
    );
  }, [petSearchText, pets, selectedAnimal]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const petsById = useMemo(
    () =>
      pets.reduce<Record<string, Pet>>((acc, pet) => {
        acc[pet.id] = pet;
        return acc;
      }, {}),
    [pets],
  );
  const recordEditorPets = useMemo(() => {
    if (editingRecord) {
      return pets;
    }

    if (selectedPet) {
      return [selectedPet];
    }

    if (selectedAnimal === 'all') {
      return pets;
    }

    return pets.filter((pet) => pet.animalType === selectedAnimal);
  }, [editingRecord, pets, selectedAnimal, selectedPet]);
  const visibleRecords = [...medicalRecords]
    .filter((record) => {
      if (selectedPet) {
        return record.petId === selectedPet.id;
      }

      if (selectedAnimal === 'all') {
        return true;
      }

      return petsById[record.petId]?.animalType === selectedAnimal;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeRecordId = visibleRecords.some((record) => record.id === expandedRecordId)
    ? expandedRecordId
    : '';
  const expandedRecord = activeRecordId
    ? visibleRecords.find((record) => record.id === activeRecordId)
    : undefined;
  const expandedRecordPet = expandedRecord ? pets.find((pet) => pet.id === expandedRecord.petId) ?? null : null;
  const expandedRecordHasReview = expandedRecord ? Boolean(findReviewForRecord(reviews, expandedRecord)) : false;

  useEffect(() => {
    if (!selectedPetId) {
      setExpandedRecordId('');
      return;
    }

    const selectedPetExists = pets.some((pet) => pet.id === selectedPetId);
    const selectedPetVisible = filteredPets.some((pet) => pet.id === selectedPetId);

    if (!selectedPetExists || !selectedPetVisible) {
      setSelectedPetId('');
      setExpandedRecordId('');
    }
  }, [filteredPets, pets, selectedPetId]);

  useEffect(() => {
    if (expandedRecordId && !visibleRecords.some((record) => record.id === expandedRecordId)) {
      setExpandedRecordId('');
    }
  }, [expandedRecordId, visibleRecords]);

  const hospitalNames = hospitals.reduce<Record<string, string>>((acc, hospital) => {
    acc[hospital.id] = hospital.name;
    return acc;
  }, {});

  const petNames = pets.reduce<Record<string, string>>((acc, pet) => {
    acc[pet.id] = pet.name;
    return acc;
  }, {});

  function resetSpeechFlow() {
    setSpeechAudioFile(null);
    setSpeechSummary(null);
    setSpeechMessage('');
  }

  function openSpeechModal() {
    resetSpeechFlow();
    setSpeechModalOpen(true);
  }

  function openDirectRecordEditor() {
    setDraftRecord(null);
    setEditingRecord(null);
    setRecordEditorOpen(true);
  }

  function setSpeechFile(file: File) {
    setSpeechAudioFile(file);
    setSpeechSummary(null);
    setSpeechMessage('');
  }

  function handleSpeechAudioFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setSpeechMessage('음성 파일은 최대 25MB까지 사용할 수 있어요.');
      return;
    }

    setSpeechFile(file);
  }

  async function startSpeechRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechMessage('이 브라우저에서는 녹음 기능을 사용할 수 없어요. 파일 업로드를 사용해 주세요.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      speechChunksRef.current = [];
      speechRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          speechChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordingMimeType = recorder.mimeType || 'audio/webm';
        const recordingExtension = getRecordingFileExtension(recordingMimeType);
        const blob = new Blob(speechChunksRef.current, {
          type: recordingMimeType,
        });
        const file = new File([blob], `medical-recording-${Date.now()}.${recordingExtension}`, {
          type: blob.type || recordingMimeType,
        });

        stream.getTracks().forEach((track) => track.stop());
        speechRecorderRef.current = null;
        speechChunksRef.current = [];
        setSpeechIsRecording(false);

        if (file.size === 0) {
          setSpeechMessage('녹음된 음성이 비어 있어요. 다시 시도해 주세요.');
          return;
        }

        setSpeechFile(file);
      };

      recorder.start();
      setSpeechIsRecording(true);
      setSpeechMessage('');
    } catch {
      setSpeechMessage('마이크 권한을 가져오지 못했어요. 브라우저 권한을 확인해 주세요.');
    }
  }

  function stopSpeechRecording() {
    const recorder = speechRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  }

  async function handleSummarizeSpeech() {
    if (!speechAudioFile) {
      setSpeechMessage('먼저 녹음하거나 음성 파일을 올려 주세요.');
      return;
    }

    setSpeechIsSummarizing(true);
    setSpeechMessage('');

    try {
      const summary = await summarizeSpeechAudio('record', speechAudioFile);
      setSpeechSummary(summary);
    } catch (error) {
      setSpeechMessage(error instanceof Error ? error.message : '음성 요약을 처리하지 못했어요.');
    } finally {
      setSpeechIsSummarizing(false);
    }
  }

  function openSpeechSummaryAsRecordDraft() {
    if (!speechSummary) {
      setSpeechMessage('먼저 음성을 요약해 주세요.');
      return;
    }

    const { fields } = speechSummary;
    const veterinarianNoteParts = [
      ['방문 목적', fields.visitPurpose],
      ['검사/치료 내용', fields.testTreatment],
      ['주의사항', fields.precautions],
      ['방문 계획', fields.followUpPlan],
      ['기타 메모', fields.otherMemo],
    ]
      .map(([label, value]) => {
        const mentionedValue = getMentionedValue(value);
        return mentionedValue ? `${label}: ${mentionedValue}` : '';
      })
      .filter(Boolean);
    const nextDraft: MedicalRecordDraft = {
      id: makeRecordDraftId(),
      petId: selectedPet?.id ?? '',
      hospitalId: '',
      date: getTodayDateValue(),
      diagnosis: getMentionedValue(fields.diagnosis),
      veterinarianNote: veterinarianNoteParts.join('\n') || missingSpeechValue,
      prescription: getMentionedValue(fields.prescription),
      cost: null,
      memo: speechSummary.transcript ? `전사문:\n${speechSummary.transcript}` : '',
      imageUrls: [],
      updatedAt: new Date().toISOString(),
    };

    setDraftRecord(nextDraft);
    setEditingRecord(null);
    setRecordEditorOpen(true);
    setSpeechModalOpen(false);
  }

  function startRecordToReview(record: MedicalRecord, pet: Pet) {
    navigate('/reviews', {
      state: {
        hospitalId: record.hospitalId,
        animalType: pet.animalType,
        openComposer: true,
        returnTo: returnTo || '/mypets',
        draft: {
          hospitalId: record.hospitalId,
          petId: record.petId,
          date: record.date,
          diagnosis: record.diagnosis,
          cost: record.cost,
          medicine: record.prescription,
          body: record.memo,
          imageUrls: record.imageUrls ?? [],
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
  }

  function handleDeleteRecord(recordId: string) {
    const confirmed = window.confirm('정말 삭제하시겠습니까?');

    if (!confirmed) {
      return;
    }

    deleteMedicalRecord(recordId);
    setExpandedRecordId('');
  }

  function closeRecordEditor() {
    setRecordEditorOpen(false);
    setEditingRecord(null);
    setDraftRecord(null);

    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }

  if (expandedRecord) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[#18b996]" />

        <div className="relative z-10">
          <header className="flex min-h-[7rem] flex-col items-start pt-7">
            <button
              type="button"
              onClick={() => setExpandedRecordId('')}
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/95 text-emerald-700 shadow-[0_8px_18px_rgba(15,118,110,0.14)]"
              aria-label="진료 기록 목록으로 돌아가기"
            >
              <Icon name="chevron" className="h-6 w-6 rotate-180" />
            </button>
          </header>

          <section className="mt-2">
            <RecordDetailCard
              record={expandedRecord}
              hospitalNames={hospitalNames}
              petNames={petNames}
              actionSlot={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftRecord(null);
                      setEditingRecord(expandedRecord);
                      setRecordEditorOpen(true);
                    }}
                    className="rounded-lg bg-emerald-50 p-2 text-emerald-700"
                    aria-label="진료 기록 수정"
                  >
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(expandedRecord.id)}
                    className="rounded-lg bg-rose-50 p-2 text-rose-500"
                    aria-label="진료 기록 삭제"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </>
              }
              onOpenReview={
                expandedRecordHasReview || !expandedRecordPet
                  ? undefined
                  : () => startRecordToReview(expandedRecord, expandedRecordPet)
              }
            />
          </section>

          <RecordEditor
            key={`${editingRecord?.id ?? draftRecord?.id ?? 'new'}-${recordEditorOpen ? 'open' : 'closed'}`}
            open={recordEditorOpen}
            record={editingRecord}
            draft={draftRecord}
            initialPetId={selectedPet?.id}
            pets={pets}
            hospitals={hospitals}
            onClose={closeRecordEditor}
            onSave={saveMedicalRecord}
          />
        </div>
      </div>
    );
  }

  return (
      <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-[#18b996]" />
      <div className="relative z-10">
        <section className="flex min-h-[14rem] flex-col justify-start pb-5 pt-7 text-white">
          <h1 className="mb-2 text-[2rem] font-semibold">반려동물 관리</h1>
          <SearchBar
            value={petSearchText}
            onValueChange={(nextValue) => {
              setPetSearchText(nextValue);
              setSelectedPetId('');
              setExpandedRecordId('');
            }}
            placeholder=""
            clearVisible={Boolean(petSearchText)}
            onClear={() => {
              setPetSearchText('');
              setSelectedPetId('');
              setExpandedRecordId('');
            }}
            clearLabel="반려동물 검색 지우기"
          />
          <AnimalTabs
            className="mt-3"
            value={selectedAnimal}
            onChange={(nextAnimal) => {
              setSelectedAnimal(nextAnimal);
              setExpandedRecordId('');
            }}
            counts={petCounts}
          />
        </section>

        <section className="mt-4">
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
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-emerald-700"
                >
                  수정
                </button>
              ) : null}
              {selectedPet ? (
                <button
                  type="button"
                  onClick={handleDeleteSelectedPet}
                  className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
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
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                + 등록
              </button>
            </div>
          </div>
          <PetCards
            key={`pets-${selectedAnimal}-${filteredPets.length}`}
            pets={filteredPets}
            selectedPetId={selectedPetId}
            onSelect={(petId) => {
              setSelectedPetId((current) => (current === petId ? '' : petId));
              setExpandedRecordId('');
            }}
          />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedPet
                  ? `${selectedPet.name}의 진료 기록`
                  : selectedAnimal === 'all'
                    ? '전체 진료 기록'
                    : `${animalName[selectedAnimal]} 진료 기록`}
              </h2>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openDirectRecordEditor}
              className="flex min-h-16 items-center justify-center rounded-lg bg-emerald-600 px-3 py-3 text-center text-sm font-semibold leading-5 text-white"
            >
              직접 작성
            </button>
            <button
              type="button"
              onClick={openSpeechModal}
              className="flex min-h-16 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-3 text-center text-sm font-semibold leading-5 text-emerald-700"
            >
              음성 요약
            </button>
          </div>

          <RecordCards
            key={`records-${selectedPet?.id ?? 'all'}-${visibleRecords.length}`}
            records={visibleRecords}
            hospitalNames={hospitalNames}
            petNames={petNames}
            activeRecordId={activeRecordId}
            onEdit={(record) => {
              setDraftRecord(null);
              setEditingRecord(record);
              setRecordEditorOpen(true);
            }}
            onDelete={handleDeleteRecord}
            onSelect={setExpandedRecordId}
          />
        </section>

        <ModalSheet
          open={allRecordsOpen}
          title={selectedPet ? `${selectedPet.name} 진료 기록 전체` : '진료 기록 전체'}
          description="선택한 반려동물의 진료 기록을 한 번에 볼 수 있어요."
          onClose={() => setAllRecordsOpen(false)}
        >
          <div className="space-y-4">
            {visibleRecords.map((record) => (
              <div key={record.id} className="space-y-3">
                <RecordDetailCard
                  record={record}
                  hospitalNames={hospitalNames}
                  petNames={petNames}
                  onOpenReview={
                    pets.find((pet) => pet.id === record.petId) && !findReviewForRecord(reviews, record)
                      ? () => {
                          const recordPet = pets.find((pet) => pet.id === record.petId);

                          if (recordPet) {
                            startRecordToReview(record, recordPet);
                          }
                        }
                      : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    setExpandedRecordId(record.id);
                    setAllRecordsOpen(false);
                  }}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700"
                >
                  이 기록 선택하기
                </button>
              </div>
            ))}
          </div>
        </ModalSheet>

        <ModalSheet
          open={speechModalOpen}
          title="음성 인식 수의사 의견 요약"
          onClose={() => setSpeechModalOpen(false)}
        >
          <SpeechSummaryPanel
            applyLabel="진료 기록으로 열기"
            audioMessage={speechMessage}
            canRequestSummary={Boolean(speechAudioFile)}
            isRecording={speechIsRecording}
            isSummarizing={speechIsSummarizing}
            summary={speechSummary}
            onApplySummary={speechSummary ? openSpeechSummaryAsRecordDraft : undefined}
            onAudioFileChange={handleSpeechAudioFileChange}
            onStartRecording={startSpeechRecording}
            onStopRecording={stopSpeechRecording}
            onSummaryChange={setSpeechSummary}
            onSummarize={handleSummarizeSpeech}
          />
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
          initialPetId={selectedPet?.id}
          pets={recordEditorPets}
          hospitals={hospitals}
          onClose={closeRecordEditor}
          onSave={saveMedicalRecord}
        />
      </div>
    </div>
  );
}
