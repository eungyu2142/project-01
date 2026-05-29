import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useAuth } from './context/AuthContext';
import { useAppContext } from './context/AppContext';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { LaunchPage } from './pages/LaunchPage';
import { MyPetPage } from './pages/MyPetPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewsPage } from './pages/ReviewsPage';

const FORCE_AUTH_VIEW_KEY = 'exopet-force-auth-view';

function getForceAuthView() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(FORCE_AUTH_VIEW_KEY) === 'true';
}

function AppLayout() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="app-viewport h-[100dvh] overflow-hidden bg-[#e8f8f1] px-0 py-0 text-slate-800 sm:px-4 sm:py-6">
      <div className="app-shell relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white/70 shadow-[0_32px_80px_rgba(27,94,82,0.20)] backdrop-blur sm:h-[calc(100dvh-3rem)] sm:rounded-[2.5rem] sm:border sm:border-white/70">
        <main className={`app-main relative min-h-0 flex-1 ${isHomePage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const didResetInitialRouteRef = useRef(false);

  useEffect(() => {
    if (didResetInitialRouteRef.current) {
      return;
    }

    didResetInitialRouteRef.current = true;

    if (location.pathname !== '/' || location.search || location.hash) {
      navigate('/', { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/reviews/:reviewId" element={<ReviewsPage />} />
        <Route path="/mypets" element={<MyPetPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { authReady, loginIdRecoveryResult, passwordRecovery, session } = useAuth();
  const { appReady, markOnboardingComplete, user } = useAppContext();
  const [phase, setPhase] = useState<'splash' | 'welcome' | 'app'>('splash');
  const [forceAuthView, setForceAuthView] = useState(() => {
    return getForceAuthView();
  });
  const isUserHydrated = !session || (appReady && user.id === session.user.id);
  const previousSessionUserIdRef = useRef<string | null>(session?.user.id ?? null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncForceAuthView = () => {
      setForceAuthView(getForceAuthView());
    };

    syncForceAuthView();
    window.addEventListener('focus', syncForceAuthView);

    return () => window.removeEventListener('focus', syncForceAuthView);
  }, []);

  useEffect(() => {
    setForceAuthView(getForceAuthView());
  }, [session]);

  useEffect(() => {
    const currentSessionUserId = session?.user.id ?? null;
    const previousSessionUserId = previousSessionUserIdRef.current;

    if (!currentSessionUserId) {
      previousSessionUserIdRef.current = null;
      return;
    }

    if (forceAuthView || passwordRecovery || loginIdRecoveryResult) {
      previousSessionUserIdRef.current = currentSessionUserId;
      return;
    }

    if (previousSessionUserId !== currentSessionUserId) {
      setPhase('splash');
    }

    previousSessionUserIdRef.current = currentSessionUserId;
  }, [forceAuthView, loginIdRecoveryResult, passwordRecovery, session]);

  useEffect(() => {
    if (
      phase !== 'splash' ||
      !authReady ||
      !appReady ||
      !session ||
      forceAuthView ||
      passwordRecovery ||
      loginIdRecoveryResult
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPhase(user.onboardingCompletedAt ? 'app' : 'welcome');
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [appReady, authReady, forceAuthView, loginIdRecoveryResult, passwordRecovery, phase, session, user.onboardingCompletedAt]);

  useEffect(() => {
    if (
      phase === 'splash' ||
      !authReady ||
      !appReady ||
      !session ||
      forceAuthView ||
      passwordRecovery ||
      loginIdRecoveryResult
    ) {
      return;
    }

    const nextPhase = user.onboardingCompletedAt ? 'app' : 'welcome';

    if (phase !== nextPhase) {
      setPhase(nextPhase);
    }
  }, [
    appReady,
    authReady,
    forceAuthView,
    loginIdRecoveryResult,
    passwordRecovery,
    phase,
    session,
    user.onboardingCompletedAt,
  ]);

  function handleEnterApp() {
    markOnboardingComplete();
    setPhase('app');
  }

  if (!authReady || !isUserHydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-emerald-50 text-sm font-semibold text-emerald-700">
        로그인 상태 확인 중
      </div>
    );
  }

  if (loginIdRecoveryResult) {
    return <AuthPage />;
  }

  if (forceAuthView || !session) {
    return <AuthPage />;
  }

  if (passwordRecovery) {
    return <AuthPage />;
  }

  if (phase === 'splash') {
    return <LaunchPage mode="splash" onEnter={handleEnterApp} />;
  }

  if (phase === 'welcome') {
    return <LaunchPage mode="welcome" onEnter={handleEnterApp} />;
  }

  return <AppRoutes />;
}
