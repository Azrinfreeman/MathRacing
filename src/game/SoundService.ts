export type SoundName =
  'click' | 'correct' | 'gentle' | 'setback' | 'tick' | 'go' | 'ready' | 'win';

type Note = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ freq: 520, start: 0, dur: 0.05, gain: 0.5 }],
  correct: [
    { freq: 659, start: 0, dur: 0.11 },
    { freq: 880, start: 0.09, dur: 0.16 },
  ],
  // A wrong answer gets a soft, short, low note: never a buzzer, never punishing.
  gentle: [{ freq: 294, start: 0, dur: 0.14, type: 'sine', gain: 0.45 }],
  // A setback is two soft descending low notes ("aww", not a buzzer), quieter than the correct chime.
  setback: [
    { freq: 330, start: 0, dur: 0.16, type: 'sine', gain: 0.45 },
    { freq: 262, start: 0.15, dur: 0.24, type: 'sine', gain: 0.45 },
  ],
  tick: [{ freq: 740, start: 0, dur: 0.07, gain: 0.6 }],
  go: [
    { freq: 660, start: 0, dur: 0.1 },
    { freq: 990, start: 0.1, dur: 0.22 },
  ],
  ready: [{ freq: 600, start: 0, dur: 0.09, gain: 0.7 }],
  win: [
    { freq: 523, start: 0, dur: 0.14 },
    { freq: 659, start: 0.13, dur: 0.14 },
    { freq: 784, start: 0.26, dur: 0.14 },
    { freq: 1047, start: 0.39, dur: 0.34 },
  ],
};

/**
 * Tiny synthesiser for feedback sounds. All sounds are generated at runtime (no audio files, nothing to
 * download or license). Volume defaults to a conservative level and sound can be switched off entirely.
 */
export class SoundService {
  private ctx: AudioContext | null = null;
  private failed = false;

  constructor(
    private enabled: boolean,
    private readonly volume = 0.2,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Create/resume the audio context. Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (!this.enabled || this.failed) return;
    try {
      if (!this.ctx) {
        const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (error) {
      this.failed = true;
      this.onError(error);
    }
  }

  play(name: SoundName): void {
    if (!this.enabled || this.failed) return;
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      for (const note of SOUNDS[name]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.type ?? 'triangle';
        osc.frequency.value = note.freq;
        const peak = this.volume * (note.gain ?? 1);
        const start = t0 + note.start;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + note.dur + 0.02);
      }
    } catch (error) {
      this.failed = true;
      this.onError(error);
    }
  }

  close(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') void ctx.close();
  }
}
