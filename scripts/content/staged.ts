/**
 * Review or apply generated content waiting in scripts/content/staging/.
 *
 *   pnpm content:review                        # everything staged
 *   pnpm content:review trivia --sample 10     # a random sample from one pack
 *   pnpm content:apply                         # keep everything staged
 *   pnpm content:apply truth --drop tf-1a2b3c4d,tf-9f8e7d6c
 *   pnpm content:discard categories            # throw a staged batch away
 */
import { PACKS, validatePacks, type ContentPacks, type PackName } from "../../packages/engine/src/content";
import { PACK_NAMES, describe, readPack, readStaged, writePack, writeStaged, type AnyItem } from "./lib";

const [command, ...args] = process.argv.slice(2);
const packs = args.filter((a) => PACK_NAMES.includes(a as PackName)) as PackName[];
const selected = packs.length ? packs : PACK_NAMES;
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function review() {
  const sample = Number(flag("--sample")) || 0;
  for (const pack of selected) {
    const items = readStaged(pack);
    if (!items.length) continue;
    const shown = sample ? [...items].sort(() => Math.random() - 0.5).slice(0, sample) : items;
    console.log(`\n${pack.toUpperCase()} — ${items.length} staged${sample ? `, showing ${shown.length}` : ""}`);
    for (const item of shown) console.log(`  ${describe(pack, item)}`);
  }
}

function apply() {
  const drop = new Set((flag("--drop") ?? "").split(",").filter(Boolean));
  const next: ContentPacks = { ...PACKS };
  const plan: { pack: PackName; keep: AnyItem[] }[] = [];
  for (const pack of selected) {
    const keep = readStaged(pack).filter((i) => !drop.has(i.id));
    if (!keep.length) continue;
    (next[pack] as AnyItem[]) = [...(PACKS[pack] as AnyItem[]), ...keep];
    plan.push({ pack, keep });
  }
  if (!plan.length) return console.log("Nothing staged.");
  // Validate the packs as they would ship before touching any file.
  const issues = validatePacks(next);
  if (issues.length) {
    console.error("Not applied, the merged packs have problems:");
    for (const i of issues) console.error(`  ${i.pack}/${i.id}: ${i.errors.join("; ")}`);
    process.exit(1);
  }
  for (const { pack, keep } of plan) {
    const data = readPack(pack);
    data.items.push(...keep);
    writePack(pack, data);
    writeStaged(pack, []);
    console.log(`${pack}: added ${keep.length} (now ${data.items.length})`);
  }
  if (drop.size) console.log(`dropped ${drop.size} item(s)`);
  console.log("Run `pnpm test` to re-check everything.");
}

function discard() {
  for (const pack of selected) writeStaged(pack, []);
  console.log(`Discarded staged ${selected.join(", ")}.`);
}

if (command === "review") review();
else if (command === "apply") apply();
else if (command === "discard") discard();
else {
  console.error("Usage: tsx scripts/content/staged.ts <review|apply|discard> [pack...] [--sample N] [--drop id,id]");
  process.exit(1);
}
