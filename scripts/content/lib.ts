import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CategoryItem, PackName, TriviaItem, TruthItem, WordSet } from "../../packages/engine/src/content";

export type AnyItem = TriviaItem | TruthItem | CategoryItem | WordSet;
export const PACK_NAMES: PackName[] = ["trivia", "truth", "categories", "wordsets"];

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PACK_DIR = join(ROOT, "packages/engine/src/content/packs/en");
/** Generated items wait here (git-ignored) until someone reviews and applies them. */
const STAGING_DIR = join(ROOT, "scripts/content/staging");

interface PackFile {
  locale: string;
  items: AnyItem[];
}

export const packPath = (pack: PackName) => join(PACK_DIR, `${pack}.json`);
export const stagingPath = (pack: PackName) => join(STAGING_DIR, `${pack}.json`);

export function readPack(pack: PackName): PackFile {
  return JSON.parse(readFileSync(packPath(pack), "utf8")) as PackFile;
}

export function writePack(pack: PackName, data: PackFile) {
  writeFileSync(packPath(pack), `${JSON.stringify(data, null, 1)}\n`);
}

export function readStaged(pack: PackName): AnyItem[] {
  const file = stagingPath(pack);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AnyItem[]) : [];
}

export function writeStaged(pack: PackName, items: AnyItem[]) {
  mkdirSync(STAGING_DIR, { recursive: true });
  if (items.length) writeFileSync(stagingPath(pack), `${JSON.stringify(items, null, 1)}\n`);
  else rmSync(stagingPath(pack), { force: true });
}

/** One readable line per item, for terminal review. */
export function describe(pack: PackName, item: AnyItem): string {
  if (pack === "trivia") {
    const t = item as TriviaItem;
    return `[${t.id}] d${t.difficulty}  ${t.q}  →  ${t.answer}${t.emoji ? `  ${t.emoji}` : ""}`;
  }
  if (pack === "truth") {
    const t = item as TruthItem;
    return `[${t.id}] d${t.difficulty}  ${t.truth ? "TRUE " : "FALSE"}  ${t.statement}`;
  }
  if (pack === "categories") {
    const c = item as CategoryItem;
    return `[${c.id}] d${c.difficulty}  ${c.category}: ${c.members.join(", ")}  |  NOT: ${c.intruders.join(", ")}`;
  }
  const w = item as WordSet;
  return `[${w.id}] ${w.theme}: ${w.words.join(", ")}`;
}

export function loadEnv() {
  const file = join(ROOT, ".env.content");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]!]) process.env[m[1]!] = m[2].replace(/^["']|["']$/g, "");
  }
}
