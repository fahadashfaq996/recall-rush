import { dailyNumber, progressBar } from "@recall/engine";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Wordmark } from "@/components/home/Wordmark";
import { PlayIcon } from "@/components/ui/icons";
import { getStore } from "@/lib/server/store";

const UUID = /^[0-9a-f-]{36}$/i;

async function loadRun(runId: string) {
  if (!UUID.test(runId)) return null;
  return getStore()
    .getRun(runId)
    .catch(() => null);
}

export async function generateMetadata({ params }: PageProps<"/r/[runId]">): Promise<Metadata> {
  const { runId } = await params;
  const run = await loadRun(runId);
  if (!run) return { title: "Run not found" };
  const title = `${run.nickname} reached round ${run.rounds}`;
  return { title, description: `${title} in Recall Rush. Think you can beat it?`, openGraph: { title }, twitter: { title } };
}

export default function RunPage({ params }: PageProps<"/r/[runId]">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
      <nav>
        <Wordmark />
      </nav>
      <Suspense fallback={<div className="mt-16 h-96 animate-pulse rounded-[28px] bg-white/[0.04]" />}>
        <RunCard params={params} />
      </Suspense>
    </div>
  );
}

async function RunCard({ params }: { params: PageProps<"/r/[runId]">["params"] }) {
  const { runId } = await params;
  const run = await loadRun(runId);
  if (!run) notFound();
  return (
    <div className="glass mt-14 rounded-[28px] p-7 text-center sm:p-10">
      <div className="text-xs font-black uppercase tracking-[0.3em] text-muted">
        {run.mode === "daily" && run.dailyDate
          ? `Daily #${dailyNumber(run.dailyDate)}`
          : run.mode === "challenge"
            ? "Challenge run"
            : "Endless run"}
      </div>
      <div className="mt-4 font-display text-2xl font-black neon-text-magenta">{run.nickname}</div>
      <div className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-muted">reached round</div>
      <div className="font-display text-[clamp(96px,30vw,160px)] font-black leading-none neon-text-cyan">{run.rounds}</div>
      <div className="mt-3 text-2xl tracking-wider">{progressBar(run.rounds)}</div>
      <div className="mt-3 font-semibold text-muted">{run.points.toLocaleString("en-US")} points</div>
      <Link
        href={run.mode === "daily" ? "/daily" : "/play"}
        className="btn-neon mt-8 flex h-16 items-center justify-center gap-3 rounded-2xl font-display text-lg font-black tracking-[0.1em]"
      >
        <PlayIcon size={20} /> CAN YOU BEAT IT?
      </Link>
      <Link href="/leaderboard" className="mt-4 inline-block text-sm font-bold text-muted hover:text-white">
        See the leaderboard
      </Link>
    </div>
  );
}
