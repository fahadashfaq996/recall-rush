import { PACKS, type ContentDifficulty } from "../content";
import { decide, readMs } from "../difficulty";
import type { Rng } from "../rng";
import { gate, ladder, tap, type Generator } from "./kit";

/** Hardest content a type level may use: easy facts first, tricky ones from level 3. */
const maxDifficulty = (level: number): ContentDifficulty => ladder(level, [1, 2, 2, 3] as const);

/** Picks content up to the level's difficulty, leaning towards the hardest allowed once the player is warmed up. */
function pickByDifficulty<T extends { difficulty: ContentDifficulty }>(rng: Rng, items: readonly T[], level: number): T {
  const cap = maxDifficulty(level);
  const allowed = items.filter((i) => i.difficulty <= cap);
  const pool = allowed.length ? allowed : items;
  if (level >= 3) {
    const hardest = pool.filter((i) => i.difficulty === cap);
    if (hardest.length && rng.chance(0.6)) return rng.pick(hardest);
  }
  return rng.pick(pool);
}

/** A question with a small number for an answer: tap it out. Ladder: content difficulty and answer size. */
export const trivia: Generator = ({ rng, level, minCount, maxCount, countMs }) => {
  const inRange = PACKS.trivia.filter((t) => t.answer >= minCount && t.answer <= maxCount);
  const item = pickByDifficulty(rng, inRange, level);
  return {
    title: "NUMBER TRIVIA",
    prompt: "Tap the answer",
    view: { type: "trivia", question: item.q, emoji: item.emoji, answer: item.answer },
    expected: tap(item.answer),
    answerKind: "count",
    durationMs: readMs(item.q) + countMs,
    allowDone: true,
  };
};

/**
 * A statement that is clearly true or false.
 * Ladder: content difficulty → sometimes the rule asks you to tap on FALSE instead.
 */
export const truth: Generator = ({ rng, d, level }) => {
  const item = pickByDifficulty(rng, PACKS.truth, level);
  const askTrue = !rng.chance(ladder(level, [0, 0, 0.4, 0.45]));
  return {
    title: "TRUE OR FALSE",
    prompt: askTrue ? "Tap if it's TRUE" : "Tap if it's FALSE",
    view: { type: "truth", statement: item.statement, truth: item.truth, askTrue },
    expected: gate(askTrue ? item.truth : !item.truth),
    answerKind: "gate",
    durationMs: readMs(item.statement) + decide(d, 2400, 1000),
  };
};

/** Three words from a category and one that only looks like it belongs. Ladder: content difficulty. */
export const oddword: Generator = ({ rng, d, level }) => {
  const category = pickByDifficulty(rng, PACKS.categories, level);
  const intruder = rng.pick(category.intruders);
  const words = rng.shuffle([...rng.sample(category.members, 3), intruder]);
  const intruderIndex = words.indexOf(intruder);
  return {
    title: "ODD WORD OUT",
    prompt: "Tap the word that doesn't belong",
    view: { type: "oddword", category: category.category, words, intruderIndex },
    expected: { kind: "pick", id: `word-${intruderIndex}` },
    answerKind: "fixed",
    durationMs: readMs(words.join(" ")) + decide(d, 3200, 1300),
  };
};
