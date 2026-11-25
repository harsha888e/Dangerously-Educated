import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

interface DailyEntry {
  playerId: string;
  playerName: string;
  score: number;
  correctCount: number;
  totalCount: number;
  bestStreak: number;
  durationMs: number;
  submittedAt: string;
}

type DailyStore = Record<string, DailyEntry[]>;

type AuthProvider = 'guest' | 'google' | 'facebook';

interface AuthUser {
  id: string;
  provider: AuthProvider;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface WorldLeaderboardEntry {
  playerId: string;
  playerName: string;
  provider: AuthProvider;
  avatarUrl?: string;
  xp: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyDateKey: string | null;
  bestRoundScore: number;
  bestInRoundStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  gamesPlayed: number;
  updatedAt: string;
}

type WorldLeaderboardSort =
  | 'xp'
  | 'dailyStreak'
  | 'bestDailyStreak'
  | 'highScore';

type WorldStore = Record<string, WorldLeaderboardEntry>;

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'daily-leaderboards.json');
const ACCOUNT_PROGRESS_PATH = path.resolve(DATA_DIR, 'account-progress.json');
const WORLD_LEADERBOARD_PATH = path.resolve(DATA_DIR, 'world-leaderboard.json');
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_CODE_TTL_MS = 2 * 60 * 1000;

const SESSION_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const oauthStates = new Map<
  string,
  { provider: 'google' | 'facebook'; createdAt: number }
>();
const exchangeCodes = new Map<
  string,
  { user: AuthUser; createdAt: number }
>();

function pruneEphemeralAuthMaps(): void {
  const now = Date.now();
  for (const [state, meta] of oauthStates.entries()) {
    if (now - meta.createdAt > OAUTH_STATE_TTL_MS) {
      oauthStates.delete(state);
    }
  }
  for (const [code, meta] of exchangeCodes.entries()) {
    if (now - meta.createdAt > EXCHANGE_CODE_TTL_MS) {
      exchangeCodes.delete(code);
    }
  }
}

function getAppBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  return {
    enabled: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri: `${getAppBaseUrl()}/api/auth/google/callback`,
  };
}

function getFacebookConfig() {
  const appId = process.env.FACEBOOK_APP_ID?.trim() || '';
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim() || '';
  return {
    enabled: Boolean(appId && appSecret),
    appId,
    appSecret,
    redirectUri: `${getAppBaseUrl()}/api/auth/facebook/callback`,
  };
}

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPreviousUtcDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0, 0));
  return prev.toISOString().slice(0, 10);
}

function getEffectiveDailyStreak(
  currentDailyStreak: number,
  lastDailyDateKey: string | null,
  todayKey: string = getUtcDateKey()
): number {
  if (!lastDailyDateKey || currentDailyStreak <= 0) return 0;
  const yesterdayKey = getPreviousUtcDateKey(todayKey);
  if (lastDailyDateKey === todayKey || lastDailyDateKey === yesterdayKey) {
    return currentDailyStreak;
  }
  return 0;
}

function sortWorldLeaderboard(
  entries: WorldLeaderboardEntry[],
  sortBy: WorldLeaderboardSort
): WorldLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'dailyStreak') {
      if (b.currentDailyStreak !== a.currentDailyStreak) {
        return b.currentDailyStreak - a.currentDailyStreak;
      }
      if (b.bestDailyStreak !== a.bestDailyStreak) {
        return b.bestDailyStreak - a.bestDailyStreak;
      }
      if (b.xp !== a.xp) return b.xp - a.xp;
    } else if (sortBy === 'bestDailyStreak') {
      if (b.bestDailyStreak !== a.bestDailyStreak) {
        return b.bestDailyStreak - a.bestDailyStreak;
      }
      if (b.currentDailyStreak !== a.currentDailyStreak) {
        return b.currentDailyStreak - a.currentDailyStreak;
      }
      if (b.xp !== a.xp) return b.xp - a.xp;
    } else if (sortBy === 'highScore') {
      if (b.bestRoundScore !== a.bestRoundScore) {
        return b.bestRoundScore - a.bestRoundScore;
      }
      if (b.xp !== a.xp) return b.xp - a.xp;
    } else {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.currentDailyStreak !== a.currentDailyStreak) {
        return b.currentDailyStreak - a.currentDailyStreak;
      }
      if (b.bestRoundScore !== a.bestRoundScore) {
        return b.bestRoundScore - a.bestRoundScore;
      }
    }
    return a.playerName.localeCompare(b.playerName);
  });
}

