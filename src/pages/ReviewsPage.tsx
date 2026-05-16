import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimalTabs } from '../components/AnimalTabs';
import { Icon } from '../components/Icon';
import { ReviewComposer } from '../components/ReviewComposer';
import { useAppContext } from '../context/AppContext';
import {
  formatCurrency,
  formatDate,
  formatDistanceKm,
  getAnimalLabel,
  getHospitalAnimalCounts,
  hospitalMatchesAnimalFilter,
  mergeHospitalSupportedAnimals,
} from '../lib/format';
import { isDatasetHospital } from '../lib/hospitalDataset';
import type { AnimalFilter, Hospital, Review, ReviewDraft } from '../types';

interface ReviewRouteState {
  hospitalId?: string;
  animalType?: AnimalFilter;
  openComposer?: boolean;
  draft?: ReviewDraft;
}

type ReviewSort = 'popular' | 'latest';

interface ReviewCardProps {
  review: Review;
  hospitalName: string;
  currentNickname: string;
  showHospitalName?: boolean;
  onToggleLike: (reviewId: string) => void;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
}

interface HospitalReviewGroup {
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  distanceLabel: string;
  distanceValue: number;
  latestCreatedAt: number;
  totalLikes: number;
  reviewCount: number;
  reviews: Review[];
}

const sortOptions: Array<{ value: ReviewSort; label: string }> = [
  { value: 'popular', label: '인기순' },
  { value: 'latest', label: '최신순' },
];

function getDistanceValueKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function compareGroupsByBaseSort(left: HospitalReviewGroup, right: HospitalReviewGroup, sort: ReviewSort) {
  if (sort === 'popular') {
    return (
      right.totalLikes - left.totalLikes ||
      right.reviewCount - left.reviewCount ||
      right.latestCreatedAt - left.latestCreatedAt
    );
  }

  return right.latestCreatedAt - left.latestCreatedAt || right.reviewCount - left.reviewCount;
}

function compareGroups(
  left: HospitalReviewGroup,
  right: HospitalReviewGroup,
  sort: ReviewSort,
  prioritizeDistance: boolean,
) {
  const baseSortResult = compareGroupsByBaseSort(left, right, sort);

  if (prioritizeDistance) {
    return left.distanceValue - right.distanceValue || baseSortResult;
  }

  return baseSortResult || left.distanceValue - right.distanceValue;
}

