// Singleton tooltip. Elements opt in with data-tip="<key>"; content builders
// are registered per key and produce a DOM node on show. Follows the cursor,
// clamped to the viewport, no delay — placement puzzles die without legible
// rules.

type TipBuilder = () => HTMLElement | string | null;

const builders = new Map<string, TipBuilder>();
let tipEl: HTMLDivElement | null = null;
let currentKey: string | null = null;

export function registerTip(key: string, builder: TipBuilder): void {
  builders.set(key, builder);
}

export function initTooltips(root: HTMLElement): void {
  tipEl = document.createElement('div');
  tipEl.id = 'tooltip';
  tipEl.classList.add('hidden');
  root.appendChild(tipEl);

  document.addEventListener('pointerover', (e) => {
    const target = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
    const key = target?.dataset.tip ?? null;
    if (key === currentKey) return;
    currentKey = key;
    if (!key) {
      hide();
      return;
    }
    const builder = builders.get(key);
    const content = builder ? builder() : null;
    if (content == null) {
      hide();
      return;
    }
    tipEl!.replaceChildren(typeof content === 'string' ? document.createTextNode(content) : content);
    tipEl!.classList.remove('hidden');
    position(e.clientX, e.clientY);
  });

  document.addEventListener('pointermove', (e) => {
    if (currentKey && tipEl && !tipEl.classList.contains('hidden')) {
      position(e.clientX, e.clientY);
    }
  });

  document.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget as HTMLElement | null;
    if (!to || !to.closest('[data-tip]')) {
      currentKey = null;
      hide();
    }
  });
}

function hide(): void {
  tipEl?.classList.add('hidden');
}

function position(mx: number, my: number): void {
  const el = tipEl!;
  const pad = 14;
  const rect = el.getBoundingClientRect();
  let x = mx + pad;
  let y = my + pad;
  if (x + rect.width > window.innerWidth - 8) x = mx - rect.width - pad;
  if (y + rect.height > window.innerHeight - 8) y = my - rect.height - pad;
  el.style.transform = `translate3d(${Math.max(4, x)}px, ${Math.max(4, y)}px, 0)`;
}
