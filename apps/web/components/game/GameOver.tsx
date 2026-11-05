"use client";

import { motion, useMotionValue, useTransform, animate } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Mode, SubmitResult } from "@/lib/api";
import type { RunRewards } from "@/lib/progress";
import { ShareIcon, TrophyIcon } from "@/components/ui/icons";
import { MissionsAndBadges, XpBar } from "./Rewards";

export function GameOver({
  mode,
  rounds,
  points,
  best,
  newBest,
  submit,
  submitting,
  nickname,
  streak,
  dailyNumber,
  onRename,
  onPlayAgain,
  onShare,
  onChallenge,
  rewards,
  bestCombo,
}: {
  mode: Mode;
  rounds: number;
  points: number;
  best: number;
  newBest: boolean;
  submit: SubmitResult | null;
  submitting: boolean;
  nickname: string;
  streak?: number;
  dailyNumber?: number;
  onRename(name: string): Promise<string | null>;
  onPlayAgain(): void;
  onShare(): void;
  onChallenge(): void;
  rewards: RunRewards | null;
  bestCombo: number;
}) {
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(count, rounds, { duration: Math.min(1.2, 0.3 + rounds * 0.03), ease: "easeOut" });
    const unsub = shown.on("change", setDisplay);
    return () => {
      controls.stop();
      unsub();
    };
  }, [count, rounds, shown]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex justify-center overflow-y-auto bg-bg/75 px-4 py-6 backdrop-blur-md"
      data-ui
    >
      <motion.div
        initial={{ y: 40, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="glass my-auto h-fit w-full max-w-md rounded-[28px] p-6 text-center shadow-[0_30px_120px_-20px_rgba(255,43,214,0.45)] sm:p-8"
      >
        <div className="glitch font-display text-2xl font-black tracking-[0.12em] neon-text-danger" data-text="GAME OVER">
          GAME OVER
        </div>
        {mode === "daily" && <div className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-muted">Daily #{dailyNumber}</div>}

        <div className="mt-5 text-xs font-bold uppercase tracking-[0.35em] text-muted">You reached round</div>
        <div className="font-display text-[clamp(84px,26vw,132px)] font-black leading-none tabular-nums neon-text-cyan">{display}</div>

        {newBest && (
          <motion.div
            initial={{ scale: 0, rotate: -8 }}
            animate={{ scale: 1, rotate: -3 }}
            transition={{ type: "spring", delay: 0.6 }}
            className="mx-auto mt-2 inline-block rounded-full bg-lime px-4 py-1 font-display text-sm font-black tracking-[0.15em] text-black shadow-[0_0_40px_rgba(182,255,59,0.7)]"
          >
            NEW BEST!
          </motion.div>
        )}
        {!newBest && mode !== "challenge" && best > 0 && (
          <p className="mt-2 text-sm font-semibold text-white/80">
            {rounds === best ? (
              <span className="text-amber">You tied your best!</span>
            ) : (
              <>
                <span className="font-display font-black text-amber">{best - rounds}</span> round{best - rounds === 1 ? "" : "s"} from your
                best ({best})
              </>
            )}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2">
          <Stat label="Points" value={points.toLocaleString("en-US")} />
          <Stat label="Top combo" value={bestCombo > 0 ? `${bestCombo}×` : "–"} />
          <Stat
            label={submit?.ranked === false ? "Unranked" : "Rank"}
            value={submitting ? "…" : submit?.rank ? `#${submit.rank}` : "–"}
            hint={rankHint(submit)}
          />
        </div>
        {submit?.next && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-3 rounded-xl bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/10"
          >
            🎯 Next target: <span className="font-display font-black text-white">{submit.next.nickname}</span> at round{" "}
            <span className="font-display font-black text-amber">{submit.next.rounds}</span>
            {submit.next.rounds > rounds && <span className="text-muted"> (+{submit.next.rounds - rounds})</span>}
          </motion.p>
        )}
        {submit?.error && <p className="mt-3 text-xs font-semibold text-amber">{submit.error}</p>}
        {mode === "daily" && streak !== undefined && streak > 0 && (
          <p className="mt-3 text-sm font-semibold text-amber">🔥 {streak}-day streak. Come back tomorrow!</p>
        )}

        {rewards && <XpBar rewards={rewards} />}

        <button
          type="button"
          onClick={onPlayAgain}
          autoFocus
          className="btn-neon mt-5 flex h-16 w-full items-center justify-center rounded-2xl font-display text-xl font-black tracking-[0.12em]"
        >
          {mode === "daily" ? "PRACTICE AGAIN" : "PLAY AGAIN"}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onShare}
            className="btn-ghost flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
          >
            <ShareIcon /> Share
          </button>
          <button
            type="button"
            onClick={onChallenge}
            className="btn-ghost flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold"
          >
            ⚔️ Challenge
          </button>
          <Link href="/leaderboard" className="btn-ghost flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold">
            <TrophyIcon /> Leaderboard
          </Link>
          <Link href="/profile" className="btn-ghost flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold">
            🏅 Profile
          </Link>
        </div>

        {rewards && <MissionsAndBadges rewards={rewards} />}

        <NameRow nickname={nickname} onRename={onRename} />
      </motion.div>
    </motion.div>
  );
}

function rankHint(submit: SubmitResult | null): string | undefined {
  if (!submit?.rank || !submit.total || submit.ranked === false) return undefined;
  if (submit.total < 20) return `of ${submit.total}`;
  return `Top ${Math.max(1, Math.ceil((submit.rank / submit.total) * 100))}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] px-2 py-3 ring-1 ring-white/10">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-1 font-display text-lg font-black tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] font-bold text-lime">{hint}</div>}
    </div>
  );
}

function NameRow({ nickname, onRename }: { nickname: string; onRename(name: string): Promise<string | null> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(nickname);
          setEditing(true);
        }}
        className="mt-4 text-sm font-semibold text-muted hover:text-white"
      >
        Playing as <span className="font-display font-extrabold text-white">{nickname}</span> ✎
      </button>
    );
  }
  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await onRename(value.trim());
        setBusy(false);
        if (err) setError(err);
        else setEditing(false);
      }}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          maxLength={16}
          autoFocus
          aria-label="Nickname"
          className="h-11 min-w-0 flex-1 rounded-xl bg-white/[0.07] px-4 text-base font-semibold text-white outline-none ring-1 ring-white/15 focus:ring-cyan"
        />
        <button type="submit" disabled={busy} className="btn-ghost h-11 rounded-xl px-4 text-sm font-bold">
          {busy ? "…" : "Save"}
        </button>
      </div>
      {error && <p className="mt-2 text-left text-xs font-semibold text-amber">{error}</p>}
    </form>
  );
}
