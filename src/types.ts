export type AnimalType = 'reptile' | 'rodent' | 'bird';
export type AnimalFilter = 'all' | AnimalType;
export type HospitalSource = 'mock' | 'naver-search' | 'dataset';
export type HospitalClassification = 'candidate' | 'confirmed';
export type HospitalProviderSource = 'naver' | 'public' | 'manual';

export interface HospitalSourceInfo {
  provider: HospitalProviderSource;
  label: string;
}
export type PetGender = '수컷' | '암컷' | '미상' | '미구분';

export interface UserProfile {
  id: string;
  loginId: string;
  nickname: string;
  email: string;
  profileEmoji: string;
  onboardingCompletedAt: string | null;
  city: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface UserProfileInput {
  loginId: string;
  nickname: string;
  email: string;
  profileEmoji: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  breakTime: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  recentSpecies: string[];
  note: string;
  liked: boolean;
  likedAt: string | null;
  supportedAnimals?: AnimalType[];
  source?: HospitalSource;
  classification?: HospitalClassification;
  matchedQueries?: string[];
  evidence?: string[];
  sources?: HospitalSourceInfo[];
  lastCollectedAt?: string;
  link?: string;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  animalType: AnimalType;
  gender: PetGender;
  ageLabel: string;
  avatar: string;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  hospitalId: string;
  date: string;
  diagnosis: string;
  veterinarianNote: string;
  prescription: string;
  cost: number | null;
  memo: string;
}

export interface Review {
  id: string;
  userId: string;
  hospitalId: string;
  petId: string | null;
  animalType: AnimalType;
  species: string;
  petName: string;
  diagnosis: string;
  cost: number | null;
  date: string;
  medicine: string;
  tags: string[];
  customTags: string[];
  body: string;
  imageUrls: string[];
  rating: number;
  likes: number;
  liked: boolean;
  likedAt: string | null;
  authorName: string;
  isMine: boolean;
  createdAt: string;
}

export interface ReviewInput {
  id?: string;
  hospitalId: string;
  petId: string;
  animalType: AnimalType;
  species: string;
  petName: string;
  diagnosis: string;
  cost: number | null;
  date: string;
  medicine: string;
  tags: string[];
  customTags: string[];
  body: string;
  imageUrls: string[];
  rating: number;
  saveToRecord: boolean;
}

export interface PetInput {
  id?: string;
  name: string;
  species: string;
  animalType: AnimalType;
  gender: PetGender;
  ageLabel: string;
  avatar: string;
}

export interface MedicalRecordInput {
  id?: string;
  petId: string;
  hospitalId: string;
  date: string;
  diagnosis: string;
  veterinarianNote: string;
  prescription: string;
  cost: number | null;
  memo: string;
}

export interface ReviewDraft {
  hospitalId?: string;
  petId?: string;
  animalType?: AnimalType;
  date?: string;
  diagnosis?: string;
  cost?: number | null;
  medicine?: string;
  tags?: string[];
  customTags?: string[];
  body?: string;
  rating?: number;
  imageUrls?: string[];
}
