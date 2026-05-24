import type { MedicalRecord, Review } from '../types';

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function sameCoreVisit(
  left: {
    petId?: string | null;
    hospitalId: string;
    date: string;
    diagnosis?: string | null;
    cost?: number | null;
  },
  right: {
    petId?: string | null;
    hospitalId: string;
    date: string;
    diagnosis?: string | null;
    cost?: number | null;
  },
) {
  return (
    Boolean(left.petId) &&
    left.petId === right.petId &&
    left.hospitalId === right.hospitalId &&
    left.date === right.date &&
    normalizeText(left.diagnosis) === normalizeText(right.diagnosis) &&
    (left.cost ?? null) === (right.cost ?? null)
  );
}

export function findRecordForReview(
  records: MedicalRecord[],
  review: Pick<Review, 'petId' | 'hospitalId' | 'date' | 'diagnosis' | 'cost'>,
) {
  return records.find((record) => sameCoreVisit(record, review)) ?? null;
}

export function findReviewForRecord(
  reviews: Review[],
  record: Pick<MedicalRecord, 'petId' | 'hospitalId' | 'date' | 'diagnosis' | 'cost'>,
) {
  return reviews.find((review) => sameCoreVisit(review, record)) ?? null;
}
