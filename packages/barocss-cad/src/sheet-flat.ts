import type { Brep, BrepCoedge, BrepEdge, BrepFace } from './brep-core.js';
import type { Curve, Point, Surface } from './types.js';
import { curveDomain, evaluateCurve, surfaceDomain } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import { faceGeometry, type FaceGeometry } from './analytic-boolean.js';
import { tessellateBrep } from './brep-tessellate.js';
import { brepMassProperties } from './solid-mass.js';
import type { DxfDocument, DxfEntity } from './dxf-writer.js';
import { lookupBend, type BendTable, type BendTableUse } from './sheet-metal.js';

// R12.2 (D117): a sheet-metal body's flat pattern, from its B-rep and the sheet's thickness T and K-factor alone (D115).
// The skin — the faces joined to a fixed planar face across smooth edges — is developed onto that face's plane: planes
// moved rigidly, a bend (a cylinder) unrolled at its neutral radius (R + K·T). The opposite skin must lie T away and every
// other face meet the skins square (a normal cut); the body's volume must be T times its skin at the middle — else the
// body is no sheet of T, refused by name. The outline is the skin's boundary, walked through the B-rep's own loops.

export type XY = [number, number];
/** A piece of the flat's outline: a line, a circular arc (`ccw` from `start` to `end`), or a planar curve's exact image. */
export type FlatSegment =
  | { readonly kind: 'line'; readonly a: XY; readonly b: XY }
  | { readonly kind: 'arc'; readonly center: XY; readonly radius: number; readonly start: XY; readonly end: XY; readonly ccw: boolean }
  | { readonly kind: 'spline'; readonly degree: number; readonly knots: readonly number[]; readonly control: readonly XY[]; readonly weights: readonly number[] };
/** A closed loop of the outline; `outer` for the boundary, else a hole. `areaMM2`: signed (outer counter-clockwise). */
export interface FlatLoop { readonly outer: boolean; readonly segments: readonly FlatSegment[]; readonly areaMM2: number }
/** A bend in the flat: its strip between its tangent lines, its centre line, which way it folds, its data. */
export interface FlatBend {
  readonly name: string;
  /** `up`: towards the viewer (the flat is seen from the fixed face's outside), `down`: away. */
  readonly direction: 'up' | 'down';
  readonly angleDegrees: number; readonly radiusMM: number; readonly kFactor: number;
  /** The developed width θ(R + K·T). */
  readonly allowanceMM: number;
  readonly centre: readonly [XY, XY]; readonly tangents: readonly [readonly [XY, XY], readonly [XY, XY]];
  readonly faces: readonly string[];
  /** Its K from a bend table (R12.4, D120): the rows used. */
  readonly table?: BendTableUse;
}
export interface FlatPattern {
  /** One K for every bend, or each bend's from a table (then undefined here, each bend's own). */
  readonly thicknessMM: number; readonly kFactor?: number;
  /** The face the flat lies in the plane of (its outside towards the viewer). */
  readonly fixedFace: string;
  readonly loops: readonly FlatLoop[]; readonly bends: readonly FlatBend[];
  /** The flat's area (outer loop less holes) and its box (the flat is moved so its box starts at 0, 0). */
  readonly areaMM2: number; readonly box: { readonly min: XY; readonly max: XY };
}
export type FlatPatternErrorCode = 'NOT_A_SHEET' | 'NON_NORMAL_CUT' | 'BEND_NOT_CYLINDRICAL' | 'FLAT_OVERLAPS' | 'CUT_ACROSS_BEND' | 'BEND_TABLE_MISS';
/** A refusal: its message starts with its `[CODE]`. */
export class FlatPatternError extends Error {
  constructor(readonly code: FlatPatternErrorCode, detail: string) { super(`[${code}] ${detail}`.slice(0, 1024)); this.name = 'FlatPatternError'; }
}
export interface FlatPatternOptions {
  /** One K-factor for every bend, or a bend table giving each bend's by its T, inner R and angle (R12.4): one of them. */
  readonly thicknessMM: number; readonly kFactor?: number; readonly bendTable?: BendTable;
  /** The fixed face by name (its pieces `#k`: the largest); else the largest planar face. */
  readonly fixedFace?: string;
  /** Names for the bends, matched by a face of theirs (the sheet report's: `bend<k>` for others). */
  readonly bendNames?: readonly { readonly name: string; readonly faces: readonly string[] }[];
}

