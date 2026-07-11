// Tiny DOM helpers — the entire "framework".

type Child = Node | string | null | undefined;

export interface ElAttrs {
  class?: string;
  text?: string;
  title?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  onInput?: (e: Event) => void;
  dataset?: Record<string, string>;
  style?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElAttrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.title) node.title = attrs.title;
  if (attrs.style) node.setAttribute('style', attrs.style);
  if (attrs.type && node instanceof HTMLInputElement) node.type = attrs.type;
  if (attrs.value !== undefined && node instanceof HTMLInputElement) node.value = attrs.value;
  if (attrs.placeholder && node instanceof HTMLInputElement) node.placeholder = attrs.placeholder;
  if (attrs.disabled !== undefined && 'disabled' in node) {
    (node as HTMLButtonElement).disabled = attrs.disabled;
  }
  if (attrs.onClick) node.addEventListener('click', attrs.onClick as EventListener);
  if (attrs.onContextMenu) {
    node.addEventListener('contextmenu', attrs.onContextMenu as EventListener);
  }
  if (attrs.onInput) node.addEventListener('input', attrs.onInput);
  if (attrs.dataset) {
    for (const [k, v] of Object.entries(attrs.dataset)) node.dataset[k] = v;
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c);
  }
  return node;
}

export interface Signal<T> {
  get(): T;
  set(v: T): void;
  sub(fn: (v: T) => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(v: T) {
      value = v;
      for (const fn of subs) fn(v);
    },
    sub(fn: (v: T) => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
