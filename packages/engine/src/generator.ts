import { TIMING, decide, difficulty, introMs, maxCountAt, msPerTap, typeLevel, unlockPlan } from "./difficulty";
import { mulberry32, roundSeed, type Rng } from "./rng";
import { GENERATORS, SYMBOLS, WEIGHTS, gate } from "./rounds";
import {
  INFO_TYPES,
  type CurseId,
  type Difficulty,
  type Expected,
  type MemoryState,
  type RoundSpec,
  type RoundTypeId,
  type TriggerOverlay,
} from "./types";

export function initialMemory(): MemoryState {
  return { curses: [], lastCurseAt: -99, recentTypes: [], counts: {} };
}

const MIN_ROUNDS_BETWEEN_CURSES = 6;
const NEW_TYPE_BOOST_ROUNDS = 4;
/** Weight multiplier for a type seen in the last few rounds, so the mix keeps changing. */
const RECENT_PENALTY = 0.35;
/** Thinking time for counting rounds before speed is applied, and its floor. Tapping time is added per answer. */
const COUNT_THINK_MS = 3600;
const COUNT_THINK_FLOOR_MS = 1500;

/**
 * Builds round `index` (1-based) of the run with this seed. Memory only depends on the rounds that came
 * before, never on what the player tapped, so a seed alone fixes the whole run.
 */
export function generateRound(seed: number, index: number, memory: MemoryState): { spec: RoundSpec; memory: MemoryState } {
  const rng = mulberry32(roundSeed(seed, index));
  const d = difficulty(index);

  const active = memory.curses.filter((c) => c.from <= index && index <= c.until);
  const cursed = new Set<CurseId>(active.map((c) => c.id));

  const pendingTrigger = memory.trigger?.at === index ? memory.trigger : undefined;
  const type: RoundTypeId =
    memory.memo && memory.memo.dueAt === index ? "recall" : chooseType(rng, d, memory, Boolean(pendingTrigger), unlockPlan(seed));
  const timesSeen = memory.counts[type] ?? 0;
  const level = typeLevel(d, timesSeen);

  const maxCount = maxCountAt(level);
  let capCount = maxCount;
  if (cursed.has("double")) capCount *= 2;
  if (cursed.has("plus1")) capCount += 1;
  const countMs = decide(d, COUNT_THINK_MS, COUNT_THINK_FLOOR_MS) + capCount * msPerTap(d);

  const gen = GENERATORS[type]({
    rng,
    d,
    index,
    memory,
    level,
    minCount: cursed.has("minus1") ? 1 : 0,
    maxCount,
    countMs,
  });

  let expected: Expected = gen.expected;
  const appliedCurses: CurseId[] = [];
  if (expected.kind === "count" && gen.answerKind === "count") {
    let n = expected.n;
    if (cursed.has("double")) ((n *= 2), appliedCurses.push("double"));
    if (cursed.has("plus1")) ((n += 1), appliedCurses.push("plus1"));
    if (cursed.has("minus1")) ((n -= 1), appliedCurses.push("minus1"));
    expected = { ...expected, n: Math.max(0, n) };
  }
  if (expected.kind === "count" && gen.answerKind === "gate" && cursed.has("flip")) {
    expected = { ...expected, n: 1 - expected.n };
    appliedCurses.push("flip");
  }

  let allowDone = gen.allowDone ?? false;
  let trigger: TriggerOverlay | undefined;
  if (pendingTrigger) {
    const roll = rng.next();
    // Decoys (a different symbol) start at stage 3 and get more common later.
    const decoyUntil = d.stage < 2 ? 0 : d.stage < 4 ? 0.8 : 0.88;
    if (roll < 0.55) {
      trigger = { symbol: pendingTrigger.symbol, matches: true, action: pendingTrigger.action };
      // A matching trigger overrides everything else about the round, curses included.
      expected = pendingTrigger.action === "freeze" ? gate(false) : { kind: "pick", id: "trigger" };
      allowDone = false;
    } else if (roll < decoyUntil) {
      const decoy = rng.pick(SYMBOLS.filter((s) => s !== pendingTrigger.symbol));
      trigger = { symbol: decoy, matches: false, action: pendingTrigger.action };
    }
  }

  const next: MemoryState = {
    memo: type === "recall" ? undefined : memory.memo,
    trigger: pendingTrigger ? undefined : memory.trigger,
    curses: memory.curses.filter((c) => c.until > index),
    lastCurseAt: memory.lastCurseAt,
    recentTypes: [...memory.recentTypes.slice(-4), type],
    counts: { ...memory.counts, [type]: timesSeen + 1 },
  };
  if (gen.remember?.memo) next.memo = gen.remember.memo;
  if (gen.remember?.trigger) next.trigger = gen.remember.trigger;
  if (gen.remember?.curse) {
    const { id, rounds } = gen.remember.curse;
    next.curses = [...next.curses, { id, from: index + 1, until: index + rounds }];
    next.lastCurseAt = index;
  }

  const debut = timesSeen === 0;
  // Every task ignores taps for its first moments (see TIMING.minInputMs); the budget is extended to match.
  const inputFromMs = Math.max(TIMING.minInputMs, gen.inputFromMs ?? 0);
  const spec: RoundSpec = {
    index,
    type,
    title: gen.title,
    prompt: gen.prompt,
    introMs: introMs(`${gen.title} ${gen.prompt}`, { debut, boss: d.boss, extraMs: gen.introExtraMs }),
    durationMs: gen.durationMs + (gen.inputFromMs ? 0 : TIMING.minInputMs),
    inputFromMs,
    allowDone,
    baseExpected: gen.expected,
    expected,
    view: gen.view,
    trigger,
    appliedCurses,
    activeCurseCount: active.length,
    debut,
    boss: d.boss,
    speedUp: d.speedUp,
    speed: d.speed,
    level: d.stage + 1,
    typeLevel: level,
  };
  return { spec, memory: next };
}