function getNextUtcResetIso(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  return next.toISOString();
}

function readJsonStore<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStore(filePath: string, data: unknown): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function sortLeaderboard(entries: DailyEntry[]): DailyEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    return a.submittedAt.localeCompare(b.submittedAt);
  });
}

function sanitizeName(raw: unknown, fallback = 'Challenger'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 28);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeAvatarUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toAccountId(provider: 'google' | 'facebook', rawId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${provider}:${rawId}`)
    .digest('hex')
    .slice(0, 20);
  return `${provider === 'google' ? 'ggl' : 'fcb'}_${digest}`;
}

function signSessionToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    provider: user.provider,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifySessionToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as {
      sub?: unknown;
      provider?: unknown;
      name?: unknown;
      email?: unknown;
      avatarUrl?: unknown;
      exp?: unknown;
    };

    if (
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Date.now() ||
      typeof decoded.sub !== 'string' ||
      !/^[a-zA-Z0-9_-]{6,64}$/.test(decoded.sub) ||
      (decoded.provider !== 'guest' &&
        decoded.provider !== 'google' &&
        decoded.provider !== 'facebook')
    ) {
      return null;
    }

    return {
      id: decoded.sub,
      provider: decoded.provider,
      name: sanitizeName(decoded.name, 'Challenger'),
      email:
        typeof decoded.email === 'string'
          ? decoded.email.slice(0, 120)
          : undefined,
      avatarUrl: sanitizeAvatarUrl(decoded.avatarUrl),
    };
  } catch {
    return null;
  }
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const user = verifySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
  req.authUser = user;
  next();
}

function renderOAuthCallbackHtml(
  payload:
    | { type: 'OAUTH_AUTH_SUCCESS'; provider: 'google' | 'facebook'; exchangeCode: string }
    | { type: 'OAUTH_AUTH_ERROR'; provider: 'google' | 'facebook'; error: string }
): string {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const statusText =
    payload.type === 'OAUTH_AUTH_SUCCESS'
      ? 'Sign-in complete. Returning you to Dangerously Educated...'
      : `Sign-in could not be completed: ${payload.error}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Authentication</title>
  </head>
  <body style="background:#0B1120;color:#F1F5F9;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
    <div style="max-width:360px;">
      <p id="msg" style="font-size:15px;line-height:1.5;"></p>
    </div>
    <script>
      const payload = ${safeJson};
      document.getElementById('msg').textContent = ${JSON.stringify(statusText).replace(/</g, '\\u003c')};
      if (window.opener) {
        window.opener.postMessage(payload, '*');
        window.close();
      } else {
        setTimeout(() => { window.location.href = '/'; }, 1200);
      }
    </script>
  </body>
</html>`;
}

function sanitizeStoredProgress(
  raw: unknown,
  authoritativeUser: AuthUser
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;

  const validDateKey =
    typeof input.lastDailyDateKey === 'string' &&
    DATE_KEY_REGEX.test(input.lastDailyDateKey)
      ? input.lastDailyDateKey
      : null;

  const sanitizeIds = (val: unknown) =>
    Array.isArray(val)
      ? val
          .filter((id): id is string => typeof id === 'string' && id.length <= 40)
          .slice(0, 500)
      : [];

  const nonNegInt = (val: unknown, max = 1_000_000) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(max, Math.floor(n));
  };

  const VALID_CATEGORIES = new Set([
    'movies',
    'games',
    'cars',
    'everything',
    'maths',
    'aptitude',
  ]);
  const categoryStats: Record<string, { answered: number; correct: number }> =
    {};
  if (
    input.categoryStats &&
    typeof input.categoryStats === 'object' &&
    !Array.isArray(input.categoryStats)
  ) {
    for (const [cat, stat] of Object.entries(
      input.categoryStats as Record<string, unknown>
    )) {
      if (
        VALID_CATEGORIES.has(cat) &&
        stat &&
        typeof stat === 'object' &&
        !Array.isArray(stat)
      ) {
        const s = stat as Record<string, unknown>;
        categoryStats[cat] = {
          answered: nonNegInt(s.answered, 1_000_000),
          correct: nonNegInt(s.correct, 1_000_000),
        };
      }
    }
  }

  const dailyHistory: Record<string, unknown> = {};
  if (
    input.dailyHistory &&
    typeof input.dailyHistory === 'object' &&
    !Array.isArray(input.dailyHistory)
  ) {
    const entries = Object.entries(
      input.dailyHistory as Record<string, unknown>
    )
      .filter(([key]) => DATE_KEY_REGEX.test(key))
      .slice(-60);
    for (const [key, rec] of entries) {
      if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
        const r = rec as Record<string, unknown>;
        dailyHistory[key] = {
          dateKey: key,
          score: nonNegInt(r.score, 50_000),
          correctCount: nonNegInt(r.correctCount, 25),
          totalCount: Math.max(1, nonNegInt(r.totalCount, 25)),
          bestStreak: nonNegInt(r.bestStreak, 25),
          durationMs: nonNegInt(r.durationMs, 3_600_000),
          records: Array.isArray(r.records) ? r.records.slice(0, 25) : [],
        };
      }
    }
  }

  return {
    playerId: authoritativeUser.id,
    playerName: sanitizeName(input.playerName, authoritativeUser.name),
    xp: nonNegInt(input.xp, 10_000_000),
    gamesPlayed: nonNegInt(input.gamesPlayed, 100_000),
    totalAnswered: nonNegInt(input.totalAnswered, 1_000_000),
    totalCorrect: nonNegInt(input.totalCorrect, 1_000_000),
    bestStreak: nonNegInt(input.bestStreak, 10_000),
    currentDailyStreak: nonNegInt(input.currentDailyStreak, 10_000),
    bestDailyStreak: nonNegInt(input.bestDailyStreak, 10_000),
    lastDailyDateKey: validDateKey,
    highScoreStandard: nonNegInt(input.highScoreStandard, 1_000_000),
    highScoreBlitz: nonNegInt(input.highScoreBlitz, 1_000_000),
    highScoreSurvival: nonNegInt(input.highScoreSurvival, 1_000_000),
    seenIds: sanitizeIds(input.seenIds),
    bookmarkedIds: sanitizeIds(input.bookmarkedIds),
    categoryStats,
    dailyHistory,
    soundEnabled:
      typeof input.soundEnabled === 'boolean' ? input.soundEnabled : true,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  // --- Auth & OAuth Endpoints ---
  app.get('/api/auth/providers', (_req, res) => {
    const google = getGoogleConfig();
    const facebook = getFacebookConfig();
    res.json({
      google: google.enabled,
      facebook: facebook.enabled,
      googleCallbackUrl: google.redirectUri,
      facebookCallbackUrl: facebook.redirectUri,
    });
  });

  app.post('/api/auth/guest', (req, res) => {
    const body = req.body as Record<string, unknown> | null;
    const rawId = body?.existingPlayerId;
    const validExistingId =
      typeof rawId === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(rawId)
        ? rawId
        : `gst_${crypto.randomBytes(10).toString('hex')}`;

    const name = sanitizeName(body?.name, 'Guest Challenger');
    const user: AuthUser = {
      id: validExistingId,
      provider: 'guest',
      name,
    };
    const token = signSessionToken(user);
    res.json({ token, user });
  });

  app.get('/api/auth/google/url', (_req, res) => {
    pruneEphemeralAuthMaps();
    const cfg = getGoogleConfig();
    if (!cfg.enabled) {
      res.status(503).json({
        error:
          'Google login is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Settings -> Secrets.',
        callbackUrl: cfg.redirectUri,
      });
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { provider: 'google', createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    });
  });

  app.get(
    ['/api/auth/google/callback', '/api/auth/google/callback/'],
    async (req, res) => {
      pruneEphemeralAuthMaps();
      const cfg = getGoogleConfig();
      const errorParam =
        typeof req.query.error === 'string' ? req.query.error : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';

      if (errorParam) {
        res.send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'google',
            error: 'Google sign-in was cancelled.',
          })
        );
        return;
      }

      const savedState = state ? oauthStates.get(state) : undefined;
      if (!savedState || savedState.provider !== 'google' || !code) {
        res.status(400).send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'google',
            error: 'Invalid or expired OAuth state.',
          })
        );
        return;
      }
      oauthStates.delete(state);

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            redirect_uri: cfg.redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        });

        if (!tokenRes.ok) {
          throw new Error('Google token exchange failed');
        }
        const tokenJson = (await tokenRes.json()) as { access_token?: string };
        if (!tokenJson.access_token) {
          throw new Error('Missing Google access token');
        }

        const profileRes = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          }
        );
        if (!profileRes.ok) {
          throw new Error('Failed to load Google profile');
        }
        const profile = (await profileRes.json()) as {
          id?: string;
          name?: string;
          email?: string;
          picture?: string;
        };

        if (!profile.id) {
          throw new Error('Google profile missing user ID');
        }

        const user: AuthUser = {
          id: toAccountId('google', String(profile.id)),
          provider: 'google',
          name: sanitizeName(profile.name, 'Google Challenger'),
          email:
            typeof profile.email === 'string'
              ? profile.email.slice(0, 120)
              : undefined,
          avatarUrl: sanitizeAvatarUrl(profile.picture),
        };

        const exchangeCode = crypto.randomBytes(24).toString('hex');
        exchangeCodes.set(exchangeCode, { user, createdAt: Date.now() });

        res.send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_SUCCESS',
            provider: 'google',
            exchangeCode,
          })
        );
      } catch {
        res.status(500).send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'google',
            error: 'Could not complete Google sign-in.',
          })
        );
      }
    }
  );

  app.get('/api/auth/facebook/url', (_req, res) => {
    pruneEphemeralAuthMaps();
    const cfg = getFacebookConfig();
    if (!cfg.enabled) {
      res.status(503).json({
        error:
          'Facebook login is not configured yet. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Settings -> Secrets.',
        callbackUrl: cfg.redirectUri,
      });
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { provider: 'facebook', createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: cfg.appId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: 'public_profile,email',
      state,
    });

    res.json({
      url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`,
    });
  });

  app.get(
    ['/api/auth/facebook/callback', '/api/auth/facebook/callback/'],
    async (req, res) => {
      pruneEphemeralAuthMaps();
      const cfg = getFacebookConfig();
      const errorParam =
        typeof req.query.error === 'string' ? req.query.error : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';

      if (errorParam) {
        res.send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'facebook',
            error: 'Facebook sign-in was cancelled.',
          })
        );
        return;
      }

      const savedState = state ? oauthStates.get(state) : undefined;
      if (!savedState || savedState.provider !== 'facebook' || !code) {
        res.status(400).send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'facebook',
            error: 'Invalid or expired OAuth state.',
          })
        );
        return;
      }
      oauthStates.delete(state);

      try {
        const tokenParams = new URLSearchParams({
          client_id: cfg.appId,
          client_secret: cfg.appSecret,
          redirect_uri: cfg.redirectUri,
          code,
        });
        const tokenRes = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
        );
        if (!tokenRes.ok) {
          throw new Error('Facebook token exchange failed');
        }
        const tokenJson = (await tokenRes.json()) as { access_token?: string };
        if (!tokenJson.access_token) {
          throw new Error('Missing Facebook access token');
        }

        const profileRes = await fetch(
          'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)',
          {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          }
        );
        if (!profileRes.ok) {
          throw new Error('Failed to load Facebook profile');
        }
        const profile = (await profileRes.json()) as {
          id?: string;
          name?: string;
          email?: string;
          picture?: { data?: { url?: string } };
        };

        if (!profile.id) {
          throw new Error('Facebook profile missing user ID');
        }

        const user: AuthUser = {
          id: toAccountId('facebook', String(profile.id)),
          provider: 'facebook',
          name: sanitizeName(profile.name, 'Facebook Challenger'),
          email:
            typeof profile.email === 'string'
              ? profile.email.slice(0, 120)
              : undefined,
          avatarUrl: sanitizeAvatarUrl(profile.picture?.data?.url),
        };

        const exchangeCode = crypto.randomBytes(24).toString('hex');
        exchangeCodes.set(exchangeCode, { user, createdAt: Date.now() });

        res.send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_SUCCESS',
            provider: 'facebook',
            exchangeCode,
          })
        );
      } catch {
        res.status(500).send(
          renderOAuthCallbackHtml({
            type: 'OAUTH_AUTH_ERROR',
            provider: 'facebook',
            error: 'Could not complete Facebook sign-in.',
          })
        );
      }
    }
  );

  app.post('/api/auth/exchange', (req, res) => {
    pruneEphemeralAuthMaps();
    const body = req.body as Record<string, unknown> | null;
    const exchangeCode =
      typeof body?.exchangeCode === 'string' ? body.exchangeCode : '';

    const record = exchangeCode ? exchangeCodes.get(exchangeCode) : undefined;
    if (!record) {
      res.status(400).json({ error: 'Invalid or expired exchange code' });
      return;
    }
    exchangeCodes.delete(exchangeCode);

    const token = signSessionToken(record.user);
    const accountStore = readJsonStore<Record<string, Record<string, unknown>>>(
      ACCOUNT_PROGRESS_PATH,
      {}
    );
    const savedProgress = accountStore[record.user.id] ?? null;

    res.json({
      token,
      user: record.user,
      progress: savedProgress,
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const accountStore = readJsonStore<Record<string, Record<string, unknown>>>(
      ACCOUNT_PROGRESS_PATH,
      {}
    );
    res.json({
      user,
      progress: accountStore[user.id] ?? null,
    });
  });

  app.put(
    '/api/auth/progress',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const sanitized = sanitizeStoredProgress(req.body, user);
      if (!sanitized) {
        res.status(400).json({ error: 'Invalid progress payload' });
        return;
      }

      const accountStore = readJsonStore<
        Record<string, Record<string, unknown>>
      >(ACCOUNT_PROGRESS_PATH, {});
      accountStore[user.id] = sanitized;
      writeJsonStore(ACCOUNT_PROGRESS_PATH, accountStore);

      const worldStore = readJsonStore<WorldStore>(WORLD_LEADERBOARD_PATH, {});
      const bestRoundScore = Math.max(
        Number(sanitized.highScoreStandard) || 0,
        Number(sanitized.highScoreBlitz) || 0,
        Number(sanitized.highScoreSurvival) || 0
      );
      const lastKey =
        typeof sanitized.lastDailyDateKey === 'string'
          ? sanitized.lastDailyDateKey
          : null;
      worldStore[user.id] = {
        playerId: user.id,
        playerName: String(sanitized.playerName || user.name),
        provider: user.provider,
        avatarUrl: user.avatarUrl,
        xp: Number(sanitized.xp) || 0,
        currentDailyStreak: getEffectiveDailyStreak(
          Number(sanitized.currentDailyStreak) || 0,
          lastKey
        ),
        bestDailyStreak: Number(sanitized.bestDailyStreak) || 0,
        lastDailyDateKey: lastKey,
        bestRoundScore,
        bestInRoundStreak: Number(sanitized.bestStreak) || 0,
        totalCorrect: Number(sanitized.totalCorrect) || 0,
        totalAnswered: Number(sanitized.totalAnswered) || 0,
        gamesPlayed: Number(sanitized.gamesPlayed) || 0,
        updatedAt: new Date().toISOString(),
      };
      writeJsonStore(WORLD_LEADERBOARD_PATH, worldStore);

      res.json({ ok: true });
    }
  );

  // --- World Leaderboard Endpoints ---
  app.get('/api/leaderboard/world', (req, res) => {
    const rawSort = req.query.sortBy;
    const sortBy: WorldLeaderboardSort =
      rawSort === 'dailyStreak' ||
      rawSort === 'bestDailyStreak' ||
      rawSort === 'highScore'
        ? rawSort
        : 'xp';

    const requestedPlayerId =
      typeof req.query.playerId === 'string' &&
      /^[a-zA-Z0-9_-]{6,64}$/.test(req.query.playerId)
        ? req.query.playerId
        : null;

    const todayKey = getUtcDateKey();
    const worldStore = readJsonStore<WorldStore>(WORLD_LEADERBOARD_PATH, {});
    const normalizedEntries = Object.values(worldStore).map((entry) => ({
      ...entry,
      currentDailyStreak: getEffectiveDailyStreak(
        entry.currentDailyStreak,
        entry.lastDailyDateKey,
        todayKey
      ),
    }));

    const sorted = sortWorldLeaderboard(normalizedEntries, sortBy);
    const playerIndex = requestedPlayerId
      ? sorted.findIndex((e) => e.playerId === requestedPlayerId)
      : -1;

    res.json({
      sortBy,
      serverUtcDate: todayKey,
      totalPlayers: sorted.length,
      playerRank: playerIndex >= 0 ? playerIndex + 1 : null,
      playerEntry: playerIndex >= 0 ? sorted[playerIndex] : null,
      entries: sorted.slice(0, 100),
    });
  });

  app.post('/api/leaderboard/sync', (req, res) => {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const authHeader = req.headers.authorization;
    const tokenUser =
      authHeader && authHeader.startsWith('Bearer ')
        ? verifySessionToken(authHeader.slice('Bearer '.length).trim())
        : null;

    const rawPlayerId =
      typeof body.playerId === 'string' &&
      /^[a-zA-Z0-9_-]{6,64}$/.test(body.playerId)
        ? body.playerId
        : '';

    const playerId =
      tokenUser && tokenUser.provider !== 'guest' ? tokenUser.id : rawPlayerId;

    if (!playerId) {
      res.status(400).json({ error: 'Valid playerId is required' });
      return;
    }

    const clampInt = (val: unknown, max: number): number | null => {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0 || n > max) return null;
      return Math.floor(n);
    };

    const xp = clampInt(body.xp ?? 0, 10_000_000);
    const currentDailyStreak = clampInt(body.currentDailyStreak ?? 0, 10_000);
    const bestDailyStreak = clampInt(body.bestDailyStreak ?? 0, 10_000);
    const bestRoundScore = clampInt(body.bestRoundScore ?? 0, 1_000_000);
    const bestInRoundStreak = clampInt(body.bestInRoundStreak ?? 0, 10_000);
    const totalCorrect = clampInt(body.totalCorrect ?? 0, 1_000_000);
    const totalAnswered = clampInt(body.totalAnswered ?? 0, 1_000_000);
    const gamesPlayed = clampInt(body.gamesPlayed ?? 0, 100_000);

    if (
      xp === null ||
      currentDailyStreak === null ||
      bestDailyStreak === null ||
      bestRoundScore === null ||
      bestInRoundStreak === null ||
      totalCorrect === null ||
      totalAnswered === null ||
      gamesPlayed === null ||
      totalCorrect > totalAnswered
    ) {
      res.status(400).json({ error: 'Invalid leaderboard metrics' });
      return;
    }

    const lastDailyDateKey =
      typeof body.lastDailyDateKey === 'string' &&
      DATE_KEY_REGEX.test(body.lastDailyDateKey)
        ? body.lastDailyDateKey
        : null;

    const todayKey = getUtcDateKey();
    const worldStore = readJsonStore<WorldStore>(WORLD_LEADERBOARD_PATH, {});
    const existing = worldStore[playerId];

    const entry: WorldLeaderboardEntry = {
      playerId,
      playerName: sanitizeName(
        body.playerName,
        tokenUser?.name || existing?.playerName || 'Challenger'
      ),
      provider: tokenUser?.provider ?? existing?.provider ?? 'guest',
      avatarUrl: tokenUser?.avatarUrl ?? existing?.avatarUrl,
      xp,
      currentDailyStreak: getEffectiveDailyStreak(
        currentDailyStreak,
        lastDailyDateKey,
        todayKey
      ),
      bestDailyStreak: Math.max(bestDailyStreak, currentDailyStreak),
      lastDailyDateKey,
      bestRoundScore,
      bestInRoundStreak,
      totalCorrect,
      totalAnswered,
      gamesPlayed,
      updatedAt: new Date().toISOString(),
    };

    worldStore[playerId] = entry;
    writeJsonStore(WORLD_LEADERBOARD_PATH, worldStore);

    res.json({ ok: true, entry });
  });

  // --- Daily Leaderboard Endpoints ---
  app.get('/api/daily/leaderboard', (req, res) => {
    const requestedDate =
      typeof req.query.date === 'string' && DATE_KEY_REGEX.test(req.query.date)
        ? req.query.date
        : getUtcDateKey();

    const store = readJsonStore<DailyStore>(STORE_PATH, {});
    const entries = sortLeaderboard(store[requestedDate] ?? []).slice(0, 100);

    res.json({
      dateKey: requestedDate,
      serverUtcDate: getUtcDateKey(),
      nextResetIso: getNextUtcResetIso(),
      totalPlayers: (store[requestedDate] ?? []).length,
      entries,
    });
  });

  app.post('/api/daily/submit', (req, res) => {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const dateKey =
      typeof body.dateKey === 'string' && DATE_KEY_REGEX.test(body.dateKey)
        ? body.dateKey
        : getUtcDateKey();

    const playerId =
      typeof body.playerId === 'string' &&
      /^[a-zA-Z0-9_-]{6,64}$/.test(body.playerId)
        ? body.playerId
        : '';

    if (!playerId) {
      res.status(400).json({ error: 'Valid playerId is required' });
      return;
    }

    const score = Number(body.score);
    const correctCount = Number(body.correctCount);
    const totalCount = Number(body.totalCount);
    const bestStreak = Number(body.bestStreak);
    const durationMs = Number(body.durationMs);

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 50000 ||
      !Number.isInteger(correctCount) ||
      correctCount < 0 ||
      !Number.isInteger(totalCount) ||
      totalCount < 1 ||
      totalCount > 25 ||
      correctCount > totalCount ||
      !Number.isInteger(bestStreak) ||
      bestStreak < 0 ||
      bestStreak > totalCount ||
      !Number.isFinite(durationMs) ||
      durationMs < 0 ||
      durationMs > 3600000
    ) {
      res.status(400).json({ error: 'Invalid score submission values' });
      return;
    }

    const playerName = sanitizeName(body.playerName);
    const store = readJsonStore<DailyStore>(STORE_PATH, {});
    const currentList = store[dateKey] ?? [];
    const existingIdx = currentList.findIndex((e) => e.playerId === playerId);

    const entry: DailyEntry = {
      playerId,
      playerName,
      score: Math.round(score),
      correctCount,
      totalCount,
      bestStreak,
      durationMs: Math.round(durationMs),
      submittedAt:
        existingIdx >= 0
          ? currentList[existingIdx].submittedAt
          : new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      const prev = currentList[existingIdx];
      currentList[existingIdx] = {
        ...prev,
        playerName,
      };
    } else {
      currentList.push(entry);
    }

    const allKeys = Object.keys(store).sort();
    if (allKeys.length > 30) {
      for (const oldKey of allKeys.slice(0, allKeys.length - 30)) {
        delete store[oldKey];
      }
    }

    const sorted = sortLeaderboard(currentList);
    store[dateKey] = sorted;
    writeJsonStore(STORE_PATH, store);

    const playerRank =
      sorted.findIndex((e) => e.playerId === playerId) + 1 || null;

    res.json({
      dateKey,
      nextResetIso: getNextUtcResetIso(),
      totalPlayers: sorted.length,
      playerRank,
      entries: sorted.slice(0, 100),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dangerously Educated server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
