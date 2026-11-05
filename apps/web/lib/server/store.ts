import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Mode } from "@/lib/api";

export type Board = "all" | "week" | "daily";

export interface LeaderEntry {
  rank: number;
  nickname: string;
  rounds: number;
  points: number;
  runId: string;
  createdAt: string;
}

export interface RunRecord {
  runId: string;
  nickname: string;
  mode: Mode;
  rounds: number;
  points: number;
  dailyDate: string | null;
  createdAt: string;
}

export interface NewRun {
  runId: string;
  profileId: string;
  mode: Mode;
  seed: number;
  dailyDate: string | null;
  rounds: number;
  points: number;
  logs: unknown;
}

export interface Store {
  readonly kind: "supabase" | "file";
  ensureProfile(deviceId: string, nickname: string): Promise<{ id: string; nickname: string }>;
  rename(deviceId: string, nickname: string): Promise<{ ok: true; nickname: string } | { ok: false; error: string }>;
  saveRun(run: NewRun): Promise<{ saved: true } | { saved: false; reason: "duplicate" | "daily-taken" }>;
  getRun(runId: string): Promise<RunRecord | null>;
  leaderboard(board: Board, day: string, limit: number): Promise<LeaderEntry[]>;
  standing(board: Board, day: string, rounds: number, points: number, profileId: string): Promise<{ rank: number; total: number }>;
  totalRuns(): Promise<number>;
}

const better = (a: { rounds: number; points: number }, b: { rounds: number; points: number }) =>
  a.rounds !== b.rounds ? a.rounds > b.rounds : a.points > b.points;

/** Monday 00:00 UTC of the current week: the weekly board resets then. */
export function weekStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

// ---------------------------------------------------------------------------
// Supabase (production)
// ---------------------------------------------------------------------------

