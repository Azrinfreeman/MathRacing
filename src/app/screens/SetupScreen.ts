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
import { symbolBadgeSvg, topicIconSvg, racerSvg } from '../art';
import { choice, svgArt } from '../controls';
import { contentDialog } from '../dialogs';
import { clear, h } from '../dom';
import type { Child } from '../dom';
import type { SetupInput, SetupState } from '../setupState';
import { buildSetupInput, defaultTopicForYear, keepYearTopics } from '../setupState';

export type SetupStep = 1 | 2 | 3;

const TOPIC_LABELS: Record<string, MessageKey> = {
  'y1-numbers': 'setup.short.numbers',
  'y2-numbers': 'setup.short.numbers',
  'y1-operations': 'setup.short.operations',
  'y2-operations': 'setup.short.operations',
  'y1-money': 'setup.short.money',
  'y2-money': 'setup.short.money',
  'y1-time': 'setup.short.time',
  'y2-time': 'setup.short.time',
  'y1-measurement': 'setup.short.measurement',
  'y2-measurement': 'setup.short.measurement',
  'y1-space': 'setup.short.space',
  'y2-space': 'setup.short.space',
  'y1-data': 'setup.short.data',
  'y2-data': 'setup.short.data',
  'y2-fractions': 'setup.short.fractions',
};

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
  { step: 1, key: 'setup.step.topics' },
  { step: 2, key: 'setup.step.players' },
  { step: 3, key: 'setup.step.ready' },
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
      ? TOPIC_LABELS[first.id]
        ? t(TOPIC_LABELS[first.id]!)
        : pickText(s.language, first.title)
      : chosen.length === 0
        ? '-'
        : t('setup.summary.topics', { n: chosen.length });
  const year = t(`setup.year.${s.year}` as MessageKey);
  const level = t(`setup.level.${s.level}` as MessageKey);
  const players = t('setup.summary.players', { n: s.playerCount });
  return { year, topics, level, players, line: [year, topics, level, players].join(' · ') };
}

/**
 * Race setup as three touch-first steps (Questions, Players, Ready), each one screen with large
 * cards. A stepper at the top jumps to any step; Back and Next sit at the bottom. Teacher-only options live
 * on the separate teacher settings screen.
 */
export class SetupScreen {
  private root: HTMLElement | null = null;
  private step: SetupStep;
  private error = '';
  private namesOpen = false;
  private returnToReview = false;
  private t: Translator;

  constructor(private readonly deps: SetupDeps) {
    this.step = deps.step;
    this.t = createTranslator(deps.state.language);
    keepYearTopics(deps.registry, deps.state);
    if (deps.state.topicIds.size === 0) this.step = 1;
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
    if (step !== 1 && this.s.topicIds.size === 0) {
      this.step = 1;
      this.error = this.t('setup.error.topics');
      this.render();
      this.focusStep();
      return;
    }
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
    if (this.s.topicIds.size === 0) {
      this.error = this.t('setup.error.topics');
      this.render();
      return;
    }
    if (this.returnToReview) {
      this.returnToReview = false;
      this.go(3);
    } else if (this.step < 3) this.go((this.step + 1) as SetupStep);
  }

