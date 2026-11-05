import "server-only";

const BLOCKED = [
  "fuck",
  "shit",
  "cunt",
  "nigg",
  "fag",
  "bitch",
  "rape",
  "nazi",
  "hitler",
  "porn",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "retard",
  "kys",
];

export function cleanNickname(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Pick a nickname" };
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 16) return { ok: false, error: "Use 3 to 16 characters" };
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return { ok: false, error: "Letters, numbers, spaces, _ . and - only" };
  const squashed = name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => squashed.includes(w))) return { ok: false, error: "Please pick a different name" };
  return { ok: true, name };
}
