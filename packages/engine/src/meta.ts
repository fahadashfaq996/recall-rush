import type { Rating } from "./evaluate";
import { hashString, mulberry32 } from "./rng";
import type { RoundTypeId } from "./types";

/**
 * Meta progression: XP and player levels, daily missions, achievements and lifetime stats. All pure functions
 * over plain data, so the web app (and later the mobile app) can keep the state wherever it likes.
 */

export type RunMode = "endless" | "daily" | "challenge";

/** One cleared round, as recorded at the end of a run. */
export interface RoundResult {
  type: RoundTypeId;
  rating: Rating;
  boss: boolean;
  cursed: boolean;
}

export interface RunSummary {
  mode: RunMode;
  /** UTC date the run was played (YYYY-MM-DD). */
  date: string;
  rounds: number;
  points: number;
  bestCombo: number;
  /** Cleared rounds in order. */
  results: RoundResult[];
  /** Round type that ended the run, if it ended in a fail. */
  failedOn?: RoundTypeId;
}

// ---------------------------------------------------------------------------
// Skill categories (brain profile)
// ---------------------------------------------------------------------------

export type Skill = "reflex" | "counting" | "memory" | "knowledge" | "focus";

export const SKILL_OF: Record<RoundTypeId, Skill> = {
  gonogo: "reflex",
  simon: "reflex",
  stroop: "focus",
  odd: "focus",
  curse: "focus",
  math: "counting",
  edges: "counting",
  dots: "counting",
  memo: "memory",
  recall: "memory",
  words: "memory",
  sequence: "memory",
  trigger: "memory",
  trivia: "knowledge",
  truth: "knowledge",
  oddword: "knowledge",
};

export const SKILL_LABEL: Record<Skill, string> = {
  reflex: "Reflex",
  counting: "Counting",
  memory: "Memory",
  knowledge: "Knowledge",
  focus: "Focus",
};

// ---------------------------------------------------------------------------
// Lifetime stats
// ---------------------------------------------------------------------------

export interface LifetimeStats {
  runs: number;
  totalRounds: number;
  bestRound: number;
  bestPoints: number;
  bestCombo: number;
  bosses: number;
  perfects: number;
  cursedClears: number;
  dailies: number;
  /** Clears and fails per round type, for the brain profile and "clear every type" achievements. */
  cleared: Partial<Record<RoundTypeId, number>>;
  failed: Partial<Record<RoundTypeId, number>>;
}

export function emptyStats(): LifetimeStats {
  return {
    runs: 0,
    totalRounds: 0,
    bestRound: 0,
    bestPoints: 0,
    bestCombo: 0,
    bosses: 0,
    perfects: 0,
    cursedClears: 0,
    dailies: 0,
    cleared: {},
    failed: {},
  };
}

export function applyRunToStats(stats: LifetimeStats, run: RunSummary): LifetimeStats {
  const cleared = { ...stats.cleared };
  for (const r of run.results) cleared[r.type] = (cleared[r.type] ?? 0) + 1;
  const failed = { ...stats.failed };
  if (run.failedOn) failed[run.failedOn] = (failed[run.failedOn] ?? 0) + 1;
  return {
    runs: stats.runs + 1,
    totalRounds: stats.totalRounds + run.rounds,
    bestRound: Math.max(stats.bestRound, run.mode === "challenge" ? 0 : run.rounds),
    bestPoints: Math.max(stats.bestPoints, run.points),
    bestCombo: Math.max(stats.bestCombo, run.bestCombo),
    bosses: stats.bosses + run.results.filter((r) => r.boss).length,
    perfects: stats.perfects + run.results.filter((r) => r.rating === "perfect").length,
    cursedClears: stats.cursedClears + run.results.filter((r) => r.cursed).length,
    dailies: stats.dailies + (run.mode === "daily" ? 1 : 0),
    cleared,
    failed,
  };
}

