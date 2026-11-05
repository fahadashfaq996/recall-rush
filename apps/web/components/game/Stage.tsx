"use client";

import { FAIL_COPY, INFO_TYPES, answerText, type RoundSpec } from "@recall/engine";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { RoundView } from "@/components/rounds/RoundView";
import { SymbolIcon } from "@/components/ui/icons";
import type { Phase } from "./store";
import { useGame } from "./store";
import { StatusStrip } from "./Juice";
import { TimerRing } from "./TimerRing";

const TRIGGER_SPOTS = ["top-[3%] right-[4%]", "top-[3%] left-[4%]", "bottom-[3%] right-[4%]", "bottom-[3%] left-[4%]"];

/** Sizes the ring to the largest circle that fits the stimulus area, and makes its inside a query container. */
const RING_BOX: CSSProperties = { width: "min(96cqw, 96cqh)" };
const sizeContainer: CSSProperties = { containerType: "size" };

/** Everything inside a round: intro card, the timer ring with the task inside it, and the bottom controls. */
/** One-line coaching shown the first time a new player meets each round type. */
const COACH: Partial<Record<RoundSpec["type"], string>> = {
  gonogo: "Tap anywhere if it matches the rule. If not, don't touch!",
  math: "Tap the screen that many times, then press DONE",
  edges: "Tap the screen once per edge, then press DONE",
  dots: "Count the dots before they vanish, tap that many, then DONE",
  trivia: "Tap the answer out, then press DONE",
  simon: 'Only obey lines that start with "Simon says"',
  stroop: "Judge the ink color, not the word",
  truth: "Tap if the rule matches. Otherwise freeze!",
  odd: "Find the tile with a slightly different shade",
  oddword: "Tap the word that doesn't fit with the others",
  sequence: "Watch the order, then tap the same tiles",
  memo: "Remember this for a later round",
  words: "Remember these words for a later round",
  trigger: "Keep this rule in mind for the very next round",
  recall: "Pick the thing you memorized earlier",
};

