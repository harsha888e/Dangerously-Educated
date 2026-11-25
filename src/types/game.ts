export type CategoryId =
  | 'movies'
  | 'games'
  | 'cars'
  | 'everything'
  | 'maths'
  | 'aptitude';

export type DeckSelection = CategoryId | 'all';

export type GameMode = 'standard' | 'blitz' | 'survival' | 'daily';

export interface ModeSettings {
  standardRounds: 10 | 15 | 25;
  blitzSeconds: 60 | 90 | 120;
  survivalLives: 1 | 3 | 5;
}

export type AppScreen =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'ROUND_SUMMARY'
  | 'FIELD_NOTES'
  | 'LEADERBOARD'
  | 'STATS';

export type QuestionFormat = 'multiple_choice' | 'fact_or_fiction' | 'estimate';

export type DifficultyLevel = 'casual' | 'sharp' | 'obscure';

interface BaseQuestion {
  id: string;
  category: CategoryId;
  subtopic: string;
  difficulty: DifficultyLevel;
  prompt: string;
  fact: string;
  sourceHint: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  format: 'multiple_choice';
  options: [string, string, string, string];
  correctIndex: number;
}

export interface FactOrFictionQuestion extends BaseQuestion {
  format: 'fact_or_fiction';
  isTrue: boolean;
}

export interface EstimateQuestion extends BaseQuestion {
  format: 'estimate';
  min: number;
  max: number;
  step: number;
  unit: string;
  correctValue: number;
  toleranceExact: number;
  toleranceClose: number;
}

export type TriviaQuestion =
  | MultipleChoiceQuestion
  | FactOrFictionQuestion
  | EstimateQuestion;

export interface DeckMetadata {
  id: CategoryId;
  title: string;
  subtitle: string;
  imagePath: string;
  accentHex: string;
}

export interface RoundAnswerRecord {
  question: TriviaQuestion;
  outcome: 'correct' | 'close' | 'wrong';
  pointsEarned: number;
  userAnswerLabel: string;
  correctAnswerLabel: string;
  doubled: boolean;
}

export interface CategoryStat {
  answered: number;
  correct: number;
}

export interface DailyLeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  correctCount: number;
  totalCount: number;
  bestStreak: number;
  durationMs: number;
  submittedAt: string;
}

export interface DailyRunRecord {
  dateKey: string;
  score: number;
  correctCount: number;
  totalCount: number;
  bestStreak: number;
  durationMs: number;
  records: RoundAnswerRecord[];
}

export interface PlayerProgress {
  playerId: string;
  playerName: string;
  xp: number;
  gamesPlayed: number;
  totalAnswered: number;
  totalCorrect: number;
  bestStreak: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyDateKey: string | null;
  highScoreStandard: number;
  highScoreBlitz: number;
  highScoreSurvival: number;
  seenIds: string[];
  bookmarkedIds: string[];
  categoryStats: Record<CategoryId, CategoryStat>;
  dailyHistory: Record<string, DailyRunRecord>;
  soundEnabled: boolean;
}

export interface RankTier {
  title: string;
  minXp: number;
  nextXp: number | null;
}

export type AuthProvider = 'guest' | 'google' | 'facebook';

export interface AuthUser {
  id: string;
  provider: AuthProvider;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export type WorldLeaderboardSort =
  | 'xp'
  | 'dailyStreak'
  | 'bestDailyStreak'
  | 'highScore';

export interface WorldLeaderboardEntry {
  playerId: string;
  playerName: string;
  provider: AuthProvider;
  avatarUrl?: string;
  xp: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyDateKey: string | null;
  bestRoundScore: number;
  bestInRoundStreak: number;
  totalCorrect: number;
  totalAnswered: number;
  gamesPlayed: number;
  updatedAt: string;
}

export interface WorldLeaderboardResponse {
  sortBy: WorldLeaderboardSort;
  serverUtcDate: string;
  totalPlayers: number;
  playerRank: number | null;
  playerEntry: WorldLeaderboardEntry | null;
  entries: WorldLeaderboardEntry[];
}


