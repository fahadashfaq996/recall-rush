import { hashString } from "../rng";
import categories from "./packs/en/categories.json";
import trivia from "./packs/en/trivia.json";
import truth from "./packs/en/truth.json";
import wordsets from "./packs/en/wordsets.json";
import type { CategoryItem, ContentPacks, TriviaItem, TruthItem, WordSet } from "./types";

export * from "./types";
export * from "./validate";

export const PACKS: ContentPacks = {
  trivia: trivia.items as TriviaItem[],
  truth: truth.items as TruthItem[],
  categories: categories.items as CategoryItem[],
  wordsets: wordsets.items as WordSet[],
};

/** Bump when round generation or judging changes in a way that would replay old runs differently. */
const ENGINE_REVISION = "5";

/**
 * Identifies the exact rules and content a run was played with. The server only ranks a run if the client
 * played it with the same version, because changing content changes which rounds a seed produces.
 */
export const RULES_VERSION = `${ENGINE_REVISION}.${hashString(JSON.stringify(PACKS)).toString(36)}`;
