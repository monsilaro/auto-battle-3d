// Screen registry: full-viewport overlay divs swapped over the canvas.

const screens = new Map<string, HTMLElement>();
let uiRoot: HTMLElement | null = null;

export function initScreens(root: HTMLElement): void {
  uiRoot = root;
}

export function registerScreen(name: string, node: HTMLElement): void {
  screens.set(name, node);
  node.classList.add('hidden');
  uiRoot!.appendChild(node);
}

export function showScreen(name: string | null): void {
  for (const [n, node] of screens) node.classList.toggle('hidden', n !== name);
}
