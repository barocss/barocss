// CNC7a (O101): machining features recognised from the part's exact geometry, per setup direction (CNC4's ±X, ±Y, ±Z).
// A floor is a plane facing the tool (its normal the direction the tool comes from), looking out along it, with a wall
// rising at its edge; it is a pocket when its walls bound it in every in-plane direction, a slot when only across, a
// step when on one side only (O100's probe). One feature's floors are one name at one level (a step a slot runs through
// comes in two pieces of one face). Holes are CNC2's (through, blind, counterbored, tapped); a boss is a convex exact
// cylinder standing on a plane that faces along its axis. Each feature has its exact sizes, its faces and the setup
// that reaches it.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { buildBvh, rayHit } from '../print/orient';
import { concaveSpan, extent, holesOf, tappedHoles, type Hole } from './holes';
import { narrowest } from './cavities';
import { DIRECTION_NAMES, DIRECTIONS } from './access';

type V = readonly number[];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const AXES: readonly V[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export type FeatureKind = 'pocket' | 'slot' | 'step' | 'hole' | 'boss';
export interface Feature {
  readonly id: string; readonly kind: FeatureKind; readonly body: string;
  /** The setups that reach it (DIRECTION_NAMES): the direction the tool comes from. */
  readonly setups: readonly string[];
  readonly faces: readonly string[];
  /** Depth (a floor's below its highest wall; a hole's along its axis; a boss's height above its base). */
  readonly depthMM: number;
  /** Pockets: width (narrowest across its walls) and length (its extent along the narrowest's normal); slots: width across and length along; steps: the width of the floor out from its wall. */
  readonly widthMM?: number; readonly lengthMM?: number;
  /** Holes and bosses: the diameter (a hole's narrowest step); a hole's type, thread and counterbore. */
  readonly diameterMM?: number; readonly through?: boolean; readonly thread?: string; readonly counterbore?: { diameterMM: number; depthMM: number };
}

/** Each face's vertices, by index. */
function vertsByFace(m: DisplayMesh): number[][][] {
  const out: number[][][] = m.faces.map(() => []);
  for (let i = 0; i < m.faceOfVertex.length; i++) out[m.faceOfVertex[i]]?.push([m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]]);
  return out;
}
const span = (pts: readonly number[][], u: V): [number, number] => { let lo = Infinity, hi = -Infinity; for (const p of pts) { const s = dot(p, u); if (s < lo) lo = s; if (s > hi) hi = s; } return [lo, hi]; };
/** Whether a wall lies wholly at or past the floor's high (+1) or low (−1) side along u. */
function past(wall: readonly number[][], lo: number, hi: number, u: V, side: 1 | -1): boolean { return side > 0 ? wall.every(v => dot(v, u) >= hi - 1e-6) : wall.every(v => dot(v, u) <= lo + 1e-6); }

