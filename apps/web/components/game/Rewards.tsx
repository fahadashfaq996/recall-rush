"use client";

import { levelFromXp } from "@recall/engine";
import { motion } from "motion/react";
import type { MissionStatus, RunRewards } from "@/lib/progress";

/** XP bar that fills from where the player was to where the run left them, with a level-up flourish. */
export function XpBar({ rewards }: { rewards: RunRewards }) {
  const before = levelFromXp(rewards.xpBefore);
  const after = levelFromXp(rewards.xpAfter);
  const leveled = after.level > before.level;
  const from = leveled ? 0 : (before.into / before.needed) * 100;
  const to = (after.into / after.needed) * 100;
  return (
    <div className="mt-5 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="font-display font-black tracking-wider text-white">
          LEVEL {after.level}
          {leveled && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9, type: "spring" }}
              className="ml-2 inline-block rounded-full bg-amber px-2 py-0.5 text-[10px] text-black"
            >
              LEVEL UP!
            </motion.span>
          )}
        </span>
        <span className="font-display font-black text-lime">+{rewards.xpRun + rewards.xpMissions} XP</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: `${from}%` }}
          animate={{ width: `${Math.max(to, 3)}%` }}
          transition={{ duration: 1.1, delay: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-cyan via-violet to-magenta shadow-[0_0_14px_var(--magenta)]"
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-muted">
        <span>
          {after.into} / {after.needed} XP
        </span>
        {rewards.xpMissions > 0 && <span className="text-amber">incl. +{rewards.xpMissions} from missions</span>}
      </div>
      {rewards.unlockedThemes.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="mt-2 flex items-center gap-2 rounded-xl bg-magenta/15 px-3 py-2 text-xs font-bold text-white ring-1 ring-magenta/40"
        >
          <span className="flex gap-0.5">
            {t.swatch.map((c) => (
              <span key={c} className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: c }} />
            ))}
          </span>
          New theme unlocked: <span className="font-display font-black">{t.name}</span>
        </motion.div>
      ))}
    </div>
  );
}

function MissionRow({ status, index }: { status: MissionStatus; index: number }) {
  const { mission, before, after, completedNow } = status;
  const done = after >= mission.target;
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.12 }}
      className={`rounded-xl px-3 py-2 text-left ring-1 ${completedNow ? "bg-lime/15 ring-lime/50" : done ? "bg-white/[0.03] ring-white/10" : "bg-white/[0.05] ring-white/10"}`}
    >
      <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
        <span className={done ? "text-white" : "text-white/85"}>
          {done ? "✅ " : ""}
          {mission.title}
        </span>
        <span className={`shrink-0 font-display text-[11px] font-black ${completedNow ? "text-lime" : "text-muted"}`}>
          {completedNow ? `+${mission.xp} XP` : done ? "DONE" : `${after}/${mission.target}`}
        </span>
      </div>
      {!done && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: `${(before / mission.target) * 100}%` }}
            animate={{ width: `${(after / mission.target) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.6 + index * 0.12 }}
            className="h-full rounded-full bg-cyan"
          />
        </div>
      )}
    </motion.li>
  );
}

/** Today's missions with this run's progress, and any achievements the run earned. */
export function MissionsAndBadges({ rewards }: { rewards: RunRewards }) {
  return (
    <div className="mt-6 text-left">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-xs font-black tracking-[0.25em] text-muted">DAILY MISSIONS</h3>
        <span className="text-[11px] font-semibold text-muted">Reset 00:00 UTC</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rewards.missions.map((m, i) => (
          <MissionRow key={m.mission.id} status={m} index={i} />
        ))}
      </ul>
      {rewards.achievements.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 font-display text-xs font-black tracking-[0.25em] text-muted">ACHIEVEMENTS UNLOCKED</h3>
          <div className="flex flex-wrap gap-2">
            {rewards.achievements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 1 + i * 0.15, type: "spring", stiffness: 300, damping: 14 }}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${TIER_STYLE[a.tier]}`}
                title={a.description}
              >
                <span className="text-lg">{a.icon}</span>
                <span className="text-left leading-tight">
                  <span className="block font-display text-xs font-black text-white">{a.title}</span>
                  <span className="block text-[10px] font-semibold text-white/70">{a.description}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const TIER_STYLE = {
  bronze: "bg-amber/10 ring-amber/40",
  silver: "bg-white/10 ring-white/40",
  gold: "bg-yellow-300/15 ring-yellow-300/60 shadow-[0_0_20px_rgba(253,224,71,0.35)]",
} as const;
