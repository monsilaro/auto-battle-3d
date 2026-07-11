// Perf overlay, toggled with ` (backquote). P toggles the post stack,
// M mutes audio — handled in main.ts; this just displays.

export interface DebugStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  units: number;
  postEnabled: boolean;
}

export function createDebugOverlay(root: HTMLElement): {
  toggle(): void;
  visible(): boolean;
  update(stats: DebugStats): void;
} {
  const node = document.createElement('div');
  node.id = 'debug-overlay';
  node.classList.add('hidden');
  root.appendChild(node);

  return {
    toggle() {
      node.classList.toggle('hidden');
    },
    visible: () => !node.classList.contains('hidden'),
    update(s) {
      node.textContent =
        `fps ${s.fps.toFixed(0)}  frame ${s.frameMs.toFixed(1)}ms\n` +
        `calls ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k\n` +
        `units ${s.units}  post ${s.postEnabled ? 'on' : 'off'}\n` +
        '` overlay · P post · M mute';
    },
  };
}
