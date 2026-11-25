import {
  PlayerProgress,
  WorldLeaderboardResponse,
  WorldLeaderboardSort,
} from '../types/game';

export async function fetchWorldLeaderboard(
  sortBy: WorldLeaderboardSort,
  playerId?: string
): Promise<WorldLeaderboardResponse> {
  const params = new URLSearchParams({ sortBy });
  if (playerId) {
    params.set('playerId', playerId);
  }
  const res = await fetch(`/api/leaderboard/world?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to load world leaderboard');
  }
  return (await res.json()) as WorldLeaderboardResponse;
}

export async function syncWorldLeaderboard(
  progress: PlayerProgress,
  token?: string | null
): Promise<void> {
  const bestRoundScore = Math.max(
    progress.highScoreStandard,
    progress.highScoreBlitz,
    progress.highScoreSurvival
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetch('/api/leaderboard/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      playerId: progress.playerId,
      playerName: progress.playerName.trim() || 'Challenger',
      xp: progress.xp,
      currentDailyStreak: progress.currentDailyStreak,
      bestDailyStreak: progress.bestDailyStreak,
      lastDailyDateKey: progress.lastDailyDateKey,
      bestRoundScore,
      bestInRoundStreak: progress.bestStreak,
      totalCorrect: progress.totalCorrect,
      totalAnswered: progress.totalAnswered,
      gamesPlayed: progress.gamesPlayed,
    }),
  });
}
