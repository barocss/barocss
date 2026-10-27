// One point light's six standard-depth cameras; no GPU resources or cube sampler conventions.
import type { Box3 } from './bounds.js';
import type { Light, PointLight, ShadowFrame } from './lights.js';
import { cross, dot, multiply, type Vec3 } from './math.js';
import { MAX_POINT } from './shaders/common.js';
import { ViewerError } from './viewer-error.js';

const invalid = (message: string): never => { throw new ViewerError('LIGHT_INVALID', message); };
function validate(light: PointLight): void {
  const p: unknown = light.position;
  if (!p || typeof p !== 'object' || (p as ArrayLike<unknown>).length !== 3) invalid('A point shadow needs a finite f32 position vector');
  const position = p as ArrayLike<unknown>;
  for (let axis = 0; axis < 3; axis++) {
    const value = position[axis];
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) invalid('A point shadow needs a finite f32 position vector');
  }
  const range = light.range === undefined ? 0 : light.range;
  if (typeof range !== 'number' || !Number.isFinite(range) || range < 0 || !Number.isFinite(Math.fround(range)) || (range > 0 && Math.fround(range) === 0)) invalid('A point shadow range must be nonnegative and representable in f32');
  const radius = light.shadowRadius === undefined ? 0 : light.shadowRadius;
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(Math.fround(radius)) || (radius > 0 && Math.fround(radius) === 0)) invalid('A point shadow radius must be nonnegative and representable in f32');
}

/** Preserve unshadowed point lighting; only one of the first eight points can allocate six shadow faces. */
export function validatePointShadowLights(lights: readonly Light[]): void {
  let points = 0, casters = 0;
  for (const light of lights) if (light.kind === 'point') {
    if (points++ === MAX_POINT) break;
    if (light.castShadow) {
      validate(light);
      if (++casters > 1) invalid('At most one of the first eight point lights can cast a shadow');
    }
  }
}

// +X, -X, +Y, -Y, +Z, -Z. right = cross(forward, up); image v grows downward.
const faces: readonly { forward: Vec3; up: Vec3 }[] = [
  { forward: [1, 0, 0], up: [0, -1, 0] }, { forward: [-1, 0, 0], up: [0, -1, 0] },
  { forward: [0, 1, 0], up: [0, 0, 1] }, { forward: [0, -1, 0], up: [0, 0, -1] },
  { forward: [0, 0, 1], up: [0, -1, 0] }, { forward: [0, 0, -1], up: [0, -1, 0] },
];

/** Six 90-degree RH projections, near → 0 and far → 1. Null means no scene or no extent to shadow. */
export function pointShadowFrames(light: PointLight, scene: Box3 | null, depth: Box3 | null, size: number): readonly ShadowFrame[] | null {
  if (!light.castShadow) return null;
  validate(light);
  if (!scene) return null;
  if (!Number.isInteger(size) || size <= 0) invalid('A point shadow map size must be a positive integer');
  const eye: Vec3 = [light.position[0], light.position[1], light.position[2]], boxes = depth ? [scene, depth] : [scene];
  let extent = 0, nearest = Infinity;
  for (const box of boxes) {
    const dx = Math.max(box.min[0] - eye[0], 0, eye[0] - box.max[0]);
    const dy = Math.max(box.min[1] - eye[1], 0, eye[1] - box.max[1]);
    const dz = Math.max(box.min[2] - eye[2], 0, eye[2] - box.max[2]);
    nearest = Math.min(nearest, Math.hypot(dx, dy, dz));
    for (let corner = 0; corner < 8; corner++) {
      const x = (corner & 1 ? box.max[0] : box.min[0]) - eye[0];
      const y = (corner & 2 ? box.max[1] : box.min[1]) - eye[1];
      const z = (corner & 4 ? box.max[2] : box.min[2]) - eye[2];
      extent = Math.max(extent, Math.hypot(x, y, z));
    }
  }
  if (!Number.isFinite(extent) || !Number.isFinite(nearest)) invalid('Point shadow bounds exceed a finite projection');
  const range = light.range ?? 0;
  if (!range && extent === 0) return null;
  // Include the normal-biased receiver and constant-radius taps that cross a face edge.
  const normalOffset = (range > 0 ? range : extent) / size * 3;
  const far = range > 0 ? range : extent + normalOffset + extent * 1e-4;
  const near = Math.min(far * 0.1, nearest > 0 ? nearest / (2 * Math.sqrt(3)) : far * 1e-4);
  const a = 1 / (1 - near / far), texel = 1 / size;
  if (!(Number.isFinite(far) && Number.isFinite(Math.fround(far)) && Math.fround(far) > 0 && near > 0 && near < far && Math.fround(near) > 0 && Math.fround(near) < Math.fround(far) && Math.fround(a) > 1 && Number.isFinite(Math.fround(a)) && Math.fround(near * a) > 0 && Number.isFinite(Math.fround(near * a)) && Math.fround(texel) > 0 && Number.isFinite(Math.fround(normalOffset)))) invalid('Point shadow depth or bias cannot be represented in f32');
  const projection = new Float64Array(16);
  projection[0] = projection[5] = 1; projection[10] = -a; projection[11] = -1; projection[14] = -near * a;
  return faces.map(({ forward, up }) => {
    const right = cross(forward, up);
    // Fixed axes avoid constructing eye + forward, which can round back to eye.
    const view = new Float64Array([
      right[0], up[0], -forward[0], 0,
      right[1], up[1], -forward[1], 0,
      right[2], up[2], -forward[2], 0,
      -dot(right, eye), -dot(up, eye), dot(forward, eye), 1,
    ]);
    const viewProjection = multiply(projection, view);
    if (!viewProjection.every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) invalid('Point shadow matrix exceeds finite f32 values');
    return { viewProjection, normalOffset, texel, bias: 0.0005, softness: 0, eye: [...eye] as Vec3, direction: [...forward] as Vec3, perspective: true, near, far };
  });
}
