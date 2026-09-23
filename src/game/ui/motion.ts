import type { SpeedState } from '../core/cruise';

export type Direction = 'forward' | 'backward' | 'still';

/** Spring rates (per second). A critically damped spring never overshoots; larger is faster. */
const FORWARD_RATE = 16;
/** Backward is deliberately slower and softer, so a setback reads as "rolling back", not a crash. */
const BACKWARD_RATE = 7;
const SETTLE_DISTANCE = 0.002;
const SETTLE_VELOCITY = 0.02;
const WOBBLE_MS = 520;
const HIGHLIGHT_MS = 320;

/**
 * Motion of one racer along the track, with no Phaser dependency so it can be unit-tested.
 *
 * `progress` is in race steps (0..raceLength) and is fractional while moving. It follows its target with a
 * critically damped spring using the exact closed-form solution, so the result is identical at 30, 60 or 144
 * frames per second (and after a long stalled frame). Retargeting mid-move keeps position and velocity, so
 * there is never a jump.
 *
 * Cruise movement uses `follow`: the target is the engine's distance, moved every frame, and the spring
 * trails it smoothly (it softens the change of speed when a boost starts or ends and never overshoots).
 */
export class CarMotion {
  /** Displayed position in steps. */
  progress = 0;
  /** Signed speed in steps per second. */
  velocity = 0;
  /** Signed acceleration in steps per second squared (for the nose-up / nose-down lean). */
  accel = 0;
  /** Total signed distance rolled, in steps: the view turns this into a wheel angle. */
  travelled = 0;
  /** Milliseconds left of the reduced-motion highlight (a static cue that the position changed). */
  highlightMs = 0;
  /** Milliseconds left of the backward wobble. */
  wobbleMs = 0;
  /** Cruise: how the engine says the car is moving ('stopped' in step movement). */
  speedState: SpeedState = 'stopped';
  private goal = 0;

  get target(): number {
    return this.goal;
  }

  get direction(): Direction {
    // A cruising car is always driving forward, even when the spring has almost caught up with it.
    if (this.speedState !== 'stopped') return 'forward';
    const diff = this.goal - this.progress;
    if (Math.abs(diff) <= SETTLE_DISTANCE) return 'still';
    return diff > 0 ? 'forward' : 'backward';
  }

  get moving(): boolean {
    return this.direction !== 'still';
  }

  /** Sideways shake in -1..1 while a setback is settling (0 otherwise). */
  get wobble(): number {
    if (this.wobbleMs <= 0) return 0;
    const t = 1 - this.wobbleMs / WOBBLE_MS;
    return Math.sin(t * Math.PI * 5) * (1 - t);
  }

  setTarget(target: number, reducedMotion: boolean, immediate = false): void {
    if (target === this.goal && !immediate) return;
    const backward = target < this.goal;
    this.goal = target;
    if (immediate || reducedMotion) {
      const changed = target !== this.progress;
      this.progress = target;
      this.velocity = 0;
      this.accel = 0;
      this.wobbleMs = 0;
      // Reduced motion: no travel, no wobble; a short static highlight tells the class something changed.
      this.highlightMs = reducedMotion && changed && !immediate ? HIGHLIGHT_MS : 0;
      return;
    }
    if (backward) this.wobbleMs = WOBBLE_MS;
  }

  /** Cruise: follow the engine's distance. Call every frame before `step`. */
  follow(distance: number, speedState: SpeedState, reducedMotion: boolean): void {
    this.speedState = speedState;
    this.goal = distance;
    if (reducedMotion) this.progress = distance;
  }

  /** Reduced motion: a short static highlight (the car's speed changed, but nothing animates). */
  flash(reducedMotion: boolean): void {
    if (reducedMotion) this.highlightMs = HIGHLIGHT_MS;
  }

  /** Advance by `dtMs` milliseconds. */
  step(dtMs: number, reducedMotion: boolean): void {
    const dt = Math.max(0, dtMs);
    this.highlightMs = Math.max(0, this.highlightMs - dt);
    if (reducedMotion) {
      this.progress = this.goal;
      this.velocity = 0;
      this.accel = 0;
      this.wobbleMs = 0;
      return;
    }
    this.wobbleMs = Math.max(0, this.wobbleMs - dt);
    if (dt === 0) return;

    if (
      // A cruising car never settles: snapping would make it stop and start again every few frames.
      this.speedState === 'stopped' &&
      Math.abs(this.goal - this.progress) < SETTLE_DISTANCE &&
      Math.abs(this.velocity) < SETTLE_VELOCITY
    ) {
      this.progress = this.goal;
      this.velocity = 0;
      this.accel = 0;
      return;
    }

    const w = this.goal < this.progress ? BACKWARD_RATE : FORWARD_RATE;
    const t = dt / 1000;
    const a = this.progress - this.goal;
    const b = this.velocity + w * a;
    const decay = Math.exp(-w * t);
    const next = this.goal + (a + b * t) * decay;
    const nextVelocity = (b - w * (a + b * t)) * decay;
    this.travelled += next - this.progress;
    this.progress = next;
    this.velocity = nextVelocity;
    this.accel = -w * w * (next - this.goal) - 2 * w * nextVelocity;
  }
}
