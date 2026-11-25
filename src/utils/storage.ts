import { CategoryId, PlayerProgress, RankTier } from '../types/game';
import { getPreviousUtcDateKey, getUtcDateKey } from './deckBuilder';

const STORAGE_KEY = 'dangerously_educated_progress_v1';

export const RANK_TIERS: RankTier[] = [
  { title: 'Curious Bystander', minXp: 0, nextXp: 500 },
  { title: 'Pub Night Spoiler', minXp: 500, nextXp: 1500 },
  { title: 'Trivia Menace', minXp: 1500, nextXp: 3500 },
  { title: 'Cocktail Party Hazard', minXp: 3500, nextXp: 7000 },
  { title: 'Dangerously Educated', minXp: 7000, nextXp: 12500 },
  { title: 'Grand Polymath', minXp: 12500, nextXp: null },
];

function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `plr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `plr_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export function getDefaultProgress(): PlayerProgress {
  return {
    playerId: createPlayerId(),
    playerName: '',
    xp: 0,
    gamesPlayed: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    bestStreak: 0,
    currentDailyStreak: 0,
    bestDailyStreak: 0,
    lastDailyDateKey: null,
    highScoreStandard: 0,
    highScoreBlitz: 0,
    highScoreSurvival: 0,
    seenIds: [],
    bookmarkedIds: [],
    categoryStats: {
      movies: { answered: 0, correct: 0 },
      games: { answered: 0, correct: 0 },
      cars: { answered: 0, correct: 0 },
      everything: { answered: 0, correct: 0 },
      maths: { answered: 0, correct: 0 },
      aptitude: { answered: 0, correct: 0 },
    },
    dailyHistory: {},
    soundEnabled: true,
  };
}

function computeStreakStatsFromHistory(
  dailyHistory: PlayerProgress['dailyHistory'],
  todayKey: string
): {
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyDateKey: string | null;
} {
  const keys = Object.keys(dailyHistory ?? {}).sort();
  if (keys.length === 0) {
    return {
      currentDailyStreak: 0,
      bestDailyStreak: 0,
      lastDailyDateKey: null,
    };
  }

  let best = 0;
  let running = 0;
  let prevKey: string | null = null;

  for (const key of keys) {
    if (prevKey && getPreviousUtcDateKey(key) === prevKey) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > best) best = running;
    prevKey = key;
  }

  const lastKey = keys[keys.length - 1];
  const yesterdayKey = getPreviousUtcDateKey(todayKey);
  const current =
    lastKey === todayKey || lastKey === yesterdayKey ? running : 0;

  return {
    currentDailyStreak: current,
    bestDailyStreak: best,
    lastDailyDateKey: lastKey,
  };
}

export function getCurrentDailyStreak(
  progress: Pick<PlayerProgress, 'currentDailyStreak' | 'lastDailyDateKey'>,
  todayKey: string = getUtcDateKey()
): number {
  if (!progress.lastDailyDateKey || progress.currentDailyStreak <= 0) {
    return 0;
  }
  const yesterdayKey = getPreviousUtcDateKey(todayKey);
  if (
    progress.lastDailyDateKey === todayKey ||
    progress.lastDailyDateKey === yesterdayKey
  ) {
    return progress.currentDailyStreak;
  }
  return 0;
}

export function applyDailyCompletionStreak(
  progress: Pick<
    PlayerProgress,
    'currentDailyStreak' | 'bestDailyStreak' | 'lastDailyDateKey'
  >,
  completedDateKey: string
): {
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyDateKey: string;
} {
  if (progress.lastDailyDateKey === completedDateKey) {
    const active = Math.max(1, progress.currentDailyStreak);
    return {
      currentDailyStreak: active,
      bestDailyStreak: Math.max(progress.bestDailyStreak ?? 0, active),
      lastDailyDateKey: completedDateKey,
    };
  }

  const yesterdayKey = getPreviousUtcDateKey(completedDateKey);
  const nextStreak =
    progress.lastDailyDateKey === yesterdayKey
      ? progress.currentDailyStreak + 1
      : 1;

  return {
    currentDailyStreak: nextStreak,
    bestDailyStreak: Math.max(progress.bestDailyStreak ?? 0, nextStreak),
    lastDailyDateKey: completedDateKey,
  };
}

export function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined') return getDefaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const defaults = getDefaultProgress();
    const dailyHistory =
      parsed.dailyHistory && typeof parsed.dailyHistory === 'object'
        ? parsed.dailyHistory
        : {};

    const todayKey = getUtcDateKey();
    const hasExplicitStreak = typeof parsed.lastDailyDateKey === 'string';
    const derived = computeStreakStatsFromHistory(dailyHistory, todayKey);

    const rawLastKey = hasExplicitStreak
      ? (parsed.lastDailyDateKey ?? null)
      : derived.lastDailyDateKey;
    const rawCurrentStreak =
      typeof parsed.currentDailyStreak === 'number'
        ? parsed.currentDailyStreak
        : derived.currentDailyStreak;
    const activeStreak = getCurrentDailyStreak(
      { currentDailyStreak: rawCurrentStreak, lastDailyDateKey: rawLastKey },
      todayKey
    );

    return {
      ...defaults,
      ...parsed,
      playerId:
        typeof parsed.playerId === 'string' && parsed.playerId.length >= 6
          ? parsed.playerId
          : defaults.playerId,
      playerName:
        typeof parsed.playerName === 'string' ? parsed.playerName : '',
      currentDailyStreak: activeStreak,
      bestDailyStreak: Math.max(
        typeof parsed.bestDailyStreak === 'number' ? parsed.bestDailyStreak : 0,
        derived.bestDailyStreak,
        activeStreak
      ),
      lastDailyDateKey: rawLastKey,
      categoryStats: {
        ...defaults.categoryStats,
        ...(parsed.categoryStats ?? {}),
      },
      dailyHistory,
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds : [],
      bookmarkedIds: Array.isArray(parsed.bookmarkedIds)
        ? parsed.bookmarkedIds
        : [],
    };
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function getRankForXp(xp: number): RankTier {
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (xp >= tier.minXp) {
      current = tier;
    }
  }
  return current;
}

