import type {
  Hospital,
  MedicalRecord,
  Pet,
  Review,
  UserProfile,
} from '../types';

export const animalLabels = {
  all: '전체',
  reptile: '파충류',
  rodent: '설치류',
  bird: '조류',
} as const;

export const reviewTagOptions = [
  '의사 선생님이 친절해요',
  '병원이 위생적이에요',
  '설명이 자세해요',
  '가격이 합리적이에요',
  '아이를 조심스럽게 잘 다뤄주세요',
  '진료 장비가 잘 갖춰져 있어요',
];

export const currentUser: UserProfile = {
  id: 'user-1',
  loginId: 'exoticlover',
  nickname: '엑조펫 유저',
  email: 'exotic@example.com',
  profileEmoji: '🐾',
  onboardingCompletedAt: null,
  city: '안산시 단원구',
  location: {
    lat: 37.3215,
    lng: 126.8309,
  },
};

export const hospitals: Hospital[] = [];

export const pets: Pet[] = [];

export const medicalRecords: MedicalRecord[] = [];

export const reviews: Review[] = [];
