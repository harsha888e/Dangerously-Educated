import { useEffect, useState } from 'react';
import { ArrowRight, UserCheck, X } from 'lucide-react';
import { AuthUser, PlayerProgress } from '../types/game';
import {
  AuthProvidersStatus,
  exchangeOAuthCode,
  fetchAuthProviders,
  fetchOAuthUrl,
  OAuthConfigError,
  signInAsGuest,
} from '../utils/authApi';

interface AuthPanelProps {
  mode: 'welcome' | 'modal';
  existingPlayerId: string;
  initialGuestName: string;
  onAuthenticated: (
    token: string,
    user: AuthUser,
    remoteProgress?: Partial<PlayerProgress> | null
  ) => void;
  onClose?: () => void;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073Z"
      />
    </svg>
  );
}

export function AuthPanel({
  mode,
  existingPlayerId,
  initialGuestName,
  onAuthenticated,
  onClose,
}: AuthPanelProps) {
  const [guestName, setGuestName] = useState(initialGuestName);
  const [providers, setProviders] = useState<AuthProvidersStatus | null>(null);
  const [busyProvider, setBusyProvider] = useState<
    'guest' | 'google' | 'facebook' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingCallbackHint, setMissingCallbackHint] = useState<string | null>(
    null
  );

  useEffect(() => {
    let active = true;
    fetchAuthProviders()
      .then((status) => {
        if (active) setProviders(status);
      })
      .catch(() => {
        // Provider status optional; individual clicks still check cleanly
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }

      const data = event.data as
        | {
            type?: string;
            provider?: 'google' | 'facebook';
            exchangeCode?: string;
            error?: string;
          }
        | undefined;

      if (!data || !data.type) return;

      if (data.type === 'OAUTH_AUTH_ERROR') {
        setBusyProvider(null);
        setErrorMessage(data.error || 'Authentication could not be completed.');
        return;
      }

      if (data.type === 'OAUTH_AUTH_SUCCESS' && data.exchangeCode) {
        try {
          const session = await exchangeOAuthCode(data.exchangeCode);
          setBusyProvider(null);
          onAuthenticated(session.token, session.user, session.progress);
        } catch {
          setBusyProvider(null);
          setErrorMessage('Could not finalize sign-in. Please try again.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthenticated]);

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setErrorMessage(null);
    setMissingCallbackHint(null);
    setBusyProvider(provider);

    try {
      const authUrl = await fetchOAuthUrl(provider);
      const popup = window.open(
        authUrl,
        `${provider}_oauth_popup`,
        'width=540,height=680'
      );
      if (!popup) {
        setBusyProvider(null);
        setErrorMessage(
          'Pop-up was blocked by your browser. Allow pop-ups for this site or continue as Guest below.'
        );
      }
    } catch (err) {
      setBusyProvider(null);
      if (err instanceof OAuthConfigError) {
        setErrorMessage(err.message);
        if (err.callbackUrl) {
          setMissingCallbackHint(err.callbackUrl);
        }
      } else {
        setErrorMessage(
          `Could not connect to ${provider === 'google' ? 'Google' : 'Facebook'} sign-in right now.`
        );
      }
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMissingCallbackHint(null);
    setBusyProvider('guest');

    try {
      const session = await signInAsGuest(guestName, existingPlayerId);
      setBusyProvider(null);
      onAuthenticated(session.token, session.user, null);
    } catch {
      setBusyProvider(null);
      setErrorMessage('Could not start guest session. Please try again.');
    }
  };

  const card = (
    <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
      {mode === 'modal' && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign-in modal"
          className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-amber-400">
          Dangerously Educated
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
          {mode === 'modal'
            ? 'Switch or Link Account'
            : 'Choose How to Sign In'}
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          Sign in with Google or Facebook to sync your Daily Streak and Mastery
          stats, or jump straight in as a Guest.
        </p>
      </div>

      {/* Social OAuth Options */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={busyProvider !== null}
          onClick={() => handleOAuthLogin('google')}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
        >
          <GoogleIcon />
          <span>
            {busyProvider === 'google'
              ? 'Waiting for Google...'
              : 'Continue with Google'}
          </span>
          {providers && !providers.google && (
            <span className="ml-auto font-mono text-[11px] font-medium text-slate-500">
              Setup needed
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={busyProvider !== null}
          onClick={() => handleOAuthLogin('facebook')}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#166FE5] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
        >
          <FacebookIcon />
          <span>
            {busyProvider === 'facebook'
              ? 'Waiting for Facebook...'
              : 'Continue with Facebook'}
          </span>
          {providers && !providers.facebook && (
            <span className="ml-auto font-mono text-[11px] font-medium text-blue-100/80">
              Setup needed
            </span>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200 space-y-1.5">
          <p>{errorMessage}</p>
          {missingCallbackHint && (
            <p className="font-mono text-[11px] text-rose-300 break-all">
              Callback URL: {missingCallbackHint}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-800" />
        <span>or play immediately</span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      {/* Instant Guest Sign-In */}
      <form onSubmit={handleGuestSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="guest-display-name"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Guest Display Name (optional)
          </label>
          <input
            id="guest-display-name"
            type="text"
            maxLength={28}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest Challenger"
            className="w-full rounded-xl border border-slate-700 bg-[#0B1120] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busyProvider !== null}
          className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:border-amber-400 hover:bg-amber-400 hover:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
        >
          <span className="inline-flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span>
              {busyProvider === 'guest'
                ? 'Starting Guest Session...'
                : 'Continue as Guest'}
            </span>
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Account sign-in"
      >
        {card}
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0B1120] px-4 py-10">
      {card}
    </main>
  );
}
