import type { Language } from '../curriculum/schema';
import type { Translator } from '../locales';
import { h } from './dom';
import type { Child } from './dom';

/**
 * A large selectable card: a real radio or checkbox input stretched over a label, so it works with touch,
 * mouse, keyboard and screen readers, and shows a tick when selected (never colour alone).
 */
export function choice(opts: {
  type: 'radio' | 'checkbox';
  name: string;
  key: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Fires on every tap, even on an already selected radio (used to move on to the next step). */
  onTap?: () => void;
  title: string;
  description?: string;
  art?: Child;
  className?: string;
}): HTMLElement {
  return h(
    'label',
    { class: `chip${opts.checked ? ' chip-on' : ''}${opts.className ? ` ${opts.className}` : ''}` },
    h('input', {
      type: opts.type,
      name: opts.name,
      checked: opts.checked,
      dataset: { key: opts.key, testid: opts.key },
      on: {
        change: (e) => opts.onChange((e.target as HTMLInputElement).checked),
        ...(opts.onTap ? { click: opts.onTap } : {}),
      },
    }),
    opts.art ?? null,
    h(
      'span',
      { class: 'chip-label' },
      h('span', { class: 'chip-title', text: opts.title }),
      opts.description ? h('span', { class: 'chip-desc', text: opts.description }) : null,
    ),
  );
}

/** The BM / EN switch used in screen headers. */
export function languageSwitch(
  t: Translator,
  current: Language,
  onPick: (language: Language) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'segmented', role: 'group', aria: { label: t('setup.language') } },
    ...(['bm', 'en'] as Language[]).map((code) =>
      h('button', {
        type: 'button',
        class: `seg${current === code ? ' seg-on' : ''}`,
        text: code === 'bm' ? 'BM' : 'EN',
        aria: { pressed: current === code },
        dataset: { key: `lang-${code}`, testid: `lang-${code}` },
        on: { click: () => onPick(code) },
      }),
    ),
  );
}

/** Inline SVG from trusted, static markup built in `art.ts` (never from user input). */
export function svgArt(markup: string, className = 'art'): HTMLElement {
  const span = h('span', { class: className, aria: { hidden: true } });
  span.innerHTML = markup;
  return span;
}
