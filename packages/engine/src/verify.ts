import { evaluateRound, scoreRound } from "./evaluate";
import { generateRound, initialMemory } from "./generator";
import type { RoundLog } from "./types";

export const MAX_LOGGED_ROUNDS = 2000;
/** Taps closer together than this are faster than any human finger. */
export const MIN_TAP_GAP_MS = 45;
/** Gate rounds answered faster than this after the stimulus appeared look automated. */
export const SUSPICIOUS_REACTION_MS = 110;

export interface VerifyResult {
  ok: boolean;
  /** Rounds cleared. */
  rounds: number;
  points: number;
  /** Index of the round that ended the run, if it ended in a fail. */
  failedAt?: number;
  reason?: string;
}

/** Replays a run from its seed and tap log and returns the score it really earned. */
export function verifyRun(seed: number, logs: readonly RoundLog[]): VerifyResult {
  const bad = (reason: string): VerifyResult => ({ ok: false, rounds: 0, points: 0, reason });
  if (logs.length === 0) return bad("empty run");
  if (logs.length > MAX_LOGGED_ROUNDS) return bad("run too long");

  let memory = initialMemory();
  let rounds = 0;
  let points = 0;
  let fastReactions = 0;
  let combo = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]!;
    const index = i + 1;
    if (log.index !== index) return bad(`round ${index} out of order`);
    let lastT = -Infinity;
    let lastZone = -Infinity;
    for (const tap of log.taps) {
      if (!Number.isFinite(tap.t) || tap.t < 0 || tap.t < lastT) return bad(`bad tap timing in round ${index}`);
      if (typeof tap.target !== "string" || tap.target.length > 24) return bad(`bad tap target in round ${index}`);
      if (tap.target === "zone") {
        if (tap.t - lastZone < MIN_TAP_GAP_MS) return bad(`inhuman tap speed in round ${index}`);
        lastZone = tap.t;
      }
      lastT = tap.t;
    }

    const generated = generateRound(seed, index, memory);
    memory = generated.memory;
    const status = evaluateRound(generated.spec, log.taps, Infinity);
    if (status.state === "pass") {
      rounds++;
      const scored = scoreRound(generated.spec, status, combo);
      points += scored.points;
      combo = scored.combo;
      const { expected } = generated.spec;
      // Reaction time counts from when input opens, not from when the task appeared.
      const reaction = status.atMs - generated.spec.inputFromMs;
      if (expected.kind === "count" && expected.gate && expected.n === 1 && reaction < SUSPICIOUS_REACTION_MS) {
        fastReactions++;
      }
      continue;
    }
    if (index !== logs.length) return bad(`rounds logged after the run ended at ${index}`);
    if (fastReactions >= 3) return bad("reaction times look automated");
    return { ok: true, rounds, points, failedAt: index };
  }
  if (fastReactions >= 3) return bad("reaction times look automated");
  // The log ended on a cleared round: the player quit or closed the tab. Keep what they earned.
  return { ok: true, rounds, points };
}
