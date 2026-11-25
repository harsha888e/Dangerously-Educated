import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { DailyLeaderboardEntry } from '../types/game';
import {
  fetchDailyLeaderboard,
  submitDailyScore,
} from '../utils/dailyApi';
import {
  formatCountdown,
  getMsUntilNextUtcMidnight,
} from '../utils/deckBuilder';

interface DailyLeaderboardProps {
  dateKey: string;
  playerId: string;
  playerName: string;
  myRun?: {
    score: number;
    correctCount: number;
    totalCount: number;
    bestStreak: number;
    durationMs: number;
  };
  onUpdatePlayerName: (name: string) => void;
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

export function DailyLeaderboard({
  dateKey,
  playerId,
  playerName,
  myRun,
  onUpdatePlayerName,
}: DailyLeaderboardProps) {
  const [entries, setEntries] = useState<DailyLeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(playerName);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedNotice, setNameSavedNotice] = useState(false);
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(getMsUntilNextUtcMidnight())
  );

  useEffect(() => {
    setNameInput(playerName);
  }, [playerName]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(getMsUntilNextUtcMidnight()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailyLeaderboard(dateKey);
      setEntries(data.entries);
      setTotalPlayers(data.totalPlayers);
    } catch {
      setError('Could not reach the global leaderboard right now.');
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  const syncedKeyRef = useRef<string | null>(null);

  // Submit official daily score once per dateKey+playerId when myRun is present, or refresh board
  useEffect(() => {
    const syncKey = `${dateKey}:${playerId}:${myRun ? 'submit' : 'view'}`;
    if (syncedKeyRef.current === syncKey) return;
    syncedKeyRef.current = syncKey;

    let active = true;
    async function syncAndLoad() {
      setLoading(true);
      setError(null);
      try {
        if (myRun) {
          const data = await submitDailyScore({
            dateKey,
            playerId,
            playerName: playerName.trim() || 'Challenger',
            score: myRun.score,
            correctCount: myRun.correctCount,
            totalCount: myRun.totalCount,
            bestStreak: myRun.bestStreak,
            durationMs: myRun.durationMs,
          });
          if (!active) return;
          setEntries(data.entries);
          setTotalPlayers(data.totalPlayers);
        } else {
          const data = await fetchDailyLeaderboard(dateKey);
          if (!active) return;
          setEntries(data.entries);
          setTotalPlayers(data.totalPlayers);
        }
      } catch {
        if (!active) return;
        setError('Could not sync with the global leaderboard right now.');
      } finally {
        if (active) setLoading(false);
      }
    }
    syncAndLoad();
    return () => {
      active = false;
    };
  }, [dateKey, playerId, myRun, playerName]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim().slice(0, 28);
    onUpdatePlayerName(trimmed);
    if (!myRun) return;

    setSavingName(true);
    setNameSavedNotice(false);
    try {
      const data = await submitDailyScore({
        dateKey,
        playerId,
        playerName: trimmed || 'Challenger',
        score: myRun.score,
        correctCount: myRun.correctCount,
        totalCount: myRun.totalCount,
        bestStreak: myRun.bestStreak,
        durationMs: myRun.durationMs,
      });
      setEntries(data.entries);
      setTotalPlayers(data.totalPlayers);
      setNameSavedNotice(true);
      window.setTimeout(() => setNameSavedNotice(false), 2500);
    } catch {
      setError('Failed to update challenger name on the leaderboard.');
    } finally {
      setSavingName(false);
    }
  };

  const myRankIndex = entries.findIndex((e) => e.playerId === playerId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>Global Daily Standings · {dateKey} UTC</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Next set in {countdown}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
            Today’s Global Leaderboard
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {myRank !== null && (
            <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
              Your Rank: #{myRank} of {totalPlayers}
            </span>
          )}
          <button
            type="button"
            onClick={loadBoard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Inline Challenger Display Name Form */}
      {myRun && (
        <form
          onSubmit={handleSaveName}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-[#0B1120] p-4"
        >
          <label
            htmlFor="daily-challenger-name"
            className="text-xs font-medium text-slate-300"
          >
            Leaderboard Name
          </label>
          <input
            id="daily-challenger-name"
            type="text"
            maxLength={28}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your display name..."
            className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {savingName
              ? 'Saving...'
              : nameSavedNotice
                ? 'Saved'
                : 'Update Name'}
          </button>
        </form>
      )}

      {/* Leaderboard Table States */}
      {loading && entries.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-sm text-slate-400">
          Loading today’s global standings...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-5 text-sm text-rose-200">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 text-sm text-slate-400">
          No scores submitted yet for {dateKey}. Finish today’s Daily Challenge
          to claim #1 on the global board.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B1120]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Challenger</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Accuracy</th>
                <th className="px-4 py-3 text-right">Streak</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {entries.map((entry, idx) => {
                const isMe = entry.playerId === playerId;
                return (
                  <tr
                    key={entry.playerId}
                    className={
                      isMe ? 'bg-amber-400/10 text-white' : 'text-slate-200'
                    }
                  >
                    <td className="px-4 py-3 font-mono font-bold tabular-nums text-amber-400">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span>{entry.playerName}</span>
                      {isMe && (
                        <span className="ml-2 text-xs font-mono text-amber-300">
                          (You)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                      {entry.correctCount}/{entry.totalCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                      {entry.bestStreak}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">
                      {formatDuration(entry.durationMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
