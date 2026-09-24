import { describe, expect, it } from 'vitest';
import { PLAYER_STYLES, contrastRatio } from '../game/core/players';
import type { Rect } from '../game/ui/geometry';
import { contains, flowCells, gridCells, inset, overlaps } from '../game/ui/geometry';
import { computePanelZones, computeStageLayout, trackShare } from '../game/ui/layout';

const VIEWPORTS: Array<[number, number]> = [
  [1280, 720],
  [1920, 1080],
  [3840, 2160],
];

function within(inner: Rect, outer: Rect, tolerance = 0.5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}

describe('geometry helpers', () => {
  it('contains() is inclusive at the top-left and exclusive at the bottom-right', () => {
    const r = { x: 10, y: 10, w: 20, h: 20 };
    expect(contains(r, 10, 10)).toBe(true);
    expect(contains(r, 29.9, 29.9)).toBe(true);
    expect(contains(r, 30, 20)).toBe(false);
    expect(contains(r, 9.9, 20)).toBe(false);
  });

  it('gridCells and flowCells tile an area without overlap', () => {
    const area = { x: 5, y: 5, w: 300, h: 200 };
    for (const cells of [
      gridCells(area, 3, 4, 8),
      flowCells(area, 5, 2, 8),
      flowCells(area, 3, 3, 8),
      flowCells(area, 6, 2, 8),
    ]) {
      cells.forEach((a, i) => {
        expect(within(a, area)).toBe(true);
        cells.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
      });
    }
    expect(flowCells(area, 0, 2, 8)).toEqual([]);
  });

  it('inset never returns a negative size', () => {
    expect(inset({ x: 0, y: 0, w: 10, h: 10 }, 20)).toMatchObject({ w: 0, h: 0 });
  });
});

describe('stage layout', () => {
  it('keeps the shared track within 42-48 percent of the viewport for every player count', () => {
    for (let n = 2; n <= 5; n++) {
      expect(trackShare(n)).toBeGreaterThanOrEqual(0.42);
      expect(trackShare(n)).toBeLessThanOrEqual(0.48);
    }
  });

  it('rejects unsupported player counts', () => {
    expect(() => computeStageLayout(1920, 1080, 0)).toThrow(RangeError);
    expect(() => computeStageLayout(1920, 1080, 6)).toThrow(RangeError);
  });

  describe.each(VIEWPORTS)('viewport %i x %i', (w, h) => {
    it.each([2, 3, 4, 5])(
      'lays out %i equal, independent, non-overlapping panels under the track',
      (n) => {
        const layout = computeStageLayout(w, h, n);
        const viewport: Rect = { x: 0, y: 0, w, h };
        expect(layout.panels).toHaveLength(n);
        expect(within(layout.track, viewport)).toBe(true);
        expect(layout.track.h / h).toBeGreaterThanOrEqual(0.42);
        expect(layout.track.h / h).toBeLessThanOrEqual(0.48);
        const widths = layout.panels.map((p) => p.w);
        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.001);
        layout.panels.forEach((panel, i) => {
          expect(within(panel, viewport)).toBe(true);
          expect(panel.y).toBeGreaterThanOrEqual(layout.track.y + layout.track.h);
          expect(overlaps(panel, layout.track)).toBe(false);
          layout.panels.slice(i + 1).forEach((other) => expect(overlaps(panel, other)).toBe(false));
        });
      },
    );

    it.each([2, 3, 4, 5])(
      'splits every panel into non-overlapping zones with usable controls (%i players)',
      (n) => {
        const layout = computeStageLayout(w, h, n);
        for (const hasVisual of [false, true]) {
          for (const showAnswerField of [false, true]) {
            for (const panel of layout.panels) {
              const z = computePanelZones(panel, { hasVisual, showAnswerField });
              const zones = [z.header, z.prompt, z.answer, z.widget, z.feedback, z.progress].filter(
                (r) => r.h > 0,
              );
              zones.forEach((a, i) => {
                expect(within(a, panel)).toBe(true);
                zones
                  .slice(i + 1)
                  .forEach((b) =>
                    expect(overlaps(a, b), `zones overlap at ${w}x${h} n=${n}`).toBe(false),
                  );
              });
              // room for a touchable keypad: at least ~10% of the viewport height for the widget
              expect(z.widget.h).toBeGreaterThan(h * 0.1);
              expect(z.widget.w).toBeGreaterThan(w * 0.04);
            }
          }
        }
      },
    );
  });

  it('makes the 1080p five-player keypad rows large enough to touch comfortably', () => {
    const layout = computeStageLayout(1920, 1080, 5);
    const panel = layout.panels[0] as Rect;
    const z = computePanelZones(panel, { hasVisual: false, showAnswerField: true });
    const rowHeight = (z.widget.h - 3 * Math.max(4, z.widget.h * 0.03)) / 4;
    const colWidth = (z.widget.w - 2 * Math.max(4, z.widget.h * 0.03)) / 3;
    expect(rowHeight).toBeGreaterThan(50);
    expect(colWidth).toBeGreaterThan(90);
  });

  it('scales with the viewport rather than using fixed pixels', () => {
    const small = computeStageLayout(1280, 720, 5);
    const large = computeStageLayout(3840, 2160, 5);
    expect(large.scale / small.scale).toBeCloseTo(3, 5);
    expect((large.panels[0] as Rect).w / (small.panels[0] as Rect).w).toBeCloseTo(3, 1);
  });
});

describe('player identity palette', () => {
  it('gives every player a distinct colour, symbol and racer silhouette', () => {
    expect(new Set(PLAYER_STYLES.map((s) => s.color)).size).toBe(5);
    expect(new Set(PLAYER_STYLES.map((s) => s.symbol)).size).toBe(5);
    expect(new Set(PLAYER_STYLES.map((s) => s.defaultRacer)).size).toBe(5);
    expect(new Set(PLAYER_STYLES.map((s) => s.colorId)).size).toBe(5);
  });

  it('meets WCAG AA contrast for white text on every player colour', () => {
    for (const s of PLAYER_STYLES) {
      expect(contrastRatio('#ffffff', s.color), s.colorId).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps dark text readable on the light panel tints', () => {
    for (const s of PLAYER_STYLES)
      expect(contrastRatio('#0f172a', s.tint), s.colorId).toBeGreaterThanOrEqual(12);
  });

  it('meets WCAG AA for the teacher-screen text and button colour pairs (see app.css)', () => {
    const pairs: Array<[string, string, string]> = [
      ['body text on card', '#0f172a', '#ffffff'],
      ['muted note on card', '#475569', '#ffffff'],
      ['muted description on chip', '#475569', '#f8fafc'],
      ['selected chip text on tint', '#0f172a', '#e8effe'],
      ['primary button', '#ffffff', '#1d4ed8'],
      ['danger button text', '#b91c1c', '#ffffff'],
      ['error text', '#b91c1c', '#ffffff'],
      ['header text on night blue', '#ffffff', '#0b1d3a'],
      ['toast text', '#ffffff', '#0f172a'],
      ['warning toast', '#ffffff', '#92400e'],
      ['PBD note text on tint', '#0f172a', '#e8effe'],
    ];
    for (const [name, fg, bg] of pairs)
      expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5);
  });

  it('computes known contrast values correctly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
