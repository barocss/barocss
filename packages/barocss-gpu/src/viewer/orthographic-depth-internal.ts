import type { Box3 } from './bounds.js';
import { invert, normalize, orthographicReversed, sub, type Vec3 } from './math.js';

/** A conservative automatic range for bounded geometry. Null retains the legacy camera range. */
export function orthographicDepth(scene: Box3, eye: Vec3, target: Vec3, halfWidth: number, halfHeight: number): { near: number; far: number } | null {
  for (let k = 0; k < 3; k++) {
    if (!Number.isFinite(scene.min[k]) || !Number.isFinite(scene.max[k]) || scene.min[k] > scene.max[k]
      || !Number.isFinite(eye[k]) || !Number.isFinite(target[k])) return null;
  }
  if (!Number.isFinite(halfWidth) || halfWidth <= 0 || !Number.isFinite(halfHeight) || halfHeight <= 0) return null;
  const forward = normalize(sub(target, eye));
  if (!forward.every(Number.isFinite) || (forward[0] === 0 && forward[1] === 0 && forward[2] === 0)) return null;
  let depth = 0, support = 0;
  for (let k = 0; k < 3; k++) {
    const center = (scene.min[k] + scene.max[k]) / 2, half = (scene.max[k] - scene.min[k]) / 2;
    depth += (center - eye[k]) * forward[k];
    support += Math.abs(forward[k]) * half;
  }
  const radius = Math.max(support, 1e-6), near = depth - radius * 1.05, far = depth + radius * 1.05, span = far - near;
  if (!Number.isFinite(near) || !Number.isFinite(far) || !(span > 0) || !Number.isFinite(span) || !Number.isFinite(1 / span)) return null;
  if (Math.fround(Math.fround(-far) + Math.fround(span)) === Math.fround(-far)) return null;

  // Check the matrices that raster depth and depth post effects pack, before accepting a tighter range.
  const projection = orthographicReversed(halfWidth, halfHeight, near, far);
  let inverse;
  try { inverse = invert(projection); } catch { return null; }
  const packed = Float32Array.from(projection), inversePacked = Float32Array.from(inverse);
  if (!packed.every(Number.isFinite) || !inversePacked.every(Number.isFinite)
    || !(packed[0] > 0 && packed[5] > 0 && packed[10] > 0)
    || !(inversePacked[0] > 0 && inversePacked[5] > 0 && inversePacked[10] > 0)
    || Math.fround(inversePacked[14] + inversePacked[10]) === inversePacked[14]) return null;

  // A conservative Float32 Z arithmetic check, not a certification of a device's full vertex path.
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? scene.max[0] : scene.min[0], y = i & 2 ? scene.max[1] : scene.min[1], zWorld = i & 4 ? scene.max[2] : scene.min[2];
    const viewZ = Math.fround(-((x - eye[0]) * forward[0] + (y - eye[1]) * forward[1] + (zWorld - eye[2]) * forward[2]));
    const z = Math.fround(Math.fround(packed[10] * viewZ) + packed[14]);
    if (!Number.isFinite(z) || z < 0 || z > 1) return null;
  }
  return { near, far };
}
