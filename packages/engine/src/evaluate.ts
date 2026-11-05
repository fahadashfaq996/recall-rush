import { difficulty } from "./difficulty";
import { INFO_TYPES, type RoundSpec, type RoundStatus, type TapEvent } from "./types";

/**
 * Judges a round from the taps so far. Pass `elapsedMs = Infinity` once the round is over to get a final verdict.
 * Taps must be in time order; taps before `inputFromMs` or after the timer are ignored.
 */
export function evaluateRound(spec: RoundSpec, taps: readonly TapEvent[], elapsedMs: number): RoundStatus {
  const { expected, durationMs } = spec;
  let count = 0;
  let step = 0;

  for (const tap of taps) {
    if (tap.t < spec.inputFromMs || tap.t > durationMs) continue;

    if (expected.kind === "count") {
      if (tap.target === "done") {
        if (!spec.allowDone) continue;
        if (count === expected.n) return { state: "pass", atMs: tap.t };
        return { state: "fail", atMs: tap.t, reason: count < expected.n ? "too-few" : "too-many" };
      }
      if (tap.target !== "zone") return { state: "fail", atMs: tap.t, reason: "wrong-tap" };
      count++;
      if (expected.gate) {
        return expected.n === 1 ? { state: "pass", atMs: tap.t } : { state: "fail", atMs: tap.t, reason: "tapped-on-no" };
      }
      if (count > expected.n) return { state: "fail", atMs: tap.t, reason: "too-many" };
      continue;
    }

    // Target rounds: stray taps on the background are forgiven.
    if (tap.target === "zone" || tap.target === "done") continue;
    if (expected.kind === "pick") {
      return tap.target === expected.id ? { state: "pass", atMs: tap.t } : { state: "fail", atMs: tap.t, reason: "wrong-tap" };
    }
    if (tap.target !== expected.ids[step]) return { state: "fail", atMs: tap.t, reason: "wrong-tap" };
    step++;
    if (step === expected.ids.length) return { state: "pass", atMs: tap.t };
  }

  if (elapsedMs < durationMs) return { state: "pending", count: expected.kind === "count" ? count : step };

  if (expected.kind === "count") {
    if (count === expected.n) return { state: "pass", atMs: durationMs };
    if (expected.gate) return { state: "fail", atMs: durationMs, reason: "timeout" };
    return { state: "fail", atMs: durationMs, reason: count < expected.n ? "too-few" : "too-many" };
  }
  return { state: "fail", atMs: durationMs, reason: "timeout" };
}

/** Points for a cleared round: a base plus a speed bonus for finishing early, scaled by stage, doubled for bosses. */
export function roundPoints(spec: RoundSpec, status: RoundStatus): number {
  if (status.state !== "pass") return 0;
  const window = spec.durationMs - spec.inputFromMs;
  const left = Math.max(0, spec.durationMs - status.atMs);
  const bonus = window > 0 ? Math.round((200 * left) / window) : 0;
  return Math.round((100 + bonus) * (1 + difficulty(spec.index).stage * 0.25) * (spec.boss ? 2 : 1));
}

/**
 * How well a cleared round was played. "info" rounds (memorize, rules, curses) end on the player's own tap and
 * don't count either way.
 */
export type Rating = "perfect" | "great" | "good" | "info";

/** Share of the answer window used, at or below which a clear counts as PERFECT / GREAT. */
const PERFECT_SHARE = 0.4;
const GREAT_SHARE = 0.7;
/** Combo bonus per consecutive PERFECT, and where it stops growing (×3). */
const COMBO_STEP = 0.1;
const COMBO_CAP = 20;
/** Combo at which the game goes into fever (visual only). */
export const FEVER_COMBO = 8;

export function rateRound(spec: RoundSpec, status: RoundStatus): Rating | null {
  if (status.state !== "pass") return null;
  if (INFO_TYPES.includes(spec.type)) return "info";
  const { expected } = spec;
  // Holding still for the whole timer on a "don't tap" round is the perfect play.
  if (expected.kind === "count" && expected.n === 0) return "perfect";
  const window = spec.durationMs - spec.inputFromMs;
  const share = window > 0 ? (status.atMs - spec.inputFromMs) / window : 1;
  if (share <= PERFECT_SHARE) return "perfect";
  if (share <= GREAT_SHARE) return "great";
  return "good";
}

/** Points multiplier for a combo of consecutive PERFECTs. */
export const comboMultiplier = (combo: number) => 1 + Math.min(combo, COMBO_CAP) * COMBO_STEP;

/**
 * Scores a cleared round and advances the combo: PERFECT adds one, GREAT keeps it, GOOD breaks it, info rounds
 * leave it alone. Points include the combo multiplier. The server replays this exactly when verifying a run.
 */
export function scoreRound(
  spec: RoundSpec,
  status: RoundStatus,
  comboBefore: number,
): { points: number; rating: Rating | null; combo: number } {
  const rating = rateRound(spec, status);
  if (!rating) return { points: 0, rating, combo: 0 };
  const combo = rating === "perfect" ? comboBefore + 1 : rating === "good" ? 0 : comboBefore;
  return { points: Math.round(roundPoints(spec, status) * comboMultiplier(combo)), rating, combo };
}

export const FAIL_COPY: Record<Exclude<RoundStatus, { state: "pending" } | { state: "pass" }>["reason"], string> = {
  "wrong-tap": "Wrong tap",
  "too-many": "Too many taps",
  "too-few": "Not enough taps",
  timeout: "Too slow",
  "tapped-on-no": "You shouldn't have tapped",
};
