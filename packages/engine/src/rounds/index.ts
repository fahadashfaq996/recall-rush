import type { RoundTypeId } from "../types";
import { dots, edges, math } from "./counting";
import type { Generator } from "./kit";
import { oddword, trivia, truth } from "./knowledge";
import { curse, memo, odd, recall, sequence, trigger, words } from "./memory";
import { gonogo, simon, stroop } from "./reaction";

export const GENERATORS: Record<RoundTypeId, Generator> = {
  gonogo,
  math,
  edges,
  simon,
  dots,
  trigger,
  odd,
  stroop,
  memo,
  recall,
  sequence,
  curse,
  trivia,
  truth,
  oddword,
  words,
};

/** Relative chance of each type once unlocked. Recall is never drawn; it's scheduled by a memo. */
export const WEIGHTS: Record<RoundTypeId, number> = {
  gonogo: 1,
  math: 1.2,
  edges: 1,
  simon: 0.8,
  dots: 1,
  trigger: 0.7,
  odd: 0.9,
  stroop: 1,
  memo: 0.7,
  recall: 0,
  sequence: 0.8,
  curse: 0.6,
  trivia: 1,
  truth: 1,
  oddword: 0.9,
  words: 0.6,
};

export * from "./kit";
