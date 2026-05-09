import type {
  AnimalType,
  Hospital,
  HospitalClassification,
  HospitalSourceInfo,
} from '../types';

export interface HospitalDatasetPayload {
  items: Hospital[];
}

export interface OverflowQuery {
  region: string;
  query: string;
  count: number;
}

export interface HospitalDatasetMeta {
  collectedAt: string;
  totalHospitals: number;
  classificationCounts: Record<HospitalClassification, number>;
  overflowQueries: OverflowQuery[];
  warnings: string[];
}

const emptySources: HospitalSourceInfo[] = [];
const emptyAnimals: AnimalType[] = [];
const emptyStrings: string[] = [];

function applyKnownHospitalOverrides(hospital: Hospital): Hospital {
  const normalizedName = hospital.name.replace(/\s+/g, '');

  if (
    normalizedName.includes('에코동물병원') ||
    normalizedName.includes('에코특수동물병원')
  ) {
    return {
      ...hospital,
      classification: 'confirmed',
      supportedAnimals: ['reptile'],
      evidence: Array.from(
        new Set([...(hospital.evidence ?? []), '사용자 확인으로 파충류 전문 병원 보정']),
      ),
      sources: Array.from(
        new Map(
          [
            ...(hospital.sources ?? []),
            { provider: 'manual' as const, label: '런타임 수동 보정' },
          ].map((source) => [`${source.provider}:${source.label}`, source] as const),
        ).values(),
      ),
    };
  }

  return hospital;
}

export function normalizeHospitalDatasetItem(item: Partial<Hospital>): Hospital {
  const normalizedHospital: Hospital = {
    id: item.id ?? '',
    name: item.name ?? '알 수 없는 병원',
    address: item.address ?? '',
    phone: item.phone ?? '전화번호 정보 없음',
    hours: item.hours ?? '운영시간 문의',
    breakTime: item.breakTime ?? '정보 없음',
    lat: item.lat ?? 0,
    lng: item.lng ?? 0,
    mapX: item.mapX ?? 0,
    mapY: item.mapY ?? 0,
    recentSpecies: item.recentSpecies ?? emptyStrings,
    note: item.note ?? '',
    liked: item.liked ?? false,
    likedAt: item.likedAt ?? null,
    supportedAnimals: item.supportedAnimals ?? emptyAnimals,
    source: 'dataset',
    classification: item.classification ?? 'candidate',
    matchedQueries: item.matchedQueries ?? emptyStrings,
    evidence: item.evidence ?? emptyStrings,
    sources: item.sources ?? emptySources,
    lastCollectedAt: item.lastCollectedAt ?? '',
    link: item.link,
  };

  return applyKnownHospitalOverrides(normalizedHospital);
}

export function isDatasetHospital(hospital: Hospital) {
  return hospital.source === 'dataset';
}

export function getHospitalClassificationLabel(classification?: HospitalClassification) {
  return classification === 'confirmed' ? '확정' : '후보';
}
