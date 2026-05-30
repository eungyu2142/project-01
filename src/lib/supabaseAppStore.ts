import type { MedicalRecord, Pet, Review, UserProfile } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

interface PetRow {
  id: string;
  user_id: string;
  name: string;
  species: string;
  animal_type: Pet['animalType'];
  gender: Pet['gender'];
  age_label: string;
  avatar: string;
}

interface UserProfileRow {
  id: string;
  login_id?: string | null;
  nickname: string;
  email: string;
  profile_emoji: string;
  onboarding_completed_at?: string | null;
  city: string;
  lat: number;
  lng: number;
}

interface MedicalRecordRow {
  id: string;
  user_id: string;
  pet_id: string;
  hospital_id: string;
  date: string;
  diagnosis: string;
  veterinarian_note: string;
  prescription: string;
  cost: number | null;
  memo: string;
  image_urls: string[];
}

interface ReviewRow {
  id: string;
  user_id: string;
  hospital_id: string;
  pet_id: string | null;
  animal_type: Review['animalType'];
  species: string;
  pet_name: string;
  diagnosis: string;
  cost: number | null;
  date: string;
  medicine: string;
  tags: string[];
  custom_tags: string[];
  body: string;
  image_urls: string[];
  rating: number;
  likes: number;
  liked: boolean;
  liked_at: string | null;
  author_name: string;
  is_mine: boolean;
  created_at: string;
}

const LEGACY_REVIEW_OPTIONAL_COLUMNS = [
  'is_mine',
  'author_name',
  'liked_at',
  'image_urls',
  'custom_tags',
  'pet_name',
] as const;

function toPetRow(userId: string, pet: Pet): PetRow {
  return {
    id: pet.id,
    user_id: userId,
    name: pet.name,
    species: pet.species,
    animal_type: pet.animalType,
    gender: pet.gender,
    age_label: pet.ageLabel,
    avatar: pet.avatar,
  };
}

function toUserProfileRow(user: UserProfile): UserProfileRow {
  return {
    id: user.id,
    login_id: user.loginId,
    nickname: user.nickname,
    email: user.email,
    profile_emoji: user.profileEmoji,
    onboarding_completed_at: user.onboardingCompletedAt,
    city: user.city,
    lat: user.location.lat,
    lng: user.location.lng,
  };
}

function fromUserProfileRow(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    loginId: row.login_id ?? row.email.split('@')[0] ?? 'dimi_go',
    nickname: row.nickname,
    email: row.email,
    profileEmoji: row.profile_emoji,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    city: row.city,
    location: {
      lat: row.lat,
      lng: row.lng,
    },
  };
}

function fromPetRow(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    animalType: row.animal_type,
    gender: row.gender,
    ageLabel: row.age_label,
    avatar: row.avatar,
  };
}

function toMedicalRecordRow(userId: string, record: MedicalRecord): MedicalRecordRow {
  return {
    id: record.id,
    user_id: userId,
    pet_id: record.petId,
    hospital_id: record.hospitalId,
    date: record.date,
    diagnosis: record.diagnosis,
    veterinarian_note: record.veterinarianNote,
    prescription: record.prescription,
    cost: record.cost,
    memo: record.memo,
    image_urls: record.imageUrls,
  };
}

function fromMedicalRecordRow(row: MedicalRecordRow): MedicalRecord {
  return {
    id: row.id,
    petId: row.pet_id,
    hospitalId: row.hospital_id,
    date: row.date,
    diagnosis: row.diagnosis,
    veterinarianNote: row.veterinarian_note,
    prescription: row.prescription,
    cost: row.cost,
    memo: row.memo,
    imageUrls: row.image_urls ?? [],
  };
}

function toReviewRow(userId: string, review: Review): ReviewRow {
  return {
    id: review.id,
    user_id: userId,
    hospital_id: review.hospitalId,
    pet_id: review.petId,
    animal_type: review.animalType,
    species: review.species,
    pet_name: review.petName,
    diagnosis: review.diagnosis,
    cost: review.cost,
    date: review.date,
    medicine: review.medicine,
    tags: review.tags,
    custom_tags: review.customTags,
    body: review.body,
    image_urls: review.imageUrls,
    rating: review.rating,
    likes: review.likes,
    liked: review.liked,
    liked_at: review.likedAt,
    author_name: review.authorName,
    is_mine: review.isMine,
    created_at: review.createdAt,
  };
}

function fromReviewRow(row: ReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    hospitalId: row.hospital_id,
    petId: row.pet_id,
    animalType: row.animal_type,
    species: row.species,
    petName: row.pet_name,
    diagnosis: row.diagnosis,
    cost: row.cost,
    date: row.date,
    medicine: row.medicine,
    tags: row.tags ?? [],
    customTags: row.custom_tags ?? [],
    body: row.body,
    imageUrls: row.image_urls ?? [],
    rating: row.rating,
    likes: row.likes,
    liked: row.liked,
    likedAt: row.liked_at,
    authorName: row.author_name,
    isMine: row.is_mine,
    createdAt: row.created_at,
  };
}

function getMissingReviewColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? '';
  const directMatch = message.match(/column ["']?([a-z_]+)["']? .* does not exist/i);

  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const loweredMessage = message.toLowerCase();
  return LEGACY_REVIEW_OPTIONAL_COLUMNS.find((column) => loweredMessage.includes(column)) ?? null;
}

async function executeReviewWrite(
  mode: 'insert' | 'update' | 'upsert',
  row: ReviewRow,
  userId: string,
) {
  if (!supabase) {
    return;
  }

  let payload: Partial<ReviewRow> = { ...row };

  while (true) {
    const query =
      mode === 'insert'
        ? supabase.from('reviews').insert(payload)
        : mode === 'update'
          ? supabase.from('reviews').update(payload).eq('id', row.id).eq('user_id', userId)
          : supabase.from('reviews').upsert(payload);

    const { error } = await query;

    if (!error) {
      return;
    }

    const missingColumn = getMissingReviewColumn(error) as keyof ReviewRow | null;

    if (!missingColumn || !(missingColumn in payload)) {
      throw error;
    }

    const { [missingColumn]: _unused, ...nextPayload } = payload;
    payload = nextPayload;
  }
}

export async function loadUserAppData(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const [
    { data: pets, error: petsError },
    { data: medicalRecords, error: medicalRecordsError },
    { data: reviews, error: reviewsError },
  ] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', userId).order('name'),
    supabase.from('medical_records').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('reviews').select('*').order('created_at', { ascending: false }),
  ]);

  if (petsError) throw petsError;
  if (medicalRecordsError) throw medicalRecordsError;
  if (reviewsError) throw reviewsError;

  const nextPets = (pets as PetRow[] | null)?.map(fromPetRow) ?? [];
  const validPetIds = new Set(nextPets.map((pet) => pet.id));
  const medicalRecordRows = (medicalRecords as MedicalRecordRow[] | null) ?? [];
  const orphanMedicalRecordIds = medicalRecordRows
    .filter((record) => !validPetIds.has(record.pet_id))
    .map((record) => record.id);

  if (orphanMedicalRecordIds.length > 0) {
    const { error } = await supabase
      .from('medical_records')
      .delete()
      .eq('user_id', userId)
      .in('id', orphanMedicalRecordIds);

    if (error) throw error;
  }

  return {
    pets: nextPets,
    medicalRecords:
      medicalRecordRows
        .filter((record) => validPetIds.has(record.pet_id))
        .map(fromMedicalRecordRow)
        .filter((record) => validPetIds.has(record.petId)) ?? [],
    reviews: (reviews as ReviewRow[] | null)?.map(fromReviewRow) ?? [],
  };
}

export async function loadUserProfile(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? fromUserProfileRow(data as UserProfileRow) : null;
}

export async function checkLoginIdAvailability(loginId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return true;
  }

  const normalizedLoginId = loginId.trim();
  if (!normalizedLoginId) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_login_id_available', {
    candidate_login_id: normalizedLoginId,
  });

  if (error) throw error;
  return Boolean(data);
}

export async function findEmailByLoginId(loginId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const normalizedLoginId = loginId.trim();
  if (!normalizedLoginId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_email_by_login_id', {
    candidate_login_id: normalizedLoginId,
  });

  if (error) throw error;
  return typeof data === 'string' && data ? data : null;
}

export async function upsertUserProfile(user: UserProfile) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const row = toUserProfileRow(user);
  const { error } = await supabase.from('user_profiles').upsert(row);

  if (!error) {
    return;
  }

  if (error.message.toLowerCase().includes('onboarding_completed_at')) {
    const { onboarding_completed_at: _unused, ...legacyRow } = row;
    const { error: legacyError } = await supabase.from('user_profiles').upsert(legacyRow);

    if (!legacyError) {
      return;
    }

    throw legacyError;
  }

  throw error;
}

export async function deleteAccountRemote() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const functionResult = await supabase.functions.invoke('delete-account', {
    body: {},
  });

  if (!functionResult.error) {
    const { data } = functionResult;

    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      throw new Error(data.error);
    }

    return;
  }

  const rpcResult = await supabase.rpc('delete_my_account');

  if (!rpcResult.error) {
    return;
  }

  throw new Error(
    [
      '계정을 삭제하지 못했어요.',
      'Supabase Edge Function `delete-account` 배포 상태와 SQL 함수 `delete_my_account()` 적용 여부를 확인해 주세요.',
      `Function error: ${functionResult.error.message}`,
      `RPC error: ${rpcResult.error.message}`,
    ].join(' '),
  );
}

export async function upsertPet(userId: string, pet: Pet) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('pets').upsert(toPetRow(userId, pet));
  if (error) throw error;
}

export async function deletePetRemote(petId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('pets').delete().eq('id', petId);
  if (error) throw error;
}

export async function deleteMedicalRecordsByPetRemote(userId: string, petId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('medical_records').delete().eq('user_id', userId).eq('pet_id', petId);
  if (error) throw error;
}

export async function upsertMedicalRecord(userId: string, record: MedicalRecord) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('medical_records').upsert(toMedicalRecordRow(userId, record));
  if (error) throw error;
}

export async function deleteMedicalRecordRemote(recordId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('medical_records').delete().eq('id', recordId);
  if (error) throw error;
}

export async function upsertReview(userId: string, review: Review) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await executeReviewWrite('upsert', toReviewRow(userId, review), userId);
}

export async function insertReview(userId: string, review: Review) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await executeReviewWrite('insert', toReviewRow(userId, review), userId);
}

export async function updateReview(userId: string, review: Review) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  await executeReviewWrite('update', toReviewRow(userId, review), userId);
}

export async function deleteReviewRemote(reviewId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) throw error;
}

export async function deleteReviewsByPetRemote(userId: string, petId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('reviews').delete().eq('user_id', userId).eq('pet_id', petId);
  if (error) throw error;
}


