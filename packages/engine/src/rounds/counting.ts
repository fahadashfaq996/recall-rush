import { readMs } from "../difficulty";
import type { ColorName, DotShape } from "../types";
import { COLOR_LABEL, ladder, tap, type Generator } from "./kit";

const DOT_SHAPES: readonly DotShape[] = ["circle", "circle", "square", "diamond"];

type MathOp = "plus" | "minus" | "times" | "chain" | "double" | "half" | "missing";

/** Which sum formats each level of Quick Math can use (repeats make a format more likely). */
const MATH_OPS: readonly MathOp[][] = [
  ["plus"],
  ["plus", "plus", "minus"],
  ["plus", "minus", "double", "half", "missing"],
  ["plus", "minus", "double", "half", "missing", "times"],
  ["minus", "missing", "times", "chain", "chain", "double", "half"],
];

/**
 * Solve a small sum and tap the answer.
 * Ladder: a + b → subtraction → double/half and "? + 3 = 8" → multiplication → two-step sums. Answers grow too.
 */
export const math: Generator = ({ rng, level, minCount, maxCount, countMs }) => {
  const min = level >= 1 ? minCount : Math.max(1, minCount);
  const answer = rng.int(min, maxCount);
  let op = rng.pick(ladder(level, MATH_OPS));
  if (op === "double" && (answer % 2 !== 0 || answer === 0)) op = "half";
  if (op === "missing" && answer === 0) op = "minus";

  let expression = "";
  let inline = false;
  if (op === "times") {
    const pairs: [number, number][] = [];
    for (let a = 2; a <= answer / 2; a++) if (answer % a === 0) pairs.push([a, answer / a]);
    if (pairs.length) {
      const [a, b] = rng.pick(pairs);
      expression = `${a} × ${b}`;
    } else op = "minus";
  }
  if (op === "double") expression = `double ${answer / 2}`;
  if (op === "half") expression = `half of ${answer * 2}`;
  if (op === "missing") {
    const b = rng.int(1, 5 + level);
    expression = rng.chance(0.5) ? `? + ${b} = ${answer + b}` : `${answer + b} − ? = ${b}`;
    inline = true;
  }
  if (op === "chain") {
    const c = rng.int(1, 6);
    const a = rng.int(0, answer + c);
    expression = `${a} + ${answer + c - a} − ${c}`;
  }
  if (op === "minus") {
    const b = rng.int(1, 4 + level * 2);
    expression = `${answer + b} − ${b}`;
  }
  if (!expression) {
    const a = answer >= 2 ? rng.int(1, answer - 1) : rng.int(0, answer);
    expression = `${a} + ${answer - a}`;
  }
  return {
    title: inline ? "FIND THE ?" : "QUICK MATH",
    prompt: inline ? "Tap the missing number" : "Tap the answer",
    view: { type: "math", expression, inline },
    expected: tap(answer),
    answerKind: "count",
    durationMs: readMs(expression) + countMs,
    allowDone: true,
  };
};

/**
 * Count a polygon's sides, or a star's points.
 * Ladder: triangles to pentagons → bigger polygons → stars appear → stars more often, up to ten sides.
 */
export const edges: Generator = ({ rng, level, minCount, maxCount, countMs }) => {
  const star = rng.chance(ladder(level, [0, 0, 0.3, 0.45, 0.5]));
  const corners = !star && level >= 1 && rng.chance(0.4);
  const lo = Math.max(star ? 4 : 3, minCount);
  const hi = Math.max(lo, Math.min(star ? 8 : 10, maxCount));
  const sides = rng.int(lo, hi);
  return {
    title: star ? "COUNT THE POINTS" : corners ? "COUNT THE CORNERS" : "COUNT THE EDGES",
    prompt: star ? "Tap once per point" : corners ? "Tap once per corner" : "Tap once per edge",
    view: { type: "edges", sides, star, rotation: rng.int(0, 359) },
    expected: tap(sides),
    answerKind: "count",
    durationMs: countMs + (star ? 500 : 0),
    allowDone: true,
  };
};

/**
 * Dots flash briefly, then vanish.
 * Ladder: few dots, long flash → more dots, shorter flash → count only one color among distractors.
 */
export const dots: Generator = ({ rng, d, level, minCount, maxCount, countMs }) => {
  const count = rng.int(Math.max(1, minCount), Math.min(maxCount, 9));
  const filtered = rng.chance(ladder(level, [0, 0, 0.5, 0.6, 0.7]));
  const only: ColorName | undefined = filtered ? rng.pick(["cyan", "yellow", "purple"] as const) : undefined;
  const distractors = filtered ? rng.int(2, Math.min(6, 2 + level - 1)) : 0;
  const flashMs = Math.max(450, Math.round(ladder(level, [1500, 1350, 1200, 1050, 900, 800]) / Math.sqrt(d.speed)));

  const points: { x: number; y: number; color: ColorName }[] = [];
  const total = count + distractors;
  let guard = 0;
  while (points.length < total && guard++ < 500) {
    const x = 0.12 + rng.next() * 0.76;
    const y = 0.12 + rng.next() * 0.76;
    if (points.every((p) => Math.hypot(p.x - x, p.y - y) > 0.17)) {
      const isTarget = points.length < count;
      const color: ColorName = isTarget ? (only ?? "cyan") : rng.pick((["red", "green", "blue"] as ColorName[]).filter((c) => c !== only));
      points.push({ x, y, color });
    }
  }
  const targets = Math.min(count, points.length);
  return {
    title: "FLASH COUNT",
    prompt: only ? `How many ${COLOR_LABEL[only]} dots?` : "How many dots?",
    view: { type: "dots", dots: rng.shuffle(points), only, flashMs, shape: rng.pick(DOT_SHAPES) },
    expected: tap(targets),
    answerKind: "count",
    durationMs: countMs + flashMs,
    allowDone: true,
  };
};
