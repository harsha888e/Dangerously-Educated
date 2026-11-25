import { DailyLeaderboardEntry } from '../types/game';

export interface DailyLeaderboardResponse {
  dateKey: string;
  serverUtcDate?: string;
  nextResetIso: string;
  totalPlayers: number;
  playerRank?: number | null;
  entries: DailyLeaderboardEntry[];
}

export async function fetchDailyLeaderboard(
  dateKey: string
): Promise<DailyLeaderboardResponse> {
  const res = await fetch(
    `/api/daily/leaderboard?date=${encodeURIComponent(dateKey)}`
  );
  if (!res.ok) {
    throw new Error('Unable to load daily leaderboard');
  }
  return (await res.json()) as DailyLeaderboardResponse;
}

export async function submitDailyScore(payload: {
  dateKey: string;
  playerId: string;
  playerName: string;
  score: number;
  correctCount: number;
  totalCount: number;
  bestStreak: number;
  durationMs: number;
}): Promise<DailyLeaderboardResponse> {
  const res = await fetch('/api/daily/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Unable to submit daily score');
  }
  return (await res.json()) as DailyLeaderboardResponse;
}
