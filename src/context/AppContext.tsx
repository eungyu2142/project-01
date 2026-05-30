/* eslint-disable react-refresh/only-export-components */
import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  currentUser,
  hospitals as initialHospitals,
  medicalRecords as initialMedicalRecords,
  pets as initialPets,
  reviews as initialReviews,
} from '../data/mockData';
import {
  normalizeHospitalDatasetItem,
  type HospitalDatasetPayload,
} from '../lib/hospitalDataset';
import { findRecordForReview, findReviewForRecord } from '../lib/recordReviewLink';
import { resolveCurrentRegion } from '../lib/currentLocation';
import {
  deleteMedicalRecordsByPetRemote,
  deleteMedicalRecordRemote,
  deletePetRemote,
  deleteReviewRemote,
  deleteReviewsByPetRemote,
  insertReview,
  loadUserAppData,
  loadUserProfile,
  upsertMedicalRecord,
  upsertPet,
  upsertReview,
  updateReview,
  upsertUserProfile,
} from '../lib/supabaseAppStore';
import { isSupabaseConfigured } from '../lib/supabase';
import type {
  Hospital,
  MedicalRecord,
  MedicalRecordDraft,
  MedicalRecordInput,
  Pet,
  PetInput,
  Review,
  ReviewDraft,
  ReviewInput,
  UserProfile,
  UserLocationInput,
  UserProfileInput,
} from '../types';

interface AppContextValue {
  appReady: boolean;
  user: UserProfile;
  hospitals: Hospital[];
  pets: Pet[];
  medicalRecords: MedicalRecord[];
  reviews: Review[];
  reviewDrafts: ReviewDraft[];
  medicalRecordDrafts: MedicalRecordDraft[];
  datasetStatus: 'loading' | 'ready' | 'error';
  datasetError: string;
  markOnboardingComplete: () => void;
  saveUserProfile: (input: UserProfileInput) => void;
  saveUserLocation: (input: UserLocationInput) => void;
  clearAllLocalData: (userId?: string) => void;
  toggleHospitalLike: (hospitalId: string) => void;
  toggleReviewLike: (reviewId: string) => void;
  upsertHospitals: (nextHospitals: Hospital[]) => void;
  saveReview: (input: ReviewInput) => void;
  deleteReview: (reviewId: string) => void;
  saveReviewDraft: (input: ReviewDraft) => string | null;
  deleteReviewDraft: (draftId: string) => void;
  savePet: (input: PetInput) => void;
  deletePet: (petId: string) => void;
  saveMedicalRecord: (input: MedicalRecordInput) => void;
  deleteMedicalRecord: (recordId: string) => void;
  saveMedicalRecordDraft: (input: MedicalRecordDraft | Omit<MedicalRecordDraft, 'id' | 'updatedAt'> & { id?: string }) => string | null;
  deleteMedicalRecordDraft: (draftId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEYS = {
  user: 'exopet-user',
  hospitals: 'exopet-hospitals',
  pets: 'exopet-pets',
  medicalRecords: 'exopet-medical-records',
  reviews: 'exopet-reviews',
  reviewDrafts: 'exopet-review-drafts',
  medicalRecordDrafts: 'exopet-medical-record-drafts',
} as const;
const ONBOARDING_COMPLETION_KEY = 'exopet-onboarding-completed-users';
const USER_SCOPED_STORAGE_KEY_NAMES = [
  'user',
  'hospitals',
  'pets',
  'medicalRecords',
  'reviews',
  'reviewDrafts',
  'medicalRecordDrafts',
] as const;
const APP_REVALIDATION_IDLE_MS = 60_000;
const LOCATION_SYNC_MIN_DISTANCE_METERS = 30;

const LEGACY_PET_IDS = new Set(initialPets.map((pet) => pet.id));
const LEGACY_MEDICAL_RECORD_IDS = new Set(initialMedicalRecords.map((record) => record.id));
const LEGACY_REVIEW_IDS = new Set(initialReviews.map((review) => review.id));

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function loadStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistError(scope: string, error: unknown) {
  console.error(`[AppContext:${scope}]`, error);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  const earthRadiusMeters = 6_371_000;
  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function getScopedStorageKey(key: keyof typeof STORAGE_KEYS, userId: string) {
  return `${STORAGE_KEYS[key]}:${userId}`;
}

function removeLegacySharedStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  USER_SCOPED_STORAGE_KEY_NAMES.forEach((key) => {
    window.localStorage.removeItem(STORAGE_KEYS[key]);
  });
}

function loadOnboardingCompletionMap() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>;
  }

