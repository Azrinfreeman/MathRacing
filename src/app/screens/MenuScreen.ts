import type { Language } from '../../curriculum/schema';
import type { RaceMode } from '../../game/core/RaceState';
import { createTranslator } from '../../locales';
import { MENU_ICONS } from '../art';
import { languageSwitch, svgArt } from '../controls';
import { clear, h } from '../dom';

export type MenuDeps = {
  language: Language;
  sessionCount: number;
  /** Shown when evidence is not stored persistently (never hidden from the teacher). */
  storageNote: string | null;
  /** One-line summary of the last setup, or null to hide "Main semula". */
  lastSummary: string | null;
  onLanguage(language: Language): void;
  onHelp(): void;
  onPlay(mode: RaceMode): void;
  onAgain(): void;
  onTeacher(): void;
};

/** The main menu: two big cards for pupils (race, practice), repeat-last-race, and the teacher's corner. */
export class MenuScreen {
  private root: HTMLElement | null = null;

  constructor(private readonly deps: MenuDeps) {}

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
    // focus the page (for screen readers and Tab), not a card: a focus ring on a touch screen looks like a choice
    root.querySelector<HTMLElement>('#main')?.focus();
  }

  unmount(): void {
    if (this.root) clear(this.root);
    this.root = null;
  }

  private render(): void {
    const root = this.root;
    if (!root) return;
    const d = this.deps;
    const t = createTranslator(d.language);
    clear(root);

    const card = (mode: RaceMode): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: `menu-card menu-card-${mode}`,
          dataset: { testid: mode === 'quick' ? 'menu-race' : 'menu-practice' },
          on: { click: () => d.onPlay(mode) },
        },
        h(
          'span',
          { class: 'menu-icon-circle' },
          svgArt(mode === 'quick' ? MENU_ICONS.race : MENU_ICONS.practice, 'menu-icon'),
        ),
        h('span', {
          class: 'menu-card-title',
          text: t(mode === 'quick' ? 'menu.race' : 'menu.practice'),
        }),
        h('span', {
          class: 'menu-card-desc',
          text: t(mode === 'quick' ? 'menu.race.desc' : 'menu.practice.desc'),
        }),
      );

    root.appendChild(
      h(
        'div',
        { class: 'menu-shell simple-menus' },
        h('a', { class: 'skip-link', href: '#main', text: t('app.skipToMain') }),
        h(
          'header',
          { class: 'topbar' },
          h('img', { class: 'logo', src: './icons/icon.svg', alt: '' }),
          h('div', { class: 'brand' }, h('h1', { text: t('app.name') })),
          h(
            'div',
            { class: 'top-actions' },
            languageSwitch(t, d.language, (lang) => d.onLanguage(lang)),
            h('button', {
              type: 'button',
              class: 'btn btn-quiet',
              dataset: { key: 'help', testid: 'help' },
              text: t('setup.help'),
              on: { click: () => d.onHelp() },
            }),
          ),
        ),
        h(
          'main',
          { id: 'main', tabindex: -1, class: 'menu-main' },
          h('h2', { class: 'visually-hidden', text: t('menu.title') }),
          h(
            'div',
            { class: 'menu-intro' },
            h('h2', { text: t('menu.welcome') }),
            h('p', { text: t('menu.choose') }),
          ),
          h('div', { class: 'menu-cards' }, card('quick'), card('practice')),
          d.lastSummary
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'menu-again',
                  dataset: { testid: 'menu-again' },
                  on: { click: () => d.onAgain() },
                },
                svgArt(MENU_ICONS.again, 'menu-again-icon'),
                h(
                  'span',
                  { class: 'menu-again-text' },
                  h('strong', { text: t('menu.again') }),
                  h('span', { text: d.lastSummary }),
                ),
              )
            : null,
        ),
        h(
          'footer',
          { class: 'menu-footer' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet menu-teacher',
              dataset: { testid: 'menu-teacher' },
              on: { click: () => d.onTeacher() },
            },
            svgArt(MENU_ICONS.teacher, 'btn-icon'),
            t('menu.teacher'),
          ),
          d.storageNote
            ? h('p', { class: 'note warn menu-warn', role: 'status', text: d.storageNote })
            : null,
        ),
      ),
    );
  }
}
