// Procedural synthwave score + synthesized SFX. No external assets.
import { clamp, rand } from './utils.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.musicVol = 0.45;
    this.sfxVol = 0.7;
    this.musicMode = 'menu';
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 96;
    this.sirenGain = null;
    this.engine = null;
    this.ambient = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);

    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // shared filter for music transitions
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 9000;
    this.musicFilter.connect(this.music);
    this.nextTime = this.ctx.currentTime + 0.1;
    this.started = true;
    this.startAmbient();
    this.startEngine();
  }

  resume() {
    this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setVolumes(music, sfx) {
    if (music != null) { this.musicVol = music; if (this.music) this.music.gain.value = this.muted ? 0 : music; }
    if (sfx != null) { this.sfxVol = sfx; if (this.sfx) this.sfx.gain.value = this.muted ? 0 : sfx; }
  }

  startAmbient() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.035;
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    this.ambient = { src, gain: g };
  }

  startEngine() {
    const ctx = this.ctx;
    if (this.engine) return;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 28;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(f); osc2.connect(f); f.connect(g).connect(this.sfx);
    osc.start(); osc2.start();
    this.engine = { osc, osc2, f, g };
  }

  engineUpdate(speed, throttle, active) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const target = active ? clamp(0.03 + speed * 0.0011, 0.03, 0.11) : 0;
    const freq = 42 + speed * 1.4 + throttle * 18;
    this.engine.g.gain.setTargetAtTime(target, t, 0.12);
    this.engine.osc.frequency.setTargetAtTime(freq, t, 0.1);
    this.engine.osc2.frequency.setTargetAtTime(freq * 0.5, t, 0.1);
    this.engine.f.frequency.setTargetAtTime(300 + speed * 8 + throttle * 300, t, 0.15);
  }

  siren(level, active) {
    if (!this.started) return;
    if (!this.sirenGain) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 700;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.9;
      const lg = ctx.createGain(); lg.gain.value = 260;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.sfx);
      o.start(); lfo.start();
      this.sirenGain = { g, o, lfo };
    }
    const t = this.ctx.currentTime;
    this.sirenGain.g.gain.setTargetAtTime(active ? clamp(0.06 * level, 0, 0.16) : 0, t, 0.4);
    if (active) this.sirenGain.lfo.frequency.setTargetAtTime(0.75 + level * 0.1, t, 0.3);
  }

  tone(freq, dur, type = 'sine', vol = 0.1, slide = 0, dest) {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, cutoff = 1200, type = 'lowpass') {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = rand(0.8, 1.2);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t); src.stop(t + dur + 0.02);
  }

  gunshot(kind = 'pistol') {
    if (!this.started) return;
    const specs = {
      pistol: [0.12, 0.42, 1800], shotgun: [0.22, 0.6, 1200], rifle: [0.09, 0.36, 2400],
      smg: [0.07, 0.3, 2000], sniper: [0.3, 0.7, 900], melee: [0.06, 0.25, 700],
    };
    const [d, v, c] = specs[kind] || specs.pistol;
    this.noise(d, v, c);
    this.tone(kind === 'sniper' ? 90 : 140, d, 'sine', v * 0.6, -70);
  }

  explosion() {
    this.noise(1.1, 0.9, 700);
    this.tone(70, 0.9, 'sine', 0.7, -45);
    this.tone(120, 0.4, 'square', 0.25, -80);
  }

  crash(intensity = 1) {
    this.noise(0.18 + intensity * 0.12, 0.25 + intensity * 0.3, 2200);
    this.tone(80, 0.2, 'square', 0.12 * intensity, -40);
  }

  screech() { this.noise(0.35, 0.09, 1600, 'highpass'); }
  footstep() { this.noise(0.045, 0.05, 320); }
  click() { this.tone(880, 0.05, 'sine', 0.05, 300); }
  pickup() { this.tone(660, 0.07, 'sine', 0.08); setTimeout(() => this.tone(990, 0.1, 'sine', 0.08), 60); }
  horn() { this.tone(320, 0.22, 'square', 0.05); this.tone(400, 0.22, 'square', 0.04); }
  whoosh() { this.noise(0.4, 0.14, 900, 'highpass'); }
  fail() { this.tone(220, 0.4, 'sawtooth', 0.12, -90); setTimeout(() => this.tone(160, 0.6, 'sawtooth', 0.1, -60), 180); }
  success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sine', 0.1), i * 90)); }

  // ---- music sequencer ----
  musicTick(dt) {
    if (!this.started || this.musicMode === 'none') return;
    const ctx = this.ctx;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.scheduleStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
    const targetFilt = this.musicMode === 'combat' ? 3800 : this.musicMode === 'menu' ? 2400 : 7000;
    this.musicFilter.frequency.setTargetAtTime(targetFilt, ctx.currentTime, 1.2);
  }

  scheduleStep(step, t, sd) {
    const ctx = this.ctx;
    const mode = this.musicMode;
    if (mode === 'paused') return;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    // chords: Am F C G, in A minor-ish synthwave
    const roots = [55, 43.65, 65.4, 49];
    const chord = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 329.6], [196, 246.9, 293.7]][bar];
    const busy = mode === 'combat';
    const density = mode === 'menu' ? 0.7 : 1;

    // bass pulse 8ths
    if (s % 2 === 0) this.mnote(roots[bar] * (s % 4 === 2 ? 2 : 1), t, sd * 1.6, 'sawtooth', 0.1 * density, 260);
    // kick
    if (s % 4 === 0) this.kick(t, 0.25 * density);
    // snare
    if (s % 8 === 4) this.snare(t, 0.1 * density);
    // hats
    if (s % 2 === 1 && busy) this.hat(t, 0.035);
    // arp
    if (s % 2 === 0 && (s % 4 === 0 || busy || mode === 'menu')) {
      const n = chord[(s / 2) % 3] * (s % 8 === 0 ? 2 : 1);
      this.mnote(n, t, sd * 1.1, 'triangle', 0.035 * density, 3200);
    }
    // pad at bar start
    if (s === 0) {
      chord.forEach((n, i) => this.mnote(n * 0.5, t, sd * 14, 'sine', 0.028, 1200 + i * 200));
    }
    // lead motif every other bar
    if (busy && s === 8) this.mnote(chord[2] * 2, t, sd * 2, 'square', 0.03, 2600);
  }

  mnote(freq, t, dur, type, vol, cutoff) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicFilter);
    o.start(t); o.stop(t + dur + 0.02);
  }
  kick(t, v) {
    const ctx = this.ctx; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.musicFilter); o.start(t); o.stop(t + 0.22);
  }
  snare(t, v) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(f).connect(g).connect(this.musicFilter); src.start(t); src.stop(t + 0.16);
  }
  hat(t, v) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicFilter); src.start(t); src.stop(t + 0.06);
  }
}
