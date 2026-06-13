import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useAuth } from './context/AuthContext';
import { useAppContext } from './context/AppContext';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { MyPetPage } from './pages/MyPetPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewsPage } from './pages/ReviewsPage';
import { LaunchPage } from './pages/LaunchPage';

const FORCE_AUTH_VIEW_KEY = 'exopet-force-auth-view';
const FORCE_AUTH_VIEW_EVENT = 'exopet-force-auth-view-change';
const NEW_ACCOUNT_WELCOME_EVENT = 'exopet-new-account-welcome';

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
  const { appReady, user } = useAppContext();
  const navigate = useNavigate();
  const previousSessionUserIdRef = useRef<string | null>(null);
  const [forceAuthView, setForceAuthView] = useState(() => {
    return getForceAuthView();
  });
  const [showNewAccountWelcome, setShowNewAccountWelcome] = useState(false);
  const isUserHydrated = !session || (appReady && user.id === session.user.id);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncForceAuthView = () => {
      setForceAuthView(getForceAuthView());
    };

    syncForceAuthView();
    window.addEventListener('focus', syncForceAuthView);
    window.addEventListener(FORCE_AUTH_VIEW_EVENT, syncForceAuthView);

    return () => {
      window.removeEventListener('focus', syncForceAuthView);
      window.removeEventListener(FORCE_AUTH_VIEW_EVENT, syncForceAuthView);
    };
  }, []);

  useEffect(() => {
    const showWelcome = () => {
      setShowNewAccountWelcome(true);
      navigate('/', { replace: true });
    };

    window.addEventListener(NEW_ACCOUNT_WELCOME_EVENT, showWelcome);
    return () => window.removeEventListener(NEW_ACCOUNT_WELCOME_EVENT, showWelcome);
  }, [navigate]);

  useEffect(() => {
    if (!session) {
      previousSessionUserIdRef.current = null;
      return;
    }

    if (!authReady || !isUserHydrated || passwordRecovery || loginIdRecoveryResult) {
      return;
    }

    if (previousSessionUserIdRef.current !== session.user.id) {
      previousSessionUserIdRef.current = session.user.id;
      navigate('/', { replace: true });
    }
  }, [authReady, isUserHydrated, loginIdRecoveryResult, navigate, passwordRecovery, session]);

  useEffect(() => {
    if (!showNewAccountWelcome || !session || !isUserHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowNewAccountWelcome(false);
      navigate('/', { replace: true });
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [isUserHydrated, navigate, session, showNewAccountWelcome]);

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

  if (showNewAccountWelcome) {
    return <LaunchPage mode="splash" onEnter={() => undefined} />;
  }

  return <AppRoutes />;
}
