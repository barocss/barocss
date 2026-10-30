// O19 (D277): a fillet's, chamfer's, shell's or draft's stored names checked against what they named. A name is
// positional on a sketch without side tags: a vertex inserted upstream renumbers the sides, and `n1.side1|n1.side2`
// then names another corner. With `expect` (each name's signature when it was stored, as cad-model's rematch.ts writes
// it) the feature refuses, typed ([REFERENCE_MOVED]), when the name now resolves to other geometry — never building on
// another edge. Without `expect` nothing here runs.
import type { Brep, BrepFace } from '../brep/brep-core.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { revolutionOf } from '../nurbs/surfaces/surface-revolution.js';
import type { Point } from '../types.js';
import type { CadPartErrorCode } from './part-model.js';

/** What a stored name looked like (cad-model's rematch.ts `Signature`): an edge straight or not, a face planar or not. */
export interface CadPartNameSignature {
  readonly kind: 'line' | 'curve' | 'plane' | 'curved';
  /** An edge's midpoint (of its two ends), a face's centroid. */
  readonly at: readonly [number, number, number];
  /** A straight edge's direction (either way), a planar face's normal. */
  readonly dir?: readonly [number, number, number] | null;
  /** An edge's chord, a face's area: carried, not judged. */
  readonly size: number;
  /** A cylindrical or spherical face's radius. */
  readonly radius?: number;
}
type Sig = { kind: CadPartNameSignature['kind']; at: Point; dir: Point | null; radius?: number };

/** cad-model's tolerances (rematch.ts): directions within 1°, radii to 1e-6 relative, "clearly" at twice the distance. */
const SAME_DIRECTION = Math.cos(Math.PI / 180), SAME_RADIUS = 1e-6, CLEARLY_NEARER = 2;
const KINDS = new Set(['line', 'curve', 'plane', 'curved']);
const isVec = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(c => typeof c === 'number' && Number.isFinite(c));

/** The names a feature stores, by kind: a fillet's or chamfer's edges, a shell's open faces, a draft's faces. */
export function storedNames(f: { readonly kind: string } & Record<string, unknown>): { names: readonly string[]; edges: boolean } | null {
  // (A band surface stores the edge names of both its sides.)
  if (f.kind === 'band-surface') {
    const side = (x: unknown) => (typeof x === 'object' && x !== null && Array.isArray((x as { edges?: unknown }).edges) ? (x as { edges: unknown[] }).edges : []).filter((n): n is string => typeof n === 'string');
    return { names: [...side(f.a), ...side(f.b)], edges: true };
  }
  const list = f.kind === 'fillet' || f.kind === 'chamfer' ? f.edges : f.kind === 'shell' ? f.open : f.kind === 'draft' || f.kind === 'full-round' || f.kind === 'face-fillet' || f.kind === 'profile-relief' || f.kind === 'cylindrical-wrap' ? f.faces : undefined;
  if (list === undefined && f.kind !== 'shell') return null;
  return { names: Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [], edges: f.kind === 'fillet' || f.kind === 'chamfer' };
}

