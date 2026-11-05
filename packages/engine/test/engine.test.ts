import { describe, expect, it } from "vitest";
import {
  evaluateRound,
  generateRound,
  initialMemory,
  solveRound,
  verifyRun,
  type MemoryState,
  type RoundLog,
  type RoundSpec,
  type RoundTypeId,
  type TapEvent,
  unlockPlan,
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

const SEEDS = Array.from({ length: 40 }, (_, i) => ((i + 1) * 2654435761) >>> 0);

describe("generation", () => {
  it("is deterministic for a seed", () => {
    expect(playRun(42, 120)).toEqual(playRun(42, 120));
    expect(playRun(42, 40)).not.toEqual(playRun(43, 40));
  });

  it("never repeats a type back to back and spaces out info rounds", () => {
    for (const seed of SEEDS) {
      const specs = playRun(seed, 200);
      for (let i = 1; i < specs.length; i++) {
        expect(specs[i]!.type).not.toBe(specs[i - 1]!.type);
        const info = ["memo", "trigger", "curse"];
        expect(info.includes(specs[i]!.type) && [specs[i - 1], specs[i - 2]].some((p) => p && info.includes(p.type))).toBe(false);
      }
    }
  });

  it("debuts each type within a few rounds of unlocking and never before", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const specs = playRun(seed, 80);
      const unlocks = unlockPlan(seed);
      for (const spec of specs) expect(unlocks[spec.type]).toBeLessThanOrEqual(spec.index);
      for (const spec of specs.filter((s) => s.debut && s.type !== "recall")) {
        expect(spec.index - unlocks[spec.type], `${spec.type} on seed ${seed}`).toBeLessThanOrEqual(4);
      }
      expect(specs.filter((s) => s.debut).length).toBe(new Set(specs.map((s) => s.type)).size);
      const seen = new Set(specs.map((s) => s.type));
      for (const t of Object.keys(unlocks) as RoundTypeId[]) expect(seen.has(t)).toBe(true);
    }
  });

  it("opens each run with a different order of round types", () => {
    const openings = new Set(
      SEEDS.map((seed) =>
        playRun(seed, 10)
          .map((s) => s.type)
          .join(","),
      ),
    );
    expect(openings.size).toBeGreaterThan(SEEDS.length * 0.8);
    // Runs always open gently, but which gentle type comes first varies.
    const firstTypes = new Set(SEEDS.map((seed) => playRun(seed, 1)[0]!.type));
    expect([...firstTypes].every((t) => ["gonogo", "math", "edges", "dots"].includes(t))).toBe(true);
    expect(firstTypes.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps the mix varied: no type takes over a run", () => {
    for (const seed of SEEDS) {
      const specs = playRun(seed, 150).slice(20);
      const counts = new Map<string, number>();
      specs.forEach((s) => counts.set(s.type, (counts.get(s.type) ?? 0) + 1));
      for (const [type, n] of counts) expect(n / specs.length, `${type} on seed ${seed}`).toBeLessThan(0.2);
    }
  });

  it("answers negated tap-or-freeze rules and trick Simon leads correctly", () => {
    let negated = 0;
    let tricks = 0;
    for (const seed of SEEDS) {
      for (const spec of playRun(seed, 120)) {
        if (spec.trigger?.matches || spec.appliedCurses.includes("flip") || spec.expected.kind !== "count") continue;
        if (spec.view.type === "gonogo") {
          const { rule, stimulus } = spec.view;
          const matches = stimulus.color === rule.color && (!rule.shape || stimulus.shape === rule.shape);
          expect(spec.expected.n).toBe(matches !== rule.negated ? 1 : 0);
          if (rule.negated) negated++;
        }
        if (spec.view.type === "simon") {
          expect(spec.expected.n > 0).toBe(spec.view.lead === "Simon says:");
          if (spec.view.lead && spec.view.lead !== "Simon says:") tricks++;
        }
      }
    }
    expect(negated).toBeGreaterThan(20);
    expect(tricks).toBeGreaterThan(10);
  });

  it("schedules a recall exactly when a memo is due", () => {
    for (const seed of SEEDS) {
      const specs = playRun(seed, 150);
      specs.forEach((spec, i) => {
        if (spec.type !== "memo" && spec.type !== "words") return;
        const gap = spec.prompt.includes("in 2 rounds") ? 2 : Number(spec.prompt.match(/in (\d) rounds/)![1]);
        const recall = specs[i + gap];
        if (recall) expect(recall.type).toBe("recall");
      });
    }
  });

  it("applies curses to count answers and flips gate answers", () => {
    let cursedCount = 0;
    let flipped = 0;
    for (const seed of SEEDS) {
      for (const spec of playRun(seed, 150)) {
        if (spec.trigger?.matches) continue;
        if (spec.expected.kind !== "count" || spec.baseExpected.kind !== "count") continue;
        let n = spec.baseExpected.n;
        if (spec.appliedCurses.includes("flip")) {
          expect(spec.expected.n).toBe(1 - n);
          flipped++;
          continue;
        }
        if (spec.appliedCurses.includes("double")) n *= 2;
        if (spec.appliedCurses.includes("plus1")) n += 1;
        if (spec.appliedCurses.includes("minus1")) n -= 1;
        if (spec.appliedCurses.length) cursedCount++;
        expect(spec.expected.n).toBe(n);
        expect(spec.expected.n).toBeGreaterThanOrEqual(0);
      }
    }
    expect(cursedCount).toBeGreaterThan(20);
    expect(flipped).toBeGreaterThan(5);
  });

  it("follows a trigger rule on the very next round", () => {
    let matched = 0;
    for (const seed of SEEDS) {
      const specs = playRun(seed, 150);
      specs.forEach((spec, i) => {
        if (spec.view.type !== "trigger") return;
        const next = specs[i + 1];
        if (!next) return;
        if (next.trigger?.matches) {
          matched++;
          expect(next.trigger.symbol).toBe(spec.view.symbol);
          expect(next.expected).toEqual(
            spec.view.action === "freeze" ? { kind: "count", n: 0, gate: true } : { kind: "pick", id: "trigger" },
          );
        }
        if (next.trigger && !next.trigger.matches) expect(next.trigger.symbol).not.toBe(spec.view.symbol);
      });
    }
    expect(matched).toBeGreaterThan(20);
  });
});

