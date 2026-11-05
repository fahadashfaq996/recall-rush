"use client";

import { FEVER_COMBO, comboMultiplier } from "@recall/engine";
import { AnimatePresence, motion } from "motion/react";
import type { Feedback } from "./store";

const RATING_STYLE = {
  perfect: { label: "PERFECT!", className: "neon-text-lime", size: "text-[clamp(40px,11vw,64px)]" },
  great: { label: "GREAT", className: "neon-text-cyan", size: "text-[clamp(32px,9vw,52px)]" },
  good: { label: "GOOD", className: "text-white/80", size: "text-[clamp(26px,7vw,40px)]" },
  info: { label: "LOCKED IN", className: "neon-text-amber", size: "text-[clamp(24px,6.5vw,36px)]" },
} as const;

/** The pop after a cleared round: rating word, points, and the combo multiplier when one is running. */
export function RatingPop({ feedback }: { feedback: Feedback | null }) {
  const show = feedback?.kind === "pass" && feedback.rating;
  const style = show ? RATING_STYLE[feedback.rating!] : null;
  return (
    <AnimatePresence>
      {show && style && (
        <motion.div
          key={`rate-${feedback.id}`}
          initial={{ opacity: 0, scale: 0.4, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: -30 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className="pointer-events-none absolute left-1/2 top-[30%] z-40 flex -translate-x-1/2 flex-col items-center"
        >
          <div className={`whitespace-nowrap font-display font-black italic tracking-tight ${style.size} ${style.className}`}>
            {style.label}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display text-2xl font-black neon-text-lime">+{feedback.points}</span>
            {(feedback.combo ?? 0) >= 2 && (
              <span className="rounded-full bg-amber px-2.5 py-0.5 font-display text-sm font-black text-black shadow-[0_0_20px_rgba(255,196,61,0.7)]">
                ×{(feedback.multiplier ?? 1).toFixed(1)}
              </span>
            )}
          </div>
          {feedback.comboLost && (
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/60">{feedback.comboLost}× combo lost</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Top strip during a run: live combo on the left, the chase for your personal best on the right. */
export function StatusStrip({ combo, cleared, best }: { combo: number; cleared: number; best: number }) {
  const fever = combo >= FEVER_COMBO;
  return (
    <div className="flex h-8 items-center justify-between px-5">
      <AnimatePresence mode="popLayout">
        {combo >= 2 ? (
          <motion.div
            key={`combo-${combo}`}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-xs font-black tracking-wider ring-1 ${
              fever
                ? "bg-magenta/25 text-white ring-magenta/70 shadow-[0_0_24px_rgba(255,43,214,0.6)]"
                : "bg-amber/15 text-amber ring-amber/40"
            }`}
          >
            <span aria-hidden>{fever ? "☄️" : "🔥"}</span>
            {combo} COMBO
            <span className="text-white/70">×{comboMultiplier(combo).toFixed(1)}</span>
          </motion.div>
        ) : (
          <span key="no-combo" className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/60">
            Fast clears build combos
          </span>
        )}
      </AnimatePresence>
      {best > 0 && (
        <div className="font-display text-[11px] font-extrabold tracking-wider">
          {cleared > best ? (
            <span className="animate-pulse text-lime">NEW BEST +{cleared - best}</span>
          ) : cleared === best ? (
            <span className="text-amber">TIE YOUR BEST!</span>
          ) : (
            <span className="text-muted">
              BEST {best} · <span className="text-white">{best - cleared} to go</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Pulsing neon edges while in fever. */
export function FeverOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fever-edges pointer-events-none fixed inset-0 z-10"
          aria-hidden
        />
      )}
    </AnimatePresence>
  );
}

/** One-off celebration banners: entering fever, beating your best mid-run. */
export function Banner({ id, text, sub, tone }: { id: string | null; text: string; sub?: string; tone: "fever" | "best" }) {
  return (
    <AnimatePresence>
      {id && (
        <motion.div
          key={id}
          initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
          animate={{ opacity: 1, scale: 1, rotate: -2 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-50 flex flex-col items-center"
        >
          <div
            className={`rounded-2xl px-6 py-2 font-display text-[clamp(30px,9vw,54px)] font-black italic ${
              tone === "fever"
                ? "bg-magenta text-white shadow-[0_0_60px_rgba(255,43,214,0.8)]"
                : "bg-lime text-black shadow-[0_0_60px_rgba(182,255,59,0.8)]"
            }`}
          >
            {text}
          </div>
          {sub && <div className="mt-2 font-display text-sm font-extrabold tracking-[0.2em] text-white drop-shadow">{sub}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
