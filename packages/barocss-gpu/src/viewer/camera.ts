// A look-at camera with perspective or orthographic projection, reversed [0, 1] depth, clip planes
// fitted to the scene each frame, framing of a box and rays through screen points.
import { boxCenter, boxRadius, type Box3 } from './bounds.js';
import { ViewerError } from './viewer-error.js';
import { add, cross, dot, invert, length, lookAt, multiply, normalize, orthographicReversed, perspectiveReversed, scale, sub, transformPoint, type Mat4, type Vec3 } from './math.js';

export type Projection = 'perspective' | 'orthographic';
export interface CameraState {
  projection: Projection;
  position: Vec3; target: Vec3; up: Vec3;
  /** Vertical field of view of the perspective projection (degrees). */
  fovY: number;
}
export interface Ray { origin: Vec3; direction: Vec3 }

export class Camera implements CameraState {
  projection: Projection = 'perspective';
  position: Vec3 = [4, -6, 4];
  target: Vec3 = [0, 0, 0];
  up: Vec3 = [0, 0, 1];
  fovY = 40;
  /** Raster clip planes: fitted to the scene each frame while autoClip is true (see clip()). */
  near = 0.01; far = 1000;
  /** Fit raster clip planes to the scene. False uses authored near/far for base raster and GPU picks;
   * finite manual ranges refuse grid, depth post effects, and active/creating path traces. */
  autoClip = true;

  constructor(state: Partial<CameraState> = {}) { Object.assign(this, state); }

  get distance(): number { return length(sub(this.position, this.target)); }
  /** Half the view height at the target: what the orthographic projection shows, matched to the perspective view. */
  get halfHeight(): number { return this.distance * Math.tan((this.fovY * Math.PI) / 360); }

  view(): Mat4 { return lookAt(this.position, this.target, this.up); }
  projectionMatrix(aspect: number): Mat4 {
    if (this.autoClip === false) {
      const orthographic = this.projection === 'orthographic';
      if (!Number.isFinite(this.near) || (!orthographic && this.near <= 0)
        || !(Number.isFinite(this.far) || (!orthographic && this.far === Infinity)) || this.far <= this.near) {
        throw new ViewerError('CLIP_INVALID', 'Manual clipping requires ordered finite planes, or a positive perspective near with an infinite far');
      }
    }
    if (this.projection === 'orthographic') {
      // (Before clip() has fitted them, a perspective far plane at infinity becomes a finite one.)
      const h = this.halfHeight, far = Number.isFinite(this.far) ? this.far : this.near + 2 * this.distance + 1;
      return orthographicReversed(h * aspect, h, this.near, far);
    }
    const projection = perspectiveReversed((this.fovY * Math.PI) / 180, aspect, this.near);
    if (this.autoClip === false && Number.isFinite(this.far)) {
      const range = this.far - this.near;
      projection[10] = this.near / range;
      projection[14] = this.near * this.far / range;
    }
    return projection;
  }
  viewProjection(aspect: number): Mat4 { return multiply(this.projectionMatrix(aspect), this.view()); }

  /** Clip planes around a scene box: as near as the box allows (perspective far is infinite). */
  clip(scene: Box3 | null): void {
    const r = scene ? Math.max(boxRadius(scene), 1e-6) : Math.max(this.distance, 1);
    const c = scene ? boxCenter(scene) : this.target, forward = normalize(sub(this.target, this.position));
    const depth = dot(sub(c, this.position), forward);
    if (this.projection === 'orthographic') { this.near = depth - r * 1.05; this.far = depth + r * 1.05; return; }
    // Within the box, a small near plane; outside, just in front of it (reversed float depth keeps precision).
    this.near = Math.max(depth - r * 1.05, r * 1e-4, 1e-6);
    this.far = Infinity;
  }

  /** Frame a box: keep the view direction, move the target to its centre and back off to fit it. */
  fit(box: Box3, aspect: number, margin = 1.1): void {
    if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(margin) || margin <= 0) {
      throw new ViewerError('SIZE_INVALID', 'Camera fit aspect and margin must be finite and positive.');
    }
    const r = Math.max(boxRadius(box), 1e-6) * margin, c = boxCenter(box), dir = normalize(sub(this.position, this.target));
    const half = (this.fovY * Math.PI) / 360, fit = Math.min(half, Math.atan(Math.tan(half) * aspect));
    const d = r / Math.sin(fit);
    const position = add(c, scale(length(dir) ? dir : [0, -1, 0], d));
    if (!Number.isFinite(d) || d <= 0 || !c.every(Number.isFinite) || !position.every(Number.isFinite)) {
      throw new ViewerError('SIZE_INVALID', 'Camera fit must produce a finite position at a positive distance.');
    }
    this.target = c;
    this.position = position;
  }

  /** The ray through a point in normalised device coordinates (x, y in [−1, 1], y up). */
  ray(ndcX: number, ndcY: number, aspect: number): Ray {
    const inv = invert(this.viewProjection(aspect));
    const nearPoint = transformPoint(inv, [ndcX, ndcY, 1]);
    if (this.projection === 'orthographic') {
      const farPoint = transformPoint(inv, [ndcX, ndcY, 0]);
      return { origin: nearPoint, direction: normalize(sub(farPoint, nearPoint)) };
    }
    return { origin: this.position, direction: normalize(sub(nearPoint, this.position)) };
  }

  /** The world point at a pixel's reversed depth (from a depth read). */
  unproject(ndcX: number, ndcY: number, depth: number, aspect: number): Vec3 {
    return transformPoint(invert(this.viewProjection(aspect)), [ndcX, ndcY, depth]);
  }

  /** Right and up directions of the view in world space. */
  basis(): { right: Vec3; up: Vec3; forward: Vec3 } {
    const forward = normalize(sub(this.target, this.position));
    let right = normalize(cross(forward, this.up));
    if (length(right) === 0) right = normalize(cross(forward, Math.abs(forward[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    return { right, up: cross(right, forward), forward };
  }

  state(): CameraState { return { projection: this.projection, position: this.position, target: this.target, up: this.up, fovY: this.fovY }; }
}
