import type { Translator } from '../locales';
import { contentDialog } from './dialogs';
import { h } from './dom';

/** Teacher help: how to play, pausing, the PBD boundary, privacy and how touch ownership works. */
export function showHelp(t: Translator, host: HTMLElement = document.body): { close: () => void } {
  return contentDialog(
    t,
    t('help.title'),
    [
      h(
        'section',
        {},
        h('h3', { text: t('help.how.title') }),
        h(
          'ol',
          {},
          ...(['help.how.1', 'help.how.2', 'help.how.3', 'help.how.4'] as const).map((k) =>
            h('li', { text: t(k) }),
          ),
        ),
      ),
      h(
        'section',
        {},
        h('h3', { text: t('help.teacher.title') }),
        h('p', { text: t('help.setup') }),
        h(
          'ul',
          {},
          ...(['help.teacher.1', 'help.teacher.2', 'help.teacher.3'] as const).map((k) =>
            h('li', { text: t(k) }),
          ),
        ),
      ),
      h(
        'section',
        { dataset: { testid: 'help-pbd' } },
        h('h3', { text: t('help.pbd.title') }),
        h('p', { text: t('help.pbd.body') }),
      ),
      h(
        'section',
        {},
        h('h3', { text: t('help.privacy.title') }),
        h('p', { text: t('help.privacy.body') }),
      ),
      h(
        'section',
        {},
        h('h3', { text: t('help.touch.title') }),
        h('p', { text: t('help.touch.body') }),
      ),
    ],
    host,
  );
}
