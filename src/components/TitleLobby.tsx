import { RefObject, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Flame,
  Heart,
  Play,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DECKS, QUESTIONS } from '../data/questions';
import {
  CategoryId,
  DeckSelection,
  GameMode,
  ModeSettings,
  PlayerProgress,
} from '../types/game';
import {
  formatCountdown,
  getMsUntilNextUtcMidnight,
  getUtcDateKey,
} from '../utils/deckBuilder';
import {
  getCategoryAccuracy,
  getCurrentDailyStreak,
  getRankForXp,
} from '../utils/storage';
import { DeckArtwork } from './DeckArtwork';

interface TitleLobbyProps {
  progress: PlayerProgress;
  selectedMode: GameMode;
  modeSettings: ModeSettings;
  onSelectMode: (mode: GameMode) => void;
  onUpdateModeSettings: (next: ModeSettings) => void;
  onUpdatePlayerName: (name: string) => void;
  onStartGame: (deck: DeckSelection, mode?: GameMode) => void;
  onViewTodayDailySummary: () => void;
  onToggleSound: () => void;
  onOpenFieldNotes: () => void;
  onOpenLeaderboard: () => void;
  decksRef: RefObject<HTMLElement | null>;
}

const MODE_OPTIONS: Array<{
  id: GameMode;
  label: string;
  detail: string;
}> = [
  {
    id: 'standard',
    label: 'Standard',
    detail: 'Curated round length · Streak multipliers · Double Down wagers',
  },
  {
    id: 'blitz',
    label: 'Blitz',
    detail: 'Countdown clock · +3s per 2-streak · Endless wave reshuffle',
  },
  {
    id: 'survival',
    label: 'Survival',
    detail: 'Set your lives · Endless waves · Escalating streak run',
  },
  {
    id: 'daily',
    label: 'Daily',
    detail: 'Same 12 cards for everyone every 24h · Global leaderboard',
  },
];

