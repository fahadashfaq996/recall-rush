import { RULES_VERSION, dailySeed, randomSeed, utcDate } from "@recall/engine";
import type { Mode } from "@/lib/api";
import { allow, clientKey } from "@/lib/server/rate-limit";
import { issueToken } from "@/lib/server/token";

export async function POST(request: Request) {
  if (!allow(`start:${clientKey(request)}`, 60, 60_000)) {
    return Response.json({ error: "Slow down a little" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { mode?: Mode; seed?: number; rulesVersion?: string };
  // A page loaded before a deploy would generate different rounds than the server replays.
  if (body.rulesVersion !== RULES_VERSION) {
    return Response.json({ error: "A new version of the game is available. Refresh to play ranked.", outdated: true }, { status: 409 });
  }
  const mode: Mode = body.mode === "daily" || body.mode === "challenge" ? body.mode : "endless";
  const date = utcDate();
  let seed: number;
  if (mode === "daily") seed = dailySeed(date);
  else if (mode === "challenge" && Number.isInteger(body.seed) && body.seed! >= 0 && body.seed! < 2 ** 32) seed = body.seed!;
  else seed = randomSeed();

  const runId = crypto.randomUUID();
  const token = issueToken({
    runId,
    seed,
    mode,
    date: mode === "daily" ? date : undefined,
    rulesVersion: RULES_VERSION,
    issuedAt: Date.now(),
  });
  return Response.json({ runId, seed, token, mode, date: mode === "daily" ? date : undefined });
}
