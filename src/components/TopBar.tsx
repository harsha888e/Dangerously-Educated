import { LogIn, LogOut } from 'lucide-react';
import { AppScreen, AuthUser } from '../types/game';

interface TopBarProps {
  currentScreen: AppScreen;
  authUser: AuthUser;
  onNavigate: (screen: AppScreen) => void;
  onScrollToDecks: () => void;
  onQuickMix: () => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export function TopBar({
  currentScreen,
  authUser,
  onNavigate,
  onScrollToDecks,
  onQuickMix,
  onOpenAuthModal,
  onSignOut,
}: TopBarProps) {
  const linkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b ${
      active
        ? 'text-amber-400 border-amber-400'
        : 'text-slate-300 border-transparent hover:text-white hover:border-slate-500'
    }`;

  const providerLabel =
    authUser.provider === 'google'
      ? 'Google'
      : authUser.provider === 'facebook'
        ? 'Facebook'
        : 'Guest';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0B1120]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 sm:gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('TITLE_MENU')}
          className="font-display text-lg font-bold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Dangerously Educated
        </button>

        <nav className="hidden md:flex items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('TITLE_MENU')}
            className={linkClass(
              currentScreen === 'TITLE_MENU' || currentScreen === 'PLAYING'
            )}
          >
            Play
          </button>
          <button
            type="button"
            onClick={onScrollToDecks}
            className={linkClass(false)}
          >
            Decks
          </button>
          <button
            type="button"
            onClick={() => onNavigate('FIELD_NOTES')}
            className={linkClass(currentScreen === 'FIELD_NOTES')}
          >
            Field Notes
          </button>
          <button
            type="button"
            onClick={() => onNavigate('LEADERBOARD')}
            className={linkClass(currentScreen === 'LEADERBOARD')}
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('STATS')}
            className={linkClass(currentScreen === 'STATS')}
          >
            Mastery
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-2 border-r border-slate-800 pr-2.5 text-xs">
            {authUser.avatarUrl ? (
              <img
                src={authUser.avatarUrl}
                alt={authUser.name}
                className="h-6 w-6 rounded-md object-cover border border-slate-700"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 font-mono text-[11px] font-bold text-amber-400">
                {authUser.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="leading-tight">
              <p className="font-medium text-slate-200 max-w-[110px] truncate">
                {authUser.name}
              </p>
              <p className="font-mono text-[10px] text-slate-400">
                {providerLabel}
              </p>
            </div>
          </div>

          {authUser.provider === 'guest' && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5 text-amber-400" />
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out or switch account"
            title="Sign out"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-slate-400 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onQuickMix}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120]"
          >
            Quick Mix
          </button>
        </div>
      </div>
    </header>
  );
}
