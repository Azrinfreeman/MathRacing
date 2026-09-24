import { describe, expect, it } from 'vitest';
import { getDefaultRegistry } from '../curriculum/registry';
import type { GeneratedQuestion, Level } from '../curriculum/schema';
import { SeededRng } from '../game/core/SeededRng';
import type { Rect } from '../game/ui/geometry';
import { overlaps } from '../game/ui/geometry';
import { computePanelZones, computeStageLayout } from '../game/ui/layout';
import { createWidget, hitControl } from '../game/widgets';
import type { WidgetControl, WidgetModel } from '../game/widgets';
import { NumberPadWidget } from '../game/widgets/NumberPadWidget';

const registry = getDefaultRegistry();
const AREA: Rect = { x: 100, y: 200, w: 340, h: 250 };

function question(templateId: string, level: Level = 2, seed = 'w'): GeneratedQuestion {
  return registry.generate({
    templateId,
    rng: new SeededRng(seed),
    level,
    language: 'bm',
    questionId: seed,
  });
}

function control(w: WidgetModel, id: string): WidgetControl {
  const c = w.layout(AREA).find((x) => x.id === id);
  if (!c) throw new Error(`no control ${id}`);
  return c;
}

describe('NumberPadWidget', () => {
  it('builds a number from digit taps and submits it as text', () => {
    const w = new NumberPadWidget();
    expect(w.activate('d4')).toEqual({ type: 'changed' });
    w.activate('d7');
    expect(w.responseText()).toBe('47');
    expect(w.activate('submit')).toEqual({ type: 'submit', answer: { kind: 'number', raw: '47' } });
  });

  it('does not submit an empty response and keeps Go disabled until something is typed', () => {
    const w = new NumberPadWidget();
    expect(control(w, 'submit').state).toBe('disabled');
    expect(w.activate('submit')).toEqual({ type: 'none' });
    w.activate('d1');
    expect(control(w, 'submit').state).toBe('normal');
  });

  it('avoids leading zeros and limits the length', () => {
    const w = new NumberPadWidget();
    w.activate('d0');
    w.activate('d5');
    expect(w.responseText()).toBe('5');
    for (const d of ['d1', 'd2', 'd3', 'd4']) w.activate(d);
    expect(w.responseText()).toBe('5123'); // capped at four digits
    expect(w.activate('d9')).toEqual({ type: 'none' });
  });

  it('clears on C and after a wrong answer', () => {
    const w = new NumberPadWidget();
    w.activate('d8');
    expect(w.activate('clear')).toEqual({ type: 'changed' });
    expect(w.isEmpty()).toBe(true);
    w.activate('d8');
    w.onWrong({ kind: 'number', raw: '8' });
    expect(w.responseText()).toBe('');
  });

  it('keeps separate widgets completely independent (no shared state between players)', () => {
    const a = new NumberPadWidget();
    const b = new NumberPadWidget();
    a.activate('d1');
    a.activate('d2');
    b.activate('d9');
    expect(a.responseText()).toBe('12');
    expect(b.responseText()).toBe('9');
  });

  it('lays out digits 1-9, C, 0 and Go in the familiar order', () => {
    const w = new NumberPadWidget();
    expect(w.layout(AREA).map((c) => c.label)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'C',
      '0',
      'Go',
    ]);
  });
  it('on a short panel puts 1-5 and 6-0 in two rows with a wide C and Go below, all larger', () => {
    const short: Rect = { x: 0, y: 0, w: 180, h: 110 };
    const controls = new NumberPadWidget().layout(short);
    expect(controls.map((c) => c.id)).toEqual([
      'd1',
      'd2',
      'd3',
      'd4',
      'd5',
      'd6',
      'd7',
      'd8',
      'd9',
      'd0',
      'clear',
      'submit',
    ]);
    const digit = controls[0] as WidgetControl;
    const go = controls[11] as WidgetControl;
    expect(Math.min(digit.rect.w, digit.rect.h)).toBeGreaterThan(28); // a 3 x 4 pad here gives 24 px
    expect(go.rect.w).toBeGreaterThan(digit.rect.w * 2);
    for (const c of controls) expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(short.h + 0.5);
  });
});

describe('hitControl', () => {
  it('finds the control under a point and ignores disabled controls', () => {
    const w = new NumberPadWidget();
    const controls = w.layout(AREA);
    const one = controls.find((c) => c.id === 'd1') as WidgetControl;
    expect(hitControl(controls, one.rect.x + 2, one.rect.y + 2)?.id).toBe('d1');
    const go = controls.find((c) => c.id === 'submit') as WidgetControl;
    expect(hitControl(controls, go.rect.x + 2, go.rect.y + 2)).toBeNull(); // Go is disabled while empty
    expect(hitControl(controls, 0, 0)).toBeNull();
  });
});

describe('widget layout across every template', () => {
  const layout = computeStageLayout(1920, 1080, 5);
  const panel = layout.panels[0] as Rect;

  it('lays out every generated question with in-bounds, non-overlapping, touch-sized controls', () => {
    const problems: string[] = [];
    for (const pack of registry.allPacks()) {
      for (const template of pack.templates) {
        for (const level of [1, 2, 3, 4] as Level[]) {
          const q = question(template.id, level, `layout:${template.id}:${level}`);
          const widget = createWidget(q);
          const zones = computePanelZones(panel, {
            hasVisual: q.prompt.visual !== undefined,
            showAnswerField: widget.showAnswerField,
          });
          const controls = widget.layout(zones.widget);
          controls.forEach((a, i) => {
            const inside =
              a.rect.x >= zones.widget.x - 0.5 &&
              a.rect.y >= zones.widget.y - 0.5 &&
              a.rect.x + a.rect.w <= zones.widget.x + zones.widget.w + 0.5 &&
              a.rect.y + a.rect.h <= zones.widget.y + zones.widget.h + 0.5;
            if (!inside) problems.push(`${template.id} L${level}: ${a.id} outside widget zone`);
            if (Math.min(a.rect.w, a.rect.h) < 36)
              problems.push(
                `${template.id} L${level}: ${a.id} too small (${a.rect.w.toFixed(0)}x${a.rect.h.toFixed(0)})`,
              );
            controls.slice(i + 1).forEach((b) => {
              if (overlaps(a.rect, b.rect))
                problems.push(`${template.id} L${level}: ${a.id} overlaps ${b.id}`);
            });
          });
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
