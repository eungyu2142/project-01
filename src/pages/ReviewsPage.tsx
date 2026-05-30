import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimalTabs } from '../components/AnimalTabs';
import { Icon } from '../components/Icon';
import { ReviewComposer } from '../components/ReviewComposer';
import { SearchBar } from '../components/SearchBar';
import { useAppContext } from '../context/AppContext';
import {
  formatCurrency,
  formatDate,
  getAnimalLabel,
} from '../lib/format';
import type { AnimalFilter, Hospital, Review, ReviewDraft } from '../types';

interface ReviewRouteState {
  hospitalId?: string;
  animalType?: AnimalFilter;
  openComposer?: boolean;
  draft?: ReviewDraft;
  returnTo?: string;
}

type ReviewSort = 'popular' | 'latest';

const compactBadgeClass = 'inline-flex min-h-7 items-center rounded-md px-2 py-1 text-xs font-semibold leading-none';
const spaciousBadgeClass = 'inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold leading-none';
const summaryRowClass = 'rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700';
const summaryLabelClass = 'mr-2 font-semibold text-slate-500';
const summaryHospitalRowClass = 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700';
const summaryHospitalLabelClass = 'mr-2 font-semibold text-emerald-600';

interface ReviewCardProps {
  review: Review;
  hospitalName: string;
  currentNickname: string;
  showHospitalName?: boolean;
  spacious?: boolean;
  onToggleLike: (reviewId: string) => void;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
}

interface ReviewPreviewCardProps {
  review: Review;
  hospitalName: string;
  onOpenReview?: () => void;
  onOpenHospital: () => void;
  onToggleLike: (reviewId: string) => void;
  onEdit: (review: Review) => void;
  onDelete: (reviewId: string) => void;
}

function matchesReviewSearch(
  review: Review,
  hospital: { name: string; address: string } | undefined,
  keyword: string,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [
    hospital?.name,
    hospital?.address,
    review.species,
    review.petName,
    review.diagnosis,
    review.medicine,
    review.body,
    ...review.tags,
    ...review.customTags,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedKeyword));
}

