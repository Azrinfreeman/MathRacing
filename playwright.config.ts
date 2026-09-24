import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Newest modification time (ms) of anything that goes into the production bundle. */
function newestSourceTime(): number {
  let newest = 0;
  const visit = (p: string): void => {
    const s = statSync(p);
    if (s.isDirectory()) for (const name of readdirSync(p)) visit(path.join(p, name));
    else newest = Math.max(newest, s.mtimeMs);
  };
  for (const p of ['src', 'public', 'index.html', 'vite.config.ts', 'package.json'])
    if (existsSync(p)) visit(p);
  return newest;
}

// The suite tests the production build (the service worker only exists there). Rebuild only when the
// bundle is older than the sources: a fresh dist is reused, so repeat runs skip the ~1 minute build and
// never test a stale bundle. Set E2E_REBUILD=1 to force a rebuild. Workers re-load this file, so only the
// main process builds.
const distIndex = path.join('dist', 'index.html');
const stale =
  process.env.E2E_REBUILD === '1' ||
  !existsSync(distIndex) ||
  statSync(distIndex).mtimeMs < newestSourceTime();
if (stale && process.env.TEST_WORKER_INDEX === undefined) {
  console.log('e2e: dist is missing or older than the sources, building...');
  execSync('npm run build', { stdio: 'inherit' });
}

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    acceptDownloads: true,
    serviceWorkers: 'allow',
    // Optional installed browser when the pinned Playwright browser is unavailable locally.
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
