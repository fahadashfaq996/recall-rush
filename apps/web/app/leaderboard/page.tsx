import { dailyNumber, utcDate } from "@recall/engine";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Wordmark } from "@/components/home/Wordmark";
import { LeaderboardList, LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardList";
import { TrophyIcon } from "@/components/ui/icons";
import { getStore, type Board } from "@/lib/server/store";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The best Recall Rush runs: all time, this week, and today's Daily Challenge.",
};

const TABS: { id: Board; label: string }[] = [
  { id: "daily", label: "Today's daily" },
  { id: "week", label: "This week" },
  { id: "all", label: "All time" },
];

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
      <nav className="flex items-center justify-between">
        <Wordmark />
        <Link href="/play" className="btn-neon rounded-xl px-4 py-2 font-display text-xs font-black tracking-wider">
          PLAY
        </Link>
      </nav>
      <header className="mt-12 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber/15 text-amber ring-1 ring-amber/40 shadow-[0_0_40px_rgba(255,196,61,0.35)]">
          <TrophyIcon size={30} />
        </div>
        <h1 className="mt-5 font-display text-[clamp(36px,8vw,60px)] font-black leading-none">Leaderboard</h1>
        <p className="mt-3 font-medium text-muted">Ranked by rounds reached, then points. Every run is verified.</p>
      </header>
      <Suspense fallback={<BoardFallback />}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BoardFallback() {
  return (
    <div className="mt-10">
      <div className="mb-6 h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
      <LeaderboardSkeleton rows={10} />
    </div>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const params = await searchParams;
  await connection();
  const board: Board = params.board === "week" || params.board === "all" ? params.board : "daily";
  const today = utcDate();
  const entries = await getStore()
    .leaderboard(board, today, 100)
    .catch(() => []);
  const empty =
    board === "daily"
      ? `Nobody has played Daily #${dailyNumber(today)} yet.`
      : board === "week"
        ? "No runs this week yet."
        : "No runs yet.";

  return (
    <div className="mt-10">
      <div className="glass mb-6 grid grid-cols-3 gap-1 rounded-2xl p-1" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/leaderboard?board=${t.id}`}
            role="tab"
            aria-selected={board === t.id}
            className={`rounded-xl py-3 text-center text-sm font-bold transition ${
              board === t.id ? "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.3)]" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {board === "daily" && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-magenta/10 px-4 py-3 text-sm font-semibold ring-1 ring-magenta/30">
          <span>Daily #{dailyNumber(today)} · first run counts</span>
          <Link href="/daily" className="font-display font-black text-magenta hover:underline">
            Play →
          </Link>
        </div>
      )}
      <LeaderboardList entries={entries} empty={empty} />
    </div>
  );
}
