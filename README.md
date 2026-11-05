# Recall Rush

An endless memory tap game. Every round is a short new test (count, tap or freeze, remember, replay) and it keeps getting harder. One wrong tap ends the run. It has a verified leaderboard, a Daily Challenge, share cards, and challenge-a-friend links.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # engine tests, including the 300-round solvability bot
```

You don't need any accounts to run it locally. Without Supabase settings, scores go to `apps/web/.data/db.json`.

## Layout

```
packages/engine/   Pure TypeScript game engine with no DOM or React (reusable in a future Expo app)
  src/rng.ts         Seeded randomness: a run is fully determined by its seed
  src/difficulty.ts  Difficulty curve and unlock schedule
  src/rounds/        One generator per round type
  src/generator.ts   Picks round types, applies triggers and curses, tracks memory between rounds
  src/evaluate.ts    Judges taps, awards points
  src/verify.ts      Server-side replay of a run's tap log (anti-cheat)
  src/share.ts       Daily seed, share text, game over explanations
apps/web/          Next.js 16 app (App Router, Tailwind v4, Motion, Zustand)
  app/               Home, /play, /daily, /leaderboard, /r/[runId] share pages, API routes
  components/game/   Game loop store, stage, HUD, ready and game over screens, particles
  components/rounds/ Visuals for every round type
  lib/server/        Run tokens, storage (Supabase or local file), nickname rules, rate limit
supabase/migrations/ Postgres schema and leaderboard functions
```

## Round types

- **Quick rounds:** Tap or Freeze, Quick Math, Count the Edges, Simon Says, Flash Count, Odd One Out, Read the Ink (Stroop).
- **Knowledge rounds** (built from content packs): Number Trivia, True or False, Odd Word Out.
- **Memory rounds:** Rule for Next Round, Memorize & Recall, Word Memory, Replay the Pattern.
- **Curses** (+1, −1, ×2, flip) that stack in late game.

Each run shuffles which types unlock first, so no two runs open the same way, but every run opens with gentle types.

## Difficulty curve

Modelled on WarioWare's microgame structure (`packages/engine/src/difficulty.ts`):

- **Stages of 10 rounds.** Speed steps up at rounds x5 and x8 ("SPEED UP!").
- **Boss at every round x0:** a familiar round type one level harder, at the stage's top speed, worth double points.
- **Level up after each boss.** Speed eases back slightly (a sawtooth, so players get a breather) while every round type climbs its own ladder of twists, from level 0 to 6: more decoys, longer patterns, harder content, bigger numbers.
- **Speed approaches a ceiling** (about 2.2×) instead of growing forever. Late game difficulty comes from levels, stacked curses and longer memory gaps.
- **Reading time is separate from thinking time.** Text is budgeted at about 180 words per minute and never sped up; only thinking and reaction time shrink. Instruction cards scale with their text, get extra time on a type's first appearance, and can be skipped with a tap.
- **The curve is identical for every player** (no adaptive difficulty), so round numbers are comparable on the leaderboard and the Daily Challenge is fair.

`test/difficulty.test.ts` locks these properties in: spare time must shrink stage after stage, tap-or-freeze rounds must get more than a third shorter, type levels must climb, bosses must land on round x0, and reading budgets must hold.

## Engagement systems

- **Ratings and combos** (`packages/engine/src/evaluate.ts`): each cleared round is rated PERFECT, GREAT or GOOD by how much of the answer window was used. Consecutive PERFECTs build a combo worth up to ×3 points; GOOD breaks it. Combo scoring is part of the server replay, so leaderboard points stay verifiable.
- **Fever**: an 8× combo tints the whole screen, pulses the edges and adds a lead line to the music.
- **Music** (`apps/web/lib/music.ts`): a procedural synthwave loop generated with Web Audio. Its tempo follows the round's speed (100 to 166 BPM).
- **In-run chase**: a live combo counter, plus "BEST 23 · 5 to go", then a mid-run NEW BEST! celebration.
- **Meta progression** (`packages/engine/src/meta.ts`, pure and tested):
  - XP and player levels.
  - Three daily missions per day, scaled to level and frozen for the day.
  - 25 achievements.
  - Lifetime stats and a five-skill brain profile.
- **Rewards screen**: an animated XP bar, level-ups, theme unlocks, mission progress, new achievements, "N rounds from your best", and the next player to beat on the leaderboard.
- **Themes** (`apps/web/lib/themes.ts`): 7 color themes unlocked by level. An inline boot script applies the saved theme before first paint.
- **Retention hooks**: a home-page player card, a "keep your streak alive" warning when yesterday's Daily was played but today's wasn't, and missions shown before each run.
- **Onboarding**: a one-line coaching hint the first time each round type appears in a new player's first two runs.

Progress is stored per device in localStorage (`apps/web/lib/player.ts`). Optional sign-in would sync it across devices.

## Content packs (AI-generated puzzles)

Text puzzles live in `packages/engine/src/content/packs/en/*.json`: trivia, true/false, categories and word sets. They're bundled with the engine, so rounds stay instant and the server can replay them exactly.

```bash
pnpm content:check                          # validate every pack and print counts
pnpm content:generate trivia --count 40     # grow a pack with an LLM
pnpm content:generate categories --dry-run  # preview without writing
pnpm content:generate truth --mock          # try the pipeline offline
```

To generate content, copy `.env.content.example` to `.env.content` and add an API key. Any OpenAI-compatible API works; DeepSeek is the default, and Qwen through Alibaba Cloud or OpenRouter also works. The generator:

1. asks the model for new items;
2. runs them through the same validator the tests use (lengths, word format, answer range, exact letter counts, duplicates);
3. asks a second pass, optionally a different model via `AI_VERIFY_MODEL`, to answer each item independently;
4. keeps only items where both agree.

Skim new items before shipping. Changing any pack changes `RULES_VERSION`, and the server refuses to rank runs played on a different version, so players on an old page are asked to refresh.

## How scoring stays fair

1. `POST /api/runs/start` returns a server-signed token holding the run's seed.
2. The client records every tap with its timestamp.
3. `POST /api/runs/submit` checks the token signature, then replays the whole run with the engine. It rejects taps faster than a human can make and repeated superhuman reactions. Only verified scores are stored.

## Deploying (Vercel + Supabase)

1. Create a Supabase project and run `supabase/migrations/20261022000000_init.sql`, either in the SQL editor or with `supabase db push`.
2. Import the repo in Vercel and set the **root directory** to `apps/web`.
3. Set these environment variables (see `apps/web/.env.example`):
   - `NEXT_PUBLIC_SITE_URL`: your domain, e.g. `https://recallrush.com`
   - `RUN_TOKEN_SECRET`: a long random string
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Dev tools

- `/dev/rounds`: a gallery of every round type, available only in development.
- In development, `window.__recall` exposes the game store for automated play-testing.

## Next steps

- Monetization: rewarded "continue once" ads, a Pro tier with no ads, stats and themes.
- Practice mode per round type, plus `/tests/*` SEO landing pages.
- More round types: N-back, position flash, rhythm echo, mirror, emoji riddles.
- Translated content packs (Urdu, Hindi, Arabic and more) using the same generator.
- Optional Google/Apple sign-in to sync progress across devices (`profiles.auth_user_id` is ready for it).
- PostHog analytics and Sentry error tracking.
- Expo mobile app reusing `packages/engine`.