describe("solvability", () => {
  it("a perfect human-speed player can clear 300 rounds on every seed", () => {
    for (const seed of SEEDS) {
      let memory = initialMemory();
      for (let i = 1; i <= 300; i++) {
        const { spec, memory: next } = generateRound(seed, i, memory);
        memory = next;
        const taps = solveRound(spec);
        const last = taps[taps.length - 1];
        // Leave at least 250ms of slack before the timer runs out.
        if (last) expect(last.t, `seed ${seed} round ${i} ${spec.type}`).toBeLessThanOrEqual(spec.durationMs - 250);
        const status = evaluateRound(spec, taps, Infinity);
        expect(status.state, `seed ${seed} round ${i} ${spec.type}`).toBe("pass");
      }
    }
  });
});

describe("evaluation", () => {
  const base = playRun(7, 40);
  const countRound = base.find((s) => s.expected.kind === "count" && !s.expected.gate && s.expected.n >= 2)!;
  const n = countRound.expected.kind === "count" ? countRound.expected.n : 0;
  const zone = (k: number, from = 400): TapEvent[] => Array.from({ length: k }, (_, i) => ({ t: from + i * 200, target: "zone" }));

  it("fails the instant a count round gets one tap too many", () => {
    const status = evaluateRound(countRound, zone(n + 1), 100);
    expect(status).toMatchObject({ state: "fail", reason: "too-many" });
  });

  it("stays pending until the timer, then passes on the exact count", () => {
    expect(evaluateRound(countRound, zone(n), countRound.durationMs - 1).state).toBe("pending");
    expect(evaluateRound(countRound, zone(n), Infinity)).toMatchObject({ state: "pass", atMs: countRound.durationMs });
    expect(evaluateRound(countRound, zone(n - 1), Infinity)).toMatchObject({ state: "fail", reason: "too-few" });
  });

  it("Done ends a count round early", () => {
    const taps = [...zone(n), { t: 400 + n * 200, target: "done" }];
    expect(evaluateRound(countRound, taps, 0)).toMatchObject({ state: "pass", atMs: 400 + n * 200 });
    const short = [...zone(n - 1), { t: 2000, target: "done" }];
    expect(evaluateRound(countRound, short, 0)).toMatchObject({ state: "fail", reason: "too-few" });
  });

  it("gate rounds pass on the first tap or on a held freeze", () => {
    const go = base.find((s) => s.expected.kind === "count" && s.expected.gate && s.expected.n === 1)!;
    const no = base.find((s) => s.expected.kind === "count" && s.expected.gate && s.expected.n === 0)!;
    expect(evaluateRound(go, zone(1), 500).state).toBe("pass");
    expect(evaluateRound(go, [], Infinity)).toMatchObject({ state: "fail", reason: "timeout" });
    expect(evaluateRound(no, zone(1), 500)).toMatchObject({ state: "fail", reason: "tapped-on-no" });
    expect(evaluateRound(no, [], Infinity).state).toBe("pass");
  });

  it("forgives background taps in target rounds but not wrong targets", () => {
    const pick = playRun(11, 60).find((s) => s.expected.kind === "pick" && s.type === "odd")!;
    const id = pick.expected.kind === "pick" ? pick.expected.id : "";
    const wrong = id === "tile-0" ? "tile-1" : "tile-0";
    expect(
      evaluateRound(
        pick,
        [
          { t: 300, target: "zone" },
          { t: 600, target: id },
        ],
        700,
      ).state,
    ).toBe("pass");
    expect(evaluateRound(pick, [{ t: 300, target: wrong }], 400)).toMatchObject({ state: "fail", reason: "wrong-tap" });
  });
});

