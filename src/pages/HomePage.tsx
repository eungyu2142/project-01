import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimalTabs } from '../components/AnimalTabs';
import { HomeMap } from '../components/HomeMap';
import { Icon } from '../components/Icon';
import { SearchBar } from '../components/SearchBar';
import { useAppContext } from '../context/AppContext';
import {
  formatDistanceKm,
  getHospitalAnimalCounts,
  getQualifiedCount,
  hospitalMatchesAnimalFilter,
  mergeHospitalSupportedAnimals,
} from '../lib/format';
import { isDatasetHospital } from '../lib/hospitalDataset';
import { resolveCurrentRegion } from '../lib/currentLocation';
import type { AnimalFilter, Hospital, Review } from '../types';

interface HomeRouteState {
  hospitalId?: string;
  animalType?: AnimalFilter;
}

const animalLabels: Record<string, string> = {
  all: '전체',
  reptile: '파충류',
  rodent: '설치류',
  bird: '조류',
};

const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

function getChoseongText(value: string) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0) - 0xac00;

      if (code < 0 || code > 11171) {
        return character;
      }

      return CHOSEONG[Math.floor(code / 588)];
    })
    .join('');
}

function matchesSearchKeyword(hospital: Hospital, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return (
    hospital.name.toLowerCase().includes(normalizedKeyword) ||
    hospital.address.toLowerCase().includes(normalizedKeyword) ||
    getChoseongText(hospital.name).includes(keyword.trim())
  );
}

