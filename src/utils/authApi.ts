import { AuthUser, PlayerProgress } from '../types/game';

export interface AuthProvidersStatus {
  google: boolean;
  facebook: boolean;
  googleCallbackUrl: string;
  facebookCallbackUrl: string;
}

export interface AuthSessionResponse {
  token: string;
  user: AuthUser;
  progress?: Partial<PlayerProgress> | null;
}

export class OAuthConfigError extends Error {
  callbackUrl?: string;
  constructor(message: string, callbackUrl?: string) {
    super(message);
    this.callbackUrl = callbackUrl;
  }
}

export async function fetchAuthProviders(): Promise<AuthProvidersStatus> {
  const res = await fetch('/api/auth/providers');
  if (!res.ok) {
    throw new Error('Failed to load sign-in providers');
  }
  return (await res.json()) as AuthProvidersStatus;
}

export async function signInAsGuest(
  name: string,
  existingPlayerId?: string
): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      existingPlayerId,
    }),
  });
  if (!res.ok) {
    throw new Error('Could not start guest session');
  }
  return (await res.json()) as AuthSessionResponse;
}

export async function fetchOAuthUrl(
  provider: 'google' | 'facebook'
): Promise<string> {
  const res = await fetch(`/api/auth/${provider}/url`);
  const data = (await res.json()) as {
    url?: string;
    error?: string;
    callbackUrl?: string;
  };
  if (!res.ok || !data.url) {
    throw new OAuthConfigError(
      data.error || `Failed to start ${provider} sign-in`,
      data.callbackUrl
    );
  }
  return data.url;
}

export async function exchangeOAuthCode(
  exchangeCode: string
): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchangeCode }),
  });
  if (!res.ok) {
    throw new Error('Could not verify OAuth sign-in');
  }
  return (await res.json()) as AuthSessionResponse;
}

export async function syncAccountProgress(
  token: string,
  progress: PlayerProgress
): Promise<void> {
  await fetch('/api/auth/progress', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(progress),
  });
}
