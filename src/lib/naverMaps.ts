export interface NaverPointLike {
  x: number;
  y: number;
}

export interface NaverLatLngLike extends NaverPointLike {
  lat(): number;
  lng(): number;
}

export interface NaverMapIcon {
  content: string;
  anchor: NaverPointLike;
}

export interface NaverMapOptions {
  center: NaverLatLngLike;
  zoom: number;
  minZoom: number;
  scaleControl: boolean;
  logoControl: boolean;
  mapDataControl: boolean;
  zoomControl: boolean;
}

export interface NaverMapInstance {
  setCenter(position: NaverLatLngLike): void;
}

export interface NaverMapEventListener {
  remove(): void;
}

export interface NaverMarkerOptions {
  map: NaverMapInstance;
  position: NaverLatLngLike;
  title?: string;
  icon: NaverMapIcon;
  zIndex?: number;
}

export interface NaverMarkerInstance {
  setPosition(position: NaverLatLngLike): void;
  setIcon(icon: NaverMapIcon): void;
  setMap(map: NaverMapInstance | null): void;
}

export interface NaverReverseGeocodeArea {
  name?: string;
}

export interface NaverReverseGeocodeResult {
  region?: {
    area1?: NaverReverseGeocodeArea;
    area2?: NaverReverseGeocodeArea;
    area3?: NaverReverseGeocodeArea;
  };
}

export interface NaverReverseGeocodeResponse {
  v2?: {
    results?: NaverReverseGeocodeResult[];
  };
}

export interface NaverMapsNamespace {
  Point: new (x: number, y: number) => NaverPointLike;
  LatLng: new (lat: number, lng: number) => NaverLatLngLike;
  Map: new (container: HTMLElement, options: NaverMapOptions) => NaverMapInstance;
  Marker: new (options: NaverMarkerOptions) => NaverMarkerInstance;
  Event: {
    addListener(
      target: NaverMarkerInstance | NaverMapInstance,
      eventName: string,
      handler: () => void,
    ): NaverMapEventListener;
    removeListener(listener: NaverMapEventListener): void;
  };
  TransCoord: {
    fromTM128ToLatLng(coord: NaverPointLike): NaverLatLngLike;
  };
  Service: {
    Status: {
      OK: string;
    };
    OrderType: {
      ADDR: string;
      ROAD_ADDR: string;
    };
    reverseGeocode(
      options: {
        coords: NaverLatLngLike;
        orders?: string;
      },
      callback: (status: string, response: NaverReverseGeocodeResponse) => void,
    ): void;
  };
}

export interface NaverGlobal {
  maps: NaverMapsNamespace;
}

const NAVER_MAP_SCRIPT_ID = 'naver-map-sdk';

let naverMapPromise: Promise<NaverGlobal> | null = null;

export function getNaverMapClientId() {
  return import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? '';
}

export function loadNaverMapSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('NAVER Maps SDK can only be loaded in the browser.'));
  }

  if (window.naver?.maps) {
    return Promise.resolve(window.naver);
  }

  const clientId = getNaverMapClientId();

  if (!clientId) {
    return Promise.reject(new Error('VITE_NAVER_MAP_CLIENT_ID is missing.'));
  }

  if (naverMapPromise) {
    return naverMapPromise;
  }

  naverMapPromise = new Promise<NaverGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(NAVER_MAP_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.naver as NaverGlobal), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load NAVER Maps SDK.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.onload = () => resolve(window.naver as NaverGlobal);
    script.onerror = () => reject(new Error('Failed to load NAVER Maps SDK.'));
    document.head.append(script);
  }).catch((error) => {
    naverMapPromise = null;
    throw error;
  });

  return naverMapPromise;
}
