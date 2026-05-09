import type { AnimalType, Hospital } from '../types';
import type { NaverGlobal } from './naverMaps';

export interface ExoticHospitalSearchItem {
  id: string;
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
  matchedAnimalTypes: AnimalType[];
  matchedQueries: string[];
}

const animalConfig: Record<
  AnimalType,
  {
    keywords: string[];
    label: string;
  }
> = {
  reptile: {
    keywords: ['파충류', '레오파드게코', '크레스티드게코', '비어디드래곤'],
    label: '파충류',
  },
  rodent: {
    keywords: ['설치류', '햄스터', '기니피그', '친칠라'],
    label: '설치류',
  },
  bird: {
    keywords: ['조류', '앵무새', '문조', '십자매'],
    label: '조류',
  },
};

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function buildRecentSpecies(item: ExoticHospitalSearchItem) {
  const text = `${item.title} ${item.description} ${item.category}`;
  const species = new Set<string>();

  item.matchedAnimalTypes.forEach((animalType) => {
    animalConfig[animalType].keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        species.add(keyword);
      }
    });
  });

  if (species.size === 0) {
    item.matchedAnimalTypes.forEach((animalType) => {
      species.add(animalConfig[animalType].label);
    });
  }

  return Array.from(species).slice(0, 3);
}

function buildHospitalNote(item: ExoticHospitalSearchItem) {
  const description = decodeHtml(item.description);
  const queryLabel = item.matchedQueries.join(', ');

  if (description) {
    return `${description} 검색어: ${queryLabel}`;
  }

  return `네이버 지역 검색 결과입니다. 검색어: ${queryLabel}`;
}

export function mapSearchItemsToHospitals(
  _naver: NaverGlobal,
  items: ExoticHospitalSearchItem[],
): Hospital[] {
  return items.map((item, index) => {
    const lng = Number(item.mapx) / 10000000;
    const lat = Number(item.mapy) / 10000000;

    console.log('원본 좌표:', item.title, item.mapx, item.mapy);
    console.log('최종 위경도:', item.title, lat, lng);

    return {
      id: item.id || `search-hospital-${index + 1}`,
      name: decodeHtml(item.title),
      address: decodeHtml(item.roadAddress || item.address),
      phone: decodeHtml(item.telephone) || '전화번호 정보 없음',
      hours: '운영시간 문의',
      breakTime: '정보 없음',
      lat,
      lng,
      mapX: Number(item.mapx),
      mapY: Number(item.mapy),
      recentSpecies: buildRecentSpecies(item),
      note: buildHospitalNote(item),
      liked: false,
      likedAt: null,
      supportedAnimals: item.matchedAnimalTypes,
      source: 'naver-search',
      link: item.link,
    };
  });
}