function getRecentReviewedSpecies(hospitalId: string, reviews: Review[], animalType: AnimalFilter) {
  const seen = new Set<string>();

  return reviews
    .filter((review) => review.hospitalId === hospitalId)
    .filter((review) => (animalType === 'all' ? true : review.animalType === animalType))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .map((review) => review.species.trim())
    .filter(Boolean)
    .filter((species) => {
      if (seen.has(species)) {
        return false;
      }

      seen.add(species);
      return true;
    })
    .slice(0, 2);
}

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as HomeRouteState | null;
  const { datasetError, datasetStatus, hospitals, reviews, saveUserLocation, toggleHospitalLike, user } =
    useAppContext();
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalFilter>(routeState?.animalType ?? 'all');
  const [searchText, setSearchText] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState(routeState?.hospitalId ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const currentLocation = user.location;

  function requestCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        saveUserLocation({ location: nextLocation });
        void resolveCurrentRegion(nextLocation.lat, nextLocation.lng)
          .then((nextCity) => {
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
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  useEffect(() => {
    requestCurrentLocation();
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (!routeState?.hospitalId) {
      return;
    }

    setSelectedHospitalId(routeState.hospitalId);

    if (routeState.animalType) {
      setSelectedAnimal(routeState.animalType);
    }

    setSearchText('');
    setShowSuggestions(false);
    setTopCollapsed(false);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navigate, routeState?.animalType, routeState?.hospitalId]);

  const datasetHospitals = useMemo(
    () => hospitals.filter((hospital) => isDatasetHospital(hospital)),
    [hospitals],
  );
  const hospitalAnimalCounts = useMemo(() => getHospitalAnimalCounts(reviews), [reviews]);
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

  const counts = useMemo(
    () => ({
      all: enrichedDatasetHospitals.length,
      reptile: enrichedDatasetHospitals.filter((hospital) =>
        hospitalMatchesAnimalFilter(
          hospital.supportedAnimals,
          hospitalAnimalCounts[hospital.id],
          'reptile',
        ),
      ).length,
      rodent: enrichedDatasetHospitals.filter((hospital) =>
        hospitalMatchesAnimalFilter(
          hospital.supportedAnimals,
          hospitalAnimalCounts[hospital.id],
          'rodent',
        ),
      ).length,
      bird: enrichedDatasetHospitals.filter((hospital) =>
        hospitalMatchesAnimalFilter(hospital.supportedAnimals, hospitalAnimalCounts[hospital.id], 'bird'),
      ).length,
    }),
    [enrichedDatasetHospitals, hospitalAnimalCounts],
  );

  const visibleHospitals = useMemo(
    () =>
      enrichedDatasetHospitals
        .filter((hospital) =>
          hospitalMatchesAnimalFilter(
            hospital.supportedAnimals,
            hospitalAnimalCounts[hospital.id],
            selectedAnimal,
          ),
        )
        .filter((hospital) => matchesSearchKeyword(hospital, searchText))
        .sort((left, right) => {
          const leftDistance = Number.parseFloat(
            formatDistanceKm(currentLocation.lat, currentLocation.lng, left.lat, left.lng),
          );
          const rightDistance = Number.parseFloat(
            formatDistanceKm(currentLocation.lat, currentLocation.lng, right.lat, right.lng),
          );

          return leftDistance - rightDistance || left.name.localeCompare(right.name, 'ko');
        }),
    [currentLocation.lat, currentLocation.lng, enrichedDatasetHospitals, hospitalAnimalCounts, searchText, selectedAnimal],
  );

  const suggestedHospitals = useMemo(
    () => (searchText.trim() ? visibleHospitals.slice(0, 8) : visibleHospitals),
    [searchText, visibleHospitals],
  );
  const selectedHospital = enrichedDatasetHospitals.find((hospital) => hospital.id === selectedHospitalId);
  const mapHospitals = useMemo(() => {
    if (!selectedHospital || visibleHospitals.some((hospital) => hospital.id === selectedHospital.id)) {
      return visibleHospitals;
    }

    return [selectedHospital, ...visibleHospitals];
  }, [selectedHospital, visibleHospitals]);
  const markerReviewCounts = useMemo(
    () =>
      mapHospitals.reduce<Record<string, number>>((acc, hospital) => {
        acc[hospital.id] = getQualifiedCount(hospitalAnimalCounts[hospital.id], selectedAnimal);
        return acc;
      }, {}),
    [hospitalAnimalCounts, mapHospitals, selectedAnimal],
  );
  const selectedHospitalReviews = selectedHospital
    ? reviews.filter(
        (review) =>
          review.hospitalId === selectedHospital.id &&
          (selectedAnimal === 'all' ? true : review.animalType === selectedAnimal),
      )
    : [];
  const recentSpecies = selectedHospital
    ? getRecentReviewedSpecies(selectedHospital.id, reviews, selectedAnimal)
    : [];

  function handleSelectHospital(hospitalId: string) {
    setSelectedHospitalId(hospitalId);
    setShowSuggestions(false);
  }

  function handleRecenterToCurrentLocation() {
    setSelectedHospitalId('');
    setShowSuggestions(false);
    requestCurrentLocation();
  }

  const bottomOverlayClass =
    'home-bottom-overlay pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] sm:pb-[calc(env(safe-area-inset-bottom)+8.5rem)]';

  return (
    <section className="home-page relative h-full overflow-hidden bg-slate-950">
      <HomeMap
        currentLocation={currentLocation}
        hospitals={mapHospitals}
        markerReviewCounts={markerReviewCounts}
        selectedHospitalId={selectedHospitalId}
        onSelectHospital={handleSelectHospital}
        onRequestCurrentLocation={handleRecenterToCurrentLocation}
      />

      <div className="home-top-overlay fixed inset-x-0 top-0 z-30">
        {topCollapsed ? (
          <div className="home-collapsed-wrap mx-auto flex max-w-[32rem] justify-center px-4 pt-2">
            <button
              type="button"
              onClick={() => setTopCollapsed(false)}
              className="pointer-events-auto inline-flex h-8 w-12 items-center justify-center rounded-md bg-white/92 text-emerald-700 shadow-[0_12px_30px_rgba(15,118,110,0.18)] backdrop-blur"
              aria-label="상단 열기"
            >
              <Icon name="chevron" className="h-4 w-4 rotate-90" />
            </button>
          </div>
        ) : (
          <div className="home-search-shell mx-auto max-w-[32rem] px-4 transition-transform duration-300 translate-y-0">
            <div className="home-search-panel pointer-events-auto rounded-b-[2.25rem] border-x border-b border-white/65 bg-white/95 px-4 pb-4 pt-3 shadow-[0_24px_50px_rgba(15,118,110,0.18)] backdrop-blur">
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setTopCollapsed(true)}
                  className="inline-flex h-8 w-14 items-center justify-center rounded-md border border-emerald-100 bg-white/90 text-emerald-700 shadow-[0_8px_22px_rgba(15,118,110,0.08)]"
                  aria-label="상단 접기"
                >
                  <Icon name="chevron" className="h-4 w-4 -rotate-90" />
                </button>
              </div>

              <div className="home-search-inner mx-auto max-w-[28.5rem]">
                <SearchBar
                  value={searchText}
                  onValueChange={(nextValue) => {
                    setSearchText(nextValue);
                    setShowSuggestions(true);
                    setTopCollapsed(false);
                  }}
                  onFocus={() => {
                    requestCurrentLocation();
                    setShowSuggestions(true);
                    setTopCollapsed(false);
                  }}
                  placeholder="병원 검색"
                  clearVisible={Boolean(searchText.trim() || showSuggestions)}
                  onClear={() => {
                    setSearchText('');
                    setShowSuggestions(false);
                    setSelectedHospitalId('');
                  }}
                />
                <AnimalTabs className="mt-3" value={selectedAnimal} onChange={setSelectedAnimal} counts={counts} />
              </div>

              {showSuggestions ? (
                <div className="mx-auto mt-3 max-w-[28.5rem] rounded-lg border border-emerald-100 bg-white p-2 shadow-[0_16px_36px_rgba(15,118,110,0.12)]">
                  {!searchText.trim() ? (
                    <p className="px-3 pb-2 pt-1 text-xs font-semibold text-emerald-700">
                      현재 위치 기준 가까운 병원
                    </p>
                  ) : null}
                  <div className="max-h-[min(22rem,calc(100dvh-16rem))] overflow-y-auto">
                  {suggestedHospitals.length > 0 ? (
                    suggestedHospitals.map((hospital) => (
                      <button
                        key={hospital.id}
                        type="button"
                        onClick={() => handleSelectHospital(hospital.id)}
                        className="flex w-full items-center justify-between rounded-[1.1rem] px-3 py-3 text-left hover:bg-emerald-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{hospital.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{hospital.address}</p>
                        </div>
                        <span className="ml-3 shrink-0 text-xs font-semibold text-emerald-700">
                          {formatDistanceKm(currentLocation.lat, currentLocation.lng, hospital.lat, hospital.lng)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm text-slate-500">검색 결과가 없어요.</p>
                  )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {selectedHospital ? (
        <div className={bottomOverlayClass}>
          <div className="pointer-events-auto rounded-lg border border-white/80 bg-white/95 p-3.5 shadow-[0_20px_40px_rgba(15,118,110,0.16)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  {animalLabels[selectedAnimal]}
                </span>
                <p className="mt-1.5 truncate text-base font-semibold text-slate-900">{selectedHospital.name}</p>
                <div className="mt-1 flex flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm leading-5 text-slate-600">위치: {selectedHospital.address}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">리뷰 {selectedHospitalReviews.length}개</p>
                <p className="mt-1 text-xs text-slate-500">
                  최근 진료 종: {recentSpecies.length > 0 ? recentSpecies.join(', ') : '리뷰 데이터 없음'}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => toggleHospitalLike(selectedHospital.id)}
                  className={`rounded-md p-3 ${
                    selectedHospital.liked ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-400'
                  }`}
                  aria-label="병원 좋아요"
                >
                  <Icon name="heart" className="h-5 w-5" filled={selectedHospital.liked} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHospitalId('');
                    setShowSuggestions(false);
                  }}
                  className="rounded-md bg-slate-100 p-3 text-slate-500"
                  aria-label="병원 닫기"
                >
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="rounded-lg bg-emerald-50/80 px-3 py-2">
                <p className="text-[11px] font-medium text-emerald-700">거리</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatDistanceKm(
                    currentLocation.lat,
                    currentLocation.lng,
                    selectedHospital.lat,
                    selectedHospital.lng,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 pb-1">
              <button
                type="button"
                disabled={selectedHospitalReviews.length === 0}
                onClick={() =>
                  navigate('/reviews', {
                    state: {
                      hospitalId: selectedHospital.id,
                      animalType: selectedAnimal,
                    },
                  })
                }
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  selectedHospitalReviews.length === 0
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : 'border-emerald-200 bg-white text-emerald-700'
                }`}
              >
                리뷰 보기
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/reviews', {
                    state: {
                      hospitalId: selectedHospital.id,
                      animalType: selectedAnimal === 'all' ? undefined : selectedAnimal,
                      openComposer: true,
                    },
                  })
                }
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                리뷰 작성
              </button>
            </div>
          </div>
        </div>
      ) : datasetStatus === 'loading' ? (
        <div className={bottomOverlayClass}>
          <div className="rounded-lg border border-white/70 bg-white/88 px-4 py-3 text-center shadow-[0_20px_40px_rgba(15,118,110,0.14)] backdrop-blur">
            <p className="text-sm font-medium text-slate-600">병원 데이터를 불러오는 중이에요.</p>
          </div>
        </div>
      ) : datasetStatus === 'error' ? (
        <div className={bottomOverlayClass}>
          <div className="rounded-lg border border-rose-100 bg-white/92 px-4 py-3 text-center shadow-[0_20px_40px_rgba(15,118,110,0.14)] backdrop-blur">
            <p className="text-sm font-medium text-rose-500">{datasetError || '병원 데이터를 불러오지 못했어요.'}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
