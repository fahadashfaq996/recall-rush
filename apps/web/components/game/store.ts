"use client";

import {
  FEVER_COMBO,
  comboMultiplier,
  evaluateRound,
  generateRound,
  initialMemory,
  randomSeed,
  scoreRound,
  type FailReason,
  type MemoryState,
  type Rating,
  type RoundLog,
  type RoundResult,
  type RoundSpec,
  type RoundTypeId,
  type TapEvent,
} from "@recall/engine";
import { create } from "zustand";
import type { Mode, StartedRun } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { music } from "@/lib/music";
import { buzz } from "@/lib/haptics";

export type Phase = "ready" | "countdown" | "intro" | "task" | "pass" | "fail" | "over";

export interface Feedback {
  id: number;
  kind: "pass" | "fail" | "tap" | "pick";
  points?: number;
  rating?: Rating;
  /** Combo after this round, and the multiplier it earned. */
  combo?: number;
  multiplier?: number;
  /** A combo of 3+ was just broken by a slow clear. */
  comboLost?: number;
  /** Where the tap landed, in viewport pixels, for ripples and particles. */
  x?: number;
  y?: number;
}

interface GameState {
  mode: Mode;
  phase: Phase;
  seed: number;
  run: StartedRun | null;
  index: number;
  spec: RoundSpec | null;
  memory: MemoryState;
  taps: TapEvent[];
  /** Zone taps or sequence steps so far this round. */
  progress: number;
  /** Targets tapped correctly this round (sequence feedback). */
  hit: string[];
  points: number;
  /** Consecutive PERFECT clears. */
  combo: number;
  bestCombo: number;
  /** Cleared rounds, for missions, achievements and stats at the end of the run. */
  results: RoundResult[];
  failedOn: RoundTypeId | null;
  logs: RoundLog[];
  countdown: number;
  failReason: FailReason | null;
  /** Wrong target the player tapped, to mark it on the reveal. */
  wrongTarget: string | null;
  feedback: Feedback | null;
  taskStartedAt: number;
  introStartedAt: number;
  levelUp: boolean;

  prepare(mode: Mode, run: StartedRun | null, seed?: number): void;
  attachRun(run: StartedRun): void;
  start(): void;
  tap(target: string, x?: number, y?: number): void;
  reset(): void;
}

let timers: ReturnType<typeof setTimeout>[] = [];
const later = (fn: () => void, ms: number) => {
  timers.push(setTimeout(fn, ms));
};
const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};
let feedbackId = 0;

const PASS_PAUSE_MS = 380;
const INTRO_SKIP_AFTER_MS = 400;
const LEVEL_UP_PAUSE_MS = 1300;
const FAIL_REVEAL_MS = 1700;

