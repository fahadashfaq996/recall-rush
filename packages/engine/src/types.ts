export type RoundTypeId =
  | "gonogo"
  | "math"
  | "edges"
  | "simon"
  | "dots"
  | "trigger"
  | "odd"
  | "stroop"
  | "memo"
  | "recall"
  | "sequence"
  | "curse"
  | "trivia"
  | "truth"
  | "oddword"
  | "words";

/** Rounds that only hand the player a rule or something to remember. */
export const INFO_TYPES: readonly RoundTypeId[] = ["trigger", "memo", "curse", "words"];

export type ColorName = "red" | "green" | "blue" | "yellow" | "purple" | "cyan";
export type SymbolId = "star" | "heart" | "bolt" | "diamond" | "moon" | "skull" | "crown" | "flame";
export type ShapeKind = "circle" | "square" | "triangle";
export type DotShape = "circle" | "square" | "diamond";

/** Where a round sits on the difficulty curve. See difficulty.ts for the model. */
export interface Difficulty {
  index: number;
  /** 0-based 10-round stage. */
  stage: number;
  /** 0-9 position inside the stage. */
  pos: number;
  /** Stage-wide level cap for type ladders (0..MAX_LEVEL). */
  level: number;
  /** Multiplier on thinking/reaction time (reading time is never sped up). */
  speed: number;
  /** This round starts a faster speed step. */
  speedUp: boolean;
  /** Round x0 of a stage: a harder familiar round worth double points. */
  boss: boolean;
  recallGap: number;
  maxCurses: number;
}

/** What counts as a correct answer for a round. */
export type Expected =
  /** Tap the zone exactly `n` times. `gate` rounds only ever ask for 0 or 1 taps and pass on the first tap. */
  | { kind: "count"; n: number; gate: boolean }
  /** Tap these targets in this order. */
  | { kind: "sequence"; ids: string[] }
  /** Tap this one target. */
  | { kind: "pick"; id: string };

export type RoundView =
  | { type: "gonogo"; rule: { color: ColorName; shape?: ShapeKind; negated: boolean }; stimulus: { color: ColorName; shape: ShapeKind } }
  | { type: "math"; expression: string; /** The expression already contains its own "?" */ inline: boolean }
  | { type: "edges"; sides: number; star: boolean; rotation: number }
  | { type: "simon"; simon: boolean; taps: number; /** "Simon says:", a trick look-alike, or null */ lead: string | null; command: string }
  | { type: "dots"; dots: { x: number; y: number; color: ColorName }[]; only?: ColorName; flashMs: number; shape: DotShape }
  | { type: "trigger"; symbol: SymbolId; action: TriggerAction }
  | { type: "odd"; cols: number; hue: number; delta: number; lightDelta: number; oddIndex: number }
  | { type: "stroop"; word: ColorName; ink: ColorName; askInk: boolean; target: ColorName }
  | { type: "memo"; memo: Exclude<MemoValue, { kind: "words" }> }
  | { type: "recall"; memoKind: MemoValue["kind"]; mode: "pick" | "count"; options: string[]; roundsAgo: number; askNotShown?: boolean }
  | { type: "sequence"; cols: number; order: number[]; stepMs: number }
  | { type: "curse"; curse: CurseId; rounds: number }
  | { type: "trivia"; question: string; emoji?: string; answer: number }
  | { type: "truth"; statement: string; truth: boolean; askTrue: boolean }
  | { type: "oddword"; category: string; words: string[]; intruderIndex: number }
  | { type: "words"; words: string[]; theme: string };

export type TriggerAction = "freeze" | "tapSymbol";

export type MemoValue =
  | { kind: "number"; value: number }
  | { kind: "symbol"; value: SymbolId }
  | { kind: "color"; value: ColorName }
  /** A list of words; `setId` points at the word set the look-alike distractors come from. */
  | { kind: "words"; value: string[]; setId: string };

export type CurseId = "plus1" | "minus1" | "double" | "flip";

export interface ActiveCurse {
  id: CurseId;
  /** First and last round index the curse applies to (inclusive). */
  from: number;
  until: number;
}

/** A symbol shown on a round because of an earlier trigger rule. */
export interface TriggerOverlay {
  symbol: SymbolId;
  /** True when it's the symbol the rule named; false for a look-alike decoy. */
  matches: boolean;
  action: TriggerAction;
}

export interface RoundSpec {
  index: number;
  type: RoundTypeId;
  /** Short headline for the instruction card, e.g. "COUNT THE EDGES". */
  title: string;
  /** Instruction line shown during the round. */
  prompt: string;
  introMs: number;
  durationMs: number;
  /** Taps before this many ms into the task are ignored (e.g. while a sequence is playing). */
  inputFromMs: number;
  /** Whether a Done button is offered (count rounds that can't end on their own). */
  allowDone: boolean;
  /** Answer before curses or triggers changed it. */
  baseExpected: Expected;
  expected: Expected;
  view: RoundView;
  trigger?: TriggerOverlay;
  /** Curses that changed this round's answer. */
  appliedCurses: CurseId[];
  /** Number of curses active during this round (the HUD shows a chip, not the rule). */
  activeCurseCount: number;
  /** First time this type appears in the run. */
  debut: boolean;
  /** Difficulty-curve markers the UI announces. */
  boss: boolean;
  speedUp: boolean;
  /** Speed multiplier for this round, e.g. 1.4. */
  speed: number;
  /** Player-facing level: the 1-based stage. */
  level: number;
  /** This type's own ladder level for this round. */
  typeLevel: number;
}

export interface Memo {
  value: MemoValue;
  storedAt: number;
  dueAt: number;
}

export interface PendingTrigger {
  symbol: SymbolId;
  action: TriggerAction;
  at: number;
}

export interface MemoryState {
  memo?: Memo;
  trigger?: PendingTrigger;
  curses: ActiveCurse[];
  lastCurseAt: number;
  recentTypes: RoundTypeId[];
  /** How many times each type has appeared so far: drives debuts and each type's difficulty ladder. */
  counts: Partial<Record<RoundTypeId, number>>;
}

export interface TapEvent {
  /** ms since the task phase started. */
  t: number;
  /** "zone" for the main tap area, "done" for the Done button, or a target id. */
  target: string;
}

export type RoundStatus =
  { state: "pending"; count: number } | { state: "pass"; atMs: number } | { state: "fail"; atMs: number; reason: FailReason };

export type FailReason = "wrong-tap" | "too-many" | "too-few" | "timeout" | "tapped-on-no";

export interface RoundLog {
  index: number;
  taps: TapEvent[];
}
