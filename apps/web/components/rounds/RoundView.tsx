"use client";

import { COLOR_LABEL, type ColorName, type DotShape, type RoundSpec, type RoundView as View, type SymbolId } from "@recall/engine";
import type { CSSProperties, ReactNode } from "react";
import { COLOR_HEX, glow } from "@/lib/palette";
import { ShapeIcon, SymbolIcon, polygonPoints } from "@/components/ui/icons";

/**
 * Round visuals. Every size is in container units (cqmin), so a round fills whatever square box it is placed in:
 * the inside of the timer ring in the game, a phone mockup on the home page, or a card in the dev gallery.
 * The parent must set `container-type: size`.
 */
export interface RoundViewProps {
  spec: RoundSpec;
  /** True once the task phase has started (stimuli and their timed animations begin here). */
  active: boolean;
  /** True on the fail screen: show the correct answer. */
  reveal: boolean;
  hit: string[];
  wrongTarget: string | null;
}

export function RoundView(props: RoundViewProps) {
  const { spec } = props;
  const v = spec.view;
  switch (v.type) {
    case "gonogo":
      return <GoNoGo view={v} {...props} />;
    case "math":
      return <MathRound view={v} {...props} />;
    case "edges":
      return <Edges view={v} {...props} />;
    case "simon":
      return <Simon view={v} {...props} />;
    case "dots":
      return <Dots view={v} {...props} />;
    case "trigger":
      return <Trigger view={v} {...props} />;
    case "odd":
      return <Odd view={v} {...props} />;
    case "stroop":
      return <Stroop view={v} {...props} />;
    case "memo":
      return <Memo view={v} {...props} />;
    case "recall":
      return <Recall view={v} {...props} />;
    case "sequence":
      return <Sequence view={v} {...props} />;
    case "curse":
      return <Curse view={v} {...props} />;
    case "trivia":
      return <Trivia view={v} {...props} />;
    case "truth":
      return <Truth view={v} {...props} />;
    case "oddword":
      return <OddWord view={v} {...props} />;
    case "words":
      return <Words view={v} {...props} />;
  }
}

type P<T extends View["type"]> = RoundViewProps & { view: Extract<View, { type: T }> };

const cq = (n: number) => `${n}cqmin`;
/** Font size that keeps a single line of display text inside the box (the display font is wide). */
const fitText = (text: string, max: number, budget = 105) => cq(Math.min(max, budget / Math.max(text.length, 1)));

function Pop({ active, children, className = "" }: { active: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`transition-all duration-200 ease-out ${active ? "scale-100 opacity-100" : "scale-75 opacity-0"} ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-bold uppercase tracking-[0.3em] text-muted" style={{ fontSize: cq(4.4) }}>
      {children}
    </div>
  );
}

function GoNoGo({ view, active }: P<"gonogo">) {
  return (
    <Pop active={active}>
      <ShapeIcon kind={view.stimulus.shape} color={COLOR_HEX[view.stimulus.color]} size={cq(70)} />
    </Pop>
  );
}

function MathRound({ view, active }: P<"math">) {
  return (
    <Pop active={active} className="text-center">
      <div
        className="whitespace-nowrap font-display font-black leading-none tracking-tight neon-text-cyan"
        style={{ fontSize: fitText(view.expression, 26) }}
      >
        {view.expression}
      </div>
      {!view.inline && (
        <div className="mt-[4cqmin] font-display font-extrabold text-muted" style={{ fontSize: cq(12) }}>
          = ?
        </div>
      )}
    </Pop>
  );
}

function Edges({ view, active }: P<"edges">) {
  const color = view.star ? "#ffc43d" : "#b6ff3b";
  return (
    <Pop active={active}>
      <svg viewBox="0 0 100 100" className="overflow-visible" style={{ width: cq(86), height: cq(86) }} aria-label="shape">
        <polygon
          key={active ? "on" : "off"}
          points={polygonPoints(view.sides, view.star, view.rotation)}
          pathLength={1}
          className={active ? "draw-stroke" : ""}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={2.4}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 14px ${color}aa)` }}
        />
      </svg>
    </Pop>
  );
}

