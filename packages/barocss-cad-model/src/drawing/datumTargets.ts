// DR-6 point targets: an explicit endpoint on a signed current straight B-rep edge.
import type { BrepProjection } from '@barocss/cad';
import { problem, type Problem } from '../engine/refusal';
import { sameDatumTargetSourceSig, toSig, type Sig } from '../engine/references';
import type { Vec3, ViewId, XY } from './types';

export interface DrawingDatumTarget {
  id: string; letter: string; number: number; view: ViewId; place: XY;
  /** min/max is the lexicographic x, then y, then z endpoint. The near hint never chooses again. */
  point: { edge: string; at: 'end'; near: Vec3; endpoint?: 'min' | 'max'; sig?: Sig; was?: string };
}
export type DatumTargetFailureCode = 'DATUM_TARGET_INVALID' | 'DATUM_TARGET_LOST' | 'DATUM_TARGET_AMBIGUOUS' | 'DATUM_TARGET_UNSUPPORTED' | 'DATUM_TARGET_DUPLICATE' | 'DATUM_TARGET_UNVERIFIED';
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
const signature = (x: unknown): x is Sig => record(x) && keys(x, ['k', 'p', 'd', 's', 'r', 'n']) && typeof x.k === 'string' && tuple(x.p, 3) && finite(x.s) &&
  (x.d === undefined || tuple(x.d, 3)) && (x.r === undefined || finite(x.r)) && (x.n === undefined || finite(x.n));
function targetOk(x: unknown, authored = false): x is DrawingDatumTarget {
  if (!record(x) || !keys(x, ['id', 'letter', 'number', 'view', 'place', 'point']) || !label(x.id) || typeof x.letter !== 'string' || !/^[A-HJ-NPR-Z]$/.test(x.letter) || typeof x.number !== 'number' || !Number.isSafeInteger(x.number) || x.number <= 0 || typeof x.view !== 'string' || !['front', 'top', 'right', 'iso'].includes(x.view) || !tuple(x.place, 2)) return false;
  const p = x.point;
  return record(p) && keys(p, ['edge', 'at', 'near', 'endpoint', 'sig', 'was']) && label(p.edge) && p.at === 'end' && tuple(p.near, 3) &&
    (p.endpoint === 'min' || p.endpoint === 'max' || !authored && p.endpoint === undefined) &&
    (p.sig === undefined || signature(p.sig)) && (p.was === undefined || typeof p.was === 'string');
}

/** Authored inputs are accepted as a whole. Omitted keeps the saved targets; [] clears them. */
export function checkDatumTargetOptions(args: Record<string, unknown>): Problem[] {
  if (!('datumTargets' in args)) return [];
  const raw = args.datumTargets, ids = new Set<string>(), labels = new Set<string>();
  if (Array.isArray(raw) && raw.length <= 200) {
    let valid = true;
    for (let k = 0; k < raw.length; k++) {
      const target = raw[k];
      if (!Object.hasOwn(raw, k) || !targetOk(target, true) || ids.has(target.id) || labels.has(`${target.letter}:${target.number}`)) { valid = false; break; }
      ids.add(target.id); labels.add(`${target.letter}:${target.number}`);
    }
    if (valid) return [];
  }
  return [problem('DRAWING_OPTIONS', 'datumTargets needs at most 200 unique ids and (letter, number) pairs, a datum letter, a positive safe integer number, a view, finite dense place[2], and point {edge, at: end, near[3], endpoint: min|max, sig?, was?}. No other keys.')];
}

