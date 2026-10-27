// DR-6b first slice: face datum features. Saved edge references retain their existing metadata and diagnostics.
import { problem, type Problem } from '../engine/refusal';
import { isVec3 } from '../util/guards';
import type { DrawingDatum, DrawingViews, EdgeRef, Vec3, ViewId, XY } from './types';

export interface DrawingFace { name: string; points: Vec3[] }
/** A hint to the nearest current boundary vertex of this exact face, not a sampled surface point. */
export interface DrawingFaceRef { face: string; near: Vec3 }

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const label = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 512;
const letter = (x: unknown): x is string => typeof x === 'string' && /^[A-HJ-NPR-Z]$/.test(x);
const view = (x: unknown): x is ViewId => typeof x === 'string' && ['front', 'top', 'right', 'iso'].includes(x);
const xy = (x: unknown): x is XY => Array.isArray(x) && x.length === 2 && x.every(v => typeof v === 'number' && Number.isFinite(v));
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
/** Authored tuples must contain every coordinate; keep the legacy saved-reader checks separate. */
function authoredTuple(x: unknown, size: number): boolean {
  if (!Array.isArray(x) || x.length !== size) return false;
  for (let k = 0; k < size; k++) if (!Object.hasOwn(x, k) || !finite(x[k])) return false;
  return true;
}
const authoredXY = (x: unknown): x is XY => authoredTuple(x, 2);
const authoredVec3 = (x: unknown): x is Vec3 => authoredTuple(x, 3);
const keys = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).every(k => allowed.includes(k));
const signature = (x: unknown): boolean => record(x) && keys(x, ['k', 'p', 'd', 's', 'r', 'n']) && typeof x.k === 'string' && authoredVec3(x.p) && finite(x.s) &&
  (x.d === undefined || authoredVec3(x.d)) && (x.r === undefined || finite(x.r)) && (x.n === undefined || finite(x.n));
const edge = (x: unknown): boolean => record(x) && keys(x, ['edge', 'near', 'sig', 'was']) && label(x.edge) && authoredVec3(x.near) &&
  (x.sig === undefined || signature(x.sig)) && (x.was === undefined || typeof x.was === 'string');

/** Strict authored input. Saved files use readDatums, which preserves the old edge-reader acceptance. */
export function datumOk(x: unknown): x is DrawingDatum {
  if (!record(x) || !keys(x, ['id', 'letter', 'view', 'place', 'edge', 'face']) || !label(x.id) || !letter(x.letter) || !view(x.view) || !authoredXY(x.place) || (x.edge !== undefined) === (x.face !== undefined)) return false;
  return x.face !== undefined ? record(x.face) && keys(x.face, ['face', 'near']) && label(x.face.face) && authoredVec3(x.face.near) : edge(x.edge);
}

/** Preserve duplicate ids/letters for the issue list; never silently remove an existing datum to make it unique. */
export function readDatums(raw: unknown): DrawingDatum[] {
  const out: DrawingDatum[] = [];
  if (Array.isArray(raw)) for (const d of raw) {
    if (!record(d) || typeof d.id !== 'string' || !letter(d.letter) || !view(d.view) || !xy(d.place)) continue;
    // The previous file reader accepted any string edge name and a three-element near array, copying all EdgeRef metadata.
    if (record(d.edge) && typeof d.edge.edge === 'string' && Array.isArray(d.edge.near) && d.edge.near.length === 3) {
      out.push({ id: d.id, letter: d.letter, view: d.view, place: [...d.place], edge: {
        ...d.edge, near: [...d.edge.near],
        ...(record(d.edge.sig) ? { sig: { ...d.edge.sig,
          ...(Array.isArray(d.edge.sig.p) ? { p: [...d.edge.sig.p] } : {}),
          ...(Array.isArray(d.edge.sig.d) ? { d: [...d.edge.sig.d] } : {}),
        } } : {}),
      } as EdgeRef });
    } else if (datumOk(d) && d.face) {
      out.push({ id: d.id, letter: d.letter, view: d.view, place: [...d.place], face: { face: d.face.face, near: [...d.face.near] } });
    }
  }
  return out;
}

export function checkDatumOptions(args: Record<string, unknown>): Problem[] {
  if (!('datums' in args)) return [];
  const raw = args.datums;
  if (!Array.isArray(raw) || raw.length > 200 || Array.from(raw).some((d, k) => !Object.hasOwn(raw, k) || !datumOk(d)) || new Set(raw.map(d => d.id)).size !== raw.length || new Set(raw.map(d => d.letter)).size !== raw.length)
    return [problem('DRAWING_OPTIONS', 'datums needs at most 200 unique ids and letters (A–Z excluding I, O, Q), a view and finite place[2], and exactly one edge {edge, near[3], sig?, was?} or face {face, near[3]} reference. No other keys.')];
  return [];
}

/** Exact face identity, including its occurrence prefix. No fallback to another face or to the old hint. */
export function datumAnchor(views: DrawingViews, d: DrawingDatum): Vec3 | null {
  if (!d.face) return [...d.edge.near];
  const ref = d.face, found = (views.faces ?? []).filter(f => f.name === ref.face);
  if (found.length !== 1 || !found[0].points.length || !found[0].points.every(isVec3)) return null;
  let best = found[0].points[0], distance = Infinity;
  for (const p of found[0].points) { const n = p.reduce((s, v, k) => s + (v - ref.near[k]) ** 2, 0); if (n < distance) { distance = n; best = p; } }
  return [...best];
}

const point = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const vector = { ...point, minItems: 3, maxItems: 3 };
const sig = { type: 'object', properties: { k: { type: 'string' }, p: vector, d: vector, s: { type: 'number' }, r: { type: 'number' }, n: { type: 'number' } }, required: ['k', 'p', 's'], additionalProperties: false };
const ref = { type: 'object', properties: { face: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, near: vector }, required: ['face', 'near'], additionalProperties: false };
export const datumsProperty = {
  type: 'array', maxItems: 200,
  description: 'Face or edge datum features. [] clears; omitted keeps. An exact face identity and near hint select its nearest current boundary vertex. Missing or ambiguous faces remain unresolved. Existing edge signatures and re-match names are supported.',
  items: {
    type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, letter: { type: 'string', pattern: '^[A-HJ-NPR-Z]$' }, view: { type: 'string', enum: ['front', 'top', 'right', 'iso'] }, place: point, face: ref,
      edge: { type: 'object', properties: { edge: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' }, near: vector, sig, was: { type: 'string' } }, required: ['edge', 'near'], additionalProperties: false } },
    required: ['id', 'letter', 'view', 'place'], oneOf: [{ required: ['edge'], not: { required: ['face'] } }, { required: ['face'], not: { required: ['edge'] } }], additionalProperties: false,
  },
};
