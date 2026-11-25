import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  Flame,
  Heart,
  Scissors,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { getCategoryLabel } from '../data/questions';
import {
  DeckSelection,
  GameMode,
  RoundAnswerRecord,
  TriviaQuestion,
} from '../types/game';
import {
  buildPlayableDeck,
  getCorrectAnswerText,
  getDifficultyLabel,
} from '../utils/deckBuilder';
import { soundFx } from '../utils/sound';
import { StreakFireCounter } from './StreakFireCounter';

interface GameArenaProps {
  deckSelection: DeckSelection;
  mode: GameMode;
  dailyDateKey?: string;
  questions: TriviaQuestion[];
  initialTimeSeconds: number;
  initialLives: number;
  seenIds: string[];
  bookmarkedIds: string[];
  soundEnabled: boolean;
  currentDailyStreak: number;
  onToggleSound: () => void;
  onToggleBookmark: (questionId: string) => void;
  onRecordAnswer: (record: RoundAnswerRecord) => void;
  onFinishRun: (summary: {
    score: number;
    bestStreak: number;
    durationMs: number;
    records: RoundAnswerRecord[];
    endedReason: 'completed' | 'time_up' | 'out_of_lives' | 'quit';
  }) => void;
}

interface RevealState {
  outcome: 'correct' | 'close' | 'wrong';
  pointsEarned: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
  selectedOptionIndex?: number;
  selectedBoolean?: boolean;
  submittedEstimate?: number;
  doubled: boolean;
}

const KEY_LABELS = ['1', '2', '3', '4'];

