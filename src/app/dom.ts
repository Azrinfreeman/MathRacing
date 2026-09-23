/** Minimal typed DOM builder: keeps the screens readable without a framework. */
export type Child = Node | string | number | null | undefined | false;

export type Attrs = {
  class?: string;
  id?: string;
  /** Sets textContent (never innerHTML, so user text can never inject markup). */
  text?: string;
  type?: string;
  value?: string;
  name?: string;
  for?: string;
  href?: string;
  src?: string;
  alt?: string;
  style?: string;
  scope?: string;
  role?: string;
  title?: string;
  placeholder?: string;
  maxlength?: number;
  min?: number;
  max?: number;
  checked?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  open?: boolean;
  autocomplete?: string;
  tabindex?: number;
  dataset?: Record<string, string>;
  aria?: Record<string, string | boolean>;
  on?: {
    [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
  };
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs.class !== undefined) el.className = attrs.class;
  if (attrs.id !== undefined) el.id = attrs.id;
  if (attrs.text !== undefined) el.textContent = attrs.text;
  const set = (name: string, value: string | number | undefined): void => {
    if (value !== undefined) el.setAttribute(name, String(value));
  };
  set('type', attrs.type);
  set('name', attrs.name);
  set('for', attrs.for);
  set('href', attrs.href);
  set('src', attrs.src);
  set('alt', attrs.alt);
  set('style', attrs.style);
  set('scope', attrs.scope);
  set('role', attrs.role);
  set('title', attrs.title);
  set('placeholder', attrs.placeholder);
  set('maxlength', attrs.maxlength);
  set('min', attrs.min);
  set('max', attrs.max);
  set('autocomplete', attrs.autocomplete);
  set('tabindex', attrs.tabindex);
  if (attrs.value !== undefined) (el as unknown as { value: string }).value = attrs.value;
  if (attrs.checked !== undefined) (el as unknown as { checked: boolean }).checked = attrs.checked;
  if (attrs.disabled !== undefined)
    (el as unknown as { disabled: boolean }).disabled = attrs.disabled;
  if (attrs.hidden) el.hidden = true;
  if (attrs.open) el.setAttribute('open', '');
  for (const [k, v] of Object.entries(attrs.dataset ?? {})) el.dataset[k] = v;
  for (const [k, v] of Object.entries(attrs.aria ?? {})) el.setAttribute(`aria-${k}`, String(v));
  for (const [event, handler] of Object.entries(attrs.on ?? {})) {
    if (handler) el.addEventListener(event, handler as EventListener);
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
