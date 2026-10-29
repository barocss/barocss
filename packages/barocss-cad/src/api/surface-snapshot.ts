import { validateSurface } from '../core/math.js';
import type { Surface, Point } from '../types.js';
import type { RawNurbsSurface } from './spec.js';
import { refuse } from './refusal.js';

const FIELDS = ['degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'] as const;
const invalid = (message: string): never => { throw refuse('VALUE', `thicken surface: ${message}`); };

// Read own data only. Never invoke a caller's getter while capturing a recipe.
function data(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !('value' in descriptor)) return invalid(`${key} must be an own data field`);
  return descriptor.value;
}

function dense(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return invalid('expected a plain dense array');
  if (value.length > maximum || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) return invalid('array has extra fields, holes or too many elements');
  const copy: unknown[] = [];
  for (let i = 0; i < value.length; i++) copy.push(data(value, String(i)));
  return copy;
}

function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid('expected finite numbers');
  return value;
}

function numbers(value: unknown, maximum: number): number[] {
  const source = dense(value, maximum), copy: number[] = [];
  for (let i = 0; i < source.length; i++) copy.push(numeric(source[i]));
  return copy;
}

/** Internal admission for the six-field whole-surface facade payload. */
export function surfaceSnapshot(value: RawNurbsSurface): RawNurbsSurface {
  if (value === null || typeof value !== 'object') return invalid('expected a plain six-field object');
  const prototype = Object.getPrototypeOf(value);
  if ((prototype !== Object.prototype && prototype !== null) || Object.getOwnPropertySymbols(value).length) return invalid('expected a plain six-field object');
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length !== FIELDS.length) return invalid('only degreeU, degreeV, knotsU, knotsV, controlPoints and weights are accepted');
  for (const key of keys) if (!(FIELDS as readonly string[]).includes(key)) return invalid(`unknown field ${key}`);
  const degreeU = numeric(data(value, 'degreeU')), degreeV = numeric(data(value, 'degreeV'));
  const knotsU = numbers(data(value, 'knotsU'), 22), knotsV = numbers(data(value, 'knotsV'), 22);
  const sourcePoints = dense(data(value, 'controlPoints'), 16), controlPoints: Point[][] = [];
  for (let u = 0; u < sourcePoints.length; u++) {
    const sourceRow = dense(sourcePoints[u], 16), row: Point[] = [];
    for (let v = 0; v < sourceRow.length; v++) {
      const point = numbers(sourceRow[v], 3);
      if (point.length !== 3) return invalid('a control point must have three coordinates');
      row.push([point[0], point[1], point[2]]);
    }
    controlPoints.push(row);
  }
  const sourceWeights = dense(data(value, 'weights'), 16), weights: number[][] = [];
  for (let u = 0; u < sourceWeights.length; u++) weights.push(numbers(sourceWeights[u], 16));
  const snapshot = { degreeU, degreeV, knotsU, knotsV, controlPoints, weights };
  try { validateSurface({ kind: 'surface', id: 'thicken_snapshot', ...snapshot } as Surface); }
  catch (error) { return invalid(error instanceof Error ? error.message : 'invalid NURBS surface'); }
  return snapshot;
}
