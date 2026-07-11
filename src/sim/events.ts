export type SimEvent =
  | { t: 'attack'; id: number; targetId: number }
  | { t: 'hit'; id: number; amount: number }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'death'; id: number }
  | { t: 'ability'; id: number; kind: string }
  | { t: 'blessing'; blessingId: string }
  | { t: 'summon'; ids: number[] }
  | { t: 'battleEnd'; status: 'victory' | 'defeat' };
