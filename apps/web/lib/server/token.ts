import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Mode } from "@/lib/api";

export interface RunClaims {
  runId: string;
  seed: number;
  mode: Mode;
  date?: string;
  /** Engine + content version the run was issued for; see RULES_VERSION. */
  rulesVersion: string;
  issuedAt: number;
}

const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.RUN_TOKEN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("RUN_TOKEN_SECRET must be set in production");
  return "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** A run token proves the server issued this seed, so scores can't be posted for hand-picked seeds. */
export function issueToken(claims: RunClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: unknown): RunClaims | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as RunClaims;
    if (Date.now() - claims.issuedAt > MAX_AGE_MS) return null;
    return claims;
  } catch {
    return null;
  }
}
