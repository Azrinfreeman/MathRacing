import { describe, expect, it } from 'vitest';
import { getDefaultRegistry } from '../curriculum/registry';
import type { GeneratedQuestion, Level } from '../curriculum/schema';
import type { VisualModel } from '../curriculum/visual';
import { SeededRng } from '../game/core/SeededRng';
import { blockLayout, equalGroupLayout, tenFrameCells } from '../game/ui/countLayout';
import type { Rect } from '../game/ui/geometry';
import { computePanelZones, computePromptLayout, computeStageLayout } from '../game/ui/layout';

const registry = getDefaultRegistry();

/** The picture area PanelView gives a question: the equation line (Tahap 2) or the cue badge shares the prompt zone. */
function pictureArea(w: number, h: number, players: number, q: GeneratedQuestion): Rect {
  const panel = computeStageLayout(w, h, players).panels[0] as Rect;
  const prompt = computePanelZones(panel, { hasVisual: true, showAnswerField: true }).prompt;
  return computePromptLayout(prompt, {
    hasExpression: q.prompt.showExpression === true,
    hasCue: (q.prompt.cue ?? 'none') !== 'none',
  }).visual;
}

/** Size in px of one counted thing (object cell, rod width, group cell). Null for other pictures. */
function thingSize(v: VisualModel, area: Rect): number | null {
  switch (v.kind) {
    case 'ten-frames': {
      const n = v.groups.length;
      const w = (area.w - area.w * 0.04 * (n - 1)) / n;
      return Math.min(...v.groups.map((g) => tenFrameCells(g.count, { ...area, w }).cell));
    }
    case 'base-ten': {
      const n = v.sets.length;
      const w = (area.w - area.w * 0.05 * (n - 1)) / n;
      return Math.min(...v.sets.map((b) => blockLayout(b, { ...area, w }).unit));
    }
    case 'equal-groups':
      return equalGroupLayout(v.groups, v.perGroup, area).cell;
    default:
      return null;
  }
}

describe('counting pictures stay countable (DECISIONS #42)', () => {
  it('ten-frames fill cells in reading order, 10 per frame', () => {
    const { cells, frames } = tenFrameCells(13, { x: 0, y: 0, w: 300, h: 100 });
    expect(frames).toHaveLength(2);
    expect(cells).toHaveLength(13);
    // the 6th object starts the second row of the first frame
    expect(cells[5]?.x).toBeCloseTo(cells[0]?.x ?? 0);
    expect(cells[5]?.y).toBeGreaterThan(cells[0]?.y ?? 0);
  });

  it('base-ten blocks: one flat, rod and cube per unit of each place', () => {
    const { blocks } = blockLayout(
      { hundreds: 2, tens: 3, ones: 7 },
      { x: 0, y: 0, w: 400, h: 100 },
    );
    expect(blocks.filter((b) => b.kind === 'hundred')).toHaveLength(2);
    expect(blocks.filter((b) => b.kind === 'ten')).toHaveLength(3);
    expect(blocks.filter((b) => b.kind === 'one')).toHaveLength(7);
  });

  // Base-ten blocks for Year 2 levels 3-4 (up to 999 as two sets) are the one known tight case on a small
  // tablet with 5 players: at least 4 px there, 5 px at 1280x800 (5.4 px: the cue badge takes a strip at the
  // left since #45, which this test used to hide by assuming a sum line), 6 px from 1920x1080 up (DECISIONS #42).
  it.each([
    [960, 540, 4],
    [1024, 600, 4],
    [1280, 800, 5],
    [1920, 1080, 6],
  ])('%ix%i, 5 players: counted things at least 6 px (blocks %i px)', (w, h, blockMin) => {
    const problems: string[] = [];
    for (const pack of registry.allPacks()) {
      for (const template of pack.templates) {
        for (const level of [1, 2, 3, 4] as Level[]) {
          for (let i = 0; i < 60; i++) {
            const q = registry.generate({
              templateId: template.id,
              rng: new SeededRng(`count:${template.id}:${level}:${i}`),
              level,
              language: 'bm',
              questionId: 'c',
            });
            const area = pictureArea(w, h, 5, q);
            for (const v of [q.prompt.visual, q.hintVisual]) {
              if (!v) continue;
              const size = thingSize(v, area);
              const min = v.kind === 'base-ten' ? blockMin : 6;
              if (size !== null && size < min)
                problems.push(`${template.id} L${level}: ${v.kind} thing ${size.toFixed(1)} px`);
            }
          }
        }
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });
});
