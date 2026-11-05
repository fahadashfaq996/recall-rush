/** Per-device player data kept in localStorage. Every access is guarded: storage can be missing or blocked. */

import { emptyStats, type LifetimeStats, type Mission } from "@recall/engine";

const KEY = "recall-rush:v1";

export interface DailyResult {
  rounds: number;
  points: number;
  runId?: string;
}

export interface PlayerData {
  deviceId: string;
  nickname: string;
  best: number;
  bestPoints: number;
  games: number;
  sound: boolean;
  haptics: boolean;
  daily: Record<string, DailyResult>;
  dailyStreak: { last: string; count: number };
  seenIntro: boolean;
  /** Meta progression. */
  xp: number;
  stats: LifetimeStats;
  achievements: string[];
  /** Today's missions are fixed when first shown, so levelling up mid-day doesn't move the goalposts. */
  missionsDay: { date: string; list: Mission[]; progress: Record<string, number> } | null;
  theme: string;
}

const ADJECTIVES = ["Neon", "Turbo", "Cosmic", "Pixel", "Laser", "Hyper", "Quantum", "Retro", "Glitch", "Nova", "Synth", "Atomic"];
const NOUNS = ["Fox", "Owl", "Tiger", "Comet", "Falcon", "Panda", "Wolf", "Shark", "Raven", "Lynx", "Gecko", "Otter"];

function randomName(): string {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)] as T;
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(Math.random() * 900 + 100)}`;
}

function fresh(): PlayerData {
  return {
    deviceId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    nickname: randomName(),
    best: 0,
    bestPoints: 0,
    games: 0,
    sound: true,
    haptics: true,
    daily: {},
    dailyStreak: { last: "", count: 0 },
    seenIntro: false,
    xp: 0,
    stats: emptyStats(),
    achievements: [],
    missionsDay: null,
    theme: "neon",
  };
}

let cache: PlayerData | null = null;
const listeners = new Set<() => void>();

/** For useSyncExternalStore: re-render when player data changes. */
export function subscribePlayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadPlayer(): PlayerData {
  if (cache) return cache;
  let data = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PlayerData>;
      // Fill in fields added since the data was saved (older players have no stats yet).
      data = { ...data, ...saved, stats: { ...emptyStats(), ...saved.stats } };
    } else localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode or blocked storage: play on with an in-memory profile.
  }
  cache = data;
  return data;
}

export function savePlayer(patch: Partial<PlayerData>): PlayerData {
  const next = { ...loadPlayer(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore: the in-memory copy still works for this session.
  }
  listeners.forEach((l) => l());
  return next;
}

/** Records a daily result and advances the streak if yesterday was also played. */
export function recordDaily(date: string, result: DailyResult): PlayerData {
  const p = loadPlayer();
  if (p.daily[date]) return p;
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const count = p.dailyStreak.last === yesterday ? p.dailyStreak.count + 1 : p.dailyStreak.last === date ? p.dailyStreak.count : 1;
  return savePlayer({ daily: { ...p.daily, [date]: result }, dailyStreak: { last: date, count } });
}
