import { describe, expect, it } from "vitest";
import {
  INFO_TYPES,
  STAGE_LENGTH,
  TIMING,
  difficulty,
  generateRound,
  initialMemory,
  readMs,
  solveRound,
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

const SEEDS = Array.from({ length: 60 }, (_, i) => ((i + 3) * 2654435761) >>> 0);
const RUNS = SEEDS.map((seed) => playRun(seed, 80));
const byStage = (pick: (s: RoundSpec) => number | undefined) =>
  Array.from({ length: 8 }, (_, stage) => {
    const values = RUNS.flatMap((run) => run.slice(stage * 10, stage * 10 + 10).map(pick)).filter((v): v is number => v !== undefined);
    return values.reduce((a, b) => a + b, 0) / values.length;
  });

describe("speed curve", () => {
  const speeds = Array.from({ length: 200 }, (_, i) => difficulty(i + 1).speed);

  it("never slows down inside a stage and steps up at rounds x5 and x8", () => {
    for (let stage = 0; stage < 20; stage++) {
      const s = speeds.slice(stage * STAGE_LENGTH, stage * STAGE_LENGTH + STAGE_LENGTH);
      for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThanOrEqual(s[i - 1]!);
      expect(s[4]!).toBeGreaterThan(s[3]!);
      expect(s[7]!).toBeGreaterThan(s[6]!);
    }
  });

  it("starts every stage faster than the last, but eases off after each boss once the game is underway", () => {
    for (let stage = 1; stage < 10; stage++) expect(speeds[stage * 10]!).toBeGreaterThan(speeds[(stage - 1) * 10]!);
    // Near the ceiling consecutive stages may round to the same speed, but never go down.
    for (let stage = 10; stage < 20; stage++) expect(speeds[stage * 10]!).toBeGreaterThanOrEqual(speeds[(stage - 1) * 10]!);
    // Sawtooth: from stage 3 on, a new stage begins below the previous boss's speed.
    for (let stage = 3; stage < 20; stage++) expect(speeds[stage * 10]!).toBeLessThan(speeds[stage * 10 - 1]!);
  });

  it("approaches a ceiling instead of growing forever", () => {
    expect(Math.max(...speeds)).toBeLessThan(2.4);
    expect(speeds[0]).toBe(1);
  });
});

describe("the game gets harder", () => {
  it("leaves less spare time stage after stage through the first half hour of play", () => {
    const spare = byStage((s) => {
      const taps = solveRound(s, 0);
      return s.durationMs - (taps.length ? taps[taps.length - 1]!.t : s.inputFromMs);
    });
    for (let i = 1; i < 4; i++) expect(spare[i]!, `stage ${i}`).toBeLessThan(spare[i - 1]!);
    expect(spare[4]!).toBeLessThan(spare[0]! * 0.85);
  });

  it("shortens tap-or-freeze rounds by more than a third", () => {
    const gate = byStage((s) => (s.type === "gonogo" ? s.durationMs : undefined));
    for (let i = 1; i < 5; i++) expect(gate[i]!).toBeLessThan(gate[i - 1]!);
    expect(gate[6]!).toBeLessThan(gate[0]! * 0.66);
  });

  it("raises every type's level as stages pass, with longer patterns to remember", () => {
    const level = byStage((s) => s.typeLevel);
    for (let i = 1; i < 6; i++) expect(level[i]!).toBeGreaterThanOrEqual(level[i - 1]!);
    expect(level[5]!).toBeGreaterThan(3.5);
    const seq = byStage((s) => (s.view.type === "sequence" ? s.view.order.length : undefined));
    expect(seq[7]!).toBeGreaterThan(seq[2]! + 2);
  });

  it("eases new types in: a debut is always level 0", () => {
    for (const s of RUNS.flat()) if (s.debut && !s.boss) expect(s.typeLevel).toBe(0);
  });
});

describe("boss rounds", () => {
  it("lands on every 10th round as a familiar, non-info round one level up", () => {
    for (const run of RUNS) {
      for (const s of run) {
        expect(s.boss).toBe(s.index % 10 === 0);
        if (!s.boss) continue;
        expect(INFO_TYPES.includes(s.type)).toBe(false);
        expect(s.type).not.toBe("recall");
        expect(s.debut).toBe(false);
        expect(s.typeLevel).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("never has a memory test scheduled onto it", () => {
    for (const run of RUNS) {
      run.forEach((s) => {
        const due = s.prompt.match(/in (\d+) rounds/);
        if ((s.type === "memo" || s.type === "words") && due) expect((s.index + Number(due[1])) % 10).not.toBe(0);
      });
    }
  });
});

describe("reading time", () => {
  it("budgets text at about 180 words per minute on top of thinking time, at any speed", () => {
    for (const s of RUNS.flat()) {
      const v = s.view;
      const text = v.type === "trivia" ? v.question : v.type === "truth" ? v.statement : v.type === "oddword" ? v.words.join(" ") : null;
      if (!text) continue;
      expect(s.durationMs, `${s.type} round ${s.index}`).toBeGreaterThanOrEqual(readMs(text) + 900);
      expect(readMs(text)).toBeGreaterThanOrEqual(Math.min(TIMING.readMaxMs, text.length * 60));
    }
  });

  it("gives the instruction card enough time to read its own text, plus extra the first time", () => {
    for (const s of RUNS.flat()) {
      const chars = `${s.title} ${s.prompt}`.length;
      const minimum = Math.min(TIMING.introMaxMs, TIMING.introBaseMs + chars * TIMING.introMsPerChar);
      expect(s.introMs).toBeGreaterThanOrEqual(minimum);
      if (s.debut) expect(s.introMs).toBeGreaterThanOrEqual(Math.min(TIMING.introMaxMs, minimum + TIMING.introDebutBonusMs));
    }
  });

  it("ignores taps in the first moments of every task", () => {
    for (const s of RUNS.flat()) expect(s.inputFromMs).toBeGreaterThanOrEqual(TIMING.minInputMs);
  });
});
