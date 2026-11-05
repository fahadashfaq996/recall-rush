/**
 * Content packs: text-based puzzles for the knowledge and word rounds. They can be written by hand or generated
 * in bulk by an LLM (see scripts/content), but every pack must pass `validatePacks` before it ships, and packs
 * are bundled with the engine so rounds stay instant and replayable on the server.
 */

/** 1 = everyone knows it, 2 = most people, 3 = a bit tricky. Harder items unlock later in a run. */
export type ContentDifficulty = 1 | 2 | 3;

/** A question whose answer is a small number, answered by tapping that many times. */
export interface TriviaItem {
  id: string;
  q: string;
  answer: number;
  emoji?: string;
  difficulty: ContentDifficulty;
}

/** A short statement that is clearly true or clearly false. */
export interface TruthItem {
  id: string;
  statement: string;
  truth: boolean;
  difficulty: ContentDifficulty;
}

/** Words that belong to a category, plus words that look like they might but don't. */
export interface CategoryItem {
  id: string;
  category: string;
  members: string[];
  intruders: string[];
  difficulty: ContentDifficulty;
}

/** Words on one theme. Word-memory rounds show some and use the rest as look-alike distractors. */
export interface WordSet {
  id: string;
  theme: string;
  words: string[];
}

export interface ContentPacks {
  trivia: TriviaItem[];
  truth: TruthItem[];
  categories: CategoryItem[];
  wordsets: WordSet[];
}

export type PackName = keyof ContentPacks;
