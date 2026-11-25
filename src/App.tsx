import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthPanel } from './components/AuthPanel';
import { FieldNotesView } from './components/FieldNotesView';
import { GameArena } from './components/GameArena';
import { MasteryView } from './components/MasteryView';
import { RoundSummary } from './components/RoundSummary';
import { TitleLobby } from './components/TitleLobby';
import { TopBar } from './components/TopBar';
import { WorldLeaderboardView } from './components/WorldLeaderboardView';
import {
  AppScreen,
  AuthUser,
  DeckSelection,
  GameMode,
  ModeSettings,
  PlayerProgress,
  RoundAnswerRecord,
  TriviaQuestion,
} from './types/game';
import { syncAccountProgress } from './utils/authApi';
import { syncWorldLeaderboard } from './utils/leaderboardApi';
import {
  buildDailyChallengeDeck,
  buildPlayableDeck,
  getUtcDateKey,
} from './utils/deckBuilder';
import { soundFx } from './utils/sound';
import {
  applyDailyCompletionStreak,
  getCurrentDailyStreak,
  getDefaultProgress,
  loadProgress,
  mergeAccountProgress,
  saveProgress,
} from './utils/storage';

interface ActiveRun {
  runId: number;
  deckSelection: DeckSelection;
  mode: GameMode;
  dailyDateKey?: string;
  questions: TriviaQuestion[];
}

