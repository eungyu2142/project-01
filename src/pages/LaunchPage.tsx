import { Icon } from '../components/Icon';

interface LaunchPageProps {
  mode: 'splash' | 'welcome';
  onEnter: () => void;
}

const features = [
  {
    title: '특수동물 병원 필터링',
    body: '필터링 기준: 해당 동물에 대한 리뷰가 0개면 흰색 H마커, 2개 이상이면 민트색 H마커, 4개 이상이면 파란색 H마커가 뜨게 했어요.',
  },
  {
    title: '리뷰와 마이펫 연결',
    body: '리뷰 작성과 진료 기록이 이어져서 한 번 입력한 정보를 다음 화면에서도 바로 이어서 사용할 수 있어요.',
  },
  {
    title: '좋아요와 기록 관리',
    body: '좋아요한 병원과 리뷰, 그리고 우리 아이 기록을 한 곳에서 모아볼 수 있어요.',
  },
];

export function LaunchPage({ mode, onEnter }: LaunchPageProps) {
  if (mode === 'splash') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#78e4c4_0%,_#15b981_45%,_#0f766e_100%)] px-6 text-white">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/16 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur">
            <Icon name="paw" className="h-12 w-12" />
          </div>
          <p className="mt-8 text-sm uppercase tracking-[0.35em] text-emerald-50/80">ExoPet</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">엑조펫</h1>
          <p className="mt-4 text-sm text-emerald-50/80">특수동물 병원 검색과 리뷰를 한곳에서</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#ecfff7_0%,_#c7f3e4_40%,_#f7fffb_100%)] px-5 pb-10 pt-[max(1.75rem,env(safe-area-inset-top))] text-slate-800">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/70 shadow-[0_30px_80px_rgba(16,185,129,0.18)] backdrop-blur">
        <div className="bg-[linear-gradient(160deg,_#19c59b_0%,_#0f9d83_100%)] px-6 pb-8 pt-8 text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white/15 backdrop-blur">
            <Icon name="paw" className="h-8 w-8" />
          </div>
          <p className="mt-6 text-sm uppercase tracking-[0.35em] text-emerald-50/80">ExoPet</p>
          <h1 className="mt-2 text-4xl font-semibold">엑조펫</h1>
          <p className="mt-4 text-sm leading-6 text-emerald-50/90">
            특수동물 병원을 찾고, 진료 리뷰를 남기고, 우리 아이 기록까지 이어서 관리해보세요.
          </p>
        </div>

        <div className="flex flex-1 flex-col px-6 py-6">
          <div className="space-y-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/70 p-4"
              >
                <p className="font-semibold text-slate-900">{feature.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.6rem] bg-[linear-gradient(135deg,_#f0fdf4,_#ecfeff)] p-4">
            <p className="text-sm font-medium text-emerald-800">시작 전에 이런 흐름으로 사용해요</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              앱에서 병원을 찾고, 리뷰를 남기고, 마이 펫 기록과 연결해서 진료 이력까지 함께 관리할 수 있어요.
            </p>
          </div>

          <button
            type="button"
            onClick={onEnter}
            className="mt-auto rounded-[1.6rem] bg-[linear-gradient(135deg,_#10b981,_#0f766e)] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)]"
          >
            엑조펫 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
