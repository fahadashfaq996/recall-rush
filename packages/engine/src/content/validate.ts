import type { CategoryItem, ContentPacks, TriviaItem, TruthItem, WordSet } from "./types";

/** Display words: capital letters, at most 10 characters so they fit a tile. */
const WORD = /^[A-Z][A-Z' -]{0,9}$/;
const MAX_ANSWER = 10;

const isDifficulty = (d: unknown) => d === 1 || d === 2 || d === 3;
const dupes = (items: string[]) => items.filter((x, i) => items.indexOf(x) !== i);

export function validateTrivia(item: TriviaItem): string[] {
  const errors: string[] = [];
  if (typeof item.q !== "string" || item.q.length < 8 || item.q.length > 60) errors.push("question must be 8-60 characters");
  if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > MAX_ANSWER)
    errors.push(`answer must be a whole number 0-${MAX_ANSWER}`);
  if (item.emoji !== undefined && (typeof item.emoji !== "string" || [...item.emoji].length > 4))
    errors.push("emoji must be at most one emoji");
  if (!isDifficulty(item.difficulty)) errors.push("difficulty must be 1, 2 or 3");
  // Letter-count questions can be checked exactly.
  const letters = item.q.match(/letters (?:are )?in (?:the word )?([A-Z]+)\b/);
  if (letters?.[1] && letters[1].length !== item.answer) errors.push(`${letters[1]} has ${letters[1].length} letters, not ${item.answer}`);
  return errors;
}

export function validateTruth(item: TruthItem): string[] {
  const errors: string[] = [];
  if (typeof item.statement !== "string" || item.statement.length < 8 || item.statement.length > 70)
    errors.push("statement must be 8-70 characters");
  if (typeof item.truth !== "boolean") errors.push("truth must be true or false");
  if (!isDifficulty(item.difficulty)) errors.push("difficulty must be 1, 2 or 3");
  return errors;
}

export function validateCategory(item: CategoryItem): string[] {
  const errors: string[] = [];
  if (!/^[A-Z][A-Z -]{2,17}$/.test(item.category ?? "")) errors.push("category must be 3-18 capital letters");
  if (!Array.isArray(item.members) || item.members.length < 4) errors.push("needs at least 4 members");
  if (!Array.isArray(item.intruders) || item.intruders.length < 3) errors.push("needs at least 3 intruders");
  const words = [...(item.members ?? []), ...(item.intruders ?? [])];
  for (const w of words) if (!WORD.test(w)) errors.push(`"${w}" is not a valid display word`);
  for (const w of dupes(words)) errors.push(`"${w}" appears twice`);
  if (!isDifficulty(item.difficulty)) errors.push("difficulty must be 1, 2 or 3");
  return errors;
}

export function validateWordSet(item: WordSet): string[] {
  const errors: string[] = [];
  if (!/^[A-Z][A-Z -]{2,17}$/.test(item.theme ?? "")) errors.push("theme must be 3-18 capital letters");
  if (!Array.isArray(item.words) || item.words.length < 8) errors.push("needs at least 8 words");
  for (const w of item.words ?? []) if (!WORD.test(w)) errors.push(`"${w}" is not a valid display word`);
  for (const w of dupes(item.words ?? [])) errors.push(`"${w}" appears twice`);
  return errors;
}

export interface PackIssue {
  pack: keyof ContentPacks;
  id: string;
  errors: string[];
}

/** Every problem across all packs, including duplicate ids and duplicate questions. Empty means shippable. */
export function validatePacks(packs: ContentPacks): PackIssue[] {
  const issues: PackIssue[] = [];
  const check = <T extends { id: string }>(pack: keyof ContentPacks, items: T[], fn: (item: T) => string[], key: (item: T) => string) => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    for (const item of items) {
      const errors = fn(item);
      if (!item.id || seenIds.has(item.id)) errors.push(`duplicate or missing id "${item.id}"`);
      const k = key(item)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (seenKeys.has(k)) errors.push("duplicate content");
      seenIds.add(item.id);
      seenKeys.add(k);
      if (errors.length) issues.push({ pack, id: item.id, errors });
    }
  };
  check("trivia", packs.trivia, validateTrivia, (i) => i.q);
  check("truth", packs.truth, validateTruth, (i) => i.statement);
  check("categories", packs.categories, validateCategory, (i) => i.category);
  check("wordsets", packs.wordsets, validateWordSet, (i) => i.theme);
  return issues;
}
