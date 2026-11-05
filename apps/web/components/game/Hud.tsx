"use client";

import Link from "next/link";
import { BackIcon, SoundIcon } from "@/components/ui/icons";

export function Hud({
  round,
  points,
  curses,
  sound,
  onToggleSound,
  label,
  level,
  speed,
}: {
  round: number;
  points: number;
  curses: number;
  sound: boolean;
  onToggleSound(): void;
  label: string;
  /** Current level and speed, shown once a run is underway. */
  level?: number;
  speed?: number;
}) {
  return (
    <header className="relative z-30 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
      <Link
        href="/"
        data-ui
        aria-label="Back to home"
        className="btn-ghost flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-white"
      >
        <BackIcon />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.25em] text-muted">{label}</span>
        {level !== undefined && speed !== undefined && (
          <span
            className="whitespace-nowrap font-display text-[11px] font-extrabold text-white/85"
            aria-label={`Level ${level}, speed ${speed}`}
          >
            LV {level} <span className="text-amber">⚡{speed.toFixed(1)}×</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {curses > 0 && (
          <span
            className="flex h-10 items-center gap-1 rounded-xl bg-violet/20 px-3 font-display text-sm font-extrabold text-violet-200 ring-1 ring-violet/60"
            title="A curse is active. Remember what it does!"
          >
            ☠ ×{curses}
          </span>
        )}
        <div className="glass flex h-10 min-w-[64px] flex-col items-center justify-center rounded-xl px-3 leading-none">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Pts</span>
          <span className="font-display text-sm font-extrabold tabular-nums">{points.toLocaleString("en-US")}</span>
        </div>
        <div className="flex h-10 min-w-[64px] flex-col items-center justify-center rounded-xl bg-cyan/10 px-3 leading-none ring-1 ring-cyan/40">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan/80">Round</span>
          <span className="font-display text-base font-black tabular-nums neon-text-cyan">{round}</span>
        </div>
        <button
          type="button"
          data-ui
          onClick={onToggleSound}
          aria-label={sound ? "Mute sound" : "Unmute sound"}
          className="btn-ghost flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-white"
        >
          <SoundIcon on={sound} />
        </button>
      </div>
    </header>
  );
}
