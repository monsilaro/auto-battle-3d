// mulberry32 — tiny deterministic PRNG. State is a single uint32 kept in
// BattleState so snapshots/replays capture it exactly.

export function rngNext(state: number): { value: number; state: number } {
  let s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

export class Rng {
  constructor(public state: number) {}

  next(): number {
    const r = rngNext(this.state);
    this.state = r.state;
    return r.value;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}
