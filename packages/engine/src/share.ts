import { hashString } from "./rng";
import type { RoundSpec, SymbolId } from "./types";

/** Day 1 of the Daily Challenge. */
export const DAILY_EPOCH = "2026-10-22";

/** Today's date in UTC as YYYY-MM-DD, so everyone shares the same daily seed. */
export function utcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dailySeed(date: string): number {
  return hashString(`recall-rush:daily:${date}`);
}

export function dailyNumber(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}

export const SYMBOL_EMOJI: Record<SymbolId, string> = {
  star: "⭐",
  heart: "❤️",
  bolt: "⚡",
  diamond: "💎",
  moon: "🌙",
  skull: "💀",
  crown: "👑",
  flame: "🔥",
};

/** One square per 10 rounds: green for a full block, yellow for the partial one, red where the run ended. */
export function progressBar(rounds: number): string {
  const full = Math.floor(rounds / 10);
  const partial = rounds % 10 >= 5 ? "🟨" : rounds % 10 > 0 ? "🟧" : "";
  return "🟩".repeat(Math.min(full, 12)) + (full > 12 ? "➕" : "") + partial + "🟥";
}

export function shareText(opts: { rounds: number; points: number; daily?: string; url: string }): string {
  const head = opts.daily
    ? `🧠 Recall Rush Daily #${dailyNumber(opts.daily)}: round ${opts.rounds}`
    : `🧠 Recall Rush: I reached round ${opts.rounds}`;
  return `${head}\n${progressBar(opts.rounds)}\n${opts.points.toLocaleString("en-US")} pts. Can you beat me?\n${opts.url}`;
}

/** Plain-language correct answer for the game over screen. */
export function answerText(spec: RoundSpec): string {
  const { expected, baseExpected, trigger } = spec;
  if (trigger?.matches) {
    return trigger.action === "freeze" ? "The rule said: freeze when you see that symbol" : "The rule said: tap the symbol when you see it";
  }
  const { view } = spec;
  if (view.type === "truth" && expected.kind === "count") {
    const flipped = spec.appliedCurses.includes("flip") ? ", and the FLIP curse reversed it" : "";
    return `That's ${view.truth ? "TRUE" : "FALSE"}, so you needed to ${expected.n === 1 ? "tap" : "freeze"}${flipped}`;
  }
  if (view.type === "oddword") return `${view.words[view.intruderIndex]} isn't one of the ${view.category}`;
  if (expected.kind === "count") {
    if (expected.gate) {
      const flipped = spec.appliedCurses.includes("flip") ? " (the FLIP curse was on)" : "";
      return (expected.n === 1 ? "You needed to tap" : "You needed to freeze") + flipped;
    }
    const base = baseExpected.kind === "count" ? baseExpected.n : expected.n;
    const curses = spec.appliedCurses.length ? ` (${base}, then the curse made it ${expected.n})` : "";
    return `The answer was ${expected.n} tap${expected.n === 1 ? "" : "s"}${curses}`;
  }
  if (expected.kind === "pick") return "The correct one is highlighted";
  return "The pattern is shown above";
}
