/**
 * Countdown beeps and the end-of-round bell, synthesised (no audio files, no licences).
 * iOS only lets audio start after a user gesture: call unlockAudio() from a tap.
 * Note: the iPhone's silent switch mutes Web Audio.
 */

let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, gain, delay = 0, type = 'sine') {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const beep = () => tone(880, 0.14, 0.25);
export const go = () => tone(1320, 0.35, 0.3);
export const bell = () => {
  tone(660, 1.6, 0.28, 0, 'triangle');
  tone(990, 1.2, 0.12, 0.02, 'sine');
};
