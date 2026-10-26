// Pure spot-shadow admission and standard [0, 1] depth projection; no GPU resources.
import type { Box3 } from './bounds.js';
import type { Light, ShadowFrame, SpotLight } from './lights.js';
import { cross, multiply, type Vec3 } from './math.js';
import { MAX_SPOT } from './shaders/common.js';
import { ViewerError } from './viewer-error.js';

const invalid = (message: string): never => { throw new ViewerError('LIGHT_INVALID', message); };
function finiteVector(value: unknown): value is Vec3 {
  if (!value || typeof value !== 'object' || (value as ArrayLike<unknown>).length !== 3) return false;
  const v = value as ArrayLike<unknown>;
  return [0, 1, 2].every(i => {
    const n = v[i];
    return typeof n === 'number' && Number.isFinite(n) && Number.isFinite(Math.fround(n));
  });
}
function validate(light: SpotLight): void {
  if (!finiteVector(light.position) || !finiteVector(light.direction) || !light.direction.some(value => value !== 0)) invalid('A spot shadow needs finite f32 position and nonzero direction vectors');
  const angle = light.angle === undefined ? 30 : light.angle, range = light.range === undefined ? 0 : light.range;
  if (typeof angle !== 'number' || !Number.isFinite(angle) || angle <= 0 || angle >= 90) invalid('A spot shadow angle must be finite and between 0 and 90 degrees');
  if (typeof range !== 'number' || !Number.isFinite(range) || range < 0) invalid('A spot shadow range must be finite and nonnegative');
}
/** Only enabled shadows among the first four spot lights add admission rules; legacy lighting stays unchanged. */
export function validateSpotShadowLights(lights: readonly Light[]): void {
  let spots = 0;
  for (const light of lights) if (light.kind === 'spot') {
    if (spots++ === MAX_SPOT) break;
    if (light.castShadow) validate(light);
  }
}
function unit(v: Vec3): Vec3 {
  const largest = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  const x = v[0] / largest, y = v[1] / largest, z = v[2] / largest, length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** PCF spot projection: near maps to 0, far to 1, with clear depth 1 and a less comparison. */
export function spotShadowFrame(light: SpotLight, scene: Box3 | null, depth: Box3 | null, size: number): ShadowFrame | null {
  if (!light.castShadow) return null;
  validate(light);
  if (!scene) return null;
  if (!Number.isInteger(size) || size <= 0) invalid('A spot shadow map size must be a positive integer');
  const eye: Vec3 = [light.position[0], light.position[1], light.position[2]], direction = unit(light.direction);
  const boxes = depth ? [scene, depth] : [scene];
  let minDepth = Infinity, maxDepth = -Infinity, radius = 0;
  for (const box of boxes) {
    radius = Math.max(radius, Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) / 2);
    for (let corner = 0; corner < 8; corner++) {
      const x = (corner & 1 ? box.max[0] : box.min[0]) - eye[0];
      const y = (corner & 2 ? box.max[1] : box.min[1]) - eye[1];
      const z = (corner & 4 ? box.max[2] : box.min[2]) - eye[2];
      const axial = x * direction[0] + y * direction[1] + z * direction[2];
      if (!Number.isFinite(axial)) invalid('Spot shadow bounds need finite axial depths');
      minDepth = Math.min(minDepth, axial); maxDepth = Math.max(maxDepth, axial);
    }
  }
  if (!Number.isFinite(radius)) invalid('Spot shadow bounds exceed a finite projection');
  const range = light.range ?? 0;
  if (!range && maxDepth <= 0) return null;
  const far = range > 0 ? range : maxDepth + Math.max(radius, maxDepth) * 1e-4;
  const near = Math.min(far * 0.1, minDepth > 0 ? minDepth * 0.5 : Math.min(far * 0.01, Math.max(far * 1e-5, radius * 1e-5)));
  if (!(Number.isFinite(far) && near > 0 && near < far)) invalid('Spot shadow bounds cannot form a finite depth interval');
  const tangent = Math.tan((light.angle ?? 30) * Math.PI / 180), focal = 1 / tangent, a = 1 / (1 - near / far);
  // Keep a finite far plane and a positive near term after the actual f32 uniform conversion.
  if (!(Number.isFinite(Math.fround(focal)) && Math.fround(focal) > 0 && Math.fround(a) > 1 && Math.fround(near * a) > 0)) invalid('Spot shadow depth or cone cannot be represented in f32');
  const projection = new Float64Array(16);
  projection[0] = projection[5] = focal; projection[10] = -a; projection[11] = -1; projection[14] = -near * a;
  const up: Vec3 = Math.abs(direction[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const right = unit(cross(direction, up)), vertical = cross(right, direction);
  // Construct the basis directly: eye + direction can round back to eye for large positions.
  const view = new Float64Array([
    right[0], vertical[0], -direction[0], 0,
    right[1], vertical[1], -direction[1], 0,
    right[2], vertical[2], -direction[2], 0,
    -dot(right, eye), -dot(vertical, eye), dot(direction, eye), 1,
  ]);
  const viewProjection = multiply(projection, view), texel = 1 / size, normalOffset = far / size * (3 * tangent);
  if (!viewProjection.every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value))) || !Number.isFinite(Math.fround(normalOffset)) || !(Math.fround(texel) > 0)) invalid('Spot shadow matrix or bias exceeds finite f32 values');
  return { viewProjection, normalOffset, texel, bias: 0.0005, softness: 0, eye, direction, perspective: true };
}
