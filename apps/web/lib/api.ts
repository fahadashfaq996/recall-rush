import { RULES_VERSION, type RoundLog } from "@recall/engine";

export type Mode = "endless" | "daily" | "challenge";

export interface StartedRun {
  runId: string;
  seed: number;
  token: string;
  mode: Mode;
  date?: string;
}

export interface SubmitResult {
  ok: boolean;
  runId?: string;
  rounds: number;
  points: number;
  rank?: number;
  total?: number;
  percentile?: number;
  /** The player just above on the leaderboard, to chase next run. */
  next?: { nickname: string; rounds: number };
  nickname?: string;
  ranked?: boolean;
  error?: string;
}

/** Asks the server for a signed seed. "outdated" means this page is older than the server and should refresh. */
export async function startRun(mode: Mode, seed?: number): Promise<StartedRun | "outdated" | null> {
  try {
    const res = await fetch("/api/runs/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, seed, rulesVersion: RULES_VERSION }),
    });
    if (res.status === 409) return "outdated";
    if (!res.ok) return null;
    return (await res.json()) as StartedRun;
  } catch {
    return null;
  }
}

export async function submitRun(body: {
  token: string;
  deviceId: string;
  nickname: string;
  logs: RoundLog[];
}): Promise<SubmitResult | null> {
  try {
    const res = await fetch("/api/runs/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as SubmitResult;
  } catch {
    return null;
  }
}

export async function renamePlayer(deviceId: string, nickname: string): Promise<{ ok: boolean; nickname?: string; error?: string }> {
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId, nickname }),
    });
    return (await res.json()) as { ok: boolean; nickname?: string; error?: string };
  } catch {
    return { ok: false, error: "You're offline" };
  }
}
