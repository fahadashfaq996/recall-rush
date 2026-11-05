import { utcDate } from "@recall/engine";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DailyCountdown } from "@/components/home/DailyCountdown";
import { DemoPhone } from "@/components/home/DemoPhone";
import { PlayerCard } from "@/components/home/PlayerCard";
import { Wordmark } from "@/components/home/Wordmark";
import { LeaderboardList, LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardList";
import { CalendarIcon, PlayIcon, ShapeIcon, SymbolIcon, TrophyIcon, polygonPoints } from "@/components/ui/icons";
import { getStore } from "@/lib/server/store";

const ROUND_TYPES = [
  {
    name: "Quick Math",
    tag: "Count",
    desc: "Solve 3 + 4, then tap 7 times.",
    art: <span className="font-display text-3xl font-black neon-text-cyan">3+4</span>,
  },
  { name: "Count the Edges", tag: "Count", desc: "A shape flashes. Tap once per side.", art: <Poly sides={6} color="#b6ff3b" /> },
  { name: "Flash Count", tag: "Count", desc: "Dots appear for a blink. How many?", art: <Dots /> },
  {
    name: "Tap or Freeze",
    tag: "Reflex",
    desc: "Tap only on the right color and shape.",
    art: <ShapeIcon kind="circle" color="#3dff8a" size={54} />,
  },
  {
    name: "Simon Says",
    tag: "Reflex",
    desc: "Obey Simon. Ignore everyone else.",
    art: <span className="font-display text-xl font-black neon-text-magenta">SIMON</span>,
  },
  {
    name: "Read the Ink",
    tag: "Focus",
    desc: "The word says BLUE. The ink is red.",
    art: (
      <span className="font-display text-3xl font-black" style={{ color: "#ff3d5e", textShadow: "0 0 18px #ff3d5e" }}>
        BLUE
      </span>
    ),
  },
  { name: "Rule for Next Round", tag: "Memory", desc: "See a star next round? Freeze.", art: <SymbolIcon id="star" size={54} /> },
  {
    name: "Memorize & Recall",
    tag: "Memory",
    desc: "Hold a number in your head for rounds.",
    art: <span className="font-display text-4xl font-black neon-text-amber">7</span>,
  },
  { name: "Replay the Pattern", tag: "Memory", desc: "Tiles light up. Tap them back in order.", art: <MiniGrid /> },
  { name: "Odd One Out", tag: "Focus", desc: "One tile is a slightly different shade.", art: <OddGrid /> },
  {
    name: "Curses",
    tag: "Chaos",
    desc: "Tap one more than the answer, for 4 rounds.",
    art: <SymbolIcon id="skull" size={54} color="#b44dff" />,
  },
  {
    name: "Number Trivia",
    tag: "Brain",
    desc: "How many legs does a spider have? Tap it out.",
    art: <span className="text-5xl leading-none">🕷️</span>,
  },
  {
    name: "True or False",
    tag: "Brain",
    desc: "Bats are blind? Tap only if it's true.",
    art: <span className="font-display text-2xl font-black neon-text-lime">TRUE?</span>,
  },
  {
    name: "Odd Word Out",
    tag: "Brain",
    desc: "Ant, bee, moth, spider. Which one isn't an insect?",
    art: <span className="font-display text-xl font-black neon-text-magenta">SPIDER</span>,
  },
  {
    name: "Word Memory",
    tag: "Memory",
    desc: "Hold a list of words, then spot the impostor.",
    art: (
      <span className="font-display text-lg font-black leading-tight neon-text-amber">
        SAND
        <br />
        SHELL
      </span>
    ),
  },
  {
    name: "More every update",
    tag: "Soon",
    desc: "N-back, rhythm, mirror rounds and more.",
    art: <span className="font-display text-4xl font-black text-white/40">+</span>,
  },
];

const TAG_COLOR: Record<string, string> = {
  Count: "text-cyan bg-cyan/10 ring-cyan/30",
  Reflex: "text-lime bg-lime/10 ring-lime/30",
  Focus: "text-amber bg-amber/10 ring-amber/30",
  Memory: "text-magenta bg-magenta/10 ring-magenta/30",
  Chaos: "text-violet-300 bg-violet/15 ring-violet/40",
  Brain: "text-sky-300 bg-sky-400/10 ring-sky-400/30",
  Soon: "text-muted bg-white/5 ring-white/10",
};

export default function Home() {
  return (
    <div className="relative overflow-x-hidden">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <Link href="/daily" className="hidden rounded-xl px-3 py-2 text-muted hover:text-white sm:block">
            Daily
          </Link>
          <Link href="/profile" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-muted hover:text-white" aria-label="Profile">
            <span aria-hidden>🏅</span>
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-muted hover:text-white"
            aria-label="Leaderboard"
          >
            <TrophyIcon size={18} />
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          <Link href="/play" className="btn-neon rounded-xl px-4 py-2 font-display text-xs font-black tracking-wider">
            PLAY
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted ring-1 ring-white/10">
            <span className="h-2 w-2 animate-pulse rounded-full bg-lime shadow-[0_0_10px_var(--lime)]" /> Endless memory game
          </div>
          <h1 className="mt-6 font-display text-[clamp(44px,9vw,96px)] font-black leading-[0.95] tracking-tight">
            How far can
            <br />
            your <span className="bg-gradient-to-r from-cyan via-violet to-magenta bg-clip-text text-transparent">memory</span>
            <br />
            go?
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-pretty text-lg font-medium text-white/75 lg:mx-0">
            Every round is a new few-second test of memory, focus and reflexes. The rules stack, the clock shrinks, and{" "}
            <span className="font-bold text-white">one wrong tap ends the run.</span>
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/play"
              className="btn-neon flex h-16 w-full max-w-xs items-center justify-center gap-3 rounded-2xl font-display text-xl font-black tracking-[0.12em] sm:w-auto sm:px-10"
            >
              <PlayIcon size={22} /> PLAY NOW
            </Link>
            <Link
              href="/daily"
              className="btn-ghost flex h-16 w-full max-w-xs flex-col items-center justify-center rounded-2xl px-6 sm:w-auto"
            >
              <span className="flex items-center gap-2 font-display text-sm font-black tracking-wider">
                <CalendarIcon size={16} /> DAILY CHALLENGE
              </span>
              <span className="text-xs font-semibold text-muted">
                <DailyCountdown />
              </span>
            </Link>
          </div>
          <PlayerCard />
          <p className="mt-6 text-sm font-semibold text-muted">
            Free · No sign-up · Phone or desktop ·{" "}
            <Suspense fallback={<span>&nbsp;</span>}>
              <RunCount />
            </Suspense>
          </p>
        </div>
        <DemoPhone />
      </section>

      {/* Marquee */}
      <div className="relative border-y border-white/10 bg-white/[0.02] py-4" aria-hidden>
        <div className="marquee flex w-max gap-10 whitespace-nowrap font-display text-sm font-black tracking-[0.25em] text-white/40">
          {[...ROUND_TYPES, ...ROUND_TYPES].map((r, i) => (
            <span key={i} className="flex items-center gap-10">
              {r.name.toUpperCase()} <span className="text-magenta">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Round types */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle kicker="Never the same twice" title="Every round is a new test" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {ROUND_TYPES.map((r) => (
            <div
              key={r.name}
              className="glass group flex flex-col rounded-3xl p-4 transition hover:-translate-y-1 hover:bg-white/[0.07] sm:p-5"
            >
              <div className="flex h-20 items-center justify-center">{r.art}</div>
              <span
                className={`mt-3 self-start rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] ring-1 ${TAG_COLOR[r.tag]}`}
              >
                {r.tag}
              </span>
              <h3 className="mt-2 font-display text-[15px] font-black leading-tight sm:text-base">{r.name}</h3>
              <p className="mt-1 text-[13px] font-medium leading-snug text-muted sm:text-sm">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Difficulty */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionTitle kicker="Infinite rounds" title="It gets harder. Forever." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature
            color="cyan"
            title="Speed ups and bosses"
            text="Every 10 rounds the pace steps up twice, then a boss round worth double points guards the next level."
            stat="⚡ Up to 2.2×"
          />
          <Feature
            color="magenta"
            title="Every round levels up"
            text="Each round type has its own ladder: more decoys, longer patterns, trickier facts, bigger numbers."
            stat="6 levels each"
          />
          <Feature
            color="amber"
            title="Rules and curses stack"
            text="Remember a rule for later, then survive curses that bend the answers: tap one more, double it, do the opposite."
            stat="3 curses at once"
          />
        </div>
      </section>

      {/* Progression */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionTitle kicker="Every run counts" title="Level up. Unlock. Flex." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-black italic neon-text-lime">PERFECT!</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-black">Combos and fever</h3>
            <p className="mt-2 font-medium leading-relaxed text-muted">
              Answer fast to chain PERFECTs. Every link multiplies your points, and an 8× chain sets the whole screen on fire.
            </p>
          </div>
          <div className="glass rounded-3xl p-6">
            <ul className="flex flex-col gap-1.5 text-sm font-semibold">
              <li className="rounded-xl bg-lime/10 px-3 py-2 ring-1 ring-lime/30">✅ Beat 2 bosses</li>
              <li className="rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10">Hit a 6× PERFECT combo · 4/6</li>
              <li className="rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10">Reach round 20 · 14/20</li>
            </ul>
            <h3 className="mt-4 font-display text-lg font-black">Daily missions</h3>
            <p className="mt-2 font-medium leading-relaxed text-muted">
              Three fresh goals every day. Clear them for bonus XP and climb the levels.
            </p>
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex gap-2">
              {[
                ["#22e6ff", "#ff2bd6"],
                ["#ffb347", "#ff4f81"],
                ["#b6ff3b", "#00ffa3"],
                ["#ffd84d", "#ff9f1c"],
                ["#ff6ad5", "#8c1eff"],
              ].map(([a, b]) => (
                <span
                  key={a}
                  className="h-9 w-9 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 0 16px ${b}88` }}
                />
              ))}
            </div>
            <h3 className="mt-4 font-display text-lg font-black">Themes and achievements</h3>
            <p className="mt-2 font-medium leading-relaxed text-muted">
              Unlock 7 neon themes as you level up, collect 25 achievements, and see your brain profile grow.
            </p>
          </div>
        </div>
      </section>

      {/* Leaderboard + Daily */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:px-6 lg:grid-cols-2">
        <div className="glass rounded-[28px] p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-black">
              <TrophyIcon size={20} /> Top players
            </h2>
            <Link href="/leaderboard" className="text-sm font-bold text-cyan hover:underline">
              See all →
            </Link>
          </div>
          <Suspense fallback={<LeaderboardSkeleton />}>
            <TopPlayers />
          </Suspense>
        </div>
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet/40 via-magenta/25 to-cyan/20 p-6 ring-1 ring-white/15 sm:p-8">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-magenta/40 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Daily challenge</div>
            <h2 className="mt-3 font-display text-3xl font-black leading-tight sm:text-4xl">
              Same rounds for everyone.
              <br />
              One shot a day.
            </h2>
            <p className="mt-4 max-w-sm font-medium text-white/80">
              Play today&apos;s run, post your result, and keep your streak alive. A new challenge drops at midnight UTC.
            </p>
            <pre className="mt-6 w-fit rounded-2xl bg-black/40 px-4 py-3 font-sans text-sm font-semibold leading-relaxed text-white/90 ring-1 ring-white/10">
              {"🧠 Recall Rush Daily #12: round 37\n🟩🟩🟩🟨🟥\nCan you beat me?"}
            </pre>
            <Link
              href="/daily"
              className="mt-6 inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-7 font-display text-sm font-black tracking-wider text-black transition hover:scale-[1.02] active:scale-95"
            >
              <CalendarIcon /> PLAY TODAY&apos;S
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <SectionTitle kicker="Questions" title="Good to know" />
        <div className="mt-8 flex flex-col gap-3">
          <Faq q="Is Recall Rush free?" a="Yes. Play as much as you like in your browser on phone, tablet or desktop. No account needed." />
          <Faq
            q="How is the leaderboard kept fair?"
            a="Every run is replayed on our server from its seed and your exact taps. Scores that don't match, or taps faster than a human, never reach the board."
          />
          <Faq
            q="What does it train?"
            a="Working memory (holding rules and numbers across rounds), attention and inhibition (knowing when not to tap), counting and quick math, all under time pressure."
          />
          <Faq
            q="Can I challenge a friend?"
            a="After a run, tap Challenge. Your friend gets the exact same rounds and sees the score to beat."
          />
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 text-center text-sm font-semibold text-muted">
        <Wordmark />
        <p className="mt-3">Made for curious brains. © {"2026"} Recall Rush</p>
      </footer>
    </div>
  );
}

async function RunCount() {
  await connection();
  const runs = await getStore()
    .totalRuns()
    .catch(() => 0);
  if (runs < 1) return <span>Be the first on the board</span>;
  return <span>{runs.toLocaleString("en-US")} runs played</span>;
}

async function TopPlayers() {
  await connection();
  const entries = await getStore()
    .leaderboard("all", utcDate(), 5)
    .catch(() => []);
  return <LeaderboardList entries={entries} empty="No scores yet. Yours could be first." compact />;
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-xs font-black uppercase tracking-[0.35em] text-magenta">{kicker}</div>
      <h2 className="mt-3 font-display text-[clamp(30px,5.5vw,52px)] font-black leading-tight">{title}</h2>
    </div>
  );
}

function Feature({ color, title, text, stat }: { color: "cyan" | "magenta" | "amber"; title: string; text: string; stat: string }) {
  const glowClass = { cyan: "neon-text-cyan", magenta: "neon-text-magenta", amber: "neon-text-amber" }[color];
  return (
    <div className="glass rounded-3xl p-6">
      <div className={`font-display text-2xl font-black ${glowClass}`}>{stat}</div>
      <h3 className="mt-4 font-display text-lg font-black">{title}</h3>
      <p className="mt-2 font-medium leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="glass group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold">
        {q}
        <span className="text-xl text-cyan transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 font-medium leading-relaxed text-muted">{a}</p>
    </details>
  );
}

function Poly({ sides, color }: { sides: number; color: string }) {
  return (
    <svg viewBox="0 0 100 100" width={60} height={60} style={{ overflow: "visible", filter: `drop-shadow(0 0 8px ${color})` }} aria-hidden>
      <polygon points={polygonPoints(sides, false, 15)} fill={`${color}22`} stroke={color} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
}

function Dots() {
  const pts = [
    [20, 30],
    [60, 18],
    [42, 58],
    [80, 62],
    [25, 80],
  ];
  return (
    <svg viewBox="0 0 100 100" width={64} height={64} aria-hidden>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={8} fill="#22e6ff" style={{ filter: "drop-shadow(0 0 6px #22e6ff)" }} />
      ))}
    </svg>
  );
}

function MiniGrid() {
  const lit = [0, 4, 8];
  return (
    <div className="grid grid-cols-3 gap-1.5" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded ${lit.includes(i) ? "bg-cyan shadow-[0_0_12px_var(--cyan)]" : "bg-white/10"}`} />
      ))}
    </div>
  );
}

function OddGrid() {
  return (
    <div className="grid grid-cols-3 gap-1.5" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="h-4 w-4 rounded" style={{ background: i === 5 ? "hsl(300 85% 64%)" : "hsl(285 85% 58%)" }} />
      ))}
    </div>
  );
}
