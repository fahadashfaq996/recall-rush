import { PACKS } from "../content";
import { decide, readMs } from "../difficulty";
import type { CurseId, MemoValue, TriggerAction } from "../types";
import { COLORS, SYMBOLS, SYMBOL_LABEL, gate, ladder, recallDueAt, tap, type Generator } from "./kit";

/** Info rounds end on the player's own tap ("lock it in"), so they get a relaxed, unscaled window. */
const LOCK_IN_MS = 3000;

/** A rule about the NEXT round: if a symbol shows up, freeze or tap the symbol. Decoys come in later (generator). */
export const trigger: Generator = ({ rng, index }) => {
  const symbol = rng.pick(SYMBOLS);
  const action: TriggerAction = rng.chance(0.5) ? "freeze" : "tapSymbol";
  return {
    title: "RULE FOR NEXT ROUND",
    prompt:
      action === "freeze"
        ? `If you see the ${SYMBOL_LABEL[symbol]} next round, DON'T TAP AT ALL`
        : `If you see the ${SYMBOL_LABEL[symbol]} next round, TAP IT`,
    view: { type: "trigger", symbol, action },
    expected: gate(true),
    answerKind: "fixed",
    durationMs: LOCK_IN_MS,
    introExtraMs: 500,
    remember: { trigger: { symbol, action, at: index + 1 } },
  };
};

/**
 * Show something to memorize; a later round asks for it.
 * Ladder: numbers and symbols → colors too. The gap before the recall grows with the stage.
 */
export const memo: Generator = ({ rng, d, index, level }) => {
  const kinds: ("number" | "symbol" | "color")[] = level >= 2 ? ["number", "symbol", "color"] : ["number", "symbol"];
  const kind = rng.pick(kinds);
  const value: MemoValue =
    kind === "number"
      ? { kind, value: rng.int(1, 9) }
      : kind === "symbol"
        ? { kind, value: rng.pick(SYMBOLS) }
        : { kind, value: rng.pick(COLORS) };
  const dueAt = recallDueAt(index, d.recallGap);
  return {
    title: "MEMORIZE",
    prompt: `You'll need this in ${dueAt - index} rounds. Tap to lock it in`,
    view: { type: "memo", memo: value },
    expected: gate(true),
    answerKind: "fixed",
    durationMs: LOCK_IN_MS,
    introExtraMs: 900,
    remember: { memo: { value, storedAt: index, dueAt } },
  };
};

/**
 * Asks for the memorized value.
 * Ladder: pick it from 4 options → numbers sometimes tapped out instead → 6 options.
 */
export const recall: Generator = ({ rng, d, index, memory, countMs, minCount, level }) => {
  const stored = memory.memo;
  if (!stored) throw new Error("recall round without a memo");
  const value = stored.value;
  const roundsAgo = index - stored.storedAt;
  if (value.kind === "words") return recallWords(value, { rng, d, level, roundsAgo });
  if (value.kind === "number" && value.value >= minCount && rng.chance(ladder(level, [0, 0, 0.45]))) {
    return {
      title: "RECALL",
      prompt: `Tap the number you memorized ${roundsAgo} rounds ago`,
      view: { type: "recall", memoKind: "number", mode: "count", options: [], roundsAgo },
      expected: tap(value.value),
      answerKind: "count",
      durationMs: countMs,
      allowDone: true,
    };
  }
  const optionCount = ladder(level, [4, 4, 4, 6]);
  let pool: string[];
  let answer: string;
  if (value.kind === "number") {
    answer = String(value.value);
    pool = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  } else if (value.kind === "symbol") {
    answer = value.value;
    pool = [...SYMBOLS];
  } else {
    answer = value.value;
    pool = [...COLORS];
  }
  const options = rng.shuffle([
    answer,
    ...rng.sample(
      pool.filter((p) => p !== answer),
      optionCount - 1,
    ),
  ]);
  const label = value.kind === "number" ? "number" : value.kind === "symbol" ? "symbol" : "color";
  return {
    title: "RECALL",
    prompt: `Tap the ${label} you memorized ${roundsAgo} rounds ago`,
    view: { type: "recall", memoKind: value.kind, mode: "pick", options, roundsAgo },
    expected: { kind: "pick", id: `opt-${options.indexOf(answer)}` },
    answerKind: "fixed",
    durationMs: decide(d, 5000, 1800),
  };
};