/** 0-100 score per skill: accuracy weighted by experience, so a few lucky clears don't max it out. */
export function skillProfile(stats: LifetimeStats): Record<Skill, number> {
  const totals = { reflex: [0, 0], counting: [0, 0], memory: [0, 0], knowledge: [0, 0], focus: [0, 0] } as Record<Skill, [number, number]>;
  for (const [type, skill] of Object.entries(SKILL_OF) as [RoundTypeId, Skill][]) {
    totals[skill][0] += stats.cleared[type] ?? 0;
    totals[skill][1] += stats.failed[type] ?? 0;
  }
  const out = {} as Record<Skill, number>;
  for (const [skill, [ok, bad]] of Object.entries(totals) as [Skill, [number, number]][]) {
    const attempts = ok + bad;
    const accuracy = attempts ? ok / attempts : 0;
    const experience = 1 - Math.exp(-attempts / 25);
    out[skill] = Math.round(100 * accuracy * (0.35 + 0.65 * experience));
  }
  return out;
}

// ---------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------

/** XP for a run: rewards surviving, bosses and clean play, with a floor so every run feels worth it. */
export function xpForRun(run: RunSummary): number {
  const bosses = run.results.filter((r) => r.boss).length;
  const perfects = run.results.filter((r) => r.rating === "perfect").length;
  return 10 + run.rounds * 5 + bosses * 25 + perfects * 2 + Math.floor(run.points / 250) + (run.mode === "daily" ? 30 : 0);
}

/** XP needed to go from `level` to `level + 1`. Early levels come fast; later ones take a few good runs. */
export const xpToNext = (level: number) => 100 + (level - 1) * 60;

export function levelFromXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(totalXp));
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level++;
  }
  return { level, into: left, needed: xpToNext(level) };
}

// ---------------------------------------------------------------------------
// Daily missions
// ---------------------------------------------------------------------------

export type MissionKind =
  "reach_round" | "bosses" | "combo" | "perfects" | "runs" | "points_run" | "daily" | "memory_clears" | "knowledge_clears";

export interface Mission {
  id: string;
  kind: MissionKind;
  target: number;
  title: string;
  xp: number;
}

