import type { Translator } from '../locales';
import type { Child } from './dom';
import { h } from './dom';

type DialogLike = HTMLDialogElement & { showModal?: () => void };

function openDialog(dialog: DialogLike): void {
  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal();
      return;
    } catch (error) {
      console.warn('showModal failed, falling back to a plain open dialog', error);
    }
  }
  dialog.setAttribute('open', '');
}

function closeDialog(dialog: DialogLike): void {
  if (typeof dialog.close === 'function') {
    try {
      dialog.close();
    } catch (error) {
      console.warn('dialog.close failed', error);
    }
  }
  dialog.removeAttribute('open');
  dialog.remove();
}

/**
 * Accessible modal confirmation (a native <dialog>: focus is trapped, Esc cancels). Resolves true only when
 * the teacher confirms; Cancel, Esc and clicking outside all resolve false.
 */
export function confirmDialog(
  t: Translator,
  message: string,
  confirmLabel?: string,
  host: HTMLElement = document.body,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      closeDialog(dialog);
      resolve(value);
    };
    const dialog = h(
      'dialog',
      {
        class: 'dialog',
        aria: { labelledby: 'confirm-msg' },
        dataset: { testid: 'confirm-dialog' },
      },
      h('p', { id: 'confirm-msg', class: 'dialog-message', text: message }),
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', {
          type: 'button',
          class: 'btn',
          dataset: { testid: 'confirm-cancel' },
          text: t('dialog.cancel'),
          on: { click: () => finish(false) },
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-danger',
          dataset: { testid: 'confirm-ok' },
          text: confirmLabel ?? t('dialog.confirm'),
          on: { click: () => finish(true) },
        }),
      ),
    ) as DialogLike;
    dialog.addEventListener('cancel', () => finish(false));
    dialog.addEventListener('close', () => finish(false));
    host.appendChild(dialog);
    openDialog(dialog);
    dialog.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel"]')?.focus();
  });
}

/** A modal dialog with arbitrary content and a close button. */
export function contentDialog(
  t: Translator,
  title: string,
  body: Child[],
  host: HTMLElement = document.body,
): { close: () => void } {
  const close = (): void => closeDialog(dialog);
  const dialog = h(
    'dialog',
    {
      class: 'dialog dialog-wide',
      aria: { labelledby: 'content-title' },
      dataset: { testid: 'content-dialog' },
    },
    h('h2', { id: 'content-title', text: title }),
    h('div', { class: 'dialog-body' }, ...body),
    h(
      'div',
      { class: 'dialog-actions' },
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        dataset: { testid: 'content-close' },
        text: t('app.close'),
        on: { click: close },
      }),
    ),
  ) as DialogLike;
  dialog.addEventListener('cancel', close);
  host.appendChild(dialog);
  openDialog(dialog);
  dialog.querySelector<HTMLButtonElement>('[data-testid="content-close"]')?.focus();
  return { close };
}

/** Lightweight status message that screen readers announce (polite live region). */
export function toast(
  host: HTMLElement,
  message: string,
  kind: 'info' | 'warn' = 'info',
  ms = 6000,
): void {
  const el = h('div', { class: `toast toast-${kind}`, role: 'status', text: message });
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