/** A feature's `expect`, checked as data: an entry per name the feature uses, each a signature. */
export function expectOf(f: { readonly kind: string } & Record<string, unknown>, fail: (code: CadPartErrorCode, detail: string) => never): ReadonlyMap<string, Sig> | null {
  if (f.expect === undefined) return null;
  const stored = storedNames(f);
  if (!stored) fail('INPUT', `expect is for a fillet's, chamfer's, shell's, draft's, full round's, face fillet's, profile relief's, cylindrical wrap's or band surface's stored names, not a ${f.kind}'s`);
  if (typeof f.expect !== 'object' || f.expect === null || Array.isArray(f.expect)) fail('INPUT', 'expect must be { name: { kind, at, dir?, size, radius? } }');
  const out = new Map<string, Sig>(), used = new Set(stored.names);
  for (const [name, s] of Object.entries(f.expect as Record<string, unknown>)) {
    if (!used.has(name)) fail('INPUT', `expect names ${name}, which this ${f.kind} does not use`);
    const e = s as Record<string, unknown> | null;
    if (!e || typeof e !== 'object' || !KINDS.has(e.kind as string) || !isVec(e.at) || !(e.dir === undefined || e.dir === null || isVec(e.dir)) || typeof e.size !== 'number' || !Number.isFinite(e.size) || !(e.radius === undefined || (typeof e.radius === 'number' && Number.isFinite(e.radius))))
      fail('INPUT', `expect.${name} must be { kind: line | curve | plane | curved, at: [x, y, z], dir?: [x, y, z] | null, size, radius? }`);
    if ((e.kind === 'line' || e.kind === 'curve') !== stored.edges) fail('INPUT', `expect.${name}: ${stored.edges ? 'an edge' : 'a face'}'s kind is ${stored.edges ? 'line or curve' : 'plane or curved'}`);
    out.set(name, { kind: e.kind as Sig['kind'], at: [...(e.at as number[])] as unknown as Point, dir: isVec(e.dir) ? [...e.dir] as unknown as Point : null, ...(e.radius !== undefined ? { radius: e.radius as number } : {}) });
  }
  return out;
}

/** Same kind, the same radius where there is one, the same direction where there is one (an edge's either way): rematch.ts's `alike`. */
function alike(a: Sig, b: Sig, edge: boolean): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.radius === undefined) !== (b.radius === undefined) || (a.radius !== undefined && Math.abs(a.radius - b.radius!) > SAME_RADIUS * Math.max(1, a.radius))) return false;
  if (!a.dir || !b.dir) return !a.dir && !b.dir;
  const c = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2];
  return (edge ? Math.abs(c) : c) >= SAME_DIRECTION;
}
const dist = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const fmt = (p: readonly number[]) => `(${p.map(x => +x.toFixed(4)).join(', ')})`;

/** Each edge name's signature on a body: its pieces joined as the display joins them (straight: the extreme ends; curved: the chain's free ends). */
export function edgeSignatures(brep: Brep): Map<string, Sig> {
  const point = new Map(brep.vertices.map(v => [v.id, v.point])), groups = new Map<string, { straight: boolean; ends: Point[] }>();
  for (const e of brep.edges) {
    if (!e.name) continue;
    const straight = e.curve.degree === 1 && e.curve.controlPoints.length === 2, g = groups.get(e.name) ?? { straight, ends: [] };
    g.straight &&= straight; g.ends.push(point.get(e.vertices[0])!, point.get(e.vertices[1])!); groups.set(e.name, g);
  }
  const out = new Map<string, Sig>();
  for (const [name, g] of groups) {
    let a = g.ends[0], b = g.ends[1];
    if (g.straight) { let best = -1; for (let i = 0; i < g.ends.length; i++) for (let j = i + 1; j < g.ends.length; j++) { const d = dist(g.ends[i], g.ends[j]); if (d > best) { best = d; a = g.ends[i]; b = g.ends[j]; } } }
    else if (g.ends.length > 2) { const size = Math.max(1, ...g.ends.map(p => Math.hypot(...p))), free = g.ends.filter(p => g.ends.filter(q => dist(p, q) <= 1e-6 * size).length === 1); if (free.length === 2) [a, b] = free; else b = a; }
    const d: Point = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    out.set(name, { kind: g.straight ? 'line' : 'curve', at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dir: g.straight && l > 0 ? [d[0] / l, d[1] / l, d[2] / l] : null });
  }
  return out;
}

