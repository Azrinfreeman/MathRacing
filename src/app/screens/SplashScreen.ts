/**
 * The launch splash. Its markup and styles are inline in index.html, so it shows before any script runs (and
 * offline). This module takes it over: it sets the language, adds the cars, waits until the app is ready and a
 * minimum time has passed, then fades it out and removes it. It moves on by itself; a tap only makes it quicker.
 * It shows once per browser tab: a reload in the same tab skips it.
 */
export type SplashOptions = {
  /** Shortest time on screen, so the brand does not just flash. */
  minMs: number;
  /** Longest time on screen, even if `ready` never settles. */
  maxMs: number;
  /** Work to finish before leaving (for example preloading the game engine). Failures are ignored. */
  ready?: Promise<unknown>;
  tagline: string;
  status: string;
  /** Vehicle SVG markup for the cars that drive across. */
  cars: readonly string[];
  /** The teacher's "reduce motion" setting: no driving cars and no fade. */
  still: boolean;
};

const SEEN_KEY = 'mathracing.splashShown';

function seenThisTab(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: the splash simply shows again next time
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSplash(opts: SplashOptions): Promise<void> {
  const el = document.getElementById('splash');
  if (!el) return;
  if (seenThisTab()) {
    el.remove();
    return;
  }
  markSeen();

  const tagline = el.querySelector('[data-splash-tagline]');
  if (tagline) tagline.textContent = opts.tagline;
  const status = el.querySelector('[data-splash-status]');
  if (status) status.textContent = opts.status;
  el.querySelectorAll<HTMLElement>('.splash-car').forEach((slot, i) => {
    const car = opts.cars[i % Math.max(1, opts.cars.length)];
    if (car) slot.innerHTML = car;
  });
  el.classList.toggle('splash-still', opts.still);
  el.classList.add('splash-live');

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      el.removeEventListener('pointerdown', finish);
      document.removeEventListener('keydown', finish);
      resolve();
    };
    void Promise.all([
      sleep(opts.minMs),
      (opts.ready ?? Promise.resolve()).catch(() => undefined),
    ]).then(finish);
    setTimeout(finish, opts.maxMs);
    el.addEventListener('pointerdown', finish);
    document.addEventListener('keydown', finish);
  });

  el.classList.add('splash-out');
  await sleep(opts.still ? 0 : 350);
  el.remove();
}
