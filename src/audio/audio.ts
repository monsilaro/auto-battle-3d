// Procedural WebAudio SFX + ambient bed. No audio files — everything is
// synthesized, so there is nothing to license or load.

type SfxName =
  | 'hit'
  | 'death'
  | 'horn'
  | 'build'
  | 'sell'
  | 'coin'
  | 'blessing'
  | 'victory'
  | 'defeat';

const MUTE_KEY = 'gravemarch-muted';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private lastPlay = new Map<SfxName, number>();
  muted = localStorage.getItem(MUTE_KEY) === '1';

  // Must be called from a user gesture (browser autoplay policy).
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = performance.now();
    const minGap = name === 'hit' ? 70 : 120;
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);

    const t = this.ctx.currentTime;
    switch (name) {
      case 'hit':
        this.noiseBurst(t, 0.07, 900 + Math.random() * 500, 0.25);
        this.tone(t, 'square', 140 + Math.random() * 60, 70, 0.06, 0.1);
        break;
      case 'death':
        this.tone(t, 'sawtooth', 220, 55, 0.35, 0.16);
        this.noiseBurst(t, 0.18, 500, 0.14);
        break;
      case 'horn': {
        // War horn: detuned saws swelling, a fifth apart.
        this.swell(t, 98, 1.5, 0.34);
        this.swell(t + 0.04, 147, 1.4, 0.22);
        this.noiseBurst(t + 0.1, 0.8, 300, 0.05);
        break;
      }
      case 'build':
        this.tone(t, 'triangle', 90, 55, 0.16, 0.3);
        this.noiseBurst(t, 0.09, 350, 0.18);
        break;
      case 'sell':
        this.tone(t, 'triangle', 200, 320, 0.12, 0.16);
        break;
      case 'coin':
        this.tone(t, 'sine', 880, 880, 0.07, 0.14);
        this.tone(t + 0.07, 'sine', 1320, 1320, 0.09, 0.12);
        break;
      case 'blessing': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => this.tone(t + i * 0.07, 'sine', f, f * 1.01, 0.22, 0.1));
        break;
      }
      case 'victory': {
        const notes = [392, 523, 659, 784];
        notes.forEach((f, i) => this.tone(t + i * 0.13, 'triangle', f, f, 0.3, 0.18));
        break;
      }
      case 'defeat':
        this.tone(t, 'sawtooth', 165, 82, 1.4, 0.2);
        this.tone(t + 0.05, 'sawtooth', 110, 55, 1.6, 0.16);
        break;
    }
  }

  private tone(
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private swell(t: number, freq: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    for (const detune of [-6, 0, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    gain.connect(lp).connect(this.master!);
  }

  private noiseBurst(t: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(lp).connect(gain).connect(this.master!);
    src.start(t);
  }

  // Wind bed: looped filtered noise + a deep drone, very quiet.
  private startAmbient(): void {
    const ctx = this.ctx!;
    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0.05;
    this.ambient.connect(this.master!);

    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = brown * 3.5;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 480;
    wind.connect(windLp).connect(this.ambient);
    wind.start();

    // Slow wind gusts via LFO on the filter.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(windLp.frequency);
    lfo.start();

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.35;
    drone.connect(droneGain).connect(this.ambient);
    drone.start();
  }
}

export const audio = new AudioEngine();
