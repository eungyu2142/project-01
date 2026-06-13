/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  checkLoginIdAvailability,
  deleteAccountRemote,
  findEmailByLoginId,
  loadUserProfile,
} from '../lib/supabaseAppStore';

interface AuthContextValue {
  authReady: boolean;
  session: Session | null;
  authUser: User | null;
  passwordRecovery: boolean;
  loginIdRecoveryResult: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    nickname: string,
    loginId: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  sendLoginIdRecoveryLink: (email: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearPasswordRecovery: () => Promise<void>;
  clearLoginIdRecovery: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const FORCE_AUTH_VIEW_KEY = 'exopet-force-auth-view';
const FORCE_AUTH_VIEW_EVENT = 'exopet-force-auth-view-change';
const NEW_ACCOUNT_WELCOME_EVENT = 'exopet-new-account-welcome';

function hasRecoveryParams() {
  if (typeof window === 'undefined') {
    return false;
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
}

function getAuthCodeFromUrl() {
  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('code');
}

function hasLoginIdRecoveryParams() {
  if (typeof window === 'undefined') {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('flow') === 'login-id-recovery';
}

function clearRecoveryUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

function setForceAuthView(enabled: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  if (enabled) {
    window.sessionStorage.setItem(FORCE_AUTH_VIEW_KEY, 'true');
  } else {
    window.sessionStorage.removeItem(FORCE_AUTH_VIEW_KEY);
  }

  window.dispatchEvent(new Event(FORCE_AUTH_VIEW_EVENT));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => isSupabaseConfigured && hasRecoveryParams(),
  );
  const [loginIdRecoveryResult, setLoginIdRecoveryResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const authClient = supabase;
    let mounted = true;

    async function initializeAuth() {
      const authCode = getAuthCodeFromUrl();

      if (authCode) {
        const { error } = await authClient.auth.exchangeCodeForSession(authCode);

        if (error) {
          console.error('[AuthContext:exchangeCodeForSession]', error);
        }
      }

      const { data } = await authClient.auth.getSession();

      if (!mounted) {
        return;
      }

      setSession(data.session);
      setPasswordRecovery(hasRecoveryParams());

      if (hasLoginIdRecoveryParams() && data.session?.user) {
        const profile = await loadUserProfile(data.session.user.id);
        const recoveredLoginId =
          profile?.loginId ??
          (typeof data.session.user.user_metadata.login_id === 'string'
            ? data.session.user.user_metadata.login_id
            : null);
        setLoginIdRecoveryResult(recoveredLoginId);
        setForceAuthView(true);
      } else {
        setLoginIdRecoveryResult(null);
      }

      setAuthReady(true);
    }

    void initializeAuth();

    const { data: listener } = authClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        setLoginIdRecoveryResult(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
      session,
      authUser: session?.user ?? null,
      passwordRecovery,
      loginIdRecoveryResult,
      async signIn(identifier, password) {
        if (!supabase) {
          throw new Error('Supabase 환경변수가 아직 연결되지 않았어요.');
        }

        const normalizedIdentifier = identifier.trim();
        const email = normalizedIdentifier.includes('@')
          ? normalizedIdentifier
          : await findEmailByLoginId(normalizedIdentifier);

        if (!email) {
          throw new Error('등록되지 않은 아이디 또는 이메일이에요.');
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setForceAuthView(false);
        setLoginIdRecoveryResult(null);
      },
      async signUp(email, password, nickname, loginId) {
        if (!supabase) {
          throw new Error('Supabase 환경변수가 아직 연결되지 않았어요.');
        }

        const available = await checkLoginIdAvailability(loginId);
        if (!available) {
          throw new Error('이미 사용 중인 아이디예요.');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              login_id: loginId,
              nickname,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session && typeof window !== 'undefined') {
          window.dispatchEvent(new Event(NEW_ACCOUNT_WELCOME_EVENT));
        }

        setForceAuthView(false);
        setLoginIdRecoveryResult(null);

        return {
          requiresEmailConfirmation: !data.session,
        };
      },
      async sendLoginIdRecoveryLink(email) {
        if (!supabase) {
          throw new Error('Supabase 환경변수가 아직 연결되지 않았어요.');
        }

        const emailRedirectTo =
          typeof window === 'undefined'
            ? undefined
            : `${window.location.origin}${window.location.pathname}?flow=login-id-recovery`;

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
            shouldCreateUser: false,
          },
        });

        if (error) {
          throw error;
        }
      },
      async sendPasswordResetEmail(email) {
        if (!supabase) {
          throw new Error('Supabase 환경변수가 아직 연결되지 않았어요.');
        }

        const redirectTo =
          typeof window === 'undefined'
            ? undefined
            : `${window.location.origin}${window.location.pathname}?type=recovery`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

        if (error) {
          throw error;
        }
      },
      async updatePassword(password) {
        if (!supabase) {
          throw new Error('Supabase 환경변수가 아직 연결되지 않았어요.');
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('비밀번호 재설정 링크가 만료되었거나 잘못되었어요. 메일에서 다시 열어주세요.');
        }

        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) {
          throw error;
        }

        await supabase.auth.signOut();
        setForceAuthView(true);
        clearRecoveryUrl();
        setSession(null);
        setPasswordRecovery(false);
      },
      async clearPasswordRecovery() {
        if (supabase) {
          await supabase.auth.signOut();
        }

        setForceAuthView(true);
        clearRecoveryUrl();
        setSession(null);
        setPasswordRecovery(false);
      },
      async clearLoginIdRecovery() {
        if (supabase) {
          await supabase.auth.signOut();
        }

        clearRecoveryUrl();
        setForceAuthView(true);
        setSession(null);
        setLoginIdRecoveryResult(null);
      },
      async signOut() {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
          throw error;
        }

        setForceAuthView(true);
        setSession(null);
        setPasswordRecovery(false);
        setLoginIdRecoveryResult(null);
      },
      async deleteAccount() {
        if (!supabase) {
          throw new Error('Supabase 연결 정보가 아직 설정되지 않았어요.');
        }

        await deleteAccountRemote();
        await supabase.auth.signOut().catch(() => undefined);

        setForceAuthView(true);
        setSession(null);
        setPasswordRecovery(false);
        setLoginIdRecoveryResult(null);
      },
    }),
    [authReady, loginIdRecoveryResult, passwordRecovery, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
