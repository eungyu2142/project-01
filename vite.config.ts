import { defineConfig, loadEnv, type Connect, type PreviewServer, type ViteDevServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

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

function getMatchedAnimalTypes(query: string) {
  if (query.includes('특수동물') || query.includes('이국동물')) {
    return [] as const;
  }

  const result = [
    ...(query.includes('파충류') ? (['reptile'] as const) : []),
    ...(query.includes('설치류') ? (['rodent'] as const) : []),
    ...(query.includes('조류') ? (['bird'] as const) : []),
  ];

  return result;
}

function getSearchQueries(query: string) {
  if (query.includes('파충류')) {
    return ['파충류 동물병원', '이국동물병원 파충류'];
  }

  if (query.includes('설치류')) {
    return ['설치류 동물병원', '햄스터 동물병원', '기니피그 동물병원'];
  }

  if (query.includes('조류')) {
    return ['조류 동물병원', '앵무새 동물병원'];
  }

  return ['특수동물병원', '이국동물병원', '파충류 동물병원', '설치류 동물병원', '조류 동물병원'];
}

function createExoticHospitalMiddleware(env: Record<string, string>): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/exotic-hospitals')) {
      next();
      return;
    }

    const clientId = env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          message:
            'NAVER_SEARCH_CLIENT_ID와 NAVER_SEARCH_CLIENT_SECRET을 .env에 넣어 주세요.',
        }),
      );
      return;
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const query = requestUrl.searchParams.get('q')?.trim() || '특수동물병원';
      const queries = getSearchQueries(query);

      const payloads = await Promise.all(
        queries.map(async (keyword) => {
          const searchUrl = new URL('https://openapi.naver.com/v1/search/local.json');
          searchUrl.searchParams.set('query', keyword);
          searchUrl.searchParams.set('display', '5');
          searchUrl.searchParams.set('start', '1');
          searchUrl.searchParams.set('sort', 'comment');

          const response = await fetch(searchUrl, {
            headers: {
              'X-Naver-Client-Id': clientId,
              'X-Naver-Client-Secret': clientSecret,
            },
          });

          const payload = (await response.json()) as {
            items?: Array<{
              title: string;
              link: string;
              category: string;
              description: string;
              telephone: string;
              address: string;
              roadAddress: string;
              mapx: string;
              mapy: string;
            }>;
            errorMessage?: string;
          };

          if (!response.ok) {
            throw new Error(payload.errorMessage || `NAVER local search failed with status ${response.status}.`);
          }

          return {
            keyword,
            items: payload.items ?? [],
            matchedAnimalTypes: getMatchedAnimalTypes(keyword),
          };
        }),
      );

      const deduped = new Map<
        string,
        {
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
          matchedAnimalTypes: string[];
          matchedQueries: string[];
        }
      >();

      payloads.forEach(({ keyword, items, matchedAnimalTypes }) => {
        items
          .map((item) => ({
            ...item,
            matchedQueries: [keyword],
            matchedAnimalTypes: [...matchedAnimalTypes],
          }))
          .forEach((item) => {
            const dedupeKey = `${decodeHtml(item.title)}::${decodeHtml(item.roadAddress || item.address)}`;
            const existing = deduped.get(dedupeKey);

            if (existing) {
              existing.matchedQueries = Array.from(new Set([...existing.matchedQueries, ...item.matchedQueries]));
              existing.matchedAnimalTypes = Array.from(
                new Set([...existing.matchedAnimalTypes, ...item.matchedAnimalTypes]),
              );
              return;
            }

            deduped.set(dedupeKey, {
              id: `naver-${item.mapx}-${item.mapy}`,
              title: item.title,
              link: item.link,
              category: item.category,
              description: item.description,
              telephone: item.telephone,
              address: item.address,
              roadAddress: item.roadAddress,
              mapx: item.mapx,
              mapy: item.mapy,
              matchedAnimalTypes: [...item.matchedAnimalTypes],
              matchedQueries: [...item.matchedQueries],
            });
          });
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ items: Array.from(deduped.values()) }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          message: error instanceof Error ? error.message : '특수동물병원 검색 중 오류가 발생했습니다.',
        }),
      );
    }
  };
}

function attachMiddleware(server: ViteDevServer | PreviewServer, env: Record<string, string>) {
  server.middlewares.use(createExoticHospitalMiddleware(env));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'naver-local-search-api',
        configureServer(server) {
          attachMiddleware(server, env);
        },
        configurePreviewServer(server) {
          attachMiddleware(server, env);
        },
      },
    ],
  };
});
