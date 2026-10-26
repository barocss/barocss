// DR-6 point targets: a current straight B-rep edge endpoint, never the saved near hint.
import type { BrepProjection } from '@barocss/cad';
import { problem, type Problem } from '../engine/refusal';
import type { Vec3, ViewId, XY } from './types';

export interface DrawingDatumTarget {
  id: string; letter: string; number: number; view: ViewId; place: XY;
  point: { edge: string; at: 'end'; near: Vec3 };
}
export type DatumTargetFailureCode = 'DATUM_TARGET_INVALID' | 'DATUM_TARGET_LOST' | 'DATUM_TARGET_AMBIGUOUS' | 'DATUM_TARGET_UNSUPPORTED' | 'DATUM_TARGET_DUPLICATE';
export type DatumTargetResolution = { ok: true; at: Vec3; edge: string } | { ok: false; code: DatumTargetFailureCode; reason: string };

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 512;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const keys = (x: Record<string, unknown>, allowed: readonly string[]) => Object.keys(x).every(k => allowed.includes(k));
function tuple(x: unknown, size: number): boolean {
  if (!Array.isArray(x) || x.length !== size) return false;
  for (let k = 0; k < size; k++) if (!Object.hasOwn(x, k) || !finite(x[k])) return false;
  return true;
}
function targetOk(x: unknown): x is DrawingDatumTarget {
  if (!record(x) || !keys(x, ['id', 'letter', 'number', 'view', 'place', 'point']) || !label(x.id) || typeof x.letter !== 'string' || !/^[A-HJ-NPR-Z]$/.test(x.letter) || typeof x.number !== 'number' || !Number.isSafeInteger(x.number) || x.number <= 0 || typeof x.view !== 'string' || !['front', 'top', 'right', 'iso'].includes(x.view) || !tuple(x.place, 2)) return false;
  const p = x.point;
  return record(p) && keys(p, ['edge', 'at', 'near']) && label(p.edge) && p.at === 'end' && tuple(p.near, 3);
}

/** Authored inputs are accepted as a whole. Omitted keeps the saved targets; [] clears them. */
export function checkDatumTargetOptions(args: Record<string, unknown>): Problem[] {
  if (!('datumTargets' in args)) return [];
  const raw = args.datumTargets, ids = new Set<string>(), labels = new Set<string>();
  if (Array.isArray(raw) && raw.length <= 200) {
    let valid = true;
    for (let k = 0; k < raw.length; k++) {
      const target = raw[k];
      if (!Object.hasOwn(raw, k) || !targetOk(target) || ids.has(target.id) || labels.has(`${target.letter}:${target.number}`)) { valid = false; break; }
      ids.add(target.id); labels.add(`${target.letter}:${target.number}`);
    }
    if (valid) return [];
  }
  return [problem('DRAWING_OPTIONS', 'datumTargets needs at most 200 unique ids and (letter, number) pairs, a datum letter, a positive safe integer number, a view, finite dense place[2], and point {edge, at: end, near[3]}. No other keys.')];
}

/** Keep valid saved rows, including duplicates, so consumers can diagnose them without losing evidence. */
export function readDatumTargets(raw: unknown): DrawingDatumTarget[] {
  const out: DrawingDatumTarget[] = [];
  if (!Array.isArray(raw)) return out;
  for (const target of raw) {
    if (!targetOk(target)) continue;
    out.push({ id: target.id, letter: target.letter, number: target.number, view: target.view, place: [target.place[0], target.place[1]], point: { edge: target.point.edge, at: 'end', near: [target.point.near[0], target.point.near[1], target.point.near[2]] } });
  }
  return out;
}

/** All rows sharing an id or a datum letter/number; no first row is silently preferred. */
export function datumTargetConflicts(targets: readonly DrawingDatumTarget[]): ReadonlySet<DrawingDatumTarget> {
  const ids = new Map<string, number>(), labels = new Map<string, number>();
  for (const target of targets) {
    const pair = `${target.letter}:${target.number}`;
    ids.set(target.id, (ids.get(target.id) ?? 0) + 1);
    labels.set(pair, (labels.get(pair) ?? 0) + 1);
  }
  return new Set(targets.filter(target => ids.get(target.id)! > 1 || labels.get(`${target.letter}:${target.number}`)! > 1));
}

const xy = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
export const datumTargetsProperty = {
  type: 'array', maxItems: 200,
  description: 'Endpoint point datum targets. [] clears; omitted keeps. Unique ids and (letter, number) pairs. A current unique straight B-rep edge endpoint is required; near only selects an endpoint. No automatic reference matching.',
  items: {
    type: 'object', properties: {
      id: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' },
      letter: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' },
      number: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
      view: { type: 'string', enum: ['front', 'top', 'right', 'iso'] }, place: xy,
      point: { type: 'object', properties: { edge: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, at: { type: 'string', enum: ['end'] }, near: { ...xy, minItems: 3, maxItems: 3 } }, required: ['edge', 'at', 'near'], additionalProperties: false },
    }, required: ['id', 'letter', 'number', 'view', 'place', 'point'], additionalProperties: false,
  },
};

/** No fallback to another name, the old hint, a circle, or a tied endpoint. */
export function resolveDatumTarget(projection: BrepProjection, target: DrawingDatumTarget): DatumTargetResolution {
  if (!targetOk(target)) return { ok: false, code: 'DATUM_TARGET_INVALID', reason: 'The datum target input is invalid.' };
  const edges = projection.edges.filter(e => e.name === target.point.edge);
  if (!edges.length) return { ok: false, code: 'DATUM_TARGET_LOST', reason: 'The datum target edge is not in the current projection.' };
  if (edges.length !== 1) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The datum target edge name has more than one current candidate.' };
  const edge = edges[0], ends = edge.ends;
  // The projector assigns line only to straight B-rep edges; silhouettes have their own kind.
  if (edge.kind !== 'line' || edge.circle !== null || !Array.isArray(ends) || ends.length !== 2 || !tuple(ends[0], 3) || !tuple(ends[1], 3)) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The datum target needs a straight B-rep edge with finite 3D endpoints.' };
  const distances = ends.map(p => Math.hypot(p[0] - target.point.near[0], p[1] - target.point.near[1], p[2] - target.point.near[2]));
  if (!distances.every(Number.isFinite)) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The current endpoint distances are not finite.' };
  if (distances[0] === distances[1]) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The saved hint is equally near both current endpoints.' };
  const at = ends[distances[0] < distances[1] ? 0 : 1];
  return { ok: true, at: [at[0], at[1], at[2]], edge: edge.name };
}
