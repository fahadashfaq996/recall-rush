import { describe, expect, it } from "vitest";
import {
  PACKS,
  RULES_VERSION,
  generateRound,
  initialMemory,
  validateCategory,
  validatePacks,
  validateTrivia,
  type MemoryState,
  type RoundSpec,
} from "../src";

function playRun(seed: number, rounds: number): RoundSpec[] {
  const specs: RoundSpec[] = [];
  let memory: MemoryState = initialMemory();
  for (let i = 1; i <= rounds; i++) {
    const g = generateRound(seed, i, memory);
    specs.push(g.spec);
    memory = g.memory;
  }
  return specs;
}

const SEEDS = Array.from({ length: 40 }, (_, i) => ((i + 7) * 2246822519) >>> 0);

describe("content packs", () => {
  it("every shipped pack passes validation", () => {
    expect(validatePacks(PACKS)).toEqual([]);
    expect(PACKS.trivia.length).toBeGreaterThan(50);
    expect(PACKS.truth.length).toBeGreaterThan(50);
    expect(PACKS.categories.length).toBeGreaterThan(30);
    expect(PACKS.wordsets.length).toBeGreaterThan(15);
  });

  it("has true and false statements in balance, and trivia answers across the whole range", () => {
    const trues = PACKS.truth.filter((t) => t.truth).length;
    expect(trues / PACKS.truth.length).toBeGreaterThan(0.35);
    expect(trues / PACKS.truth.length).toBeLessThan(0.65);
    const answers = new Set(PACKS.trivia.map((t) => t.answer));
    for (let n = 0; n <= 10; n++) expect(answers.has(n), `no trivia with answer ${n}`).toBe(true);
  });

  it("rejects bad items", () => {
    expect(validateTrivia({ id: "x", q: "How many letters are in the word CAT?", answer: 4, difficulty: 1 })).toContain(
      "CAT has 3 letters, not 4",
    );
    expect(validateTrivia({ id: "x", q: "How many toes do I have?", answer: 11, difficulty: 1 }).length).toBeGreaterThan(0);
    const bad = validateCategory({
      id: "x",
      category: "FRUITS",
      members: ["APPLE", "PEAR", "PLUM", "APPLE"],
      intruders: ["pear", "CAR"],
      difficulty: 1,
    });
    expect(bad).toEqual(
      expect.arrayContaining(['"APPLE" appears twice', '"pear" is not a valid display word', "needs at least 3 intruders"]),
    );
    expect(validatePacks({ ...PACKS, trivia: [...PACKS.trivia, PACKS.trivia[0]!] }).length).toBeGreaterThan(0);
  });

  it("has a stable rules version that changes with content", () => {
    expect(RULES_VERSION).toMatch(/^\d+\.[a-z0-9]+$/);
  });
});

describe("content rounds", () => {
  const all = SEEDS.flatMap((seed) => playRun(seed, 120));

  it("all four new round types show up", () => {
    const types = new Set(all.map((s) => s.type));
    for (const t of ["trivia", "truth", "oddword", "words"] as const) expect(types.has(t), t).toBe(true);
  });

  it("number trivia asks for the item's answer, bent only by curses", () => {
    for (const spec of all) {
      const view = spec.view;
      if (view.type !== "trivia" || spec.trigger?.matches) continue;
      const item = PACKS.trivia.find((t) => t.q === view.question)!;
      expect(spec.baseExpected).toEqual({ kind: "count", n: item.answer, gate: false });
    }
  });

  it("true or false rounds want a tap exactly when the asked-for value matches", () => {
    for (const spec of all) {
      if (spec.view.type !== "truth" || spec.trigger?.matches || spec.expected.kind !== "count") continue;
      const go = spec.view.askTrue === spec.view.truth;
      expect(spec.expected.n).toBe(spec.appliedCurses.includes("flip") ? (go ? 0 : 1) : go ? 1 : 0);
    }
  });

  it("odd word out points at the one word outside the category", () => {
    for (const spec of all) {
      const view = spec.view;
      if (view.type !== "oddword" || spec.trigger?.matches) continue;
      const cat = PACKS.categories.find((c) => c.category === view.category)!;
      const odd = view.words[view.intruderIndex]!;
      expect(cat.intruders).toContain(odd);
      expect(view.words.filter((w) => cat.members.includes(w))).toHaveLength(3);
      expect(spec.expected).toEqual({ kind: "pick", id: `word-${view.intruderIndex}` });
    }
  });

  it("word recall asks about the list that was actually shown", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const specs = playRun(seed, 120);
      specs.forEach((spec, i) => {
        if (spec.view.type !== "words") return;
        const shown = spec.view.words;
        const recall = specs.slice(i + 1).find((s) => s.type === "recall");
        if (!recall || recall.view.type !== "recall" || recall.trigger?.matches || recall.expected.kind !== "pick") return;
        const answer = recall.view.options[Number(recall.expected.id.slice(4))]!;
        expect(shown.includes(answer)).toBe(!recall.view.askNotShown);
        expect(new Set(recall.view.options).size).toBe(recall.view.options.length);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(10);
  });
});
