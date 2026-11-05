"use client";

import { generateRound, initialMemory, type RoundSpec } from "@recall/engine";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { RoundView } from "@/components/rounds/RoundView";
import { TimerRing } from "@/components/game/TimerRing";
import { SymbolIcon } from "@/components/ui/icons";

const SHOWCASE_SEED = 20261023;
const ORDER = [
  "math",
  "trivia",
  "gonogo",
  "oddword",
  "edges",
  "trigger",
  "truth",
  "odd",
  "stroop",
  "words",
  "dots",
  "sequence",
  "curse",
  "simon",
  "recall",
];

/** First appearance of each round type in a fixed run, so the demo shows every kind of round. */
function showcase(): RoundSpec[] {
  let memory = initialMemory();
  const byType = new Map<string, RoundSpec>();
  for (let i = 1; i <= 120 && byType.size < ORDER.length; i++) {
    const g = generateRound(SHOWCASE_SEED, i, memory);
    memory = g.memory;
    if (!byType.has(g.spec.type) && !g.spec.trigger) byType.set(g.spec.type, g.spec);
  }
  return ORDER.flatMap((t) => (byType.has(t) ? [byType.get(t)!] : []));
}

const demoMs = (type: string) => (type === "sequence" ? 4200 : type === "dots" ? 3000 : 2600);

export function DemoPhone() {
  const specs = useMemo(() => showcase(), []);
  const [i, setI] = useState(0);
  const spec = specs[i % specs.length]!;

  useEffect(() => {
    const ms = demoMs(spec.type);
    const t = setTimeout(() => setI((x) => x + 1), ms);
    return () => clearTimeout(t);
  }, [i, spec.type]);

  return (
    <div className="relative mx-auto w-[290px] sm:w-[320px]">
      <div
        className="absolute -inset-10 rounded-[60px] bg-[radial-gradient(closest-side,rgba(255,43,214,0.35),transparent)] blur-2xl"
        aria-hidden
      />
      <div className="relative aspect-[9/18.5] overflow-hidden rounded-[44px] border border-white/15 bg-[#07071d] p-3 shadow-[0_40px_120px_-30px_rgba(34,230,255,0.5),inset_0_0_0_6px_rgba(255,255,255,0.03)]">
        <div className="absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <div className="flex h-full flex-col rounded-[34px] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(139,92,255,0.25),transparent)] pt-10">
          <div className="flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            <span>Endless</span>
            <span className="rounded-lg bg-cyan/10 px-2 py-1 font-display text-xs text-cyan ring-1 ring-cyan/40">R {spec.index}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-1 flex-col"
            >
              <div className="px-5 pt-4 text-center">
                <div className="font-display text-[11px] font-black tracking-[0.25em] text-amber">{spec.title}</div>
                <p className="mt-1 text-balance text-[13px] font-bold leading-snug text-white">{spec.prompt}</p>
              </div>
              <div className="pointer-events-none flex flex-1 items-center justify-center">
                <div className="relative aspect-square w-[90%]">
                  <TimerRing durationMs={demoMs(spec.type)} started running />
                  <div className="absolute inset-[16%] flex items-center justify-center" style={{ containerType: "size" }}>
                    <RoundView spec={spec} active reveal={false} hit={[]} wrongTarget={null} />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-center gap-2 pb-6 text-[10px] font-bold uppercase tracking-[0.25em] text-muted">
            <SymbolIcon id="bolt" size={12} /> Round types: 15
          </div>
        </div>
      </div>
    </div>
  );
}