function ReviewCard({
  review,
  hospitalName,
  currentNickname,
  showHospitalName = true,
  onToggleLike,
  onDelete,
  onEdit,
}: ReviewCardProps) {
  return (
    <article className="rounded-[1.6rem] border border-emerald-100/80 bg-[linear-gradient(180deg,_#ffffff,_#f6fffb)] p-4 shadow-[0_12px_30px_rgba(15,118,110,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
              {getAnimalLabel(review.animalType)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{review.species}</span>
            <span className="text-slate-400">{review.petName}</span>
          </div>

          {showHospitalName ? (
            <h3 className="mt-3 text-base font-semibold text-slate-900" title={hospitalName}>
              {hospitalName}
            </h3>
          ) : null}

          <p
            className={`${showHospitalName ? 'mt-1' : 'mt-3'} text-sm text-slate-500`}
            title={`${formatDate(review.date)} · ${formatCurrency(review.cost)}`}
          >
            {formatDate(review.date)} · {formatCurrency(review.cost)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onToggleLike(review.id)}
            className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold ${
              review.liked ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
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

      <p className="mt-4 text-sm font-semibold text-slate-800" title={review.diagnosis}>
        {review.diagnosis}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{review.body}</p>

      {review.tags.length > 0 || review.customTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {[...review.tags, ...review.customTags].map((tag) => (
            <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
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

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
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
  const routeState = location.state as ReviewRouteState | null;
  const { hospitals, reviews, toggleReviewLike, deleteReview, user } = useAppContext();
  const datasetHospitals = hospitals.filter((hospital) => isDatasetHospital(hospital));
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalFilter>(routeState?.animalType ?? 'all');
  const [sortBy, setSortBy] = useState<ReviewSort>('popular');
  const [prioritizeDistance, setPrioritizeDistance] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState(routeState?.hospitalId ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  const normalizedSearchKeyword = deferredSearch.trim().toLowerCase();
  const hospitalAnimalCounts = useMemo(() => getHospitalAnimalCounts(reviews), [reviews]);

  const hospitalById = useMemo(
    () =>
      hospitals.reduce<Record<string, Hospital>>((acc, hospital) => {
        acc[hospital.id] = hospital;
        return acc;
      }, {}),
    [hospitals],
  );

  const enrichedDatasetHospitals = useMemo(
    () =>
      datasetHospitals.map((hospital) => ({
        ...hospital,
        supportedAnimals: mergeHospitalSupportedAnimals(
          hospital.supportedAnimals,
          hospitalAnimalCounts[hospital.id],
        ),
      })),
    [datasetHospitals, hospitalAnimalCounts],
  );

  const filteredHospitals = useMemo(
    () =>
      enrichedDatasetHospitals.filter((hospital) =>
        hospitalMatchesAnimalFilter(
          hospital.supportedAnimals,
          hospitalAnimalCounts[hospital.id],
          selectedAnimal,
        ),
      ),
    [enrichedDatasetHospitals, hospitalAnimalCounts, selectedAnimal],
  );

  const animalFilteredReviews = useMemo(
    () => reviews.filter((review) => (selectedAnimal === 'all' ? true : review.animalType === selectedAnimal)),
    [reviews, selectedAnimal],
  );

  const hospitalMatches = useMemo(
    () =>
      filteredHospitals
        .filter((hospital) => {
          if (!normalizedSearchKeyword) {
            return true;
          }

          if (
            hospital.name.toLowerCase().includes(normalizedSearchKeyword) ||
            hospital.address.toLowerCase().includes(normalizedSearchKeyword)
          ) {
            return true;
          }

          return animalFilteredReviews.some(
            (review) =>
              review.hospitalId === hospital.id && matchesReviewSearch(review, hospital, normalizedSearchKeyword),
          );
        })
        .sort((left, right) => left.name.localeCompare(right.name, 'ko')),
    [animalFilteredReviews, filteredHospitals, normalizedSearchKeyword],
  );

  const filteredReviews = useMemo(
    () =>
      animalFilteredReviews.filter((review) => {
        if (!normalizedSearchKeyword) {
          return true;
        }

        return matchesReviewSearch(review, hospitalById[review.hospitalId], normalizedSearchKeyword);
      }),
    [animalFilteredReviews, hospitalById, normalizedSearchKeyword],
  );

  const groupedReviews = useMemo(() => {
    const grouped = filteredReviews.reduce<Record<string, Review[]>>((acc, review) => {
      acc[review.hospitalId] = [...(acc[review.hospitalId] ?? []), review];
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([hospitalId, groupedHospitalReviews]) => {
        const hospital = hospitalById[hospitalId];
        const sortedReviews = [...groupedHospitalReviews].sort((left, right) => compareReviews(left, right, sortBy));
        const distanceValue = hospital
          ? getDistanceValueKm(user.location.lat, user.location.lng, hospital.lat, hospital.lng)
          : Number.POSITIVE_INFINITY;

        return {
          hospitalId,
          hospitalName: hospital?.name ?? '이름 없는 병원',
          hospitalAddress: hospital?.address ?? '주소 정보 없음',
          distanceLabel: hospital
            ? `내 위치 ${formatDistanceKm(user.location.lat, user.location.lng, hospital.lat, hospital.lng)}`
            : '거리 정보 없음',
          distanceValue,
          latestCreatedAt: Math.max(...groupedHospitalReviews.map((review) => new Date(review.createdAt).getTime())),
          totalLikes: groupedHospitalReviews.reduce((sum, review) => sum + review.likes, 0),
          reviewCount: groupedHospitalReviews.length,
          reviews: sortedReviews,
        } satisfies HospitalReviewGroup;
      })
      .sort((left, right) => compareGroups(left, right, sortBy, prioritizeDistance));
  }, [filteredReviews, hospitalById, prioritizeDistance, sortBy, user.location.lat, user.location.lng]);

  const counts = {
    all: reviews.length,
    reptile: reviews.filter((review) => review.animalType === 'reptile').length,
    rodent: reviews.filter((review) => review.animalType === 'rodent').length,
    bird: reviews.filter((review) => review.animalType === 'bird').length,
  };

  const allSortedReviews = useMemo(
    () =>
      [...filteredReviews].sort((left, right) => {
        if (prioritizeDistance) {
          const leftHospital = hospitalById[left.hospitalId];
          const rightHospital = hospitalById[right.hospitalId];
          const leftDistance = leftHospital
            ? getDistanceValueKm(user.location.lat, user.location.lng, leftHospital.lat, leftHospital.lng)
            : Number.POSITIVE_INFINITY;
          const rightDistance = rightHospital
            ? getDistanceValueKm(user.location.lat, user.location.lng, rightHospital.lat, rightHospital.lng)
            : Number.POSITIVE_INFINITY;

          return leftDistance - rightDistance || compareReviews(left, right, sortBy);
        }

        return compareReviews(left, right, sortBy);
      }),
    [filteredReviews, hospitalById, prioritizeDistance, sortBy, user.location.lat, user.location.lng],
  );

  const isAllSelected = selectedHospitalId === '';
  const selectedGroup = groupedReviews.find((group) => group.hospitalId === selectedHospitalId) ?? null;

  useEffect(() => {
    if (groupedReviews.length === 0) {
      return;
    }

    if (!selectedHospitalId) {
      return;
    }

    const exists = groupedReviews.some((group) => group.hospitalId === selectedHospitalId);

    if (!exists) {
      setSelectedHospitalId(groupedReviews[0].hospitalId);
    }
  }, [groupedReviews, selectedHospitalId]);

  function selectHospital(hospitalId: string) {
    setSelectedHospitalId(hospitalId);
    setShowSuggestions(false);
  }

  function openHospitalOnMap(hospitalId: string) {
    navigate('/', {
      state: {
        hospitalId,
        animalType: selectedAnimal === 'all' ? undefined : selectedAnimal,
      },
    });
  }

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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[linear-gradient(180deg,_#18c19a_0%,_#0faa8c_100%)]" />

      <div className="relative">
        <section className="flex min-h-[12rem] flex-col justify-end pb-2 pt-3">
          <div className="mb-2 text-white">
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em]">리뷰</h1>
          </div>

          <div className="relative">
            <label className="relative flex items-center gap-3 rounded-full bg-white/92 px-4 py-3 text-slate-500 shadow-[0_10px_24px_rgba(15,118,110,0.08)]">
              <Icon name="search" className="h-5 w-5 text-emerald-600" />
              <input
                value={hospitalSearch}
                onChange={(event) => {
                  setHospitalSearch(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="병원, 종, 태그 검색"
                className="w-full bg-transparent pr-8 text-slate-700 placeholder:text-slate-400"
              />
              {hospitalSearch || showSuggestions ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setHospitalSearch('');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  aria-label="병원 검색 닫기"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              ) : null}
            </label>

            {showSuggestions ? (
              <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-3xl bg-white text-slate-700 shadow-xl">
                {!normalizedSearchKeyword ? (
                  <p className="px-4 pb-2 pt-3 text-xs font-semibold text-emerald-700">현재 탭의 병원 리스트</p>
                ) : null}
                {hospitalMatches.length > 0 ? (
                  hospitalMatches.slice(0, 8).map((hospital) => {
                    const reviewCount = animalFilteredReviews.filter(
                      (review) => review.hospitalId === hospital.id,
                    ).length;

                    return (
                      <button
                        key={hospital.id}
                        type="button"
                        onClick={() => {
                          setHospitalSearch('');
                          selectHospital(hospital.id);
                        }}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{hospital.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{hospital.address}</p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <p className="text-xs font-semibold text-emerald-700">리뷰 {reviewCount}</p>
                          <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                            <Icon name="chevron" className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-4 py-4 text-sm text-slate-500">검색 조건에 맞는 병원이 없어요</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-2">
            <AnimalTabs value={selectedAnimal} onChange={setSelectedAnimal} counts={counts} />
          </div>
        </section>

        <section className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => {
              const active = option.value === sortBy;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortBy(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-[linear-gradient(135deg,_#059669,_#10b981)] text-white shadow-[0_10px_22px_rgba(16,185,129,0.20)]'
                      : 'border border-emerald-100 bg-white/92 text-emerald-700 shadow-[0_8px_18px_rgba(15,118,110,0.06)]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPrioritizeDistance((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                prioritizeDistance
                  ? 'bg-[linear-gradient(135deg,_#0ea5e9,_#0284c7)] text-white shadow-[0_10px_22px_rgba(14,165,233,0.20)]'
                  : 'border border-sky-100 bg-white/92 text-sky-700 shadow-[0_8px_18px_rgba(14,165,233,0.06)]'
              }`}
            >
              거리순
            </button>
          </div>

          {groupedReviews.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedHospitalId('')}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isAllSelected
                    ? 'bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.20)]'
                    : 'border border-slate-200 bg-white/92 text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.05)]'
                }`}
              >
                전체 {allSortedReviews.length}
              </button>
              {groupedReviews.map((group) => {
                const active = group.hospitalId === selectedHospitalId;

                return (
                  <button
                    key={group.hospitalId}
                    type="button"
                    onClick={() => selectHospital(group.hospitalId)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-[linear-gradient(135deg,_#059669,_#10b981)] text-white shadow-[0_10px_22px_rgba(16,185,129,0.20)]'
                        : 'border border-emerald-100 bg-white/92 text-emerald-700 shadow-[0_8px_18px_rgba(15,118,110,0.06)]'
                    }`}
                  >
                    {group.hospitalName} {group.reviewCount}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="mt-4 space-y-4">
          {isAllSelected && allSortedReviews.length > 0 ? (
            <section className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                  전체 리뷰 {allSortedReviews.length}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  병원 {groupedReviews.length}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {allSortedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    hospitalName={hospitalById[review.hospitalId]?.name ?? '이름 없는 병원'}
                    currentNickname={user.nickname}
                    showHospitalName
                    onToggleLike={toggleReviewLike}
                    onDelete={handleDeleteReview}
                    onEdit={(currentReview) => {
                      setDraft(undefined);
                      setEditingReview(currentReview);
                      setComposerOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>
          ) : selectedGroup ? (
            <section className="rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                      리뷰 {selectedGroup.reviewCount}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                      좋아요 {selectedGroup.totalLikes}
                    </span>
                    <span className="rounded-full bg-sky-50 px-2 py-1 font-semibold text-sky-700">
                      {selectedGroup.distanceLabel}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-900">
                    {selectedGroup.hospitalName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedGroup.hospitalAddress}</p>
                </div>

                <button
                  type="button"
                  onClick={() => openHospitalOnMap(selectedGroup.hospitalId)}
                  className="shrink-0 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700"
                >
                  지도에서 보기
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {selectedGroup.reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    hospitalName={selectedGroup.hospitalName}
                    currentNickname={user.nickname}
                    showHospitalName={false}
                    onToggleLike={toggleReviewLike}
                    onDelete={handleDeleteReview}
                    onEdit={(currentReview) => {
                      setDraft(undefined);
                      setEditingReview(currentReview);
                      setComposerOpen(true);
                    }}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-[1.9rem] bg-white/95 px-5 py-10 text-center shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
              <p className="text-base font-semibold text-slate-800">아직 조건에 맞는 리뷰가 없어요</p>
              <p className="mt-2 text-sm text-slate-500">
                병원 검색어나 동물 탭, 정렬 조건을 바꿔보세요
              </p>
            </div>
          )}
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
