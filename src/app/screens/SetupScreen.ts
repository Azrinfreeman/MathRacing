import { answerText } from '../../curriculum/answers';
import { previewQuestions } from '../../curriculum/blueprint';
import type { CurriculumRegistry } from '../../curriculum/registry';
import type { Level, Year } from '../../curriculum/schema';
import { pickText } from '../../curriculum/schema';
import type { RaceMode } from '../../game/core/RaceState';
import { RACE_LENGTHS } from '../../game/core/RaceState';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_STYLES,
  defaultPlayerName,
} from '../../game/core/players';
import { RACERS, racerInfo, resolveRacers, takenRacers } from '../../game/core/racers';
import type { RacerKind } from '../../game/core/racers';
import { createTranslator } from '../../locales';
import type { MessageKey, Translator } from '../../locales';
import type { RacerId } from '../../game/core/racers';
import { levelStarsSvg, symbolBadgeSvg, topicIconSvg, racerSvg } from '../art';
import { choice, svgArt } from '../controls';
import { contentDialog } from '../dialogs';
import { clear, h } from '../dom';
import type { Child } from '../dom';
import type { SetupInput, SetupState } from '../setupState';
import { buildSetupInput, defaultTopicForYear, keepYearTopics } from '../setupState';

export type SetupStep = 1 | 2 | 3 | 4;

export type SetupDeps = {
  registry: CurriculumRegistry;
  /** Shared with the menu and teacher screens; this screen changes it in place. */
  state: SetupState;
  step: SetupStep;
  /** Called after every change so the controller can save the classroom settings. */
  onChange(): void;
  onStart(input: SetupInput): void;
  onHome(): void;
  onHelp(): void;
};

const LEVELS: Level[] = [1, 2, 3, 4];
const STEPS: ReadonlyArray<{ step: SetupStep; key: MessageKey }> = [
  { step: 1, key: 'setup.step.year' },
  { step: 2, key: 'setup.step.topics' },
  { step: 3, key: 'setup.step.players' },
  { step: 4, key: 'setup.step.ready' },
];

/** One line describing a setup, e.g. "Tahun 1 · 2.0 Operasi Asas · 1 Asas · 2 pemain". */
export function summarizeSetup(
  registry: CurriculumRegistry,
  s: SetupState,
  t: Translator,
): { year: string; topics: string; level: string; players: string; line: string } {
  const pack = registry.packForYear(s.year);
  const chosen = pack.topics.filter((tp) => s.topicIds.has(tp.id));
  const first = chosen[0];
  const topics =
    chosen.length === 1 && first
      ? `${first.code} ${pickText(s.language, first.title)}`
      : chosen.length === 0
        ? '-'
        : t('setup.summary.topics', { n: chosen.length });
  const year = t(`setup.year.${s.year}` as MessageKey);
  const level = t(`setup.level.${s.level}` as MessageKey);
  const players = t('setup.summary.players', { n: s.playerCount });
  return { year, topics, level, players, line: [year, topics, level, players].join(' · ') };
}

/**
 * Race setup as four touch-first steps (Year, Topics & level, Players, Ready?), each one screen with large
 * cards. A stepper at the top jumps to any step; Back and Next sit at the bottom. Teacher-only options live
 * on the separate teacher settings screen.
 */
export class SetupScreen {
  private root: HTMLElement | null = null;
  private step: SetupStep;
  private error = '';
  private t: Translator;

  constructor(private readonly deps: SetupDeps) {
    this.step = deps.step;
    this.t = createTranslator(deps.state.language);
    keepYearTopics(deps.registry, deps.state);
  }

  get currentStep(): SetupStep {
    return this.step;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
    this.focusStep();
  }

  unmount(): void {
    if (this.root) clear(this.root);
    this.root = null;
  }

  private get s(): SetupState {
    return this.deps.state;
  }

  private go(step: SetupStep): void {
    this.step = step;
    this.error = '';
    this.render();
    this.focusStep();
  }

  private focusStep(): void {
    this.root?.querySelector<HTMLElement>('.step-title')?.focus();
  }

  /** Save, then re-render while keeping keyboard focus on the same control. */
  private changed(): void {
    this.deps.onChange();
    const key = (document.activeElement as HTMLElement | null)?.dataset.key;
    this.render();
    if (key) this.root?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus();
  }