function Simon({ view, active }: P<"simon">) {
  return (
    <Pop active={active} className="text-center">
      {view.lead && (
        <div className="mb-[3cqmin] font-display font-extrabold neon-text-magenta" style={{ fontSize: cq(8.5) }}>
          {view.lead}
        </div>
      )}
      <div
        className="text-balance font-display font-black uppercase leading-[1.05] text-white"
        style={{ fontSize: cq(view.command.length > 9 ? 12 : 16) }}
      >
        {view.command}
      </div>
    </Pop>
  );
}

const DOT_RADIUS: Record<DotShape, string> = { circle: "9999px", square: "22%", diamond: "18%" };

function Dots({ view, active, reveal }: P<"dots">) {
  return (
    <div className="relative rounded-[8cqmin] border border-line bg-white/[0.03]" style={{ width: cq(100), height: cq(100) }}>
      {active &&
        view.dots.map((d, i) => (
          <span
            key={`${i}-${reveal}`}
            className={`absolute h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 ${view.shape === "diamond" ? "rotate-45" : ""} ${reveal ? "" : "dot-flash"}`}
            style={{
              left: `${d.x * 100}%`,
              top: `${d.y * 100}%`,
              borderRadius: DOT_RADIUS[view.shape],
              background: COLOR_HEX[d.color],
              boxShadow: glow(COLOR_HEX[d.color], 0.7),
              animationDuration: `${view.flashMs}ms`,
            }}
          />
        ))}
      {active && !reveal && (
        <div
          className="absolute inset-0 flex items-center justify-center font-display font-black text-muted opacity-0"
          style={{ fontSize: cq(30), animation: `fade-in 0.3s ease-out ${view.flashMs}ms forwards` }}
        >
          ?
        </div>
      )}
      <style>{`@keyframes fade-in { to { opacity: 1; } }`}</style>
    </div>
  );
}

function Trigger({ view, active }: P<"trigger">) {
  return (
    <Pop active={active} className="flex flex-col items-center gap-[3cqmin] text-center">
      <Label>If you see</Label>
      <SymbolIcon id={view.symbol} size={cq(36)} className="float-y" />
      <Label>next round</Label>
      <div
        className={`rounded-[4cqmin] px-[5cqmin] py-[2.5cqmin] font-display font-black leading-tight ${
          view.action === "freeze" ? "bg-danger/15 neon-text-danger ring-1 ring-danger/50" : "bg-lime/10 neon-text-lime ring-1 ring-lime/50"
        }`}
        style={{ fontSize: cq(7.5) }}
      >
        {view.action === "freeze" ? "FREEZE. DON'T TAP" : "TAP THE SYMBOL"}
      </div>
    </Pop>
  );
}

