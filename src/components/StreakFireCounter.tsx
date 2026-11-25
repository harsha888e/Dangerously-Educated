import { motion, useReducedMotion } from 'motion/react';
import { Flame } from 'lucide-react';

interface StreakFireCounterProps {
  score: number;
  streak: number;
  multiplier: number;
  currentDailyStreak: number;
}

const EMBER_OFFSETS = [
  { x: -6, delay: 0, sizeClass: 'h-1 w-1' },
  { x: 5, delay: 0.35, sizeClass: 'h-0.5 w-0.5' },
  { x: -2, delay: 0.7, sizeClass: 'h-1 w-1' },
  { x: 7, delay: 0.2, sizeClass: 'h-0.5 w-0.5' },
  { x: -8, delay: 0.55, sizeClass: 'h-0.5 w-0.5' },
  { x: 2, delay: 0.9, sizeClass: 'h-1 w-1' },
];

export function StreakFireCounter({
  score,
  streak,
  multiplier,
  currentDailyStreak,
}: StreakFireCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const daily = Math.max(0, currentDailyStreak);

  // Smoothly scale size and fire intensity with currentDailyStreak
  const intensity = Math.min(1, daily / 8);
  const flameScale =
    daily === 0 ? 0.85 : Math.min(1.65, 1 + Math.min(daily, 10) * 0.065);
  const flickerDuration = Math.max(0.55, 1.9 - intensity * 1.25);
  const emberCount =
    daily === 0 ? 0 : daily < 3 ? 2 : daily < 6 ? 4 : EMBER_OFFSETS.length;

  const stageSizeClass =
    daily >= 7
      ? 'h-10 w-10'
      : daily >= 3
        ? 'h-8 w-8'
        : daily >= 1
          ? 'h-7 w-7'
          : 'h-6 w-6';

  const textToneClass =
    daily >= 7
      ? 'text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
      : daily >= 3
        ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(249,115,22,0.45)]'
        : daily >= 1
          ? 'text-amber-400'
          : 'text-slate-300';

  const glowColorClass =
    daily >= 7
      ? 'bg-gradient-to-t from-rose-500/70 via-amber-400/60 to-yellow-200/50'
      : daily >= 3
        ? 'bg-gradient-to-t from-orange-600/60 via-amber-500/50 to-yellow-300/35'
        : daily >= 1
          ? 'bg-amber-500/35'
          : 'bg-slate-600/15';

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-xs text-slate-400">Score &amp; Streak</p>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 font-mono text-sm font-bold tabular-nums">
          <span className="text-white">{score.toLocaleString()} pts</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>

          {/* Fire-animated streak counter */}
          <div className="inline-flex items-center gap-1.5">
            <div
              className={`relative flex items-center justify-center shrink-0 select-none ${stageSizeClass}`}
              aria-hidden="true"
            >
              {/* Radial thermal aura */}
              <motion.span
                className={`pointer-events-none absolute inset-0 rounded-full blur-md ${glowColorClass}`}
                animate={
                  prefersReducedMotion || daily === 0
                    ? { opacity: daily === 0 ? 0.15 : 0.45 + intensity * 0.35 }
                    : {
                        scale: [
                          0.95 + intensity * 0.2,
                          1.25 + intensity * 0.45,
                          1.05 + intensity * 0.25,
                        ],
                        opacity: [
                          0.35 + intensity * 0.3,
                          0.65 + intensity * 0.35,
                          0.4 + intensity * 0.3,
                        ],
                      }
                }
                transition={{
                  duration: flickerDuration * 1.15,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Rising embers when daily streak >= 1 */}
              {!prefersReducedMotion &&
                EMBER_OFFSETS.slice(0, emberCount).map((ember, idx) => (
                  <motion.span
                    key={idx}
                    className={`pointer-events-none absolute bottom-1 left-1/2 rounded-full bg-amber-300 ${ember.sizeClass}`}
                    initial={{ x: ember.x, y: 0, opacity: 0, scale: 0.7 }}
                    animate={{
                      y: [2, -(12 + intensity * 14)],
                      x: [ember.x, ember.x + (idx % 2 === 0 ? 4 : -4), ember.x],
                      opacity: [0, 0.9, 0],
                      scale: [0.6, 1.1, 0.3],
                    }}
                    transition={{
                      duration: flickerDuration * 1.1,
                      delay: ember.delay,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}

              {/* Outer blaze flame */}
              <motion.div
                className="relative flex items-center justify-center origin-bottom"
                animate={
                  prefersReducedMotion || daily === 0
                    ? { scale: flameScale }
                    : {
                        scaleX: [
                          flameScale * 0.96,
                          flameScale * (1.06 + intensity * 0.08),
                          flameScale * 0.94,
                          flameScale * (1.04 + intensity * 0.06),
                        ],
                        scaleY: [
                          flameScale * 0.98,
                          flameScale * (1.1 + intensity * 0.14),
                          flameScale * 0.95,
                          flameScale * (1.07 + intensity * 0.1),
                        ],
                        rotate: [
                          0,
                          -(2 + intensity * 3),
                          2 + intensity * 3,
                          0,
                        ],
                      }
                }
                transition={{
                  duration: flickerDuration,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Flame
                  className={`h-4 w-4 ${
                    daily >= 7
                      ? 'fill-orange-500 text-amber-300'
                      : daily >= 3
                        ? 'fill-orange-500 text-amber-400'
                        : daily >= 1
                          ? 'fill-amber-500/80 text-amber-400'
                          : 'text-slate-500'
                  }`}
                />

                {/* Inner hot flame core for active daily streaks */}
                {daily >= 1 && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[1px]"
                    animate={
                      prefersReducedMotion
                        ? { opacity: 0.75 }
                        : {
                            scaleY: [0.6, 0.85 + intensity * 0.2, 0.65],
                            scaleX: [0.62, 0.78, 0.6],
                            opacity: [0.65, 1, 0.7],
                          }
                    }
                    transition={{
                      duration: flickerDuration * 0.72,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <Flame
                      className={`h-3.5 w-3.5 ${
                        daily >= 5
                          ? 'fill-yellow-100 text-white'
                          : 'fill-yellow-300 text-amber-200'
                      }`}
                    />
                  </motion.div>
                )}
              </motion.div>
            </div>

            <motion.span
              key={streak}
              initial={prefersReducedMotion ? false : { scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
              className={textToneClass}
            >
              {streak} streak ({multiplier}x)
            </motion.span>

            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>

            <span
              className={`text-xs ${
                daily >= 3
                  ? 'text-orange-300'
                  : daily >= 1
                    ? 'text-emerald-400'
                    : 'text-slate-500'
              }`}
              title="Current Daily Challenge Streak"
            >
              {daily}d daily
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
