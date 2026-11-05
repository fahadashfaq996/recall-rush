import { HUMAN_TAPS_PER_SEC } from "./difficulty";
import type { RoundSpec, TapEvent } from "./types";

/**
 * The taps a perfect, human-speed player would make. Used by the solvability tests and the
 * attract-mode demo on the home page.
 */
export function solveRound(spec: RoundSpec, reactionMs = 320): TapEvent[] {
  const gap = Math.ceil(1000 / HUMAN_TAPS_PER_SEC);
  const start = spec.inputFromMs + reactionMs + (spec.view.type === "dots" ? spec.view.flashMs : 0);
  const { expected } = spec;
  if (expected.kind === "pick") return [{ t: start, target: expected.id }];
  if (expected.kind === "sequence") return expected.ids.map((id, i) => ({ t: start + i * (gap + 180), target: id }));
  const taps: TapEvent[] = Array.from({ length: expected.n }, (_, i) => ({ t: start + i * gap, target: "zone" }));
  if (spec.allowDone) taps.push({ t: start + expected.n * gap + 150, target: "done" });
  return taps;
}