function Odd({ view, active, reveal, wrongTarget }: P<"odd">) {
  const n = view.cols * view.cols;
  return (
    <Pop active={active}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${view.cols}, minmax(0, 1fr))`, width: cq(100), gap: cq(2.6) }}>
        {Array.from({ length: n }, (_, i) => {
          const odd = i === view.oddIndex;
          const hue = odd ? view.hue + view.delta : view.hue;
          const light = odd ? 58 + view.lightDelta / 2 : 58;
          const id = `tile-${i}`;
          return (
            <button
              key={i}
              type="button"
              data-target={id}
              aria-label={`Tile ${i + 1}`}
              className={`aspect-square rounded-[18%] transition-transform active:scale-90 ${reveal && odd ? "ring-4 ring-white" : ""} ${
                wrongTarget === id ? "ring-4 ring-danger" : ""
              }`}
              style={{ background: `hsl(${hue} 85% ${light}%)`, boxShadow: `0 0 18px hsl(${view.hue} 90% 55% / 0.35)` }}
            />
          );
        })}
      </div>
    </Pop>
  );
}

function Stroop({ view, active }: P<"stroop">) {
  const ink = COLOR_HEX[view.ink];
  const word = COLOR_LABEL[view.word];
  return (
    <Pop active={active}>
      <div
        className="whitespace-nowrap font-display font-black tracking-tight"
        style={{ color: ink, textShadow: glow(ink, 0.8), fontSize: fitText(word, 24) }}
      >
        {word}
      </div>
    </Pop>
  );
}

/** A remembered value. `size` is the box it should fill, in cqmin. */
function MemoValueView({ kind, value, size }: { kind: "number" | "symbol" | "color"; value: string; size: number }) {
  if (kind === "number") {
    return (
      <span className="font-display font-black leading-none neon-text-amber" style={{ fontSize: cq(size * 0.8) }}>
        {value}
      </span>
    );
  }
  if (kind === "symbol") return <SymbolIcon id={value as SymbolId} size={cq(size * 0.85)} />;
  const hex = COLOR_HEX[value as ColorName];
  return (
    <span
      className="block rounded-full"
      style={{ width: cq(size * 0.8), height: cq(size * 0.8), background: hex, boxShadow: glow(hex, size > 40 ? 1 : 0.6) }}
      aria-label={value}
    />
  );
}

function Memo({ view, active }: P<"memo">) {
  return (
    <Pop active={active} className="flex flex-col items-center gap-[5cqmin]">
      <Label>Remember this</Label>
      <MemoValueView kind={view.memo.kind} value={String(view.memo.value)} size={62} />
    </Pop>
  );
}

function Recall({ view, active, reveal, wrongTarget, spec }: P<"recall">) {
  if (view.mode === "count") {
    return (
      <Pop active={active} className="text-center">
        <div className="font-display font-black leading-none neon-text-amber" style={{ fontSize: cq(48) }}>
          ?
        </div>
        <div className="mt-[3cqmin] font-semibold text-muted" style={{ fontSize: cq(5.5) }}>
          The number from {view.roundsAgo} rounds ago
        </div>
      </Pop>
    );
  }
  const answer = spec.expected.kind === "pick" ? spec.expected.id : "";
  if (view.memoKind === "words") {
    return (
      <Pop active={active}>
        <WordButtons words={view.options} idPrefix="opt" correctId={reveal ? answer : null} wrongTarget={wrongTarget} />
      </Pop>
    );
  }
  const cols = view.options.length > 4 ? 3 : 2;
  const cell = cols === 3 ? 30 : 46;
  return (
    <Pop active={active}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: cq(100), gap: cq(4) }}>
        {view.options.map((opt, i) => {
          const id = `opt-${i}`;
          return (
            <button
              key={id}
              type="button"
              data-target={id}
              className={`glass flex aspect-square items-center justify-center rounded-[14%] transition-transform active:scale-90 ${
                reveal && answer === id ? "ring-4 ring-success" : ""
              } ${wrongTarget === id ? "ring-4 ring-danger" : ""}`}
            >
              <MemoValueView kind={view.memoKind as "number" | "symbol" | "color"} value={opt} size={cell * 0.62} />
            </button>
          );
        })}
      </div>
    </Pop>
  );
}

function Sequence({ view, active, reveal, hit, wrongTarget }: P<"sequence">) {
  const n = view.cols * view.cols;
  return (
    <Pop active={active}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${view.cols}, minmax(0, 1fr))`, width: cq(100), gap: cq(3.2) }}>
        {Array.from({ length: n }, (_, i) => {
          const id = `cell-${i}`;
          const steps = view.order.flatMap((c, k) => (c === i ? [k] : []));
          const tapped = hit.filter((h) => h === id).length;
          return (
            <button
              key={i}
              type="button"
              data-target={id}
              aria-label={`Tile ${i + 1}`}
              className={`relative aspect-square overflow-hidden rounded-[18%] border border-white/10 bg-white/[0.06] transition-transform active:scale-90 ${
                wrongTarget === id ? "ring-4 ring-danger" : ""
              }`}
            >
              {active &&
                steps.map((k) => (
                  <span
                    key={k}
                    className="cell-light absolute inset-0 rounded-[18%]"
                    style={{ "--step": `${Math.round(view.stepMs * 0.8)}ms`, animationDelay: `${k * view.stepMs}ms` } as CSSProperties}
                  />
                ))}
              {tapped > 0 && (
                <span key={tapped} className="cell-light absolute inset-0 rounded-[18%]" style={{ "--step": "260ms" } as CSSProperties} />
              )}
              {reveal && steps.length > 0 && (
                <span
                  className="absolute inset-0 flex items-center justify-center font-display font-black text-cyan"
                  style={{ fontSize: cq(6) }}
                >
                  {steps.map((k) => k + 1).join("·")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Pop>
  );
}

const CURSE_COPY: Record<string, { name: string; rule: string }> = {
  plus1: { name: "+1", rule: "Tap ONE MORE than the answer" },
  minus1: { name: "−1", rule: "Tap ONE LESS than the answer" },
  double: { name: "×2", rule: "Tap TWICE the answer" },
  flip: { name: "FLIP", rule: "On tap-or-freeze rounds, do the OPPOSITE" },
};

function Curse({ view, active }: P<"curse">) {
  const copy = CURSE_COPY[view.curse]!;
  return (
    <Pop active={active} className="flex flex-col items-center gap-[3cqmin] text-center">
      <SymbolIcon id="skull" size={cq(20)} color="#b44dff" className="float-y" />
      <div className="glitch font-display font-black leading-none text-white" data-text={copy.name} style={{ fontSize: cq(24) }}>
        {copy.name}
      </div>
      <div className="text-balance font-display font-extrabold leading-snug text-violet-200" style={{ fontSize: cq(6.5) }}>
        {copy.rule}
      </div>
      <Label>for {view.rounds} rounds</Label>
    </Pop>
  );
}

/** A stack of tappable word tiles, used by Odd Word Out and word recall. */
function WordButtons({
  words,
  idPrefix,
  correctId,
  wrongTarget,
}: {
  words: string[];
  idPrefix: string;
  correctId: string | null;
  wrongTarget: string | null;
}) {
  return (
    <div className="grid grid-cols-1" style={{ width: cq(100), gap: cq(3) }}>
      {words.map((word, i) => {
        const id = `${idPrefix}-${i}`;
        return (
          <button
            key={id}
            type="button"
            data-target={id}
            className={`glass flex items-center justify-center rounded-[5cqmin] font-display font-black tracking-wide text-white transition-transform active:scale-95 ${
              correctId === id ? "ring-4 ring-success" : ""
            } ${wrongTarget === id ? "ring-4 ring-danger" : ""}`}
            style={{ height: cq(20.5), fontSize: fitText(word, 9, 70) }}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}

function Trivia({ view, active, reveal }: P<"trivia">) {
  return (
    <Pop active={active} className="flex flex-col items-center text-center">
      {view.emoji && (
        <div className="mb-[4cqmin] leading-none" style={{ fontSize: cq(24), filter: "drop-shadow(0 0 18px rgb(255 255 255 / 0.35))" }}>
          {view.emoji}
        </div>
      )}
      <div
        className="text-balance font-display font-extrabold leading-snug text-white"
        style={{ fontSize: cq(view.question.length > 40 ? 7.2 : 8.5) }}
      >
        {view.question}
      </div>
      {reveal && (
        <div className="mt-[3cqmin] font-display font-black neon-text-lime" style={{ fontSize: cq(16) }}>
          = {view.answer}
        </div>
      )}
    </Pop>
  );
}

function Truth({ view, active, reveal }: P<"truth">) {
  return (
    <Pop active={active} className="flex flex-col items-center text-center">
      <div
        className="glass text-balance rounded-[6cqmin] font-display font-extrabold leading-snug text-white"
        style={{ fontSize: cq(view.statement.length > 40 ? 7.5 : 8.8), padding: `${cq(6)} ${cq(6)}` }}
      >
        {view.statement}
      </div>
      {reveal && (
        <div
          className={`mt-[4cqmin] font-display font-black ${view.truth ? "neon-text-lime" : "neon-text-danger"}`}
          style={{ fontSize: cq(11) }}
        >
          {view.truth ? "TRUE" : "FALSE"}
        </div>
      )}
    </Pop>
  );
}

function OddWord({ view, active, reveal, wrongTarget }: P<"oddword">) {
  return (
    <Pop active={active} className="flex flex-col items-center">
      <WordButtons words={view.words} idPrefix="word" correctId={reveal ? `word-${view.intruderIndex}` : null} wrongTarget={wrongTarget} />
      {reveal && (
        <div className="mt-[3cqmin]">
          <Label>The rest are {view.category}</Label>
        </div>
      )}
    </Pop>
  );
}

function Words({ view, active }: P<"words">) {
  return (
    <Pop active={active} className="flex flex-col items-center text-center">
      <Label>Remember these words</Label>
      <div className="my-[4cqmin] flex flex-col" style={{ gap: cq(2.5) }}>
        {view.words.map((word, i) => (
          <div
            key={word}
            className="font-display font-black leading-none neon-text-amber"
            style={{
              fontSize: fitText(word, view.words.length > 3 ? 11.5 : 13.5, 88),
              animation: `word-in 0.35s ease-out ${i * 120}ms both`,
            }}
          >
            {word}
          </div>
        ))}
      </div>
      <Label>Theme: {view.theme}</Label>
      <style>{`@keyframes word-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </Pop>
  );
}
