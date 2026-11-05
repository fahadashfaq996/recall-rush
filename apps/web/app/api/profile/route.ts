import { cleanNickname } from "@/lib/server/names";
import { allow, clientKey } from "@/lib/server/rate-limit";
import { getStore } from "@/lib/server/store";

export async function POST(request: Request) {
  if (!allow(`profile:${clientKey(request)}`, 15, 60_000)) {
    return Response.json({ ok: false, error: "Too many changes, try again soon" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { deviceId?: string; nickname?: string };
  if (typeof body.deviceId !== "string" || body.deviceId.length < 8 || body.deviceId.length > 64) {
    return Response.json({ ok: false, error: "Bad device id" }, { status: 400 });
  }
  const name = cleanNickname(body.nickname);
  if (!name.ok) return Response.json({ ok: false, error: name.error }, { status: 400 });
  const result = await getStore().rename(body.deviceId, name.name);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