export function getCategoryAccuracy(
  progress: PlayerProgress,
  category: CategoryId
): number {
  const stat = progress.categoryStats?.[category];
  if (!stat || stat.answered === 0) return 0;
  return Math.round((stat.correct / stat.answered) * 100);
}

export function mergeAccountProgress(
  local: PlayerProgress,
  remote: Partial<PlayerProgress> | null | undefined,
  accountId: string,
  accountName: string
): PlayerProgress {
  const todayKey = getUtcDateKey();
  const baseRemote = remote ?? {};

  const mergedDailyHistory = {
    ...(local.dailyHistory ?? {}),
    ...(baseRemote.dailyHistory ?? {}),
  };

  const derivedStreak = computeStreakStatsFromHistory(
    mergedDailyHistory,
    todayKey
  );

  const localActive = getCurrentDailyStreak(local, todayKey);
  const remoteActive =
    typeof baseRemote.currentDailyStreak === 'number' &&
    typeof baseRemote.lastDailyDateKey === 'string'
      ? getCurrentDailyStreak(
          {
            currentDailyStreak: baseRemote.currentDailyStreak,
            lastDailyDateKey: baseRemote.lastDailyDateKey,
          },
          todayKey
        )
      : 0;

  const currentDailyStreak = Math.max(
    localActive,
    remoteActive,
    derivedStreak.currentDailyStreak
  );
  const bestDailyStreak = Math.max(
    local.bestDailyStreak,
    typeof baseRemote.bestDailyStreak === 'number'
      ? baseRemote.bestDailyStreak
      : 0,
    derivedStreak.bestDailyStreak,
    currentDailyStreak
  );

  const candidateLastKey = [
    local.lastDailyDateKey,
    typeof baseRemote.lastDailyDateKey === 'string'
      ? baseRemote.lastDailyDateKey
      : null,
    derivedStreak.lastDailyDateKey,
  ]
    .filter((k): k is string => Boolean(k))
    .sort()
    .pop() ?? null;

  const seenSet = new Set([
    ...local.seenIds,
    ...(Array.isArray(baseRemote.seenIds) ? baseRemote.seenIds : []),
  ]);
  const bookmarkedSet = new Set([
    ...local.bookmarkedIds,
    ...(Array.isArray(baseRemote.bookmarkedIds)
      ? baseRemote.bookmarkedIds
      : []),
  ]);

  const mergedCategoryStats = { ...local.categoryStats };
  if (baseRemote.categoryStats) {
    for (const key of Object.keys(mergedCategoryStats) as CategoryId[]) {
      const rStat = baseRemote.categoryStats[key];
      if (rStat && rStat.answered > mergedCategoryStats[key].answered) {
        mergedCategoryStats[key] = rStat;
      }
    }
  }

  return {
    ...local,
    playerId: accountId,
    playerName:
      local.playerName.trim() ||
      (typeof baseRemote.playerName === 'string' &&
      baseRemote.playerName.trim()
        ? baseRemote.playerName.trim()
        : accountName),
    xp: Math.max(local.xp, typeof baseRemote.xp === 'number' ? baseRemote.xp : 0),
    gamesPlayed: Math.max(
      local.gamesPlayed,
      typeof baseRemote.gamesPlayed === 'number' ? baseRemote.gamesPlayed : 0
    ),
    totalAnswered: Math.max(
      local.totalAnswered,
      typeof baseRemote.totalAnswered === 'number'
        ? baseRemote.totalAnswered
        : 0
    ),
    totalCorrect: Math.max(
      local.totalCorrect,
      typeof baseRemote.totalCorrect === 'number' ? baseRemote.totalCorrect : 0
    ),
    bestStreak: Math.max(
      local.bestStreak,
      typeof baseRemote.bestStreak === 'number' ? baseRemote.bestStreak : 0
    ),
    currentDailyStreak,
    bestDailyStreak,
    lastDailyDateKey: candidateLastKey,
    highScoreStandard: Math.max(
      local.highScoreStandard,
      typeof baseRemote.highScoreStandard === 'number'
        ? baseRemote.highScoreStandard
        : 0
    ),
    highScoreBlitz: Math.max(
      local.highScoreBlitz,
      typeof baseRemote.highScoreBlitz === 'number'
        ? baseRemote.highScoreBlitz
        : 0
    ),
    highScoreSurvival: Math.max(
      local.highScoreSurvival,
      typeof baseRemote.highScoreSurvival === 'number'
        ? baseRemote.highScoreSurvival
        : 0
    ),
    seenIds: Array.from(seenSet),
    bookmarkedIds: Array.from(bookmarkedSet),
    categoryStats: mergedCategoryStats,
    dailyHistory: mergedDailyHistory,
  };
}

