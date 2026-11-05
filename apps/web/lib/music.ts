import { sfx } from "./audio";

/**
 * Procedural synthwave loop, generated live with Web Audio (no files to download). The tempo follows the
 * round's speed, like WarioWare's music speeding up, and fever mode adds a lead arpeggio and busier hats.
 */

const STEPS = 16;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
/** A-minor four-chord loop: roots, then the chord tones the lead arpeggiates. */
const CHORDS = [
  { root: 110.0, tones: [220.0, 261.63, 329.63] }, // Am
  { root: 87.31, tones: [174.61, 220.0, 261.63] }, // F
  { root: 130.81, tones: [261.63, 329.63, 392.0] }, // C
  { root: 98.0, tones: [196.0, 246.94, 293.66] }, // G
];
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);

class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private bpm = 100;
  private fever = false;

  start() {
    const g = sfx.graph();
    if (!g || this.timer) return;
    const { ctx, out } = g;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.6);
    this.gain.connect(out);
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    this.step = 0;
    this.bar = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const g = sfx.graph();
    if (g && this.gain) {
      const node = this.gain;
      node.gain.cancelScheduledValues(g.ctx.currentTime);
      node.gain.setTargetAtTime(0.0001, g.ctx.currentTime, 0.15);
      setTimeout(() => node.disconnect(), 800);
    }
    this.gain = null;
    this.fever = false;
  }

  /** Round speed 1.0-2.2 maps to 100-166 BPM. */
  setSpeed(speed: number) {
    this.bpm = Math.round(100 + (speed - 1) * 55);
  }

  setFever(on: boolean) {
    this.fever = on;
  }

  private schedule() {
    const g = sfx.graph();
    if (!g || !this.gain) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < g.ctx.currentTime + LOOKAHEAD_S) {
      if (!sfx.muted) this.playStep(g.ctx, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % STEPS;
      if (this.step === 0) this.bar = (this.bar + 1) % CHORDS.length;
    }
  }

  private playStep(ctx: AudioContext, step: number, t: number, stepDur: number) {
    const chord = CHORDS[this.bar]!;
    if (step % 4 === 0) this.kick(ctx, t);
    if (step === 4 || step === 12) this.hit(ctx, t, 0.16, 1800, 0.12);
    if (this.fever ? step % 2 === 1 : step % 4 === 2) this.hit(ctx, t, 0.03, 7000, this.fever ? 0.06 : 0.045);
    if (BASS_STEPS.has(step)) this.synth(ctx, t, chord.root, stepDur * 1.6, "sawtooth", 0.09, 700);
    if (this.fever) {
      const note = chord.tones[step % chord.tones.length]! * 2;
      this.synth(ctx, t, note, stepDur * 0.9, "square", 0.035, 3200);
    } else if (step % 8 === 0) {
      // A soft pad stab on the chord keeps it musical without being busy.
      for (const tone of chord.tones) this.synth(ctx, t, tone, stepDur * 3, "triangle", 0.02, 2000);
    }
  }

  private kick(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(env).connect(this.gain!);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private hit(ctx: AudioContext, t: number, dur: number, cutoff: number, level: number) {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(this.gain!);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  private synth(ctx: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, level: number, cutoff: number) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(env).connect(this.gain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const music = new Music();