  try {
    const rawValue = window.localStorage.getItem(ONBOARDING_COMPLETION_KEY);
    return rawValue ? (JSON.parse(rawValue) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function getLocalOnboardingCompletedAt(userId: string) {
  if (!userId) {
    return null;
  }

  const completedAt = loadOnboardingCompletionMap()[userId];
  return typeof completedAt === 'string' && completedAt ? completedAt : null;
}

function setLocalOnboardingCompletedAt(userId: string, completedAt: string) {
  if (typeof window === 'undefined' || !userId || !completedAt) {
    return;
  }

  const nextMap = {
    ...loadOnboardingCompletionMap(),
    [userId]: completedAt,
  };

  window.localStorage.setItem(ONBOARDING_COMPLETION_KEY, JSON.stringify(nextMap));
}

function clearLocalOnboardingCompletedAt(userId?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!userId) {
    window.localStorage.removeItem(ONBOARDING_COMPLETION_KEY);
    return;
  }

  const nextMap = { ...loadOnboardingCompletionMap() };
  delete nextMap[userId];
  window.localStorage.setItem(ONBOARDING_COMPLETION_KEY, JSON.stringify(nextMap));
}

function loadCachedUserProfile(userId: string) {
  return loadStoredValue<UserProfile>(getScopedStorageKey('user', userId), currentUser);
}

function loadCachedHospitals(userId: string) {
  return loadStoredValue<Hospital[]>(getScopedStorageKey('hospitals', userId), initialHospitals);
}

function loadCachedPets(userId: string) {
  return loadStoredValue<Pet[]>(getScopedStorageKey('pets', userId), []).filter(
    (pet) => !LEGACY_PET_IDS.has(pet.id),
  );
}

function loadCachedMedicalRecords(userId: string) {
  return loadStoredValue<MedicalRecord[]>(getScopedStorageKey('medicalRecords', userId), []).filter(
    (record) => !LEGACY_MEDICAL_RECORD_IDS.has(record.id),
  );
}

function loadCachedReviews(userId: string) {
  return loadStoredValue<Review[]>(getScopedStorageKey('reviews', userId), []).filter(
    (review) => !LEGACY_REVIEW_IDS.has(review.id),
  );
}

function loadCachedReviewDrafts(userId: string) {
  return loadStoredValue<ReviewDraft[]>(getScopedStorageKey('reviewDrafts', userId), []);
}

function loadCachedMedicalRecordDrafts(userId: string) {
  return loadStoredValue<MedicalRecordDraft[]>(getScopedStorageKey('medicalRecordDrafts', userId), []);
}

function mapReviewsForViewer(reviews: Review[], viewerUserId: string) {
  return reviews.map((review) => ({
    ...review,
    isMine: review.userId === viewerUserId,
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const appUserId = authUser?.id ?? currentUser.id;
  const [user, setUser] = useState(() => loadCachedUserProfile(appUserId));
  const [hospitals, setHospitals] = useState(() => loadCachedHospitals(appUserId));
  const [pets, setPets] = useState(() => loadCachedPets(appUserId));
  const [medicalRecords, setMedicalRecords] = useState(() => loadCachedMedicalRecords(appUserId));
  const [reviews, setReviews] = useState(() => mapReviewsForViewer(loadCachedReviews(appUserId), appUserId));
  const [reviewDrafts, setReviewDrafts] = useState(() => loadCachedReviewDrafts(appUserId));
  const [medicalRecordDrafts, setMedicalRecordDrafts] = useState(() =>
    loadCachedMedicalRecordDrafts(appUserId),
  );
  const [datasetStatus, setDatasetStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [datasetError, setDatasetError] = useState('');
  const [appReady, setAppReady] = useState(() => !isSupabaseConfigured || !authUser);
  const [rehydrationTick, setRehydrationTick] = useState(0);
  const hiddenAtRef = useRef<number | null>(null);
  const lastHydratedUserIdRef = useRef<string | null>(null);
  const latestLocationRequestIdRef = useRef(0);

  useEffect(() => {
    removeLegacySharedStorage();
    setUser(loadCachedUserProfile(appUserId));
    setHospitals(loadCachedHospitals(appUserId));
    setPets(loadCachedPets(appUserId));
    setMedicalRecords(loadCachedMedicalRecords(appUserId));
    setReviews(mapReviewsForViewer(loadCachedReviews(appUserId), appUserId));
    setReviewDrafts(loadCachedReviewDrafts(appUserId));
    setMedicalRecordDrafts(loadCachedMedicalRecordDrafts(appUserId));
  }, [appUserId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState !== 'visible' || !authUser) {
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (!hiddenAt || Date.now() - hiddenAt < APP_REVALIDATION_IDLE_MS) {
        return;
      }

      setRehydrationTick((current) => current + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authUser?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured || !authUser) {
      lastHydratedUserIdRef.current = null;
      setAppReady(true);
      return;
    }

    const shouldBlockForHydration = lastHydratedUserIdRef.current !== authUser.id;

    if (shouldBlockForHydration) {
      setAppReady(false);
    }

    async function hydrateRemoteData() {
      if (!isSupabaseConfigured || !authUser) {
        return;
      }

      try {
        const data = await loadUserAppData(authUser.id);
        const remoteUser = await loadUserProfile(authUser.id);
        const localOnboardingCompletedAt = getLocalOnboardingCompletedAt(authUser.id);
        const cachedPets = loadCachedPets(authUser.id);
        const cachedMedicalRecords = loadCachedMedicalRecords(authUser.id);
        const cachedReviews = loadCachedReviews(authUser.id);

        if (cancelled) {
          return;
        }

        if (remoteUser) {
          const mergedUser: UserProfile = {
            ...remoteUser,
            onboardingCompletedAt: remoteUser.onboardingCompletedAt ?? localOnboardingCompletedAt,
          };

          setUser(mergedUser);
          if (!remoteUser.onboardingCompletedAt && mergedUser.onboardingCompletedAt) {
            void upsertUserProfile(mergedUser).catch((error) =>
              persistError('hydrateRemoteData:syncOnboarding', error),
            );
          }
        } else {
          const nextUser: UserProfile = {
            ...currentUser,
            id: authUser.id,
            loginId:
              typeof authUser.user_metadata.login_id === 'string'
                ? authUser.user_metadata.login_id
                : authUser.email?.split('@')[0] ?? currentUser.loginId,
            nickname:
              typeof authUser.user_metadata.nickname === 'string'
                ? authUser.user_metadata.nickname
                : authUser.email?.split('@')[0] ?? '엑조펫 유저',
            email: authUser.email ?? currentUser.email,
            onboardingCompletedAt: localOnboardingCompletedAt,
          };

          setUser(nextUser);
          void upsertUserProfile(nextUser).catch((error) =>
            persistError('hydrateRemoteData:createProfile', error),
          );
        }

        if (data) {
          setPets(data.pets);
          setMedicalRecords(data.medicalRecords);
          setReviews(mapReviewsForViewer(data.reviews, authUser.id));
        } else {
          setPets(cachedPets);
          setMedicalRecords(cachedMedicalRecords);
          setReviews(mapReviewsForViewer(cachedReviews, authUser.id));
        }

        lastHydratedUserIdRef.current = authUser.id;
      } catch (error) {
        persistError('hydrateRemoteData', error);
      } finally {
        if (!cancelled) {
          setAppReady(true);
        }
      }
    }

    void hydrateRemoteData();

    return () => {
      cancelled = true;
    };
  }, [appUserId, authUser?.id, rehydrationTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadHospitalDataset() {
      setDatasetStatus('loading');
      setDatasetError('');

      try {
        const datasetUrl =
          typeof window === 'undefined'
            ? `${import.meta.env.BASE_URL}data/exotic-hospitals.json`
            : new URL(`${import.meta.env.BASE_URL}data/exotic-hospitals.json`, window.location.origin).toString();

        const response = await fetch(datasetUrl, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as Partial<HospitalDatasetPayload> & {
          message?: string;
        };

        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error(payload.message ?? '병원 데이터셋을 불러오지 못했습니다.');
        }

        const datasetHospitals = payload.items.map((hospital) =>
          normalizeHospitalDatasetItem(hospital),
        );

        if (cancelled) {
          return;
        }

        setHospitals((current) => {
          const existingById = new Map(current.map((hospital) => [hospital.id, hospital]));
          const mockHospitals = current.filter((hospital) => hospital.source === 'mock');
          const nextDatasetHospitals = datasetHospitals.map((hospital) => {
            const existing = existingById.get(hospital.id);

            return {
              ...hospital,
              liked: existing?.liked ?? hospital.liked,
              likedAt: existing?.likedAt ?? hospital.likedAt,
            };
          });

          return [...mockHospitals, ...nextDatasetHospitals];
        });

        setDatasetStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDatasetStatus('error');
        setDatasetError(
          error instanceof Error ? error.message : '병원 데이터셋을 불러오는 중 오류가 발생했습니다.',
        );
      }
    }

    void loadHospitalDataset();

    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('user', appUserId), JSON.stringify(user));
  }, [appUserId, user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('hospitals', appUserId), JSON.stringify(hospitals));
  }, [appUserId, hospitals]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('pets', appUserId), JSON.stringify(pets));
  }, [appUserId, pets]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('medicalRecords', appUserId), JSON.stringify(medicalRecords));
  }, [appUserId, medicalRecords]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('reviews', appUserId), JSON.stringify(reviews));
  }, [appUserId, reviews]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getScopedStorageKey('reviewDrafts', appUserId), JSON.stringify(reviewDrafts));
  }, [appUserId, reviewDrafts]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey('medicalRecordDrafts', appUserId),
      JSON.stringify(medicalRecordDrafts),
    );
  }, [appUserId, medicalRecordDrafts]);

  function saveUserLocation(input: UserLocationInput) {
    setUser((current) => {
      const nextCity = input.city?.trim() ? input.city.trim() : current.city;
      const distanceMeters = getDistanceMeters(current.location, input.location);
      const cityChanged = nextCity !== current.city;

      if (!cityChanged && distanceMeters < LOCATION_SYNC_MIN_DISTANCE_METERS) {
        return current;
      }

      const nextUser: UserProfile = {
        ...current,
        city: nextCity,
        location: input.location,
      };

      void upsertUserProfile(nextUser).catch((error) => persistError('saveUserLocation', error));
      return nextUser;
    });
  }

  function saveUserProfile(input: UserProfileInput) {
    const nextUser: UserProfile = {
      ...user,
      loginId: input.loginId,
      nickname: input.nickname,
      email: input.email,
      profileEmoji: input.profileEmoji,
    };

    setUser(nextUser);
    void upsertUserProfile(nextUser).catch((error) => persistError('saveUserProfile', error));
  }

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !authUser) {
      return;
    }

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const requestId = latestLocationRequestIdRef.current + 1;

        latestLocationRequestIdRef.current = requestId;
        saveUserLocation({ location: nextLocation });

        void resolveCurrentRegion(nextLocation.lat, nextLocation.lng)
          .then((nextCity) => {
            if (cancelled || requestId !== latestLocationRequestIdRef.current) {
              return;
            }

            saveUserLocation({
              location: nextLocation,
              city: nextCity,
            });
          })
          .catch(() => {});
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [authUser?.id]);

  function markOnboardingComplete() {
    setUser((current) => {
      if (current.onboardingCompletedAt) {
        return current;
      }

      const completedAt = new Date().toISOString();
      const nextUser: UserProfile = {
        ...current,
        onboardingCompletedAt: completedAt,
      };

      setLocalOnboardingCompletedAt(current.id, completedAt);
      void upsertUserProfile(nextUser).catch((error) => persistError('markOnboardingComplete', error));
      return nextUser;
    });
  }

  function clearAllLocalData(userId?: string) {
    const targetUserId = userId ?? appUserId;

    if (typeof window !== 'undefined') {
      USER_SCOPED_STORAGE_KEY_NAMES.forEach((key) =>
        window.localStorage.removeItem(getScopedStorageKey(key, targetUserId)),
      );
    }

    clearLocalOnboardingCompletedAt(targetUserId);
    setUser(currentUser);
    setHospitals(initialHospitals);
    setPets([]);
    setMedicalRecords([]);
    setReviews([]);
    setReviewDrafts([]);
    setMedicalRecordDrafts([]);
  }

  function toggleHospitalLike(hospitalId: string) {
    setHospitals((current) =>
      current.map((hospital) =>
        hospital.id === hospitalId
          ? {
              ...hospital,
              liked: !hospital.liked,
              likedAt: hospital.liked ? null : new Date().toISOString(),
            }
          : hospital,
      ),
    );
  }

  function toggleReviewLike(reviewId: string) {
    setReviews((current) =>
      current.map((review) => {
        if (review.id !== reviewId) {
          return review;
        }

        const nextLiked = !review.liked;
        const nextReview = {
          ...review,
          liked: nextLiked,
          likes: review.likes + (nextLiked ? 1 : -1),
          likedAt: nextLiked ? new Date().toISOString() : null,
        };

        void upsertReview(appUserId, nextReview).catch((error) =>
          persistError('toggleReviewLike', error),
        );

        return nextReview;
      }),
    );
  }

  const upsertHospitals = useCallback((nextHospitals: Hospital[]) => {
    if (nextHospitals.length === 0) {
      return;
    }

    setHospitals((current) => {
      const merged = new Map(current.map((hospital) => [hospital.id, hospital]));

      nextHospitals.forEach((hospital) => {
        const existing = merged.get(hospital.id);

        merged.set(hospital.id, {
          ...hospital,
          liked: existing?.liked ?? hospital.liked,
          likedAt: existing?.likedAt ?? hospital.likedAt,
        });
      });

      return Array.from(merged.values());
    });
  }, []);

  function saveReview(input: ReviewInput) {
    const previousReview = input.id ? reviews.find((review) => review.id === input.id) : null;
    const nextReview: Review = {
      id: input.id ?? makeId('review'),
      userId: appUserId,
      hospitalId: input.hospitalId,
      petId: input.petId,
      animalType: input.animalType,
      species: input.species,
      petName: input.petName,
      diagnosis: input.diagnosis,
      cost: input.cost,
      date: input.date,
      medicine: input.medicine,
      tags: input.tags,
      customTags: input.customTags,
      body: input.body,
      imageUrls: input.imageUrls,
      rating: input.rating,
      likes: previousReview?.likes ?? 0,
      liked: previousReview?.liked ?? false,
      likedAt: previousReview?.likedAt ?? null,
      authorName: user.nickname,
      isMine: true,
      createdAt: previousReview?.createdAt ?? new Date().toISOString(),
    };

    startTransition(() => {
      setReviews((current) => {
        if (input.id) {
          return current.map((review) => (review.id === input.id ? nextReview : review));
        }

        return [nextReview, ...current];
      });

      void (input.id ? updateReview(appUserId, nextReview) : insertReview(appUserId, nextReview)).catch(
        (error) => persistError('saveReview', error),
      );

      if (input.saveToRecord) {
        const pet = pets.find((item) => item.id === input.petId);
        const existingRecord = findRecordForReview(medicalRecords, nextReview);

        if (!pet || existingRecord) {
          return;
        }

        const nextRecord: MedicalRecord = {
          id: makeId('record'),
          petId: input.petId,
          hospitalId: input.hospitalId,
          date: input.date,
          diagnosis: input.diagnosis || `${pet.name} 진료 기록`,
          veterinarianNote: input.saveToRecordVeterinarianNote?.trim() || '리뷰에서 저장한 진료 기록',
          prescription: input.medicine,
          cost: input.cost,
          memo: input.saveToRecordMemo?.trim() ?? '',
        };

        setMedicalRecords((current) =>
          findRecordForReview(current, nextReview) ? current : [nextRecord, ...current],
        );
        void upsertMedicalRecord(appUserId, nextRecord).catch((error) =>
          persistError('saveReview:saveToRecord', error),
        );
      }
    });
  }

  function deleteReview(reviewId: string) {
    setReviews((current) => current.filter((review) => review.id !== reviewId));
    void deleteReviewRemote(reviewId).catch((error) => persistError('deleteReview', error));
  }

  function saveReviewDraft(input: ReviewDraft) {
    const hasDraftContent = Boolean(
      input.hospitalId ||
        input.petId ||
        input.date ||
        input.diagnosis?.trim() ||
        input.medicine?.trim() ||
        input.body?.trim() ||
        (typeof input.cost === 'number' && Number.isFinite(input.cost)) ||
        (input.tags && input.tags.length > 0) ||
        (input.customTags && input.customTags.length > 0) ||
        (input.imageUrls && input.imageUrls.length > 0),
    );

    if (!hasDraftContent) {
      return null;
    }

    const nextDraft: ReviewDraft = {
      ...input,
      id: input.id ?? makeId('review-draft'),
      updatedAt: new Date().toISOString(),
    };

    setReviewDrafts((current) => {
      const filtered = current.filter((draft) => draft.id !== nextDraft.id);
      return [nextDraft, ...filtered].sort(
        (left, right) =>
          new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime(),
      );
    });

    return nextDraft.id ?? null;
  }

  function deleteReviewDraft(draftId: string) {
    setReviewDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }

  function savePet(input: PetInput) {
    const nextPet: Pet = {
      id: input.id ?? makeId('pet'),
      name: input.name,
      species: input.species,
      animalType: input.animalType,
      gender: input.gender,
      ageLabel: input.ageLabel,
      avatar: input.avatar,
    };

    setPets((current) => {
      if (input.id) {
        return current.map((pet) => (pet.id === input.id ? nextPet : pet));
      }

      return [...current, nextPet];
    });

    void upsertPet(appUserId, nextPet).catch((error) => persistError('savePet', error));
  }

  function deletePet(petId: string) {
    setPets((current) => current.filter((pet) => pet.id !== petId));
    setMedicalRecords((current) => current.filter((record) => record.petId !== petId));
    setReviews((current) => current.filter((review) => review.petId !== petId));

    void Promise.all([
      deleteMedicalRecordsByPetRemote(appUserId, petId),
      deleteReviewsByPetRemote(appUserId, petId),
    ])
      .then(() => deletePetRemote(petId))
      .catch((error) => persistError('deletePet', error));
  }

  function saveMedicalRecord(input: MedicalRecordInput) {
    const pet = pets.find((item) => item.id === input.petId);
    const normalizedDiagnosis = input.diagnosis.trim() || `${pet?.name ?? '진료'} 진료 기록`;
    const nextRecord: MedicalRecord = {
      id: input.id ?? makeId('record'),
      petId: input.petId,
      hospitalId: input.hospitalId,
      date: input.date,
      diagnosis: normalizedDiagnosis,
      veterinarianNote: input.veterinarianNote,
      prescription: input.prescription,
      cost: input.cost,
      memo: input.memo,
    };

    setMedicalRecords((current) => {
      if (input.id) {
        return current.map((record) => (record.id === input.id ? nextRecord : record));
      }

      return [nextRecord, ...current];
    });

    void upsertMedicalRecord(appUserId, nextRecord).catch((error) =>
      persistError('saveMedicalRecord', error),
    );

    if (input.saveToReview && pet && !input.id && !findReviewForRecord(reviews, nextRecord)) {
      const nextReview: Review = {
        id: makeId('review'),
        userId: appUserId,
        hospitalId: input.hospitalId,
        petId: input.petId,
        animalType: pet.animalType,
        species: pet.species,
        petName: pet.name,
        diagnosis: normalizedDiagnosis,
        cost: input.cost,
        date: input.date,
        medicine: input.prescription,
        tags: input.saveToReviewTags ?? [],
        customTags: [],
        body: input.saveToReviewBody?.trim() || input.memo,
        imageUrls: [],
        rating: input.saveToReviewRating ?? 5,
        likes: 0,
        liked: false,
        likedAt: null,
        authorName: user.nickname,
        isMine: true,
        createdAt: new Date().toISOString(),
      };

      setReviews((current) =>
        findReviewForRecord(current, nextRecord) ? current : [nextReview, ...current],
      );
      void insertReview(appUserId, nextReview).catch((error) =>
        persistError('saveMedicalRecord:saveToReview', error),
      );
    }
  }

  function deleteMedicalRecord(recordId: string) {
    setMedicalRecords((current) => current.filter((record) => record.id !== recordId));
    void deleteMedicalRecordRemote(recordId).catch((error) =>
      persistError('deleteMedicalRecord', error),
    );
  }

  function saveMedicalRecordDraft(
    input: MedicalRecordDraft | (Omit<MedicalRecordDraft, 'id' | 'updatedAt'> & { id?: string }),
  ) {
    const hasDraftContent = Boolean(
      input.petId ||
        input.hospitalId ||
        input.date ||
        input.diagnosis?.trim() ||
        input.veterinarianNote?.trim() ||
        input.prescription?.trim() ||
        input.memo?.trim() ||
        (typeof input.cost === 'number' && Number.isFinite(input.cost)),
    );

    if (!hasDraftContent) {
      return null;
    }

    const nextDraft: MedicalRecordDraft = {
      ...input,
      id: input.id ?? makeId('record-draft'),
      updatedAt: new Date().toISOString(),
    };

    setMedicalRecordDrafts((current) => {
      const filtered = current.filter((draft) => draft.id !== nextDraft.id);
      return [nextDraft, ...filtered].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
    });

    return nextDraft.id;
  }

  function deleteMedicalRecordDraft(draftId: string) {
    setMedicalRecordDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }

  return (
    <AppContext.Provider
      value={{
        appReady,
        user,
        markOnboardingComplete,
        saveUserProfile,
        saveUserLocation,
        clearAllLocalData,
        hospitals,
        pets,
        medicalRecords,
        reviews,
        reviewDrafts,
        medicalRecordDrafts,
        datasetStatus,
        datasetError,
        toggleHospitalLike,
        toggleReviewLike,
        upsertHospitals,
        saveReview,
        deleteReview,
        saveReviewDraft,
        deleteReviewDraft,
        savePet,
        deletePet,
        saveMedicalRecord,
        deleteMedicalRecord,
        saveMedicalRecordDraft,
        deleteMedicalRecordDraft,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }

  return context;
}