interface Floor { body: string; face: number; name: string; dir: number; level: number; depth: number; kind: 'pocket' | 'slot' | 'step'; bounded: V[]; free: V[]; walled: V[]; verts: number[][]; rising: number[]; also: number[] }
/** A body's floors per setup direction. */
function floorsOf(b: BodyResult): Floor[] {
  const m = b.mesh, bvh = buildBvh(m), verts = vertsByFace(m), nb = new Map<number, Set<number>>(), out: Floor[] = [];
  for (const e of m.edges) for (const [x, y] of [[e.faces[0], e.faces[1]], [e.faces[1], e.faces[0]]]) { const s = nb.get(x); if (s) s.add(y); else nb.set(x, new Set([y])); }
  for (const f of m.faces) {
    if (f.exact?.kind !== 'plane') continue;
    const n = f.exact.n, dir = DIRECTIONS.findIndex(d => dot(d, n) > 1 - 1e-9); if (dir < 0) continue;
    const level = dot(f.exact.o, n), dirs = AXES.filter(u => Math.abs(dot(u, n)) < 1e-9), own = verts[f.index];
    const ext = dirs.map(u => span(own, u));
    const atEdge = (g: number) => dirs.some((u, k) => past(verts[g], ext[k][0], ext[k][1], u, 1) || past(verts[g], ext[k][0], ext[k][1], u, -1));
    // (A wall rising beside it, at its edge: a boss standing inside a face does not make it a floor.)
    const rising = [...(nb.get(f.index) ?? [])].filter(g => verts[g].some(v => dot(v, n) > level + 1e-6) && verts[g].every(v => dot(v, n) >= level - 1e-6) && atEdge(g));
    if (!rising.length) continue;
    // (It looks out along its normal: the tool reaches it — a ray from its triangles' centres, one leaving the part.)
    let open = false;
    for (let t = 0; t < m.indices.length && !open; t += 3) {
      if (m.faceOfVertex[m.indices[t]] !== f.index) continue;
      const i0 = 3 * m.indices[t], i1 = 3 * m.indices[t + 1], i2 = 3 * m.indices[t + 2], P = m.positions;
      const p = [(P[i0] + P[i1] + P[i2]) / 3 + 0.01 * n[0], (P[i0 + 1] + P[i1 + 1] + P[i2 + 1]) / 3 + 0.01 * n[1], (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 + 0.01 * n[2]];
      open = rayHit(bvh, p, n) === Infinity;
    }
    if (!open) continue;
    const depth = Math.max(...rising.flatMap(g => verts[g].map(v => dot(v, n)))) - level;
    const bounded = dirs.filter((u, k) => rising.some(g => past(verts[g], ext[k][0], ext[k][1], u, 1)) && rising.some(g => past(verts[g], ext[k][0], ext[k][1], u, -1)));
    const free = dirs.filter(u => !bounded.includes(u)), walled = dirs.filter((u, k) => rising.some(g => past(verts[g], ext[k][0], ext[k][1], u, 1) || past(verts[g], ext[k][0], ext[k][1], u, -1)));
    out.push({ body: b.key, face: f.index, name: f.name, dir, level, depth, kind: bounded.length === dirs.length ? 'pocket' : bounded.length ? 'slot' : 'step', bounded, free, walled, verts: own, rising, also: [] });
  }
  // (One feature seen from two setups — each the other's rising wall, as an L's floor and riser or a pocket run out
  // through an edge and its end wall: the shallower reading kept, the way a tool cuts it, reachable from both.)
  const byFace = new Map(out.map(f => [f.face, f]));
  for (const f of out) for (const w of f.rising) {
    const g = byFace.get(w); if (!g || g === f || !g.rising.includes(f.face) || !byFace.has(f.face)) continue;
    const [keep, drop] = f.depth < g.depth - 1e-9 || (Math.abs(f.depth - g.depth) <= 1e-9 && f.dir < g.dir) ? [f, g] : [g, f];
    keep.also.push(drop.dir, ...drop.also); byFace.delete(drop.face);
  }
  return out.filter(f => byFace.get(f.face) === f);
}
/** A body's bosses: convex exact cylinders standing on a plane facing along their axis. */
function bossesOf(b: BodyResult): { face: string; dir: number; diameter: number; height: number }[] {
  const m = b.mesh, out: { face: string; dir: number; diameter: number; height: number }[] = [];
  for (const f of m.faces) {
    const e = f.exact; if (e?.kind !== 'cylinder') continue;
    const l = Math.hypot(e.a[0], e.a[1], e.a[2]), a = [e.a[0] / l, e.a[1] / l, e.a[2] / l];
    if (concaveSpan(m, f.index, e.c, a) !== null) continue;
    const [lo, hi] = extent(m, f.index, e.c, a);
    for (const s of [1, -1] as const) {
      const at = dot(e.c, a) + (s > 0 ? lo : hi), up = a.map(x => s * x);
      const base = m.faces.find(g => g.exact?.kind === 'plane' && dot(g.exact.n, up) > 1 - 1e-9 && Math.abs(dot(g.exact.o, a) - at) < 1e-6);
      const dir = DIRECTIONS.findIndex(d => dot(d, up) > 1 - 1e-9);
      if (base && dir >= 0) { out.push({ face: f.name, dir, diameter: 2 * e.r, height: hi - lo }); break; }
    }
  }
  return out;
}
/** A hole's setups: the directions it is drilled from — out of each open end along its axis. */
function holeSetups(h: Hole): string[] {
  const k = DIRECTIONS.findIndex(d => Math.abs(dot(d, h.axis)) > 1 - 1e-9); if (k < 0) return [];
  const plus = DIRECTIONS.findIndex(d => dot(d, h.axis) > 1 - 1e-9), minus = DIRECTIONS.findIndex(d => dot(d, h.axis) < -1 + 1e-9);
  return [...(h.open[1] ? [DIRECTION_NAMES[plus]] : []), ...(h.open[0] ? [DIRECTION_NAMES[minus]] : [])];
}

/** The part's machining features, every setup direction, by kind then size. */
export function featuresOf(doc: StudioDoc, bodies: readonly BodyResult[], holes: readonly Hole[] = holesOf(bodies)): Feature[] {
  const out: Omit<Feature, 'id'>[] = [];
  // Floors: one feature per name, normal, level and kind (a face the kernel cut in pieces is one feature).
  const groups = new Map<string, Floor[]>();
  for (const b of bodies) for (const f of floorsOf(b)) { const key = `${f.body}|${f.name}|${f.dir}|${r6(f.level)}|${f.kind}`; const g = groups.get(key); if (g) g.push(f); else groups.set(key, [f]); }
  for (const g of groups.values()) {
    const f0 = g[0], n = DIRECTIONS[f0.dir], all = g.flatMap(f => f.verts), dirs = AXES.filter(u => Math.abs(dot(u, n)) < 1e-9);
    const ext = (u: V) => { const [lo, hi] = span(all, u); return hi - lo; };
    // (A pocket: its narrowest width across its walls, its length the longest extent; a slot: across, and along its free
    // direction; a step: its width out from its wall, its length along it.)
    let width: number, length: number;
    if (f0.kind === 'step') { const w = f0.walled[0] ?? dirs[0], l = dirs.find(u => u !== w) ?? w; width = ext(w); length = ext(l); }
    else { width = narrowest(all, n, u => f0.bounded.some(w => Math.abs(Math.abs(dot(u, w)) - 1) < 1e-9)) ?? Math.min(...dirs.map(ext)); length = f0.kind === 'slot' ? ext(f0.free[0]) : Math.max(...dirs.map(ext)); }
    out.push({ kind: f0.kind, body: f0.body, setups: [...new Set([f0.dir, ...g.flatMap(f => f.also)])].sort((x, y) => x - y).map(d => DIRECTION_NAMES[d]), faces: [...new Set(g.map(f => f.name))], depthMM: r6(f0.depth),
      widthMM: r6(width), lengthMM: r6(length) });
  }
  // Holes (CNC2): the narrowest step drilled; a wider step at an open end, its counterbore; a tapped hole's thread.
  const tapped = tappedHoles(doc, holes);
  for (const h of holes) {
    const s = h.steps[0], cb = h.counterbore ? h.steps.find(x => x !== s) : undefined, t = tapped.find(x => x.faces.some(f => s.faces.includes(f)));
    out.push({ kind: 'hole', body: h.body, setups: holeSetups(h), faces: h.steps.flatMap(x => x.faces), depthMM: r6(Math.max(...h.steps.map(x => x.toMM)) - Math.min(...h.steps.map(x => x.fromMM))), diameterMM: r6(s.diameterMM), through: h.open[0] && h.open[1],
      ...(t ? { thread: t.thread } : {}), ...(cb ? { counterbore: { diameterMM: r6(cb.diameterMM), depthMM: r6(cb.toMM - cb.fromMM) } } : {}) });
  }
  for (const b of bodies) for (const x of bossesOf(b)) out.push({ kind: 'boss', body: b.key, setups: [DIRECTION_NAMES[x.dir]], faces: [x.face], depthMM: r6(x.height), diameterMM: r6(x.diameter) });
  const order: FeatureKind[] = ['pocket', 'slot', 'step', 'hole', 'boss'];
  out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (b.depthMM - a.depthMM) || a.faces[0].localeCompare(b.faces[0]));
  const count = new Map<FeatureKind, number>();
  return out.map(f => { const k = (count.get(f.kind) ?? 0) + 1; count.set(f.kind, k); return { id: `${f.kind}${k}`, ...f }; });
}
