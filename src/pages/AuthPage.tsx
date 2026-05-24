import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { checkLoginIdAvailability } from '../lib/supabaseAppStore';

function getRateLimitMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return '요청을 처리하지 못했어요.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('after') && message.includes('seconds')) {
    const seconds = error.message.match(/\d+/)?.[0];
    return seconds
      ? `보안을 위해 ${seconds}초 후 다시 시도해주세요.`
      : '보안을 위해 잠시 후 다시 시도해주세요.';
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해주세요. 비밀번호 재설정 메일은 재전송 제한이 있습니다.';
  }

  if (message.includes('supabase') && message.includes('환경')) {
    return 'Supabase 연결 정보가 아직 설정되지 않았어요.';
  }

  if (message.includes('invalid email')) {
    return '이메일 형식을 다시 확인해주세요.';
  }

  return null;
}

function getAuthErrorMessage(error: unknown, mode: 'signin' | 'signup') {
  const normalized = getRateLimitMessage(error);
  if (normalized) {
    return normalized;
  }

  if (!(error instanceof Error)) {
    return '요청을 처리하지 못했어요.';
  }

  const message = error.message.toLowerCase();

  if (mode === 'signin' && message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 맞지 않아요.';
  }

  if (mode === 'signin' && message.includes('등록되지 않은 아이디 또는 이메일')) {
    return '등록되지 않은 아이디 또는 이메일이에요.';
  }

  if (
    mode === 'signin' &&
    (message.includes('email not confirmed') ||
      message.includes('email not verified') ||
      message.includes('signup requires email verification'))
  ) {
    return '이메일 인증이 아직 완료되지 않았어요. 받은 메일에서 인증 링크를 누른 뒤 로그인해주세요.';
  }

  if (message.includes('password should be at least')) {
    return '비밀번호는 최소 6자 이상이어야 해요.';
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return '이미 회원가입이 완료된 이메일이에요. 로그인으로 진행해주세요.';
  }

  if (message.includes('signup disabled')) {
    return '현재 회원가입이 비활성화되어 있어요. 잠시 후 다시 시도해주세요.';
  }

  if (message.includes('이미 사용 중인 아이디')) {
    return '이미 사용 중인 아이디예요. 다른 아이디로 다시 시도해주세요.';
  }

  return '요청을 처리하지 못했어요. 입력값을 확인한 뒤 다시 시도해주세요.';
}

function getPasswordResetErrorMessage(error: unknown) {
  const normalized = getRateLimitMessage(error);
  if (normalized) {
    return normalized;
  }

  if (!(error instanceof Error)) {
    return '비밀번호를 변경하지 못했어요.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('password should be at least')) {
    return '새 비밀번호는 최소 6자 이상이어야 해요.';
  }

  if (message.includes('same password')) {
    return '기존과 다른 비밀번호를 입력해주세요.';
  }

  if (message.includes('expired') || message.includes('invalid') || message.includes('잘못')) {
    return '비밀번호 재설정 링크가 만료되었거나 잘못되었어요. 메일에서 링크를 다시 열어주세요.';
  }

  return error.message || '비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해주세요.';
}

