import { getDeckQuestions } from '../data/questions';
import {
  CategoryId,
  DeckSelection,
  MultipleChoiceQuestion,
  TriviaQuestion,
} from '../types/game';

function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashDateString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRng(seedStr: string): () => number {
  let a = hashDateString(seedStr);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleMultipleChoiceOptions(
  question: MultipleChoiceQuestion,
  rng: () => number = Math.random
): MultipleChoiceQuestion {
  const tagged = question.options.map((text, idx) => ({
    text,
    isCorrect: idx === question.correctIndex,
  }));
  const shuffled = shuffleArray(tagged, rng);
  const newCorrectIndex = shuffled.findIndex((item) => item.isCorrect);
  return {
    ...question,
    options: [
      shuffled[0].text,
      shuffled[1].text,
      shuffled[2].text,
      shuffled[3].text,
    ],
    correctIndex: newCorrectIndex,
  };
}

export function buildPlayableDeck(
  selection: DeckSelection,
  seenIds: string[],
  limit?: number
): TriviaQuestion[] {
  const pool = getDeckQuestions(selection);
  const seenSet = new Set(seenIds);

  const unseen = shuffleArray(pool.filter((q) => !seenSet.has(q.id)));
  const seen = shuffleArray(pool.filter((q) => seenSet.has(q.id)));

  const ordered = [...unseen, ...seen].map((q) =>
    q.format === 'multiple_choice' ? shuffleMultipleChoiceOptions(q) : q
  );

  if (limit && limit > 0) {
    return ordered.slice(0, Math.min(limit, ordered.length));
  }
  return ordered;
}

export function getUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getPreviousUtcDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0, 0));
  return prev.toISOString().slice(0, 10);
}

export function getMsUntilNextUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, next - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

const DAILY_CATEGORIES: CategoryId[] = [
  'movies',
  'games',
  'cars',
  'everything',
  'maths',
  'aptitude',
];

/**
 * Deterministically builds the exact same 12-question Daily Challenge set
 * (2 questions from each of the 6 decks) for all players on a given UTC date.
 */
export function buildDailyChallengeDeck(
  dateKey: string = getUtcDateKey()
): TriviaQuestion[] {
  const rng = createSeededRng(`dangerously-educated-daily-${dateKey}`);
  const picked: TriviaQuestion[] = [];

  for (const cat of DAILY_CATEGORIES) {
    const catPool = getDeckQuestions(cat).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
    const shuffledCat = shuffleArray(catPool, rng);
    picked.push(...shuffledCat.slice(0, 2));
  }

  return shuffleArray(picked, rng).map((q) =>
    q.format === 'multiple_choice' ? shuffleMultipleChoiceOptions(q, rng) : q
  );
}

export function getDifficultyLabel(d: TriviaQuestion['difficulty']): string {
  switch (d) {
    case 'casual':
      return 'Warm-Up';
    case 'sharp':
      return 'Sharp';
    case 'obscure':
      return 'Deep Cut';
  }
}

export function getCorrectAnswerText(question: TriviaQuestion): string {
  if (question.format === 'multiple_choice') {
    return question.options[question.correctIndex];
  }
  if (question.format === 'fact_or_fiction') {
    return question.isTrue ? 'True Fact' : 'Pure Fiction';
  }
  const unitSuffix = question.unit ? ` ${question.unit}` : '';
  return `${question.correctValue}${unitSuffix}`;
}
