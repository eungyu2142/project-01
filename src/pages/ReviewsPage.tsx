import { useDeferredValue, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimalTabs } from '../components/AnimalTabs';
import { Icon } from '../components/Icon';
import { ReviewComposer } from '../components/ReviewComposer';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatDate, getAnimalLabel } from '../lib/format';
import { isDatasetHospital } from '../lib/hospitalDataset';
import type { AnimalFilter, Review, ReviewDraft } from '../types';

interface ReviewRouteState {
  hospitalId?: string;
  animalType?: AnimalFilter;
  openComposer?: boolean;
  draft?: ReviewDraft;
}

interface ReviewResultsProps {
  reviews: Review[];
  hospitalNames: Record<string, string>;
  currentNickname: string;
  onToggleLike: (reviewId: string) => void;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
}

function ReviewResults({
  reviews,
  hospitalNames,
  currentNickname,
  onToggleLike,
  onDelete,
  onEdit,
}: ReviewResultsProps) {
  const [visibleCount, setVisibleCount] = useState(4);
  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMore = reviews.length > visibleCount;

  if (reviews.length === 0) {
    return (
      <div className="rounded-[1.9rem] bg-white/95 px-5 py-10 text-center shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
        <p className="text-base font-semibold text-slate-800">아직 조건에 맞는 리뷰가 없어요</p>
        <p className="mt-2 text-sm text-slate-500">병원 검색어나 동물 태그를 바꿔보세요</p>
      </div>
    );
  }

  return (
    <>
      {visibleReviews.map((review) => (
        <article
          key={review.id}
          className="rounded-[1.9rem] border border-white/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,118,110,0.10)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                  {getAnimalLabel(review.animalType)}
                </span>
                <span className="text-slate-500">{review.species}</span>
                <span className="text-slate-400">{review.petName}</span>
              </div>
              <h2
                className="mt-3 truncate text-lg font-semibold text-slate-900"
                title={hospitalNames[review.hospitalId] ?? '이름 없는 병원'}
              >
                {hospitalNames[review.hospitalId] ?? '이름 없는 병원'}
              </h2>
              <p
                className="mt-1 truncate text-sm text-slate-500"
                title={`${formatDate(review.date)} · ${formatCurrency(review.cost)}`}
              >
                {formatDate(review.date)} · {formatCurrency(review.cost)}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => onToggleLike(review.id)}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm ${
                  review.liked ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon name="star" className="h-4 w-4" />
                <span>{review.likes}</span>
              </button>
              {review.isMine ? (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onEdit(review)}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(review.id)}
                    className="rounded-full bg-rose-50 px-3 py-1 text-rose-500"
                  >
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-4 truncate text-sm font-medium text-slate-700" title={review.diagnosis}>{review.diagnosis}</p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600" title={review.body}>{review.body}</p>

          {review.tags.length > 0 || review.customTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {[...review.tags, ...review.customTags].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {review.imageUrls.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {review.imageUrls.map((imageUrl) => (
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt="리뷰 이미지"
                  className="h-24 w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          ) : null}

          <p className="mt-4 truncate text-xs text-slate-400" title={review.isMine ? currentNickname : review.authorName}>by {review.isMine ? currentNickname : review.authorName}</p>
        </article>
      ))}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 4)}
          className="w-full rounded-[1.6rem] border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-[0_12px_30px_rgba(15,118,110,0.08)]"
        >
          리뷰 더보기
        </button>
      ) : null}
    </>
  );
}

export function ReviewsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ReviewRouteState | null;
  const { hospitals, reviews, toggleReviewLike, deleteReview, user } = useAppContext();
  const datasetHospitals = hospitals.filter((hospital) => isDatasetHospital(hospital));
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalFilter>(routeState?.animalType ?? 'all');
  const [hospitalSearch, setHospitalSearch] = useState(() => {
    if (!routeState?.hospitalId) {
      return '';
    }

    return hospitals.find((item) => item.id === routeState.hospitalId)?.name ?? '';
  });
  const [selectedHospitalId, setSelectedHospitalId] = useState(routeState?.hospitalId ?? '');
  const [composerOpen, setComposerOpen] = useState(Boolean(routeState?.openComposer));
  const [draft, setDraft] = useState<ReviewDraft | undefined>(() => {
    if (routeState?.draft) {
      return routeState.draft;
    }

    if (routeState?.openComposer && routeState?.hospitalId) {
      return { hospitalId: routeState.hospitalId };
    }

    return undefined;
  });
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const deferredSearch = useDeferredValue(hospitalSearch);

  const hospitalMatches = datasetHospitals.filter((hospital) =>
    hospital.name.toLowerCase().includes(deferredSearch.toLowerCase()),
  );

  const filteredReviews = [...reviews]
    .filter((review) => (selectedAnimal === 'all' ? true : review.animalType === selectedAnimal))
    .filter((review) => (selectedHospitalId ? review.hospitalId === selectedHospitalId : true))
    .filter((review) => {
      if (!deferredSearch.trim() || selectedHospitalId) {
        return true;
      }

      const hospital = hospitals.find((item) => item.id === review.hospitalId);
      return hospital?.name.toLowerCase().includes(deferredSearch.toLowerCase()) ?? false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const hospitalNames = hospitals.reduce<Record<string, string>>((acc, hospital) => {
    acc[hospital.id] = hospital.name;
    return acc;
  }, {});

  const counts = {
    all: reviews.length,
    reptile: reviews.filter((review) => review.animalType === 'reptile').length,
    rodent: reviews.filter((review) => review.animalType === 'rodent').length,
    bird: reviews.filter((review) => review.animalType === 'bird').length,
  };

  function openNewReview() {
    setEditingReview(null);
    setDraft(selectedHospitalId ? { hospitalId: selectedHospitalId } : undefined);
    setComposerOpen(true);
  }

  function handleDeleteReview(reviewId: string) {
    const confirmed = window.confirm('정말 삭제하시겠습니까?');

    if (!confirmed) {
      return;
    }

    deleteReview(reviewId);
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,_#18c19a_0%,_#0faa8c_100%)]" />
      <div className="relative">
        <section className="flex min-h-[11rem] flex-col justify-end pb-5 pt-4">
          <div className="mb-3 text-white">
            <p className="text-sm text-emerald-50/90">병원 후기</p>
            <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em]">리뷰</h1>
          </div>
          <div className="relative">
            <label className="relative flex items-center gap-3 rounded-full bg-white/90 px-4 py-3 text-slate-500 shadow-sm">
              <Icon name="search" className="h-5 w-5 text-emerald-600" />
              <input
                value={hospitalSearch}
                onChange={(event) => {
                  setHospitalSearch(event.target.value);
                  if (!event.target.value) {
                    setSelectedHospitalId('');
                  }
                }}
                placeholder="병원 검색"
                className="w-full bg-transparent pr-8 text-slate-700 placeholder:text-slate-400"
              />
              {hospitalSearch ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setHospitalSearch('');
                    setSelectedHospitalId('');
                  }}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  aria-label="병원 검색어 지우기"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              ) : null}
            </label>

            {deferredSearch && !selectedHospitalId ? (
              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-3xl bg-white text-slate-700 shadow-xl">
                {hospitalMatches.slice(0, 5).map((hospital) => (
                  <button
                    key={hospital.id}
                    type="button"
                    onClick={() => {
                      setSelectedHospitalId(hospital.id);
                      setHospitalSearch(hospital.name);
                    }}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0"
                  >
                    <span>{hospital.name}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                      <Icon name="chevron" className="h-5 w-5" />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <AnimalTabs value={selectedAnimal} onChange={setSelectedAnimal} counts={counts} />
          </div>
        </section>

      {selectedHospitalId ? (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>선택한 병원: {hospitalNames[selectedHospitalId]}</span>
          <button
            type="button"
            onClick={() => {
              setSelectedHospitalId('');
              setHospitalSearch('');
            }}
            className="rounded-full bg-white px-3 py-1 text-xs text-slate-600"
          >
            해제
          </button>
        </div>
      ) : null}

      <section className="mt-5 space-y-4">
        <ReviewResults
          key={`${selectedAnimal}-${selectedHospitalId}-${deferredSearch}`}
          reviews={filteredReviews}
          hospitalNames={hospitalNames}
          currentNickname={user.nickname}
          onToggleLike={toggleReviewLike}
          onDelete={handleDeleteReview}
          onEdit={(review) => {
            setDraft(undefined);
            setEditingReview(review);
            setComposerOpen(true);
          }}
        />
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.3rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-5 sm:bottom-[7.5rem]">
        <div className="flex w-full max-w-md justify-end">
          <button
            type="button"
            onClick={openNewReview}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.35)]"
            aria-label="리뷰 작성"
          >
            <Icon name="plus" className="h-5 w-5" />
            <span>리뷰 작성</span>
          </button>
        </div>
      </div>

      <ReviewComposer
        key={`${editingReview?.id ?? 'new'}-${draft?.hospitalId ?? 'hospital'}-${draft?.petId ?? 'pet'}-${composerOpen ? 'open' : 'closed'}`}
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setEditingReview(null);
          setDraft(undefined);
          if (location.state) {
            navigate(location.pathname, { replace: true, state: null });
          }
        }}
        initialDraft={draft}
        editingReview={editingReview}
      />
      </div>
    </div>
  );
}