// ---- vectors -----------------------------------------------------------------------------------------------------------
type V = Point;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V): V => scl(a, 1 / len(a));
const baseName = (n: string) => n.replace(/#\d+$/, '');

// ---- a face's development ----------------------------------------------------------------------------------------------
/**
 * Planes: x ↦ o2 + (x − o3)·e1 f1 + (x − o3)·e2 f2. Cylinders: the point's axial coordinate s from p3 along a, its angle φ
 * from the radial d0 turning `sgn` about a; ↦ o2 + s fa + rn φ fx.
 */
type DevMap =
  | { readonly kind: 'plane'; readonly o3: V; readonly e1: V; readonly e2: V; readonly o2: XY; readonly f1: XY; readonly f2: XY }
  | { readonly kind: 'cyl'; readonly c: V; readonly a: V; readonly rho: number; readonly p3: V; readonly d0: V; readonly sgn: number; readonly o2: XY; readonly fa: XY; readonly fx: XY; readonly rn: number; readonly inner: number; readonly k: number; readonly use?: BendTableUse };
function develop(m: DevMap, p: V): XY {
  if (m.kind === 'plane') { const d = sub(p, m.o3), x = dot(d, m.e1), y = dot(d, m.e2); return [m.o2[0] + x * m.f1[0] + y * m.f2[0], m.o2[1] + x * m.f1[1] + y * m.f2[1]]; }
  const s = dot(sub(p, m.p3), m.a), w = m.rn * angleOf(m, p);
  return [m.o2[0] + s * m.fa[0] + w * m.fx[0], m.o2[1] + s * m.fa[1] + w * m.fx[1]];
}
function angleOf(m: Extract<DevMap, { kind: 'cyl' }>, p: V): number {
  const d = sub(p, m.c), r = sub(d, scl(m.a, dot(d, m.a))), l = len(r);
  if (!(l > 0)) return 0;
  return Math.atan2(m.sgn * dot(cross(m.d0, r), m.a) / l, dot(m.d0, r) / l);
}
/** The image of a tangent vector v at p (the development's derivative), not normalised. */
function developTangent(m: DevMap, p: V, v: V): XY {
  if (m.kind === 'plane') { const x = dot(v, m.e1), y = dot(v, m.e2); return [x * m.f1[0] + y * m.f2[0], x * m.f1[1] + y * m.f2[1]]; }
  const d = sub(p, m.c), r = unit(sub(d, scl(m.a, dot(d, m.a)))), t = scl(cross(m.a, r), m.sgn), ax = dot(v, m.a), circ = dot(v, t) * m.rn / m.rho;
  return [ax * m.fa[0] + circ * m.fx[0], ax * m.fa[1] + circ * m.fx[1]];
}
const unit2 = (v: XY): XY => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

/** A face's outward normal at a point on it: planes and cylinders in closed form, any other surface by projection. */
function normalAt(face: BrepFace, g: FaceGeometry, p: V): V | null {
  if (g.kind === 'plane') return g.n;
  if (g.kind === 'cylinder') { const d = sub(p, g.c); return scl(unit(sub(d, scl(g.a, dot(d, g.a)))), g.out); }
  if (face.surface.kind === 'facets') return null;
  return projectedNormal(face.surface, face.sense, p);
}
/** The normal of a parametric surface at its point nearest p: a grid's best, then Newton on (S − p)·Su = (S − p)·Sv = 0. */
function projectedNormal(s: Surface, sense: 'forward' | 'reversed', p: V): V | null {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s);
  let bu = u0, bv = v0, best = Infinity;
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
    const u = u0 + (u1 - u0) * i / 16, v = v0 + (v1 - v0) * j / 16, d = len(sub(evaluateSurfaceD1(s, u, v).point, p));
    if (d < best) { best = d; bu = u; bv = v; }
  }
  for (let k = 0; k < 30; k++) {
    const r = evaluateSurfaceD1(s, bu, bv), e = sub(r.point, p), a = dot(r.du, r.du), b = dot(r.du, r.dv), c = dot(r.dv, r.dv), f = dot(e, r.du), g = dot(e, r.dv), det = a * c - b * b;
    if (!(Math.abs(det) > 0)) break;
    const du = (c * f - b * g) / det, dv = (a * g - b * f) / det;
    bu = Math.min(u1, Math.max(u0, bu - du)); bv = Math.min(v1, Math.max(v0, bv - dv));
    if (Math.abs(du) + Math.abs(dv) < 1e-15) break;
  }
  const r = evaluateSurfaceD1(s, bu, bv), n = cross(r.du, r.dv), l = len(n);
  return l > 0 ? scl(n, (sense === 'forward' ? 1 : -1) / l) : null;
}

/** Points along an edge: n + 1 of them, evenly in its parameter. */
function samples(e: BrepEdge, n: number): V[] {
  const [t0, t1] = curveDomain(e.curve), out: V[] = [];
  for (let k = 0; k <= n; k++) out.push(evaluateCurve(e.curve, t0 + (t1 - t0) * k / n));
  return out;
}

// ---- the flat ----------------------------------------------------------------------------------------------------------
interface Ctx {
  readonly brep: Brep; readonly T: number; readonly K: number; readonly tol: number;
  readonly faces: Map<string, BrepFace>; readonly edges: Map<string, BrepEdge>; readonly co: Map<string, BrepCoedge>; readonly loopsOf: Map<string, readonly string[]>;
  readonly geo: Map<string, FaceGeometry>; readonly usedBy: Map<string, string[]>;
}
const nameOf = (c: Ctx, f: string) => c.faces.get(f)!.name ?? f;

/** The flat pattern of a sheet-metal body (see the top of this file); refusals as FlatPatternError. */
export function flatPattern(brep: Brep, options: FlatPatternOptions): FlatPattern {
  const T = options.thicknessMM, table = options.bendTable ?? null, K = options.kFactor ?? 0.5;
  if ((options.kFactor === undefined) === (table === null)) throw new FlatPatternError('NOT_A_SHEET', 'a flat needs a K-factor or a bend table (one of them)');
  if (!(T > 0) || !(K >= 0 && K <= 1)) throw new FlatPatternError('NOT_A_SHEET', 'a flat needs a thickness above 0 and a K-factor from 0 to 1');
  let size = 1;
  for (const v of brep.vertices) size = Math.max(size, Math.abs(v.point[0]), Math.abs(v.point[1]), Math.abs(v.point[2]));
  const c: Ctx = {
    brep, T, K, tol: 1e-7 * size,
    faces: new Map(brep.faces.map(f => [f.id, f])), edges: new Map(brep.edges.map(e => [e.id, e])), co: new Map(brep.coedges.map(x => [x.id, x])),
    loopsOf: new Map(brep.loops.map(l => [l.id, l.coedges])), geo: new Map(), usedBy: new Map(),
  };
  const faceOfLoop = new Map(brep.loops.map(l => [l.id, l.face]));
  for (const f of brep.faces) {
    if (f.surface.kind === 'facets') throw new FlatPatternError('NOT_A_SHEET', `${f.name ?? f.id} is a mesh face: a flat is made of exact faces`);
    c.geo.set(f.id, faceGeometry(f));
  }
  for (const x of brep.coedges) { const f = faceOfLoop.get(x.loop)!; const l = c.usedBy.get(x.edge); if (l) l.push(f); else c.usedBy.set(x.edge, [f]); }
  if (brep.bodies.length !== 1) throw new FlatPatternError('NOT_A_SHEET', `the body is in ${brep.bodies.length} pieces: a flat is one piece of sheet`);

  const fixed = pickFixed(c, options.fixedFace);
  // (A table: each bend's angle and inner radius found first — they do not depend on K — then its K looked up.)
  const maps = developSkin(c, fixed, table ? kOfBends(c, developSkin(c, fixed, null), table) : null);
  const skin = new Set(maps.keys());
  checkThickness(c, skin);
  // The outline through the B-rep's loops; each piece an exact image.
  const devArea = new Map<string, number>(), loops = outline(c, skin, maps, devArea);
  checkVolume(c, skin, maps, devArea);
  const bends = bendsOf(c, skin, maps, options.bendNames ?? []);
  checkOverlaps(c, skin, maps, loops);
  // Moved so its box starts at 0, 0.
  const box = boxOf(loops), dx = -box.min[0], dy = -box.min[1];
  const moved = loops.map(l => ({ ...l, segments: l.segments.map(s => shift(s, dx, dy)) }));
  const movedBends = bends.map(b => ({ ...b, centre: [sh(b.centre[0], dx, dy), sh(b.centre[1], dx, dy)] as const, tangents: [[sh(b.tangents[0][0], dx, dy), sh(b.tangents[0][1], dx, dy)] as const, [sh(b.tangents[1][0], dx, dy), sh(b.tangents[1][1], dx, dy)] as const] as const }));
  return { thicknessMM: T, ...(table ? {} : { kFactor: K }), fixedFace: nameOf(c, fixed), loops: moved, bends: movedBends, areaMM2: loops.reduce((s, l) => s + l.areaMM2, 0), box: { min: [0, 0], max: [box.max[0] + dx, box.max[1] + dy] } };
}