function compareReviews(left: Review, right: Review, sort: ReviewSort) {
  if (sort === 'popular') {
    return (
      right.likes - left.likes ||
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function ReviewPreviewCard({
  review,
  hospitalName,
  onOpenReview,
  onOpenHospital,
  onToggleLike,
  onEdit,
  onDelete,
}: ReviewPreviewCardProps) {
  const diagnosisLabel = review.diagnosis.trim();
  const treatmentLabel = review.medicine.trim();
  const reviewTags = [...review.tags, ...review.customTags];

  return (
    <article
      role={onOpenReview ? 'button' : undefined}
      tabIndex={onOpenReview ? 0 : undefined}
      onClick={onOpenReview}
      onKeyDown={(event) => {
        if (!onOpenReview || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }

        event.preventDefault();
        onOpenReview();
      }}
      className={`block w-full rounded-lg border border-emerald-100 bg-white p-4 text-left shadow-[0_8px_20px_rgba(15,118,110,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,118,110,0.12)] ${
        onOpenReview ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${compactBadgeClass} bg-emerald-50 text-emerald-700`}>
              {getAnimalLabel(review.animalType)}
            </span>
          </div>

          <div className="mt-3 space-y-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenHospital();
              }}
              className={`${summaryHospitalRowClass} block w-full truncate text-left underline decoration-emerald-300 underline-offset-2`}
              title={hospitalName}
            >
              <span className={summaryHospitalLabelClass}>병원</span>{hospitalName}
            </button>
            <p className={summaryRowClass}><span className={summaryLabelClass}>동물 종</span>{review.species}</p>
            <p className={summaryRowClass}><span className={summaryLabelClass}>병명</span>{diagnosisLabel || '미입력'}</p>
            <p className={summaryRowClass}><span className={summaryLabelClass}>처방</span>{treatmentLabel}</p>
          </div>

          {reviewTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewTags.map((tag) => (
                <span key={tag} className={`${compactBadgeClass} bg-emerald-50 text-emerald-700`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLike(review.id);
          }}
          className={`mt-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold ${
            review.liked ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}
          aria-label="리뷰 좋아요"
        >
          <Icon name="star" className="h-4 w-4" />
          <span>{review.likes}</span>
        </button>
      </div>

      {review.isMine ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(review);
            }}
            className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-700"
          >
            수정
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(review.id);
            }}
            className="rounded-lg bg-rose-50 px-3 py-2 font-semibold text-rose-500"
          >
            삭제
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ReviewCard({
  review,
  hospitalName,
  currentNickname,
  showHospitalName = true,
  spacious = false,
  onToggleLike,
  onDelete,
  onEdit,
}: ReviewCardProps) {
  const diagnosisLabel = review.diagnosis.trim();
  const treatmentLabel = review.medicine.trim();
  const reviewTags = [...review.tags, ...review.customTags];

  return (
    <article
      className={`rounded-lg border border-emerald-100 bg-white shadow-[0_8px_18px_rgba(15,118,110,0.07)] ${
        spacious ? 'flex max-h-[calc(100dvh-13rem)] flex-col p-5 sm:max-h-[calc(100dvh-15rem)]' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`flex flex-wrap items-center gap-2 ${spacious ? 'text-sm' : 'text-xs'}`}>
            <span className={`${spacious ? spaciousBadgeClass : compactBadgeClass} bg-emerald-100 text-emerald-700`}>
              {getAnimalLabel(review.animalType)}
            </span>
          </div>

          <p
            className={`mt-3 ${spacious ? 'text-lg' : 'text-sm'} text-slate-500`}
            title={`${formatDate(review.date)} · ${formatCurrency(review.cost)}`}
          >
            {formatDate(review.date)} · {formatCurrency(review.cost)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onToggleLike(review.id)}
            className={`flex items-center gap-1 rounded-lg font-semibold ${
              spacious ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'
            } ${
              review.liked ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Icon name="star" className={spacious ? 'h-5 w-5' : 'h-4 w-4'} />
            <span>{review.likes}</span>
          </button>

          {review.isMine ? (
            <div className={`flex gap-2 ${spacious ? 'text-sm' : 'text-xs'}`}>
              <button
                type="button"
                onClick={() => onEdit(review)}
                className={`rounded-lg bg-emerald-50 font-semibold text-emerald-700 ${spacious ? 'px-4 py-2' : 'px-3 py-1'}`}
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => onDelete(review.id)}
                className={`rounded-lg bg-rose-50 font-semibold text-rose-500 ${spacious ? 'px-4 py-2' : 'px-3 py-1'}`}
              >
                삭제
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={spacious ? 'mt-5 min-h-0 overflow-y-auto pr-1' : 'mt-4'}>
        <div className="space-y-1.5">
          {showHospitalName ? (
            <p className={summaryHospitalRowClass}>
              <span className={summaryHospitalLabelClass}>병원</span>{hospitalName}
            </p>
          ) : null}
          <p className={summaryRowClass}>
            <span className={summaryLabelClass}>동물 종</span>{review.species}
          </p>
          <p className={summaryRowClass}>
            <span className={summaryLabelClass}>병명</span>{diagnosisLabel || '미입력'}
          </p>
          <p className={summaryRowClass}>
            <span className={summaryLabelClass}>처방</span>{treatmentLabel || '미입력'}
          </p>
        </div>

        {review.body.trim() ? (
          <p className={`${spacious ? 'mt-5 text-base leading-7' : 'mt-4 text-sm leading-6'} whitespace-pre-line text-slate-600`}>
            {review.body}
          </p>
        ) : null}

        {reviewTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {reviewTags.map((tag) => (
              <span key={tag} className={`${spacious ? spaciousBadgeClass : compactBadgeClass} bg-emerald-50 text-emerald-700`}>
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
                className={`${spacious ? 'h-32' : 'h-24'} w-full rounded-lg object-cover`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className={`mt-5 flex items-center justify-between gap-3 text-slate-400 ${spacious ? 'text-sm' : 'text-xs'}`}>
        <span className="truncate" title={review.isMine ? currentNickname : review.authorName}>
          by {review.isMine ? currentNickname : review.authorName}
        </span>
        <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      </div>
    </article>
  );
}

export function ReviewsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { reviewId } = useParams();
  const routeState = location.state as ReviewRouteState | null;
  const { hospitals, reviews, toggleReviewLike, deleteReview, user } = useAppContext();
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalFilter>(routeState?.animalType ?? 'all');
  const [hospitalFilterId, setHospitalFilterId] = useState(routeState?.hospitalId ?? '');
  const [reviewSort, setReviewSort] = useState<ReviewSort>('latest');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(Boolean(routeState?.openComposer));
  const [returnTo] = useState(routeState?.returnTo ?? '');
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
  const normalizedSearchKeyword = deferredSearch.trim().toLowerCase();

  const hospitalById = useMemo(
    () =>
      hospitals.reduce<Record<string, Hospital>>((acc, hospital) => {
        acc[hospital.id] = hospital;
        return acc;
      }, {}),
    [hospitals],
  );

  useEffect(() => {
    if (routeState?.hospitalId) {
      setHospitalFilterId(routeState.hospitalId);
      setHospitalSearch(hospitalById[routeState.hospitalId]?.name ?? '');
    }

    if (routeState?.animalType) {
      setSelectedAnimal(routeState.animalType);
    }

    if (routeState?.hospitalId || routeState?.animalType || routeState?.openComposer || routeState?.draft) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [
    hospitalById,
    location.pathname,
    navigate,
    routeState?.animalType,
    routeState?.draft,
    routeState?.hospitalId,
    routeState?.openComposer,
  ]);

  const myReviews = useMemo(
    () => reviews.filter((review) => review.isMine || review.userId === user.id),
    [reviews, user.id],
  );

  const countScopedReviews = useMemo(
    () =>
      myReviews
        .filter((review) => (hospitalFilterId ? review.hospitalId === hospitalFilterId : true))
        .filter((review) => {
          if (!normalizedSearchKeyword) {
            return true;
          }

          return matchesReviewSearch(review, hospitalById[review.hospitalId], normalizedSearchKeyword);
        }),
    [hospitalById, hospitalFilterId, myReviews, normalizedSearchKeyword],
  );

  const animalFilteredReviews = useMemo(
    () =>
      countScopedReviews.filter((review) =>
        selectedAnimal === 'all' ? true : review.animalType === selectedAnimal,
      ),
    [countScopedReviews, selectedAnimal],
  );

  const filteredReviews = useMemo(
    () =>
      animalFilteredReviews.sort((left, right) => compareReviews(left, right, reviewSort)),
    [animalFilteredReviews, reviewSort],
  );


  const selectedReview = reviewId ? filteredReviews.find((review) => review.id === reviewId) ?? null : null;
  const reviewScopeForCounts = countScopedReviews;
  const counts = {
    all: reviewScopeForCounts.length,
    reptile: reviewScopeForCounts.filter((review) => review.animalType === 'reptile').length,
    rodent: reviewScopeForCounts.filter((review) => review.animalType === 'rodent').length,
    bird: reviewScopeForCounts.filter((review) => review.animalType === 'bird').length,
  };

  useEffect(() => {
    if (!reviewId) {
      return;
    }

    const exists = filteredReviews.some((review) => review.id === reviewId);

    if (!exists) {
      navigate(returnTo || '/reviews', { replace: true });
    }
  }, [filteredReviews, navigate, returnTo, reviewId]);

  function returnToReportList() {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    setHospitalSearch('');
    setHospitalFilterId('');
    navigate('/reviews');
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingReview(null);
    setDraft(undefined);

    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }

  function openReviewDetail(reviewIdToOpen: string) {
    const nextPath = `/reviews/${encodeURIComponent(reviewIdToOpen)}`;

    if (returnTo) {
      navigate(nextPath, { replace: true, state: { returnTo } });
      return;
    }

    navigate(nextPath);
  }

  function openNewReview() {
    setEditingReview(null);
    setDraft(routeState?.hospitalId ? { hospitalId: routeState.hospitalId } : undefined);
    setComposerOpen(true);
  }

  function handleDeleteReview(reviewId: string) {
    const confirmed = window.confirm('정말 삭제하시겠습니까?');

    if (!confirmed) {
      return;
    }

    deleteReview(reviewId);
  }

  function openHospitalOnMap(review: Review) {
    navigate('/', {
      state: {
        hospitalId: review.hospitalId,
        animalType: review.animalType,
      },
    });
  }

  if (reviewId && selectedReview) {
    return (
      <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[#18b996]" />

        <div className="relative z-10">
          <header className="flex min-h-[7rem] flex-col items-start pt-7">
            <button
              type="button"
              onClick={returnToReportList}
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/95 text-emerald-700 shadow-[0_8px_18px_rgba(15,118,110,0.14)]"
              aria-label="리뷰 목록으로 돌아가기"
            >
              <Icon name="chevron" className="h-6 w-6 rotate-180" />
            </button>
          </header>

          <section className="mt-2">
            <ReviewCard
              review={selectedReview}
              hospitalName={hospitalById[selectedReview.hospitalId]?.name ?? '이름 없는 병원'}
              currentNickname={user.nickname}
              showHospitalName
              spacious
              onToggleLike={toggleReviewLike}
              onDelete={handleDeleteReview}
              onEdit={(currentReview) => {
                setDraft(undefined);
                setEditingReview(currentReview);
                setComposerOpen(true);
              }}
            />
          </section>

          <ReviewComposer
            key={`${editingReview?.id ?? 'new'}-${draft?.hospitalId ?? 'hospital'}-${draft?.petId ?? 'pet'}-${composerOpen ? 'open' : 'closed'}`}
            open={composerOpen}
            onClose={closeComposer}
            initialDraft={draft}
            editingReview={editingReview}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f4fffb] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-[#18b996]" />

      <div className="relative z-10">
        <section className="flex min-h-[14rem] flex-col justify-start pb-5 pt-7">
          <div className="mb-2 text-white">
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em]">리뷰</h1>
          </div>

          <div className="relative">
            <SearchBar
              value={hospitalSearch}
              onValueChange={(nextValue) => {
                setHospitalSearch(nextValue);
                setHospitalFilterId('');
                if (reviewId) {
                  navigate('/reviews');
                }
              }}
              placeholder=""
              clearVisible={Boolean(hospitalSearch)}
              onClear={() => {
                setHospitalSearch('');
                setHospitalFilterId('');
                if (reviewId) {
                  navigate('/reviews');
                }
              }}
              clearLabel="검색어 지우기"
            />
          </div>

          <AnimalTabs className="mt-3" value={selectedAnimal} onChange={setSelectedAnimal} counts={counts} />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              {[
                { value: 'latest' as const, label: '최신순' },
                { value: 'popular' as const, label: '인기순' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setReviewSort(option.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_6px_14px_rgba(16,185,129,0.12)] ${
                    reviewSort === option.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/95 text-emerald-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openNewReview}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-[0_8px_18px_rgba(16,185,129,0.22)]"
              aria-label="리뷰 작성"
            >
              <Icon name="plus" className="h-5 w-5" />
            </button>
          </div>
        </section>

        <section className="mt-5 space-y-4">
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => {

              return (
                <ReviewPreviewCard
                  key={review.id}
                  review={review}
                  hospitalName={hospitalById[review.hospitalId]?.name ?? '이름 없는 병원'}
                  onOpenReview={() => openReviewDetail(review.id)}
                  onOpenHospital={() => openHospitalOnMap(review)}
                  onToggleLike={toggleReviewLike}
                  onEdit={(currentReview) => {
                    setDraft(undefined);
                    setEditingReview(currentReview);
                    setComposerOpen(true);
                  }}
                  onDelete={handleDeleteReview}
                />
              );
            })
          ) : null}
        </section>

        <ReviewComposer
          key={`${editingReview?.id ?? 'new'}-${draft?.hospitalId ?? 'hospital'}-${draft?.petId ?? 'pet'}-${composerOpen ? 'open' : 'closed'}`}
          open={composerOpen}
          onClose={closeComposer}
          initialDraft={draft}
          editingReview={editingReview}
        />
      </div>
    </div>
  );
}
