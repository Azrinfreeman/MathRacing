import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '../curriculum/answers';
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
});

describe('ChoiceTilesWidget', () => {
  it('submits a tapped tile immediately as a choice', () => {
    const q = question('y1-num-compare-values');
    const w = createWidget(q);
    const first = (q.options ?? [])[0]?.id as string;
    expect(w.activate(first)).toEqual({
      type: 'submit',
      answer: { kind: 'choice', optionId: first },
    });
  });

  it('dims a wrong tile quietly and ignores it afterwards, while other tiles stay active', () => {
    const q = question('y1-num-compare-values');
    const w = createWidget(q);
    const ids = (q.options ?? []).map((o) => o.id);
    w.onWrong({ kind: 'choice', optionId: ids[0] as string });
    expect(control(w, ids[0] as string).state).toBe('wrong');
    expect(w.activate(ids[0] as string)).toEqual({ type: 'none' });
    expect(w.activate(ids[1] as string).type).toBe('submit');
    w.reset();
    expect(control(w, ids[0] as string).state).toBe('normal');
  });

  it('ignores ids that are not options', () => {
    const w = createWidget(question('y1-num-compare-values'));
    expect(w.activate('nope')).toEqual({ type: 'none' });
  });
});

describe('TapPictureWidget', () => {
  it('single-answer pictures submit on tap', () => {
    const q = question('y1-num-compare-groups');
    const w = createWidget(q);
    expect(w.activate('g1')).toEqual({
      type: 'submit',
      answer: { kind: 'set', optionIds: ['g1'] },
    });
    w.onWrong({ kind: 'set', optionIds: ['g1'] });
    expect(w.activate('g1')).toEqual({ type: 'none' });
    expect(w.activate('g2').type).toBe('submit');
  });

  it('multi-select toggles pictures and needs a deliberate Go', () => {
    const q = question('y1-data-classify');
    expect(q.widgetConfig?.multi).toBe(true);
    const w = createWidget(q);
    const ids = (q.options ?? []).map((o) => o.id);
    expect(w.activate('submit')).toEqual({ type: 'none' }); // nothing selected yet
    expect(w.activate(ids[0] as string)).toEqual({ type: 'changed' });
    expect(w.activate(ids[2] as string)).toEqual({ type: 'changed' });
    expect(control(w, 'submit').badge).toBe('2');
    w.activate(ids[0] as string); // toggle off
    expect(control(w, 'submit').badge).toBe('1');
    expect(w.activate('submit')).toEqual({
      type: 'submit',
      answer: { kind: 'set', optionIds: [ids[2]] },
    });
    w.onWrong({ kind: 'set', optionIds: [ids[2] as string] });
    expect(w.isEmpty()).toBe(true);
  });
});

describe('OrderStripWidget', () => {
  it('numbers cards in tap order, lets a card be un-numbered, and needs every card before Go', () => {
    const q = question('y1-num-order', 3);
    const w = createWidget(q);
    const correct = q.acceptedAnswer.kind === 'sequence' ? q.acceptedAnswer.optionIds : [];
    expect(w.activate('submit')).toEqual({ type: 'none' });
    w.activate(correct[1] as string);
    w.activate(correct[0] as string);
    expect(control(w, correct[1] as string).badge).toBe('1');
    expect(control(w, correct[0] as string).badge).toBe('2');
    w.activate(correct[1] as string); // take the number back; the other card shifts down
    expect(control(w, correct[0] as string).badge).toBe('1');
    expect(control(w, correct[1] as string).badge).toBeUndefined();
    expect(control(w, 'submit').state).toBe('disabled');
    for (const id of correct) if (control(w, id).badge === undefined) w.activate(id);
    expect(control(w, 'submit').state).toBe('normal');
  });

  it('submits the tapped sequence and resets after a wrong order', () => {
    const q = question('y1-num-order', 1);
    const w = createWidget(q);
    const ids = (q.options ?? []).map((o) => o.id);
    ids.forEach((id) => w.activate(id));
    const effect = w.activate('submit');
    expect(effect).toEqual({ type: 'submit', answer: { kind: 'sequence', optionIds: ids } });
    if (effect.type === 'submit') expect(evaluateAnswer(q, effect.answer).valid).toBe(true);
    w.onWrong({ kind: 'sequence', optionIds: ids });
    expect(w.isEmpty()).toBe(true);
  });
});

describe('BuildValueWidget', () => {
  it('keeps a running total and submits it as an exact number', () => {
    const q = question('y1-num-build', 2);
    const w = createWidget(q);
    w.activate('tens');
    w.activate('tens');
    w.activate('ones');
    expect(w.responseText()).toBe('21');
    expect(w.activate('submit')).toEqual({ type: 'submit', answer: { kind: 'number', raw: '21' } });
  });

  it('supports undo and clear, and formats money totals', () => {
    const sen = createWidget(question('y1-money-build', 1));
    sen.activate('p10');
    sen.activate('p20');
    expect(sen.responseText()).toBe('30 sen');
    sen.activate('back');
    expect(sen.responseText()).toBe('10 sen');
    sen.activate('clear');
    expect(sen.responseText()).toBe('');

    const rm = createWidget(question('y1-money-build', 3));
    rm.activate('p5');
    rm.activate('p1');
    expect(rm.responseText()).toBe('RM6');
  });

  it('accepts any valid combination of parts (RM6 as 6 x RM1 or RM5 + RM1)', () => {
    const q = registry.buildWithParams(
      'y1-money-build',
      { targetSen: 600, unit: 'rm' },
      { level: 3, language: 'bm', rng: new SeededRng('x') },
    );
    const a = createWidget(q);
    for (let i = 0; i < 6; i++) a.activate('p1');
    const b = createWidget(q);
    b.activate('p5');
    b.activate('p1');
    for (const w of [a, b]) {
      const effect = w.activate('submit');
      if (effect.type !== 'submit') throw new Error('expected submit');
      expect(evaluateAnswer(q, effect.answer).correct).toBe(true);
    }
  });

  it('resets after a wrong total and disables actions when empty', () => {
    const w = createWidget(question('y2-num-build', 2));
    expect(control(w, 'clear').state).toBe('disabled');
    w.activate('o');
    w.onWrong({ kind: 'number', raw: '1' });
    expect(w.isEmpty()).toBe(true);
    expect(control(w, 'submit').state).toBe('disabled');
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
