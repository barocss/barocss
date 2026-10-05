import type { Curve, Model, Point, Surface } from './types.js';
import { validateCurve, validateSurface } from './math.js';

export interface SourceSpan { start: number; end: number; line: number; column: number }
export interface ParsedModel extends Model { spans: Record<string, SourceSpan> }
export class CadSyntaxError extends Error {
  readonly code: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  constructor(code: string, message: string, source: string, offset: number) {
    const lines = source.slice(0, offset).split('\n');
    super(`${code} at ${lines.length}:${lines.at(-1)!.length + 1}: ${message}`);
    this.name = 'CadSyntaxError'; this.code = code; this.offset = offset;
    this.line = lines.length; this.column = lines.at(-1)!.length + 1;
  }
}
type Value = number | string | Value[];
const limits: Record<string, number[]> = {
  knots: [70], 'knots-u': [22], 'knots-v': [22],
  'control-points': [64, 3], weights: [64],
};
/** Parse only explicit v0 declarations. The host owns loading and saving. */
export function parseModel(source: string): ParsedModel {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  if (source.length > 262144 || new TextEncoder().encode(source).length > 262144) throw new CadSyntaxError('LIMIT', 'Source exceeds 256 KiB', '', 0);
  let at = 0;
  const fail = (code: string, message: string, offset = at): never => { throw new CadSyntaxError(code, message, source, offset); };
  const skip = () => {
    while (at < source.length) {
      if (/\s/.test(source[at])) { at++; continue; }
      if (source.startsWith('/*', at)) {
        const end = source.indexOf('*/', at + 2);
        if (end < 0) fail('SYNTAX', 'Unterminated comment');
        at = end + 2; continue;
      }
      break;
    }
  };
  const take = (token: string) => { skip(); if (!source.startsWith(token, at)) fail('SYNTAX', `Expected ${token}`); at += token.length; };
  const ident = () => {
    skip(); const match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(source.slice(at));
    if (!match) return fail('SYNTAX', 'Expected identifier');
    at += match[0].length; return match[0];
  };
  const value = (bounds: number[], depth = 0): Value => {
    skip();
    if (source[at] === '[') {
      if (depth >= bounds.length) fail('DIMENSION', 'Array nesting exceeds field dimension');
      at++; const items: Value[] = []; skip();
      if (source[at] !== ']') {
        while (true) {
          if (items.length >= bounds[depth]) fail('LIMIT', 'Array exceeds field limit');
          items.push(value(bounds, depth + 1)); skip();
          if (source[at] !== ',') break;
          at++; skip(); if (source[at] === ']') fail('SYNTAX', 'Trailing comma is unsupported');
        }
      }
      take(']'); return items;
    }
    const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at));
    if (match) { at += match[0].length; const n = Number(match[0]); if (!Number.isFinite(n)) fail('VALUE', 'Number must be finite'); return n; }
    return ident();
  };
  const field = (allowed: Set<string>, surface = false) => {
    skip(); const start = at; const key = ident();
    if (!allowed.has(key)) fail('FIELD', `Unsupported field ${key}`, start);
    take(':');
    const bounds = surface && key === 'control-points' ? [16, 16, 3] : surface && key === 'weights' ? [16, 16] : limits[key] ?? [];
    const result = value(bounds); take(';'); return { key, result, start };
  };
  take('@'); if (ident() !== 'model') fail('SYNTAX', 'Expected @model');
  const name = ident(); take('{');
  const modelFields = new Map<string, Value>();
  const objects: (Curve | Surface)[] = []; const spans: Record<string, SourceSpan> = Object.create(null);
  const ids = new Set<string>();
  while (true) {
    skip(); if (source[at] === '}') { at++; break; }
    if (source[at] !== '@') {
      const { key, result, start } = field(new Set(['version', 'length-unit']));
      if (modelFields.has(key)) fail('DUPLICATE', `Duplicate field ${key}`, start);
      modelFields.set(key, result); continue;
    }
    if (objects.length >= 16) fail('LIMIT', 'Model exceeds 16 objects');
    const start = at; take('@'); const kind = ident();
    if (kind !== 'curve' && kind !== 'surface') fail('KIND', `Unsupported object ${kind}`, start);
    take('#'); const id = ident(); if (ids.has(id)) fail('DUPLICATE', `Duplicate ID ${id}`, start);
    ids.add(id); take('{'); const props = new Map<string, Value>();
    const fields = kind === 'curve' ? ['type', 'degree', 'knots', 'control-points', 'weights'] : ['type', 'degree-u', 'degree-v', 'knots-u', 'knots-v', 'control-points', 'weights'];
    while (true) {
      skip(); if (source[at] === '}') { at++; break; }
      const { key, result, start: position } = field(new Set(fields), kind === 'surface');
      if (props.has(key)) fail('DUPLICATE', `Duplicate field ${key}`, position);
      props.set(key, result);
    }
    for (const key of fields) if (!props.has(key)) fail('FIELD', `Missing field ${key}`, start);
    if (props.get('type') !== 'nurbs') fail('VALUE', 'Only nurbs is supported', start);
    const object = kind === 'curve' ? {
      kind, id, degree: props.get('degree') as number, knots: props.get('knots') as number[],
      controlPoints: props.get('control-points') as Point[], weights: props.get('weights') as number[],
    } satisfies Curve : {
      kind: 'surface', id, degreeU: props.get('degree-u') as number, degreeV: props.get('degree-v') as number,
      knotsU: props.get('knots-u') as number[], knotsV: props.get('knots-v') as number[],
      controlPoints: props.get('control-points') as Point[][], weights: props.get('weights') as number[][],
    } satisfies Surface;
    try { if (object.kind === 'curve') validateCurve(object); else validateSurface(object); }
    catch (error) { fail('GEOMETRY', (error as Error).message, start); }
    const lines = source.slice(0, start).split('\n');
    spans[id] = { start, end: at, line: lines.length, column: lines.at(-1)!.length + 1 };
    objects.push(object);
  }
  skip(); if (at !== source.length) fail('SYNTAX', 'Unexpected content after model');
  if (modelFields.get('version') !== 0) fail('VERSION', 'version: 0 is required', 0);
  if (modelFields.get('length-unit') !== 'mm') fail('UNIT', 'length-unit: mm is required', 0);
  if (!objects.length) fail('GEOMETRY', 'Model must contain geometry', 0);
  return { name, version: 0, lengthUnit: 'mm', objects, spans };
}
