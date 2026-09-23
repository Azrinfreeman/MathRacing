// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSplash } from '../app/screens/SplashScreen';
import type { SplashOptions } from '../app/screens/SplashScreen';

const MARKUP = `<div id="splash" class="splash">
  <p data-splash-tagline>x</p>
  <span class="splash-car"></span><span class="splash-car"></span>
  <p data-splash-status>x</p>
</div>`;

const OPTS: SplashOptions = {
  minMs: 1500,
  maxMs: 6000,
  tagline: 'Lumba matematik',
  status: 'Memuatkan...',
  cars: ['<svg data-car="a"></svg>', '<svg data-car="b"></svg>'],
  still: false,
};

const splash = (): HTMLElement | null => document.getElementById('splash');

/** Advance fake time in small steps, letting promise callbacks run between them. */
async function advance(ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 50) await vi.advanceTimersByTimeAsync(50);
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  document.body.innerHTML = MARKUP;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('launch splash', () => {
  it('does nothing when the page has no splash (tests, embedded use)', async () => {
    document.body.innerHTML = '';
    await expect(runSplash(OPTS)).resolves.toBeUndefined();
  });

  it('fills in the language and cars, stays for the minimum time, then removes itself', async () => {
    let done = false;
    void runSplash(OPTS).then(() => (done = true));
    await advance(100);
    expect(splash()?.querySelector('[data-splash-tagline]')?.textContent).toBe('Lumba matematik');
    expect(splash()?.querySelectorAll('[data-car]')).toHaveLength(2);
    expect(splash()?.classList.contains('splash-live')).toBe(true);
    await advance(1300);
    expect(done).toBe(false);
    await advance(800); // minimum time + fade
    expect(done).toBe(true);
    expect(splash()).toBeNull();
  });

  it('waits for the preload, but never longer than the maximum', async () => {
    let done = false;
    void runSplash({ ...OPTS, ready: new Promise(() => undefined) }).then(() => (done = true));
    await advance(4000);
    expect(done).toBe(false);
    await advance(2500);
    expect(done).toBe(true);
  });

  it('moves on by itself; a tap only makes it quicker', async () => {
    let done = false;
    void runSplash(OPTS).then(() => (done = true));
    await advance(100);
    splash()?.dispatchEvent(new Event('pointerdown'));
    await advance(400);
    expect(done).toBe(true);
  });

  it('shows once per tab: a reload skips it', async () => {
    void runSplash(OPTS);
    await advance(2000);
    document.body.innerHTML = MARKUP;
    await runSplash(OPTS);
    expect(splash()).toBeNull();
  });

  it('keeps the cars still when the teacher asked for reduced motion', async () => {
    void runSplash({ ...OPTS, still: true });
    await advance(100);
    expect(splash()?.classList.contains('splash-still')).toBe(true);
  });
});