export function Stage({ spec, phase, best, coach = false }: { spec: RoundSpec; phase: Phase; best: number; coach?: boolean }) {
  const progress = useGame((s) => s.progress);
  const hit = useGame((s) => s.hit);
  const wrongTarget = useGame((s) => s.wrongTarget);
  const failReason = useGame((s) => s.failReason);
  const levelUp = useGame((s) => s.levelUp);
  const combo = useGame((s) => s.combo);
  const cleared = useGame((s) => s.results.length);

  const info = INFO_TYPES.includes(spec.type);
  const playing = phase === "task" || phase === "pass" || phase === "fail";
  // Info rounds show their content during the intro too: that's the study window before taps count.
  const active = playing || (info && phase === "intro");
  const reveal = phase === "fail";
  const isNew = spec.debut && spec.index > 1;
  const counting = spec.expected.kind === "count" && !spec.expected.gate && spec.allowDone;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StatusStrip combo={combo} cleared={cleared} best={best} />

      {/* Prompt */}
      <div className="flex min-h-[56px] items-center justify-center px-6 pt-1 text-center">
        <AnimatePresence mode="wait">
          {active && (
            <motion.p
              key={`prompt-${spec.index}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-xl text-balance font-display text-[clamp(15px,4.2vw,22px)] font-extrabold leading-snug text-white"
            >
              {spec.prompt}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Stimulus area: the ring is the largest circle that fits */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3" style={sizeContainer}>
        <div className="relative aspect-square" style={RING_BOX}>
          <TimerRing
            key={`ring-${spec.index}`}
            durationMs={spec.durationMs}
            started={playing}
            running={phase === "task"}
            boss={spec.boss}
          />
          {/* The task lives in the square inscribed in the ring; round visuals size themselves in cqmin. */}
          <div key={`task-${spec.index}`} className="absolute inset-[16%] flex items-center justify-center" style={sizeContainer}>
            <RoundView spec={spec} active={active} reveal={reveal} hit={hit} wrongTarget={wrongTarget} />
          </div>

          {/* Intro card, inside the ring */}
          <AnimatePresence>
            {phase === "intro" && !info && (
              <motion.div
                key={`intro-${spec.index}`}
                initial={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 1.08, filter: "blur(6px)" }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="pointer-events-none absolute inset-[11%] z-30 flex flex-col items-center justify-center text-center"
                style={sizeContainer}
              >
                <div className="mb-[3cqmin] flex flex-wrap items-center justify-center gap-[2cqmin]">
                  {spec.boss && (
                    <Badge className="animate-pulse bg-magenta text-white shadow-[0_0_34px_rgba(255,43,214,0.75)]">BOSS ROUND · ×2</Badge>
                  )}
                  {spec.speedUp && <Badge className="bg-amber text-black shadow-[0_0_30px_rgba(255,196,61,0.6)]">SPEED UP!</Badge>}
                  {isNew && <Badge className="bg-lime text-black shadow-[0_0_30px_rgba(182,255,59,0.6)]">NEW ROUND TYPE</Badge>}
                </div>
                <div className="font-bold uppercase tracking-[0.35em] text-muted" style={{ fontSize: "4.2cqmin" }}>
                  Round {spec.index}
                </div>
                <h2
                  className={`mt-[1.5cqmin] text-balance font-display font-black leading-[1.02] ${
                    spec.type === "curse" ? "neon-text-magenta" : "neon-text-cyan"
                  }`}
                  style={{ fontSize: spec.title.length > 14 ? "10.5cqmin" : "12.5cqmin" }}
                >
                  {spec.title}
                </h2>
                <p
                  className="mt-[3cqmin] max-w-[88cqw] text-balance font-semibold leading-snug text-white/90"
                  style={{ fontSize: "6cqmin" }}
                >
                  {spec.prompt}
                </p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="mt-[4cqmin] font-display font-extrabold tracking-[0.3em] text-white/55"
                  style={{ fontSize: "3.6cqmin" }}
                >
                  TAP WHEN READY
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Level up banner */}
          <AnimatePresence>
            {phase === "pass" && levelUp && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="pointer-events-none absolute inset-[6%] z-30 flex flex-col items-center justify-center rounded-full bg-bg/80 backdrop-blur-sm"
                style={sizeContainer}
              >
                <div className="font-bold uppercase tracking-[0.4em] text-lime" style={{ fontSize: "4.5cqmin" }}>
                  Boss cleared
                </div>
                <div className="font-display font-black leading-none neon-text-lime" style={{ fontSize: "17cqmin" }}>
                  LEVEL {spec.level + 1}
                </div>
                <div className="mt-[3cqmin] font-display font-extrabold tracking-widest text-white" style={{ fontSize: "5cqmin" }}>
                  NEW TWISTS UNLOCKED
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {spec.trigger && active && (
          <button
            type="button"
            data-target="trigger"
            aria-label="Symbol"
            className={`absolute ${TRIGGER_SPOTS[spec.index % TRIGGER_SPOTS.length]} z-20 rounded-2xl p-2 transition-transform active:scale-90 ${
              reveal && spec.trigger.matches ? "ring-4 ring-white" : ""
            }`}
          >
            <span className="pulse-ring absolute inset-0 rounded-2xl ring-2 ring-white/40" />
            <SymbolIcon id={spec.trigger.symbol} size="min(15vw, 15cqmin, 76px)" />
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 flex min-h-[124px] flex-col items-center justify-end gap-3 px-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {phase === "fail" && failReason && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none w-full max-w-md rounded-2xl bg-danger/15 px-5 py-3 text-center ring-1 ring-danger/50 backdrop-blur"
            >
              <div className="font-display text-xl font-black neon-text-danger">{FAIL_COPY[failReason].toUpperCase()}</div>
              <div className="mt-1 text-sm font-semibold text-white/85">{answerText(spec)}</div>
            </motion.div>
          )}
        </AnimatePresence>
        {coach && spec.debut && COACH[spec.type] && (phase === "task" || (info && phase === "intro")) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full bg-cyan/15 px-4 py-2 text-center text-xs font-bold text-white ring-1 ring-cyan/40"
          >
            💡 {COACH[spec.type]}
          </motion.div>
        )}
        {active && counting && phase !== "fail" && (
          <>
            <div className="flex h-6 flex-wrap items-center justify-center gap-1.5" aria-live="polite" aria-label={`${progress} taps`}>
              {progress === 0 ? (
                <span className="text-sm font-semibold text-muted">Tap anywhere to count</span>
              ) : (
                Array.from({ length: progress }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-3 w-3 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]"
                  />
                ))
              )}
            </div>
            <button
              type="button"
              data-target="done"
              className="flex h-14 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-white/10 px-8 font-display text-lg font-black tracking-wider ring-1 ring-white/25 transition active:scale-95"
            >
              <span className="text-lime">✓</span> DONE
              <span className="ml-1 font-sans text-xs font-bold text-muted">{progress}</span>
            </button>
          </>
        )}
        {info && phase === "intro" && (
          <div className="font-display text-sm font-extrabold tracking-[0.25em] text-muted">
            {isNew ? "NEW · " : ""}STUDY IT · TAP WHEN READY
          </div>
        )}
        {info && phase === "task" && (
          <div className="animate-pulse font-display text-sm font-extrabold tracking-[0.25em] text-white/90">TAP ANYWHERE TO LOCK IN</div>
        )}
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: string; className: string }) {
  return (
    <div
      className={`rounded-full px-[4cqmin] py-[1cqmin] font-display font-black tracking-[0.18em] ${className}`}
      style={{ fontSize: "4cqmin" }}
    >
      {children}
    </div>
  );
}
