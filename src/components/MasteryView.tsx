import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { DECKS, QUESTIONS } from '../data/questions';
import { PlayerProgress } from '../types/game';
import {
  getCategoryAccuracy,
  getCurrentDailyStreak,
  getRankForXp,
  RANK_TIERS,
} from '../utils/storage';

interface MasteryViewProps {
  progress: PlayerProgress;
  onResetProgress: () => void;
}

export function MasteryView({ progress, onResetProgress }: MasteryViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const currentRank = getRankForXp(progress.xp);
  const currentDailyStreak = getCurrentDailyStreak(progress);

  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-white">
            Polymath Mastery
          </h1>
          <p className="text-sm text-slate-400">
            Track your accuracy across all six decks and climb from Curious
            Bystander to Grand Polymath.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-rose-500/60 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Progress</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Key Lifetime Metrics */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
          <p className="text-xs text-slate-400">Total XP</p>
          <p className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
            {progress.xp.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
          <p className="text-xs text-slate-400">Overall Accuracy</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {overallAccuracy}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
          <p className="text-xs text-slate-400">Best Streak</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {progress.bestStreak}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#131C31] p-5">
          <p className="text-xs text-slate-400">Cards Seen</p>
          <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
            {progress.seenIds.length} / {QUESTIONS.length}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Category Mastery Breakdown */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131C31] p-6 space-y-5">
          <h2 className="font-display text-xl font-bold text-white">
            Deck Accuracy &amp; Coverage
          </h2>

          <div className="space-y-4">
            {DECKS.map((deck) => {
              const stats = progress.categoryStats?.[deck.id] ?? {
                answered: 0,
                correct: 0,
              };
              const acc = getCategoryAccuracy(progress, deck.id);
              const totalCards = QUESTIONS.filter(
                (q) => q.category === deck.id
              ).length;
              const seenInCat = QUESTIONS.filter(
                (q) =>
                  q.category === deck.id && progress.seenIds.includes(q.id)
              ).length;
              const coverage = Math.round((seenInCat / totalCards) * 100);

              return (
                <div
                  key={deck.id}
                  className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-white">
                      {deck.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-400 tabular-nums">
                      <span>
                        {seenInCat}/{totalCards} seen ({coverage}%)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-200 font-semibold">
                        {stats.answered > 0 ? `${acc}% hit rate` : 'No runs yet'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${stats.answered > 0 ? acc : 0}%`,
                        backgroundColor: deck.accentHex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-800 pt-4">
            <div>
              <p className="text-xs text-slate-400">Daily Streak</p>
              <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                {currentDailyStreak} {currentDailyStreak === 1 ? 'day' : 'days'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Best Daily</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                {progress.bestDailyStreak}{' '}
                {progress.bestDailyStreak === 1 ? 'day' : 'days'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Standard Best</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                {progress.highScoreStandard.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Blitz Best</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                {progress.highScoreBlitz.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Survival Best</p>
              <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                {progress.highScoreSurvival.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* Rank Ladder */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131C31] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Knowledge Rank Ladder
          </h2>

          <div className="space-y-2.5">
            {RANK_TIERS.map((tier) => {
              const unlocked = progress.xp >= tier.minXp;
              const isCurrent = currentRank.title === tier.title;
              return (
                <div
                  key={tier.title}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    isCurrent
                      ? 'border-amber-400/70 bg-amber-400/10'
                      : unlocked
                        ? 'border-slate-800 bg-[#0B1120]'
                        : 'border-slate-800/50 bg-[#0B1120]/40 opacity-55'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        unlocked
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-slate-700 text-slate-600'
                      }`}
                    >
                      {unlocked && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isCurrent ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {tier.title}
                    </span>
                  </div>

                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {tier.minXp.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
