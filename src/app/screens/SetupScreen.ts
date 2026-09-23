import { answerText } from '../../curriculum/answers';
import { previewQuestions } from '../../curriculum/blueprint';
import type { CurriculumRegistry } from '../../curriculum/registry';
import type { Language, Level, Year } from '../../curriculum/schema';
import { pickText } from '../../curriculum/schema';
import type { RaceMode } from '../../game/core/RaceState';
import { RACE_LENGTHS } from '../../game/core/RaceState';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_STYLES,
  defaultPlayerName,
} from '../../game/core/players';
import { createTranslator } from '../../locales';
import type { MessageKey, Translator } from '../../locales';
import type { Settings } from '../../storage/settings';
import { clear, h } from '../dom';
import type { Child } from '../dom';

export type SetupInput = {
  year: Year;
  topicIds: string[];
  level: Level;
  mode: RaceMode;
  raceLength: number;
  playerNames: string[];
  language: Language;
  sound: boolean;
  reducedMotion: boolean;
  hintsEnabled: boolean;
  supportEnabled: boolean;
  /** Quick Race only: the 3rd wrong answer to one question moves the racer back a step. */
  setbackEnabled: boolean;
  /** Teacher-supplied seed for reproducing a session, or null for a random one. */
  seed: string | null;
};

export type SetupDeps = {
  registry: CurriculumRegistry;
  settings: Settings;
  sessionCount: number;
  storageNote: string | null;
  onStart(input: SetupInput): void;
  onChange(settings: Settings): void;
  onLanguage(language: Language): void;
  onHelp(): void;
  onDeleteAll(): Promise<void>;
  confirm(message: string): Promise<boolean>;
};

const LEVELS: Level[] = [1, 2, 3, 4];

/** Make names unique and non-empty: blanks get the default name, duplicates get a numeric suffix. */
export function normalizeNames(
  raw: readonly string[],
  count: number,
  language: Language,
): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const trimmed = (raw[i] ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
    const base = trimmed === '' ? defaultPlayerName(i, language) : trimmed;
    const key = base.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    out.push(n === 1 ? base : `${base} ${n}`);
  }
  return out;
}

export class SetupScreen {
  private root: HTMLElement | null = null;
  private state: {
    year: Year;
    topicIds: Set<string>;
    level: Level;
    mode: RaceMode;
    raceLength: number;
    playerCount: number;
    names: string[];
    language: Language;
    sound: boolean;
    reducedMotion: boolean;
    hintsEnabled: boolean;
    supportEnabled: boolean;
    setbackEnabled: boolean;
    seed: string;
  };
  private error = '';
  private previewHtml: HTMLElement | null = null;
  private storedSessions: number;
  private t: Translator;

