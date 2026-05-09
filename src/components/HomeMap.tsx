import { useEffect, useRef, useState } from 'react';
import {
  getNaverMapClientId,
  loadNaverMapSdk,
  type NaverMapIcon,
  type NaverMapInstance,
  type NaverMapsNamespace,
  type NaverMarkerInstance,
} from '../lib/naverMaps';
import type { Hospital } from '../types';

interface HomeMapProps {
  currentLocation: {
    lat: number;
    lng: number;
  };
  hospitals: Hospital[];
  markerReviewCounts: Record<string, number>;
  selectedHospitalId: string;
  onSelectHospital: (hospitalId: string) => void;
}

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

function getNaverMaps(): NaverMapsNamespace {
  if (!window.naver?.maps) {
    throw new Error('NAVER Maps SDK is not loaded.');
  }

  return window.naver.maps;
}

function createHospitalMarker(active: boolean, reviewCount: number): NaverMapIcon {
  const maps = getNaverMaps();
  const isBlue = reviewCount >= 4;
  const isMint = reviewCount >= 2;
  const background = isBlue
    ? 'linear-gradient(135deg, #60a5fa, #2563eb)'
    : isMint
      ? 'linear-gradient(135deg, #2dd4bf, #0f766e)'
      : '#ffffff';
  const color = isBlue || isMint ? '#ffffff' : '#047857';
  const boxShadow = active
    ? '0 18px 34px rgba(15, 118, 110, 0.34)'
    : '0 14px 28px rgba(15, 118, 110, 0.22)';
  const transform = active ? 'scale(1.08)' : 'scale(1)';

  return {
    content: `
      <div style="
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 4px solid #ffffff;
        background: ${background};
        color: ${color};
        box-shadow: ${boxShadow};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        transform: ${transform};
      ">H</div>
    `,
    anchor: new maps.Point(21, 21),
  };
}

function createCurrentLocationMarker(): NaverMapIcon {
  const maps = getNaverMaps();

  return {
    content: `
      <div style="
        width: 46px;
        height: 46px;
        border-radius: 999px;
        background: rgba(14, 165, 233, 0.18);
        padding: 5px;
        box-sizing: border-box;
      ">
        <div style="
          width: 100%;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          border: 3px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 16px 32px rgba(2, 132, 199, 0.28);
        "></div>
      </div>
    `,
    anchor: new maps.Point(23, 23),
  };
}

