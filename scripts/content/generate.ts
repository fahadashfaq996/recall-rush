/**
 * Grows the content packs with an LLM, keeping only what survives validation and an independent fact-check.
 * New items go to scripts/content/staging/ first; nothing reaches the game until it is reviewed and applied.
 *
 *   pnpm content:generate trivia --count 40          # stage up to 40 new trivia questions
 *   pnpm content:generate categories --dry-run       # preview without staging
 *   pnpm content:generate truth --mock               # exercise the pipeline offline, no API key needed
 *   pnpm content:review trivia                       # read what's staged
 *   pnpm content:apply trivia --drop tv-1a2b3c4d     # keep the staged items (minus any you drop)
 *
 * Works with any OpenAI-compatible chat API. Settings come from `.env.content` at the repo root:
 *   AI_API_KEY=...                       required (unless --mock)
 *   AI_BASE_URL=https://api.deepseek.com  DeepSeek by default; OpenRouter or Qwen (DashScope) also work
 *   AI_MODEL=deepseek-chat                model that writes the items
 *   AI_VERIFY_MODEL=...                   optional second model for the fact-check (defaults to AI_MODEL)
 */
import { createHash } from "node:crypto";
import {
  validateCategory,
  validateTrivia,
  validateTruth,
  validateWordSet,
  type CategoryItem,
  type PackName,
  type TriviaItem,
  type TruthItem,
  type WordSet,
} from "../../packages/engine/src/content";
import { PACK_NAMES, describe, loadEnv, readPack, readStaged, stagingPath, writeStaged, type AnyItem } from "./lib";

const BATCH = 20;
/** Give up after this many batches fail in a row (bad key, provider outage). */
const MAX_FAILED_BATCHES = 3;

// ---------------------------------------------------------------------------
// Settings and arguments
// ---------------------------------------------------------------------------

function parseArgs() {
  const [pack, ...rest] = process.argv.slice(2);
  if (!pack || !PACK_NAMES.includes(pack as PackName)) {
    console.error(`Usage: pnpm content:generate <${PACK_NAMES.join("|")}> [--count N] [--dry-run] [--no-verify] [--mock]`);
    process.exit(1);
  }
  const countIdx = rest.indexOf("--count");
  return {
    pack: pack as PackName,
    count: countIdx >= 0 ? Math.max(1, Number(rest[countIdx + 1]) || 20) : 20,
    dryRun: rest.includes("--dry-run"),
    verify: !rest.includes("--no-verify"),
    mock: rest.includes("--mock"),
  };
}

// ---------------------------------------------------------------------------
// Model access
// ---------------------------------------------------------------------------

type Chat = (system: string, user: string, opts: { verify?: boolean; temperature: number }) => Promise<unknown>;

/** Running totals for the summary line, so each run shows what it cost. */
const usage = { calls: 0, inTokens: 0, outTokens: 0, cost: 0, ms: 0 };

