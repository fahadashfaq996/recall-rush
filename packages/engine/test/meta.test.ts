import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  FEVER_COMBO,
  applyRunToStats,
  comboMultiplier,
  dailyMissions,
  emptyStats,
  generateRound,
  initialMemory,
  levelFromXp,
  missionProgress,
  newAchievements,
  rateRound,
  scoreRound,
  skillProfile,
  solveRound,
  verifyRun,
  xpForRun,
  xpToNext,
  type MemoryState,
  type RoundSpec,
  type RunSummary,
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

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: "endless",
  date: "2026-10-23",
  rounds: 12,
  points: 3000,
  bestCombo: 4,
  results: [
    { type: "math", rating: "perfect", boss: false, cursed: false },
    { type: "memo", rating: "info", boss: false, cursed: false },
    { type: "recall", rating: "great", boss: false, cursed: false },
    { type: "trivia", rating: "perfect", boss: true, cursed: false },
  ],
  failedOn: "stroop",
  ...over,
});

describe("ratings and combo", () => {
  const specs = playRun(31, 40);
  const countRound = specs.find((s) => s.expected.kind === "count" && !s.expected.gate && s.expected.n > 0 && s.allowDone)!;
  const window = countRound.durationMs - countRound.inputFromMs;

  it("rates by how much of the answer window was used", () => {
    const at = (share: number) => ({ state: "pass" as const, atMs: countRound.inputFromMs + Math.round(window * share) });
    expect(rateRound(countRound, at(0.2))).toBe("perfect");
    expect(rateRound(countRound, at(0.55))).toBe("great");
    expect(rateRound(countRound, at(0.95))).toBe("good");
    expect(rateRound(countRound, { state: "fail", atMs: 100, reason: "too-many" })).toBeNull();
  });

  it("counts holding still on a don't-tap round as perfect and ignores info rounds", () => {
    const freeze = specs.find((s) => s.expected.kind === "count" && s.expected.gate && s.expected.n === 0)!;
    expect(rateRound(freeze, { state: "pass", atMs: freeze.durationMs })).toBe("perfect");
    const info = specs.find((s) => s.type === "memo" || s.type === "trigger" || s.type === "words")!;
    expect(rateRound(info, { state: "pass", atMs: info.inputFromMs + 10 })).toBe("info");
  });

  it("builds on PERFECT, holds on GREAT, breaks on GOOD, and caps the multiplier at 3×", () => {
    const fast = { state: "pass" as const, atMs: countRound.inputFromMs + 10 };
    const mid = { state: "pass" as const, atMs: countRound.inputFromMs + Math.round(window * 0.6) };
    const slow = { state: "pass" as const, atMs: countRound.durationMs - 1 };
    expect(scoreRound(countRound, fast, 4).combo).toBe(5);
    expect(scoreRound(countRound, mid, 4).combo).toBe(4);
    expect(scoreRound(countRound, slow, 4).combo).toBe(0);
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(100)).toBe(3);
    expect(scoreRound(countRound, fast, FEVER_COMBO).points).toBeGreaterThan(scoreRound(countRound, fast, 0).points);
  });

  it("is replayed exactly by the server: a perfect bot's points include its combo", () => {
    const specs60 = playRun(77, 60);
    const fast = verifyRun(
      77,
      specs60.map((s) => ({ index: s.index, taps: solveRound(s, 150) })),
    );
    const slow = verifyRun(
      77,
      specs60.map((s) => ({ index: s.index, taps: solveRound(s, 900) })),
    );
    expect(fast.ok && slow.ok).toBe(true);
    expect(fast.points).toBeGreaterThan(slow.points);
  });
});

describe("xp and levels", () => {
  it("rewards longer, cleaner runs and never gives less than the floor", () => {
    expect(xpForRun(run({ rounds: 0, points: 0, results: [] }))).toBe(10);
    expect(xpForRun(run({ rounds: 30 }))).toBeGreaterThan(xpForRun(run({ rounds: 10 })));
    expect(xpForRun(run({ mode: "daily" }))).toBe(xpForRun(run()) + 30);
  });

  it("converts total XP into a level with progress towards the next", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, needed: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, needed: xpToNext(2) });
    expect(levelFromXp(100 + 160 + 5)).toEqual({ level: 3, into: 5, needed: xpToNext(3) });
  });
});

describe("daily missions", () => {
  it("gives three different missions, the same all day, scaled by level", () => {
    const a = dailyMissions("2026-10-23", 4);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.kind)).size).toBe(3);
    expect(dailyMissions("2026-10-23", 4)).toEqual(a);
    expect(dailyMissions("2026-10-24", 4)).not.toEqual(a);
    const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const lowReach = days.flatMap((d) => dailyMissions(d, 1)).filter((m) => m.kind === "reach_round");
    const highReach = days.flatMap((d) => dailyMissions(d, 20)).filter((m) => m.kind === "reach_round");
    expect(Math.max(...lowReach.map((m) => m.target))).toBeLessThan(Math.min(...highReach.map((m) => m.target)));
  });

  it("tracks best-of and running-total missions correctly", () => {
    const reach = { id: "x", kind: "reach_round" as const, target: 20, title: "", xp: 50 };
    expect(missionProgress(reach, 15, run({ rounds: 12 }))).toBe(15);
    expect(missionProgress(reach, 15, run({ rounds: 30 }))).toBe(20);
    const bosses = { id: "y", kind: "bosses" as const, target: 3, title: "", xp: 50 };
    expect(missionProgress(bosses, 1, run())).toBe(2);
    const memory = { id: "z", kind: "memory_clears" as const, target: 5, title: "", xp: 50 };
    expect(missionProgress(memory, 0, run())).toBe(1);
  });
});

describe("stats and achievements", () => {
  it("accumulates lifetime stats and builds a 0-100 skill profile", () => {
    const stats = applyRunToStats(applyRunToStats(emptyStats(), run()), run({ rounds: 30, bestCombo: 9 }));
    expect(stats).toMatchObject({ runs: 2, totalRounds: 42, bestRound: 30, bestCombo: 9, bosses: 2, perfects: 4 });
    expect(stats.failed.stroop).toBe(2);
    const profile = skillProfile(stats);
    for (const v of Object.values(profile)) expect(v).toBeGreaterThanOrEqual(0);
    expect(profile.knowledge).toBeGreaterThan(0);
    expect(profile.focus).toBe(0);
  });

  it("awards each achievement once, when earned", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const stats = applyRunToStats(emptyStats(), run({ rounds: 26, bestCombo: 8 }));
    const first = newAchievements([], stats, { dailyStreak: 0 }).map((a) => a.id);
    expect(first).toEqual(expect.arrayContaining(["first_run", "round_10", "round_25", "boss_1", "combo_5", "combo_8"]));
    expect(first).not.toContain("round_50");
    expect(newAchievements(first, stats, { dailyStreak: 0 })).toEqual([]);
    expect(newAchievements(first, stats, { dailyStreak: 7 }).map((a) => a.id)).toEqual(["streak_3", "streak_7"]);
  });
});
