import { decide, msPerTap, readMs } from "../difficulty";
import type { ColorName, ShapeKind } from "../types";
import { COLORS, COLOR_LABEL, gate, ladder, tap, type Generator } from "./kit";

const SHAPES: readonly ShapeKind[] = ["circle", "square", "triangle"];
const SHAPE_PLURAL: Record<ShapeKind, string> = { circle: "CIRCLES", square: "SQUARES", triangle: "TRIANGLES" };

/** Reaction budget for tap / don't-tap rounds before speed is applied, and its floor. */
export const GATE_MS = 2700;
export const GATE_FLOOR_MS = 1100;

/**
 * Tap if the stimulus matches the rule, otherwise hold still.
 * Ladder: color only → sometimes negated ("tap unless") → color AND shape → mostly combined.
 */
export const gonogo: Generator = ({ rng, d, level }) => {
  const conjunction = rng.chance(ladder(level, [0, 0, 0.5, 0.7, 0.85]));
  const negated = rng.chance(ladder(level, [0, 0.3, 0.3, 0.35, 0.4]));
  const ruleColor = rng.pick(COLORS);
  const ruleShape = conjunction ? rng.pick(SHAPES) : undefined;
  const matches = rng.chance(0.5);
  let color: ColorName = ruleColor;
  let shape: ShapeKind = ruleShape ?? rng.pick(SHAPES);
  if (!matches) {
    // Near misses: same color wrong shape, or same shape wrong color.
    if (ruleShape && rng.chance(0.5)) shape = rng.pick(SHAPES.filter((s) => s !== ruleShape));
    else color = rng.pick(COLORS.filter((c) => c !== ruleColor));
  }
  return {
    title: "TAP OR FREEZE",
    prompt: negated
      ? ruleShape
        ? `Tap anything EXCEPT ${COLOR_LABEL[ruleColor]} ${SHAPE_PLURAL[ruleShape]}`
        : `Tap unless it's ${COLOR_LABEL[ruleColor]}`
      : ruleShape
        ? `Tap only ${COLOR_LABEL[ruleColor]} ${SHAPE_PLURAL[ruleShape]}`
        : `Tap only if it's ${COLOR_LABEL[ruleColor]}`,
    view: { type: "gonogo", rule: { color: ruleColor, shape: ruleShape, negated }, stimulus: { color, shape } },
    expected: gate(negated ? !matches : matches),
    answerKind: "gate",
    durationMs: decide(d, GATE_MS + (conjunction ? 300 : 0), GATE_FLOOR_MS),
  };
};

const SIMON = "Simon says:";
/** Look-alikes that must be ignored, used once the player knows the basic rule. */
const TRICK_LEADS = ["Simon said:", "Simone says:", "Simon asks:", "Someone says:"];
const VERBS = ["TAP", "TAP NOW", "HIT IT", "SMASH IT", "POKE IT", "GO!"];

/**
 * Only obey commands that start with exactly "Simon says".
 * Ladder: simple tap → tap N times → trick look-alike leads → more tricks.
 */
export const simon: Generator = ({ rng, d, level }) => {
  const isSimon = rng.chance(0.55);
  const lead = isSimon ? SIMON : rng.chance(ladder(level, [0, 0, 0.35, 0.45, 0.55])) ? rng.pick(TRICK_LEADS) : null;
  const counted = rng.chance(ladder(level, [0, 0.4, 0.5, 0.5, 0.55]));
  if (!counted) {
    const verb = rng.pick(VERBS);
    const command = lead ? verb : `${verb.replace(/!$/, "")}!`;
    return {
      title: "SIMON SAYS",
      prompt: "Only obey Simon",
      view: { type: "simon", simon: isSimon, taps: 1, lead, command },
      expected: gate(isSimon),
      answerKind: "gate",
      durationMs: readMs(`${lead ?? ""} ${command}`) + decide(d, 2200, 900),
    };
  }
  const maxTaps = ladder(level, [3, 3, 4, 5, 5]);
  const taps = rng.int(2, maxTaps);
  const command = `Tap ${taps} times`;
  return {
    title: "SIMON SAYS",
    prompt: "Only obey Simon",
    view: { type: "simon", simon: isSimon, taps, lead, command },
    expected: tap(isSimon ? taps : 0),
    answerKind: "fixed",
    durationMs: readMs(`${lead ?? ""} ${command}`) + decide(d, 2600, 1100) + maxTaps * msPerTap(d),
    allowDone: true,
  };
};

/**
 * The word and its ink color disagree; the rule says which one to read.
 * Ladder: always read the ink → sometimes read the word instead → half and half.
 */
export const stroop: Generator = ({ rng, d, level }) => {
  const askInk = !rng.chance(ladder(level, [0, 0.35, 0.5]));
  const target = rng.pick(COLORS);
  const go = rng.chance(0.5);
  const others = COLORS.filter((c) => c !== target);
  let word: ColorName;
  let ink: ColorName;
  if (askInk) {
    ink = go ? target : rng.pick(others);
    word = go ? rng.pick(others) : rng.chance(0.6) ? target : rng.pick(COLORS.filter((c) => c !== ink));
  } else {
    word = go ? target : rng.pick(others);
    ink = go ? rng.pick(others) : rng.chance(0.6) ? target : rng.pick(COLORS.filter((c) => c !== word));
  }
  return {
    title: askInk ? "READ THE INK" : "READ THE WORD",
    prompt: askInk ? `Tap if the INK is ${COLOR_LABEL[target]}` : `Tap if the WORD says ${COLOR_LABEL[target]}`,
    view: { type: "stroop", word, ink, askInk, target },
    expected: gate(go),
    answerKind: "gate",
    durationMs: decide(d, GATE_MS + 500, GATE_FLOOR_MS + 200),
  };
};
