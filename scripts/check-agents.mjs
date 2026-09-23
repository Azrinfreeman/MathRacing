// Keeps AGENTS.md honest: every `npm run <script>` it mentions must exist in package.json and every
// repo path it mentions in backticks must exist. Run with: npm run docs:agents (also part of `npm run check`).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const text = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
const problems = [];

for (const m of text.matchAll(/npm run ([a-z0-9:-]+)/g))
  if (!(m[1] in scripts)) problems.push(`npm script "${m[1]}" is not in package.json`);

const PATH_ROOTS = /^(src|e2e|docs|scripts|public|\.claude)\//;
for (const m of text.matchAll(/`([^`\s]+)`/g)) {
  const p = m[1];
  if (!PATH_ROOTS.test(p) || /[*<>]/.test(p)) continue;
  // A path may be shorthand relative to src/ (e.g. `storage/settings.ts`), so only check the roots above.
  if (!existsSync(path.join(root, p))) problems.push(`path "${p}" does not exist`);
}

const lineCount = text.split('\n').length;
if (lineCount > 150) problems.push(`AGENTS.md is ${lineCount} lines (limit 150): trim it`);

if (problems.length > 0) {
  console.error(`AGENTS.md is out of date:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`AGENTS.md ok (${lineCount} lines)`);
