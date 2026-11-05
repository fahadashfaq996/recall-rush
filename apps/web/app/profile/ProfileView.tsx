"use client";

import { ACHIEVEMENTS, SKILL_LABEL, dailyMissions, levelFromXp, skillProfile, utcDate, type Skill } from "@recall/engine";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Wordmark } from "@/components/home/Wordmark";
import { PlayIcon } from "@/components/ui/icons";
import { loadPlayer, savePlayer, subscribePlayer, type PlayerData } from "@/lib/player";
import { THEMES } from "@/lib/themes";

const SKILL_HINT: Record<Skill, string> = {
  reflex: "Tap or freeze, Simon says",
  counting: "Quick math, edges, flash counts",
  memory: "Memorize, recall, words, patterns, rules",
  knowledge: "Trivia, true or false, odd word out",
  focus: "Read the ink, odd one out, curses",
};

export function ProfileView() {
  const player = useSyncExternalStore(subscribePlayer, loadPlayer, () => null);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
      <nav className="flex items-center justify-between">
        <Wordmark />
        <Link href="/play" className="btn-neon flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black tracking-wider">
          <PlayIcon size={14} /> PLAY
        </Link>
      </nav>
      {player ? <Profile player={player} /> : <div className="mt-10 h-96 animate-pulse rounded-[28px] bg-white/[0.04]" />}
    </div>
  );
}

function Profile({ player }: { player: PlayerData }) {
  const { level, into, needed } = levelFromXp(player.xp);
  const today = utcDate();
  const missions =
    player.missionsDay?.date === today ? player.missionsDay : { list: dailyMissions(today, level), progress: {} as Record<string, number> };
  const skills = skillProfile(player.stats);
  const earned = new Set(player.achievements);
  const s = player.stats;

  return (
    <div className="mt-8 flex flex-col gap-4">
      {/* Level card */}
      <section className="glass relative overflow-hidden rounded-[28px] p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-magenta/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--cyan),var(--violet),var(--magenta),var(--cyan))] p-[3px] shadow-[0_0_30px_rgba(255,43,214,0.45)]">
            <div className="grid h-full w-full place-items-center rounded-full bg-bg">
              <span className="font-display text-3xl font-black neon-text-cyan">{level}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted">Level {level}</div>
            <h1 className="truncate font-display text-lg font-black sm:text-2xl">{player.nickname}</h1>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="bar-grow h-full rounded-full bg-gradient-to-r from-cyan via-violet to-magenta"
                style={{ width: `${Math.max(3, (into / needed) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs font-semibold text-muted">
              {needed - into} XP to level {level + 1}
            </div>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          <Tile label="Best round" value={String(player.best)} />
          <Tile label="Daily streak" value={player.dailyStreak.count ? `🔥 ${player.dailyStreak.count}` : "–"} />
          <Tile label="Runs" value={String(s.runs)} />
        </div>
      </section>

      {/* Missions */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <SectionTitle title="Today's missions" note="Reset at midnight UTC" />
        <ul className="mt-3 flex flex-col gap-2">
          {missions.list.map((m) => {
            const progress = missions.progress[m.id] ?? 0;
            const done = progress >= m.target;
            return (
              <li
                key={m.id}
                className={`rounded-xl px-4 py-3 ring-1 ${done ? "bg-lime/10 ring-lime/40" : "bg-white/[0.04] ring-white/10"}`}
              >
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span>
                    {done ? "✅ " : ""}
                    {m.title}
                  </span>
                  <span className="shrink-0 font-display text-xs font-black text-amber">+{m.xp} XP</span>
                </div>
                {!done && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-cyan" style={{ width: `${(progress / m.target) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-muted">
                      {progress}/{m.target}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Brain profile */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <SectionTitle title="Brain profile" note={s.runs ? "Accuracy, weighted by experience" : "Play a few runs to fill this in"} />
        <div className="mt-4 flex flex-col gap-3" role="list">
          {(Object.keys(SKILL_LABEL) as Skill[]).map((skill) => (
            <div
              key={skill}
              role="listitem"
              className="grid grid-cols-[96px_1fr_36px] items-center gap-3"
              title={`${SKILL_LABEL[skill]}: ${skills[skill]}/100 (${SKILL_HINT[skill]})`}
            >
              <div className="leading-tight">
                <div className="text-sm font-bold">{SKILL_LABEL[skill]}</div>
                <div className="truncate text-[10px] font-semibold text-muted">{SKILL_HINT[skill]}</div>
              </div>
              <div className="h-3 rounded-full bg-white/[0.06]">
                <div className="bar-grow h-full rounded-r-[4px] bg-cyan" style={{ width: `${skills[skill]}%` }} />
              </div>
              <div className="text-right font-display text-sm font-black tabular-nums">{skills[skill]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <SectionTitle title="Themes" note="Unlock more by levelling up" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((t) => {
            const unlocked = level >= t.level;
            const active = player.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!unlocked}
                onClick={() => savePlayer({ theme: t.id })}
                className={`relative overflow-hidden rounded-2xl p-3 text-left ring-2 transition ${
                  active ? "ring-white" : unlocked ? "ring-white/10 hover:ring-white/40" : "cursor-not-allowed ring-white/5 opacity-60"
                }`}
                style={{ background: `linear-gradient(140deg, ${t.swatch[0]}, ${t.swatch[0]} 55%, ${t.swatch[2]}55)` }}
              >
                <div className="flex gap-1.5">
                  <span className="h-6 w-6 rounded-full" style={{ background: t.swatch[1], boxShadow: `0 0 14px ${t.swatch[1]}` }} />
                  <span className="h-6 w-6 rounded-full" style={{ background: t.swatch[2], boxShadow: `0 0 14px ${t.swatch[2]}` }} />
                </div>
                <div className="mt-3 font-display text-sm font-black text-white">{t.name}</div>
                <div className="text-[11px] font-bold text-white/70">
                  {active ? "Equipped" : unlocked ? "Tap to equip" : `🔒 Level ${t.level}`}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Achievements */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <SectionTitle title="Achievements" note={`${earned.size} / ${ACHIEVEMENTS.length}`} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const has = earned.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${has ? "bg-white/[0.07] ring-white/20" : "bg-white/[0.02] ring-white/5"}`}
              >
                <span className={`text-2xl ${has ? "" : "opacity-30 grayscale"}`}>{has ? a.icon : "🔒"}</span>
                <span className="min-w-0 leading-tight">
                  <span className={`block truncate font-display text-xs font-black ${has ? "text-white" : "text-white/50"}`}>
                    {a.title}
                  </span>
                  <span className="block text-[11px] font-semibold text-muted">{a.description}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lifetime stats */}
      <section className="glass rounded-[28px] p-5 sm:p-6">
        <SectionTitle title="Lifetime" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Rounds played" value={s.totalRounds.toLocaleString("en-US")} />
          <Tile label="Bosses beaten" value={String(s.bosses)} />
          <Tile label="PERFECTs" value={s.perfects.toLocaleString("en-US")} />
          <Tile label="Best combo" value={s.bestCombo ? `${s.bestCombo}×` : "–"} />
          <Tile label="Best points" value={s.bestPoints.toLocaleString("en-US")} />
          <Tile label="Dailies played" value={String(s.dailies)} />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <h2 className="font-display text-lg font-black">{title}</h2>
      {note && <span className="text-xs font-semibold text-muted">{note}</span>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] px-3 py-3 ring-1 ring-white/10">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-1 font-display text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}
