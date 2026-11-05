/** Tiny Web Audio synth: every sound is generated, so there are no files to load. */

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture before sounds can play on iOS. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Shared audio graph for the music player; null until a user gesture has unlocked audio. */
  graph(): { ctx: AudioContext; out: GainNode } | null {
    return this.ctx && this.master ? { ctx: this.ctx, out: this.master } : null;
  }

  private tone(freq: number, dur: number, opts: { type?: Wave; gain?: number; delay?: number; slideTo?: number } = {}) {
    if (this.muted || !this.ctx || !this.master) return;
    const { type = "square", gain = 0.25, delay = 0, slideTo } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain = 0.2, delay = 0) {
    if (this.muted || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    env.gain.value = gain;
    src.buffer = buffer;
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
  }

  tap(count: number) {
    this.tone(520 + Math.min(count, 16) * 45, 0.07, { type: "triangle", gain: 0.3 });
  }

  pick() {
    this.tone(880, 0.08, { type: "triangle", gain: 0.28 });
  }

  pass(streak: number) {
    const base = 440 * Math.pow(2, (Math.min(streak, 24) % 12) / 12);
    [1, 1.25, 1.5].forEach((m, i) => this.tone(base * m, 0.12, { type: "square", gain: 0.12, delay: i * 0.05 }));
  }

  fail() {
    this.tone(330, 0.55, { type: "sawtooth", gain: 0.22, slideTo: 55 });
    this.tone(220, 0.6, { type: "square", gain: 0.1, slideTo: 40, delay: 0.04 });
    this.noise(0.35, 0.25);
  }

  tick(final = false) {
    this.tone(final ? 1046 : 660, final ? 0.22 : 0.09, { type: "square", gain: 0.16 });
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, { type: "square", gain: 0.13, delay: i * 0.07 }));
  }

  curse() {
    this.tone(160, 0.5, { type: "sawtooth", gain: 0.16, slideTo: 110 });
    this.tone(233, 0.5, { type: "sawtooth", gain: 0.1, slideTo: 150 });
  }

  /** Bright two-note chime that climbs a scale as the combo grows. */
  perfect(combo: number) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const base = 523.25 * Math.pow(2, (scale[Math.min(combo, scale.length - 1)] ?? 0) / 12);
    this.tone(base, 0.09, { type: "triangle", gain: 0.2 });
    this.tone(base * 1.5, 0.14, { type: "triangle", gain: 0.14, delay: 0.05 });
    this.tone(base * 2, 0.18, { type: "sine", gain: 0.08, delay: 0.1 });
  }

  fever() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, { type: "square", gain: 0.12, delay: i * 0.05 }));
    this.noise(0.4, 0.12, 0.25);
  }

  boss() {
    [110, 147, 196].forEach((f, i) => this.tone(f, 0.5, { type: "sawtooth", gain: 0.12, delay: i * 0.12 }));
    this.tone(392, 0.6, { type: "square", gain: 0.08, delay: 0.36, slideTo: 523 });
  }

  speedUp() {
    [660, 880, 1175].forEach((f, i) => this.tone(f, 0.08, { type: "square", gain: 0.12, delay: i * 0.05 }));
  }

  newBest() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, { type: "triangle", gain: 0.2, delay: i * 0.09 }));
  }
}

export const sfx = new Sfx();
