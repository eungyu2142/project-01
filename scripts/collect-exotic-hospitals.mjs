import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPublicHospitalCandidates } from './data-source-public.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const outputDir = path.join(rootDir, 'public', 'data');

const QUERY_CONFIGS = [
  { suffix: '특수동물병원', animals: [], classification: 'candidate' },
  { suffix: '이국동물병원', animals: [], classification: 'candidate' },
  { suffix: '파충류 동물병원', animals: ['reptile'], classification: 'confirmed' },
  { suffix: '조류 동물병원', animals: ['bird'], classification: 'confirmed' },
  { suffix: '설치류 동물병원', animals: ['rodent'], classification: 'confirmed' },
  { suffix: '토끼 동물병원', animals: ['rodent'], classification: 'confirmed' },
  { suffix: '햄스터 동물병원', animals: ['rodent'], classification: 'confirmed' },
  { suffix: '페럿 동물병원', animals: ['rodent'], classification: 'confirmed' },
];

function decodeHtml(value = '') {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeText(value = '') {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\],./-]/g, '');
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueSources(values) {
  const deduped = new Map();

  values.forEach((value) => {
    if (!value?.provider || !value?.label) {
      return;
    }

    deduped.set(`${value.provider}:${value.label}`, value);
  });

  return Array.from(deduped.values());
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toRecentSpecies(animals) {
  return animals.map((animal) => {
    if (animal === 'reptile') {
      return '파충류';
    }

    if (animal === 'rodent') {
      return '설치류';
    }

    return '조류';
  });
}

function parseEnv(text) {
  return text.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    acc[key] = value;
    return acc;
  }, {});
}

