import type { AnimalFilter, AnimalType, Review } from '../types';

const animalLabels: Record<AnimalFilter, string> = {
  all: '전체',
  reptile: '파충류',
  rodent: '설치류',
  bird: '조류',
};

export function formatCurrency(value: number | null) {
  if (value === null) {
    return '미입력';
  }

  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

  const distance = 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return `${distance.toFixed(1)}km`;
}

export function getAnimalLabel(type: AnimalFilter | AnimalType) {
  return animalLabels[type];
}

export function getHospitalAnimalCounts(reviews: Review[]) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return reviews.reduce<Record<string, Record<AnimalType, number>>>((acc, review) => {
    if (new Date(review.date) < oneYearAgo) {
      return acc;
    }

    const current = acc[review.hospitalId] ?? { reptile: 0, rodent: 0, bird: 0 };
    current[review.animalType] += 1;
    acc[review.hospitalId] = current;
    return acc;
  }, {});
}

export function getQualifiedCount(
  counts: Record<AnimalType, number> | undefined,
  animalType: AnimalFilter,
) {
  if (!counts) {
    return 0;
  }

  if (animalType === 'all') {
    return counts.reptile + counts.rodent + counts.bird;
  }

  return counts[animalType];
}

export function isQualifiedHospital(
  counts: Record<AnimalType, number> | undefined,
  animalType: AnimalFilter,
) {
  if (!counts) {
    return false;
  }

  if (animalType === 'all') {
    return Object.values(counts).some((count) => count >= 3);
  }

  return counts[animalType] >= 3;
}
