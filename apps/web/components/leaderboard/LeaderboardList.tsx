import Link from "next/link";
import type { LeaderEntry } from "@/lib/server/store";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardList({ entries, empty, compact = false }: { entries: LeaderEntry[]; empty: string; compact?: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
        <div className="text-3xl">🏁</div>
        <p className="mt-2 text-sm font-semibold text-muted">{empty}</p>
        <Link href="/play" className="mt-4 inline-block font-display text-sm font-black text-cyan hover:underline">
          Claim the top spot →
        </Link>
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((e) => {
        const top = e.rank <= 3;
        return (
          <li key={e.runId}>
            <Link
              href={`/r/${e.runId}`}
              className={`flex items-center gap-3 rounded-2xl px-4 transition hover:bg-white/[0.07] ${compact ? "py-2.5" : "py-3.5"} ${
                top ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-white/[0.025]"
              }`}
            >
              <span className={`w-9 text-center font-display font-black tabular-nums ${top ? "text-xl" : "text-sm text-muted"}`}>
                {top ? MEDALS[e.rank - 1] : e.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-white">{e.nickname}</span>
              {!compact && (
                <span className="hidden text-xs font-semibold tabular-nums text-muted sm:inline">
                  {e.points.toLocaleString("en-US")} pts
                </span>
              )}
              <span className="flex items-baseline gap-1">
                <span className={`font-display font-black tabular-nums ${top ? "text-xl neon-text-cyan" : "text-lg text-white"}`}>
                  {e.rounds}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">rnd</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}