/** The fixed face: the named one (its largest piece), else the largest planar face. */
function pickFixed(c: Ctx, name: string | undefined): string {
  let best: string | null = null, area = -1;
  for (const f of c.brep.faces) {
    const g = c.geo.get(f.id)!;
    if (g.kind !== 'plane' || (name !== undefined && baseName(f.name ?? f.id) !== baseName(name))) continue;
    const m = planeMap(g.o, g.n), a = Math.abs(faceGreen(c, f.id, m));
    if (a > area + 1e-9 * Math.max(1, a) || (Math.abs(a - area) <= 1e-9 * Math.max(1, a) && best !== null && f.id < best)) { area = a; best = f.id; }
  }
  if (best === null) throw new FlatPatternError('NOT_A_SHEET', name !== undefined ? `no planar face ${name} to lay the flat in` : 'no planar face to lay the flat in');
  return best;
}
/** A plane's map onto itself: its first axis world X in the plane (else Y), the second n × first, so seen from outside. */
function planeMap(o: V, n: V): DevMap {
  let e1 = sub([1, 0, 0], scl(n, n[0]));
  if (len(e1) < 0.5) e1 = sub([0, 1, 0], scl(n, n[1]));
  e1 = unit(e1);
  return { kind: 'plane', o3: o, e1, e2: cross(n, e1), o2: [0, 0], f1: [1, 0], f2: [0, 1] };
}

/** Whether two faces meet smoothly along an edge: their outward normals agree at its quarter points. */
function smoothAcross(c: Ctx, f: string, g: string, e: BrepEdge): boolean {
  const ff = c.faces.get(f)!, gf = c.faces.get(g)!, gf_ = c.geo.get(g)!, ff_ = c.geo.get(f)!;
  for (const p of samples(e, 4).slice(1, 4)) {
    const a = normalAt(ff, ff_, p), b = normalAt(gf, gf_, p);
    if (!a || !b || dot(a, b) < 1 - 1e-9) return false;
  }
  return true;
}
/** Whether an edge is straight (its samples on the chord): its ends, or null. */
function straight(c: Ctx, e: BrepEdge): [V, V] | null {
  const ps = samples(e, 8), a = ps[0], b = ps[8], d = sub(b, a), l = len(d);
  if (!(l > c.tol)) return null;
  for (const p of ps) { const q = sub(p, a); if (len(sub(q, scl(d, dot(q, d) / (l * l)))) > c.tol) return null; }
  return [a, b];
}

