import { TICK_MS } from '../data/balance';

// Fixed-timestep accumulator. Sim ticks at exactly 20 Hz regardless of frame
// rate; render receives the interpolation alpha. 2x speed accumulates faster
// but produces the identical tick sequence.

export class GameLoop {
  speed = 1;
  private acc = 0;
  private last = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private tick: () => void,
    private render: (alpha: number, dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      // Clamp so a background tab doesn't spiral on refocus.
      const dt = Math.min(now - this.last, 250);
      this.last = now;
      this.acc += dt * this.speed;
      while (this.acc >= TICK_MS) {
        this.acc -= TICK_MS;
        this.tick();
      }
      this.render(this.acc / TICK_MS, dt / 1000);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