/** Keep valid saved rows, including duplicates, so consumers can diagnose them without losing evidence. */
export function readDatumTargets(raw: unknown): DrawingDatumTarget[] {
  const out: DrawingDatumTarget[] = [];
  if (!Array.isArray(raw)) return out;
  for (const target of raw) {
    if (!targetOk(target)) continue;
    const p = target.point;
    out.push({ id: target.id, letter: target.letter, number: target.number, view: target.view, place: [target.place[0], target.place[1]], point: {
      edge: p.edge, at: 'end', near: [p.near[0], p.near[1], p.near[2]],
      ...(p.endpoint !== undefined ? { endpoint: p.endpoint } : {}),
      ...(p.sig ? { sig: { ...p.sig, p: [...p.sig.p] as Vec3, ...(p.sig.d ? { d: [...p.sig.d] as Vec3 } : {}) } } : {}),
      ...(p.was !== undefined ? { was: p.was } : {}),
    } });
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
const vector = { ...xy, minItems: 3, maxItems: 3 };
const sig = { type: 'object', properties: { k: { type: 'string' }, p: vector, d: vector, s: { type: 'number' }, r: { type: 'number' }, n: { type: 'number' } }, required: ['k', 'p', 's'], additionalProperties: false };
export const datumTargetsProperty = {
  type: 'array', maxItems: 200,
  description: 'Endpoint point datum targets. [] clears; omitted keeps. Unique ids and (letter, number) pairs. endpoint min/max orders the two 3D endpoints by x, then y, then z. near is retained only as a hint. A captured current straight-edge signature is required to render. Legacy near-only, unsigned, changed or re-matched references stay unresolved; no automatic reference matching.',
  items: {
    type: 'object', properties: {
      id: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' },
      letter: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' },
      number: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
      view: { type: 'string', enum: ['front', 'top', 'right', 'iso'] }, place: xy,
      point: { type: 'object', properties: { edge: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, at: { type: 'string', enum: ['end'] }, near: vector, endpoint: { type: 'string', enum: ['min', 'max'] }, sig, was: { type: 'string' } }, required: ['edge', 'at', 'near', 'endpoint'], additionalProperties: false },
    }, required: ['id', 'letter', 'number', 'view', 'place', 'point'], additionalProperties: false,
  },
};

function orderedEnds(ends: readonly Vec3[] | null): [Vec3, Vec3] | null {
  if (!ends || ends.length !== 2 || !tuple(ends[0], 3) || !tuple(ends[1], 3)) return null;
  for (let k = 0; k < 3; k++) {
    if (ends[0][k] < ends[1][k]) return [ends[0], ends[1]];
    if (ends[0][k] > ends[1][k]) return [ends[1], ends[0]];
  }
  return null;
}

/** Record the chosen current endpoint, independent of projection or mesh endpoint order. */
export function datumTargetEndpoint(ends: readonly Vec3[] | null, at: Vec3): 'min' | 'max' | null {
  const pair = orderedEnds(ends);
  if (!pair || !tuple(at, 3)) return null;
  if (pair[0].every((v, k) => v === at[k])) return 'min';
  if (pair[1].every((v, k) => v === at[k])) return 'max';
  return null;
}

/** No fallback to another name, the old hint, a circle, or a changed source edge. */
export function resolveDatumTarget(projection: BrepProjection, target: DrawingDatumTarget): DatumTargetResolution {
  if (!targetOk(target)) return { ok: false, code: 'DATUM_TARGET_INVALID', reason: 'The datum target input is invalid.' };
  const edges = projection.edges.filter(e => e.name === target.point.edge);
  if (!edges.length) return { ok: false, code: 'DATUM_TARGET_LOST', reason: 'The datum target edge is not in the current projection.' };
  if (edges.length !== 1) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The datum target edge name has more than one current candidate.' };
  const edge = edges[0], ends = edge.ends;
  // The projector assigns line only to straight B-rep edges; silhouettes have their own kind.
  if (edge.kind !== 'line' || edge.circle !== null || !Array.isArray(ends) || ends.length !== 2 || !tuple(ends[0], 3) || !tuple(ends[1], 3)) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The datum target needs a straight B-rep edge with finite 3D endpoints.' };
  const pair = orderedEnds(ends);
  if (!pair) return { ok: false, code: 'DATUM_TARGET_AMBIGUOUS', reason: 'The current edge has no distinct endpoint pair.' };
  if (!target.point.endpoint || !target.point.sig || target.point.was !== undefined) return { ok: false, code: 'DATUM_TARGET_UNVERIFIED', reason: 'Select the endpoint again to record its endpoint identity and current edge signature.' };
  const d: Vec3 = [ends[1][0] - ends[0][0], ends[1][1] - ends[0][1], ends[1][2] - ends[0][2]], length = Math.hypot(...d);
  if (!Number.isFinite(length) || length <= 0) return { ok: false, code: 'DATUM_TARGET_UNSUPPORTED', reason: 'The current straight edge has no finite positive length.' };
  const current = toSig({ kind: 'line', at: [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2, (ends[0][2] + ends[1][2]) / 2], dir: [d[0] / length, d[1] / length, d[2] / length], size: length });
  if (!sameDatumTargetSourceSig(target.point.sig, current)) return { ok: false, code: 'DATUM_TARGET_UNVERIFIED', reason: 'The source edge geometry changed. Select the endpoint again; the saved target is retained.' };
  const at = pair[target.point.endpoint === 'min' ? 0 : 1];
  return { ok: true, at: [at[0], at[1], at[2]], edge: edge.name };
}