/** A bend's K and the table's rows, looked up by the bend (its cylinder): from `kOfBends`. */
type KOf = (g: Extract<FaceGeometry, { kind: 'cylinder' }>) => { k: number; use?: BendTableUse };
/** Whether two cylinders are one (axis and radius). */
const sameCylinder = (c: Ctx, a: { c: V; a: V; r?: number; rho?: number }, b: { c: V; a: V; r?: number; rho?: number }) => Math.abs((a.r ?? a.rho!) - (b.r ?? b.rho!)) <= c.tol && Math.abs(Math.abs(dot(a.a, b.a)) - 1) < 1e-12 && len(cross(sub(b.c, a.c), a.a)) <= c.tol;
/** Each bend's K from a table by its T, inner radius and angle (its pieces' widest turn); a bend outside it refused. */
function kOfBends(c: Ctx, maps: Map<string, DevMap>, table: BendTable): KOf {
  const groups: { m: Extract<DevMap, { kind: 'cyl' }>; theta: number; k?: { k: number; use?: BendTableUse } }[] = [];
  for (const [f, m] of maps) {
    if (m.kind !== 'cyl') continue;
    let lo = Infinity, hi = -Infinity;
    for (const lid of c.faces.get(f)!.loops) for (const cid of c.loopsOf.get(lid)!) for (const p of samples(c.edges.get(c.co.get(cid)!.edge)!, 4)) { const a = angleOf(m, p); lo = Math.min(lo, a); hi = Math.max(hi, a); }
    const g = groups.find(x => sameCylinder(c, x.m, m));
    if (g) g.theta = Math.max(g.theta, hi - lo); else groups.push({ m, theta: hi - lo });
  }
  for (const g of groups) {
    const r = lookupBend(table, c.T, g.m.inner, g.theta);
    if ('miss' in r) throw new FlatPatternError('BEND_TABLE_MISS', `a bend of R ${fmt(g.m.inner)} mm, ${fmt(g.theta * 180 / Math.PI)}°: ${r.miss}`);
    g.k = { k: r.kFactor, use: r.use };
  }
  return gc => { const g = groups.find(x => sameCylinder(c, x.m, gc)); if (!g) throw new FlatPatternError('NOT_A_SHEET', 'a bend was not found again'); return g.k!; };
}
/** The skin from the fixed face across smooth edges, each face's development (each bend's K from `kOf`, else the flat's). */
function developSkin(c: Ctx, fixed: string, kOf: KOf | null): Map<string, DevMap> {
  const g0 = c.geo.get(fixed)! as Extract<FaceGeometry, { kind: 'plane' }>, maps = new Map<string, DevMap>([[fixed, planeMap(g0.o, g0.n)]]), queue = [fixed];
  while (queue.length) {
    const fid = queue.shift()!, m = maps.get(fid)!, gF = c.geo.get(fid)!;
    for (const lid of c.faces.get(fid)!.loops) for (const cid of c.loopsOf.get(lid)!) {
      const e = c.edges.get(c.co.get(cid)!.edge)!, other = c.usedBy.get(e.id)!.find(f => f !== fid);
      if (other === undefined || maps.has(other) || !smoothAcross(c, fid, other, e)) continue;
      const gO = c.geo.get(other)!;
      if (gO.kind === 'other') throw new FlatPatternError('BEND_NOT_CYLINDRICAL', `${nameOf(c, other)} continues the sheet smoothly but is not a plane or a cylinder: only cylindrical bends unfold`);
      // Coplanar pieces and pieces of one cylinder share a development.
      if (gF.kind === 'plane' && gO.kind === 'plane') { maps.set(other, m); queue.push(other); continue; }
      if (gF.kind === 'cylinder' && gO.kind === 'cylinder' && Math.abs(gF.r - gO.r) <= c.tol && Math.abs(Math.abs(dot(gF.a, gO.a)) - 1) < 1e-12 && len(cross(sub(gO.c, gF.c), gF.a)) <= c.tol) { maps.set(other, m); queue.push(other); continue; }
      const line = straight(c, e);
      if (!line) throw new FlatPatternError('NOT_A_SHEET', `${nameOf(c, fid)} and ${nameOf(c, other)} meet smoothly along a curve: the skin's faces meet along straight tangent lines`);
      const [A, B] = line, u = unit(sub(B, A));
      // Into the face we come from, square to the edge, in its tangent plane: t_in; the next face goes on the other way.
      const n1 = normalAt(c.faces.get(fid)!, gF, A)!;
      let tin = cross(n1, u);
      if (dot(sub(faceInner(c, fid, A, u), A), tin) < 0) tin = scl(tin, -1);
      const tout = scl(tin, -1), a2 = develop(m, A), u2 = unit2(developTangent(m, A, u)), x2i = unit2(developTangent(m, A, tin)), x2: XY = [-x2i[0], -x2i[1]];
      if (gO.kind === 'plane') maps.set(other, { kind: 'plane', o3: A, e1: u, e2: tout, o2: a2, f1: u2, f2: x2 });
      else {
        const a = dot(gO.a, u) > 0 ? gO.a : scl(gO.a, -1), d = sub(A, gO.c), d0 = unit(sub(d, scl(gO.a, dot(d, gO.a))));
        const inner = gO.out === 1 ? gO.r - c.T : gO.r, kk = kOf ? kOf(gO) : { k: c.K }, rn = inner + kk.k * c.T;
        const sgn = Math.sign(dot(cross(d0, tout), a)) || 1;
        if (!(inner > 0)) throw new FlatPatternError('NOT_A_SHEET', `${nameOf(c, other)}: a bend of radius ${fmt(gO.r)} is tighter than the sheet is thick`);
        maps.set(other, { kind: 'cyl', c: gO.c, a, rho: gO.r, p3: A, d0, sgn, o2: a2, fa: u2, fx: x2, rn, inner, k: kk.k, ...(kk.use ? { use: kk.use } : {}) });
      }
      queue.push(other);
    }
  }
  return maps;
}
/** A point of the face a little way in from a point of its edge (the face's other edges' middles, on its side of the edge). */
function faceInner(c: Ctx, fid: string, A: V, u: V): V {
  // The middles of its outer loop's edges, the one farthest from the edge's line.
  let best = A, far = -1;
  for (const cid of c.loopsOf.get(c.faces.get(fid)!.loops[0])!) {
    const e = c.edges.get(c.co.get(cid)!.edge)!, [t0, t1] = curveDomain(e.curve), p = evaluateCurve(e.curve, (t0 + t1) / 2), q = sub(p, A), d = len(sub(q, scl(u, dot(q, u))));
    if (d > far) { far = d; best = p; }
  }
  return best;
}

/**
 * The opposite skin T away, the rest square to the skins. A face of neither skin is a side face: it meets every skin face
 * it touches at right angles (a normal cut), else NON_NORMAL_CUT; one touching no skin, NOT_A_SHEET.
 */
function checkThickness(c: Ctx, skin: Set<string>): void {
  const other = new Set<string>();
  for (const f of c.brep.faces) {
    if (skin.has(f.id)) continue;
    const g = c.geo.get(f.id)!;
    let opposite = false;
    for (const a of skin) {
      const h = c.geo.get(a)!;
      if (g.kind === 'plane' && h.kind === 'plane' && dot(g.n, h.n) < -1 + 1e-12 && Math.abs(dot(sub(g.o, h.o), h.n) + c.T) <= c.tol) { opposite = true; break; }
      if (g.kind === 'cylinder' && h.kind === 'cylinder' && Math.abs(Math.abs(dot(g.a, h.a)) - 1) < 1e-12 && len(cross(sub(g.c, h.c), h.a)) <= c.tol && g.out === -h.out && Math.abs(g.r - (h.out === 1 ? h.r - c.T : h.r + c.T)) <= c.tol) { opposite = true; break; }
    }
    if (!opposite) other.add(f.id);
  }
  for (const fid of other) {
    let touches = false, off: { s: string; deg: number } | null = null;
    for (const lid of c.faces.get(fid)!.loops) for (const cid of c.loopsOf.get(lid)!) {
      const e = c.edges.get(c.co.get(cid)!.edge)!;
      for (const s of c.usedBy.get(e.id)!) {
        if (s === fid || other.has(s)) continue;
        touches = true;
        const F = c.faces.get(fid)!, S = c.faces.get(s)!;
        for (const p of samples(e, 4).slice(1, 4)) {
          const a = normalAt(F, c.geo.get(fid)!, p), b = normalAt(S, c.geo.get(s)!, p);
          if (!off && (!a || !b || Math.abs(dot(a, b)) > 1e-7)) off = { s, deg: a && b ? Math.asin(Math.min(1, Math.abs(dot(a, b)))) * 180 / Math.PI : NaN };
        }
      }
    }
    if (touches && !off) continue;
    // A face facing a skin face across the sheet, at another distance: the sheet is not T thick there.
    const g = c.geo.get(fid)!;
    // One in a skin face's own plane, not reached: a piece of the skin cut off from it (held at a point or along a thin).
    if (g.kind === 'plane') for (const a of skin) {
      const h = c.geo.get(a)!;
      if (h.kind === 'plane' && dot(g.n, h.n) > 1 - 1e-12 && Math.abs(dot(sub(g.o, h.o), h.n)) <= c.tol) throw new FlatPatternError('NOT_A_SHEET', `${nameOf(c, fid)} lies in the skin's plane but is cut off from it (held only at a point): a sliver left between cuts`);
    }
    if (g.kind === 'plane') for (const a of skin) {
      const h = c.geo.get(a)!;
      if (h.kind === 'plane' && dot(g.n, h.n) < -1 + 1e-12) throw new FlatPatternError('NOT_A_SHEET', `${nameOf(c, fid)} lies ${fmt(-dot(sub(g.o, h.o), h.n))} mm from the skin face ${nameOf(c, a)}, not the sheet's ${fmt(c.T)} mm`);
    }
    if (off) throw new FlatPatternError('NON_NORMAL_CUT', `${nameOf(c, fid)} meets the sheet's face ${nameOf(c, off.s)} ${Number.isFinite(off.deg) ? fmt(off.deg) + '° ' : ''}off square: only cuts square to the sheet unfold`);
    throw new FlatPatternError('NOT_A_SHEET', `${nameOf(c, fid)} is neither on the sheet's skins nor a cut through it`);
  }
}