export function TitleLobby({
  progress,
  selectedMode,
  modeSettings,
  onSelectMode,
  onUpdateModeSettings,
  onUpdatePlayerName,
  onStartGame,
  onViewTodayDailySummary,
  onToggleSound,
  onOpenFieldNotes,
  onOpenLeaderboard,
  decksRef,
}: TitleLobbyProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayKey = getUtcDateKey(now);
  const countdown = formatCountdown(getMsUntilNextUtcMidnight(now));
  const todayDailyRun = progress.dailyHistory?.[todayKey];
  const dailyStreak = getCurrentDailyStreak(progress, todayKey);

  const rank = getRankForXp(progress.xp);
  const xpIntoTier = progress.xp - rank.minXp;
  const tierSpan = rank.nextXp ? rank.nextXp - rank.minXp : 1;
  const rankPercent = rank.nextXp
    ? Math.min(100, Math.round((xpIntoTier / tierSpan) * 100))
    : 100;

  const totalUnseen = QUESTIONS.filter(
    (q) => !progress.seenIds.includes(q.id)
  ).length;

  const getDeckCounts = (category: CategoryId) => {
    const cards = QUESTIONS.filter((q) => q.category === category);
    const unseen = cards.filter((q) => !progress.seenIds.includes(q.id)).length;
    const accuracy = getCategoryAccuracy(progress, category);
    return { total: cards.length, unseen, accuracy };
  };

  const renderModeIcon = (mode: GameMode) => {
    switch (mode) {
      case 'standard':
        return <Flame className="h-4 w-4 text-amber-400 shrink-0" />;
      case 'blitz':
        return <Timer className="h-4 w-4 text-sky-400 shrink-0" />;
      case 'survival':
        return <Heart className="h-4 w-4 text-rose-400 shrink-0" />;
      case 'daily':
        return <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-12">
      {/* Hero Arena Entry */}
      <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span className="text-amber-400">{rank.title}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {progress.xp.toLocaleString()} XP
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {totalUnseen} of {QUESTIONS.length} unseen cards
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1] text-balance max-w-2xl">
              Learn wildly specific things you weren’t supposed to know.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Six fun general-knowledge decks spanning movies, video games,
              cars, everyday trivia, quick maths, and brain-teasing aptitude.
              Every card gives you a crisp takeaway worth remembering.
            </p>

            {/* Interactive Mode & Round Length Selector */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-950/70 p-1.5 border border-slate-800">
                  {MODE_OPTIONS.map((mode) => {
                    const active = selectedMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSelectMode(mode.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {renderModeIcon(mode.id)}
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Round / Duration / Lives Sub-Selector */}
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-950/70 p-1.5 border border-slate-800">
                  {selectedMode === 'standard' &&
                    ([10, 15, 25] as const).map((rounds) => (
                      <button
                        key={rounds}
                        type="button"
                        onClick={() =>
                          onUpdateModeSettings({
                            ...modeSettings,
                            standardRounds: rounds,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          modeSettings.standardRounds === rounds
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {rounds} Rounds
                      </button>
                    ))}

                  {selectedMode === 'blitz' &&
                    ([
                      { sec: 60, label: '60s' },
                      { sec: 90, label: '90s' },
                      { sec: 120, label: '120s' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() =>
                          onUpdateModeSettings({
                            ...modeSettings,
                            blitzSeconds: opt.sec,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          modeSettings.blitzSeconds === opt.sec
                            ? 'bg-sky-400 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}

                  {selectedMode === 'survival' &&
                    ([
                      { lives: 1, label: '1 Life' },
                      { lives: 3, label: '3 Lives' },
                      { lives: 5, label: '5 Lives' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.lives}
                        type="button"
                        onClick={() =>
                          onUpdateModeSettings({
                            ...modeSettings,
                            survivalLives: opt.lives,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          modeSettings.survivalLives === opt.lives
                            ? 'bg-rose-400 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  {selectedMode === 'daily' && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono text-emerald-300">
                      <span>{todayKey} UTC</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Resets {countdown}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Daily Streak: {dailyStreak}{' '}
                        {dailyStreak === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedMode === 'daily' && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5">
                  <label
                    htmlFor="lobby-challenger-name"
                    className="text-xs font-medium text-slate-300"
                  >
                    Challenger Name
                  </label>
                  <input
                    id="lobby-challenger-name"
                    type="text"
                    maxLength={28}
                    value={progress.playerName}
                    onChange={(e) => onUpdatePlayerName(e.target.value)}
                    placeholder="Optional leaderboard name"
                    className="flex-1 min-w-[170px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  {todayDailyRun ? (
                    <span className="text-xs font-mono text-emerald-400 tabular-nums">
                      Done today · {todayDailyRun.score.toLocaleString()} pts
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      Streak: {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-400">
                {MODE_OPTIONS.find((m) => m.id === selectedMode)?.detail}
              </p>
            </div>

            {/* Primary CTA Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {selectedMode === 'daily' && todayDailyRun ? (
                <button
                  type="button"
                  onClick={onViewTodayDailySummary}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-400 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131C31]"
                >
                  <Trophy className="h-4 w-4" />
                  <span>View Daily Leaderboard</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartGame('all', selectedMode)}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-300 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131C31]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {selectedMode === 'daily'
                      ? 'Play Daily Challenge'
                      : 'Play Danger Mix'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenFieldNotes}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-slate-400" />
                <span>
                  Field Notes ({progress.bookmarkedIds.length} saved)
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3.5 text-sm font-medium text-slate-200 hover:border-amber-400/70 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>World Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                aria-label={
                  progress.soundEnabled
                    ? 'Mute game sound effects'
                    : 'Enable game sound effects'
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {progress.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                )}
                <span>{progress.soundEnabled ? 'Audio On' : 'Audio Muted'}</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Compact Career Snapshot */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Current Standing
                </p>
                <h2 className="font-display text-xl font-bold text-white mt-0.5">
                  {rank.title}
                </h2>
              </div>
              <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                {progress.xp.toLocaleString()} XP
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${rankPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-mono tabular-nums">
                <span>{rankPercent}% to next rank</span>
                <span>
                  {rank.nextXp
                    ? `${rank.nextXp.toLocaleString()} XP`
                    : 'Max Rank'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <p className="text-xs text-slate-400">Daily Streak</p>
                <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                  {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Best Streak</p>
                <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                  {progress.bestStreak}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Accuracy</p>
                <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                  {progress.totalAnswered > 0
                    ? `${Math.round(
                        (progress.totalCorrect / progress.totalAnswered) * 100
                      )}%`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">High Score</p>
                <p className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                  {Math.max(
                    progress.highScoreStandard,
                    progress.highScoreBlitz,
                    progress.highScoreSurvival
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Next Daily Challenge</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums">
                <span className="font-semibold text-emerald-400">
                  {countdown}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                {todayDailyRun ? (
                  <button
                    type="button"
                    onClick={onViewTodayDailySummary}
                    className="text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Done today
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectMode('daily')}
                    className="text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Today open
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3 text-xs text-slate-400 leading-relaxed">
              Three card types keep every round sharp: Multiple Choice deep
              cuts, Fact or Fiction bluffs, and Numeric Estimate sliders.
            </div>
          </div>
        </div>
      </section>

      {/* Topic Decks Section */}
      <section ref={decksRef} className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Choose a Focused Deck
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Play a single subject using your selected mode, or hit Quick Mix
              for all six combined.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {QUESTIONS.length} total cards across 6 decks
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DECKS.map((deck) => {
            const counts = getDeckCounts(deck.id);
            return (
              <article
                key={deck.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#131C31] transition-transform duration-200 hover:-translate-y-1 hover:border-slate-700"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                  <DeckArtwork
                    category={deck.id}
                    src={deck.imagePath}
                    alt={`${deck.title} deck illustration`}
                    className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#131C31] via-transparent to-transparent" />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono tabular-nums">
                        {counts.total} cards
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {counts.unseen} new
                      </span>
                      {counts.accuracy > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-emerald-400">
                            {counts.accuracy}% hit
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-display text-lg font-bold text-white">
                      {deck.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {deck.subtitle}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onStartGame(
                        deck.id,
                        selectedMode === 'daily' ? 'standard' : selectedMode
                      )
                    }
                    className="inline-flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-white hover:border-amber-400 hover:bg-amber-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Play {deck.title.split(' ')[0]}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