/** Picks the word that was on the list, or later the one that wasn't, among look-alikes from the same theme. */
function recallWords(
  value: Extract<MemoValue, { kind: "words" }>,
  { rng, d, level, roundsAgo }: Pick<Parameters<Generator>[0], "rng" | "d" | "level"> & { roundsAgo: number },
): ReturnType<Generator> {
  const set = PACKS.wordsets.find((s) => s.id === value.setId);
  const unseen = (set?.words ?? []).filter((w) => !value.value.includes(w));
  const askNotShown = unseen.length > 0 && rng.chance(ladder(level, [0, 0, 0, 0.4, 0.5]));
  const answer = askNotShown ? rng.pick(unseen) : rng.pick(value.value);
  const others = askNotShown ? rng.sample(value.value, 3) : rng.sample(unseen, 3);
  const options = rng.shuffle([answer, ...others]);
  return {
    title: "WORD RECALL",
    prompt: askNotShown
      ? `Tap the word that was NOT on the list ${roundsAgo} rounds ago`
      : `Tap the word that WAS on the list ${roundsAgo} rounds ago`,
    view: { type: "recall", memoKind: "words", mode: "pick", options, roundsAgo, askNotShown },
    expected: { kind: "pick", id: `opt-${options.indexOf(answer)}` },
    answerKind: "fixed",
    durationMs: readMs(options.join(" ")) + decide(d, 3000, 1300),
  };
}

/**
 * Show a few words on one theme; a later round asks which word was (or wasn't) on the list.
 * Ladder: 3 words → 4 words → 5 words.
 */
export const words: Generator = ({ rng, d, index, level }) => {
  const set = rng.pick(PACKS.wordsets);
  const count = ladder(level, [3, 3, 4, 4, 5]);
  const shown = rng.sample(set.words, count);
  const dueAt = recallDueAt(index, d.recallGap);
  return {
    title: "MEMORIZE THE WORDS",
    prompt: `You'll need these in ${dueAt - index} rounds. Tap to lock them in`,
    view: { type: "words", words: shown, theme: set.theme },
    expected: gate(true),
    answerKind: "fixed",
    durationMs: LOCK_IN_MS,
    introExtraMs: readMs(shown.join(" ")) + count * 300,
    remember: { memo: { value: { kind: "words", value: shown, setId: set.id }, storedAt: index, dueAt } },
  };
};

/**
 * Tiles light up in order; replay the order.
 * Ladder: 3 tiles on a 3×3 grid, one more tile per level, a 4×4 grid from level 3. Playback speeds up with speed.
 */
export const sequence: Generator = ({ rng, d, level }) => {
  const cols = level >= 3 ? 4 : 3;
  const length = Math.min(8, 3 + level);
  const order: number[] = [];
  while (order.length < length) {
    const cell = rng.int(0, cols * cols - 1);
    if (cell !== order[order.length - 1]) order.push(cell);
  }
  const stepMs = Math.max(380, Math.round(700 / Math.sqrt(d.speed)));
  const perTapMs = Math.max(450, Math.round(900 / Math.sqrt(d.speed)));
  const inputFromMs = length * stepMs + 250;
  return {
    title: "REPLAY THE PATTERN",
    prompt: "Watch, then tap the tiles in order",
    view: { type: "sequence", cols, order, stepMs },
    expected: { kind: "sequence", ids: order.map((c) => `cell-${c}`) },
    answerKind: "fixed",
    durationMs: inputFromMs + length * perTapMs + 1500,
    inputFromMs,
  };
};

/**
 * One tile in the grid is a slightly different shade.
 * Ladder: obvious difference on 3×3 → 4×4 → 5×5 with a difference you have to look for.
 */
export const odd: Generator = ({ rng, d, level }) => {
  const cols = ladder(level, [3, 3, 4, 4, 5]);
  const oddIndex = rng.int(0, cols * cols - 1);
  const delta = ladder(level, [40, 32, 25, 19, 14, 11, 9]) * (rng.chance(0.5) ? 1 : -1);
  const lightDelta = ladder(level, [16, 13, 10, 8, 6, 5, 4]);
  return {
    title: "ODD ONE OUT",
    prompt: "Tap the tile that's different",
    view: { type: "odd", cols, hue: rng.int(0, 359), delta, lightDelta, oddIndex },
    expected: { kind: "pick", id: `tile-${oddIndex}` },
    answerKind: "fixed",
    durationMs: decide(d, 4800 + cols * 300, 1800),
  };
};

const CURSE_TEXT: Record<CurseId, string> = {
  plus1: "tap ONE MORE than the answer",
  minus1: "tap ONE LESS than the answer",
  double: "tap TWICE the answer",
  flip: "on tap-or-freeze rounds, do the OPPOSITE",
};

/** A rule that bends the answers of the next few rounds. Curses last longer at higher levels, and can stack. */
export const curse: Generator = ({ rng, index, memory, level }) => {
  const active = new Set(memory.curses.filter((c) => c.until >= index + 1).map((c) => c.id));
  const options = (["plus1", "minus1", "double", "flip"] as CurseId[]).filter(
    (c) => !active.has(c) && !(c === "plus1" && active.has("minus1")) && !(c === "minus1" && active.has("plus1")),
  );
  const id = rng.pick(options.length ? options : (["flip"] as CurseId[]));
  const rounds = rng.int(3, 3 + Math.min(2, level));
  return {
    title: "CURSED!",
    prompt: `For the next ${rounds} rounds, ${CURSE_TEXT[id]}. Tap to accept`,
    view: { type: "curse", curse: id, rounds },
    expected: gate(true),
    answerKind: "fixed",
    durationMs: 3500,
    introExtraMs: 1200,
    remember: { curse: { id, rounds } },
  };
};
