// Generates docs/CURRICULUM-MAPPING.md from the real curriculum registry, so the document can never drift
// from what is implemented. Run with: npm run docs:curriculum
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
  // Only the curriculum modules are loaded, so skip dependency pre-bundling (and its scan of index.html).
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { getDefaultRegistry } = await server.ssrLoadModule('/src/curriculum/registry.ts');
  const registry = getDefaultRegistry();
  const cell = (s) => String(s).replace(/\|/g, '\\|');

  const lines = [];
  lines.push('# Curriculum mapping');
  lines.push('');
  lines.push(
    '> Generated from the live curriculum registry by `npm run docs:curriculum`. Do not edit by hand: change the templates and regenerate.',
  );
  lines.push('');
  lines.push('## Source of truth and status');
  lines.push('');
  lines.push(
    '- Scope and SK ranges are copied from sections 5 and 6 of `output/pdf/MathRacing_KPM_Year1_Year2_Game_Plan.pdf` (KSSR Semakan 2017, Dokumen Penjajaran Edisi 3, Matematik Tahap I).',
  );
  lines.push(
    '- **The plan lists SK ranges per topic but no SP (Standard Pembelajaran) codes.** No SP code has been invented: every template carries the topic\'s SK range exactly as printed in the plan, and an empty SP list. A qualified reviewer must add verified SP codes (and may narrow the SK range per template) before classroom deployment.',
  );
  lines.push(
    '- Every pack is marked `draft-pending-academic-review` with `reviewer: null`. Nothing here has been signed off by a Malaysian primary Mathematics educator.',
  );
  lines.push(
    '- Topic titles in Bahasa Melayu are working labels for the plan\'s English topic names, not quotations of official KPM wording.',
  );
  lines.push('');

  let total = 0;
  for (const pack of registry.allPacks()) {
    lines.push(`## ${pack.title.en} (\`${pack.packId}\` v${pack.version})`);
    lines.push('');
    lines.push(`Basis: ${pack.basis}. Effective date recorded: ${pack.effectiveDate}. Templates: ${pack.templates.length}.`);
    lines.push('');
    for (const topic of pack.topics) {
      const templates = registry.templatesForTopic(pack.packId, topic.id);
      total += templates.length;
      lines.push(`### ${topic.code} ${topic.title.bm} / ${topic.title.en} (SK ${topic.standardKandungan})`);
      lines.push('');
      lines.push(`Plan scope: ${topic.scope}`);
      lines.push('');
      lines.push('| Template | Widget | Scope reference (from the plan) | Level 1 | Level 2 | Level 3 | Level 4 | Remainder | Depends on |');
      lines.push('|---|---|---|---|---|---|---|---|---|');
      for (const t of templates) {
        const rem = t.remainderAllowed === null ? 'n/a' : t.remainderAllowed ? 'asked as quotient or remainder' : 'exact division only';
        lines.push(
          `| \`${t.id}\` | ${t.widget} | ${cell(t.scope)} | ${t.levelNotes.map(cell).join(' | ')} | ${rem} | ${t.prerequisites.length ? t.prerequisites.map((p) => `\`${p}\``).join(', ') : '-'} |`,
        );
      }
      lines.push('');
    }
  }

  const byWidget = new Map();
  for (const pack of registry.allPacks()) for (const t of pack.templates) byWidget.set(t.widget, (byWidget.get(t.widget) ?? 0) + 1);
  lines.push('## Coverage summary');
  lines.push('');
  lines.push(`- Templates in total: **${total}** (Year 1: ${registry.packForYear(1).templates.length}, Year 2: ${registry.packForYear(2).templates.length}).`);
  lines.push(`- Templates per widget: ${[...byWidget.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  lines.push('- Every template has 4 explicit difficulty levels, at least one worked fixture and an entry in the test suite that generates 1,000 samples per level (arithmetic) or 250 per level (other) and checks validity, determinism and a single defensible answer.');
  lines.push('');
  lines.push('## Difficulty levels');
  lines.push('');
  lines.push('The teacher chooses one level (1-4) for the whole race; every player gets the same level. For Year 1 number topics the levels follow the plan\'s recommended progression (within 10, 20, 50, then 100). The level a question was generated at is stored with every attempt.');
  lines.push('');
  lines.push('## Known gaps and assumptions');
  lines.push('');
  lines.push('- **SP codes:** not present in the plan; left empty (see above).');
  lines.push('- **Year 1 composition of shapes** ("choose shapes used to build a robot"): not implemented. It needs a composite-figure visual; the shape-naming, shape-property, counting and pattern templates are implemented.');
  lines.push('- **Clock picker and shape drawing widgets** from the plan\'s widget table are not implemented. Time is covered by reading a clock and matching a written time to a clock (choice tiles); 2D properties by choice and counting.');
  lines.push('- **Year 2 decimals on a number line** and **mass scale / estimation against 800 g** are not implemented. Tenths are covered by matching fractions and decimals and by comparing exactly.');
  lines.push('- **Year 2 multiplication tables** are limited to 2, 3, 4, 5 and 10 (plus one-digit x 10) in the number-pad templates, and division likewise; money division allows divisors up to 10. This is an assumption to confirm with the reviewer.');
  lines.push('- **Year 2 2D shapes** include pentagon, hexagon and octagon with straight-side counts of 5, 6 and 8; the plan does not list the exact shape names, so this is an assumption.');
  lines.push('- **Measurement estimation** is covered by choosing a sensible unit and comparing measurements, not by estimating against a reference object.');
  lines.push('- **Litres** are shown as "L" (capital) because a lowercase "l" is easily read as the digit 1 or a capital I on a classroom screen.');
  lines.push('- **Year 1 2027 pack:** deliberately not created. The plan says to add it only after KPM publishes and validates the Year 1 documents.');
  lines.push('');

  await writeFile(path.join(root, 'docs', 'CURRICULUM-MAPPING.md'), `${lines.join('\n')}\n`, 'utf8');
  console.warn(`wrote docs/CURRICULUM-MAPPING.md (${total} templates)`);
} finally {
  await server.close();
}
