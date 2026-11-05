"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { Mode } from "@/lib/api";
import type { DailyResult } from "@/lib/player";
import { PlayIcon } from "@/components/ui/icons";

export function ReadyScreen({
  mode,
  best,
  dailyNumber,
  dailyDone,
  challenge,
  notice,
  missions,
  onStart,
}: {
  mode: Mode;
  best: number;
  dailyNumber?: number;
  dailyDone?: DailyResult;
  challenge?: { by: string; rounds: number };
  notice?: string;
  /** Today's missions for returning players; first-timers see how-to-play tips instead. */
  missions?: { id: string; title: string; progress: number; target: number; done: boolean }[];
  onStart(): void;
}) {
  const heading = mode === "daily" ? `DAILY #${dailyNumber}` : mode === "challenge" ? "CHALLENGE" : "ENDLESS";
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
        <div className="text-xs font-bold uppercase tracking-[0.4em] text-muted">
          {mode === "daily"
            ? "Same rounds for everyone today"
            : mode === "challenge"
              ? "Same rounds as your friend"
              : "How far can you go?"}
        </div>
        <h1 className="mt-3 font-display text-[clamp(34px,10vw,92px)] font-black leading-none neon-text-cyan">{heading}</h1>

        {challenge && (
          <p className="mt-5 max-w-sm text-lg font-semibold text-white/90">
            <span className="neon-text-magenta font-display font-extrabold">{challenge.by}</span> reached round{" "}
            <span className="font-display font-black text-amber">{challenge.rounds}</span>. Can you beat it?
          </p>
        )}
        {mode === "daily" && dailyDone && (
          <p className="mt-5 max-w-sm text-base font-semibold text-white/85">
            Today&apos;s ranked run is done: <span className="font-display font-black text-amber">round {dailyDone.rounds}</span>. Play
            again for practice, or come back tomorrow.
          </p>
        )}
        {mode === "daily" && !dailyDone && (
          <p className="mt-5 max-w-sm text-base font-semibold text-white/85">Only your first run today counts. Make it a good one.</p>
        )}
      </motion.div>

      {notice && (
        <button
          type="button"
          data-ui
          onClick={() => window.location.reload()}
          className="mt-6 rounded-2xl bg-amber/15 px-4 py-2.5 text-sm font-bold text-amber ring-1 ring-amber/40"
        >
          {notice} ↻
        </button>
      )}
      <motion.button
        type="button"
        data-ui
        onClick={onStart}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
        className="group relative mt-10 flex h-40 w-40 items-center justify-center rounded-full sm:h-44 sm:w-44"
        aria-label="Start"
      >
        <span className="pulse-ring absolute inset-0 rounded-full ring-4 ring-cyan/60" />
        <span className="pulse-ring absolute inset-0 rounded-full ring-4 ring-magenta/50 [animation-delay:0.8s]" />
        <span className="btn-neon absolute inset-0 rounded-full" />
        <span className="relative flex flex-col items-center text-bg">
          <PlayIcon size={44} />
          <span className="mt-1 font-display text-sm font-black tracking-[0.2em]">
            {mode === "daily" && dailyDone ? "PRACTICE" : "START"}
          </span>
        </span>
      </motion.button>

      {missions ? (
        <div className="mt-9 w-full max-w-sm text-left">
          <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-muted">Today&apos;s missions</div>
          <ul className="flex flex-col gap-1.5">
            {missions.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${
                  m.done ? "bg-lime/10 text-white ring-lime/30" : "bg-white/[0.04] text-white/85 ring-white/10"
                }`}
              >
                <span>
                  {m.done ? "✅ " : ""}
                  {m.title}
                </span>
                <span className="shrink-0 font-display font-black text-muted">{m.done ? "DONE" : `${m.progress}/${m.target}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-left text-xs font-semibold text-muted">
          <Tip n="1" text="Read the rule on each card" />
          <Tip n="2" text="Tap, count, or freeze in time" />
          <Tip n="3" text="Fast clears = PERFECT combos" />
        </div>
      )}

      <div className="mt-8 flex items-center gap-4 text-sm font-semibold text-muted">
        {best > 0 && (
          <span>
            Your best: <span className="font-display font-black text-white">{best}</span>
          </span>
        )}
        <Link href="/leaderboard" data-ui className="underline decoration-white/20 underline-offset-4 hover:text-white">
          Leaderboard
        </Link>
      </div>
      <p className="mt-4 hidden text-xs text-muted/70 sm:block">Keyboard: Space to tap · Enter for Done</p>
    </div>
  );
}

function Tip({ n, text }: { n: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-1 font-display text-lg font-black text-cyan">{n}</div>
      {text}
    </div>
  );
}
