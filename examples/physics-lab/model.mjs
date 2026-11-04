import { dynamicPart, makeModel } from '../physics-model-input/model.mjs';

export const DEFAULT_CONFIG = Object.freeze({
  shape: 'box', massKg: 2.3, halfExtentsM: [.13, .21, .31], radiusM: .2,
  halfLengthM: .3, orientationXYZW: [0, 0, 0, 1],
  angularVelocityRadps: [.7, -.3, 1.2], hz: 120, torqueNm: [0, 0, 0],
  commandExpiry: 'one-step', maxSteps: 512,
});
export const BODY_ID = 'lab.body';
export const clone = value => structuredClone(value);
export function vector(value, size, label) {
  if (!Array.isArray(value) || value.length !== size || !value.every(Number.isFinite))
    throw new TypeError(`${label} must contain ${size} finite numbers`);
  return [...value];
}
export function normalizeConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('config must be an object');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULT_CONFIG, key)) throw new TypeError(`Unknown config field: ${key}`);
  const config = clone({ ...DEFAULT_CONFIG, ...input });
  if (!['box', 'sphere', 'capsule'].includes(config.shape)) throw new TypeError('Unknown shape');
  if (![60, 120, 240].includes(config.hz)) throw new TypeError('hz must be 60, 120 or 240');
  if (config.commandExpiry !== 'one-step') throw new TypeError('Commands must expire after one step');
  if (!Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 512) throw new TypeError('maxSteps must be 1 through 512');
  config.orientationXYZW = vector(config.orientationXYZW, 4, 'orientationXYZW');
  const norm = Math.hypot(...config.orientationXYZW);
  if (!(norm > 0) || !Number.isFinite(norm)) throw new TypeError('Quaternion must have a finite nonzero norm');
  config.orientationXYZW = config.orientationXYZW.map(value => value / norm);
  config.angularVelocityRadps = vector(config.angularVelocityRadps, 3, 'angularVelocityRadps');
  config.torqueNm = vector(config.torqueNm, 3, 'torqueNm');
  // Shape dimensions, mass and model limits are admitted by createPhysicsWorld.
  return config;
}
export function buildLabModel(config) {
  const geometry = config.shape === 'box' ? { kind: 'box', halfExtentsM: clone(config.halfExtentsM) }
    : config.shape === 'sphere' ? { kind: 'sphere', radiusM: config.radiusM }
      : { kind: 'capsule', radiusM: config.radiusM, halfLengthM: config.halfLengthM };
  return makeModel({ revision: 'physics-lab-v1', gravityMps2: [0, 0, 0], parts: [
    dynamicPart(BODY_ID, geometry, { positionM: [0, 0, 0], orientationXYZW: config.orientationXYZW,
      angularVelocityRadps: config.angularVelocityRadps }, config.massKg),
  ] });
}
// Uniform-density geometric moments, separate from the package's runtime inertia API.
export function principalMoments(config) {
  const m = config.massKg, r = config.radiusM;
  if (config.shape === 'sphere') return [1, 1, 1].map(() => 2 * m * r * r / 5);
  if (config.shape === 'box') {
    const [x, y, z] = config.halfExtentsM;
    return [y * y + z * z, x * x + z * z, x * x + y * y].map(sum => m * sum / 3);
  }
  // Split total volume into one cylinder and two hemispheres. Apply the parallel-axis theorem.
  const h = config.halfLengthM, vc = 2 * Math.PI * r * r * h, vs = 4 * Math.PI * r ** 3 / 3;
  const mc = m * vc / (vc + vs), mh = (m - mc) / 2, centroid = h + 3 * r / 8;
  const transverse = mc * ((2 * h) ** 2 + 3 * r * r) / 12
    + 2 * mh * (83 * r * r / 320 + centroid * centroid);
  const axial = mc * r * r / 2 + 2 * mh * 2 * r * r / 5;
  return [transverse, axial, transverse];
}
export function rotate(q, v) {
  const [x, y, z, w] = q, [a, b, c] = v;
  const t = [2 * (y * c - z * b), 2 * (z * a - x * c), 2 * (x * b - y * a)];
  return [a + w * t[0] + y * t[2] - z * t[1], b + w * t[1] + z * t[0] - x * t[2], c + w * t[2] + x * t[1] - y * t[0]];
}
export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const add = (a, b) => a.map((value, index) => value + b[index]);
export function measure(body, moments) {
  const q = body.orientationXYZW, omega = body.angularVelocityRadps;
  const local = rotate([-q[0], -q[1], -q[2], q[3]], omega);
  return { energyJ: .5 * dot(local, local.map((value, index) => value * moments[index])),
    angularMomentumWorldNms: rotate(q, local.map((value, index) => value * moments[index])),
    quaternionNorm: Math.hypot(...q) };
}
export function impulseEnergy(body, moments, impulse) {
  const q = body.orientationXYZW;
  const local = rotate([-q[0], -q[1], -q[2], q[3]], impulse);
  return dot(body.angularVelocityRadps, impulse) + .5 * dot(local, local.map((value, index) => value / moments[index]));
}
