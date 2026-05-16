import { loadNaverMapSdk } from './naverMaps';
import type { NaverGlobal, NaverReverseGeocodeResponse } from './naverMaps';

export const GEOLOCATION_LOADING_MESSAGE =
  '\uD604\uC7AC \uC704\uCE58 \uD655\uC778 \uC911';
export const GEOLOCATION_ERROR_MESSAGE =
  '\uD604\uC7AC \uC704\uCE58\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694';
export const GEOLOCATION_PERMISSION_MESSAGE =
  '\uC704\uCE58 \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD558\uBA74 \uD604\uC7AC \uC704\uCE58\uAC00 \uBCF4\uC5EC\uC694';

function getCurrentRegionLabel(response: NaverReverseGeocodeResponse) {
  const region = response.v2?.results?.[0]?.region;
  const area1 = region?.area1?.name;
  const area2 = region?.area2?.name;
  const area3 = region?.area3?.name;

  return [area2, area3].filter(Boolean).join(' ') || [area1, area2].filter(Boolean).join(' ');
}

export function reverseGeocodeCurrentRegion(naver: NaverGlobal, lat: number, lng: number) {
  return new Promise<string>((resolve, reject) => {
    const coords = new naver.maps.LatLng(lat, lng);
    const orders = [naver.maps.Service.OrderType.ADDR, naver.maps.Service.OrderType.ROAD_ADDR].join(',');

    naver.maps.Service.reverseGeocode({ coords, orders }, (status, response) => {
      if (status !== naver.maps.Service.Status.OK) {
        reject(new Error(GEOLOCATION_ERROR_MESSAGE));
        return;
      }

      const regionLabel = getCurrentRegionLabel(response);

      if (!regionLabel) {
        reject(new Error(GEOLOCATION_ERROR_MESSAGE));
        return;
      }

      resolve(regionLabel);
    });
  });
}

export async function resolveCurrentRegion(lat: number, lng: number) {
  const naver = await loadNaverMapSdk();
  return reverseGeocodeCurrentRegion(naver, lat, lng);
}
