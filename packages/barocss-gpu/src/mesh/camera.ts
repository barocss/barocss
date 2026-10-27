import type { Vec3 } from '../core/geometry-types.js';
/** Mesh presentation camera. Eye and target use scene units; up is dimensionless. */
export interface MeshCamera {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
  fovY: number;
  near: number;
  far: number;
}

type Triple = Vec3;
const DEFAULT_CAMERA: MeshCamera = {
  eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: 0.01, far: 100,
};
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
function vector(input: unknown, label: string, limit: number): Triple {
  requireValue(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype && input.length === 3,
    `${label} must be a plain XYZ array`);
  requireValue(Reflect.ownKeys(input).length === 4, `${label} must be dense JSON data without additional fields`);
  const result: number[] = [];
  for (let i = 0; i < 3; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number'
      && Number.isFinite(descriptor.value) && Math.abs(descriptor.value) <= limit, `${label} must contain bounded finite JSON numbers`);
    result.push(descriptor.value);
  }
  return result as [number, number, number];
}
function dot(a: Triple, b: Triple): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Triple, b: Triple): Triple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
// Scaling first avoids overflow for large, finite dimensionless up vectors.
function normalized(a: Triple): Triple {
  const scale = Math.max(...a.map(Math.abs));
  const scaled = a.map((n) => n / scale) as [number, number, number], length = Math.hypot(...scaled);
  return scaled.map((n) => n / length) as [number, number, number];
}
function matrices(camera: MeshCamera, aspect: number): { view: Float32Array; projection: Float32Array } {
  const backward = normalized(camera.eye.map((n, i) => n - camera.target[i]) as [number, number, number]);
  const up = normalized(camera.up), sideCross = cross(up, backward);
  requireValue(Math.hypot(...sideCross) >= 1e-6, 'Camera forward and up axes are singular');
  const right = normalized(sideCross), vertical = cross(backward, right);
  const view = Float32Array.from([
    right[0], vertical[0], backward[0], 0,
    right[1], vertical[1], backward[1], 0,
    right[2], vertical[2], backward[2], 0,
    -dot(right, camera.eye), -dot(vertical, camera.eye), -dot(backward, camera.eye), 1,
  ]);
  requireValue(Math.fround(camera.near) < Math.fround(camera.far), 'Camera Float32 clipping planes collapse');
  const focal = 1 / Math.tan(camera.fovY * Math.PI / 360), range = camera.far - camera.near;
  const projection = Float32Array.from([
    focal / aspect, 0, 0, 0, 0, focal, 0, 0,
    0, 0, -(camera.far + camera.near) / range, -1,
    0, 0, -2 * camera.far * camera.near / range, 0,
  ]);
  requireValue([...view, ...projection].every(Number.isFinite), 'Camera Float32 matrices must be finite');
  requireValue(projection[0] > 0 && projection[5] > 0 && projection[10] < -1 && projection[14] < 0,
    'Camera Float32 projection loses axes or clipping depth');
  for (const [depth, expected] of [[camera.near, -1], [camera.far, 1]]) {
    const z = -Math.fround(depth);
    const clip = Math.fround(Math.fround(projection[10] * z) + projection[14]);
    requireValue(Math.abs(clip / -z - expected) <= 1e-3, 'Camera Float32 clipping endpoints are ill-conditioned');
  }
  const axes = [0, 1, 2].map((row) => [view[row], view[4 + row], view[8 + row]] as [number, number, number]);
  requireValue(axes.every((axis) => Math.abs(dot(axis, axis) - 1) <= 1e-5)
    && Math.abs(dot(axes[0], axes[1])) <= 1e-5 && Math.abs(dot(axes[1], axes[2])) <= 1e-5
    && Math.abs(dot(axes[0], axes[2])) <= 1e-5 && dot(cross(axes[0], axes[1]), axes[2]) > 0.99999,
  'Camera Float32 axes are ill-conditioned');
  // Evaluate with Float32 inputs/operations, as the GPU does. Nearby points at large
  // coordinates must remain separable after translation cancellation.
  const z = (point: Triple): number => Math.fround(Math.fround(Math.fround(Math.fround(view[2] * Math.fround(point[0]))
    + Math.fround(view[6] * Math.fround(point[1]))) + Math.fround(view[10] * Math.fround(point[2]))) + view[14]);
  const separation = Math.hypot(...camera.eye.map((n, i) => n - camera.target[i]));
  requireValue(z(camera.eye) - z(camera.target) >= separation * 0.5, 'Camera Float32 eye and target collapse');
  return { view, projection };
}

/** Validate strict host data and freeze owned copies; retain the caller's up magnitude. */
export function validateMeshCamera(input: unknown): MeshCamera {
  requireValue(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Camera must be a plain JSON object');
  const keys = ['eye', 'target', 'up', 'fovY', 'near', 'far'];
  const actual = Reflect.ownKeys(input);
  requireValue(actual.length === keys.length && actual.every((key) => typeof key === 'string' && keys.includes(key)),
    'Camera has missing or unsupported fields');
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, `Camera.${key} must be JSON data`);
    data[key] = descriptor.value;
  }
  const eye = vector(data.eye, 'Camera.eye', 1000), target = vector(data.target, 'Camera.target', 1000);
  const up = vector(data.up, 'Camera.up', Number.MAX_VALUE);
  requireValue(Math.hypot(...eye.map((n, i) => n - target[i])) >= 1e-4, 'Camera eye-target separation must be at least 1e-4');
  requireValue(Math.hypot(...up) >= 1e-6, 'Camera up length must be at least 1e-6');
  requireValue(typeof data.fovY === 'number' && Number.isFinite(data.fovY) && data.fovY >= 10 && data.fovY <= 100,
    'Camera FOV must be in 10..100 degrees');
  requireValue(typeof data.near === 'number' && Number.isFinite(data.near) && data.near >= 1e-4
    && typeof data.far === 'number' && Number.isFinite(data.far) && data.near < data.far && data.far <= 10000,
  'Camera clipping requires 1e-4 <= near < far <= 10000');
  const result: MeshCamera = { eye, target, up, fovY: data.fovY, near: data.near, far: data.far };
  matrices(result, 1);
  for (const owned of [eye, target, up, result]) Object.freeze(owned);
  return result;
}

/** Original right-handed look-at and OpenGL perspective, stored column-major. */
export function prepareCamera(camera: MeshCamera | undefined, aspect: number): { view: Float32Array; projection: Float32Array } {
  requireValue(typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0, 'Camera aspect must be finite and positive');
  return matrices(validateMeshCamera(camera === undefined ? DEFAULT_CAMERA : camera), aspect);
}
