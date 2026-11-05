import type { Metadata } from "next";
import { Suspense } from "react";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "Play endless mode",
  description: "Endless memory, focus and reaction rounds. Every round is different and a little harder. One wrong tap ends the run.",
};

export default function PlayPage({ searchParams }: PageProps<"/play">) {
  return (
    <Suspense fallback={<div className="game-root" />}>
      <PlayWithParams searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayWithParams({ searchParams }: { searchParams: PageProps<"/play">["searchParams"] }) {
  const params = await searchParams;
  const seed = Number(params.seed);
  if (Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32) {
    const rounds = Number(params.vs);
    const by = typeof params.by === "string" ? params.by.slice(0, 16) : "A friend";
    return <Game mode="challenge" seed={seed} challenge={Number.isFinite(rounds) ? { by, rounds } : undefined} />;
  }
  return <Game mode="endless" />;
}
