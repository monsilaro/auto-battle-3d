// Global tuning knobs. All sim-relevant magic numbers live here.

export const TICK_MS = 50; // 20 Hz
export const TICK_DT = TICK_MS / 1000; // 0.05 s
export const BATTLE_TIMEOUT_TICKS = 1800; // 90 s → defeat

export const ROUNDS_TO_WIN = 10;

export const START_GOLD = 8;
export const BASE_INCOME_GOLD = 4; // per round won

// Battlefield (sim-local coordinates). The village sits WEST of the field in
// the same coordinate space — player units spawn at their building's cell and
// march east into the fray.
export const FIELD_W = 30; // x
export const FIELD_H = 20; // z
export const FIELD_MIN_X = -23; // village zone extends into negative x
export const VILLAGE_BATTLE_ORIGIN = { x: -12, z: 10 }; // hex (0,0) in battle space
export const HEX_WORLD_SIZE = 1.7; // hex outer radius (render mirrors this)

export const ENEMY_FRONT_X = 20;
export const ENEMY_BACK_X = 24;
export const DEPLOY_Z_MIN = 2;
export const DEPLOY_ROW_SPACING = 1.6;
export const DEPLOY_COL_SPACING = 1.5;
export const DEPLOY_ROWS = 10; // units per column before wrapping
export const DEPLOY_JITTER = 0.3;

export const MELEE_RANGE_THRESHOLD = 3; // rangeM below this = front-line deploy (horde rows)

export const SELL_REFUND_PCT = 100; // full refund — encourages re-planning the layout