export function HomeMap({
  currentLocation,
  hospitals,
  markerReviewCounts,
  selectedHospitalId,
  onSelectHospital,
}: HomeMapProps) {
  const hasClientId = getNaverMapClientId() !== '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const markersRef = useRef(new Map<string, NaverMarkerInstance>());
  const locationMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const selectedHospitalIdRef = useRef(selectedHospitalId);
  const followCurrentLocationRef = useRef(true);
  const [phase, setPhase] = useState<MapPhase>(hasClientId ? 'loading' : 'missing-key');

  useEffect(() => {
    selectedHospitalIdRef.current = selectedHospitalId;

    if (selectedHospitalId) {
      followCurrentLocationRef.current = false;
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    if (!hasClientId) {
      return;
    }

    let cancelled = false;

    loadNaverMapSdk()
      .then((naver) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new naver.maps.Map(containerRef.current, {
            center: new naver.maps.LatLng(currentLocation.lat, currentLocation.lng),
            zoom: 15,
            minZoom: 12,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: false,
          });
        }

        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentLocation.lat, currentLocation.lng, hasClientId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !window.naver?.maps || phase !== 'ready') {
      return;
    }

    const maps = getNaverMaps();
    const currentLatLng = new maps.LatLng(currentLocation.lat, currentLocation.lng);

    if (!locationMarkerRef.current) {
      locationMarkerRef.current = new maps.Marker({
        map,
        position: currentLatLng,
        icon: createCurrentLocationMarker(),
        zIndex: 200,
      });
      return;
    }

    locationMarkerRef.current.setPosition(currentLatLng);
  }, [currentLocation.lat, currentLocation.lng, phase]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !window.naver?.maps || phase !== 'ready' || !selectedHospitalId) {
      return;
    }

    const maps = getNaverMaps();
    const selectedHospital = hospitals.find((hospital) => hospital.id === selectedHospitalId);

    if (!selectedHospital) {
      return;
    }

    map.setCenter(new maps.LatLng(selectedHospital.lat, selectedHospital.lng));
  }, [hospitals, phase, selectedHospitalId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !window.naver?.maps || phase !== 'ready' || selectedHospitalId || !followCurrentLocationRef.current) {
      return;
    }

    const maps = getNaverMaps();
    map.setCenter(new maps.LatLng(currentLocation.lat, currentLocation.lng));
  }, [currentLocation.lat, currentLocation.lng, phase, selectedHospitalId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !window.naver?.maps || phase !== 'ready') {
      return;
    }

    const maps = getNaverMaps();
    const visibleIds = new Set(hospitals.map((hospital) => hospital.id));

    markersRef.current.forEach((marker, hospitalId) => {
      if (!visibleIds.has(hospitalId)) {
        marker.setMap(null);
        markersRef.current.delete(hospitalId);
      }
    });

    hospitals.forEach((hospital) => {
      const active = hospital.id === selectedHospitalId;
      const reviewCount = markerReviewCounts[hospital.id] ?? 0;
      const position = new maps.LatLng(hospital.lat, hospital.lng);
      const existingMarker = markersRef.current.get(hospital.id);

      if (existingMarker) {
        existingMarker.setPosition(position);
        existingMarker.setIcon(createHospitalMarker(active, reviewCount));
        existingMarker.setMap(map);
        return;
      }

      const marker = new maps.Marker({
        map,
        position,
        title: hospital.name,
        icon: createHospitalMarker(active, reviewCount),
      });

      maps.Event.addListener(marker, 'click', () => {
        if (selectedHospitalIdRef.current === hospital.id) {
          onSelectHospital('');
          return;
        }

        followCurrentLocationRef.current = false;
        onSelectHospital(hospital.id);
      });

      markersRef.current.set(hospital.id, marker);
    });
  }, [hospitals, markerReviewCounts, onSelectHospital, phase, selectedHospitalId]);

  function handleRecenterToCurrentLocation() {
    const map = mapRef.current;

    if (!map || !window.naver?.maps || phase !== 'ready') {
      return;
    }

    const maps = getNaverMaps();
    map.setCenter(new maps.LatLng(currentLocation.lat, currentLocation.lng));
    followCurrentLocationRef.current = true;
    onSelectHospital('');
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(209,250,229,0.9),_rgba(236,253,245,0.75)_42%,_rgba(240,253,250,0.9)_100%)]">
      <div ref={containerRef} className="h-full w-full" />

      {phase === 'ready' ? (
        <button
          type="button"
          onClick={handleRecenterToCurrentLocation}
          className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-[0_14px_30px_rgba(15,118,110,0.18)] backdrop-blur"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </span>
          내 위치
        </button>
      ) : null}

      {phase !== 'ready' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/82 p-6 text-center">
          {phase === 'loading' ? (
            <div className="space-y-3">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-500" />
              <p className="text-sm font-medium text-slate-600">네이버 지도를 불러오는 중입니다.</p>
            </div>
          ) : null}

          {phase === 'missing-key' ? (
            <div className="max-w-xs space-y-3">
              <p className="text-sm font-semibold text-slate-800">
                `VITE_NAVER_MAP_CLIENT_ID`를 넣으면 여기에 실제 지도가 바로 나타납니다.
              </p>
              <p className="text-xs leading-5 text-slate-500">
                루트의 `.env` 파일에 네이버 클라우드에서 발급한 Client ID를 추가해 주세요.
              </p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="max-w-xs space-y-3">
              <p className="text-sm font-semibold text-slate-800">
                네이버 지도 SDK를 불러오지 못했습니다.
              </p>
              <p className="text-xs leading-5 text-slate-500">
                Client ID와 네이버 클라우드 콘솔의 Web 서비스 URL 등록값을 확인해 주세요.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
