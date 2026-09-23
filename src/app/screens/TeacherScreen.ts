import { createTranslator } from '../../locales';
import type { Translator } from '../../locales';
import { choice } from '../controls';
import { clear, h } from '../dom';
import type { SetupState } from '../setupState';

export type TeacherDeps = {
  /** Shared with the menu and setup; this screen changes it in place. */
  state: SetupState;
  sessionCount: number;
  storageNote: string | null;
  onChange(): void;
  onBack(): void;
  onHelp(): void;
  onDeleteAll(): Promise<void>;
  confirm(message: string): Promise<boolean>;
};

/**
 * Teacher settings, kept off the pupils' setup path: game rules (sound, reduced motion, hints, support,
 * setback), the session seed, local data and the PBD boundary. Settings are saved on change; the seed stays
 * in memory for this app session only.
 */
export class TeacherScreen {
  private root: HTMLElement | null = null;
  private sessions: number;
  private status = '';

  constructor(private readonly deps: TeacherDeps) {
    this.sessions = deps.sessionCount;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
    root.querySelector<HTMLElement>('#main')?.focus();
  }

  unmount(): void {
    if (this.root) clear(this.root);
    this.root = null;
  }

  private changed(): void {
    this.deps.onChange();
    const key = (document.activeElement as HTMLElement | null)?.dataset.key;
    this.render();
    if (key) this.root?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  }

  private toggle(
    t: Translator,
    key: string,
    label: Parameters<Translator>[0],
    get: () => boolean,
    set: (v: boolean) => void,
  ): HTMLElement {
    return choice({
      type: 'checkbox',
      name: key,
      key: `opt-${key}`,
      checked: get(),
      title: t(label),
      className: 'card option-card',
      onChange: (v) => {
        set(v);
        this.changed();
      },
    });
  }

  private render(): void {
    const root = this.root;
    if (!root) return;
    const s = this.deps.state;
    const t = createTranslator(s.language);
    clear(root);

    const rules = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.options') }),
      h(
        'div',
        { class: 'option-grid' },
        this.toggle(
          t,
          'sound',
          'setup.sound',
          () => s.sound,
          (v) => (s.sound = v),
        ),
        this.toggle(
          t,
          'reducedMotion',
          'setup.reducedMotion',
          () => s.reducedMotion,
          (v) => (s.reducedMotion = v),
        ),
        this.toggle(
          t,
          'hints',
          'setup.hints',
          () => s.hintsEnabled,
          (v) => (s.hintsEnabled = v),
        ),
        this.toggle(
          t,
          'support',
          'setup.support',
          () => s.supportEnabled,
          (v) => (s.supportEnabled = v),
        ),
        this.toggle(
          t,
          'setback',
          'setup.setback',
          () => s.setbackEnabled,
          (v) => (s.setbackEnabled = v),
        ),
      ),
      h('p', { class: 'note note-small', text: t('setup.supportNote') }),
      h('p', { class: 'note note-small', text: t('setup.setbackNote') }),
    );

    const session = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('teacher.session') }),
      h('label', { for: 'seed', class: 'name-label', text: t('setup.seed') }),
      h('input', {
        id: 'seed',
        type: 'text',
        class: 'text-input',
        maxlength: 24,
        autocomplete: 'off',
        value: s.seed,
        dataset: { key: 'seed', testid: 'seed' },
        on: { input: (e) => (s.seed = (e.target as HTMLInputElement).value) },
      }),
      h('p', { class: 'note note-small', text: t('setup.seedHint') }),
    );

    const data = h(
      'fieldset',
      { class: 'group data-group' },
      h('legend', { text: t('setup.data') }),
      h('p', {
        dataset: { testid: 'session-count' },
        role: 'status',
        text: this.status || t('setup.data.count', { n: this.sessions }),
      }),
      this.deps.storageNote
        ? h('p', { class: 'note warn', role: 'status', text: this.deps.storageNote })
        : null,
      h('button', {
        type: 'button',
        class: 'btn btn-danger',
        disabled: this.sessions === 0,
        dataset: { key: 'delete-all', testid: 'delete-all' },
        text: t('setup.data.deleteAll'),
        on: { click: () => void this.deleteAll(t) },
      }),
    );

    root.appendChild(
      h(
        'div',
        { class: 'app-shell teacher-shell' },
        h('a', { class: 'skip-link', href: '#main', text: t('app.skipToMain') }),
        h(
          'header',
          { class: 'topbar' },
          h('button', {
            type: 'button',
            class: 'btn',
            dataset: { key: 'teacher-back', testid: 'teacher-back' },
            text: `◀ ${t('teacher.back')}`,
            on: { click: () => this.deps.onBack() },
          }),
          h('div', { class: 'brand' }, h('h1', { text: t('teacher.title') })),
          h(
            'div',
            { class: 'top-actions' },
            h('button', {
              type: 'button',
              class: 'btn',
              dataset: { key: 'help', testid: 'help' },
              text: t('setup.help'),
              on: { click: () => this.deps.onHelp() },
            }),
          ),
        ),
        h(
          'main',
          { id: 'main', tabindex: -1, class: 'teacher-main' },
          h('h2', { class: 'visually-hidden', text: t('teacher.title') }),
          h('div', { class: 'teacher-grid' }, h('div', {}, rules), h('div', {}, session, data)),
          h('p', {
            class: 'pbd-note',
            dataset: { testid: 'pbd-notice' },
            text: t('setup.pbdNotice'),
          }),
        ),
      ),
    );
  }

  private async deleteAll(t: Translator): Promise<void> {
    const ok = await this.deps.confirm(t('setup.data.confirmAll'));
    if (!ok) return;
    await this.deps.onDeleteAll();
    this.sessions = 0;
    this.status = `${t('setup.data.deleted')} ${t('setup.data.count', { n: 0 })}`;
    this.render();
  }
}
