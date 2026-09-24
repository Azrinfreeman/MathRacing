import type { Language } from '../../curriculum/schema';
import type { AttemptRecord, RaceResult, SessionMeta } from '../../game/core/RaceState';
import type { PlayerStyle } from '../../game/core/players';
import { racerInfo } from '../../game/core/racers';
import type { RacerId } from '../../game/core/racers';
import { createTranslator } from '../../locales';
import { summarizeEvidence } from '../../reporting/evidence';
import { racerSvg } from '../art';
import { svgArt } from '../controls';
import { clear, h } from '../dom';
import type { Child } from '../dom';

export type ResultsData = {
  language: Language;
  result: RaceResult;
  meta: SessionMeta;
  attempts: readonly AttemptRecord[];
  players: readonly { id: string; name: string; style: PlayerStyle; racer: RacerId }[];
  raceLength: number;
  /** Topic id -> display title. */
  topicTitles: Record<string, string>;
};

export type ResultsCallbacks = {
  onAgain(): void;
  onNewSetup(): void;
  onExport(): void;
  /** Resolves true when the data was deleted (after the teacher confirmed). */
  onDelete(): Promise<boolean>;
};

const SYMBOLS: Record<string, string> = {
  star: '★',
  circle: '●',
  triangle: '▲',
  square: '■',
  diamond: '◆',
};

/**
 * Class-safe results: finishing order and progress only. No accuracy percentages and no wrong-answer counts
 * are shown to the class; evidence for the teacher sits behind an explicit button and is labelled as evidence,
 * never as an official Tahap Penguasaan.
 */
export class ResultsScreen {
  private root: HTMLElement | null = null;
  private evidenceOpen = false;
  private dataDeleted = false;
  private status = '';

  constructor(
    private data: ResultsData,
    private readonly cb: ResultsCallbacks,
  ) {}

  mount(root: HTMLElement): void {
    this.root = root;
    this.render();
    root.querySelector<HTMLElement>('#main')?.focus();
  }

  unmount(): void {
    if (this.root) clear(this.root);
    this.root = null;
  }

  private render(): void {
    const root = this.root;
    if (!root) return;
    const { data } = this;
    const t = createTranslator(data.language);
    clear(root);

    const winner = data.players.find((p) => p.id === data.result.winnerId);
    let bannerText: string;
    if (winner) bannerText = t('results.winner', { name: winner.name });
    else if (data.result.mode === 'practice') bannerText = t('results.practice');
    else bannerText = t('results.noWinner');

    const banner = h(
      'section',
      { class: 'winner-banner', dataset: { testid: 'winner-banner' }, aria: { live: 'polite' } },
      winner
        ? h('span', {
            class: 'winner-symbol',
            style: `background:${winner.style.color}`,
            aria: { hidden: true },
            text: SYMBOLS[winner.style.symbol] ?? '',
          })
        : null,
      h('h2', { class: 'winner-text', text: bannerText }),
    );

    const styleOf = (id: string): PlayerStyle | undefined =>
      data.players.find((p) => p.id === id)?.style;
    const racerOf = (id: string): HTMLElement | null => {
      const p = data.players.find((q) => q.id === id);
      return p ? svgArt(racerSvg(p.style, p.racer), 'standing-racer') : null;
    };
    const standings = h(
      'ol',
      { class: 'standings', dataset: { testid: 'standings' } },
      ...data.result.standings.map((s) => {
        const style = styleOf(s.playerId);
        const pct = Math.min(100, Math.round((s.progress / data.raceLength) * 100));
        return h(
          'li',
          { class: 'standing' },
          h('span', { class: 'place', text: t('results.place', { n: s.place }) }),
          h('span', {
            class: 'standing-sym',
            style: `background:${style?.color ?? '#475569'}`,
            aria: { hidden: true },
            text: SYMBOLS[style?.symbol ?? ''] ?? '',
          }),
          racerOf(s.playerId),
          h('span', { class: 'standing-name', text: s.name }),
          h(
            'span',
            {
              class: 'bar',
              role: 'img',
              aria: { label: t('results.progress', { n: s.progress, total: data.raceLength }) },
            },
            h('span', {
              class: 'bar-fill',
              style: `width:${pct}%;background:${style?.color ?? '#475569'}`,
            }),
          ),
          h('span', {
            class: 'standing-progress',
            text: t('results.progress', { n: s.progress, total: data.raceLength }),
          }),
        );
      }),
    );

    const evidence = this.evidenceOpen ? this.renderEvidence(t) : null;
    const buttons = h(
      'div',
      { class: 'actions results-actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-primary btn-large',
        dataset: { testid: 'again' },
        text: `↻ ${t('results.again')}`,
        on: { click: () => this.cb.onAgain() },
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-large',
        dataset: { testid: 'new-setup' },
        text: t('results.newSetup'),
        on: { click: () => this.cb.onNewSetup() },
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-large',
        dataset: { testid: 'export-csv' },
        text: t('results.export'),
        on: { click: () => this.cb.onExport() },
      }),
      h('button', {
        type: 'button',
        class: 'btn btn-danger btn-large',
        dataset: { testid: 'delete-session' },
        disabled: this.dataDeleted,
        text: t('results.deleteSession'),
        on: { click: () => void this.delete() },
      }),
    );

