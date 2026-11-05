"use client";

import { dailyNumber, utcDate } from "@recall/engine";
import { useSyncExternalStore } from "react";

function untilMidnightUtc(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function subscribeClock(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}

const currentSecond = () => Math.floor(Date.now() / 1000);

/** "Daily #N · new in hh:mm:ss". Renders a placeholder on the server since it depends on the clock. */
export function DailyCountdown({ compact = false }: { compact?: boolean }) {
  const seconds = useSyncExternalStore(subscribeClock, currentSecond, () => null);
  const now = seconds === null ? null : new Date(seconds * 1000);
  if (!now) return <span className="tabular-nums opacity-0">Daily #00 · 00:00:00</span>;
  const n = dailyNumber(utcDate(now));
  return compact ? (
    <span className="tabular-nums">#{n}</span>
  ) : (
    <span className="tabular-nums">
      Daily #{n} · new in {untilMidnightUtc(now)}
    </span>
  );
}
