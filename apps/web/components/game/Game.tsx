"use client";

import { FEVER_COMBO, dailyNumber, dailySeed, shareText, utcDate } from "@recall/engine";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { renamePlayer, startRun, submitRun, type Mode, type StartedRun, type SubmitResult } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { setHaptics } from "@/lib/haptics";
import { loadPlayer, recordDaily, savePlayer, subscribePlayer } from "@/lib/player";
import { recordRun, type RunRewards } from "@/lib/progress";
import { missionsFor } from "@/components/home/PlayerCard";
import { GameOver } from "./GameOver";
import { Banner, FeverOverlay, RatingPop } from "./Juice";
import { Hud } from "./Hud";
import { Particles, type ParticlesHandle } from "./Particles";
import { ReadyScreen } from "./ReadyScreen";
import { Stage } from "./Stage";
import { useGame } from "./store";

const PASS_COLORS = ["#22e6ff", "#b6ff3b", "#ff2bd6", "#ffc43d"];
const FAIL_COLORS = ["#ff3d5e", "#ff7a2b", "#ffffff"];

export interface GameProps {
  mode: Mode;
  /** Seed from a challenge link. */
  seed?: number;
  challenge?: { by: string; rounds: number };
}

const noSubscribe = () => () => {};

export function Game({ mode, seed, challenge }: GameProps) {
  const phase = useGame((s) => s.phase);
  const spec = useGame((s) => s.spec);
  const index = useGame((s) => s.index);
  const points = useGame((s) => s.points);
  const countdown = useGame((s) => s.countdown);
  const feedback = useGame((s) => s.feedback);
  const combo = useGame((s) => s.combo);
  const cleared = useGame((s) => s.results.length);
  const { prepare, attachRun, start, tap, reset } = useGame.getState();

  // Dates and storage only exist in the browser: on the server these read as empty and the game renders after hydration.
  const today = useSyncExternalStore(noSubscribe, utcDate, () => "");
  const player = useSyncExternalStore(subscribePlayer, loadPlayer, () => null);

  const [submit, setSubmit] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [rewards, setRewards] = useState<RunRewards | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  /** Personal best when this run started: the target for the in-run chase. */
  const [bestAtStart, setBestAtStart] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const particles = useRef<ParticlesHandle>(null);
  const nextRun = useRef<Promise<StartedRun | null> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null);

  const dailyDone = mode === "daily" && today ? player?.daily[today] : undefined;

  // Prepare the first run and fetch a signed seed from the server in the background.
  useEffect(() => {
    const p = loadPlayer();
    sfx.muted = !p.sound;
    setHaptics(p.haptics);
    prepare(mode, null, mode === "daily" ? dailySeed(utcDate()) : seed);
    let cancelled = false;
    void startRun(mode, mode === "challenge" ? seed : undefined).then((run) => {
      if (cancelled) return;
      if (run === "outdated") setOutdated(true);
      else if (run) attachRun(run);
    });
    return () => {
      cancelled = true;
      reset();
    };
  }, [mode, seed, prepare, attachRun, reset]);

  // Particle bursts for each tap / pass / fail.
  useEffect(() => {
    if (!feedback) return;
    const rect = stageRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.top + rect.height * 0.45 : window.innerHeight / 2;
    if (feedback.kind === "pass") particles.current?.burst(cx, cy, PASS_COLORS, 42, 8);
    if (feedback.kind === "fail") particles.current?.burst(cx, cy, FAIL_COLORS, 60, 10);
    if ((feedback.kind === "tap" || feedback.kind === "pick") && feedback.x !== undefined && feedback.y !== undefined) {
      particles.current?.burst(feedback.x, feedback.y, ["#22e6ff", "#ffffff"], 8, 3.5);
    }
  }, [feedback]);

  // Fever tints the whole page backdrop, which lives outside this component.
  useEffect(() => {
    const on = combo >= FEVER_COMBO && phase !== "fail" && phase !== "over" && phase !== "ready";
    document.documentElement.dataset.fever = on ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.fever;
    };
  }, [combo, phase]);

  // Keep the screen awake during a run.
  useEffect(() => {
    const playing = phase !== "ready" && phase !== "over";
    if (playing && !wakeLock.current && "wakeLock" in navigator) {
      (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock
        .request("screen")
        .then((lock) => (wakeLock.current = lock))
        .catch(() => {});
    }
    if (!playing && wakeLock.current) {
      void wakeLock.current.release().catch(() => {});
      wakeLock.current = null;
    }
  }, [phase]);

  // When a run ends: save the best locally, submit to the leaderboard, and prefetch the next seed.
  const onRunEnded = useEffectEvent(() => {
    const state = useGame.getState();
    const rounds = state.logs.length - 1;
    const date = utcDate();
    const p = loadPlayer();
    const isBest = rounds > p.best && mode !== "challenge";
    setNewBest(isBest);
    const updated = savePlayer({
      games: p.games + 1,
      best: isBest ? rounds : p.best,
      bestPoints: Math.max(p.bestPoints, state.points),
    });
    if (isBest) setTimeout(() => sfx.newBest(), 1900);

    const rankedDaily = mode === "daily" && !p.daily[date];
    if (rankedDaily) recordDaily(date, { rounds, points: state.points });

    const gained = recordRun({
      mode,
      date,
      rounds,
      points: state.points,
      bestCombo: state.bestCombo,
      results: state.results,
      failedOn: state.failedOn ?? undefined,
    });
    setRewards(gained);
    if (gained.levelAfter > gained.levelBefore) setTimeout(() => sfx.levelUp(), 2600);

    nextRun.current =
      mode === "daily" ? null : startRun(mode, mode === "challenge" ? seed : undefined).then((r) => (r === "outdated" ? null : r));

    const run = state.run;
    if (!run || (mode === "daily" && !rankedDaily)) {
      setSubmit({ ok: true, rounds, points: state.points, ranked: false });
      return;
    }
    setSubmit(null);
    setSubmitting(true);
    void submitRun({ token: run.token, deviceId: updated.deviceId, nickname: updated.nickname, logs: state.logs }).then((res) => {
      setSubmitting(false);
      setSubmit(
        res ?? { ok: false, rounds, points: state.points, error: "Couldn't reach the leaderboard. Your best is saved on this device." },
      );
      if (res?.nickname && res.nickname !== updated.nickname) savePlayer({ nickname: res.nickname });
      if (res?.runId && rankedDaily) {
        savePlayer({ daily: { ...loadPlayer().daily, [date]: { rounds, points: state.points, runId: res.runId } } });
      }
    });
  });

  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.phase === "countdown" && prev.phase !== "countdown") setBestAtStart(s.mode === "challenge" ? 0 : loadPlayer().best);
        if (s.phase === "fail" && prev.phase !== "fail") onRunEnded();
      }),
    [],
  );

  const playAgain = useCallback(async () => {
    sfx.unlock();
    const run = nextRun.current ? await Promise.race([nextRun.current, new Promise<null>((r) => setTimeout(() => r(null), 600))]) : null;
    nextRun.current = null;
    prepare(mode, run, mode === "daily" ? dailySeed(utcDate()) : seed);
    setSubmit(null);
    setNewBest(false);
    setRewards(null);
    useGame.getState().start();
  }, [mode, prepare, seed]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-ui]")) return;
    const target = (el.closest("[data-target]") as HTMLElement | null)?.dataset.target ?? "zone";
    const before = useGame.getState().feedback?.id;
    tap(target, e.clientX, e.clientY);
    const fb = useGame.getState().feedback;
    if (fb && fb.id !== before && (fb.kind === "tap" || fb.kind === "pick")) {
      setRipples((r) => [...r.slice(-6), { id: fb.id, x: e.clientX, y: e.clientY }]);
    }
  };

  // Keyboard: Space taps, Enter = Done, 1-9 picks an option.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "BUTTON" || el.tagName === "A") return;
      const s = useGame.getState();
      if (e.code === "Space") {
        e.preventDefault();
        if (s.phase === "ready") s.start();
        else if (s.phase === "over") void playAgain();
        else s.tap("zone");
      } else if (e.code === "Enter") {
        if (s.phase === "over") void playAgain();
        else if (s.spec?.allowDone) s.tap("done");
      } else if (/^Digit[1-9]$/.test(e.code)) {
        s.tap(`opt-${Number(e.code.slice(5)) - 1}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playAgain]);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const share = async () => {
    const state = useGame.getState();
    const origin = window.location.origin;
    const url = submit?.runId ? `${origin}/r/${submit.runId}` : origin;
    const text = shareText({ rounds: state.logs.length - 1, points: state.points, daily: mode === "daily" ? today : undefined, url });
    await shareOrCopy(text, url, flash);
  };

  const challengeFriend = async () => {
    const state = useGame.getState();
    const rounds = state.logs.length - 1;
    const name = player?.nickname ?? "A friend";
    const url = `${window.location.origin}/play?seed=${state.seed}&vs=${rounds}&by=${encodeURIComponent(name)}`;
    await shareOrCopy(`⚔️ I reached round ${rounds} in Recall Rush. Same rounds, your turn:`, url, flash);
  };

  const rename = async (name: string): Promise<string | null> => {
    if (!player) return "Not ready yet";
    const res = await renamePlayer(player.deviceId, name);
    if (!res.ok) return res.error ?? "Couldn't save that name";
    savePlayer({ nickname: res.nickname ?? name });
    return null;
  };

  const toggleSound = () => {
    const p = savePlayer({ sound: !(player?.sound ?? true) });
    sfx.muted = !p.sound;
    if (p.sound) sfx.unlock();
  };

  if (!today) return <div className="game-root" />;

  const rounds = Math.max(0, useGame.getState().logs.length - 1);
  const fever = combo >= FEVER_COMBO && phase !== "fail" && phase !== "over" && phase !== "ready";
  const todays = player && player.stats.runs > 0 ? missionsFor(player) : null;
  const readyMissions = todays?.list.map((m) => {
    const progress = todays.progress[m.id] ?? 0;
    return { id: m.id, title: m.title, progress, target: m.target, done: progress >= m.target };
  });
  const label = mode === "daily" ? `Daily #${dailyNumber(today)}` : mode === "challenge" ? "Challenge" : "Endless";

  return (
    <MotionConfig reducedMotion="user">
      <div className="game-root relative flex flex-col" onContextMenu={(e) => e.preventDefault()}>
        <Particles ref={particles} />
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <Hud
            round={Math.max(index, 1)}
            points={points}
            curses={spec?.activeCurseCount ?? 0}
            sound={player?.sound ?? true}
            onToggleSound={toggleSound}
            label={label}
            level={spec && phase !== "ready" ? spec.level : undefined}
            speed={spec && phase !== "ready" ? spec.speed : undefined}
          />

          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            className={`relative flex min-h-0 flex-1 flex-col ${phase === "fail" ? "shake" : ""}`}
          >
            {phase === "ready" && (
              <ReadyScreen
                notice={outdated ? "A new version of Recall Rush is out. Refresh to play ranked." : undefined}
                missions={readyMissions}
                mode={mode}
                best={player?.best ?? 0}
                dailyNumber={dailyNumber(today)}
                dailyDone={dailyDone}
                challenge={challenge}
                onStart={start}
              />
            )}

            {phase === "countdown" && (
              <div className="flex flex-1 items-center justify-center">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 2.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-display text-[clamp(120px,40vw,220px)] font-black neon-text-magenta"
                  >
                    {countdown}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {spec && phase !== "ready" && phase !== "countdown" && (
              <Stage spec={spec} phase={phase} best={bestAtStart} coach={(player?.stats.runs ?? 0) < 2} />
            )}

            {/* Full-screen color flashes */}
            <AnimatePresence>
              {feedback && (phase === "pass" || phase === "fail") && (
                <motion.div
                  key={feedback.id}
                  initial={{ opacity: phase === "fail" ? 0.55 : 0.28 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: phase === "fail" ? 0.9 : 0.45 }}
                  className="pointer-events-none fixed inset-0 z-20"
                  style={{
                    background:
                      phase === "fail"
                        ? "radial-gradient(circle at 50% 45%, rgba(255,61,94,0.9), rgba(255,61,94,0.2) 60%, transparent)"
                        : "radial-gradient(circle at 50% 45%, rgba(61,255,138,0.75), transparent 65%)",
                  }}
                />
              )}
            </AnimatePresence>

            <RatingPop feedback={feedback} />
          </div>
        </div>

        <FeverOverlay active={fever} />
        <Banner
          id={feedback?.kind === "pass" && feedback.combo === FEVER_COMBO && feedback.rating === "perfect" ? `fever-${feedback.id}` : null}
          text="FEVER!"
          sub="POINTS ×1.8 AND CLIMBING"
          tone="fever"
        />
        <Banner
          id={
            phase === "pass" && feedback?.kind === "pass" && bestAtStart > 0 && cleared === bestAtStart + 1 ? `best-${feedback.id}` : null
          }
          text="NEW BEST!"
          sub={`PAST ROUND ${bestAtStart}. KEEP GOING!`}
          tone="best"
        />

        {/* Tap ripples */}
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            onAnimationComplete={() => setRipples((all) => all.filter((x) => x.id !== r.id))}
            className="pointer-events-none fixed z-40 h-16 w-16 rounded-full border-2 border-cyan"
            style={{ left: r.x - 32, top: r.y - 32, boxShadow: "0 0 20px var(--cyan)" }}
          />
        ))}

        {phase === "over" && (
          <GameOver
            mode={mode}
            rounds={rounds}
            points={points}
            best={player?.best ?? rounds}
            newBest={newBest}
            submit={submit}
            submitting={submitting}
            nickname={player?.nickname ?? ""}
            streak={player?.dailyStreak.count}
            dailyNumber={dailyNumber(today)}
            onRename={rename}
            onPlayAgain={playAgain}
            onShare={share}
            onChallenge={challengeFriend}
            rewards={rewards}
            bestCombo={useGame.getState().bestCombo}
          />
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black shadow-xl"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

async function shareOrCopy(text: string, url: string, notify: (m: string) => void) {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await nav.share({ text, url });
      return;
    } catch {
      // Cancelled or unsupported: fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text.includes(url) ? text : `${text}\n${url}`);
    notify("Copied to clipboard!");
  } catch {
    notify("Couldn't copy. Long-press to share instead.");
  }
}
