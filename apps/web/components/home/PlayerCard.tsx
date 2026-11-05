"use client";

import { dailyMissions, levelFromXp, utcDate } from "@recall/engine";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadPlayer, subscribePlayer, type PlayerData } from "@/lib/player";

/** Today's missions with progress, frozen for the day once generated. Display-only: never writes. */
export function missionsFor(player: PlayerData) {
  const today = utcDate();
  if (player.missionsDay?.date === today) return player.missionsDay;
  return { date: today, list: dailyMissions(today, levelFromXp(player.xp).level), progress: {} as Record<string, number> };
}

/** Returning players see their level, streak and today's missions; brand-new players see nothing. */
export function PlayerCard() {
  const player = useSyncExternalStore(subscribePlayer, loadPlayer, () => null);
  if (!player || player.stats.runs === 0) return null;
  const { level, into, needed } = levelFromXp(player.xp);
  const missions = missionsFor(player);
  const done = missions.list.filter((m) => (missions.progress[m.id] ?? 0) >= m.target).length;
  const today = utcDate();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const streakAtRisk = player.dailyStreak.count > 0 && player.dailyStreak.last === yesterday;
  return (
    <>
      {streakAtRisk && (
        <Link
          href="/daily"
          className="mx-auto mt-8 flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-amber/15 px-4 py-3 text-left ring-1 ring-amber/50 transition hover:bg-amber/20 lg:mx-0"
        >
          <span className="text-sm font-bold text-white">
            🔥 Keep your <span className="font-display font-black text-amber">{player.dailyStreak.count}-day</span> streak alive
          </span>
          <span className="shrink-0 font-display text-xs font-black text-amber">PLAY DAILY →</span>
        </Link>
      )}
      <Link
        href="/profile"
        className={`glass mx-auto block w-full max-w-md rounded-3xl p-4 text-left transition hover:bg-white/[0.07] lg:mx-0 ${streakAtRisk ? "mt-3" : "mt-8"}`}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--cyan),var(--violet),var(--magenta),var(--cyan))] p-[2px]">
            <div className="grid h-full w-full place-items-center rounded-full bg-bg font-display text-lg font-black">{level}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="truncate font-display font-black text-white">{player.nickname}</span>
              <span className="text-muted">
                {player.dailyStreak.count > 0 && <span className="mr-2 text-amber">🔥 {player.dailyStreak.count}</span>}
                Best {player.best}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan via-violet to-magenta"
                style={{ width: `${Math.max(3, (into / needed) * 100)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-semibold">
          <span className="text-muted">
            Daily missions <span className="font-display font-black text-white">{done}/3</span>
          </span>
          <span className="font-bold text-cyan">Profile →</span>
        </div>
      </Link>
    </>
  );
}