export function GameArena({
  deckSelection,
  mode,
  dailyDateKey,
  questions,
  initialTimeSeconds,
  initialLives,
  seenIds,
  bookmarkedIds,
  soundEnabled,
  currentDailyStreak,
  onToggleSound,
  onToggleBookmark,
  onRecordAnswer,
  onFinishRun,
}: GameArenaProps) {
  const [deckCards, setDeckCards] = useState<TriviaQuestion[]>(questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(initialLives);
  const [timeLeftMs, setTimeLeftMs] = useState(initialTimeSeconds * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const [records, setRecords] = useState<RoundAnswerRecord[]>([]);

  const [fiftyFiftyCharges, setFiftyFiftyCharges] = useState(1);
  const [eliminatedIndices, setEliminatedIndices] = useState<number[]>([]);
  const [doubleDownActive, setDoubleDownActive] = useState(false);

  const currentQuestion = deckCards[currentIndex];

  const initialEstimateValue = useMemo(() => {
    if (!currentQuestion || currentQuestion.format !== 'estimate') return 0;
    const mid = (currentQuestion.min + currentQuestion.max) / 2;
    const snapped =
      Math.round(mid / currentQuestion.step) * currentQuestion.step;
    return Number(snapped.toFixed(2));
  }, [currentQuestion]);

  const [estimateValue, setEstimateValue] = useState<number>(
    initialEstimateValue
  );
  const [reveal, setReveal] = useState<RevealState | null>(null);

  useEffect(() => {
    setEstimateValue(initialEstimateValue);
    setEliminatedIndices([]);
    setDoubleDownActive(false);
  }, [currentIndex, initialEstimateValue]);

  const finishGame = useCallback(
    (
      finalScore: number,
      finalBestStreak: number,
      finalRecords: RoundAnswerRecord[],
      endedReason: 'completed' | 'time_up' | 'out_of_lives' | 'quit'
    ) => {
      if (endedReason !== 'quit') {
        soundFx.roundComplete();
      }
      onFinishRun({
        score: finalScore,
        bestStreak: finalBestStreak,
        durationMs: Math.max(0, Date.now() - startedAtRef.current),
        records: finalRecords,
        endedReason,
      });
    },
    [onFinishRun]
  );

  // Elapsed stopwatch for Daily Challenge
  useEffect(() => {
    if (mode !== 'daily') return;
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(interval);
  }, [mode]);

  // Blitz mode timer: ticks smoothly while question is active; pauses during reveal so players can read
  useEffect(() => {
    if (mode !== 'blitz' || reveal !== null || !currentQuestion) return;

    const interval = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [mode, reveal, currentQuestion]);

  useEffect(() => {
    if (mode === 'blitz' && timeLeftMs === 0 && reveal === null) {
      finishGame(score, bestStreak, records, 'time_up');
    }
  }, [mode, timeLeftMs, reveal, score, bestStreak, records, finishGame]);

  const multiplier = Math.min(4, 1 + Math.floor(streak / 2) * 0.5);

  const lockInResult = useCallback(
    (
      outcome: 'correct' | 'close' | 'wrong',
      userAnswerLabel: string,
      extra?: {
        selectedOptionIndex?: number;
        selectedBoolean?: boolean;
        submittedEstimate?: number;
      }
    ) => {
      if (!currentQuestion || reveal !== null) return;

      const difficultyBase =
        currentQuestion.difficulty === 'obscure'
          ? 200
          : currentQuestion.difficulty === 'sharp'
            ? 150
            : 100;

      let earned = 0;
      let nextStreak = streak;

      if (outcome === 'correct') {
        nextStreak = streak + 1;
        earned = Math.round(
          difficultyBase * multiplier * (doubleDownActive ? 2 : 1)
        );
        soundFx.correct(nextStreak);
        if (mode === 'blitz' && nextStreak % 2 === 0) {
          setTimeLeftMs((prev) => prev + 3000);
        }
        if (nextStreak > 0 && nextStreak % 4 === 0) {
          setFiftyFiftyCharges((c) => c + 1);
        }
      } else if (outcome === 'close') {
        nextStreak = streak + 1;
        earned = Math.round(
          difficultyBase * 0.65 * multiplier * (doubleDownActive ? 2 : 1)
        );
        soundFx.close();
      } else {
        nextStreak = 0;
        earned = 0;
        soundFx.wrong();
        if (mode === 'survival') {
          setLives((l) => Math.max(0, l - 1));
        }
      }

      const nextBestStreak = Math.max(bestStreak, nextStreak);
      const nextScore = score + earned;
      const correctAnswerLabel = getCorrectAnswerText(currentQuestion);

      setStreak(nextStreak);
      setBestStreak(nextBestStreak);
      setScore(nextScore);

      const newReveal: RevealState = {
        outcome,
        pointsEarned: earned,
        userAnswerLabel,
        correctAnswerLabel,
        doubled: doubleDownActive,
        ...extra,
      };
      setReveal(newReveal);

      const record: RoundAnswerRecord = {
        question: currentQuestion,
        outcome,
        pointsEarned: earned,
        userAnswerLabel,
        correctAnswerLabel,
        doubled: doubleDownActive,
      };
      setRecords((prev) => [...prev, record]);
      onRecordAnswer(record);
    },
    [
      currentQuestion,
      reveal,
      streak,
      multiplier,
      doubleDownActive,
      mode,
      bestStreak,
      score,
      onRecordAnswer,
    ]
  );

  const handleSelectOption = useCallback(
    (index: number) => {
      if (
        !currentQuestion ||
        currentQuestion.format !== 'multiple_choice' ||
        reveal !== null ||
        eliminatedIndices.includes(index)
      ) {
        return;
      }
      const isCorrect = index === currentQuestion.correctIndex;
      lockInResult(
        isCorrect ? 'correct' : 'wrong',
        currentQuestion.options[index],
        { selectedOptionIndex: index }
      );
    },
    [currentQuestion, reveal, eliminatedIndices, lockInResult]
  );

  const handleSelectFactOrFiction = useCallback(
    (choice: boolean) => {
      if (
        !currentQuestion ||
        currentQuestion.format !== 'fact_or_fiction' ||
        reveal !== null
      ) {
        return;
      }
      const isCorrect = choice === currentQuestion.isTrue;
      lockInResult(
        isCorrect ? 'correct' : 'wrong',
        choice ? 'True Fact' : 'Pure Fiction',
        { selectedBoolean: choice }
      );
    },
    [currentQuestion, reveal, lockInResult]
  );

  const handleSubmitEstimate = useCallback(() => {
    if (
      !currentQuestion ||
      currentQuestion.format !== 'estimate' ||
      reveal !== null
    ) {
      return;
    }
    const diff = Math.abs(estimateValue - currentQuestion.correctValue);
    let outcome: 'correct' | 'close' | 'wrong' = 'wrong';
    if (diff <= currentQuestion.toleranceExact) {
      outcome = 'correct';
    } else if (diff <= currentQuestion.toleranceClose) {
      outcome = 'close';
    }
    const unitSuffix = currentQuestion.unit ? ` ${currentQuestion.unit}` : '';
    lockInResult(outcome, `${estimateValue}${unitSuffix}`, {
      submittedEstimate: estimateValue,
    });
  }, [currentQuestion, reveal, estimateValue, lockInResult]);

  const handleUseFiftyFifty = useCallback(() => {
    if (
      !currentQuestion ||
      currentQuestion.format !== 'multiple_choice' ||
      reveal !== null ||
      fiftyFiftyCharges <= 0 ||
      eliminatedIndices.length > 0
    ) {
      return;
    }
    const wrongIndices = [0, 1, 2, 3].filter(
      (i) => i !== currentQuestion.correctIndex
    );
    const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
    setEliminatedIndices(shuffled.slice(0, 2));
    setFiftyFiftyCharges((c) => c - 1);
    soundFx.lifeline();
  }, [currentQuestion, reveal, fiftyFiftyCharges, eliminatedIndices]);

  const handleNextQuestion = useCallback(() => {
    if (!reveal) return;
    soundFx.click();

    if (mode === 'survival' && lives <= 0) {
      finishGame(score, bestStreak, records, 'out_of_lives');
      return;
    }

    if (currentIndex + 1 >= deckCards.length) {
      if (mode === 'blitz' || mode === 'survival') {
        const nextWave = buildPlayableDeck(deckSelection, seenIds);
        setDeckCards((prev) => [...prev, ...nextWave]);
        if (mode === 'survival') {
          setFiftyFiftyCharges((c) => c + 1);
        }
        setReveal(null);
        setCurrentIndex((i) => i + 1);
        return;
      }

      finishGame(score, bestStreak, records, 'completed');
      return;
    }

    setReveal(null);
    setCurrentIndex((i) => i + 1);
  }, [
    reveal,
    mode,
    lives,
    currentIndex,
    deckCards.length,
    deckSelection,
    seenIds,
    finishGame,
    score,
    bestStreak,
    records,
  ]);

  // Keyboard shortcuts for snappy play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type !== 'range'
      ) {
        return;
      }

      if (reveal !== null) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }

      if (!currentQuestion) return;

      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDoubleDownActive((v) => !v);
        soundFx.click();
        return;
      }

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleUseFiftyFifty();
        return;
      }

      if (currentQuestion.format === 'multiple_choice') {
        const idx = KEY_LABELS.indexOf(e.key);
        if (idx !== -1) {
          e.preventDefault();
          handleSelectOption(idx);
        }
      } else if (currentQuestion.format === 'fact_or_fiction') {
        if (e.key === '1' || e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleSelectFactOrFiction(true);
        } else if (e.key === '2' || e.key.toLowerCase() === 'f') {
          e.preventDefault();
          handleSelectFactOrFiction(false);
        }
      } else if (currentQuestion.format === 'estimate') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmitEstimate();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    reveal,
    currentQuestion,
    handleNextQuestion,
    handleUseFiftyFifty,
    handleSelectOption,
    handleSelectFactOrFiction,
    handleSubmitEstimate,
  ]);

  if (!currentQuestion) {
    return null;
  }

  const isBookmarked = bookmarkedIds.includes(currentQuestion.id);
  const deckTitle =
    mode === 'daily'
      ? `Daily ${dailyDateKey ?? ''}`
      : deckSelection === 'all'
        ? 'Danger Mix'
        : getCategoryLabel(deckSelection);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
      {/* Unobtrusive Top Arena HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#131C31] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-slate-400">Deck &amp; Progress</p>
            <p className="text-sm font-semibold text-white font-mono tabular-nums">
              {deckTitle} ·{' '}
              {mode === 'standard' || mode === 'daily'
                ? `${currentIndex + 1} / ${deckCards.length}`
                : `Wave ${Math.floor(currentIndex / Math.max(1, questions.length)) + 1} · Card ${currentIndex + 1}`}
            </p>
          </div>

          {mode === 'daily' && (
            <div className="border-l border-slate-800 pl-4">
              <p className="text-xs text-slate-400">Run Time</p>
              <p className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>
          )}

          {mode === 'blitz' && (
            <div className="border-l border-slate-800 pl-4">
              <p className="text-xs text-slate-400">Clock</p>
              <p
                className={`text-sm font-bold font-mono tabular-nums ${
                  timeLeftMs <= 10000 ? 'text-rose-400' : 'text-sky-400'
                }`}
              >
                {(timeLeftMs / 1000).toFixed(1)}s{' '}
                {reveal !== null ? '· Paused' : ''}
              </p>
            </div>
          )}

          {mode === 'survival' && (
            <div className="border-l border-slate-800 pl-4">
              <p className="text-xs text-slate-400">Lives</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {Array.from({ length: initialLives }).map((_, heartIdx) => (
                  <Heart
                    key={heartIdx}
                    className={`h-4 w-4 ${
                      heartIdx < lives
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
                <span className="ml-1 font-mono text-xs font-semibold text-slate-200 tabular-nums">
                  {lives}/{initialLives}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <StreakFireCounter
            score={score}
            streak={streak}
            multiplier={multiplier}
            currentDailyStreak={currentDailyStreak}
          />

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => finishGame(score, bestStreak, records, 'quit')}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            End Run
          </button>
        </div>
      </div>

      {/* Primary Elevated White Question Card */}
      <section className="rounded-2xl bg-white text-slate-900 shadow-2xl shadow-black/40 border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-9 space-y-6">
          {/* Card Header Metadata & Tactical Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="font-semibold text-slate-900">
                {getCategoryLabel(currentQuestion.category)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentQuestion.subtopic}</span>
              <span aria-hidden="true">·</span>
              <span>{getDifficultyLabel(currentQuestion.difficulty)}</span>
              {currentQuestion.format === 'fact_or_fiction' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Fact or Fiction</span>
                </>
              )}
              {currentQuestion.format === 'estimate' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Slider Estimate</span>
                </>
              )}
            </div>

            {reveal === null && (
              <div className="flex items-center gap-2">
                {currentQuestion.format === 'multiple_choice' && (
                  <button
                    type="button"
                    onClick={handleUseFiftyFifty}
                    disabled={
                      fiftyFiftyCharges <= 0 || eliminatedIndices.length > 0
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      fiftyFiftyCharges > 0 && eliminatedIndices.length === 0
                        ? 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                        : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    <span>50/50 ({fiftyFiftyCharges})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDoubleDownActive((v) => !v);
                    soundFx.click();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    doubleDownActive
                      ? 'border-amber-500 bg-amber-400 text-slate-950'
                      : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{doubleDownActive ? '2x Wager Active' : 'Double Down (2x)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Question Prompt */}
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug text-balance">
            {currentQuestion.prompt}
          </h2>

          {/* Format 1: Multiple Choice */}
          {currentQuestion.format === 'multiple_choice' && (
            <div className="grid gap-3">
              {currentQuestion.options.map((option, idx) => {
                const isEliminated = eliminatedIndices.includes(idx);
                const isSelected = reveal?.selectedOptionIndex === idx;
                const isCorrectOption = idx === currentQuestion.correctIndex;

                let btnStyle =
                  'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-slate-100';
                let statusIcon = null;

                if (reveal !== null) {
                  if (isCorrectOption) {
                    btnStyle =
                      'border-emerald-600 bg-emerald-50 text-emerald-950';
                    statusIcon = (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 shrink-0">
                        <Check className="h-4 w-4" />
                        <span>Correct</span>
                      </span>
                    );
                  } else if (isSelected && !isCorrectOption) {
                    btnStyle = 'border-rose-500 bg-rose-50 text-rose-950';
                    statusIcon = (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 shrink-0">
                        <X className="h-4 w-4" />
                        <span>Your Pick</span>
                      </span>
                    );
                  } else {
                    btnStyle =
                      'border-slate-200 bg-white text-slate-400 opacity-65';
                  }
                } else if (isEliminated) {
                  btnStyle =
                    'border-slate-200 bg-slate-50 text-slate-400 opacity-40 line-through cursor-not-allowed';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={reveal !== null || isEliminated}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex min-h-[54px] w-full items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition-all cursor-pointer disabled:cursor-default ${btnStyle}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white font-mono text-xs font-bold text-slate-700">
                        {KEY_LABELS[idx]}
                      </span>
                      <span className="text-sm sm:text-base font-medium leading-snug">
                        {option}
                      </span>
                    </div>
                    {statusIcon}
                  </button>
                );
              })}
            </div>
          )}

          {/* Format 2: Fact or Fiction */}
          {currentQuestion.format === 'fact_or_fiction' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'True Fact', value: true, keyHint: '1' },
                { label: 'Pure Fiction', value: false, keyHint: '2' },
              ].map((choice) => {
                const isSelected = reveal?.selectedBoolean === choice.value;
                const isCorrectChoice = currentQuestion.isTrue === choice.value;

                let cardStyle =
                  'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-slate-100';
                let stateBadge = null;

                if (reveal !== null) {
                  if (isCorrectChoice) {
                    cardStyle =
                      'border-emerald-600 bg-emerald-50 text-emerald-950';
                    stateBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <Check className="h-4 w-4" />
                        <span>Actual Truth</span>
                      </span>
                    );
                  } else if (isSelected && !isCorrectChoice) {
                    cardStyle = 'border-rose-500 bg-rose-50 text-rose-950';
                    stateBadge = (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                        <X className="h-4 w-4" />
                        <span>Your Pick</span>
                      </span>
                    );
                  } else {
                    cardStyle =
                      'border-slate-200 bg-white text-slate-400 opacity-65';
                  }
                }

                return (
                  <button
                    key={choice.label}
                    type="button"
                    disabled={reveal !== null}
                    onClick={() => handleSelectFactOrFiction(choice.value)}
                    className={`flex min-h-[76px] items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-all cursor-pointer disabled:cursor-default ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white font-mono text-xs font-bold text-slate-700">
                        {choice.keyHint}
                      </span>
                      <span className="font-display text-lg font-bold">
                        {choice.label}
                      </span>
                    </div>
                    {stateBadge}
                  </button>
                );
              })}
            </div>
          )}

          {/* Format 3: Numeric Estimate Slider */}
          {currentQuestion.format === 'estimate' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Dial in your closest estimate
                </span>
                <div className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
                  {estimateValue}
                  {currentQuestion.unit ? (
                    <span className="ml-1.5 text-base font-medium text-slate-600">
                      {currentQuestion.unit}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min={currentQuestion.min}
                  max={currentQuestion.max}
                  step={currentQuestion.step}
                  value={estimateValue}
                  disabled={reveal !== null}
                  onChange={(e) => setEstimateValue(Number(e.target.value))}
                  className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-300 accent-slate-900 disabled:cursor-default"
                  aria-label="Numeric estimate slider"
                />
                <div className="flex justify-between font-mono text-xs text-slate-500 tabular-nums">
                  <span>
                    {currentQuestion.min}
                    {currentQuestion.unit ? ` ${currentQuestion.unit}` : ''}
                  </span>
                  <span>
                    Exact within ±{currentQuestion.toleranceExact} · Close
                    within ±{currentQuestion.toleranceClose}
                  </span>
                  <span>
                    {currentQuestion.max}
                    {currentQuestion.unit ? ` ${currentQuestion.unit}` : ''}
                  </span>
                </div>
              </div>

              {reveal === null && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitEstimate}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Lock In Guess</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Post-Answer Cocktail Party Fact Reveal */}
          {reveal !== null && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {reveal.outcome === 'correct' && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <Check className="h-4 w-4" />
                      <span>
                        Exact Hit · +{reveal.pointsEarned} pts
                        {reveal.doubled ? ' (2x Wager)' : ''}
                      </span>
                    </span>
                  )}
                  {reveal.outcome === 'close' && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700">
                      <Sparkles className="h-4 w-4" />
                      <span>
                        Close Enough · +{reveal.pointsEarned} pts · Actual:{' '}
                        {reveal.correctAnswerLabel}
                      </span>
                    </span>
                  )}
                  {reveal.outcome === 'wrong' && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-700">
                      <X className="h-4 w-4" />
                      <span>
                        Missed · Answer: {reveal.correctAnswerLabel}
                      </span>
                    </span>
                  )}
                </div>

                <span className="text-xs font-medium text-slate-500">
                  {currentQuestion.sourceHint}
                </span>
              </div>

              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                {currentQuestion.fact}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.click();
                    onToggleBookmark(currentQuestion.id);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isBookmarked
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Bookmark
                    className={`h-3.5 w-3.5 ${
                      isBookmarked ? 'fill-amber-500 text-amber-600' : ''
                    }`}
                  />
                  <span>
                    {isBookmarked ? 'Saved to Field Notes' : 'Save Fact'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>
                    {mode === 'survival' && lives <= 0
                      ? 'See Results'
                      : currentIndex + 1 >= questions.length
                        ? 'Finish Round'
                        : 'Next Question'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Subtle Keyboard Tip Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
        <span className="inline-flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span>Every 4-streak grants +1 bonus 50/50 Cut.</span>
        </span>
        <span className="hidden sm:inline font-mono">
          Keys: 1–4 answer · D wager · C cut · Enter next
        </span>
      </div>
    </main>
  );
}