export function AuthPage() {
  const { clearPasswordRecovery, passwordRecovery, signIn, signUp, updatePassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [loginId, setLoginId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [loginIdChecked, setLoginIdChecked] = useState(false);
  const [loginIdAvailable, setLoginIdAvailable] = useState(false);
  const [loginIdCheckMessage, setLoginIdCheckMessage] = useState('');
  const [loginIdChecking, setLoginIdChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showNextPasswordConfirm, setShowNextPasswordConfirm] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState('');
  const [passwordResetSubmitting, setPasswordResetSubmitting] = useState(false);

  async function handleLoginIdCheck() {
    const normalizedLoginId = loginId.trim();
    setLoginIdCheckMessage('');

    if (!normalizedLoginId) {
      setLoginIdChecked(false);
      setLoginIdAvailable(false);
      setLoginIdCheckMessage('아이디를 먼저 입력해주세요.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{4,20}$/.test(normalizedLoginId)) {
      setLoginIdChecked(false);
      setLoginIdAvailable(false);
      setLoginIdCheckMessage('아이디는 4~20자의 영문, 숫자, `_`만 사용할 수 있어요.');
      return;
    }

    setLoginIdChecking(true);

    try {
      const available = await checkLoginIdAvailability(normalizedLoginId);
      setLoginIdChecked(true);
      setLoginIdAvailable(available);
      setLoginIdCheckMessage(
        available
          ? '사용 가능한 아이디예요.'
          : '이미 사용 중인 아이디예요. 다른 아이디를 입력해주세요.',
      );
    } catch {
      setLoginIdChecked(false);
      setLoginIdAvailable(false);
      setLoginIdCheckMessage('아이디 중복 확인에 실패했어요. 다른 아이디를 입력해주세요.');
    } finally {
      setLoginIdChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!identifier.trim() || !password.trim() || (mode === 'signup' && (!nickname.trim() || !loginId.trim()))) {
      setMessage('필수 항목을 입력해주세요.');
      return;
    }

    if (mode === 'signup' && !/^[a-zA-Z0-9_]{4,20}$/.test(loginId.trim())) {
      setMessage('아이디는 4~20자의 영문, 숫자, `_`만 사용할 수 있어요.');
      return;
    }

    if (mode === 'signup' && (!loginIdChecked || !loginIdAvailable)) {
      setMessage('아이디 중복 확인을 완료해주세요.');
      return;
    }

    if (mode === 'signup' && password !== passwordConfirm) {
      setMessage('비밀번호가 서로 같지 않아요.');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'signup') {
        const result = await signUp(identifier.trim(), password, nickname.trim(), loginId.trim());

        if (result.requiresEmailConfirmation) {
          setMode('signin');
          setPassword('');
          setPasswordConfirm('');
          setShowPassword(false);
          setShowPasswordConfirm(false);
          setMessage('회원가입이 완료됐어요. 받은 메일에서 이메일 인증을 완료한 뒤 로그인해주세요.');
        } else {
          setMessage('회원가입이 완료됐어요.');
        }
      } else {
        await signIn(identifier.trim(), password);
      }
    } catch (error) {
      setMessage(getAuthErrorMessage(error, mode));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordResetMessage('');

    if (!nextPassword.trim() || !nextPasswordConfirm.trim()) {
      setPasswordResetMessage('새 비밀번호와 확인 값을 모두 입력해주세요.');
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setPasswordResetMessage('새 비밀번호가 서로 같지 않아요.');
      return;
    }

    setPasswordResetSubmitting(true);

    try {
      await updatePassword(nextPassword);
    } catch (error) {
      setPasswordResetMessage(getPasswordResetErrorMessage(error));
    } finally {
      setPasswordResetSubmitting(false);
    }
  }

  if (passwordRecovery) {
    return (
      <main className="min-h-[100dvh] bg-[#e8f8f1] px-5 py-8 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
          <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,118,110,0.16)] backdrop-blur">
            <div>
              <p className="text-sm font-semibold text-emerald-700">엑조펫 계정 복구</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">새 비밀번호 설정</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                메일에서 연 복구 링크를 확인했어요. 새 비밀번호를 저장하면 바로 앱으로 돌아가요.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handlePasswordResetSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">새 비밀번호</span>
                <div className="relative">
                  <input
                    name="reset-new-password"
                    type={showNextPassword ? 'text' : 'password'}
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 pr-12 text-slate-800"
                    placeholder="6자 이상"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNextPassword((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-500"
                    aria-label={showNextPassword ? '새 비밀번호 숨기기' : '새 비밀번호 보기'}
                  >
                    <Icon name={showNextPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">새 비밀번호 확인</span>
                <div className="relative">
                  <input
                    name="reset-new-password-confirm"
                    type={showNextPasswordConfirm ? 'text' : 'password'}
                    value={nextPasswordConfirm}
                    onChange={(event) => setNextPasswordConfirm(event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 pr-12 text-slate-800"
                    placeholder="비밀번호 다시 입력"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNextPasswordConfirm((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-500"
                    aria-label={showNextPasswordConfirm ? '새 비밀번호 확인 숨기기' : '새 비밀번호 확인 보기'}
                  >
                    <Icon name={showNextPasswordConfirm ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
              </label>

              {passwordResetMessage ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  {passwordResetMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={passwordResetSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                <Icon name="check" className="h-5 w-5" />
                {passwordResetSubmitting ? '변경 중' : '새 비밀번호 저장'}
              </button>
            </form>

            <button
              type="button"
              onClick={clearPasswordRecovery}
              className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              나중에 변경하기
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#e8f8f1] px-5 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,118,110,0.16)] backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-emerald-700">엑조펫</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">
              {mode === 'signin' ? '로그인' : '회원가입'}
            </h1>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete={mode === 'signup' ? 'off' : 'on'}>
            {mode === 'signup' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">아이디</span>
                <div className="flex gap-2">
                  <input
                    name="signup-login-id"
                    value={loginId}
                    onChange={(event) => {
                      setLoginId(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
                      setLoginIdChecked(false);
                      setLoginIdAvailable(false);
                      setLoginIdCheckMessage('');
                    }}
                    className="min-w-0 flex-1 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-slate-800"
                    placeholder="dimi_go"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLoginIdCheck()}
                    disabled={loginIdChecking}
                    className="shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {loginIdChecking ? '확인 중' : '중복 확인'}
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  영문, 숫자, `_`만, 4~20자까지 입력할 수 있어요.
                </span>
                {loginIdCheckMessage ? (
                  <span
                    className={`text-xs font-medium ${
                      loginIdChecked && loginIdAvailable ? 'text-emerald-700' : 'text-rose-500'
                    }`}
                  >
                    {loginIdCheckMessage}
                  </span>
                ) : null}
              </label>
            ) : null}

            {mode === 'signup' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">닉네임</span>
                <input
                  name="signup-nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-slate-800"
                  placeholder="고디미"
                  autoComplete="nickname"
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {mode === 'signin' ? '이메일 또는 아이디' : '이메일'}
              </span>
              <input
                name={mode === 'signin' ? 'username' : 'signup-email'}
                type={mode === 'signin' ? 'text' : 'email'}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-slate-800"
                placeholder={mode === 'signin' ? 'dimigo@gmail.com 또는 dimi_go' : 'dimigo@gmail.com'}
                autoComplete={mode === 'signin' ? 'username' : 'email'}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">비밀번호</span>
              <div className="relative">
                <input
                  name={mode === 'signin' ? 'current-password' : 'new-password'}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 pr-12 text-slate-800"
                  placeholder="6자 이상"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-500"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                </button>
              </div>
            </label>

            {mode === 'signup' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">비밀번호 확인</span>
                <div className="relative">
                  <input
                    name="new-password-confirm"
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 pr-12 text-slate-800"
                    placeholder="비밀번호 다시 입력"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-500"
                    aria-label={showPasswordConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'}
                  >
                    <Icon name={showPasswordConfirm ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
              </label>
            ) : null}

            {message ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              <Icon name="check" className="h-5 w-5" />
              {submitting ? '처리 중' : mode === 'signin' ? '로그인하기' : '가입하기'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
              setMessage('');
              setLoginId('');
              setLoginIdChecked(false);
              setLoginIdAvailable(false);
              setLoginIdCheckMessage('');
              setPassword('');
              setPasswordConfirm('');
              setShowPassword(false);
              setShowPasswordConfirm(false);
            }}
            className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            {mode === 'signin' ? '계정이 없으면 회원가입' : '이미 계정이 있으면 로그인'}
          </button>
        </section>
      </div>
    </main>
  );
}