describe("verification", () => {
  function perfectLog(seed: number, rounds: number): RoundLog[] {
    return playRun(seed, rounds).map((spec) => ({ index: spec.index, taps: solveRound(spec) }));
  }

  it("reproduces a real run's score", () => {
    const log = perfectLog(99, 60);
    // End the run with a wrong answer on round 61.
    const spec61 = playRun(99, 61)[60]!;
    const wrong: TapEvent[] =
      spec61.expected.kind === "count" && spec61.expected.n === 0 ? [{ t: 500, target: "zone" }] : [{ t: 500, target: "nope" }];
    const result = verifyRun(99, [...log, { index: 61, taps: wrong }]);
    expect(result).toMatchObject({ ok: true, rounds: 60, failedAt: 61 });
    expect(result.points).toBeGreaterThan(60 * 100);
  });

  it("rejects a log that keeps going after a failed round", () => {
    const log = perfectLog(5, 10);
    log[3] = { index: 4, taps: [{ t: 100, target: "garbage" }] };
    expect(verifyRun(5, log).ok).toBe(false);
  });

  it("rejects taps faster than a human can make", () => {
    const log = perfectLog(5, 5);
    log[1] = {
      index: 2,
      taps: [
        { t: 300, target: "zone" },
        { t: 310, target: "zone" },
      ],
    };
    expect(verifyRun(5, log)).toMatchObject({ ok: false });
  });

  it("rejects a log replayed against a different seed", () => {
    const result = verifyRun(1234, perfectLog(4321, 40));
    expect(result.ok && result.rounds === 40).toBe(false);
  });

  it("flags runs with repeated superhuman reactions", () => {
    const specs = playRun(8, 80);
    const log = specs.map((spec) => ({ index: spec.index, taps: solveRound(spec, 40) }));
    expect(verifyRun(8, log)).toMatchObject({ ok: false, reason: "reaction times look automated" });
  });
});