function apiChat(): Chat {
  const key = process.env.AI_API_KEY;
  if (!key) {
    console.error("Set AI_API_KEY in .env.content (or run with --mock to try the pipeline offline).");
    process.exit(1);
  }
  const base = (process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "deepseek-chat";
  const verifyModel = process.env.AI_VERIFY_MODEL ?? model;
  console.log(`writer ${model}, fact-checker ${verifyModel} (${base})`);
  return async (system, user, { verify, temperature }) => {
    const started = Date.now();
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(300_000),
      body: JSON.stringify({
        model: verify ? verifyModel : model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // OpenRouter reports the dollar cost of each call when asked.
        ...(base.includes("openrouter.ai") ? { usage: { include: true } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`AI request failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    usage.calls++;
    usage.inTokens += data.usage?.prompt_tokens ?? 0;
    usage.outTokens += data.usage?.completion_tokens ?? 0;
    usage.cost += data.usage?.cost ?? 0;
    usage.ms += Date.now() - started;
    const text = data.choices?.[0]?.message?.content ?? "";
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  };
}

// ---------------------------------------------------------------------------
// Per-pack prompts, normalising and fact-checking
// ---------------------------------------------------------------------------

interface PackSpec<T extends AnyItem> {
  prefix: string;
  key(item: T): string;
  validate(item: T): string[];
  normalise(raw: Record<string, unknown>): Omit<T, "id">;
  writePrompt(count: number, examples: T[], avoid: string[]): string;
  /** Builds the fact-check request and decides, from the reply, which items survived. */
  checkPrompt(items: T[]): string;
  passed(items: T[], reply: unknown): T[];
}

const GAME_BRIEF =
  "You write content for Recall Rush, a fast mobile memory game played worldwide by teens and adults. " +
  "Each item is read in about two seconds, so keep it short, plain and unambiguous. Only include facts that are " +
  "true everywhere and not disputed; avoid politics, religion, brands, celebrities, gore and anything region-specific. " +
  "Players are worldwide, so never rely on one country's money, units, holidays, sports leagues, school systems or folklore. " +
  "Aim for 'oh, I didn't know that' moments over textbook definitions, and never write two items about the same fact. " +
  "Reply with JSON only.";

/** Shared fact-check rule: anything a reasonable expert could argue with gets thrown out. */
const STRICT =
  "Be strict: use null whenever the answer depends on region, culture, folklore, definitions or counting method, " +
  "is disputed by experts, or is only partly true. When in doubt, use null.";

/** Letter-count questions are checked exactly, which needs the word in plain capitals: 'dog' -> DOG. */
const capitaliseQuoted = (q: string) => q.replace(/['"‘’“”]([A-Za-z]+)['"‘’“”]/g, (_, w: string) => w.toUpperCase());

const upperWords = (v: unknown) => (Array.isArray(v) ? v.map((w) => String(w).trim().toUpperCase()) : []);
const asDifficulty = (v: unknown) => (v === 1 || v === 2 || v === 3 ? v : 2);
const list = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}`).join("\n");

const trivia: PackSpec<TriviaItem> = {
  prefix: "tv",
  key: (i) => i.q,
  validate: validateTrivia,
  normalise: (r) => ({
    q: capitaliseQuoted(String(r.q ?? "").trim()),
    answer: Number(r.answer),
    emoji: r.emoji ? String(r.emoji) : undefined,
    difficulty: asDifficulty(r.difficulty),
  }),
  writePrompt: (count, examples, avoid) =>
    `Write ${count} new trivia questions whose answer is a whole number from 0 to 10 (players answer by tapping that many times). ` +
    `Every answer MUST be 0-10; leave out any question whose answer is larger. Spread answers across 0-10, include some 0, 9 and 10. ` +
    `Questions must be 8-60 characters and start with "How many". Avoid anything where people could count differently ` +
    `(e.g. legs vs claws, team size on court vs roster). For letter counts, write the word in capitals: "the word MOON". ` +
    `Optionally add one matching emoji. difficulty: 1 = everyone knows, 2 = most people, 3 = tricky but well known.\n` +
    `Format: {"items":[{"q":"How many legs does a spider have?","answer":8,"emoji":"🕷️","difficulty":1}]}\n` +
    `Examples of the style:\n${JSON.stringify(examples.slice(0, 6))}\nDo not repeat any of these:\n${avoid.join("\n")}`,
  checkPrompt: (items) =>
    `Answer each question independently with a single whole number. ${STRICT}\n` +
    `Format: {"answers":[8,null,...]} in the same order.\n${list(items.map((i) => i.q))}`,
  passed: (items, reply) => {
    const answers = (reply as { answers?: unknown[] }).answers ?? [];
    return items.filter((item, i) => answers[i] === item.answer);
  },
};

const truth: PackSpec<TruthItem> = {
  prefix: "tf",
  key: (i) => i.statement,
  validate: validateTruth,
  normalise: (r) => ({ statement: String(r.statement ?? "").trim(), truth: r.truth === true, difficulty: asDifficulty(r.difficulty) }),
  writePrompt: (count, examples, avoid) =>
    `Write ${count} short statements (8-70 characters) that are clearly TRUE or clearly FALSE, about half each. ` +
    `Make them surprising and fun: popular myths that are false, and true facts that sound false. Mix topics (animals, space, ` +
    `the body, nature, science, geography, food). Skip trivial definitions like "A cube has six faces", and never write a ` +
    `true and a false version of the same fact. No trick wording, no "always/never" unless exact, no "mainly/mostly" claims ` +
    `that experts debate.\n` +
    `Format: {"items":[{"statement":"Bats are mammals.","truth":true,"difficulty":2}]}\n` +
    `Examples:\n${JSON.stringify(examples.slice(0, 6))}\nDo not repeat any of these:\n${avoid.join("\n")}`,
  checkPrompt: (items) =>
    `Judge each statement independently: true or false. ${STRICT}\n` +
    `Format: {"verdicts":[true,false,null,...]} in the same order.\n${list(items.map((i) => i.statement))}`,
  passed: (items, reply) => {
    const verdicts = (reply as { verdicts?: unknown[] }).verdicts ?? [];
    return items.filter((item, i) => verdicts[i] === item.truth);
  },
};

const categories: PackSpec<CategoryItem> = {
  prefix: "ct",
  key: (i) => i.category,
  validate: validateCategory,
  normalise: (r) => ({
    category: String(r.category ?? "")
      .trim()
      .toUpperCase(),
    members: upperWords(r.members),
    intruders: upperWords(r.intruders),
    difficulty: asDifficulty(r.difficulty),
  }),
  writePrompt: (count, examples, avoid) =>
    `Write ${count} new word categories for an "odd word out" round. Each has 6-8 members and 3-4 intruders. ` +
    `Intruders must clearly NOT belong but should be tempting (e.g. SPIDER for INSECTS, PARIS for COUNTRIES). ` +
    `Every word is a single common word in CAPITALS, at most 10 letters. Category names are at most 18 characters.\n` +
    `Format: {"items":[{"category":"INSECTS","members":["ANT","BEE","WASP","MOTH","FLY","BEETLE"],"intruders":["SPIDER","WORM","SCORPION"],"difficulty":3}]}\n` +
    `Examples:\n${JSON.stringify(examples.slice(0, 3))}\nDo not repeat these categories:\n${avoid.join(", ")}`,
  checkPrompt: (items) =>
    `For each category, list which of the given words truly belong to it. Be strict.\n` +
    `Format: {"belongs":[["ANT","BEE"],...]} in the same order.\n` +
    list(items.map((i) => `${i.category}: ${[...i.members, ...i.intruders].join(", ")}`)),
  passed: (items, reply) => {
    const belongs = ((reply as { belongs?: unknown[] }).belongs ?? []).map((b) => new Set(upperWords(b)));
    return items.filter((item, i) => {
      const yes = belongs[i];
      return yes !== undefined && item.members.every((m) => yes.has(m)) && item.intruders.every((x) => !yes.has(x));
    });
  },
};

const wordsets: PackSpec<WordSet> = {
  prefix: "ws",
  key: (i) => i.theme,
  validate: validateWordSet,
  normalise: (r) => ({
    theme: String(r.theme ?? "")
      .trim()
      .toUpperCase(),
    words: upperWords(r.words),
  }),
  writePrompt: (count, examples, avoid) =>
    `Write ${count} new themes for a word-memory round. Each theme has 9-10 distinct, common, concrete nouns in CAPITALS, ` +
    `at most 10 letters each, that all clearly fit the theme (players will confuse them with each other, which is the point).\n` +
    `Format: {"items":[{"theme":"BEACH","words":["SAND","WAVE","SHELL","TOWEL","CRAB","BUCKET","SURF","PALM","KITE"]}]}\n` +
    `Examples:\n${JSON.stringify(examples.slice(0, 2))}\nDo not repeat these themes:\n${avoid.join(", ")}`,
  checkPrompt: (items) =>
    `For each theme, list any words that do NOT clearly fit it or that most people would not know.\n` +
    `Format: {"misfits":[[],["WORD"],...]} in the same order.\n` +
    list(items.map((i) => `${i.theme}: ${i.words.join(", ")}`)),
  passed: (items, reply) => {
    const misfits = (reply as { misfits?: unknown[] }).misfits ?? [];
    return items.filter((_, i) => Array.isArray(misfits[i]) && (misfits[i] as unknown[]).length === 0);
  },
};

const SPECS: Record<PackName, PackSpec<AnyItem>> = {
  trivia: trivia as unknown as PackSpec<AnyItem>,
  truth: truth as unknown as PackSpec<AnyItem>,
  categories: categories as unknown as PackSpec<AnyItem>,
  wordsets: wordsets as unknown as PackSpec<AnyItem>,
};

// ---------------------------------------------------------------------------
// Offline mock, so the pipeline can be tried without an API key
// ---------------------------------------------------------------------------

function mockChat(pack: PackName): Chat {
  const samples: Record<PackName, unknown[]> = {
    trivia: [
      { q: "How many legs does a ladybug have?", answer: 6, emoji: "🐞", difficulty: 2 },
      { q: "How many letters are in the word ZEBRA?", answer: 6, difficulty: 1 }, // wrong: validator rejects
      { q: "How many sides does a nonagon have?", answer: 9, difficulty: 3 },
    ],
    truth: [
      { statement: "Owls can turn their heads very far.", truth: true, difficulty: 2 },
      { statement: "The Sun is a planet.", truth: false, difficulty: 1 },
      { statement: "x", truth: true, difficulty: 1 }, // too short: validator rejects
    ],
    categories: [
      {
        category: "BERRIES",
        members: ["STRAWBERRY", "BLUEBERRY", "RASPBERRY", "CRANBERRY", "BLACKBERRY"],
        intruders: ["CHERRY", "GRAPE", "PLUM"],
        difficulty: 3,
      },
    ],
    wordsets: [{ theme: "AIRPORT", words: ["GATE", "RUNWAY", "PILOT", "LUGGAGE", "TICKET", "TERMINAL", "TOWER", "JET", "PASSPORT"] }],
  };
  return async (_system, user, { verify }) => {
    if (!verify) return { items: samples[pack] };
    // Pretend the checker agrees with everything except the last item.
    if (pack === "trivia") return { answers: [6, 5, null] };
    if (pack === "truth") return { verdicts: [true, false, true] };
    if (pack === "categories") return { belongs: [["STRAWBERRY", "BLUEBERRY", "RASPBERRY", "CRANBERRY", "BLACKBERRY"]] };
    return { misfits: user.includes("AIRPORT") ? [[]] : [] };
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();
  const { pack, count, dryRun, verify, mock } = parseArgs();
  const spec = SPECS[pack];
  const chat = mock ? mockChat(pack) : apiChat();
  const data = readPack(pack);
  const staged = readStaged(pack);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existing = [...data.items, ...staged];
  const known = new Set(existing.map((i) => norm(spec.key(i))));

  const accepted: AnyItem[] = [];
  const stats = { generated: 0, invalid: 0, duplicate: 0, failedCheck: 0 };
  const maxBatches = Math.ceil(count / BATCH) + 2;
  let failures = 0;

  for (let b = 0; b < maxBatches && accepted.length < count; b++) {
    const want = Math.min(BATCH, count - accepted.length);
    try {
      const avoid = [...existing, ...accepted].map((i) => spec.key(i)).slice(-150);
      const reply = (await chat(GAME_BRIEF, spec.writePrompt(want, data.items, avoid), { temperature: 0.9 })) as { items?: unknown[] };
      const raw = Array.isArray(reply.items) ? reply.items : [];
      stats.generated += raw.length;

      const valid: AnyItem[] = [];
      for (const r of raw) {
        if (!r || typeof r !== "object") continue;
        const body = spec.normalise(r as Record<string, unknown>);
        const id = `${spec.prefix}-${createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 8)}`;
        const item = { id, ...body } as AnyItem;
        const errors = spec.validate(item);
        if (errors.length) {
          stats.invalid++;
          console.log(`  ✗ invalid: ${spec.key(item)} (${errors.join("; ")})`);
          continue;
        }
        const k = norm(spec.key(item));
        if (known.has(k)) {
          stats.duplicate++;
          continue;
        }
        known.add(k);
        valid.push(item);
      }

      let checked = valid;
      if (verify && valid.length) {
        const verdict = await chat("You are a careful fact-checker. Reply with JSON only.", spec.checkPrompt(valid), {
          verify: true,
          temperature: 0,
        });
        checked = spec.passed(valid, verdict);
        for (const item of valid.filter((v) => !checked.includes(v))) console.log(`  ✗ failed fact-check: ${spec.key(item)}`);
        stats.failedCheck += valid.length - checked.length;
      }
      accepted.push(...checked.slice(0, count - accepted.length));
      failures = 0;
      console.log(`batch ${b + 1}: kept ${checked.length} of ${raw.length} (total ${accepted.length}/${count})`);
    } catch (err) {
      failures++;
      console.error(`batch ${b + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
      if (failures >= MAX_FAILED_BATCHES) break;
    }
  }

  console.log(
    `\n${pack}: generated ${stats.generated}, invalid ${stats.invalid}, duplicates ${stats.duplicate}, failed fact-check ${stats.failedCheck}, accepted ${accepted.length}`,
  );

  if (usage.calls) {
    console.log(
      `usage: ${usage.calls} calls, ${usage.inTokens} in / ${usage.outTokens} out tokens, $${usage.cost.toFixed(4)}, ${(usage.ms / usage.calls / 1000).toFixed(1)}s per call`,
    );
  }
  if (dryRun || mock) {
    for (const item of accepted) console.log(`  ✓ ${describe(pack, item)}`);
    console.log(dryRun ? "\nDry run: nothing staged." : "\nMock run: nothing staged.");
    return;
  }
  writeStaged(pack, [...staged, ...accepted]);
  console.log(`Staged ${accepted.length} (now ${staged.length + accepted.length} waiting) in ${stagingPath(pack)}`);
  console.log(`Review: pnpm content:review ${pack}    Keep: pnpm content:apply ${pack}`);
  if (accepted.length === 0 && failures > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