  constructor(private readonly deps: SetupDeps) {
    const s = deps.settings;
    this.state = {
      year: s.year,
      topicIds: new Set(s.topicIds),
      level: s.level,
      mode: s.mode,
      raceLength: s.raceLength,
      playerCount: s.playerCount,
      names: Array.from({ length: MAX_PLAYERS }, () => ''),
      language: s.language,
      sound: s.sound,
      reducedMotion: s.reducedMotion,
      hintsEnabled: s.hintsEnabled,
      supportEnabled: s.supportEnabled,
      setbackEnabled: s.setbackEnabled,
      seed: '',
    };
    this.storedSessions = deps.sessionCount;
    this.t = createTranslator(s.language);
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

  /** Names to prefill when the teacher comes back via New Setup. */
  setNames(names: readonly string[]): void {
    names.forEach((n, i) => {
      if (i < MAX_PLAYERS) this.state.names[i] = n;
    });
  }

  setSessionCount(count: number): void {
    this.storedSessions = count;
    this.render();
  }

  private persist(): void {
    const s = this.state;
    this.deps.onChange({
      language: s.language,
      sound: s.sound,
      reducedMotion: s.reducedMotion,
      hintsEnabled: s.hintsEnabled,
      supportEnabled: s.supportEnabled,
      setbackEnabled: s.setbackEnabled,
      year: s.year,
      topicIds: [...s.topicIds],
      level: s.level,
      raceLength: s.raceLength,
      mode: s.mode,
      playerCount: s.playerCount,
    });
  }

  /** Re-render while keeping keyboard focus on the same control. */
  private refresh(): void {
    const active = document.activeElement as HTMLElement | null;
    const key = active?.dataset.key;
    this.render();
    if (key) this.root?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  }

  private choice(
    type: 'radio' | 'checkbox',
    name: string,
    key: string,
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    description?: string,
  ): HTMLElement {
    return h(
      'label',
      { class: `chip${checked ? ' chip-on' : ''}` },
      h('input', {
        type,
        name,
        checked,
        dataset: { key, testid: key },
        on: { change: (e) => onChange((e.target as HTMLInputElement).checked) },
      }),
      h(
        'span',
        { class: 'chip-label' },
        h('span', { class: 'chip-title', text: label }),
        description ? h('span', { class: 'chip-desc', text: description }) : null,
      ),
    );
  }

  private render(): void {
    const root = this.root;
    if (!root) return;
    const s = this.state;
    const lang = s.language;
    this.t = createTranslator(lang);
    const t = this.t;
    const registry = this.deps.registry;
    const pack = registry.packForYear(s.year);
    clear(root);

    // valid topic selection for the active year
    const yearTopicIds = new Set(pack.topics.map((tp) => tp.id));
    for (const id of [...s.topicIds]) if (!yearTopicIds.has(id)) s.topicIds.delete(id);

    const langButtons = (['bm', 'en'] as Language[]).map((code) =>
      h('button', {
        type: 'button',
        class: `seg${lang === code ? ' seg-on' : ''}`,
        text: code === 'bm' ? 'BM' : 'EN',
        aria: { pressed: lang === code },
        dataset: { key: `lang-${code}`, testid: `lang-${code}` },
        on: {
          click: () => {
            s.language = code;
            this.persist();
            this.deps.onLanguage(code);
            this.refresh();
          },
        },
      }),
    );

    const header = h(
      'header',
      { class: 'topbar' },
      h('img', { class: 'logo', src: './icons/icon.svg', alt: '' }),
      h(
        'div',
        { class: 'brand' },
        h('h1', { text: t('app.name') }),
        h('p', { text: t('app.tagline') }),
      ),
      h(
        'div',
        { class: 'top-actions' },
        h(
          'div',
          { class: 'segmented', role: 'group', aria: { label: t('setup.language') } },
          ...langButtons,
        ),
        h('button', {
          type: 'button',
          class: 'btn',
          dataset: { key: 'help', testid: 'help' },
          text: t('setup.help'),
          on: { click: () => this.deps.onHelp() },
        }),
      ),
    );

    // ---- curriculum
    const yearFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.year') }),
      h(
        'div',
        { class: 'chips' },
        ...([1, 2] as Year[]).map((y) =>
          this.choice(
            'radio',
            'year',
            `year-${y}`,
            t(`setup.year.${y}` as MessageKey),
            s.year === y,
            () => {
              s.year = y;
              s.topicIds = new Set([
                registry.packForYear(y).topics[1]?.id ??
                  (registry.packForYear(y).topics[0]?.id as string),
              ]);
              this.persist();
              this.refresh();
            },
          ),
        ),
      ),
      h('p', {
        class: 'note',
        dataset: { testid: 'pack-info' },
        text: `${t('setup.pack')}: ${pickText(lang, pack.title)}. ${t('setup.packStatus', { version: pack.version })}`,
      }),
    );

    const topicFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.topics') }),
      h('p', { class: 'note', text: t('setup.topics.hint') }),
      h(
        'div',
        { class: 'inline-actions' },
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: t('setup.topics.all'),
          dataset: { key: 'topics-all', testid: 'topics-all' },
          on: {
            click: () => {
              s.topicIds = new Set(pack.topics.map((tp) => tp.id));
              this.persist();
              this.refresh();
            },
          },
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          text: t('setup.topics.none'),
          dataset: { key: 'topics-none', testid: 'topics-none' },
          on: {
            click: () => {
              s.topicIds = new Set();
              this.persist();
              this.refresh();
            },
          },
        }),
      ),
      h(
        'div',
        { class: 'chips chips-topics' },
        ...pack.topics.map((topic) =>
          this.choice(
            'checkbox',
            'topic',
            `topic-${topic.id}`,
            `${topic.code} ${pickText(lang, topic.title)}`,
            s.topicIds.has(topic.id),
            (on) => {
              if (on) s.topicIds.add(topic.id);
              else s.topicIds.delete(topic.id);
              this.error = '';
              this.persist();
              this.refresh();
            },
            t('setup.topic.sk', { sk: topic.standardKandungan }),
          ),
        ),
      ),
    );

    const levelFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.level') }),
      h(
        'div',
        { class: 'chips' },
        ...LEVELS.map((lv) =>
          this.choice(
            'radio',
            'level',
            `level-${lv}`,
            t(`setup.level.${lv}` as MessageKey),
            s.level === lv,
            () => {
              s.level = lv;
              this.persist();
              this.refresh();
            },
          ),
        ),
      ),
      h('p', { class: 'note', text: t('setup.level.hint') }),
    );

    // ---- race
    const modeFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.mode') }),
      h(
        'div',
        { class: 'chips' },
        ...(['quick', 'practice'] as RaceMode[]).map((m) =>
          this.choice(
            'radio',
            'mode',
            `mode-${m}`,
            t(m === 'quick' ? 'setup.mode.quick' : 'setup.mode.practice'),
            s.mode === m,
            () => {
              s.mode = m;
              this.persist();
              this.refresh();
            },
            t(m === 'quick' ? 'setup.mode.quick.desc' : 'setup.mode.practice.desc'),
          ),
        ),
      ),
    );

    const lengthFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.length') }),
      h(
        'div',
        { class: 'chips' },
        ...RACE_LENGTHS.map((n) =>
          this.choice('radio', 'length', `length-${n}`, String(n), s.raceLength === n, () => {
            s.raceLength = n;
            this.persist();
            this.refresh();
          }),
        ),
      ),
    );

    // ---- players
    const playerFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.players') }),
      h(
        'div',
        { class: 'chips', role: 'radiogroup', aria: { label: t('setup.playerCount') } },
        ...Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
          (n) =>
            this.choice('radio', 'count', `count-${n}`, String(n), s.playerCount === n, () => {
              s.playerCount = n;
              this.persist();
              this.refresh();
            }),
        ),
      ),
      h('p', { class: 'note', text: t('setup.privacyHint') }),
      h(
        'div',
        { class: 'names' },
        ...Array.from({ length: s.playerCount }, (_, i) => {
          const style = PLAYER_STYLES[i];
          const id = `name-${i}`;
          return h(
            'div',
            { class: 'name-row' },
            h('span', {
              class: 'name-chip',
              style: `background:${style?.color ?? '#444'}`,
              aria: { hidden: true },
              text: symbolGlyph(style?.symbol),
            }),
            h('label', { for: id, class: 'name-label', text: t('setup.playerName', { n: i + 1 }) }),
            h('input', {
              id,
              type: 'text',
              class: 'text-input',
              maxlength: 20,
              autocomplete: 'off',
              placeholder: defaultPlayerName(i, lang),
              value: s.names[i] ?? '',
              dataset: { key: id, testid: id },
              on: {
                input: (e) => {
                  s.names[i] = (e.target as HTMLInputElement).value;
                },
              },
            }),
          );
        }),
      ),
    );

    // ---- options
    const toggle = (
      key: string,
      label: string,
      get: () => boolean,
      set: (v: boolean) => void,
    ): HTMLElement =>
      this.choice('checkbox', key, `opt-${key}`, label, get(), (v) => {
        set(v);
        this.persist();
        this.refresh();
      });
    const optionsFieldset = h(
      'fieldset',
      { class: 'group' },
      h('legend', { text: t('setup.options') }),
      h(
        'div',
        { class: 'chips' },
        toggle(
          'sound',
          t('setup.sound'),
          () => s.sound,
          (v) => (s.sound = v),
        ),
        toggle(
          'reducedMotion',
          t('setup.reducedMotion'),
          () => s.reducedMotion,
          (v) => (s.reducedMotion = v),
        ),
        toggle(
          'hints',
          t('setup.hints'),
          () => s.hintsEnabled,
          (v) => (s.hintsEnabled = v),
        ),
        toggle(
          'support',
          t('setup.support'),
          () => s.supportEnabled,
          (v) => (s.supportEnabled = v),
        ),
        toggle(
          'setback',
          t('setup.setback'),
          () => s.setbackEnabled,
          (v) => (s.setbackEnabled = v),
        ),
      ),
      h('p', { class: 'note', text: t('setup.supportNote') }),
      h('p', { class: 'note', text: t('setup.setbackNote') }),
      h(
        'div',
        { class: 'seed-row' },
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
        h('p', { class: 'note', text: t('setup.seedHint') }),
      ),
    );

    // ---- actions, preview, data
    const errorEl = h('p', {
      class: 'error',
      role: 'alert',
      dataset: { testid: 'setup-error' },
      text: this.error,
    });
    const actions = h(
      'div',
      { class: 'actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-large',
        dataset: { key: 'preview', testid: 'preview' },
        text: t('setup.preview'),
        on: { click: () => this.showPreview() },
      }),
      h('button', {
        type: 'submit',
        class: 'btn btn-primary btn-large',
        dataset: { key: 'start', testid: 'start' },
        text: `${t('setup.start')} ▶`,
      }),
    );

    const form = h(
      'form',
      {
        id: 'setup-form',
        on: {
          submit: (e) => {
            e.preventDefault();
            this.submit();
          },
        },
        aria: { label: t('setup.title') },
      },
      yearFieldset,
      topicFieldset,
      levelFieldset,
      modeFieldset,
      lengthFieldset,
      playerFieldset,
      optionsFieldset,
      errorEl,
      actions,
    );
    form.setAttribute('novalidate', '');

    this.previewHtml = h('section', {
      class: 'preview',
      id: 'preview-section',
      dataset: { testid: 'preview-section' },
      hidden: true,
    });

    const dataSection = h(
      'section',
      { class: 'group data-group' },
      h('h3', { text: t('setup.data') }),
      h('p', {
        dataset: { testid: 'session-count' },
        text: t('setup.data.count', { n: this.storedSessions }),
      }),
      this.deps.storageNote
        ? h('p', { class: 'note warn', role: 'status', text: this.deps.storageNote })
        : null,
      h('button', {
        type: 'button',
        class: 'btn btn-danger',
        disabled: this.storedSessions === 0,
        dataset: { key: 'delete-all', testid: 'delete-all' },
        text: t('setup.data.deleteAll'),
        on: { click: () => void this.deleteAll() },
      }),
    );

    const main = h(
      'main',
      { id: 'main', tabindex: -1, class: 'setup-main' },
      h('h2', { text: t('setup.title') }),
      form,
      this.previewHtml,
      dataSection,
      h('p', { class: 'pbd-note', dataset: { testid: 'pbd-notice' }, text: t('setup.pbdNotice') }),
    );

    root.appendChild(
      h(
        'div',
        { class: 'app-shell' },
        h('a', { class: 'skip-link', href: '#main', text: t('app.skipToMain') }),
        header,
        main,
      ),
    );
  }

  private async deleteAll(): Promise<void> {
    const ok = await this.deps.confirm(this.t('setup.data.confirmAll'));
    if (!ok) return;
    await this.deps.onDeleteAll();
    this.storedSessions = 0;
    this.render();
    const status = this.root?.querySelector<HTMLElement>('[data-testid="session-count"]');
    if (status)
      status.textContent = `${this.t('setup.data.deleted')} ${this.t('setup.data.count', { n: 0 })}`;
  }

  private buildInput(): SetupInput | null {
    const s = this.state;
    if (s.topicIds.size === 0) {
      this.error = this.t('setup.error.topics');
      return null;
    }
    const seed = s.seed.trim().slice(0, 24);
    return {
      year: s.year,
      topicIds: [...s.topicIds],
      level: s.level,
      mode: s.mode,
      raceLength: s.raceLength,
      playerNames: normalizeNames(s.names, s.playerCount, s.language),
      language: s.language,
      sound: s.sound,
      reducedMotion: s.reducedMotion,
      hintsEnabled: s.hintsEnabled,
      supportEnabled: s.supportEnabled,
      setbackEnabled: s.setbackEnabled,
      seed: seed === '' ? null : seed,
    };
  }

  private submit(): void {
    const input = this.buildInput();
    if (!input) {
      this.refresh();
      return;
    }
    this.persist();
    this.deps.onStart(input);
  }

  private showPreview(): void {
    const input = this.buildInput();
    const target = this.previewHtml;
    if (!target) return;
    const t = this.t;
    if (!input) {
      this.error = t('setup.error.topics');
      this.refresh();
      return;
    }
    const pack = this.deps.registry.packForYear(input.year);
    clear(target);
    try {
      const questions = previewQuestions(this.deps.registry, {
        seed: input.seed ?? 'PREVIEW',
        packId: pack.packId,
        topicIds: input.topicIds,
        level: input.level,
        raceLength: 5,
        language: input.language,
      });
      const items: Child[] = questions.map((q, i) =>
        h(
          'li',
          { class: 'preview-item' },
          h('span', { class: 'preview-code', text: `${q.topicId} · ${q.templateId}` }),
          h('span', {
            class: 'preview-q',
            text:
              [q.prompt.text, q.prompt.expression].filter((x) => x && x.length > 0).join('  ') ||
              `(${q.widget})`,
          }),
          h('span', {
            class: 'preview-a',
            text: t('setup.preview.answer', { answer: answerText(q) }),
          }),
          h('span', { class: 'preview-w', text: `#${i + 1} · ${q.widget} · ${q.difficultyBand}` }),
        ),
      );
      target.appendChild(h('h3', { text: t('setup.preview.title') }));
      target.appendChild(h('ol', { class: 'preview-list' }, ...items));
    } catch (error) {
      target.appendChild(
        h('p', {
          class: 'error',
          role: 'alert',
          text: t('app.raceError', {
            reason: error instanceof Error ? error.message : String(error),
          }),
        }),
      );
    }
    target.appendChild(
      h('button', {
        type: 'button',
        class: 'btn',
        text: t('setup.preview.close'),
        on: {
          click: () => {
            target.hidden = true;
            clear(target);
          },
        },
      }),
    );
    target.hidden = false;
    target.scrollIntoView?.({ block: 'nearest' });
  }
}

function symbolGlyph(symbol: string | undefined): string {
  switch (symbol) {
    case 'star':
      return '★';
    case 'circle':
      return '●';
    case 'triangle':
      return '▲';
    case 'square':
      return '■';
    case 'diamond':
      return '◆';
    default:
      return '';
  }
}