/** "best" missions take the best single run; "sum" missions add up across the day's runs. */
const MISSION_AGGREGATE: Record<MissionKind, "best" | "sum"> = {
  reach_round: "best",
  combo: "best",
  points_run: "best",
  bosses: "sum",
  perfects: "sum",
  runs: "sum",
  daily: "sum",
  memory_clears: "sum",
  knowledge_clears: "sum",
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function missionFor(kind: MissionKind, level: number): Omit<Mission, "id"> {
  const l = Math.min(level, 30);
  switch (kind) {
    case "reach_round": {
      const target = round5(8 + l * 1.4);
      return { kind, target, title: `Reach round ${target}`, xp: 60 + target * 2 };
    }
    case "bosses": {
      const target = Math.min(5, 1 + Math.floor(l / 6));
      return { kind, target, title: `Beat ${target} boss${target > 1 ? "es" : ""}`, xp: 50 + target * 25 };
    }
    case "combo": {
      const target = Math.min(15, 4 + Math.floor(l / 3));
      return { kind, target, title: `Hit a ${target}× PERFECT combo`, xp: 50 + target * 6 };
    }
    case "perfects": {
      const target = round5(10 + l * 2);
      return { kind, target, title: `Score ${target} PERFECTs`, xp: 40 + target * 2 };
    }
    case "runs":
      return { kind, target: 3, title: "Play 3 runs", xp: 50 };
    case "points_run": {
      const target = Math.round((2000 + l * 600) / 500) * 500;
      return { kind, target, title: `Score ${target.toLocaleString("en-US")} points in one run`, xp: 70 + Math.floor(target / 200) };
    }
    case "daily":
      return { kind, target: 1, title: "Play today's Daily Challenge", xp: 60 };
    case "memory_clears": {
      const target = 3 + Math.floor(l / 5);
      return { kind, target, title: `Clear ${target} memory rounds`, xp: 50 + target * 8 };
    }
    case "knowledge_clears": {
      const target = 4 + Math.floor(l / 4);
      return { kind, target, title: `Clear ${target} trivia, true/false or word rounds`, xp: 50 + target * 6 };
    }
  }
}

/** Three missions for the day, the same all day, scaled to the player's level. */
export function dailyMissions(date: string, level: number): Mission[] {
  const rng = mulberry32(hashString(`missions:${date}`));
  const pool: MissionKind[] = [
    "reach_round",
    "bosses",
    "combo",
    "perfects",
    "runs",
    "points_run",
    "daily",
    "memory_clears",
    "knowledge_clears",
  ];
  // Early players get achievable missions first.
  const eligible = level < 3 ? pool.filter((k) => k !== "points_run" && k !== "memory_clears") : pool;
  return rng.sample(eligible, 3).map((kind) => ({ id: `${date}:${kind}`, ...missionFor(kind, level) }));
}

/** How far a run pushes a mission, given its progress so far today. */
export function missionProgress(mission: Mission, before: number, run: RunSummary): number {
  const value = (() => {
    switch (mission.kind) {
      case "reach_round":
        return run.rounds;
      case "combo":
        return run.bestCombo;
      case "points_run":
        return run.points;
      case "bosses":
        return run.results.filter((r) => r.boss).length;
      case "perfects":
        return run.results.filter((r) => r.rating === "perfect").length;
      case "runs":
        return 1;
      case "daily":
        return run.mode === "daily" ? 1 : 0;
      case "memory_clears":
        return run.results.filter((r) => SKILL_OF[r.type] === "memory" && r.rating !== "info").length;
      case "knowledge_clears":
        return run.results.filter((r) => SKILL_OF[r.type] === "knowledge").length;
    }
  })();
  const next = MISSION_AGGREGATE[mission.kind] === "best" ? Math.max(before, value) : before + value;
  return Math.min(mission.target, next);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** bronze < silver < gold, for the badge color. */
  tier: "bronze" | "silver" | "gold";
  earned(stats: LifetimeStats, ctx: { dailyStreak: number; run?: RunSummary }): boolean;
}

const ALL_TYPES = Object.keys(SKILL_OF) as RoundTypeId[];
const clearedOf = (stats: LifetimeStats, skill: Skill) =>
  ALL_TYPES.filter((t) => SKILL_OF[t] === skill).reduce((n, t) => n + (stats.cleared[t] ?? 0), 0);

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first_run", title: "First Steps", description: "Finish your first run", icon: "👣", tier: "bronze", earned: (s) => s.runs >= 1 },
  { id: "round_10", title: "Warmed Up", description: "Reach round 10", icon: "🔥", tier: "bronze", earned: (s) => s.bestRound >= 10 },
  { id: "round_25", title: "Sharp Mind", description: "Reach round 25", icon: "🧠", tier: "silver", earned: (s) => s.bestRound >= 25 },
  { id: "round_50", title: "Unshakeable", description: "Reach round 50", icon: "💎", tier: "gold", earned: (s) => s.bestRound >= 50 },
  { id: "round_75", title: "Mind Palace", description: "Reach round 75", icon: "🏛️", tier: "gold", earned: (s) => s.bestRound >= 75 },
  { id: "round_100", title: "Legend", description: "Reach round 100", icon: "👑", tier: "gold", earned: (s) => s.bestRound >= 100 },
  { id: "boss_1", title: "Boss Slayer", description: "Beat your first boss", icon: "⚔️", tier: "bronze", earned: (s) => s.bosses >= 1 },
  { id: "boss_10", title: "Boss Hunter", description: "Beat 10 bosses", icon: "🗡️", tier: "silver", earned: (s) => s.bosses >= 10 },
  { id: "boss_50", title: "Boss Nemesis", description: "Beat 50 bosses", icon: "🐉", tier: "gold", earned: (s) => s.bosses >= 50 },
  {
    id: "combo_5",
    title: "In the Zone",
    description: "Hit a 5× PERFECT combo",
    icon: "✨",
    tier: "bronze",
    earned: (s) => s.bestCombo >= 5,
  },
  {
    id: "combo_8",
    title: "On Fire",
    description: "Reach fever with an 8× combo",
    icon: "☄️",
    tier: "silver",
    earned: (s) => s.bestCombo >= 8,
  },
  {
    id: "combo_15",
    title: "Untouchable",
    description: "Hit a 15× PERFECT combo",
    icon: "⚡",
    tier: "gold",
    earned: (s) => s.bestCombo >= 15,
  },
  {
    id: "perfect_100",
    title: "Precision",
    description: "Score 100 PERFECTs",
    icon: "🎯",
    tier: "silver",
    earned: (s) => s.perfects >= 100,
  },
  {
    id: "perfect_1000",
    title: "Surgeon",
    description: "Score 1,000 PERFECTs",
    icon: "🔬",
    tier: "gold",
    earned: (s) => s.perfects >= 1000,
  },
  {
    id: "daily_1",
    title: "Daily Player",
    description: "Play a Daily Challenge",
    icon: "📅",
    tier: "bronze",
    earned: (s) => s.dailies >= 1,
  },
  {
    id: "streak_3",
    title: "Habit Forming",
    description: "Play the Daily 3 days in a row",
    icon: "🔁",
    tier: "bronze",
    earned: (_s, c) => c.dailyStreak >= 3,
  },
  {
    id: "streak_7",
    title: "Week Warrior",
    description: "Play the Daily 7 days in a row",
    icon: "🗓️",
    tier: "silver",
    earned: (_s, c) => c.dailyStreak >= 7,
  },
  {
    id: "streak_30",
    title: "Unbreakable",
    description: "Play the Daily 30 days in a row",
    icon: "🏆",
    tier: "gold",
    earned: (_s, c) => c.dailyStreak >= 30,
  },
  {
    id: "curse_3",
    title: "Hexproof",
    description: "Clear 3 cursed rounds in one run",
    icon: "💀",
    tier: "silver",
    earned: (_s, c) => (c.run?.results.filter((r) => r.cursed).length ?? 0) >= 3,
  },
  {
    id: "memory_25",
    title: "Elephant Memory",
    description: "Clear 25 memory rounds",
    icon: "🐘",
    tier: "silver",
    earned: (s) => clearedOf(s, "memory") >= 25,
  },
  {
    id: "knowledge_25",
    title: "Know-It-All",
    description: "Clear 25 knowledge rounds",
    icon: "📚",
    tier: "silver",
    earned: (s) => clearedOf(s, "knowledge") >= 25,
  },
  {
    id: "all_types",
    title: "Renaissance Mind",
    description: "Clear every round type",
    icon: "🌈",
    tier: "gold",
    earned: (s) => ALL_TYPES.every((t) => (s.cleared[t] ?? 0) > 0),
  },
  { id: "runs_50", title: "Dedicated", description: "Play 50 runs", icon: "🎮", tier: "silver", earned: (s) => s.runs >= 50 },
  {
    id: "points_10k",
    title: "Five Figures",
    description: "Score 10,000 points in a run",
    icon: "💰",
    tier: "silver",
    earned: (s) => s.bestPoints >= 10_000,
  },
  {
    id: "points_50k",
    title: "High Roller",
    description: "Score 50,000 points in a run",
    icon: "🚀",
    tier: "gold",
    earned: (s) => s.bestPoints >= 50_000,
  },
];

/** Achievements newly earned after a run. */
export function newAchievements(
  earnedIds: readonly string[],
  stats: LifetimeStats,
  ctx: { dailyStreak: number; run?: RunSummary },
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !earnedIds.includes(a.id) && a.earned(stats, ctx));
}