export const useGame = create<GameState>((set, get) => {
  function beginRound(index: number) {
    const { seed, memory } = get();
    const generated = generateRound(seed, index, memory);
    set({
      phase: "intro",
      index,
      spec: generated.spec,
      memory: generated.memory,
      taps: [],
      progress: 0,
      hit: [],
      levelUp: false,
      wrongTarget: null,
      introStartedAt: performance.now(),
    });
    const { spec } = generated;
    if (index === 1) music.start();
    music.setSpeed(spec.speed);
    if (spec.type === "curse") sfx.curse();
    else if (spec.boss) sfx.boss();
    else if (spec.speedUp) sfx.speedUp();
    later(startTask, spec.introMs);
  }

  function startTask() {
    const spec = get().spec;
    if (!spec) return;
    set({ phase: "task", taskStartedAt: performance.now() });
    // A small grace period so a tap right on the buzzer still counts on slow devices.
    later(() => finish(), spec.durationMs + 40);
  }

  function finish() {
    const { spec, taps, phase } = get();
    if (!spec || phase !== "task") return;
    resolve(evaluateRound(spec, taps, Infinity));
  }

  function resolve(status: ReturnType<typeof evaluateRound>) {
    const { spec, taps, logs, points, combo, bestCombo, results, index } = get();
    if (!spec || status.state === "pending") return;
    clearTimers();
    const log: RoundLog = { index, taps };
    if (status.state === "pass") {
      const scored = scoreRound(spec, status, combo);
      const rating = scored.rating ?? "good";
      const milestone = index % 10 === 0;
      const enteredFever = scored.combo >= FEVER_COMBO && combo < FEVER_COMBO;
      set({
        phase: "pass",
        logs: [...logs, log],
        points: points + scored.points,
        combo: scored.combo,
        bestCombo: Math.max(bestCombo, scored.combo),
        results: [...results, { type: spec.type, rating, boss: spec.boss, cursed: spec.appliedCurses.length > 0 }],
        levelUp: milestone,
        feedback: {
          id: ++feedbackId,
          kind: "pass",
          points: scored.points,
          rating,
          combo: scored.combo,
          multiplier: comboMultiplier(scored.combo),
          comboLost: rating === "good" && combo >= 3 ? combo : undefined,
        },
      });
      music.setFever(scored.combo >= FEVER_COMBO);
      if (milestone) sfx.levelUp();
      else if (enteredFever) sfx.fever();
      else if (rating === "perfect") sfx.perfect(scored.combo);
      else sfx.pass(scored.combo);
      buzz(rating === "perfect" ? [10, 30, 10] : 12);
      later(() => beginRound(index + 1), milestone ? LEVEL_UP_PAUSE_MS : PASS_PAUSE_MS);
      return;
    }
    set({
      phase: "fail",
      logs: [...logs, log],
      failReason: status.reason,
      failedOn: spec.type,
      feedback: { id: ++feedbackId, kind: "fail" },
    });
    music.stop();
    sfx.fail();
    buzz([40, 60, 90]);
    later(() => set({ phase: "over" }), FAIL_REVEAL_MS);
  }

  return {
    mode: "endless",
    phase: "ready",
    seed: 0,
    run: null,
    index: 0,
    spec: null,
    memory: initialMemory(),
    taps: [],
    progress: 0,
    hit: [],
    points: 0,
    combo: 0,
    bestCombo: 0,
    results: [],
    failedOn: null,
    logs: [],
    countdown: 3,
    failReason: null,
    wrongTarget: null,
    feedback: null,
    taskStartedAt: 0,
    introStartedAt: 0,
    levelUp: false,

    prepare(mode, run, seed) {
      clearTimers();
      music.stop();
      set({
        mode,
        run,
        seed: run?.seed ?? seed ?? randomSeed(),
        phase: "ready",
        index: 0,
        spec: null,
        memory: initialMemory(),
        taps: [],
        progress: 0,
        hit: [],
        points: 0,
        combo: 0,
        bestCombo: 0,
        results: [],
        failedOn: null,
        logs: [],
        failReason: null,
        wrongTarget: null,
        feedback: null,
        levelUp: false,
      });
    },

    attachRun(run) {
      // The server seed arrived after the player was already on the ready screen.
      if (get().phase === "ready") set({ run, seed: run.seed });
    },

    start() {
      if (get().phase !== "ready") return;
      sfx.unlock();
      set({ phase: "countdown", countdown: 3 });
      sfx.tick();
      later(() => (set({ countdown: 2 }), sfx.tick()), 420);
      later(() => (set({ countdown: 1 }), sfx.tick()), 840);
      later(() => {
        sfx.tick(true);
        beginRound(1);
      }, 1260);
    },

    tap(target, x, y) {
      const { phase, spec, taps, taskStartedAt, introStartedAt } = get();
      // Tapping the instruction card skips the rest of its reading time. The short delay stops a tap meant for
      // the previous round from skipping a card nobody has read yet; the task itself ignores its first 250ms.
      if (phase === "intro" && performance.now() - introStartedAt > INTRO_SKIP_AFTER_MS) {
        clearTimers();
        startTask();
        return;
      }
      if (phase !== "task" || !spec) return;
      const t = Math.round(performance.now() - taskStartedAt);
      if (t < spec.inputFromMs) return;
      const nextTaps = [...taps, { t, target }];
      const status = evaluateRound(spec, nextTaps, t);
      if (status.state === "pending") {
        const isTarget = target !== "zone" && target !== "done";
        set({
          taps: nextTaps,
          progress: status.count,
          hit: isTarget ? [...get().hit, target] : get().hit,
          feedback: { id: ++feedbackId, kind: isTarget ? "pick" : "tap", x, y },
        });
        if (isTarget) sfx.pick();
        else sfx.tap(status.count);
        buzz(8);
        return;
      }
      set({
        taps: nextTaps,
        wrongTarget: status.state === "fail" && target !== "zone" && target !== "done" ? target : null,
      });
      resolve(status);
    },

    reset() {
      clearTimers();
      music.stop();
      set({ phase: "ready" });
    },
  };
});

// Dev-only handle for automated play-testing from the browser console.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __recall: typeof useGame }).__recall = useGame;
}