async function loadEnvironment() {
  const envPath = path.join(rootDir, '.env');
  let fileEnv = {};

  try {
    fileEnv = parseEnv(await fs.readFile(envPath, 'utf8'));
  } catch {
    fileEnv = {};
  }

  return {
    ...fileEnv,
    ...process.env,
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function flattenRegions(regionMap) {
  return Object.entries(regionMap).flatMap(([sido, sigunguList]) =>
    sigunguList.map((sigungu) => (sigungu === sido ? sigungu : `${sido} ${sigungu}`)),
  );
}

function buildHospitalRecord(item, context) {
  const title = decodeHtml(item.title);
  const address = decodeHtml(item.roadAddress || item.address);
  const supportedAnimals = uniqueStrings(context.animals);
  const recentSpecies = toRecentSpecies(supportedAnimals);

  return {
    id: `dataset-${item.mapx || '0'}-${item.mapy || '0'}-${normalizeText(title)}`,
    name: title,
    address,
    phone: decodeHtml(item.telephone) || '전화번호 정보 없음',
    hours: '운영시간 문의',
    breakTime: '정보 없음',
    lat: Number(item.mapy || 0) / 10000000,
    lng: Number(item.mapx || 0) / 10000000,
    mapX: Number(item.mapx || 0),
    mapY: Number(item.mapy || 0),
    recentSpecies,
    note: decodeHtml(item.description) || `네이버 지역 검색 결과 (${context.query})`,
    liked: false,
    likedAt: null,
    supportedAnimals,
    source: 'dataset',
    classification: context.classification,
    matchedQueries: [context.query],
    evidence: [`네이버 지역 검색: ${context.query}`],
    sources: [{ provider: 'naver', label: context.query }],
    lastCollectedAt: context.collectedAt,
    link: item.link || '',
  };
}

function mergeHospital(existing, incoming) {
  const supportedAnimals = uniqueStrings([
    ...(existing.supportedAnimals ?? []),
    ...(incoming.supportedAnimals ?? []),
  ]);
  const matchedQueries = uniqueStrings([
    ...(existing.matchedQueries ?? []),
    ...(incoming.matchedQueries ?? []),
  ]);
  const evidence = uniqueStrings([...(existing.evidence ?? []), ...(incoming.evidence ?? [])]);
  const sources = uniqueSources([...(existing.sources ?? []), ...(incoming.sources ?? [])]);
  const recentSpecies = uniqueStrings([...(existing.recentSpecies ?? []), ...(incoming.recentSpecies ?? [])]);
  const classification =
    existing.classification === 'confirmed' ||
    incoming.classification === 'confirmed' ||
    supportedAnimals.length > 0 ||
    matchedQueries.length > 1
      ? 'confirmed'
      : 'candidate';

  return {
    ...existing,
    ...incoming,
    phone:
      incoming.phone && incoming.phone !== '전화번호 정보 없음'
        ? incoming.phone
        : existing.phone,
    note: existing.note || incoming.note,
    recentSpecies,
    supportedAnimals,
    matchedQueries,
    evidence,
    sources,
    classification,
    lastCollectedAt: incoming.lastCollectedAt || existing.lastCollectedAt,
    liked: existing.liked ?? incoming.liked,
    likedAt: existing.likedAt ?? incoming.likedAt,
  };
}

function getHospitalKey(hospital) {
  return `${normalizeText(hospital.name)}::${normalizeText(hospital.address)}`;
}

async function fetchNaverLocalSearch({ clientId, clientSecret, query, retries = 4 }) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json');
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('display', '5');
    searchUrl.searchParams.set('start', '1');
    searchUrl.searchParams.set('sort', 'comment');

    const response = await fetch(searchUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    const payload = await response.json();

    if (response.ok) {
      return payload.items ?? [];
    }

    const message = payload.errorMessage || `NAVER local search failed for "${query}".`;
    const isRateLimited = response.status === 429 || message.includes('속도 제한');

    if (isRateLimited && attempt < retries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }

    throw new Error(message);
  }

  return [];
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let currentIndex = 0;

  async function runWorker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

function applyManualOverrides(hospitals, overrides, collectedAt) {
  return hospitals.map((hospital) => {
    const matchedOverrides = overrides.filter((override) => {
      const sameName = normalizeText(hospital.name) === normalizeText(override.match?.name ?? '');
      const hasAddressRule = Boolean(override.match?.address);

      if (!sameName) {
        return false;
      }

      if (!hasAddressRule) {
        return true;
      }

      return normalizeText(hospital.address).includes(normalizeText(override.match.address));
    });

    if (matchedOverrides.length === 0) {
      return hospital;
    }

    return matchedOverrides.reduce((current, override) => {
      const patch = override.patch ?? {};
      const supportedAnimals = uniqueStrings([
        ...(current.supportedAnimals ?? []),
        ...(patch.supportedAnimals ?? []),
      ]);

      return {
        ...current,
        classification: patch.classification ?? 'confirmed',
        supportedAnimals,
        evidence: uniqueStrings([...(current.evidence ?? []), ...(patch.evidence ?? [])]),
        sources: uniqueSources([
          ...(current.sources ?? []),
          ...(patch.sources ?? []),
          { provider: 'manual', label: '운영자 수동 오버라이드' },
        ]),
        lastCollectedAt: collectedAt,
      };
    }, hospital);
  });
}

async function collectManualLookupHospitals({ clientId, clientSecret, overrides, collectedAt, deduped }) {
  for (const override of overrides) {
    const name = override.match?.name?.trim();

    if (!name) {
      continue;
    }

    const items = await fetchNaverLocalSearch({
      clientId,
      clientSecret,
      query: name,
    });

    items.forEach((item) => {
      const hospital = buildHospitalRecord(item, {
        query: name,
        animals: override.patch?.supportedAnimals ?? [],
        classification: override.patch?.classification ?? 'candidate',
        collectedAt,
      });
      const key = getHospitalKey(hospital);
      const existing = deduped.get(key);

      if (existing) {
        deduped.set(key, mergeHospital(existing, hospital));
        return;
      }

      deduped.set(key, hospital);
    });
  }
}

async function main() {
  const env = await loadEnvironment();
  const clientId = env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET;
  const concurrency = Math.max(1, Number(env.NAVER_SEARCH_CONCURRENCY ?? 1));
  const delayMs = Math.max(0, Number(env.NAVER_SEARCH_DELAY_MS ?? 250));

  if (!clientId || !clientSecret) {
    throw new Error('NAVER_SEARCH_CLIENT_ID and NAVER_SEARCH_CLIENT_SECRET are required.');
  }

  const regionMap = await readJson(path.join(dataDir, 'korea-sigungu.json'));
  const overrides = await readJson(path.join(dataDir, 'manual-hospital-overrides.json'));
  const regions = flattenRegions(regionMap);
  const collectedAt = new Date().toISOString();
  const overflowQueries = [];
  const warnings = [];
  const deduped = new Map();

  const publicData = await collectPublicHospitalCandidates({
    serviceKey: env.PUBLIC_DATA_SERVICE_KEY,
  });

  warnings.push(...(publicData.warnings ?? []));

  const jobs = regions.flatMap((region) =>
    QUERY_CONFIGS.map((config) => ({
      region,
      config,
      query: `${region} ${config.suffix}`,
    })),
  );

  console.log(`Collecting ${jobs.length} Naver local search queries across ${regions.length} regions...`);

  await mapWithConcurrency(jobs, concurrency, async (job, index) => {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const items = await fetchNaverLocalSearch({
        clientId,
        clientSecret,
        query: job.query,
      });

      if (items.length === 5) {
        overflowQueries.push({
          region: job.region,
          query: job.query,
          count: items.length,
        });
      }

      items.forEach((item) => {
        const hospital = buildHospitalRecord(item, {
          query: job.query,
          animals: job.config.animals,
          classification: job.config.classification,
          collectedAt,
        });
        const key = getHospitalKey(hospital);
        const existing = deduped.get(key);

        if (existing) {
          deduped.set(key, mergeHospital(existing, hospital));
          return;
        }

        deduped.set(key, hospital);
      });

      if ((index + 1) % 50 === 0) {
        console.log(`Processed ${index + 1} / ${jobs.length} queries...`);
      }
    } catch (error) {
      warnings.push(`Skipped query "${job.query}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  await collectManualLookupHospitals({
    clientId,
    clientSecret,
    overrides,
    collectedAt,
    deduped,
  });

  const hospitals = applyManualOverrides(Array.from(deduped.values()), overrides, collectedAt)
    .map((hospital) => ({
      ...hospital,
      classification:
        hospital.classification === 'confirmed' ||
        (hospital.supportedAnimals?.length ?? 0) > 0 ||
        (hospital.matchedQueries?.length ?? 0) > 1
          ? 'confirmed'
          : 'candidate',
    }))
    .sort((left, right) => {
      const nameCompare = left.name.localeCompare(right.name, 'ko');

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return left.address.localeCompare(right.address, 'ko');
    });

  const meta = {
    collectedAt,
    totalHospitals: hospitals.length,
    classificationCounts: {
      confirmed: hospitals.filter((hospital) => hospital.classification === 'confirmed').length,
      candidate: hospitals.filter((hospital) => hospital.classification === 'candidate').length,
    },
    overflowQueries,
    warnings: uniqueStrings(warnings),
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'exotic-hospitals.json'),
    JSON.stringify({ items: hospitals }, null, 2),
    'utf8',
  );
  await fs.writeFile(
    path.join(outputDir, 'exotic-hospitals.meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8',
  );

  console.log(`Saved ${hospitals.length} hospitals to public/data/exotic-hospitals.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
