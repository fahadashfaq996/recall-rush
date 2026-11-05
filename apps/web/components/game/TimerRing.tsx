"use client";

/**
 * Circular countdown drawn around the task. The arc drains from the top, shifting from cyan to amber to red,
 * with a glowing head marking the time left. It runs as a CSS animation so it costs no React renders.
 * Boss rounds use a magenta ring with a pulsing halo.
 */
export function TimerRing({
  durationMs,
  started,
  running,
  boss = false,
}: {
  durationMs: number;
  started: boolean;
  running: boolean;
  boss?: boolean;
}) {
  const playState = running ? "running" : "paused";
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 overflow-visible" aria-hidden>
      <circle cx={50} cy={50} r={47} fill="none" stroke={boss ? "rgb(255 43 214 / 0.18)" : "rgb(255 255 255 / 0.07)"} strokeWidth={2.4} />
      {boss && <circle className="boss-halo" cx={50} cy={50} r={49.5} fill="none" stroke="var(--magenta)" strokeWidth={0.8} />}
      <circle cx={50} cy={50} r={43.5} fill="none" stroke="rgb(255 255 255 / 0.04)" strokeWidth={0.4} strokeDasharray="0.6 2.2" />
      {started && (
        <>
          <circle
            className={boss ? "timer-ring timer-ring-boss" : "timer-ring"}
            cx={50}
            cy={50}
            r={47}
            fill="none"
            strokeWidth={2.6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            style={{ animationDuration: `${durationMs}ms`, animationPlayState: playState }}
          />
          <g className="timer-ring-head" style={{ animationDuration: `${durationMs}ms`, animationPlayState: playState }}>
            <circle
              cx={97}
              cy={50}
              r={2.4}
              className={boss ? "timer-ring-dot timer-ring-dot-boss" : "timer-ring-dot"}
              style={{ animationDuration: `${durationMs}ms`, animationPlayState: playState }}
            />
          </g>
        </>
      )}
    </svg>
  );
}
