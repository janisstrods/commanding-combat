// Small synthesized sound effects (Web Audio, no audio files). Muted state is remembered in localStorage.
import { storage } from './storage';

const MUTE_KEY = 'cce-muted';

let ctx: AudioContext | null = null;
let muted = storage.get(MUTE_KEY) === '1';

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  storage.set(MUTE_KEY, m ? '1' : '0');
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(a.sampleRate * seconds));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function burst(a: AudioContext, t: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur);
}

function tone(a: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, gain: number, endFreq?: number) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  o.connect(lp).connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  /** A Fate card turned over. */
  card() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, 0.2);
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(3400, t + 0.18);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  },
  /** One rifle crack. */
  shot() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    burst(a, t, 0.07, 2600, 0.9, 0.32);
    burst(a, t + 0.01, 0.35, 420, 0.6, 0.12, 'lowpass');
  },
  /** A machine-gun burst. */
  burst(rounds = 6) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < Math.min(12, rounds); i++) {
      burst(a, t + i * 0.075, 0.05, 2000 + Math.random() * 600, 1, 0.22);
      burst(a, t + i * 0.075, 0.12, 300, 0.7, 0.08, 'lowpass');
    }
  },
  /** Artillery or a mortar landing. */
  boom() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    tone(a, t, 90, 0.7, 'sine', 0.4, 32);
    burst(a, t, 0.9, 260, 0.5, 0.3, 'lowpass');
  },
  /** A unit breaks or is eliminated. */
  hit() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    tone(a, t, 180, 0.22, 'triangle', 0.18, 70);
  },
  /** Boots on the move. */
  step() {
    const a = ac();
    if (!a) return;
    burst(a, a.currentTime, 0.05, 260, 1.4, 0.07);
  },
  /** The turn passes to the other player. */
  turn() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    tone(a, t, 440, 0.16, 'triangle', 0.05);
    tone(a, t + 0.11, 587.3, 0.22, 'triangle', 0.05);
  },
  /** A whistle (Time trigger, Sudden Death check). */
  whistle() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    tone(a, t, 2100, 0.45, 'sine', 0.05, 2300);
  },
  victory() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    [392, 523.3, 659.3, 784].forEach((f, i) => tone(a, t + i * 0.16, f, 0.6, 'square', 0.035));
  },
  defeat() {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    [392, 349.2, 311.1, 261.6].forEach((f, i) => tone(a, t + i * 0.22, f, 0.6, 'triangle', 0.07));
  },
};
