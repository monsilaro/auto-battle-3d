import { signal } from '../ui/dom';

// App-level screen state. Run-level phase (build/battle/won/lost) lives in
// the sim's RunState; this is only menu ↔ game.

export type AppScreen = 'menu' | 'game';

export const appScreen = signal<AppScreen>('menu');