/** The body's volume against T times its skin at the middle: planes' area, bends' at R + T/2 (their developed area at R + K·T scaled). */
function checkVolume(c: Ctx, skin: Set<string>, maps: Map<string, DevMap>, devArea: Map<string, number>): void {
  let want = 0;
  for (const f of skin) {
    const m = maps.get(f)!, a = Math.abs(devArea.get(f) ?? 0);
    if (m.kind === 'plane') want += c.T * a;
    else want += c.T * a * (m.inner + c.T / 2) / m.rn;
  }
  const V = brepMassProperties(c.brep, 1).volumeMM3;
  if (!(Math.abs(V - want) <= 1e-7 * Math.max(Math.abs(V), 1))) throw new FlatPatternError('NOT_A_SHEET', `the body is not a sheet ${fmt(c.T)} mm thick: its volume ${fmt(V)} mm³ against ${fmt(want)} mm³ for its skin`);
}

// ---- the outline -------------------------------------------------------------------------------------------------------
/** Each coedge of a skin face as an image, and the skin's boundary walked into loops. `devArea`: each face's developed area. */
function outline(c: Ctx, skin: Set<string>, maps: Map<string, DevMap>, devArea: Map<string, number>): FlatLoop[] {
  const image = new Map<string, FlatSegment>();
  for (const f of skin) {
    let area = 0;
    for (const lid of c.faces.get(f)!.loops) for (const cid of c.loopsOf.get(lid)!) {
      const x = c.co.get(cid)!, s = imageOf(c, f, maps.get(f)!, c.edges.get(x.edge)!, x.sense);
      image.set(cid, s); area += green(s);
    }
    devArea.set(f, area);
  }
  const seen = new Set<string>(), loops: FlatLoop[] = [];
  for (const start of image.keys()) {
    if (seen.has(start) || internal(c, skin, start)) continue;
    const segs: FlatSegment[] = [];
    let cid = start;
    for (let guard = 0; guard < 100000; guard++) {
      seen.add(cid); segs.push(image.get(cid)!);
      let next = c.co.get(cid)!.next;
      while (internal(c, skin, next)) next = c.co.get(c.co.get(next)!.twin!)!.next;
      cid = next;
      if (cid === start) break;
      if (seen.has(cid)) throw new FlatPatternError('NOT_A_SHEET', 'the skin\'s boundary does not close into loops');
    }
    const merged = mergeRuns(segs, c.tol);
    loops.push({ outer: false, segments: merged, areaMM2: merged.reduce((s, x) => s + green(x), 0) });
  }
  let big = 0;
  loops.forEach((l, i) => { if (Math.abs(l.areaMM2) > Math.abs(loops[big].areaMM2)) big = i; });
  if (!loops.length || !(loops[big].areaMM2 > 0)) throw new FlatPatternError('NOT_A_SHEET', 'the developed skin has no outer boundary');
  return loops.map((l, i) => ({ ...l, outer: i === big }));
}
/** Whether a coedge's edge lies between two skin faces (inside the flat, not on its outline). */
function internal(c: Ctx, skin: Set<string>, cid: string): boolean {
  const x = c.co.get(cid)!, faces = c.usedBy.get(x.edge)!;
  return x.twin !== null && faces.length === 2 && skin.has(faces[0]) && skin.has(faces[1]);
}
/** The image of an edge use on a skin face: a line, an arc, or (on a plane) the curve's exact image; on a bend, lines only. */
function imageOf(c: Ctx, fid: string, m: DevMap, e: BrepEdge, sense: 'forward' | 'reversed'): FlatSegment {
  const ps = samples(e, 8).map(p => develop(m, p));
  if (sense === 'reversed') ps.reverse();
  const a = ps[0], b = ps[8], d: XY = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]);
  const offLine = (p: XY) => Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / l;
  if (l > c.tol && ps.every(p => offLine(p) <= c.tol)) return { kind: 'line', a, b };
  if (m.kind === 'cyl') throw new FlatPatternError('CUT_ACROSS_BEND', `${nameOf(c, fid)}: a cut runs across the bend (its edge develops to a curve): not supported yet`);
  // A circle through the start, middle and end, all the samples on it: an arc (closed: a full circle).
  const mid = ps[4], closed = l <= c.tol, q = closed ? ps[2] : mid, r2 = closed ? ps[6] : b;
  const cen = circumcentre(a, q, r2);
  if (cen) {
    const R = Math.hypot(a[0] - cen[0], a[1] - cen[1]);
    if (ps.every(p => Math.abs(Math.hypot(p[0] - cen[0], p[1] - cen[1]) - R) <= c.tol)) {
      const ccw = (ps[1][0] - a[0]) * (ps[2][1] - a[1]) - (ps[1][1] - a[1]) * (ps[2][0] - a[0]) > 0;
      return { kind: 'arc', center: cen, radius: R, start: a, end: closed ? a : b, ccw };
    }
  }
  // Any other planar curve: its exact image (the plane's map is affine), reversed for a reversed use.
  const k = e.curve, map = (p: V) => develop(m, p);
  const control = k.controlPoints.map(map), knots = [...k.knots], weights = [...k.weights];
  if (sense === 'reversed') { const lo = knots[0], hi = knots[knots.length - 1]; return { kind: 'spline', degree: k.degree, knots: knots.map(t => lo + hi - t).reverse(), control: control.reverse(), weights: weights.reverse() }; }
  return { kind: 'spline', degree: k.degree, knots, control, weights };
}
function circumcentre(a: XY, b: XY, c: XY): XY | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-300) return null;
  const qa = a[0] * a[0] + a[1] * a[1], qb = b[0] * b[0] + b[1] * b[1], qc = c[0] * c[0] + c[1] * c[1];
  return [(qa * (b[1] - c[1]) + qb * (c[1] - a[1]) + qc * (a[1] - b[1])) / d, (qa * (c[0] - b[0]) + qb * (a[0] - c[0]) + qc * (b[0] - a[0])) / d];
}
/** An arc's signed sweep (radians, counter-clockwise positive); a closed arc a full turn. */
export function arcSweep(s: Extract<FlatSegment, { kind: 'arc' }>): number {
  const a0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]), a1 = Math.atan2(s.end[1] - s.center[1], s.end[0] - s.center[0]);
  let sw = a1 - a0;
  if (s.ccw) { while (sw <= 1e-15) sw += 2 * Math.PI; } else { while (sw >= -1e-15) sw -= 2 * Math.PI; }
  return sw;
}
/** ∮ x dy along a segment: lines and arcs in closed form, a spline by Gauss–Legendre on each span. */
function green(s: FlatSegment): number {
  if (s.kind === 'line') return (s.a[0] + s.b[0]) / 2 * (s.b[1] - s.a[1]);
  if (s.kind === 'arc') {
    const t0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]), t1 = t0 + arcSweep(s), r = s.radius, cx = s.center[0];
    return cx * r * (Math.sin(t1) - Math.sin(t0)) + r * r / 2 * (t1 - t0 + (Math.sin(2 * t1) - Math.sin(2 * t0)) / 2);
  }
  const k = splineCurve(s), knots = [...new Set(s.knots)];
  let I = 0;
  for (let i = 0; i + 1 < knots.length; i++) {
    const lo = knots[i], hi = knots[i + 1];
    if (!(hi > lo)) continue;
    for (let j = 0; j < 16; j++) {
      const a = lo + (hi - lo) * j / 16, b = lo + (hi - lo) * (j + 1) / 16;
      for (let g = 0; g < GL.length; g += 2) { const t = (a + b) / 2 + (b - a) / 2 * GL[g], r = evaluateCurveD1(k, t); I += GL[g + 1] * (b - a) / 2 * r.point[0] * r.derivative[1]; }
    }
  }
  return I;
}
const GL = [-0.906179845938664, 0.2369268850561891, -0.5384693101056831, 0.4786286704993665, 0, 0.5688888888888889, 0.5384693101056831, 0.4786286704993665, 0.906179845938664, 0.2369268850561891];
const splineCurve = (s: Extract<FlatSegment, { kind: 'spline' }>): Curve => ({ kind: 'curve', id: 'flat', degree: s.degree, knots: [...s.knots], controlPoints: s.control.map(p => [p[0], p[1], 0] as Point), weights: [...s.weights] });
/** Consecutive collinear lines and arcs of one circle (turning the same way) joined. */
function mergeRuns(segs: readonly FlatSegment[], tol: number): FlatSegment[] {
  const out: FlatSegment[] = [];
  for (const s of segs) {
    const joined = out.length ? joinRun(out[out.length - 1], s, tol) : null;
    if (joined) out[out.length - 1] = joined; else out.push(s);
  }
  // (The loop's last and first runs too.)
  if (out.length > 1) { const joined = joinRun(out[out.length - 1], out[0], tol); if (joined) { out[0] = joined; out.pop(); } }
  return out;
}
/** Two consecutive pieces as one: collinear lines going on, or arcs of one circle turning the same way; else null. */
function joinRun(p: FlatSegment, s: FlatSegment, tol: number): FlatSegment | null {
  if (p.kind === 'line' && s.kind === 'line') {
    const d: XY = [p.b[0] - p.a[0], p.b[1] - p.a[1]], l = Math.hypot(d[0], d[1]), e: XY = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
    return Math.abs(d[0] * e[1] - d[1] * e[0]) / l <= tol && d[0] * e[0] + d[1] * e[1] > 0 ? { kind: 'line', a: p.a, b: s.b } : null;
  }
  if (p.kind === 'arc' && s.kind === 'arc' && p.ccw === s.ccw && Math.hypot(p.center[0] - s.center[0], p.center[1] - s.center[1]) <= tol && Math.abs(p.radius - s.radius) <= tol) {
    // (Closing the circle: a full circle, its end its start.)
    const total = Math.abs(arcSweep(p) + arcSweep(s));
    if (total < 2 * Math.PI - 1e-9) return { ...p, end: s.end };
    if (total < 2 * Math.PI + 1e-9 && Math.hypot(s.end[0] - p.start[0], s.end[1] - p.start[1]) <= tol) return { ...p, end: p.start };
  }
  return null;
}