interface CompletedRunSummary {
  deckSelection: DeckSelection;
  mode: GameMode;
  dailyDateKey?: string;
  score: number;
  bestStreak: number;
  durationMs: number;
  records: RoundAnswerRecord[];
  endedReason: 'completed' | 'time_up' | 'out_of_lives' | 'quit';
}

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('TITLE_MENU');
  const [selectedMode, setSelectedMode] = useState<GameMode>('standard');
  const [modeSettings, setModeSettings] = useState<ModeSettings>({
    standardRounds: 10,
    blitzSeconds: 60,
    survivalLives: 3,
  });
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [lastSummary, setLastSummary] = useState<CompletedRunSummary | null>(
    null
  );
  const decksRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    soundFx.setEnabled(progress.soundEnabled);
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (!authToken || !authUser) return;
    const timer = window.setTimeout(() => {
      if (authUser.provider !== 'guest') {
        syncAccountProgress(authToken, progress).catch(() => {
          // Ignore transient offline sync errors; local storage stays intact
        });
      }
      syncWorldLeaderboard(progress, authToken).catch(() => {
        // Ignore transient offline sync errors
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [authToken, authUser, progress]);

  const handleAuthenticated = useCallback(
    (
      token: string,
      user: AuthUser,
      remoteProgress?: Partial<PlayerProgress> | null
    ) => {
      soundFx.click();
      setAuthToken(token);
      setAuthUser(user);
      setShowAuthModal(false);

      if (user.provider === 'guest') {
        setProgress((prev) => ({
          ...prev,
          playerId: prev.playerId || user.id,
          playerName:
            user.name && user.name !== 'Guest Challenger'
              ? user.name
              : prev.playerName,
        }));
        return;
      }

      setProgress((prev) => {
        const merged = mergeAccountProgress(
          prev,
          remoteProgress,
          user.id,
          user.name
        );
        syncAccountProgress(token, merged).catch(() => {});
        return merged;
      });
    },
    []
  );

  const handleSignOut = useCallback(() => {
    soundFx.click();
    setAuthToken(null);
    setAuthUser(null);
    setShowAuthModal(false);
    setActiveRun(null);
    setLastSummary(null);
    setScreen('TITLE_MENU');
  }, []);

  const handleToggleSound = useCallback(() => {
    setProgress((prev) => {
      const next = !prev.soundEnabled;
      soundFx.setEnabled(next);
      if (next) soundFx.click();
      return { ...prev, soundEnabled: next };
    });
  }, []);

  const handleUpdatePlayerName = useCallback((name: string) => {
    setProgress((prev) => ({ ...prev, playerName: name.slice(0, 28) }));
  }, []);

  const handleStartGame = useCallback(
    (deck: DeckSelection, modeOverride?: GameMode) => {
      const modeToPlay = modeOverride ?? selectedMode;

      if (modeToPlay === 'daily') {
        const dateKey = getUtcDateKey();
        const existing = progress.dailyHistory?.[dateKey];
        if (existing) {
          soundFx.click();
          setLastSummary({
            deckSelection: 'all',
            mode: 'daily',
            dailyDateKey: dateKey,
            score: existing.score,
            bestStreak: existing.bestStreak,
            durationMs: existing.durationMs,
            records: existing.records,
            endedReason: 'completed',
          });
          setScreen('ROUND_SUMMARY');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const dailyQuestions = buildDailyChallengeDeck(dateKey);
        soundFx.click();
        setSelectedMode('daily');
        setActiveRun({
          runId: Date.now(),
          deckSelection: 'all',
          mode: 'daily',
          dailyDateKey: dateKey,
          questions: dailyQuestions,
        });
        setScreen('PLAYING');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const limit =
        modeToPlay === 'standard' ? modeSettings.standardRounds : undefined;
      const playableQuestions = buildPlayableDeck(
        deck,
        progress.seenIds,
        limit
      );
      soundFx.click();
      setSelectedMode(modeToPlay);
      setActiveRun({
        runId: Date.now(),
        deckSelection: deck,
        mode: modeToPlay,
        questions: playableQuestions,
      });
      setScreen('PLAYING');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [
      selectedMode,
      modeSettings.standardRounds,
      progress.seenIds,
      progress.dailyHistory,
    ]
  );

  const handleViewTodayDailySummary = useCallback(() => {
    const dateKey = getUtcDateKey();
    const existing = progress.dailyHistory?.[dateKey];
    if (!existing) return;
    soundFx.click();
    setLastSummary({
      deckSelection: 'all',
      mode: 'daily',
      dailyDateKey: dateKey,
      score: existing.score,
      bestStreak: existing.bestStreak,
      durationMs: existing.durationMs,
      records: existing.records,
      endedReason: 'completed',
    });
    setScreen('ROUND_SUMMARY');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [progress.dailyHistory]);

  const handleToggleBookmark = useCallback((questionId: string) => {
    setProgress((prev) => {
      const exists = prev.bookmarkedIds.includes(questionId);
      const bookmarkedIds = exists
        ? prev.bookmarkedIds.filter((id) => id !== questionId)
        : [...prev.bookmarkedIds, questionId];
      return { ...prev, bookmarkedIds };
    });
  }, []);

  const handleRecordAnswer = useCallback((record: RoundAnswerRecord) => {
    setProgress((prev) => {
      const cat = record.question.category;
      const isHit = record.outcome !== 'wrong';
      const seenIds = prev.seenIds.includes(record.question.id)
        ? prev.seenIds
        : [...prev.seenIds, record.question.id];

      const catStat = prev.categoryStats?.[cat] ?? {
        answered: 0,
        correct: 0,
      };
      return {
        ...prev,
        xp: prev.xp + Math.max(25, Math.round(record.pointsEarned * 0.5)),
        totalAnswered: prev.totalAnswered + 1,
        totalCorrect: prev.totalCorrect + (isHit ? 1 : 0),
        seenIds,
        categoryStats: {
          ...prev.categoryStats,
          [cat]: {
            answered: catStat.answered + 1,
            correct: catStat.correct + (isHit ? 1 : 0),
          },
        },
      };
    });
  }, []);

  const handleFinishRun = useCallback(
    (summary: {
      score: number;
      bestStreak: number;
      durationMs: number;
      records: RoundAnswerRecord[];
      endedReason: 'completed' | 'time_up' | 'out_of_lives' | 'quit';
    }) => {
      if (!activeRun) return;

      const hits = summary.records.filter((r) => r.outcome !== 'wrong').length;

      setProgress((prev) => {
        const nextDailyHistory = { ...(prev.dailyHistory ?? {}) };
        let streakUpdate = {
          currentDailyStreak: prev.currentDailyStreak,
          bestDailyStreak: prev.bestDailyStreak,
          lastDailyDateKey: prev.lastDailyDateKey,
        };

        if (
          activeRun.mode === 'daily' &&
          activeRun.dailyDateKey &&
          summary.endedReason === 'completed'
        ) {
          if (!nextDailyHistory[activeRun.dailyDateKey]) {
            nextDailyHistory[activeRun.dailyDateKey] = {
              dateKey: activeRun.dailyDateKey,
              score: summary.score,
              correctCount: hits,
              totalCount: summary.records.length,
              bestStreak: summary.bestStreak,
              durationMs: summary.durationMs,
              records: summary.records,
            };
          }
          streakUpdate = applyDailyCompletionStreak(
            prev,
            activeRun.dailyDateKey
          );
        }

        return {
          ...prev,
          gamesPlayed: prev.gamesPlayed + 1,
          bestStreak: Math.max(prev.bestStreak, summary.bestStreak),
          currentDailyStreak: streakUpdate.currentDailyStreak,
          bestDailyStreak: streakUpdate.bestDailyStreak,
          lastDailyDateKey: streakUpdate.lastDailyDateKey,
          highScoreStandard:
            activeRun.mode === 'standard'
              ? Math.max(prev.highScoreStandard, summary.score)
              : prev.highScoreStandard,
          highScoreBlitz:
            activeRun.mode === 'blitz'
              ? Math.max(prev.highScoreBlitz, summary.score)
              : prev.highScoreBlitz,
          highScoreSurvival:
            activeRun.mode === 'survival'
              ? Math.max(prev.highScoreSurvival, summary.score)
              : prev.highScoreSurvival,
          dailyHistory: nextDailyHistory,
        };
      });

      setLastSummary({
        deckSelection: activeRun.deckSelection,
        mode: activeRun.mode,
        dailyDateKey: activeRun.dailyDateKey,
        ...summary,
      });
      setScreen('ROUND_SUMMARY');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeRun]
  );

  const handleScrollToDecks = useCallback(() => {
    setScreen('TITLE_MENU');
    window.setTimeout(() => {
      decksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

  const handleResetProgress = useCallback(() => {
    const fresh = getDefaultProgress();
    setProgress(fresh);
    soundFx.click();
  }, []);

  if (!authUser) {
    return (
      <AuthPanel
        mode="welcome"
        existingPlayerId={progress.playerId}
        initialGuestName={progress.playerName}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-[#F1F5F9]">
      <TopBar
        currentScreen={screen}
        authUser={authUser}
        onNavigate={(next) => {
          soundFx.click();
          setScreen(next);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onScrollToDecks={handleScrollToDecks}
        onQuickMix={() =>
          handleStartGame(
            'all',
            selectedMode === 'daily' ? 'standard' : selectedMode
          )
        }
        onOpenAuthModal={() => {
          soundFx.click();
          setShowAuthModal(true);
        }}
        onSignOut={handleSignOut}
      />

      <div className="flex-1">
        {screen === 'TITLE_MENU' && (
          <TitleLobby
            progress={progress}
            selectedMode={selectedMode}
            modeSettings={modeSettings}
            onSelectMode={(m) => {
              soundFx.click();
              setSelectedMode(m);
            }}
            onUpdateModeSettings={(next) => {
              soundFx.click();
              setModeSettings(next);
            }}
            onUpdatePlayerName={handleUpdatePlayerName}
            onStartGame={handleStartGame}
            onViewTodayDailySummary={handleViewTodayDailySummary}
            onToggleSound={handleToggleSound}
            onOpenFieldNotes={() => {
              soundFx.click();
              setScreen('FIELD_NOTES');
            }}
            onOpenLeaderboard={() => {
              soundFx.click();
              setScreen('LEADERBOARD');
            }}
            decksRef={decksRef}
          />
        )}

        {screen === 'PLAYING' && activeRun && (
          <GameArena
            key={activeRun.runId}
            deckSelection={activeRun.deckSelection}
            mode={activeRun.mode}
            dailyDateKey={activeRun.dailyDateKey}
            questions={activeRun.questions}
            initialTimeSeconds={modeSettings.blitzSeconds}
            initialLives={modeSettings.survivalLives}
            seenIds={progress.seenIds}
            bookmarkedIds={progress.bookmarkedIds}
            soundEnabled={progress.soundEnabled}
            currentDailyStreak={getCurrentDailyStreak(progress)}
            onToggleSound={handleToggleSound}
            onToggleBookmark={handleToggleBookmark}
            onRecordAnswer={handleRecordAnswer}
            onFinishRun={handleFinishRun}
          />
        )}

        {screen === 'ROUND_SUMMARY' && lastSummary && (
          <RoundSummary
            deckSelection={lastSummary.deckSelection}
            mode={lastSummary.mode}
            dailyDateKey={lastSummary.dailyDateKey}
            modeSettings={modeSettings}
            score={lastSummary.score}
            bestStreak={lastSummary.bestStreak}
            durationMs={lastSummary.durationMs}
            records={lastSummary.records}
            endedReason={lastSummary.endedReason}
            progress={progress}
            onUpdatePlayerName={handleUpdatePlayerName}
            onToggleBookmark={handleToggleBookmark}
            onPlayAgain={() =>
              handleStartGame(lastSummary.deckSelection, lastSummary.mode)
            }
            onBackToLobby={() => {
              soundFx.click();
              setScreen('TITLE_MENU');
            }}
          />
        )}

        {screen === 'FIELD_NOTES' && (
          <FieldNotesView
            progress={progress}
            onToggleBookmark={handleToggleBookmark}
            onStartQuickMix={() => handleStartGame('all', selectedMode)}
          />
        )}

        {screen === 'LEADERBOARD' && (
          <WorldLeaderboardView
            progress={progress}
            authToken={authToken}
            onUpdatePlayerName={handleUpdatePlayerName}
          />
        )}

        {screen === 'STATS' && (
          <MasteryView
            progress={progress}
            onResetProgress={handleResetProgress}
          />
        )}
      </div>

      <footer className="border-t border-slate-800/80 py-5 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <span>Dangerously Educated</span>
          <div className="flex items-center gap-5 md:hidden">
            <button
              type="button"
              onClick={() => setScreen('TITLE_MENU')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Decks
            </button>
            <button
              type="button"
              onClick={() => setScreen('FIELD_NOTES')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Field Notes
            </button>
            <button
              type="button"
              onClick={() => setScreen('LEADERBOARD')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setScreen('STATS')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Mastery
            </button>
          </div>
          <span>Movies · Games · Cars · Everything · Maths · Aptitude</span>
        </div>
      </footer>
      {showAuthModal && (
        <AuthPanel
          mode="modal"
          existingPlayerId={progress.playerId}
          initialGuestName={progress.playerName}
          onAuthenticated={handleAuthenticated}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