  private back(): void {
    if (this.returnToReview) {
      this.returnToReview = false;
      this.go(3);
      return;
    }
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
    this.error = '';
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
        class: 'btn btn-quiet',
        dataset: { key: 'setup-home', testid: 'setup-home' },
        text: `⌂ ${t('menu.home')}`,
        on: { click: () => this.deps.onHome() },
      }),
      h('h2', { class: 'wiz-title', text: t('setup.title') }),
      h('button', {
        type: 'button',
        class: 'btn btn-quiet',
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
                on: {
                  click: () => {
                    this.returnToReview = false;
                    this.go(step);
                  },
                },
              },
              h('span', { class: 'step-num', text: step < this.step ? '✓' : String(step) }),
              h('span', { class: 'step-name', text: t(key) }),
            ),
          ),
        ),
      ),
    );

    const body =
      this.step === 1 ? this.stepTopics() : this.step === 2 ? this.stepPlayers() : this.stepReady();

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
        id: 'setup-error',
        class: 'error',
        role: 'alert',
        dataset: { testid: 'setup-error' },
        text: this.error || (this.s.topicIds.size === 0 ? t('setup.error.topics') : ''),
      }),
      this.step < 3
        ? h('button', {
            type: 'button',
            class: 'btn btn-primary btn-large',
            dataset: { key: 'setup-next', testid: 'setup-next' },
            disabled: this.s.topicIds.size === 0,
            text: `${t(this.returnToReview || this.step === 2 ? 'setup.review' : 'setup.nextPlayers')} →`,
            on: { click: () => this.next() },
          })
        : h('button', {
            type: 'button',
            class: 'btn btn-primary btn-large btn-start',
            dataset: { key: 'start', testid: 'start' },
            disabled: this.s.topicIds.size === 0,
            text: `${t(this.s.mode === 'quick' ? 'setup.startRace' : 'setup.startPractice')} →`,
            on: { click: () => this.start() },
          }),
    );

    root.appendChild(
      h(
        'div',
        { class: 'wizard simple-menus' },
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
      'div',
      { class: 'year-picker' },
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
            className: 'card year-card',
            onChange: () => {
              this.setYear(y);
              this.changed();
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
        h('h3', { class: 'panel-title', text: t('setup.topics') }),
        h('span', { class: 'topic-hint', text: t('setup.topics.hint') }),
        h(
          'div',
          { class: 'inline-actions' },
          h('button', {
            type: 'button',
            class: 'btn btn-text',
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
        ),
      ),
      h(
        'div',
        {
          class: 'topic-grid',
          role: 'group',
          aria: { label: t('setup.topics'), describedby: 'setup-error' },
        },
        ...pack.topics.map((topic) =>
          choice({
            type: 'checkbox',
            name: 'topic',
            key: `topic-${topic.id}`,
            checked: s.topicIds.has(topic.id),
            title: TOPIC_LABELS[topic.id]
              ? t(TOPIC_LABELS[topic.id]!)
              : pickText(lang, topic.title),
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
    const packInfo = h(
      'button',
      {
        type: 'button',
        class: 'pack-chip',
        dataset: { key: 'pack-info', testid: 'pack-info' },
        aria: { label: `${t('setup.pack')}: ${pickText(lang, pack.title)}. ${t('setup.draft')}` },
        on: {
          click: () =>
            contentDialog(t, t('setup.pack'), [
              h('p', { class: 'dialog-message', text: pickText(lang, pack.title) }),
              h('p', { text: t('setup.packStatus', { version: pack.version }) }),
              h(
                'ul',
                {},
                ...pack.topics.map((topic) =>
                  h(
                    'li',
                    {},
                    `${topic.code} ${pickText(lang, topic.title)} · ${t('setup.topic.sk', { sk: topic.standardKandungan })}`,
                  ),
                ),
              ),
            ]),
        },
      },
      h('span', { class: 'pack-chip-icon', aria: { hidden: true }, text: 'i' }),
      h('span', { class: 'pack-chip-text', text: t('setup.pack') }),
      h('span', {
        class: 'pack-chip-draft',
        text: t('setup.draft'),
      }),
    );
    const levelPanel = h(
      'div',
      { class: 'panel level-panel' },
      h('h3', { class: 'panel-title', text: t('setup.level') }),
      h(
        'div',
        {
          class: 'level-grid',
          role: 'radiogroup',
          aria: { label: t('setup.level'), describedby: 'level-hint' },
        },
        ...LEVELS.map((lv) =>
          choice({
            type: 'radio',
            name: 'level',
            key: `level-${lv}`,
            checked: s.level === lv,
            title: t(`setup.level.${lv}` as MessageKey),
            className: 'card level-card',
            onChange: () => {
              s.level = lv;
              this.changed();
            },
          }),
        ),
      ),
      h('p', { id: 'level-hint', class: 'visually-hidden', text: t('setup.level.hint') }),
    );
    return h(
      'section',
      { class: 'step step-topics' },
      h('div', { class: 'question-heading' }, this.title('setup.questions.pick'), this.stepYear()),
      topicPanel,
      levelPanel,
      h(
        'div',
        { class: 'question-tools' },
        packInfo,
        h('button', {
          type: 'button',
          class: 'btn btn-text',
          dataset: { key: 'preview', testid: 'preview' },
          text: t('setup.preview'),
          on: { click: () => this.showPreview() },
        }),
      ),
    );
  }

  private stepPlayers(): HTMLElement {
    const t = this.t;
    const s = this.s;
    this.namesOpen ||= s.names.slice(0, s.playerCount).some((name) => name.trim() !== '');
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
            this.namesOpen
              ? h('label', {
                  for: id,
                  class: 'visually-hidden',
                  text: t('setup.playerName', { n: i + 1 }),
                })
              : null,
            this.namesOpen
              ? h('input', {
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
                })
              : null,
          );
        }),
      ),
      this.namesOpen
        ? null
        : h('button', {
            type: 'button',
            class: 'btn btn-text names-toggle',
            dataset: { testid: 'names-toggle', key: 'names-toggle' },
            aria: { expanded: String(this.namesOpen) },
            text: t('setup.names.add'),
            on: {
              click: () => {
                this.namesOpen = !this.namesOpen;
                this.changed();
                if (this.namesOpen) this.root?.querySelector<HTMLInputElement>('#name-0')?.focus();
              },
            },
          }),
      this.namesOpen ? h('p', { class: 'note note-small', text: t('setup.privacyHint') }) : null,
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
      action: () => void,
      extra?: HTMLElement,
    ): HTMLElement =>
      h(
        'button',
        {
          type: 'button',
          class: 'summary-tile',
          dataset: { key, testid: key },
          on: { click: action },
        },
        h('span', { class: 'summary-label', text: t(label) }),
        h('span', { class: 'summary-value', text: value }),
        extra ?? null,
        h('span', { class: 'summary-change', text: t('setup.ready.change') }),
      );
    return h(
      'section',
      { class: 'step step-ready' },
      this.title(s.mode === 'quick' ? 'setup.ready.title' : 'setup.ready.practice'),
      h(
        'div',
        { class: 'summary-grid' },
        tile(
          'sum-questions',
          'setup.step.topics',
          [sum.year, sum.topics, sum.level].join(' · '),
          () => {
            this.returnToReview = true;
            this.go(1);
          },
        ),
        tile(
          'sum-players',
          'setup.players',
          sum.players,
          () => {
            this.returnToReview = true;
            this.go(2);
          },
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
        tile(
          'sum-game',
          'teacher.group.game',
          `${t(s.mode === 'quick' ? 'menu.race' : 'menu.practice')} · ${t('setup.length.steps', { n: s.raceLength })}`,
          () => this.editGame(),
        ),
      ),
      h('p', {
        class: 'note ready-hint',
        text: t(s.cruiseEnabled ? 'setup.ready.boost' : 'setup.ready.steps'),
      }),
    );
  }

  private editGame(): void {
    const t = this.t;
    let mode = this.s.mode;
    let length = this.s.raceLength;
    const options = h('div', { class: 'ready-options' });
    const render = (): void => {
      clear(options);
      options.append(
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
                checked: mode === m,
                title: t(m === 'quick' ? 'setup.mode.quick' : 'setup.mode.practice'),
                description: t(
                  m === 'quick' ? 'setup.mode.quick.desc' : 'setup.mode.practice.desc',
                ),
                className: 'card mode-card',
                onChange: () => {
                  mode = m;
                  render();
                  options.querySelector<HTMLElement>(`[data-key="mode-${m}"]`)?.focus();
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
                checked: length === n,
                title: String(n),
                className: 'card length-card',
                onChange: () => {
                  length = n;
                  render();
                  options.querySelector<HTMLElement>(`[data-key="length-${n}"]`)?.focus();
                },
              }),
            ),
          ),
        ),
      );
    };
    render();
    const dialog = contentDialog(
      t,
      t('teacher.group.game'),
      [
        options,
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          dataset: { testid: 'game-save' },
          text: t('setup.done'),
          on: {
            click: () => {
              this.s.mode = mode;
              this.s.raceLength = length;
              dialog.close();
              this.changed();
              this.root?.querySelector<HTMLElement>('[data-testid="sum-game"]')?.focus();
            },
          },
        }),
      ],
      document.body,
      t('dialog.cancel'),
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