// ---- bends -------------------------------------------------------------------------------------------------------------
function bendsOf(c: Ctx, skin: Set<string>, maps: Map<string, DevMap>, names: readonly { readonly name: string; readonly faces: readonly string[] }[]): FlatBend[] {
  // A bend: the skin's pieces of one cylinder (its axis and radius), however they were reached.
  const groups: { m: Extract<DevMap, { kind: 'cyl' }>; faces: string[] }[] = [];
  for (const f of skin) {
    const m = maps.get(f)!;
    if (m.kind !== 'cyl') continue;
    const g = groups.find(x => Math.abs(x.m.rho - m.rho) <= c.tol && Math.abs(Math.abs(dot(x.m.a, m.a)) - 1) < 1e-12 && len(cross(sub(m.c, x.m.c), x.m.a)) <= c.tol);
    if (g) g.faces.push(f); else groups.push({ m, faces: [f] });
  }
  const out: FlatBend[] = [];
  let k = 0;
  for (const { m, faces } of groups) {
    let s0 = Infinity, s1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (const f of faces) for (const lid of c.faces.get(f)!.loops) for (const cid of c.loopsOf.get(lid)!) for (const p of samples(c.edges.get(c.co.get(cid)!.edge)!, 4)) {
      const q = develop(maps.get(f)!, p), s = (q[0] - m.o2[0]) * m.fa[0] + (q[1] - m.o2[1]) * m.fa[1], w = (q[0] - m.o2[0]) * m.fx[0] + (q[1] - m.o2[1]) * m.fx[1];
      s0 = Math.min(s0, s); s1 = Math.max(s1, s); w0 = Math.min(w0, w); w1 = Math.max(w1, w);
    }
    const theta = (w1 - w0) / m.rn, inner = m.inner, names_ = faces.map(f => baseName(nameOf(c, f)));
    const g = c.geo.get(faces[0])! as Extract<FaceGeometry, { kind: 'cylinder' }>;
    const named = names.find(b => b.faces.some(x => names_.includes(baseName(x))));
    k++;
    out.push({ name: named?.name ?? `bend${k}`, direction: g.out === 1 ? 'down' : 'up', angleDegrees: theta * 180 / Math.PI, radiusMM: inner, kFactor: m.k, ...(m.use ? { table: m.use } : {}), allowanceMM: theta * m.rn,
      centre: [devAt(m, s0, (w0 + w1) / 2), devAt(m, s1, (w0 + w1) / 2)], tangents: [[devAt(m, s0, w0), devAt(m, s1, w0)], [devAt(m, s0, w1), devAt(m, s1, w1)]], faces: [...new Set(names_)].sort() });
  }
  return out;
}

