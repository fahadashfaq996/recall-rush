"use client";

import { generateRound, initialMemory, type RoundSpec } from "@recall/engine";
import { useMemo, useState } from "react";
import { TimerRing } from "@/components/game/TimerRing";
import { RoundView } from "@/components/rounds/RoundView";

function firstOfEachType(seed: number): RoundSpec[] {
  let memory = initialMemory();
  const found = new Map<string, RoundSpec>();
  for (let i = 1; i <= 200; i++) {
    const g = generateRound(seed, i, memory);
    memory = g.memory;
    const key = g.spec.type + (g.spec.view.type === "recall" ? g.spec.view.mode + g.spec.view.memoKind : "");
    if (!found.has(key) || (g.spec.trigger && !found.has("with-trigger"))) found.set(g.spec.trigger ? "with-trigger" : key, g.spec);
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

export function RoundGallery() {
  const [seed, setSeed] = useState(7);
  const [reveal, setReveal] = useState(false);
  const [tick, setTick] = useState(0);
  const specs = useMemo(() => firstOfEachType(seed), [seed]);
  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-ghost rounded-xl px-4 py-2 text-sm font-bold" onClick={() => setSeed((s) => s + 1)}>
          Seed {seed} →
        </button>
        <button className="btn-ghost rounded-xl px-4 py-2 text-sm font-bold" onClick={() => setReveal((r) => !r)}>
          Reveal: {reveal ? "on" : "off"}
        </button>
        <button className="btn-ghost rounded-xl px-4 py-2 text-sm font-bold" onClick={() => setTick((t) => t + 1)}>
          Replay animations
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specs.map((spec) => (
          <div key={`${spec.index}-${tick}`} className="glass flex h-[460px] flex-col overflow-hidden rounded-3xl p-3">
            <div className="text-xs font-bold text-muted">
              #{spec.index} · {spec.type} · {JSON.stringify(spec.expected)}
              {spec.trigger ? ` · trigger ${spec.trigger.symbol} ${spec.trigger.matches ? "match" : "decoy"}` : ""}
            </div>
            <div className="mt-1 text-sm font-bold">{spec.prompt}</div>
            <div className="flex flex-1 items-center justify-center">
              <div className="relative aspect-square h-full max-h-[360px]">
                <TimerRing durationMs={spec.durationMs} started running />
                <div className="absolute inset-[16%] flex items-center justify-center" style={{ containerType: "size" }}>
                  <RoundView spec={spec} active reveal={reveal} hit={[]} wrongTarget={null} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
