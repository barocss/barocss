import { validateSurface } from '../core/math.js';
import type { Surface, Point } from '../types.js';
import type { RawNurbsSurface } from './spec.js';
import { refuse } from './refusal.js';

const FIELDS = ['degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'] as const;
const invalid = (message: string, label: string): never => { throw refuse('VALUE', `${label}: ${message}`); };

// Read own data only. Never invoke a caller's getter while capturing a recipe.
function data(object: object, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !('value' in descriptor)) return invalid(`${key} must be an own data field`, label);
  return descriptor.value;
}

function dense(value: unknown, maximum: number, label: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return invalid('expected a plain dense array', label);
  if (value.length > maximum || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) return invalid('array has extra fields, holes or too many elements', label);
  const copy: unknown[] = [];
  for (let i = 0; i < value.length; i++) copy.push(data(value, String(i), label));
  return copy;
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid('expected finite numbers', label);
  return value;
}

function numbers(value: unknown, maximum: number, label: string): number[] {
  const source = dense(value, maximum, label), copy: number[] = [];
  for (let i = 0; i < source.length; i++) copy.push(numeric(source[i], label));
  return copy;
}

/** Internal admission for the six-field whole-surface facade payload. */
export function surfaceSnapshot(value: RawNurbsSurface, label = 'thicken surface'): RawNurbsSurface {
  if (value === null || typeof value !== 'object') return invalid('expected a plain six-field object', label);
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Object.getOwnPropertySymbols(value).length) return invalid('expected a plain six-field object', label);
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length !== FIELDS.length) return invalid('only degreeU, degreeV, knotsU, knotsV, controlPoints and weights are accepted', label);
  for (const key of keys) if (!(FIELDS as readonly string[]).includes(key)) return invalid(`unknown field ${key}`, label);
  const degreeU = numeric(data(value, 'degreeU', label), label), degreeV = numeric(data(value, 'degreeV', label), label);
  const knotsU = numbers(data(value, 'knotsU', label), 22, label), knotsV = numbers(data(value, 'knotsV', label), 22, label);
  const sourcePoints = dense(data(value, 'controlPoints', label), 16, label), controlPoints: Point[][] = [];
  for (let u = 0; u < sourcePoints.length; u++) {
    const sourceRow = dense(sourcePoints[u], 16, label), row: Point[] = [];
    for (let v = 0; v < sourceRow.length; v++) {
      const point = numbers(sourceRow[v], 3, label);
      if (point.length !== 3) return invalid('a control point must have three coordinates', label);
      row.push([point[0], point[1], point[2]]);
    }
    controlPoints.push(row);
  }
  const sourceWeights = dense(data(value, 'weights', label), 16, label), weights: number[][] = [];
  for (let u = 0; u < sourceWeights.length; u++) weights.push(numbers(sourceWeights[u], 16, label));
  const snapshot = { degreeU, degreeV, knotsU, knotsV, controlPoints, weights };
  try { validateSurface({ kind: 'surface', id: 'thicken_snapshot', ...snapshot } as Surface); }
  catch (error) { return invalid(error instanceof Error ? error.message : 'invalid NURBS surface', label); }
  return snapshot;
}

/** Internal ordered admission for a Sew recipe; no caller array or coefficient is retained. */
export function surfaceSnapshots(value: readonly RawNurbsSurface[]): readonly RawNurbsSurface[] {
  const source = dense(value, 64, 'sew surfaces');
  if (source.length < 2) return invalid('expected 2 to 64 surfaces', 'sew surfaces');
  const snapshots: RawNurbsSurface[] = [];
  for (let i = 0; i < source.length; i++) snapshots.push(surfaceSnapshot(source[i] as RawNurbsSurface, `sew surface ${i}`));
  return snapshots;
}
