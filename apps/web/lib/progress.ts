import {
  applyRunToStats,
  dailyMissions,
  levelFromXp,
  missionProgress,
  newAchievements,
  xpForRun,
  type Achievement,
  type Mission,
  type RunSummary,
} from "@recall/engine";
import { loadPlayer, savePlayer } from "./player";
import { themesUnlockedBetween, type Theme } from "./themes";

export interface MissionStatus {
  mission: Mission;
  before: number;
  after: number;
  completedNow: boolean;
}

export interface RunRewards {
  xpRun: number;
  xpMissions: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  missions: MissionStatus[];
  achievements: Achievement[];
  unlockedThemes: Theme[];
}

/** Today's missions, generated (and frozen) the first time they're needed each day. */
export function todaysMissions(date: string): { date: string; list: Mission[]; progress: Record<string, number> } {
  const p = loadPlayer();
  if (p.missionsDay?.date === date) return p.missionsDay;
  const day = { date, list: dailyMissions(date, levelFromXp(p.xp).level), progress: {} };
  savePlayer({ missionsDay: day });
  return day;
}

/** Applies a finished run to XP, stats, missions and achievements, saves it, and reports what changed. */
export function recordRun(run: RunSummary): RunRewards {
  const day = todaysMissions(run.date);
  const p = loadPlayer();
  const stats = applyRunToStats(p.stats, run);

  const progress = { ...day.progress };
  const missions = day.list.map((mission) => {
    const before = progress[mission.id] ?? 0;
    const after = missionProgress(mission, before, run);
    progress[mission.id] = after;
    return { mission, before, after, completedNow: before < mission.target && after >= mission.target };
  });
  const xpMissions = missions.filter((m) => m.completedNow).reduce((n, m) => n + m.mission.xp, 0);

  const achievements = newAchievements(p.achievements, stats, { dailyStreak: p.dailyStreak.count, run });
  const xpRun = xpForRun(run);
  const xpBefore = p.xp;
  const xpAfter = p.xp + xpRun + xpMissions;
  const levelBefore = levelFromXp(xpBefore).level;
  const levelAfter = levelFromXp(xpAfter).level;

  savePlayer({
    xp: xpAfter,
    stats,
    achievements: [...p.achievements, ...achievements.map((a) => a.id)],
    missionsDay: { ...day, progress },
  });
  return {
    xpRun,
    xpMissions,
    xpBefore,
    xpAfter,
    levelBefore,
    levelAfter,
    missions,
    achievements,
    unlockedThemes: themesUnlockedBetween(levelBefore, levelAfter),
  };
}