function chooseType(
  rng: Rng,
  d: Difficulty,
  memory: MemoryState,
  hostingTrigger: boolean,
  unlocks: Record<RoundTypeId, number>,
): RoundTypeId {
  const { index } = d;
  const last = memory.recentTypes[memory.recentTypes.length - 1];
  const lastTwo = memory.recentTypes.slice(-2);
  // Info rounds need breathing room so the game doesn't turn into a wall of rules.
  const recentInfo = lastTwo.some((t) => INFO_TYPES.includes(t));
  const futureCurses = memory.curses.filter((c) => c.until >= index + 1).length;
  const maxCurses = difficulty(index + 1).maxCurses;

  const candidates = (Object.keys(GENERATORS) as RoundTypeId[]).filter((t) => {
    if (unlocks[t] > index || WEIGHTS[t] === 0 || t === last) return false;
    const info = INFO_TYPES.includes(t);
    if (info && (hostingTrigger || recentInfo)) return false;
    if ((t === "memo" || t === "words") && (memory.memo || lastTwo.includes("recall"))) return false;
    if (t === "trigger" && memory.trigger) return false;
    if (t === "curse" && (futureCurses >= maxCurses || index - memory.lastCurseAt < MIN_ROUNDS_BETWEEN_CURSES)) return false;
    // A boss is a familiar task made harder: never a brand new type, and never a rule or memo card.
    if (d.boss && (info || !memory.counts[t])) return false;
    return true;
  });
  if (!candidates.length) return "gonogo";

  // A newly unlocked type debuts as soon as the spacing rules allow; ties are broken at random.
  const unseen = candidates.filter((t) => !memory.counts[t]);
  if (unseen.length) return rng.pick(unseen);

  const recent = memory.recentTypes.slice(-4);

  const weights = candidates.map(
    (t) => WEIGHTS[t] * (index - unlocks[t] < NEW_TYPE_BOOST_ROUNDS ? 2 : 1) * (recent.includes(t) ? RECENT_PENALTY : 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return candidates[i] as RoundTypeId;
  }
  return candidates[candidates.length - 1] ?? "gonogo";
}
