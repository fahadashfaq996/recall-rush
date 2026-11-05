import { mulberry32 } from "./rng";
import type { Difficulty, RoundTypeId } from "./types";

/**
 * Difficulty follows the WarioWare model, the closest relative of this game:
 *
 * - A run is split into 10-round stages. Within a stage the SPEED steps up twice (rounds x5 and x8).
 * - Round x0 is a BOSS: a familiar round type one level harder, at the stage's top speed, worth double points.
 * - After the boss comes a LEVEL UP: speed eases back a little (a sawtooth, giving players a breather) while
 *   every round type moves up its own difficulty ladder (more decoys, longer patterns, harder content).
 * - Speed approaches a ceiling instead of growing forever, so late game difficulty comes from levels, stacked
 *   curses and longer memory gaps rather than impossible reflexes.
 *
 * The curve is the same for everyone (no adaptive difficulty), so a round number means the same thing on the
 * leaderboard and the Daily Challenge is identical for all players.
 */

export const STAGE_LENGTH = 10;
/** Type levels stop climbing here; beyond it only speed, curses and memory gaps keep growing. */
export const MAX_LEVEL = 5;

/** Gentle single-screen rounds: a run opens with these. */
const GENTLE_TYPES: readonly RoundTypeId[] = ["gonogo", "math", "edges", "dots"];
/** Rounds that need reading, rule-switching or fine perception. */
const MEDIUM_TYPES: readonly RoundTypeId[] = ["simon", "odd", "stroop", "trivia", "truth", "oddword"];
/** Rounds that test memory across rounds. */
const MEMORY_TYPES: readonly RoundTypeId[] = ["trigger", "memo", "words", "sequence"];
/** Round index at which the 1st, 2nd, … type of each group unlocks; the order inside a group is shuffled per run. */
const GENTLE_SLOTS = [1, 1, 3, 5] as const;
const MEDIUM_SLOTS = [7, 9, 12, 14, 16, 18] as const;
const MEMORY_SLOTS = [8, 13, 17, 22] as const;
const CURSE_UNLOCK = 25;

/** Taps per second we expect a real player to manage comfortably. */
export const HUMAN_TAPS_PER_SEC = 6;

/**
 * Time budgets. Reading time is never compressed by speed (players read at the same pace in round 80 as in
 * round 1); only thinking and reaction time shrink. Reading is budgeted at ~180 words per minute, below the
 * ~238 wpm adult average, because people read slower on phone screens and many players read English as a
 * second language.
 */
export const TIMING = {
  /** Taps this early in a task are ignored, so a tap that skips the intro can't count as an answer. */
  minInputMs: 250,
  readBaseMs: 600,
  readMsPerChar: 62,
  readMaxMs: 5500,
  introBaseMs: 1200,
  introMsPerChar: 40,
  introDebutBonusMs: 1800,
  introBossBonusMs: 900,
  introMaxMs: 6500,
} as const;

/** Time to read a piece of text on screen. */
export const readMs = (text: string) => Math.min(TIMING.readMaxMs, TIMING.readBaseMs + text.length * TIMING.readMsPerChar);

/** Thinking/reaction time at this speed, never below a human floor. */
export const decide = (d: Difficulty, ms: number, floorMs: number) => Math.max(floorMs, Math.round(ms / d.speed));

/** Time allowed per required tap in counting rounds: tapping speeds up gently, up to ~4.5 taps per second. */
export const msPerTap = (d: Difficulty) => Math.max(220, Math.round(330 / Math.sqrt(d.speed)));

let cachedPlan: { seed: number; plan: Record<RoundTypeId, number> } | null = null;

/** Round index at which each type unlocks in this run. Fixed pacing, shuffled order. */
export function unlockPlan(seed: number): Record<RoundTypeId, number> {
  if (cachedPlan?.seed === seed) return cachedPlan.plan;
  const rng = mulberry32(seed ^ 0x5eed5eed);
  const plan = { curse: CURSE_UNLOCK } as Record<RoundTypeId, number>;
  rng.shuffle(GENTLE_TYPES).forEach((t, i) => (plan[t] = GENTLE_SLOTS[i] as number));
  rng.shuffle(MEDIUM_TYPES).forEach((t, i) => (plan[t] = MEDIUM_SLOTS[i] as number));
  rng.shuffle(MEMORY_TYPES).forEach((t, i) => (plan[t] = MEMORY_SLOTS[i] as number));
  plan.recall = Math.min(plan.memo, plan.words);
  cachedPlan = { seed, plan };
  return plan;
}

/** Base speed of a stage: 1.0 at the start, easing towards 2.0. */
const stageBaseSpeed = (stage: number) => 1 + (1 - Math.exp(-stage / 3.2));
/** Size of each in-stage Speed Up; bigger in later stages so the sawtooth gets more pronounced. */
const speedStepSize = (stage: number) => 0.07 + 0.02 * Math.min(stage, 4);
/** Speed steps within a stage: rounds 1-4, 5-7 and 8-10. */
const speedStepAt = (pos: number) => (pos >= 7 ? 2 : pos >= 4 ? 1 : 0);

export function difficulty(index: number): Difficulty {
  const stage = Math.floor((index - 1) / STAGE_LENGTH);
  const pos = (index - 1) % STAGE_LENGTH;
  const step = speedStepAt(pos);
  const speed = Math.round((stageBaseSpeed(stage) + step * speedStepSize(stage)) * 100) / 100;
  return {
    index,
    stage,
    pos,
    level: Math.min(stage, MAX_LEVEL),
    speed,
    speedUp: pos === 4 || pos === 7,
    boss: pos === STAGE_LENGTH - 1,
    recallGap: stage < 2 ? 1 : stage < 4 ? 2 : 3,
    maxCurses: stage < 2 ? 0 : stage < 4 ? 1 : stage < 6 ? 2 : 3,
  };
}

/** Largest answer a counting round asks for at a type level (before curses). */
export const maxCountAt = (level: number) => Math.min(10, 5 + level);

/**
 * How hard a round type plays this round: the stage's level, except that a type's first appearance is always at
 * level 0 and its second at most level 2, so a type that unlocks late still eases in. Bosses play one level above.
 */
export function typeLevel(d: Difficulty, timesSeen: number): number {
  const base = timesSeen === 0 ? 0 : Math.min(d.level, timesSeen + 1);
  return d.boss ? Math.min(MAX_LEVEL + 1, base + 1) : base;
}

/** Instruction card time: enough to read it at ~180 wpm, more the first time a type appears or for a boss. */
export function introMs(text: string, opts: { debut: boolean; boss: boolean; extraMs?: number }): number {
  const ms =
    TIMING.introBaseMs +
    text.length * TIMING.introMsPerChar +
    (opts.debut ? TIMING.introDebutBonusMs : 0) +
    (opts.boss ? TIMING.introBossBonusMs : 0) +
    (opts.extraMs ?? 0);
  return Math.min(TIMING.introMaxMs, ms);
}
