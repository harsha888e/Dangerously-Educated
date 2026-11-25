import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Flame,
  Globe,
  RefreshCw,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  PlayerProgress,
  WorldLeaderboardEntry,
  WorldLeaderboardSort,
} from '../types/game';
import { getUtcDateKey } from '../utils/deckBuilder';
import {
  fetchWorldLeaderboard,
  syncWorldLeaderboard,
} from '../utils/leaderboardApi';
import { getCurrentDailyStreak, getRankForXp } from '../utils/storage';
import { DailyLeaderboard } from './DailyLeaderboard';

interface WorldLeaderboardViewProps {
  progress: PlayerProgress;
  authToken: string | null;
  onUpdatePlayerName: (name: string) => void;
}

const SORT_TABS: Array<{
  id: WorldLeaderboardSort;
  label: string;
}> = [
  { id: 'xp', label: 'Total Points (XP)' },
  { id: 'dailyStreak', label: 'Daily Streak' },
  { id: 'bestDailyStreak', label: 'Best Daily Streak' },
  { id: 'highScore', label: 'Best Round Score' },
];

export function WorldLeaderboardView({
  progress,
  authToken,
  onUpdatePlayerName,
}: WorldLeaderboardViewProps) {
  const [boardTab, setBoardTab] = useState<'world' | 'daily'>('world');
  const [sortBy, setSortBy] = useState<WorldLeaderboardSort>('xp');
  const [entries, setEntries] = useState<WorldLeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [playerEntry, setPlayerEntry] = useState<WorldLeaderboardEntry | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(progress.playerName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setNameInput(progress.playerName);
  }, [progress.playerName]);

  const loadWorldBoard = useCallback(
    async (syncFirst = false) => {
      setLoading(true);
      setError(null);
      try {
        if (syncFirst) {
          await syncWorldLeaderboard(progress, authToken);
        }
        const data = await fetchWorldLeaderboard(sortBy, progress.playerId);
        setEntries(data.entries);
        setTotalPlayers(data.totalPlayers);
        setPlayerRank(data.playerRank);
        setPlayerEntry(data.playerEntry);
      } catch {
        setError('Could not load the world leaderboard right now.');
      } finally {
        setLoading(false);
      }
    },
    [sortBy, progress, authToken]
  );

  useEffect(() => {
    if (boardTab !== 'world') return;
    loadWorldBoard(true);
  }, [boardTab, sortBy, progress.playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim().slice(0, 28);
    onUpdatePlayerName(cleaned);
    setSavingName(true);
    setNameSaved(false);
    try {
      await syncWorldLeaderboard(
        {
          ...progress,
          playerName: cleaned,
        },
        authToken
      );
      await loadWorldBoard(false);
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2500);
    } catch {
      setError('Could not update your leaderboard name.');
    } finally {
      setSavingName(false);
    }
  };

  const todayKey = getUtcDateKey();
  const activeDailyStreak = getCurrentDailyStreak(progress, todayKey);
  const bestRoundScore = Math.max(
    progress.highScoreStandard,
    progress.highScoreBlitz,
    progress.highScoreSurvival
  );

  const formatAccuracy = (correct: number, answered: number) => {
    if (answered <= 0) return '—';
    return `${Math.round((correct / answered) * 100)}%`;
  };

  const providerLabel = (provider: WorldLeaderboardEntry['provider']) =>
    provider === 'google'
      ? 'Google'
      : provider === 'facebook'
        ? 'Facebook'
        : 'Guest';

  const isPlayerInTop = entries.some((e) => e.playerId === progress.playerId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Header & Board Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Globe className="h-4 w-4" />
            <span>Global Standings · All Players Worldwide</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            World Leaderboard
          </h1>
          <p className="text-sm text-slate-400">
            Compare all-time points, active daily streaks, best streaks, and
            high scores across challengers worldwide.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-[#131C31] p-1.5">
          <button
            type="button"
            onClick={() => setBoardTab('world')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              boardTab === 'world'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>All-Time World</span>
          </button>
          <button
            type="button"
            onClick={() => setBoardTab('daily')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              boardTab === 'daily'
                ? 'bg-emerald-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Today’s Daily ({todayKey})</span>
          </button>
        </div>
      </div>

      {boardTab === 'daily' ? (
        <DailyLeaderboard
          dateKey={todayKey}
          playerId={progress.playerId}
          playerName={progress.playerName}
          myRun={
            progress.dailyHistory?.[todayKey]
              ? {
                  score: progress.dailyHistory[todayKey].score,
                  correctCount: progress.dailyHistory[todayKey].correctCount,
                  totalCount: progress.dailyHistory[todayKey].totalCount,
                  bestStreak: progress.dailyHistory[todayKey].bestStreak,
                  durationMs: progress.dailyHistory[todayKey].durationMs,
                }
              : undefined
          }
          onUpdatePlayerName={onUpdatePlayerName}
        />
      ) : (
        <div className="space-y-6">
          {/* Player Standing Snapshot */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
              <p className="text-xs text-slate-400">Your World Rank</p>
              <p className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
                {playerRank !== null ? `#${playerRank}` : '—'}
              </p>
              <p className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                of {totalPlayers.toLocaleString()} ranked
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
              <p className="text-xs text-slate-400">Total Points (XP)</p>
              <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                {progress.xp.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {getRankForXp(progress.xp).title}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
              <p className="text-xs text-slate-400">Current Daily Streak</p>
              <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                {activeDailyStreak} {activeDailyStreak === 1 ? 'day' : 'days'}
              </p>
              <p className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                Best: {progress.bestDailyStreak}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
              <p className="text-xs text-slate-400">Best Round Score</p>
              <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                {bestRoundScore.toLocaleString()}
              </p>
              <p className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                {progress.gamesPlayed} rounds played
              </p>
            </div>
          </section>

          {/* Controls Bar: Sort Metrics + Display Name + Refresh */}
          <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0B1120] p-1.5">
                {SORT_TABS.map((tab) => {
                  const active = sortBy === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSortBy(tab.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-slate-800 text-amber-400'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => loadWorldBoard(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                <span>Refresh Standings</span>
              </button>
            </div>

            <form
              onSubmit={handleSaveName}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-[#0B1120] p-3.5"
            >
              <label
                htmlFor="world-board-name"
                className="text-xs font-medium text-slate-300"
              >
                Public Leaderboard Name
              </label>
              <input
                id="world-board-name"
                type="text"
                maxLength={28}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Challenger"
                className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingName}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {savingName ? 'Saving...' : nameSaved ? 'Saved' : 'Update Name'}
              </button>
            </form>

            {loading && entries.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-sm text-slate-400">
                Loading global standings...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-5 text-sm text-rose-200">
                {error}
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-sm text-slate-400">
                No challengers ranked yet. Play a round to claim #1 on the World
                Leaderboard!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B1120]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Challenger</th>
                      <th className="px-4 py-3 text-right">Daily Streak</th>
                      <th className="px-4 py-3 text-right">Best Daily</th>
                      <th className="px-4 py-3 text-right">Points (XP)</th>
                      <th className="px-4 py-3 text-right">High Score</th>
                      <th className="px-4 py-3 text-right">Accuracy</th>
                      <th className="px-4 py-3 text-right">Rounds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {entries.map((entry, idx) => {
                      const isMe = entry.playerId === progress.playerId;
                      return (
                        <tr
                          key={entry.playerId}
                          className={
                            isMe
                              ? 'bg-amber-400/10 text-white'
                              : 'text-slate-200'
                          }
                        >
                          <td className="px-4 py-3 font-mono font-bold tabular-nums text-amber-400">
                            #{idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {entry.avatarUrl ? (
                                <img
                                  src={entry.avatarUrl}
                                  alt={entry.playerName}
                                  className="h-6 w-6 rounded-md object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 font-mono text-[11px] font-bold text-amber-400 shrink-0">
                                  {entry.playerName.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {entry.playerName}
                                  {isMe && (
                                    <span className="ml-2 text-xs font-mono text-amber-300">
                                      (You)
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] font-mono text-slate-400">
                                  {providerLabel(entry.provider)} ·{' '}
                                  {getRankForXp(entry.xp).title}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                            <span
                              className={`inline-flex items-center justify-end gap-1 ${
                                entry.currentDailyStreak > 0
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {entry.currentDailyStreak > 0 && (
                                <Flame className="h-3.5 w-3.5 text-amber-400" />
                              )}
                              <span>{entry.currentDailyStreak}d</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {entry.bestDailyStreak}d
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-white">
                            {entry.xp.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-300">
                            {entry.bestRoundScore.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                            {formatAccuracy(
                              entry.totalCorrect,
                              entry.totalAnswered
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">
                            {entry.gamesPlayed}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isPlayerInTop && playerEntry && playerRank !== null && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-mono tabular-nums">
                <span className="text-amber-300 font-bold">
                  Your Standing: #{playerRank} · {playerEntry.playerName}
                </span>
                <span className="inline-flex items-center gap-3 text-slate-200">
                  <span>{playerEntry.currentDailyStreak}d daily streak</span>
                  <span aria-hidden="true">·</span>
                  <span>{playerEntry.xp.toLocaleString()} XP</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Zap className="h-3.5 w-3.5" />
                    {playerEntry.bestRoundScore.toLocaleString()} best
                  </span>
                </span>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
