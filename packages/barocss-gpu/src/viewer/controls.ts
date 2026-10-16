// Orbit, pan and zoom of a camera about its target: turntable orbit about the camera's up axis, pan in
// the view plane by the pixels dragged, and zoom toward the point under the cursor. The moves are plain
// functions of the camera; OrbitControls binds them to pointer and wheel events.
import type { Camera } from './camera.js';
import { add, cross, dot, length, normalize, rotation, scale, sub, transformDirection, type Vec3 } from './math.js';

/** Turn the camera about its target: dx about the up axis, dy toward or away from it (radians). */
export function orbit(camera: Camera, dx: number, dy: number): void {
  const up = normalize(camera.up), offset = sub(camera.position, camera.target);
  let o = transformDirection(rotation(up, -dx), offset);
  // Tilt about the right axis, stopping short of the poles.
  const right = normalize(cross(up, o)), current = Math.acos(Math.max(-1, Math.min(1, dot(normalize(o), up))));
  const limit = 1e-3, tilt = Math.max(limit - current, Math.min(Math.PI - limit - current, -dy));
  if (length(right) > 0) o = transformDirection(rotation(right, tilt), o);
  camera.position = add(camera.target, o);
}

/** Move camera and target together by a drag of (dx, dy) pixels on a viewport of the given height. */
export function pan(camera: Camera, dx: number, dy: number, viewportHeight: number): void {
  const { right, up } = camera.basis(), perPixel = (2 * camera.halfHeight) / Math.max(1, viewportHeight);
  const move = add(scale(right, -dx * perPixel), scale(up, dy * perPixel));
  camera.position = add(camera.position, move);
  camera.target = add(camera.target, move);
}

/**
 * Zoom by factor (< 1 closer) toward a world point (the point under the cursor, or the target): the
 * point keeps its place on screen. An orthographic camera zooms by the same distance change.
 */
export function zoom(camera: Camera, factor: number, toward?: Vec3): void {
  const f = Math.max(1e-3, factor), d = camera.distance;
  const min = 1e-4 * Math.max(1, length(camera.target)), next = Math.max(min, d * f), k = next / d;
  const anchor = toward ?? camera.target;
  // Scale camera and target about the anchor: a perspective point stays under the cursor.
  camera.position = add(anchor, scale(sub(camera.position, anchor), k));
  camera.target = add(anchor, scale(sub(camera.target, anchor), k));
}

export interface OrbitOptions {
  /** Radians per pixel dragged. */
  rotateSpeed?: number;
  /** Zoom factor per wheel notch (100 px of deltaY). */
  zoomSpeed?: number;
  /** The world point under a pixel, for zoom to cursor (the viewer's depth pick); undefined zooms to the target. */
  pointAt?: (x: number, y: number) => Promise<Vec3 | null> | Vec3 | null;
}

/**
 * Pointer bindings: left drag orbits, right or middle drag (or shift + left) pans, the wheel zooms to the
 * cursor. Calls onChange after each move.
 */
export class OrbitControls {
  enabled = true;
  private drag: { id: number; mode: 'orbit' | 'pan'; x: number; y: number } | null = null;
  private readonly off: (() => void)[] = [];

  constructor(private readonly element: HTMLElement, private readonly camera: () => Camera, private readonly onChange: () => void, private readonly options: OrbitOptions = {}) {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      element.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => element.removeEventListener(type, fn as EventListener, opts));
    };
    on('pointerdown', e => {
      if (!this.enabled || this.drag) return;
      const mode = e.button === 0 && !e.shiftKey ? 'orbit' : e.button <= 2 ? 'pan' : null;
      if (!mode) return;
      this.drag = { id: e.pointerId, mode, x: e.clientX, y: e.clientY };
      element.setPointerCapture?.(e.pointerId);
    });
    on('pointermove', e => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      if (d.mode === 'orbit') { const s = this.options.rotateSpeed ?? 0.008; orbit(this.camera(), dx * s, dy * s); }
      else pan(this.camera(), dx, dy, element.clientHeight);
      this.onChange();
    });
    const end = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) { this.drag = null; element.releasePointerCapture?.(e.pointerId); } };
    on('pointerup', end); on('pointercancel', end);
    on('contextmenu', e => e.preventDefault());
    on('wheel', e => {
      if (!this.enabled) return;
      e.preventDefault();
      const notch = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaMode === 2 ? e.deltaY * 10 : e.deltaY / 100;
      const factor = Math.pow(this.options.zoomSpeed ?? 1.2, notch), r = element.getBoundingClientRect();
      const apply = (p: Vec3 | null) => { zoom(this.camera(), factor, p ?? undefined); this.onChange(); };
      const p = this.options.pointAt?.(e.clientX - r.left, e.clientY - r.top);
      if (p instanceof Promise) p.then(apply, () => apply(null)); else apply(p ?? null);
    }, { passive: false });
  }

  dispose(): void { for (const f of this.off.splice(0)) f(); this.drag = null; }
}
