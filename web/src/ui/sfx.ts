/**
 * Tiny procedural chiptune SFX via WebAudio. No audio assets; muted state is
 * remembered. AudioContext is created lazily on the first user gesture.
 */
type Cue = 'move' | 'confirm' | 'good' | 'bad' | 'win' | 'lose' | 'open';

let ac: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('gameclaw:muted') === '1';
  } catch {
    return false;
  }
})();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem('gameclaw:muted', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ctx(): AudioContext | null {
  if (muted) return null;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  if (!ac && activation && !activation.hasBeenActive) return null;
  if (!ac) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  vol = 0.06,
  slide = 0,
): void {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const gain = a.createGain();
  const t0 = a.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gain).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function sfx(cue: Cue): void {
  if (muted) return;
  switch (cue) {
    case 'move':
      tone(660, 0, 0.04, 'square', 0.025);
      break;
    case 'open':
      tone(392, 0, 0.08, 'square', 0.04);
      tone(587, 0.07, 0.12, 'square', 0.04);
      break;
    case 'confirm':
      tone(523, 0, 0.06, 'square', 0.05);
      tone(784, 0.05, 0.08, 'square', 0.04);
      break;
    case 'good':
      tone(659, 0, 0.07, 'triangle', 0.07);
      tone(988, 0.06, 0.12, 'triangle', 0.06);
      break;
    case 'bad':
      tone(220, 0, 0.18, 'sawtooth', 0.05, -120);
      break;
    case 'win':
      for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, i * 0.1, 0.2, 'square', 0.05);
      break;
    case 'lose':
      for (const [i, f] of [392, 330, 262, 196].entries())
        tone(f, i * 0.14, 0.24, 'triangle', 0.06);
      break;
  }
}