class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(private db: SupabaseClient) {}

  async ensureProfile(deviceId: string, nickname: string) {
    const existing = await this.db.from("profiles").select("id, nickname").eq("device_id", deviceId).maybeSingle();
    if (existing.data) return existing.data as { id: string; nickname: string };
    for (let attempt = 0; attempt < 6; attempt++) {
      const name = attempt === 0 ? nickname : `${nickname.slice(0, 12)}${Math.floor(Math.random() * 9000 + 1000)}`;
      const inserted = await this.db.from("profiles").insert({ device_id: deviceId, nickname: name }).select("id, nickname").single();
      if (inserted.data) return inserted.data as { id: string; nickname: string };
      if (inserted.error?.code !== "23505") throw inserted.error;
      // Unique violation: either the nickname is taken or another request created this device's profile first.
      const again = await this.db.from("profiles").select("id, nickname").eq("device_id", deviceId).maybeSingle();
      if (again.data) return again.data as { id: string; nickname: string };
    }
    throw new Error("could not create profile");
  }

  async rename(deviceId: string, nickname: string) {
    const taken = await this.db
      .from("profiles")
      .select("device_id")
      .ilike("nickname", nickname.replace(/[_%\\]/g, "\\$&"))
      .maybeSingle();
    if (taken.data && taken.data.device_id !== deviceId) return { ok: false as const, error: "That name is taken" };
    const updated = await this.db.from("profiles").update({ nickname }).eq("device_id", deviceId).select("nickname").maybeSingle();
    if (updated.error?.code === "23505") return { ok: false as const, error: "That name is taken" };
    if (updated.error) throw updated.error;
    if (!updated.data) await this.ensureProfile(deviceId, nickname);
    return { ok: true as const, nickname };
  }

  async saveRun(run: NewRun) {
    const res = await this.db.from("runs").insert({
      id: run.runId,
      profile_id: run.profileId,
      mode: run.mode,
      seed: run.seed,
      daily_date: run.dailyDate,
      rounds: run.rounds,
      points: run.points,
      input_log: run.logs,
    });
    if (!res.error) return { saved: true as const };
    if (res.error.code === "23505") {
      return {
        saved: false as const,
        reason: res.error.message.includes("runs_one_daily") ? ("daily-taken" as const) : ("duplicate" as const),
      };
    }
    throw res.error;
  }

  async getRun(runId: string) {
    const res = await this.db
      .from("runs")
      .select("id, mode, rounds, points, daily_date, created_at, profiles(nickname)")
      .eq("id", runId)
      .maybeSingle();
    if (!res.data) return null;
    const r = res.data as unknown as {
      id: string;
      mode: Mode;
      rounds: number;
      points: number;
      daily_date: string | null;
      created_at: string;
      profiles: { nickname: string } | null;
    };
    return {
      runId: r.id,
      nickname: r.profiles?.nickname ?? "Player",
      mode: r.mode,
      rounds: r.rounds,
      points: r.points,
      dailyDate: r.daily_date,
      createdAt: r.created_at,
    };
  }

  async leaderboard(board: Board, day: string, limit: number) {
    const res = await this.db.rpc("leaderboard", { board, day, lim: limit });
    if (res.error) throw res.error;
    return (res.data as { rank: number; nickname: string; rounds: number; points: number; run_id: string; created_at: string }[]).map(
      (r) => ({
        rank: Number(r.rank),
        nickname: r.nickname,
        rounds: r.rounds,
        points: r.points,
        runId: r.run_id,
        createdAt: r.created_at,
      }),
    );
  }

  async standing(board: Board, day: string, rounds: number, points: number, profileId: string) {
    const res = await this.db.rpc("standing", { board, day, p_rounds: rounds, p_points: points, p_profile: profileId });
    if (res.error) throw res.error;
    const row = (res.data as { rank: number; total: number }[])[0];
    return { rank: Number(row?.rank ?? 1), total: Number(row?.total ?? 1) };
  }

  async totalRuns() {
    const res = await this.db.from("runs").select("id", { count: "estimated", head: true });
    return res.count ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Local JSON file (development without Supabase)
// ---------------------------------------------------------------------------

interface FileProfile {
  id: string;
  deviceId: string;
  nickname: string;
  createdAt: string;
}
interface FileRun extends NewRun {
  createdAt: string;
}
interface FileData {
  profiles: FileProfile[];
  runs: FileRun[];
}

class FileStore implements Store {
  readonly kind = "file" as const;
  private data: FileData | null = null;
  private writing: Promise<void> = Promise.resolve();
  private path = join(process.cwd(), ".data", "db.json");

  private mtime = 0;

  /** Re-reads the file when another server bundle (pages vs. API routes in dev) has written to it. */
  private async load(): Promise<FileData> {
    await this.writing;
    try {
      const { mtimeMs } = await stat(this.path);
      if (!this.data || mtimeMs !== this.mtime) {
        this.data = JSON.parse(await readFile(this.path, "utf8")) as FileData;
        this.mtime = mtimeMs;
      }
    } catch {
      this.data ??= { profiles: [], runs: [] };
    }
    return this.data;
  }

  private persist() {
    const snapshot = JSON.stringify(this.data);
    this.writing = this.writing
      .then(async () => {
        await mkdir(join(process.cwd(), ".data"), { recursive: true });
        await writeFile(this.path, snapshot);
        this.mtime = (await stat(this.path)).mtimeMs;
      })
      .catch(() => {
        // Read-only file system (e.g. a serverless deploy without Supabase): keep data in memory only.
      });
  }

  async ensureProfile(deviceId: string, nickname: string) {
    const db = await this.load();
    const found = db.profiles.find((p) => p.deviceId === deviceId);
    if (found) return { id: found.id, nickname: found.nickname };
    let name = nickname;
    while (db.profiles.some((p) => p.nickname.toLowerCase() === name.toLowerCase())) {
      name = `${nickname.slice(0, 12)}${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const profile = { id: crypto.randomUUID(), deviceId, nickname: name, createdAt: new Date().toISOString() };
    db.profiles.push(profile);
    this.persist();
    return { id: profile.id, nickname: name };
  }

  async rename(deviceId: string, nickname: string) {
    const db = await this.load();
    if (db.profiles.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase() && p.deviceId !== deviceId)) {
      return { ok: false as const, error: "That name is taken" };
    }
    const found = db.profiles.find((p) => p.deviceId === deviceId);
    if (found) found.nickname = nickname;
    else await this.ensureProfile(deviceId, nickname);
    this.persist();
    return { ok: true as const, nickname };
  }

  async saveRun(run: NewRun) {
    const db = await this.load();
    if (db.runs.some((r) => r.runId === run.runId)) return { saved: false as const, reason: "duplicate" as const };
    if (run.mode === "daily" && db.runs.some((r) => r.mode === "daily" && r.profileId === run.profileId && r.dailyDate === run.dailyDate)) {
      return { saved: false as const, reason: "daily-taken" as const };
    }
    db.runs.push({ ...run, createdAt: new Date().toISOString() });
    this.persist();
    return { saved: true as const };
  }

  async getRun(runId: string) {
    const db = await this.load();
    const r = db.runs.find((x) => x.runId === runId);
    if (!r) return null;
    const nickname = db.profiles.find((p) => p.id === r.profileId)?.nickname ?? "Player";
    return { runId: r.runId, nickname, mode: r.mode, rounds: r.rounds, points: r.points, dailyDate: r.dailyDate, createdAt: r.createdAt };
  }

  private async bestPerProfile(board: Board, day: string) {
    const db = await this.load();
    const since = weekStart().toISOString();
    const best = new Map<string, FileRun>();
    for (const r of db.runs) {
      const inBoard =
        board === "daily" ? r.mode === "daily" && r.dailyDate === day : r.mode === "endless" && (board === "all" || r.createdAt >= since);
      if (!inBoard) continue;
      const current = best.get(r.profileId);
      if (!current || better(r, current)) best.set(r.profileId, r);
    }
    const names = new Map(db.profiles.map((p) => [p.id, p.nickname]));
    return [...best.values()]
      .sort((a, b) => b.rounds - a.rounds || b.points - a.points || a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({ ...r, nickname: names.get(r.profileId) ?? "Player" }));
  }

  async leaderboard(board: Board, day: string, limit: number) {
    const rows = await this.bestPerProfile(board, day);
    let rank = 0;
    return rows.slice(0, limit).map((r, i) => {
      const prev = rows[i - 1];
      if (!prev || prev.rounds !== r.rounds || prev.points !== r.points) rank = i + 1;
      return { rank, nickname: r.nickname, rounds: r.rounds, points: r.points, runId: r.runId, createdAt: r.createdAt };
    });
  }

  async standing(board: Board, day: string, rounds: number, points: number, profileId: string) {
    const rows = await this.bestPerProfile(board, day);
    const ahead = rows.filter((r) => r.profileId !== profileId && better(r, { rounds, points })).length;
    return { rank: ahead + 1, total: Math.max(rows.length, 1) };
  }

  async totalRuns() {
    return (await this.load()).runs.length;
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } })) : new FileStore();
  return store;
}
