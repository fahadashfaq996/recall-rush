import type { Rng } from "../rng";
import type { ColorName, Difficulty, Expected, MemoryState, RoundView, SymbolId, CurseId } from "../types";

export interface GenContext {
  rng: Rng;
  d: Difficulty;
  index: number;
  memory: MemoryState;
  /** This type's ladder level for this round (0 = gentlest). Generators scale their twists with it. */
  level: number;
  /** Smallest answer a count round may have (1 while a "minus one" curse is active). */
  minCount: number;
  /** Largest answer a count round may have before curses. */
  maxCount: number;
  /**
   * Thinking plus tapping time for count rounds, sized for the largest possible answer so the timer never leaks
   * it. Generators add reading time on top for any text they show.
   */
  countMs: number;
}

/**
 * How curses treat a round's answer:
 * - count: number-of-taps answers (plus1 / minus1 / double apply)
 * - gate: tap / don't-tap answers (flip applies)
 * - fixed: curses never apply (info rounds, target rounds)
 */
export type AnswerKind = "count" | "gate" | "fixed";

export interface Generated {
  title: string;
  prompt: string;
  view: RoundView;
  expected: Expected;
  answerKind: AnswerKind;
  durationMs: number;
  inputFromMs?: number;
  allowDone?: boolean;
  /** Extra intro time on top of reading the card, e.g. to study a memo or a rule before taps count. */
  introExtraMs?: number;
  /** Memory changes this round causes (applied after generation). */
  remember?: Partial<Pick<MemoryState, "memo" | "trigger">> & { curse?: { id: CurseId; rounds: number } };
}

export type Generator = (ctx: GenContext) => Generated;

export const COLORS: readonly ColorName[] = ["red", "green", "blue", "yellow", "purple"];
export const SYMBOLS: readonly SymbolId[] = ["star", "heart", "bolt", "diamond", "moon", "skull", "crown", "flame"];

export const COLOR_LABEL: Record<ColorName, string> = {
  red: "RED",
  green: "GREEN",
  blue: "BLUE",
  yellow: "YELLOW",
  purple: "PURPLE",
  cyan: "CYAN",
};

export const SYMBOL_LABEL: Record<SymbolId, string> = {
  star: "STAR",
  heart: "HEART",
  bolt: "BOLT",
  diamond: "DIAMOND",
  moon: "MOON",
  skull: "SKULL",
  crown: "CROWN",
  flame: "FLAME",
};

export const tap = (n: number): Expected => ({ kind: "count", n, gate: false });
export const gate = (go: boolean): Expected => ({ kind: "count", n: go ? 1 : 0, gate: true });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pick by level from a ladder, holding the last value once the ladder runs out. */
export const ladder = <T>(level: number, steps: readonly T[]): T => steps[Math.min(level, steps.length - 1)] as T;

/** Round a memory test lands on: `gap` rounds in between, nudged past a boss so bosses stay clean. */
export function recallDueAt(index: number, gap: number): number {
  const due = index + 1 + gap;
  return due % 10 === 0 ? due + 1 : due;
}