    root.appendChild(
      h(
        'div',
        { class: 'app-shell results-shell' },
        h('a', { class: 'skip-link', href: '#main', text: t('app.skipToMain') }),
        h(
          'header',
          { class: 'topbar' },
          h('img', { class: 'logo', src: './icons/icon.svg', alt: '' }),
          h(
            'div',
            { class: 'brand' },
            h('h1', { text: t('app.name') }),
            h('p', { text: t('results.title') }),
          ),
        ),
        h(
          'main',
          { id: 'main', tabindex: -1 },
          banner,
          standings,
          buttons,
          h('p', {
            class: 'status',
            role: 'status',
            dataset: { testid: 'results-status' },
            text: this.status,
          }),
          h('button', {
            type: 'button',
            class: 'btn',
            dataset: { testid: 'toggle-evidence' },
            aria: { expanded: this.evidenceOpen },
            text: this.evidenceOpen ? t('results.evidence.hide') : t('results.evidence.show'),
            on: {
              click: () => {
                this.evidenceOpen = !this.evidenceOpen;
                this.render();
                root.querySelector<HTMLElement>('[data-testid="toggle-evidence"]')?.focus();
              },
            },
          }),
          evidence,
          h('p', {
            class: 'note',
            dataset: { testid: 'results-seed' },
            text: t('results.seed', { seed: data.meta.seed }),
          }),
          h('p', {
            class: 'pbd-note',
            dataset: { testid: 'results-pbd' },
            text: t('results.evidence.note'),
          }),
        ),
      ),
    );
  }

  private renderEvidence(t: ReturnType<typeof createTranslator>): HTMLElement {
    const { data } = this;
    const summary = summarizeEvidence(data.attempts, data.players);
    const th = (text: string): HTMLElement => h('th', { scope: 'col' }, text);
    // The racer picture with its name as text, so the evidence table says which racer each pupil used.
    const evidenceName = (id: string, name: string): Child[] => {
      const p = data.players.find((q) => q.id === id);
      if (!p) return [name];
      return [
        svgArt(racerSvg(p.style, p.racer), 'evidence-racer'),
        name,
        h('span', {
          class: 'evidence-racer-name',
          text: ` (${racerInfo(p.racer).name[data.language]})`,
        }),
      ];
    };
    const playerRows: Child[] = summary.players.map((p) =>
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, ...evidenceName(p.playerId, p.name)),
        h('td', { text: String(p.correct) }),
        h('td', { text: String(p.attempts) }),
        h('td', { text: String(p.hintsUsed) }),
        h('td', { text: String(p.supportUsed) }),
        h('td', { text: String(p.setbacks) }),
      ),
    );
    const topicRows: Child[] = summary.topics.map((tp) =>
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, data.topicTitles[tp.topicId] ?? tp.topicId),
        h('td', { text: tp.sk }),
        h('td', { text: String(tp.items) }),
        h('td', { text: String(tp.attempts) }),
        h('td', { text: String(tp.correct) }),
      ),
    );
    return h(
      'section',
      { class: 'evidence', dataset: { testid: 'evidence' } },
      h('h3', { text: t('results.evidence.title') }),
      h('p', { class: 'note', text: t('results.evidence.note') }),
      h(
        'table',
        { class: 'table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            th(t('results.evidence.player')),
            th(t('results.evidence.correct')),
            th(t('results.evidence.attempts')),
            th(t('results.evidence.hints')),
            th(t('results.evidence.support')),
            th(t('results.evidence.setbacks')),
          ),
        ),
        h('tbody', {}, ...playerRows),
      ),
      h(
        'table',
        { class: 'table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            th(t('results.evidence.topic')),
            th(t('results.evidence.sk')),
            th(t('results.evidence.items')),
            th(t('results.evidence.attempts')),
            th(t('results.evidence.correct')),
          ),
        ),
        h('tbody', {}, ...topicRows),
      ),
    );
  }

  private async delete(): Promise<void> {
    const t = createTranslator(this.data.language);
    const deleted = await this.cb.onDelete();
    if (deleted) {
      this.dataDeleted = true;
      this.status = t('results.deleted');
      this.data = { ...this.data, attempts: [] };
      this.render();
    }
  }

  /** Called by the app after an export attempt so the teacher gets feedback. */
  showStatus(message: string): void {
    this.status = message;
    const el = this.root?.querySelector<HTMLElement>('[data-testid="results-status"]');
    if (el) el.textContent = message;
  }
}