/** The grid cells a piece's box covers. */
function cellsOf(a: XY, b: XY, min: XY, W: number, G: number): number[] {
  const i0 = Math.floor((Math.min(a[0], b[0]) - min[0]) / W), i1 = Math.floor((Math.max(a[0], b[0]) - min[0]) / W), j0 = Math.floor((Math.min(a[1], b[1]) - min[1]) / W), j1 = Math.floor((Math.max(a[1], b[1]) - min[1]) / W), out: number[] = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push(i * (G + 2) + j);
  return out;
}
/** The flat's point at axial s and developed width w of a bend's development. */
const devAt = (m: Extract<DevMap, { kind: 'cyl' }>, s: number, w: number): XY => [m.o2[0] + s * m.fa[0] + w * m.fx[0], m.o2[1] + s * m.fa[1] + w * m.fx[1]];

// ---- overlaps ----------------------------------------------------------------------------------------------------------
/**
 * The flat must not cover itself: no two pieces of its outline cross (touching at a point is allowed), and a point inside
 * each skin face, developed, lies inside the outline once (twice: two faces landed on one place).
 */
function checkOverlaps(c: Ctx, skin: Set<string>, maps: Map<string, DevMap>, loops: readonly FlatLoop[]): void {
  const polys = loops.map(l => polyline(l.segments));
  const pieces: { loop: number; i: number; a: XY; b: XY }[] = [];
  polys.forEach((p, li) => { for (let i = 0; i + 1 < p.length; i++) pieces.push({ loop: li, i, a: p[i], b: p[i + 1] }); });
  const n = pieces.length, eps = 1e-9, box = boxOf(loops), G = Math.max(1, Math.ceil(Math.sqrt(n))), W = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1]) / G + 1e-9;
  // (A uniform grid over the flat: each piece tested against those sharing a cell with it, each pair once.)
  const cells = new Map<number, number[]>(), lastSeen = new Int32Array(n).fill(-1);
  const pieceCells = pieces.map(P => cellsOf(P.a, P.b, box.min, W, G));
  pieceCells.forEach((cs, x) => { for (const k of cs) { const l = cells.get(k); if (l) l.push(x); else cells.set(k, [x]); } });
  for (let x = 0; x < n; x++) for (const k of pieceCells[x]) for (const y of cells.get(k)!) {
    if (y <= x || lastSeen[y] === x) continue;
    lastSeen[y] = x;
    const P = pieces[x], Q = pieces[y];
    if (P.loop === Q.loop) { const m = polys[P.loop].length - 1; if (Q.i - P.i === 1 || (P.i === 0 && Q.i === m - 1)) continue; }
    const r: XY = [P.b[0] - P.a[0], P.b[1] - P.a[1]], s: XY = [Q.b[0] - Q.a[0], Q.b[1] - Q.a[1]], den = r[0] * s[1] - r[1] * s[0], q: XY = [Q.a[0] - P.a[0], Q.a[1] - P.a[1]];
    const lr = Math.hypot(r[0], r[1]), ls = Math.hypot(s[0], s[1]);
    if (Math.abs(den) <= 1e-12 * lr * ls) {
      // Parallel: an overlap of some length along one line.
      if (Math.abs(q[0] * r[1] - q[1] * r[0]) / lr > c.tol) continue;
      const t0 = (q[0] * r[0] + q[1] * r[1]) / (lr * lr), t1 = ((Q.b[0] - P.a[0]) * r[0] + (Q.b[1] - P.a[1]) * r[1]) / (lr * lr);
      if (Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > c.tol / lr) throw overlap(P.a);
      continue;
    }
    const t = (q[0] * s[1] - q[1] * s[0]) / den, u = (q[0] * r[1] - q[1] * r[0]) / den;
    if (t > eps && t < 1 - eps && u > eps && u < 1 - eps) throw overlap([P.a[0] + r[0] * t, P.a[1] + r[1] * t]);
  }
  const mesh = tessellateBrep(c.brep, { segmentsPerQuarter: 4 });
  for (const mf of mesh.faces) {
    if (!skin.has(mf.faceId) || !mf.indexCount) continue;
    // Its largest triangle's centre.
    let best = -1, at: V = [0, 0, 0];
    for (let t = mf.indexOffset; t < mf.indexOffset + mf.indexCount; t += 3) {
      const p = [0, 1, 2].map(k => { const i = 3 * mesh.indices[t + k]; return [mesh.positionsMM[i], mesh.positionsMM[i + 1], mesh.positionsMM[i + 2]] as V; });
      const a = len(cross(sub(p[1], p[0]), sub(p[2], p[0])));
      if (a > best) { best = a; at = scl(add(add(p[0], p[1]), p[2]), 1 / 3); }
    }
    const q = develop(maps.get(mf.faceId)!, at), w = polys.reduce((s, p) => s + winding(p, q), 0);
    if (Math.round(w) >= 2) throw overlap(q);
  }
}
const overlap = (p: XY) => new FlatPatternError('FLAT_OVERLAPS', `the flat covers itself near (${fmt(p[0])}, ${fmt(p[1])}): the sheet cannot be cut in one piece and folded`);
/** A loop as points (arcs and splines finely sampled), closed. */
function polyline(segs: readonly FlatSegment[]): XY[] {
  const out: XY[] = [];
  for (const s of segs) {
    if (s.kind === 'line') { out.push(s.a); continue; }
    if (s.kind === 'arc') { const sw = arcSweep(s), n = Math.max(2, Math.ceil(Math.abs(sw) / (Math.PI / 64))), t0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]); for (let k = 0; k < n; k++) out.push([s.center[0] + s.radius * Math.cos(t0 + sw * k / n), s.center[1] + s.radius * Math.sin(t0 + sw * k / n)]); continue; }
    const k = splineCurve(s), [t0, t1] = curveDomain(k), n = 64 * Math.max(1, new Set(s.knots).size - 1);
    for (let i = 0; i < n; i++) { const p = evaluateCurve(k, t0 + (t1 - t0) * i / n); out.push([p[0], p[1]]); }
  }
  out.push(out[0]);
  return out;
}
function winding(p: readonly XY[], q: XY): number {
  let w = 0;
  for (let i = 0; i + 1 < p.length; i++) {
    const a0 = Math.atan2(p[i][1] - q[1], p[i][0] - q[0]), a1 = Math.atan2(p[i + 1][1] - q[1], p[i + 1][0] - q[0]);
    let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; w += d;
  }
  return w / (2 * Math.PI);
}