  private next(): void {
    if (this.step === 2 && this.s.topicIds.size === 0) {
      this.error = this.t('setup.error.topics');
      this.render();
      return;
    }
    if (this.step < 4) this.go((this.step + 1) as SetupStep);
  }

  private back(): void {
    if (this.step === 1) this.deps.onHome();
    else this.go((this.step - 1) as SetupStep);
  }

  private start(): void {
    const input = buildSetupInput(this.s);
    if (!input) {
      this.error = this.t('setup.error.topics');
      this.render();
      return;
    }
    this.deps.onChange();
    this.deps.onStart(input);
  }

  private setYear(y: Year): void {
    const s = this.s;
    if (s.year === y) return;
    s.year = y;
    s.topicIds = new Set([defaultTopicForYear(this.deps.registry, y)]);
  }

  // ---------------------------------------------------------------------------------------- rendering

  private render(): void {
    const root = this.root;
    if (!root) return;
    this.t = createTranslator(this.s.language);
    const t = this.t;
    clear(root);

    const header = h(
      'header',
      { class: 'wiz-top' },
      h('button', {
        type: 'button',
        class: 'btn',
        dataset: { key: 'setup-home', testid: 'setup-home' },
        text: `⌂ ${t('menu.home')}`,
        on: { click: () => this.deps.onHome() },
      }),
      h('h2', { class: 'wiz-title', text: t('setup.title') }),
      h('button', {
        type: 'button',
        class: 'btn',
        dataset: { key: 'help', testid: 'help' },
        text: t('setup.help'),
        on: { click: () => this.deps.onHelp() },
      }),
    );

    const stepper = h(
      'nav',
      { class: 'stepper', aria: { label: t('setup.title') } },
      h(
        'ol',
        {},
        ...STEPS.map(({ step, key }) =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: `step-btn${step === this.step ? ' step-on' : ''}${step < this.step ? ' step-done' : ''}`,
                aria: step === this.step ? { current: 'step' } : {},
                dataset: { key: `step-${step}`, testid: `step-${step}` },
                on: { click: () => this.go(step) },
              },
              h('span', { class: 'step-num', text: step < this.step ? '✓' : String(step) }),
              h('span', { class: 'step-name', text: t(key) }),
            ),
          ),
        ),
      ),
    );

    const body =
      this.step === 1
        ? this.stepYear()
        : this.step === 2
          ? this.stepTopics()
          : this.step === 3
            ? this.stepPlayers()
            : this.stepReady();

    const footer = h(
      'footer',
      { class: 'wiz-nav' },
      h('button', {
        type: 'button',
        class: 'btn btn-large',
        dataset: { key: 'setup-back', testid: 'setup-back' },
        text: this.step === 1 ? `◀ ${t('menu.home')}` : `◀ ${t('setup.back')}`,
        on: { click: () => this.back() },
      }),
      h('p', {
        class: 'error',
        role: 'alert',
        dataset: { testid: 'setup-error' },
        text: this.error,
      }),
      this.step < 4
        ? h('button', {
            type: 'button',
            class: 'btn btn-primary btn-large',
            dataset: { key: 'setup-next', testid: 'setup-next' },
            text: `${t('setup.next')} ▶`,
            on: { click: () => this.next() },
          })
        : h('button', {
            type: 'button',
            class: 'btn btn-primary btn-large btn-start',
            dataset: { key: 'start', testid: 'start' },
            text: `${t('setup.start')} ▶`,
            on: { click: () => this.start() },
          }),
    );

    root.appendChild(
      h(
        'div',
        { class: 'wizard' },
        h('a', { class: 'skip-link', href: '#main', text: t('app.skipToMain') }),
        header,
        stepper,
        h(
          'main',
          { id: 'main', tabindex: -1, class: `wiz-body wiz-step-${this.step}` },
          h('p', {
            class: 'visually-hidden',
            text: t('setup.stepOf', { n: this.step }),
          }),
          body,
        ),
        footer,
      ),
    );
  }

  private title(key: MessageKey): HTMLElement {
    return h('h3', { class: 'step-title', tabindex: -1, text: this.t(key) });
  }

  private stepYear(): HTMLElement {
    const t = this.t;
    return h(
      'section',
      { class: 'step step-year' },
      this.title('setup.year.pick'),
      h(
        'div',
        { class: 'year-cards', role: 'radiogroup', aria: { label: t('setup.year') } },
        ...([1, 2] as Year[]).map((y) =>
          choice({
            type: 'radio',
            name: 'year',
            key: `year-${y}`,
            checked: this.s.year === y,
            title: t(`setup.year.${y}` as MessageKey),
            description: t(`setup.year.${y}.example` as MessageKey),
            art: h('span', { class: 'year-num', aria: { hidden: true }, text: String(y) }),
            className: 'card year-card',
            onChange: () => {
              this.setYear(y);
              this.changed();
            },
            // a tap on a year card (even the one already chosen) moves straight on
            onTap: () => {
              this.setYear(y);
              this.deps.onChange();
              this.go(2);
            },
          }),
        ),
      ),
    );
  }

  private stepTopics(): HTMLElement {
    const t = this.t;
    const s = this.s;
    const lang = s.language;
    const pack = this.deps.registry.packForYear(s.year);
    const topicPanel = h(
      'div',
      { class: 'panel topics-panel' },
      h(
        'div',
        { class: 'panel-head' },
        this.title('setup.topics'),
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
                this.error = '';
                this.changed();
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
                this.changed();
              },
            },
          }),
        ),
      ),
      h('p', {
        class: 'note note-small',
        dataset: { testid: 'pack-info' },
        text: `${t('setup.pack')}: ${pickText(lang, pack.title)}. ${t('setup.packStatus', { version: pack.version })}`,
      }),
      h(
        'div',
        { class: 'topic-grid' },
        ...pack.topics.map((topic) =>
          choice({
            type: 'checkbox',
            name: 'topic',
            key: `topic-${topic.id}`,
            checked: s.topicIds.has(topic.id),
            title: `${topic.code} ${pickText(lang, topic.title)}`,
            description: t('setup.topic.sk', { sk: topic.standardKandungan }),
            art: svgArt(topicIconSvg(topic.id), 'topic-icon'),
            className: 'card topic-card',
            onChange: (on) => {
              if (on) s.topicIds.add(topic.id);
              else s.topicIds.delete(topic.id);
              this.error = '';
              this.changed();
            },
          }),
        ),
      ),
    );
    const levelPanel = h(
      'div',
      { class: 'panel level-panel' },
      h('h3', { class: 'panel-title', text: t('setup.level') }),
      h(
        'div',
        { class: 'level-grid', role: 'radiogroup', aria: { label: t('setup.level') } },
        ...LEVELS.map((lv) =>
          choice({
            type: 'radio',
            name: 'level',
            key: `level-${lv}`,
            checked: s.level === lv,
            title: t(`setup.level.${lv}` as MessageKey),
            art: svgArt(levelStarsSvg(lv), 'level-stars'),
            className: 'card level-card',
            onChange: () => {
              s.level = lv;
              this.changed();
            },
          }),
        ),
      ),
      h('p', { class: 'note note-small', text: t('setup.level.hint') }),
      h('button', {
        type: 'button',
        class: 'btn',
        dataset: { key: 'preview', testid: 'preview' },
        text: t('setup.preview'),
        on: { click: () => this.showPreview() },
      }),
    );
    return h('section', { class: 'step step-topics' }, topicPanel, levelPanel);
  }

  private stepPlayers(): HTMLElement {
    const t = this.t;
    const s = this.s;
    return h(
      'section',
      { class: 'step step-players' },
      h(
        'div',
        { class: 'panel-head' },
        this.title('setup.players.pick'),
        h(
          'div',
          { class: 'count-row', role: 'radiogroup', aria: { label: t('setup.playerCount') } },
          ...Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
            (n) =>
              choice({
                type: 'radio',
                name: 'count',
                key: `count-${n}`,
                checked: s.playerCount === n,
                title: String(n),
                className: 'card count-card',
                onChange: () => {
                  s.playerCount = n;
                  // a seat that becomes active must not hold a racer another seat already has
                  s.racers = resolveRacers(s.racers, n);
                  this.changed();
                },
              }),
          ),
        ),
      ),
      h('p', { class: 'note note-small', text: t('setup.privacyHint') }),
      h(
        'div',
        { class: 'player-cards', style: `--players:${s.playerCount}` },
        ...Array.from({ length: s.playerCount }, (_, i) => {
          const style = PLAYER_STYLES[i] ?? PLAYER_STYLES[0];
          if (!style) return null;
          const id = `name-${i}`;
          const fallback = defaultPlayerName(i, s.language);
          return h(
            'div',
            { class: 'player-card', style: `--pc:${style.color};--pcd:${style.dark}` },
            h(
              'button',
              {
                type: 'button',
                class: 'player-racer',
                dataset: { key: `racer-${i}`, testid: `racer-${i}` },
                aria: {
                  label: t('setup.racer.button', {
                    n: i + 1,
                    racer: this.racerName(s.racers[i] ?? style.defaultRacer),
                  }),
                },
                on: { click: () => this.openRacerPicker(i) },
              },
              svgArt(racerSvg(style, s.racers[i] ?? style.defaultRacer), 'player-car'),
              h('span', { class: 'player-racer-change', text: t('setup.ready.change') }),
            ),
            h(
              'span',
              { class: 'player-tag' },
              svgArt(symbolBadgeSvg(style), 'player-badge'),
              h('span', { text: fallback }),
            ),
            h('label', {
              for: id,
              class: 'visually-hidden',
              text: t('setup.playerName', { n: i + 1 }),
            }),
            h('input', {
              id,
              type: 'text',
              class: 'text-input',
              maxlength: 20,
              autocomplete: 'off',
              placeholder: t('setup.nameOptional'),
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
  }

  private racerName(id: RacerId): string {
    return racerInfo(id).name[this.s.language];
  }

  /** The racer sheet for one seat: vehicles and animals; racers of other active players are greyed out. */
  private openRacerPicker(slot: number): void {
    const t = this.t;
    const s = this.s;
    const style = PLAYER_STYLES[slot];
    if (!style) return;
    const current = s.racers[slot] ?? style.defaultRacer;
    const taken = takenRacers(s.racers, s.playerCount, slot);
    const owner = (id: RacerId): number => s.racers.findIndex((r, i) => r === id && i !== slot);
    const name = s.names[slot]?.trim() || defaultPlayerName(slot, s.language);
    let dialog: { close: () => void } | null = null;
    const choose = (id: RacerId): void => {
      s.racers[slot] = id;
      dialog?.close();
      this.changed();
      this.root?.querySelector<HTMLElement>(`[data-key="racer-${slot}"]`)?.focus();
    };
    const tile = (id: RacerId): HTMLElement => {
      const isTaken = taken.has(id);
      const by = owner(id);
      const byStyle = PLAYER_STYLES[by];
      return h(
        'button',
        {
          type: 'button',
          class: `racer-tile${id === current ? ' is-current' : ''}`,
          disabled: isTaken,
          dataset: { testid: `racer-tile-${id}` },
          aria: {
            pressed: id === current ? 'true' : 'false',
            label: isTaken
              ? `${this.racerName(id)}. ${t('setup.racer.taken', { n: by + 1 })}`
              : this.racerName(id),
          },
          on: { click: () => choose(id) },
        },
        svgArt(racerSvg(style, id), 'racer-tile-art'),
        h('span', { class: 'racer-tile-name', text: this.racerName(id) }),
        isTaken && byStyle
          ? h(
              'span',
              { class: 'racer-tile-taken' },
              svgArt(symbolBadgeSvg(byStyle), 'racer-tile-owner'),
              t('setup.racer.takenShort', { n: by + 1 }),
            )
          : null,
      );
    };
    const row = (kind: RacerKind, label: MessageKey): Child[] => [
      h('h3', { class: 'racer-row-title', text: t(label) }),
      h(
        'div',
        { class: 'racer-row' },
        ...RACERS.filter((r) => r.kind === kind).map((r) => tile(r.id)),
      ),
    ];
    dialog = contentDialog(t, t('setup.racer.pick', { name }), [
      ...row('vehicle', 'setup.racer.vehicles'),
      ...row('animal', 'setup.racer.animals'),
    ]);
  }

  private stepReady(): HTMLElement {
    const t = this.t;
    const s = this.s;
    const sum = summarizeSetup(this.deps.registry, s, t);
    const tile = (
      key: string,
      label: MessageKey,
      value: string,
      step: SetupStep,
      extra?: HTMLElement,
    ): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: 'summary-tile',
          dataset: { key, testid: key },
          on: { click: () => this.go(step) },
        },
        h('span', { class: 'summary-label', text: t(label) }),
        h('span', { class: 'summary-value', text: value }),
        extra ?? null,
        h('span', { class: 'summary-change', text: t('setup.ready.change') }),
      );
    return h(
      'section',
      { class: 'step step-ready' },
      this.title('setup.ready.title'),
      h(
        'div',
        { class: 'summary-grid' },
        tile('sum-year', 'setup.year', sum.year, 1),
        tile('sum-topics', 'setup.topics', sum.topics, 2),
        tile('sum-level', 'setup.level', sum.level, 2),
        tile(
          'sum-players',
          'setup.players',
          sum.players,
          3,
          h(
            'span',
            { class: 'summary-racers' },
            ...Array.from({ length: s.playerCount }, (_, i) => {
              const style = PLAYER_STYLES[i];
              return style
                ? svgArt(racerSvg(style, s.racers[i] ?? style.defaultRacer), 'summary-racer')
                : null;
            }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'ready-options' },
        h(
          'fieldset',
          { class: 'group' },
          h('legend', { text: t('setup.mode') }),
          h(
            'div',
            { class: 'mode-row' },
            ...(['quick', 'practice'] as RaceMode[]).map((m) =>
              choice({
                type: 'radio',
                name: 'mode',
                key: `mode-${m}`,
                checked: s.mode === m,
                title: t(m === 'quick' ? 'setup.mode.quick' : 'setup.mode.practice'),
                description: t(
                  m === 'quick' ? 'setup.mode.quick.desc' : 'setup.mode.practice.desc',
                ),
                className: 'card mode-card',
                onChange: () => {
                  s.mode = m;
                  this.changed();
                },
              }),
            ),
          ),
        ),
        h(
          'fieldset',
          { class: 'group' },
          h('legend', { text: t('setup.length') }),
          h(
            'div',
            { class: 'length-row' },
            ...RACE_LENGTHS.map((n) =>
              choice({
                type: 'radio',
                name: 'length',
                key: `length-${n}`,
                checked: s.raceLength === n,
                title: String(n),
                className: 'card length-card',
                onChange: () => {
                  s.raceLength = n;
                  this.changed();
                },
              }),
            ),
          ),
        ),
      ),
    );
  }

  private showPreview(): void {
    const t = this.t;
    const input = buildSetupInput(this.s);
    if (!input) {
      this.error = t('setup.error.topics');
      this.render();
      return;
    }
    const pack = this.deps.registry.packForYear(input.year);
    let body: Child[];
    try {
      const questions = previewQuestions(this.deps.registry, {
        seed: input.seed ?? 'PREVIEW',
        packId: pack.packId,
        topicIds: input.topicIds,
        level: input.level,
        raceLength: 5,
        language: input.language,
      });
      body = [
        h(
          'ol',
          { class: 'preview-list', dataset: { testid: 'preview-section' } },
          ...questions.map((q, i) =>
            h(
              'li',
              { class: 'preview-item' },
              h('span', { class: 'preview-code', text: `${q.topicId} · ${q.templateId}` }),
              h('span', {
                class: 'preview-q',
                text:
                  [q.prompt.text, q.prompt.expression]
                    .filter((x) => x && x.length > 0)
                    .join('  ') || `(${q.widget})`,
              }),
              h('span', {
                class: 'preview-a',
                text: t('setup.preview.answer', { answer: answerText(q) }),
              }),
              h('span', {
                class: 'preview-w',
                text: `#${i + 1} · ${q.widget} · ${q.difficultyBand}`,
              }),
            ),
          ),
        ),
      ];
    } catch (error) {
      body = [
        h('p', {
          class: 'error',
          role: 'alert',
          text: t('app.raceError', {
            reason: error instanceof Error ? error.message : String(error),
          }),
        }),
      ];
    }
    contentDialog(t, t('setup.preview.title'), body);
  }
}
