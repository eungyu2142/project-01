import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { validateUserText } from '../lib/contentModeration';
import { isImageAvatar } from '../lib/petAvatar';
import type { AnimalType, Pet, PetInput } from '../types';
import { ModalSheet } from './ModalSheet';

interface PetEditorProps {
  open: boolean;
  pet?: Pet | null;
  onClose: () => void;
  onSave: (input: PetInput) => void;
}

const avatarOptions = ['🐍', '🐹', '🦜', '🦎', '🐢'];
const ageOptionsByAnimalType = {
  reptile: ['베이비', '빅베이비', '아성체', '준성체', '성체'],
  rodent: ['베이비', '빅베이비', '아성체', '준성체', '성체'],
  bird: ['베이비', '빅베이비', '아성체', '준성체', '성체'],
} as const;

export function PetEditor({ open, pet, onClose, onSave }: PetEditorProps) {
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState(pet?.species ?? '');
  const [animalType, setAnimalType] = useState<AnimalType>(
    pet?.animalType ?? 'reptile',
  );
  const [gender, setGender] = useState<'수컷' | '암컷' | '미상' | '미구분'>(pet?.gender ?? '미상');
  const [ageLabel, setAgeLabel] = useState(pet?.ageLabel ?? '베이비');
  const [avatar, setAvatar] = useState(pet?.avatar ?? '🐍');
  const [moderationMessage, setModerationMessage] = useState('');
  const ageOptions = ageOptionsByAnimalType[animalType];

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function handleAnimalTypeChange(nextAnimalType: AnimalType) {
    setAnimalType(nextAnimalType);
    setAgeLabel(ageOptionsByAnimalType[nextAnimalType][0]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !species.trim()) {
      return;
    }

    const moderation = validateUserText([
      { label: '이름', value: name },
      { label: '종', value: species },
    ]);

    if (!moderation.ok) {
      setModerationMessage(moderation.message);
      return;
    }

    onSave({
      id: pet?.id,
      name: name.trim(),
      species: species.trim(),
      animalType,
      gender,
      ageLabel,
      avatar,
    });
    setModerationMessage('');
    onClose();
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={pet ? '반려동물 수정' : '반려동물 등록'}
      description="반려동물 프로필 정보를 입력해 주세요."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {moderationMessage ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {moderationMessage}
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium">이름</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3"
            placeholder="예: 파닥이"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">종</span>
          <input
            type="text"
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3"
            placeholder="예: 레오파드게코"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">분류</span>
            <select
              value={animalType}
              onChange={(event) => handleAnimalTypeChange(event.target.value as typeof animalType)}
              className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3"
            >
              <option value="reptile">파충류</option>
              <option value="rodent">설치류</option>
              <option value="bird">조류</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">성별</span>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as typeof gender)}
              className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3"
            >
              <option value="수컷">수컷</option>
              <option value="암컷">암컷</option>
              <option value="미상">미상</option>
              <option value="미구분">미구분</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">나이 단계</span>
          <select
            value={ageLabel}
            onChange={(event) => setAgeLabel(event.target.value)}
            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3"
          >
            {ageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">프로필 아이콘</span>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white text-4xl shadow-sm">
                {isImageAvatar(avatar) ? (
                  <img src={avatar} alt="반려동물 사진 미리보기" className="h-full w-full object-cover" />
                ) : (
                  avatar
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700">
                  사진 첨부
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
                {isImageAvatar(avatar) ? (
                  <button
                    type="button"
                    onClick={() => setAvatar('🐍')}
                    className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600"
                  >
                    사진 제거하고 기본 아이콘 사용
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {avatarOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setAvatar(item)}
                className={`rounded-2xl px-4 py-3 text-2xl ${
                  avatar === item ? 'bg-emerald-600 text-white' : 'bg-emerald-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"
        >
          저장하기
        </button>
      </form>
    </ModalSheet>
  );
}
