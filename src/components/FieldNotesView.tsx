import { useMemo, useState } from 'react';
import { Bookmark, Play, Search } from 'lucide-react';
import { getCategoryLabel, QUESTIONS } from '../data/questions';
import { CategoryId, PlayerProgress } from '../types/game';
import { getCorrectAnswerText } from '../utils/deckBuilder';

interface FieldNotesViewProps {
  progress: PlayerProgress;
  onToggleBookmark: (questionId: string) => void;
  onStartQuickMix: () => void;
}

const FILTERS: Array<{ id: CategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'All Topics' },
  { id: 'movies', label: 'Movies' },
  { id: 'games', label: 'Games' },
  { id: 'cars', label: 'Cars' },
  { id: 'everything', label: 'Everything' },
  { id: 'maths', label: 'Maths' },
  { id: 'aptitude', label: 'Aptitude' },
];

export function FieldNotesView({
  progress,
  onToggleBookmark,
  onStartQuickMix,
}: FieldNotesViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>(
    'all'
  );
  const [savedOnly, setSavedOnly] = useState(false);
  const [query, setQuery] = useState('');

  const unlockedQuestions = useMemo(() => {
    const seenOrSaved = new Set([
      ...progress.seenIds,
      ...progress.bookmarkedIds,
    ]);
    return QUESTIONS.filter((q) => seenOrSaved.has(q.id));
  }, [progress.seenIds, progress.bookmarkedIds]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return unlockedQuestions.filter((q) => {
      if (categoryFilter !== 'all' && q.category !== categoryFilter) {
        return false;
      }
      if (savedOnly && !progress.bookmarkedIds.includes(q.id)) {
        return false;
      }
      if (!normalized) return true;
      return (
        q.prompt.toLowerCase().includes(normalized) ||
        q.fact.toLowerCase().includes(normalized) ||
        q.subtopic.toLowerCase().includes(normalized)
      );
    });
  }, [
    unlockedQuestions,
    categoryFilter,
    savedOnly,
    query,
    progress.bookmarkedIds,
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-white">
            Field Notes
          </h1>
          <p className="text-sm text-slate-400">
            Every card you unlock in play is archived here so you never forget
            the good stories.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 tabular-nums">
          {unlockedQuestions.length} of {QUESTIONS.length} unlocked ·{' '}
          {progress.bookmarkedIds.length} bookmarked
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#131C31] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = categoryFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategoryFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSavedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              savedOnly
                ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Saved Only</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search unlocked facts..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Empty States or List */}
      {unlockedQuestions.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-10 text-center space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Your Field Notes binder is empty
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-400">
            Play your first round to unlock surprising true stories from cinema,
            gaming, automotive history, and science.
          </p>
          <button
            type="button"
            onClick={onStartQuickMix}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Play Danger Mix</span>
          </button>
        </section>
      ) : filtered.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-8 text-center space-y-2">
          <p className="text-base font-semibold text-white">
            No matching Field Notes found
          </p>
          <p className="text-sm text-slate-400">
            Try clearing your search query or switching topic filters.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((q) => {
            const isSaved = progress.bookmarkedIds.includes(q.id);
            return (
              <article
                key={q.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#131C31] p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-amber-400">
                        {getCategoryLabel(q.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{q.subtopic}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleBookmark(q.id)}
                      aria-label={isSaved ? 'Remove bookmark' : 'Save fact'}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSaved
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${
                          isSaved ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>

                  <h3 className="font-display text-base font-bold text-white leading-snug">
                    {q.prompt}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {q.fact}
                  </p>
                </div>

                <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Answer: {getCorrectAnswerText(q)}</span>
                  <span>{q.sourceHint}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
