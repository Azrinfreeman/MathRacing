/**
 * Cruise movement: every car drives forward at the same base pace; a correct answer adds a boost (a fixed
 * extra distance delivered at a fixed extra speed) and a wrong answer slows the car for a while. Pure, with
 * no clock: time is always passed in.
 *
 * Speed only changes at known moments (a slow-down ending, a boost running out), so between those moments
 * it is constant and distance is exact arithmetic. That makes the result identical however the time is
 * sliced into frames, and gives the exact moment a car reaches the finish.
 */

export type CruiseConfig = {
  /** Base pace: milliseconds per race step with no answers. */
  cruiseStepMs: number;
  /** Extra distance (in steps) one correct answer adds. */
  boostSteps: number;
  /** Time over which that extra distance is delivered. */
  boostMs: number;
  /** Speed multiplier (0..1) while slowed. It never drops to 0, so a car always reaches the finish. */
  slowFactor: number;
  /** How long a slow-down lasts; each wrong answer restarts it (it never stacks). */
  slowMs: number;
};

export const DEFAULT_CRUISE: CruiseConfig = {
  cruiseStepMs: 15000,
  boostSteps: 1,
  boostMs: 1200,
  slowFactor: 0.3,
  slowMs: 2500,
};

export type SpeedState = 'cruise' | 'boost' | 'slow' | 'stopped';

/** The moving part of one racer. */
export type CruiseBody = {
  /** Position in steps (fractional). */
  distance: number;
  /** Boost distance still to be delivered, in steps. */
  boostLeft: number;
  /** The slow-down lasts while time is before this (monotonic ms). */
  slowUntilMs: number;
};

export function boostRate(config: CruiseConfig): number {
  return config.boostSteps / config.boostMs;
}

/** Speed in steps per millisecond at `atMs`. */
export function speedAt(body: CruiseBody, atMs: number, config: CruiseConfig): number {
  const base = 1 / config.cruiseStepMs;
  const slowed = atMs < body.slowUntilMs;
  return base * (slowed ? config.slowFactor : 1) + (body.boostLeft > 0 ? boostRate(config) : 0);
}

export function speedStateAt(body: CruiseBody, atMs: number): SpeedState {
  if (body.boostLeft > 0) return 'boost';
  if (atMs < body.slowUntilMs) return 'slow';
  return 'cruise';
}

/** A correct answer: cancel any slow-down and queue one boost (boosts add up; nothing is lost). */
export function applyBoost(body: CruiseBody, atMs: number, config: CruiseConfig): void {
  body.slowUntilMs = Math.min(body.slowUntilMs, atMs);
  body.boostLeft += config.boostSteps;
}

/** A wrong answer: slow down for `slowMs` from now (restarts, never deeper). */
export function applySlow(body: CruiseBody, atMs: number, config: CruiseConfig): void {
  body.slowUntilMs = atMs + config.slowMs;
}

/**
 * Move `body` from `fromMs` to `toMs`. If it reaches `finish` on the way it stops there and the exact time
 * it got there is returned; otherwise null.
 */
export function advanceCruise(
  body: CruiseBody,
  fromMs: number,
  toMs: number,
  finish: number,
  config: CruiseConfig,
): number | null {
  const base = 1 / config.cruiseStepMs;
  const rate = boostRate(config);
  let t = fromMs;
  while (t < toMs) {
    const slowed = t < body.slowUntilMs;
    const boosting = body.boostLeft > 0;
    let end = toMs;
    if (slowed) end = Math.min(end, body.slowUntilMs);
    const boostEnd = boosting ? t + body.boostLeft / rate : Infinity;
    const boostRunsOut = boostEnd <= end;
    if (boostRunsOut) end = boostEnd;
    const speed = base * (slowed ? config.slowFactor : 1) + (boosting ? rate : 0);
    const dt = end - t;
    const gap = finish - body.distance;
    if (speed * dt >= gap) {
      const cross = t + gap / speed;
      if (boosting) body.boostLeft = Math.max(0, body.boostLeft - rate * (cross - t));
      body.distance = finish;
      return cross;
    }
    body.distance += speed * dt;
    // Snap to exactly 0 at the boost's end so float crumbs can never make an endless tiny segment.
    if (boosting) body.boostLeft = boostRunsOut ? 0 : body.boostLeft - rate * dt;
    t = end;
  }
  return null;
}
