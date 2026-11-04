import { PhysicsError } from './types.js';
import type { Hit, Vec3 } from './internal-types.js';
import type { Pair } from '../../B/candidate.js';

export interface PhasePoint {
  id: string; pointM: Vec3; aPointM: Vec3; bPointM: Vec3;
  exact: { a: string[]; b: string[]; midpoint: string[] };
}
export interface PhaseHitResult extends Record<string, unknown> {
  status: 'HIT'; normal: Vec3; feature: { kind: 'FACE' | 'EDGE' };
  points: PhasePoint[];
}
export interface PhaseHit extends Hit {
  _phase: { queryId: number; result: PhaseHitResult; pair: Pair };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function vector(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(x => typeof x === 'number' && Number.isFinite(x));
}
function stringVector(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 3 && value.every(x => typeof x === 'string');
}
function point(value: unknown): value is PhasePoint {
  return record(value) && typeof value.id === 'string' && vector(value.pointM) && vector(value.aPointM) && vector(value.bPointM) &&
    record(value.exact) && stringVector(value.exact.a) && stringVector(value.exact.b) && stringVector(value.exact.midpoint);
}
function box(value: unknown): value is Pair['a'] {
  return record(value) && typeof value.id === 'string' && vector(value.positionM) && vector(value.halfExtentsM) &&
    Array.isArray(value.orientationXYZW) && value.orientationXYZW.length === 4 &&
    value.orientationXYZW.every(x => typeof x === 'number' && Number.isFinite(x));
}
function pair(value: unknown): value is Pair {
  return record(value) && typeof value.id === 'string' && box(value.a) && box(value.b);
}
function hitResult(value: unknown): value is PhaseHitResult {
  return record(value) && value.status === 'HIT' && vector(value.normal) &&
    record(value.feature) && (value.feature.kind === 'FACE' || value.feature.kind === 'EDGE') &&
    Array.isArray(value.points) && value.points.length >= 1 && value.points.length <= 4 && value.points.every(point);
}
/** Validate the real unknown geometry boundary; return the same data objects. */
export function checkedPhaseHit(normal: unknown, penetration: unknown, pointM: unknown,
  queryId: unknown, result: unknown, queryPair: unknown): PhaseHit {
  if (!vector(normal) || typeof penetration !== 'number' || !Number.isFinite(penetration) || penetration < 0 ||
      !vector(pointM) || typeof queryId !== 'number' || !Number.isSafeInteger(queryId) || queryId <= 0 ||
      !hitResult(result) || !pair(queryPair)) {
    throw new PhysicsError('NUMERIC_LIMIT', 'invalid typed private geometry-hit boundary');
  }
  return { normal, penetration, pointM, _phase: { queryId, result, pair: queryPair } };
}
export function isPhaseHit(hit: Hit): hit is PhaseHit {
  return '_phase' in hit && record(hit._phase) && hitResult(hit._phase.result) && pair(hit._phase.pair) &&
    typeof hit._phase.queryId === 'number' && Number.isSafeInteger(hit._phase.queryId) && hit._phase.queryId > 0;
}
