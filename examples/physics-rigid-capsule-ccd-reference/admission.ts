import { PhysicsError } from '../../packages/barocss-physics/src/capsule-query-error.js';
import type { Vec3, Quat } from '../../packages/barocss-physics/src/types.js';
import { PROFILE, RADIUS_M, HALF_LENGTH_M, YAW_QUATERNION, ERRORS } from './profile.js';
import type { Snapshot, Movement, Box } from './profile.js';
type Code = 'INVALID_CONFIG' | 'INVALID_QUERY';
function fail(code: Code): never { throw new PhysicsError(code, code === 'INVALID_CONFIG' ? ERRORS.profile : ERRORS.movement); }
// Reflection exceptions propagate. They are harness/input failures, not physical refusals.
export function record(input: unknown, keys: string[], code: Code): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) fail(code);
  const own = Reflect.ownKeys(input as object);
  if (own.length !== keys.length || own.some(k => typeof k !== 'string' || !keys.includes(k))) fail(code);
  const copy: Record<string, unknown> = {};
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(input, key); if (!d || !('value' in d)) fail(code); copy[key] = d.value; }
  return copy;
}
export function tuple(input: unknown, count: number, code: Code): number[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== count || Reflect.ownKeys(input).length !== count + 1) fail(code);
  const values: number[] = [];
  for (let i = 0; i < count; i++) { const d = Object.getOwnPropertyDescriptor(input, String(i)); if (!d || !('value' in d) || typeof d.value !== 'number' || !Number.isFinite(d.value)) fail(code); values.push(d.value); }
  return values;
}
const identity = (input: unknown, code: Code): string => { if (typeof input !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(input)) fail(code); return input as string; };
const zero = (v: number[]) => v.every(x => x === 0);
export function copyBox(b: Box): Box { return { id: b.id, centerM: [...b.centerM], halfExtentsM: [...b.halfExtentsM], orientationXYZW: [...b.orientationXYZW], velocityMps: [...b.velocityMps], angularVelocityRadps: [...b.angularVelocityRadps] }; }
export function copySnapshot(s: Snapshot): Snapshot { return { version: 1, profile: s.profile, selectedFace: 'negative-x', revision: s.revision, capsule: { ...s.capsule, orientationXYZW: [...s.capsule.orientationXYZW], angularVelocityRadps: [...s.capsule.angularVelocityRadps] }, box: copyBox(s.box) }; }
export function admitSnapshot(input: unknown): Snapshot {
  const s = record(input, ['version', 'profile', 'selectedFace', 'revision', 'capsule', 'box'], 'INVALID_CONFIG');
  if (s.version !== 1 || s.profile !== PROFILE || s.selectedFace !== 'negative-x') fail('INVALID_CONFIG');
  const c = record(s.capsule, ['radiusM', 'halfLengthM', 'orientationXYZW', 'angularVelocityRadps'], 'INVALID_CONFIG');
  const cq = tuple(c.orientationXYZW, 4, 'INVALID_CONFIG') as Quat, ca = tuple(c.angularVelocityRadps, 3, 'INVALID_CONFIG') as Vec3;
  if (c.radiusM !== RADIUS_M || c.halfLengthM !== HALF_LENGTH_M || !cq.every((x, i) => x === [0, 0, 0, 1][i]) || !zero(ca)) fail('INVALID_CONFIG');
  const b = record(s.box, ['id', 'centerM', 'halfExtentsM', 'orientationXYZW', 'velocityMps', 'angularVelocityRadps'], 'INVALID_CONFIG');
  const centerM = tuple(b.centerM, 3, 'INVALID_CONFIG') as Vec3, halfExtentsM = tuple(b.halfExtentsM, 3, 'INVALID_CONFIG') as Vec3;
  const orientationXYZW = tuple(b.orientationXYZW, 4, 'INVALID_CONFIG') as Quat, velocityMps = tuple(b.velocityMps, 3, 'INVALID_CONFIG') as Vec3, angularVelocityRadps = tuple(b.angularVelocityRadps, 3, 'INVALID_CONFIG') as Vec3;
  if (centerM.some(x => Math.abs(x) > 10000) || halfExtentsM.some(x => x < .0001 || x > 5) || !zero(velocityMps) || !zero(angularVelocityRadps) ||
      !(orientationXYZW.every((x, i) => x === [0, 0, 0, 1][i]) || orientationXYZW.every((x, i) => x === YAW_QUATERNION[i]))) fail('INVALID_CONFIG');
  return { version: 1, profile: PROFILE, selectedFace: 'negative-x', revision: identity(s.revision, 'INVALID_CONFIG'), capsule: { radiusM: RADIUS_M, halfLengthM: HALF_LENGTH_M, orientationXYZW: cq, angularVelocityRadps: ca }, box: { id: identity(b.id, 'INVALID_CONFIG'), centerM, halfExtentsM, orientationXYZW, velocityMps, angularVelocityRadps } };
}
export function admitMovement(input: unknown, snapshot: Snapshot): Movement {
  const q = record(input, ['revision', 'centerM', 'velocityMps', 'stepSeconds'], 'INVALID_QUERY');
  const revision = identity(q.revision, 'INVALID_QUERY');
  const centerM = tuple(q.centerM, 3, 'INVALID_QUERY') as Vec3, velocityMps = tuple(q.velocityMps, 3, 'INVALID_QUERY') as Vec3;
  if (centerM.some(x => Math.abs(x) > 10000) || velocityMps.some(x => Math.abs(x) > 1000) || typeof q.stepSeconds !== 'number' || !Number.isFinite(q.stepSeconds) || q.stepSeconds <= 0 || q.stepSeconds > 1) fail('INVALID_QUERY');
  if (revision !== snapshot.revision) throw new PhysicsError('STALE_SNAPSHOT', ERRORS.stale);
  return { revision, centerM, velocityMps, stepSeconds: q.stepSeconds as number };
}
