import { describe, expect, it } from 'vitest';
import { getDefaultRegistry } from '../curriculum/registry';
import type { GeneratedQuestion, Level } from '../curriculum/schema';
import { SeededRng } from '../game/core/SeededRng';
import type { DrawContext } from '../game/ui/DrawContext';
import { drawCue } from '../game/ui/cueIcons';
import { computePromptLayout } from '../game/ui/layout';
import { drawVisual } from '../game/ui/VisualRenderer';

const registry = getDefaultRegistry();

function everyQuestion(each: (q: GeneratedQuestion) => void): number {
  let n = 0;
  for (const pack of registry.allPacks()) {
    for (const template of pack.templates) {
      for (const level of [1, 2, 3, 4] as Level[]) {
        for (let i = 0; i < 40; i++) {
          each(
            registry.generate({
              templateId: template.id,
              rng: new SeededRng(`cue:${template.id}:${level}:${i}`),
              level,
              language: 'bm',
              questionId: 'c',
            }),
          );
          n++;
        }
      }
    }
  }
  return n;
}

describe('picture-first questions (DECISIONS #45)', () => {
  it('every question has a picture and a cue', () => {
    const problems: string[] = [];
    const n = everyQuestion((q) => {
      if (!q.prompt.visual) problems.push(`${q.templateId}: no picture`);
      if (q.prompt.cue === undefined) problems.push(`${q.templateId}: no cue`);
    });
    expect(n).toBeGreaterThan(500);
    expect([...new Set(problems)]).toEqual([]);
  });

  it('the cue matches what the question asks for', () => {
    const problems: string[] = [];
    everyQuestion((q) => {
      const { cue } = q.prompt;
      const band = q.difficultyBand;
      const t = q.templateId;
      const fail = (m: string): number => problems.push(`${t} ${band}: ${m}`);
      if (band === 'one-more' && cue !== 'plus-one') fail('one more needs +1');
      if (band === 'one-fewer' && cue !== 'minus-one') fail('one fewer needs -1');
      if (band === 'sides' && cue !== 'sides') fail('sides cue');
      if (band === 'corners' && cue !== 'corners') fail('corners cue');
      if (t.endsWith('fraction-parts') && cue !== 'shaded' && cue !== 'parts') fail('fraction cue');
      if (t.endsWith('clock') || t.endsWith('clock-hour')) {
        const hour = band === 'hour';
        if (cue !== (hour ? 'hour' : 'minute')) fail('clock cue');
      }
      // a sum is a picture too (DECISIONS #46): the badge says "count", never a printed sum
      if (['add', 'sub', 'mul'].some((k) => t.endsWith(`-${k}`)) && cue !== 'count')
        fail('sum badge');
      if (t.endsWith('-div') && cue !== 'each') fail('share badge');
    });
    expect([...new Set(problems)]).toEqual([]);
  });

  it('a bar chart question points at the bar it asks about', () => {
    let seen = 0;
    everyQuestion((q) => {
      const v = q.prompt.visual;
      if (v?.kind !== 'bar-chart') return;
      seen++;
      expect(v.highlight).toBeGreaterThanOrEqual(0);
      const bar = v.categories[v.highlight ?? -1];
      expect(String(bar?.value)).toBe(q.acceptedAnswer.value);
    });
    expect(seen).toBeGreaterThan(0);
  });

  it('prompt layout: parts stay inside the zone and never overlap', () => {
    const zone = { x: 10, y: 20, w: 400, h: 150 };
    for (const [hasExpression, hasCue] of [
      [true, false],
      [false, true],
      [false, false],
    ] as const) {
      const l = computePromptLayout(zone, { hasExpression, hasCue });
      for (const r of [l.expression, l.cue, l.visual]) {
        if (!r) continue;
        expect(r.x).toBeGreaterThanOrEqual(zone.x);
        expect(r.y).toBeGreaterThanOrEqual(zone.y - 1e-9);
        expect(r.x + r.w).toBeLessThanOrEqual(zone.x + zone.w + 1e-9);
        expect(r.y + r.h).toBeLessThanOrEqual(zone.y + zone.h + 1e-9);
      }
      if (l.cue) expect(l.cue.x + l.cue.w).toBeLessThan(l.visual.x);
      if (l.expression) expect(l.expression.y + l.expression.h).toBeLessThanOrEqual(l.visual.y);
    }
  });

  it('draws no text at all: every picture, hint picture and badge is shapes only (DECISIONS #46)', () => {
    const drawn: string[] = [];
    const g = new Proxy({}, { get: () => () => undefined }) as DrawContext['g'];
    const ctx: DrawContext = { g, text: (_key, value) => void drawn.push(value) };
    const area = { x: 0, y: 0, w: 300, h: 160 };
    everyQuestion((q) => {
      if (q.prompt.visual) drawVisual(ctx, q.prompt.visual, area, 'v');
      if (q.hintVisual) drawVisual(ctx, q.hintVisual, area, 'h');
      drawCue(ctx, q.prompt.cue ?? 'none', { x: 0, y: 0, w: 60, h: 60 });
    });
    expect(drawn).toEqual([]);
  });

  it('a pictograph question points at the row it asks about', () => {
    let seen = 0;
    everyQuestion((q) => {
      const v = q.prompt.visual;
      if (v?.kind !== 'pictograph') return;
      seen++;
      expect(String(v.rows[v.highlight ?? -1]?.count)).toBe(q.acceptedAnswer.value);
    });
    expect(seen).toBeGreaterThan(0);
  });
});
