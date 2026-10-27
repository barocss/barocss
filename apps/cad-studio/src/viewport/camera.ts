// Z-up orbit camera with perspective/orthographic projection. Matrices are column-major (WebGL).
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
export { sub, dot, cross, unit as normalize } from '@barocss/cad-model/engine/vec3';
import { sub, dot, cross, unit as normalize } from '@barocss/cad-model/engine/vec3';

export type Mat4 = Float32Array;

export class OrbitCamera {
  target: Vec3 = [32, 16, 4];
  distance = 160;
  yaw = -Math.PI * 0.32;       // around +Z, from +X
  pitch = Math.PI * 0.2;       // above the XY plane
  fovY = (32 * Math.PI) / 180;
  ortho = false;
  aspect = 1;

  eye(): Vec3 {
    const cp = Math.cos(this.pitch);
    return [this.target[0] + this.distance * cp * Math.cos(this.yaw), this.target[1] + this.distance * cp * Math.sin(this.yaw), this.target[2] + this.distance * Math.sin(this.pitch)];
  }

  basis() {
    const e = this.eye();
    const f = normalize(sub(this.target, e));
    const r = normalize(cross(f, [0, 0, 1]));
    const u = cross(r, f);
    return { eye: e, forward: f, right: r, up: u };
  }

  view(): Mat4 {
    const { eye, forward: f, right: r, up: u } = this.basis();
    return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1]);
  }

  near() { return Math.max(0.05, this.distance * 0.01); }
  far() { return this.distance * 40 + 2000; }

  projection(): Mat4 {
    const n = this.near(), fa = this.far();
    if (this.ortho) {
      const h = this.distance * Math.tan(this.fovY / 2), w = h * this.aspect;
      return new Float32Array([1 / w, 0, 0, 0, 0, 1 / h, 0, 0, 0, 0, -2 / (fa - n), 0, 0, 0, -(fa + n) / (fa - n), 1]);
    }
    const t = 1 / Math.tan(this.fovY / 2);
    return new Float32Array([t / this.aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
  }

  viewProjection(): Mat4 { return mul(this.projection(), this.view()); }
  /**
   * The view-projection for project (R1b): made again only when the camera has moved — project runs for every edge end
   * under a hover and every overlay point in a frame. The same matrix as viewProjection.
   */
  private projector(): Mat4 {
    const k = this.projectorKey, t = this.target, o = this.ortho ? 1 : 0;
    if (!this.projectorMatrix || k[0] !== t[0] || k[1] !== t[1] || k[2] !== t[2] || k[3] !== this.distance || k[4] !== this.yaw || k[5] !== this.pitch || k[6] !== this.fovY || k[7] !== o || k[8] !== this.aspect) {
      k[0] = t[0]; k[1] = t[1]; k[2] = t[2]; k[3] = this.distance; k[4] = this.yaw; k[5] = this.pitch; k[6] = this.fovY; k[7] = o; k[8] = this.aspect;
      this.projectorMatrix = this.viewProjection();
    }
    return this.projectorMatrix;
  }
  private projectorKey = new Float64Array(9);
  private projectorMatrix: Mat4 | null = null;

  orbit(dx: number, dy: number) {
    this.yaw -= dx * 0.008;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch + dy * 0.008));
  }

  pan(dx: number, dy: number, viewportHeight: number) {
    const { right, up } = this.basis();
    const scale = (2 * this.distance * Math.tan(this.fovY / 2)) / viewportHeight;
    for (let k = 0; k < 3; k++) this.target[k] += (-dx * right[k] + dy * up[k]) * scale;
  }

  /** Zoom toward the point under the cursor (ndc in -1..1). */
  zoom(factor: number, ndcX: number, ndcY: number) {
    const { right, up } = this.basis();
    const h = this.distance * Math.tan(this.fovY / 2), w = h * this.aspect;
    const before = this.distance;
    this.distance = Math.max(1, Math.min(20000, this.distance * factor));
    const shift = 1 - this.distance / before;
    for (let k = 0; k < 3; k++) this.target[k] += (ndcX * w * right[k] + ndcY * h * up[k]) * shift;
  }

  fit(min: Vec3, max: Vec3) {
    this.target = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const radius = Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    this.distance = (radius / Math.sin(this.fovY / 2)) * 1.15 / Math.min(1, this.aspect);
  }

  /**
   * Frames a rectangle of the plane z (call after setView) so it fits the free part of the viewport:
   * `insetLeft` / `insetRight` are the fractions of the width covered by floating panels.
   */
  frameRect(min: [number, number], max: [number, number], z: number, insetLeft = 0, insetRight = 0, margin = 1.2) {
    this.frameAt([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, z], [max[0] - min[0], max[1] - min[1]], insetLeft, insetRight, margin);
  }

  /** Frames a span (width along the view's right, height along its up) centred on a point, as frameRect. */
  frameAt(centre: Vec3, span: [number, number], insetLeft = 0, insetRight = 0, margin = 1.2) {
    const free = Math.max(0.3, 1 - insetLeft - insetRight), t = Math.tan(this.fovY / 2);
    const spanX = Math.max(1, span[0]) * margin, spanY = Math.max(1, span[1]) * margin;
    this.distance = Math.max(spanY / (2 * t), spanX / (2 * t * this.aspect * free));
    this.target = [...centre] as Vec3;
    // Shift so the rectangle's centre lands in the middle of the free band, not of the canvas.
    const { right } = this.basis(), halfWidth = this.distance * t * this.aspect, ndc = insetLeft - insetRight;
    for (let k = 0; k < 3; k++) this.target[k] -= right[k] * ndc * halfWidth;
  }

  /** Looks straight at a plane from the side its normal points to (a horizontal one as a top or bottom view). */
  faceNormal(normal: Vec3) {
    if (Math.abs(normal[2]) > 0.999) { this.setView(normal[2] > 0 ? 'top' : 'bottom'); return; }
    this.yaw = Math.atan2(normal[1], normal[0]);
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, Math.asin(normal[2])));
  }

  setView(name: 'iso' | 'top' | 'front' | 'right' | 'bottom' | 'back' | 'left') {
    const views = { iso: [-0.32, 0.2], top: [-0.5, 0.4999], bottom: [-0.5, -0.4999], front: [-0.5, 0], back: [0.5, 0], right: [0, 0], left: [1, 0] } as const;
    const [y, p] = views[name];
    this.yaw = Math.PI * y; this.pitch = Math.PI * p;
  }

  /** World-space ray through a pixel. */
  ray(ndcX: number, ndcY: number): { origin: Vec3; dir: Vec3 } {
    const { eye, forward, right, up } = this.basis();
    const h = Math.tan(this.fovY / 2), w = h * this.aspect;
    if (this.ortho) {
      const s = this.distance;
      const origin: Vec3 = [0, 1, 2].map(k => eye[k] + (ndcX * w * right[k] + ndcY * h * up[k]) * s) as Vec3;
      return { origin, dir: forward };
    }
    return { origin: eye, dir: normalize([0, 1, 2].map(k => forward[k] + ndcX * w * right[k] + ndcY * h * up[k]) as Vec3) };
  }

  /** Project a world point to CSS pixels. */
  project(p: Vec3, width: number, height: number): [number, number, number] {
    const m = this.projector();
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * width, (1 - (y / w * 0.5 + 0.5)) * height, z / w];
  }
}

export function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

