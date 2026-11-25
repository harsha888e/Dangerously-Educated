import {
  ArrowLeft,
  Bookmark,
  Check,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { getCategoryLabel } from '../data/questions';
import {
  DeckSelection,
  GameMode,
  ModeSettings,
  PlayerProgress,
  RoundAnswerRecord,
} from '../types/game';
import { getCurrentDailyStreak, getRankForXp } from '../utils/storage';
import { DailyLeaderboard } from './DailyLeaderboard';

interface RoundSummaryProps {
  deckSelection: DeckSelection;
  mode: GameMode;
  dailyDateKey?: string;
  modeSettings: ModeSettings;
  score: number;
  bestStreak: number;
  durationMs: number;
  records: RoundAnswerRecord[];
  endedReason: 'completed' | 'time_up' | 'out_of_lives' | 'quit';
  progress: PlayerProgress;
  onUpdatePlayerName: (name: string) => void;
  onToggleBookmark: (questionId: string) => void;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export function RoundSummary({
  deckSelection,
  mode,
  dailyDateKey,
  modeSettings,
  score,
  bestStreak,
  durationMs,
  records,
  endedReason,
  progress,
  onUpdatePlayerName,
  onToggleBookmark,
  onPlayAgain,
  onBackToLobby,
}: RoundSummaryProps) {
  const rank = getRankForXp(progress.xp);
  const dailyStreak = getCurrentDailyStreak(progress);
  const hits = records.filter((r) => r.outcome !== 'wrong').length;
  const accuracy =
    records.length > 0 ? Math.round((hits / records.length) * 100) : 0;

  const heading =
    mode === 'daily'
      ? endedReason === 'quit'
        ? 'Daily Challenge Ended Early'
        : 'Daily Challenge Complete'
      : endedReason === 'time_up'
        ? 'Time Expired — Blitz Complete'
        : endedReason === 'out_of_lives'
          ? 'Out of Lives — Survival Run Over'
          : endedReason === 'quit'
            ? 'Run Ended Early'
            : 'Round Complete';

  const modeLabel =
    mode === 'daily'
      ? `Daily Challenge · ${dailyDateKey ?? ''}`
      : mode === 'standard'
        ? `Standard · ${modeSettings.standardRounds} Rounds`
        : mode === 'blitz'
          ? `Blitz · ${modeSettings.blitzSeconds}s`
          : `Survival · ${modeSettings.survivalLives} ${
              modeSettings.survivalLives === 1 ? 'Life' : 'Lives'
            }`;

  const deckLabel =
    mode === 'daily'
      ? 'Global 12-Card Set'
      : deckSelection === 'all'
        ? 'Danger Mix'
        : getCategoryLabel(deckSelection);

  const canReplay = !(mode === 'daily' && endedReason === 'completed');

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Top Scorecard Summary */}
      <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400">
              {deckLabel} · {modeLabel} · {rank.title}
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
              {heading}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackToLobby}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All Decks</span>
            </button>
            {canReplay && (
              <button
                type="button"
                onClick={onPlayAgain}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Play Next Round</span>
              </button>
            )}
          </div>
        </div>

        <div
          className={`grid grid-cols-2 gap-4 ${
            mode === 'daily' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
          } border-t border-slate-800 pt-6`}
        >
          <div>
            <p className="text-xs text-slate-400">Round Score</p>
            <p className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
              {score.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Hit Rate</p>
            <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
              {accuracy}% ({hits}/{records.length})
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Best Streak</p>
            <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
              {bestStreak}
            </p>
          </div>
          {mode === 'daily' && (
            <div>
              <p className="text-xs text-slate-400">Daily Streak</p>
              <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
              </p>
              {progress.bestDailyStreak > 0 && (
                <p className="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                  Best: {progress.bestDailyStreak}
                </p>
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400">Total XP</p>
            <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
              {progress.xp.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* Global Daily Leaderboard Summary */}
      {mode === 'daily' && dailyDateKey && (
        <DailyLeaderboard
          dateKey={dailyDateKey}
          playerId={progress.playerId}
          playerName={progress.playerName}
          myRun={
            endedReason === 'completed'
              ? {
                  score,
                  correctCount: hits,
                  totalCount: records.length,
                  bestStreak,
                  durationMs,
                }
              : undefined
          }
          onUpdatePlayerName={onUpdatePlayerName}
        />
      )}

      {/* Unlocked Facts Digest */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold text-white">
            Facts Unlocked This Round
          </h2>
          <span className="text-xs text-slate-400">
            Bookmark any takeaway to keep it in Field Notes
          </span>
        </div>

        {records.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#131C31] p-6 text-sm text-slate-400">
            No questions were answered before ending this run. Start a fresh
            round to unlock new facts.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => {
              const saved = progress.bookmarkedIds.includes(rec.question.id);
              return (
                <article
                  key={rec.question.id}
                  className="rounded-xl border border-slate-800 bg-[#131C31] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">
                        {getCategoryLabel(rec.question.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.question.subtopic}</span>
                      <span aria-hidden="true">·</span>
                      {rec.outcome === 'correct' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>+{rec.pointsEarned} pts</span>
                        </span>
                      )}
                      {rec.outcome === 'close' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Close (+{rec.pointsEarned} pts)</span>
                        </span>
                      )}
                      {rec.outcome === 'wrong' && (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                          <X className="h-3.5 w-3.5" />
                          <span>Missed</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleBookmark(rec.question.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        saved
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${
                          saved ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                      <span>{saved ? 'Saved' : 'Save Fact'}</span>
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {rec.question.prompt}
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {rec.question.fact}
                  </p>
                  <p className="text-xs font-mono text-slate-400">
                    Answer: {rec.correctAnswerLabel}
                    {rec.outcome === 'wrong'
                      ? ` · Your answer: ${rec.userAnswerLabel}`
                      : ''}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
