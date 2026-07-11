import { el } from './dom';

export function createMainMenu(onStart: (seed: number) => void): HTMLElement {
  const seedInput = el('input', { type: 'text', placeholder: 'Seed (optional)' });
  return el(
    'div',
    { class: 'screen menu-screen' },
    el('div', { class: 'menu-rule', text: '✦ ✦ ✦' }),
    el('h1', { text: 'Gravemarch' }),
    el('p', { class: 'menu-tag', text: 'Ten nights. One warband. No second chances.' }),
    el('p', {
      class: 'menu-body',
      text: 'The Pale Court hungers. Raise your settlement on the last unbroken isle, field your warband from its halls, and hold the line for ten nights. Lose a single battle and the march ends.',
    }),
    seedInput,
    el('button', {
      class: 'primary horn',
      text: 'Begin the March',
      onClick: () => {
        const raw = seedInput.value.trim();
        const seed = raw ? hashSeed(raw) : (Math.random() * 0xffffffff) | 0;
        onStart(seed);
      },
    }),
    el('div', { class: 'menu-rule', text: '✦ ✦ ✦' }),
  );
}

// User-facing seed strings → int. Math.random above is UI-side only; the sim
// receives a fixed integer seed.
function hashSeed(s: string): number {
  const n = Number(s);
  if (Number.isFinite(n) && n !== 0) return n | 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
