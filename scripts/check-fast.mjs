// Fast, scoped check for work in progress: only what the changed files need. Run with: npm run check:fast
//   - typecheck when any ts file changed (it is whole-project but fast)
//   - eslint on the changed ts/js/mjs files only
//   - vitest on the unit tests related to the changed src files
//   - prettier --check on changed docs/config
// It does NOT replace `npm run check` + `npm run test:e2e`, which run once before committing a multi-file change.
import { spawnSync } from 'node:child_process';

function run(label, command) {
  const started = Date.now();
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status === 0) {
    console.log(`ok   ${label} (${seconds}s)`);
    return true;
  }
  // Output only on failure, to keep logs (and agent context) small.
  console.log(`FAIL ${label} (${seconds}s)`);
  console.log(`${result.stdout ?? ''}${result.stderr ?? ''}`.trim());
  return false;
}

function lines(command) {
  const r = spawnSync(command, { shell: true, encoding: 'utf8' });
  return (r.stdout ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

const changed = [
  ...new Set([
    ...lines('git diff --name-only HEAD'),
    ...lines('git ls-files --others --exclude-standard'),
  ]),
].filter((f) => !f.startsWith('dist/') && !f.includes('node_modules/'));

const code = changed.filter((f) => /\.(ts|js|mjs)$/.test(f));
const src = code.filter((f) => f.startsWith('src/'));
const formatted = changed.filter(
  (f) => /\.(ts|js|mjs|json|md)$/.test(f) && f !== 'package-lock.json',
);

if (changed.length === 0) {
  console.log('No changed files: nothing to check.');
  process.exit(0);
}
console.log(`${changed.length} changed file(s), ${code.length} code.`);

let ok = true;
if (code.length > 0) {
  ok = run('typecheck', 'npx tsc --noEmit') && ok;
  ok = run('eslint (changed)', `npx eslint ${code.join(' ')}`) && ok;
}
if (src.length > 0) {
  ok = run('vitest related', `npx vitest related --run ${src.join(' ')}`) && ok;
}
if (formatted.length > 0) {
  ok = run('prettier (changed)', `npx prettier --check ${formatted.join(' ')}`) && ok;
}
console.log(
  ok
    ? 'check:fast passed. Run `npm run check` and `npm run test:e2e` before a big commit.'
    : 'check:fast FAILED.',
);
process.exit(ok ? 0 : 1);