/** Each face name's signature on a body: planar or curved, its area centroid and normal over its tessellation, its radius. */
export function faceSignatures(brep: Brep): Map<string, Sig> {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 8 }), byId = new Map(brep.faces.map(f => [f.id, f])), P = mesh.positions, out = new Map<string, Sig>();
  for (const mf of mesh.faces) {
    const face = byId.get(mf.faceId); if (!face?.name) continue;
    let area = 0; const c = [0, 0, 0], n = [0, 0, 0];
    for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t += 3) {
      const ia = 3 * mesh.indices[t], ib = 3 * mesh.indices[t + 1], ic = 3 * mesh.indices[t + 2];
      const u = [P[ib] - P[ia], P[ib + 1] - P[ia + 1], P[ib + 2] - P[ia + 2]], v = [P[ic] - P[ia], P[ic + 1] - P[ia + 1], P[ic + 2] - P[ia + 2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], ar = Math.hypot(cr[0], cr[1], cr[2]) / 2;
      area += ar; for (let k = 0; k < 3; k++) { c[k] += (P[ia + k] + P[ib + k] + P[ic + k]) / 3 * ar; n[k] += cr[k]; }
    }
    const planar = mf.kind === 'planar' || (mf.kind === 'facet' && planeOf(face)), nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const radius = planar || mf.kind === 'facet' ? undefined : radiusOf(face);
    const sig: Sig = { kind: planar ? 'plane' : 'curved', at: (area > 0 ? c.map(x => x / area) : [P[3 * mf.vertexOffset], P[3 * mf.vertexOffset + 1], P[3 * mf.vertexOffset + 2]]) as unknown as Point, dir: planar ? [n[0] / nl, n[1] / nl, n[2] / nl] : null, ...(radius !== undefined ? { radius } : {}) };
    // (Under its name, and its base name as the display shows a face numbered #k when it is the only one.)
    for (const name of face.name.split('+')) { out.set(name, sig); const base = name.replace(/#\d+$/, ''); if (!out.has(base)) out.set(base, sig); }
  }
  return out;
}
function planeOf(face: BrepFace): boolean { try { return faceGeometry(face).kind === 'plane'; } catch { return false; } }
/** A round face's radius, as cad-model's display reads it: a cylinder's, or a sphere's (a profile arc centred on its axis). */
function radiusOf(face: BrepFace): number | undefined {
  try { const g = faceGeometry(face); if (g.kind === 'cylinder') return g.r; } catch { /* a general surface */ }
  if (face.surface.kind !== 'surface') return undefined;
  const r = revolutionOf(face.surface, 100);
  return r?.profile.kind === 'arc' && Math.abs(r.profile.c[0]) < 1e-9 * (1 + r.profile.r) ? r.profile.r : undefined;
}

/**
 * Refuses when a stored name resolves to other geometry than it named: (a) the named edge or face is not alike its
 * expectation, or (b) another one alike it is clearly nearer the expectation (at half the named one's distance or less).
 * A name not on the body is left to the feature's own refusal.
 */
export function checkExpected(brep: Brep, expect: ReadonlyMap<string, Sig>, edges: boolean, kind: string, fail: (code: CadPartErrorCode, detail: string) => never): void {
  const sigs = edges ? edgeSignatures(brep) : faceSignatures(brep), what = edges ? 'edge' : 'face';
  for (const [name, old] of expect) {
    const now = sigs.get(name); if (!now) continue;
    if (!alike(old, now, edges)) fail('REFERENCE', moved(kind, what, name, old, now, old.kind !== now.kind ? `; it is a ${now.kind} ${what} now, was ${old.kind}` : old.radius !== now.radius ? `; its radius ${now.radius ?? 'none'}, was ${old.radius ?? 'none'}` : '; it faces another way'));
    const d = dist(now.at, old.at);
    for (const [other, s] of sigs) if (other !== name && d > 0 && alike(old, s, edges) && CLEARLY_NEARER * dist(s.at, old.at) <= d) fail('REFERENCE', moved(kind, what, name, old, now, `; ${other} is at ${fmt(s.at)}`));
  }
}
const moved = (kind: string, what: string, name: string, old: Sig, now: Sig, why: string) => `[REFERENCE_MOVED] ${kind} ${what} ${name} is no longer the ${what} it named (was at ${fmt(old.at)}, now at ${fmt(now.at)}${why})`;
