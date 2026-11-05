import { RULES_VERSION, verifyRun, type RoundLog } from "@recall/engine";
import { cleanNickname } from "@/lib/server/names";
import { allow, clientKey } from "@/lib/server/rate-limit";
import { getStore, type Board } from "@/lib/server/store";
import { readToken } from "@/lib/server/token";

const MAX_BODY_BYTES = 400_000;

export async function POST(request: Request) {
  if (!allow(`submit:${clientKey(request)}`, 30, 60_000)) {
    return Response.json({ ok: false, error: "Too many submissions, try again in a minute" }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "Run too large" }, { status: 413 });
  let body: { token?: string; deviceId?: string; nickname?: string; logs?: RoundLog[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const claims = readToken(body.token);
  if (!claims) return Response.json({ ok: false, error: "This run has expired" }, { status: 400 });
  if (claims.rulesVersion !== RULES_VERSION) {
    return Response.json(
      { ok: false, rounds: 0, points: 0, error: "The game was updated during your run. Refresh to play ranked." },
      { status: 409 },
    );
  }
  if (typeof body.deviceId !== "string" || body.deviceId.length < 8 || body.deviceId.length > 64) {
    return Response.json({ ok: false, error: "Bad device id" }, { status: 400 });
  }
  if (!Array.isArray(body.logs)) return Response.json({ ok: false, error: "Bad run log" }, { status: 400 });

  const result = verifyRun(claims.seed, body.logs);
  if (!result.ok) return Response.json({ ok: false, rounds: 0, points: 0, error: "This run couldn't be verified" }, { status: 422 });

  const store = getStore();
  const name = cleanNickname(body.nickname);
  const profile = await store.ensureProfile(body.deviceId, name.ok ? name.name : `Player${Math.floor(Math.random() * 9000 + 1000)}`);
  const saved = await store.saveRun({
    runId: claims.runId,
    profileId: profile.id,
    mode: claims.mode,
    seed: claims.seed,
    dailyDate: claims.date ?? null,
    rounds: result.rounds,
    points: result.points,
    logs: body.logs,
  });
  if (!saved.saved && saved.reason === "duplicate") {
    return Response.json(
      { ok: false, rounds: result.rounds, points: result.points, error: "This run was already submitted" },
      { status: 409 },
    );
  }

  const ranked = saved.saved && claims.mode !== "challenge";
  const board: Board = claims.mode === "daily" ? "daily" : "all";
  const standing = ranked ? await store.standing(board, claims.date ?? "", result.rounds, result.points, profile.id) : null;
  const percentile = standing ? Math.round(((standing.total - standing.rank) / Math.max(standing.total, 1)) * 100) : undefined;

  // The player just above you on the board: a concrete, beatable target for the next run.
  let next: { nickname: string; rounds: number } | undefined;
  if (standing && standing.rank > 1 && standing.rank <= 200) {
    const above = (await store.leaderboard(board, claims.date ?? "", standing.rank)).filter(
      (e) => e.nickname !== profile.nickname && (e.rounds > result.rounds || (e.rounds === result.rounds && e.points > result.points)),
    );
    const target = above[above.length - 1];
    if (target) next = { nickname: target.nickname, rounds: target.rounds };
  }

  return Response.json({
    ok: true,
    runId: saved.saved ? claims.runId : undefined,
    rounds: result.rounds,
    points: result.points,
    rank: standing?.rank,
    total: standing?.total,
    percentile,
    next,
    nickname: profile.nickname,
    ranked,
    error: !saved.saved ? "You already played today's ranked daily" : undefined,
  });
}