// ---- moving, boxes, numbers --------------------------------------------------------------------------------------------
const sh = (p: XY, dx: number, dy: number): XY => [p[0] + dx, p[1] + dy];
function shift(s: FlatSegment, dx: number, dy: number): FlatSegment {
  if (s.kind === 'line') return { kind: 'line', a: sh(s.a, dx, dy), b: sh(s.b, dx, dy) };
  if (s.kind === 'arc') return { ...s, center: sh(s.center, dx, dy), start: sh(s.start, dx, dy), end: sh(s.end, dx, dy) };
  return { ...s, control: s.control.map(p => sh(p, dx, dy)) };
}
function boxOf(loops: readonly FlatLoop[]): { min: XY; max: XY } {
  const min: XY = [Infinity, Infinity], max: XY = [-Infinity, -Infinity];
  for (const l of loops) for (const p of polyline(l.segments)) { min[0] = Math.min(min[0], p[0]); min[1] = Math.min(min[1], p[1]); max[0] = Math.max(max[0], p[0]); max[1] = Math.max(max[1], p[1]); }
  return { min, max };
}
const fmt = (x: number) => String(+x.toFixed(6));
/** The Green integral of one face's developed loops (its developed area, signed). */
function faceGreen(c: Ctx, fid: string, m: DevMap): number {
  let a = 0;
  for (const lid of c.faces.get(fid)!.loops) for (const cid of c.loopsOf.get(lid)!) { const x = c.co.get(cid)!; a += green(imageOf(c, fid, m, c.edges.get(x.edge)!, x.sense)); }
  return a;
}

// ---- DXF ---------------------------------------------------------------------------------------------------------------
/**
 * The flat as a DXF document for the writer (R11b): its outline on OUTLINE, each bend's centre line on BEND_UP or
 * BEND_DOWN (dashed), and a note at its middle on BEND_NOTES (`UP 90° R1.5`), in mm.
 */
export function flatPatternDxf(flat: FlatPattern, options: { readonly textHeightMM?: number } = {}): DxfDocument {
  const entities: DxfEntity[] = [], h = options.textHeightMM ?? 2.5;
  for (const l of flat.loops) for (const s of l.segments) {
    if (s.kind === 'line') entities.push({ type: 'line', a: s.a, b: s.b, layer: 'OUTLINE' });
    else if (s.kind === 'arc') {
      const deg = (p: XY) => Math.atan2(p[1] - s.center[1], p[0] - s.center[0]) * 180 / Math.PI, closed = Math.hypot(s.start[0] - s.end[0], s.start[1] - s.end[1]) === 0;
      if (closed) entities.push({ type: 'circle', center: s.center, radius: s.radius, layer: 'OUTLINE' });
      else { const [a, b] = s.ccw ? [s.start, s.end] : [s.end, s.start]; entities.push({ type: 'arc', center: s.center, radius: s.radius, startDeg: norm360(deg(a)), endDeg: norm360(deg(b)), layer: 'OUTLINE' }); }
    } else entities.push({ type: 'spline', degree: s.degree, knots: s.knots, control: s.control, ...(s.weights.every(w => w === 1) ? {} : { weights: s.weights }), layer: 'OUTLINE' });
  }
  for (const b of flat.bends) {
    const layer = b.direction === 'up' ? 'BEND_UP' : 'BEND_DOWN', [p, q] = b.centre, mid: XY = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    entities.push({ type: 'line', a: p, b: q, layer });
    let ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
    if (ang > 90.000001 || ang <= -90) ang = ang > 0 ? ang - 180 : ang + 180;
    entities.push({ type: 'text', at: mid, height: h, text: `${b.direction.toUpperCase()} ${+b.angleDegrees.toFixed(2)}° R${+b.radiusMM.toFixed(3)}`, rotationDeg: +ang.toFixed(9), align: 'center', layer: 'BEND_NOTES' });
  }
  return {
    units: 'mm',
    layers: [{ name: 'OUTLINE', color: 7 }, { name: 'BEND_UP', color: 3, linetype: 'DASHED' }, { name: 'BEND_DOWN', color: 1, linetype: 'DASHED' }, { name: 'BEND_NOTES', color: 2 }],
    linetypes: [{ name: 'DASHED', description: 'Dashed __ __ __', pattern: [5, -2.5] }],
    entities,
  };
}
const norm360 = (d: number) => { const x = ((d % 360) + 360) % 360; return Math.abs(x - 360) < 1e-9 ? 0 : +x.toFixed(12); };
