// Prismatic solids: stacks of Z slabs, each a set of line + arc regions (brep-core step 5).
// Every face of such a solid is a horizontal plane, a vertical plane or a vertical cylinder, so
// Booleans reduce exactly to slab-wise 2D Booleans of the sections (curved-arrangement), and the
// solid becomes a B-rep with curved faces and pcurves:
//
//   1. levels       every distinct slab bottom / top height; at each level the section below and
//                   the section above are arranged together, and all their vertices form one global
//                   point set
//   2. pieces       every ring is split at every global point lying on it, so each boundary piece
//                   is shared exactly by the faces meeting along it (one canonical curve per piece)
//   3. faces        walls: one face per piece per vertical run of slabs that carry it, on the piece's
//                   vertical extrusion; caps: up faces (below − above) and down faces (above − below)
//   4. topology     edges used by four faces (two solids touching along a horizontal line) are split
//                   into two wedges; vertices are split per disc of faces; vertical edges meeting only
//                   each other are joined; components become shells; negative shells are cavities of
//                   the smallest shell around them
//
// Persistent names: ring segments carry tags (kept through every 2D Boolean) that name the walls on
// them, and a solid carries its cap sources (the authored tops and bottoms) that name the caps. Face
// names are the tag, or `tag#k` when one tag names several faces (k by position); edge names join
// the names of their two faces.
import {
  booleanCurveRegions, curveArrangementVertices, pointInPolygon, curveTolerance, paramOf, regionArea, regionInteriorPoint, sampleRing, segAt, segDistance, segEnd, segReverse, segStart,
  type CurveRegion2, type CurveSegment2, type XY,
} from '../brep/curved-arrangement.js';
import { BrepError, buildBrep, lineCurve, type Brep, type BrepFaceInput, type BrepLoopInput } from '../brep/brep-core.js';
import { buildProfileLoop, capSurface, extrudedSurface, segmentCurve, type ProfileSegment, type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { Curve, Point, Surface } from '../types.js';
import { sideName, type SideTags } from '../document/side-names.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

export interface PrismaticSlab { readonly z0: number; readonly z1: number; readonly regions: readonly CurveRegion2[] }
/** An authored top or bottom: caps of the solid at height z inside these regions take its tag. */
export interface PrismaticCapSource { readonly z: number; readonly regions: readonly CurveRegion2[]; readonly tag: string }
/** Slabs sorted by height, disjoint in Z; adjacent slabs with equal sections are merged. */
export interface PrismaticSolid { readonly kind: 'prismatic-solid'; readonly slabs: readonly PrismaticSlab[]; readonly caps?: readonly PrismaticCapSource[] }
export type PrismaticBooleanOperation = 'union' | 'intersection' | 'difference';
/** This module's refusal (R7.3a batch 2: the PrismaticSolidError class folded, D279): a BarocssError, `details.source` 'prismatic-solid'. */
export const prismaticSolidError = (detail: string) => kernelRefusal('prismatic-solid', 'PRISMATIC_SOLID', 'Prismatic solid: ' + detail) as KernelError & { readonly code: 'PRISMATIC_SOLID' };
/** Whether something thrown is this module's refusal. */
export const isPrismaticSolidError = (e: unknown): e is KernelError & { readonly code: 'PRISMATIC_SOLID' } => isFrom<'PRISMATIC_SOLID'>(e, 'prismatic-solid');

const ringsOf = (regions: readonly CurveRegion2[]) => regions.flatMap(r => [r.outer, ...r.holes]);
const allRings = (slabs: readonly PrismaticSlab[]) => slabs.flatMap(s => ringsOf(s.regions));

function normalize(slabs: readonly PrismaticSlab[], tolerance: number, caps: readonly PrismaticCapSource[] = [], merged = false): PrismaticSolid {
  const sorted = slabs.filter(s => s.regions.length).sort((a, b) => a.z0 - b.z0), out: PrismaticSlab[] = [];
  for (const s of sorted) {
    if (!(Number.isFinite(s.z0) && Number.isFinite(s.z1) && s.z1 > s.z0)) throw prismaticSolidError('every slab needs finite z0 < z1');
    const prev = out[out.length - 1];
    if (prev && s.z0 < prev.z1) throw prismaticSolidError('slabs overlap in Z');
    if (!merged && prev && prev.z1 === s.z0 && !booleanCurveRegions(ringsOf(prev.regions), ringsOf(s.regions), 'xor', tolerance).length) { out[out.length - 1] = { ...prev, z1: s.z1 }; continue; }
    out.push(s);
  }
  const levels = new Set(out.flatMap(x => [x.z0, x.z1])), kept = caps.filter(c => levels.has(c.z));
  return { kind: 'prismatic-solid', slabs: out, ...(kept.length ? { caps: kept } : {}) };
}

/** Closed rings (material on the left; self-overlap counts once) swept from z0 to z1. */
export function prismaticExtrude(rings: readonly (readonly CurveSegment2[])[], z0: number, z1: number): PrismaticSolid {
  const tol = curveTolerance(rings);
  return normalize([{ z0, z1, regions: booleanCurveRegions(rings, [], 'union', tol) }], tol);
}

const toCurve2 = (s: ProfileSegment, tag?: string): CurveSegment2 => {
  const t = tag === undefined ? {} : { tag };
  return s.kind === 'line' ? { kind: 'line', a: s.start, b: s.end, ...t } : { kind: 'arc', c: s.center, r: s.radius, t0: s.startAngle, sweep: s.sweep, ...t };
};
const reverseRing = (ring: readonly CurveSegment2[]) => [...ring].reverse().map(segReverse);

/**
 * A line + arc profile with holes (the extruded-profile input format) extruded upward. With a `tag`,
 * walls are named `tag.side<i>` (i: the authored segment) and `tag.hole<h>.side<i>`, caps `tag.top`
 * and `tag.bottom`.
 */
export function prismaticFromProfile(input: { readonly outer: readonly ProfileSegmentInput[]; readonly regions?: readonly (readonly ProfileSegmentInput[])[]; readonly holes?: readonly (readonly ProfileSegmentInput[])[]; readonly height: number; readonly from?: number; readonly tag?: string; readonly sideTags?: SideTags;
  /**
   * Whole names for the outer loop's walls (one an authored segment) and the caps, in place of the tag's (R12.1 sheet roles,
   * D116); the holes' walls too, each hole's list in its order (FR1 section roles, D123). A loop left out is named by the tag.
   */
  readonly names?: { readonly outer?: readonly string[]; readonly holes?: readonly (readonly string[])[]; readonly bottom: string; readonly top: string } }): PrismaticSolid {
  const budget = { maximumSegments: 1024 }, z0 = input.from ?? 0, z1 = z0 + input.height, tag = input.tag, tags = input.sideTags, names = input.names;
  // A clockwise authored loop is reversed; segment k then runs along authored segment n − 1 − k.
  const loop = (segments: readonly ProfileSegmentInput[], prefix: string, own?: readonly string[], whole?: readonly string[]) => {
    const built = buildProfileLoop(segments, budget), n = built.segments.length;
    return built.segments.map((s, k) => { const i = built.reversed ? n - 1 - k : k; return toCurve2(s, whole ? whole[i] : tag === undefined ? undefined : sideName(prefix, i, own)); });
  };
  // More outer loops (`regions`) join the first; their walls are named `${tag}.region${i}.side${k}` — with tags,
  // every wall is `${tag}.side[t]`, its segment's tag (unique in the sketch).
  const outers = [loop(input.outer, String(tag), tags?.outer, names?.outer), ...(input.regions ?? []).map((r, i) => loop(r, tags ? String(tag) : `${tag}.region${i}`, tags?.regions?.[i]))];
  const holes = (input.holes ?? []).map((h, i) => loop(h, tags ? String(tag) : `${tag}.hole${i}`, tags?.holes?.[i], names?.holes?.[i]));
  // The outer boundaries minus the holes (holes may touch or cross them; the difference is exact either way).
  const tol = curveTolerance([...outers, ...holes]), regions = booleanCurveRegions(outers, holes, 'difference', tol);
  const caps = names ? [{ z: z0, regions, tag: names.bottom }, { z: z1, regions, tag: names.top }] : tag === undefined ? [] : [{ z: z0, regions, tag: tag + '.bottom' }, { z: z1, regions, tag: tag + '.top' }];
  return normalize([{ z0, z1, regions }], tol, caps);
}

/**
 * The solid under x' = M·x + t (M a similarity: rotation or reflection times a scale s), z' = zScale·z
 * + zOffset (|zScale| = s keeps cylinders round; any nonzero value is accepted for planar walls).
 * `retag` renames every tag (pattern copies); a string appends a suffix.
 */
export function transformPrismatic(solid: PrismaticSolid, transform: { readonly matrix: readonly [number, number, number, number]; readonly offset?: readonly [number, number]; readonly zScale?: number; readonly zOffset?: number; readonly retag?: ((tag: string) => string) | string }): PrismaticSolid {
  const [a, b, c, d] = transform.matrix, [tx, ty] = transform.offset ?? [0, 0], zs = transform.zScale ?? 1, zo = transform.zOffset ?? 0, det = a * d - b * c;
  const scale = Math.sqrt(Math.abs(det));
  if (!(scale > 0) || Math.abs(a * a + c * c - scale * scale) > 1e-12 * scale * scale || Math.abs(b * b + d * d - scale * scale) > 1e-12 * scale * scale || Math.abs(a * b + c * d) > 1e-12 * scale * scale || !(zs !== 0 && Number.isFinite(zs)))
    throw prismaticSolidError('the transform must be a similarity in XY with a nonzero Z scale');
  const map = (p: XY): XY => [a * p[0] + b * p[1] + tx, c * p[0] + d * p[1] + ty];
  const retag = <T extends { tag?: string }>(x: T): T => transform.retag && x.tag !== undefined ? { ...x, tag: typeof transform.retag === 'string' ? x.tag + transform.retag : transform.retag(x.tag) } : x;
  const seg = (s: CurveSegment2): CurveSegment2 => s.kind === 'curve' ? noCurves() : retag(s.kind === 'line' ? { ...s, a: map(s.a), b: map(s.b) }
    : { ...s, c: map(s.c), r: s.r * scale, t0: Math.atan2(c * Math.cos(s.t0) + d * Math.sin(s.t0), a * Math.cos(s.t0) + b * Math.sin(s.t0)), sweep: s.sweep * Math.sign(det) });
  // A reflection reverses ring orientation; reverse the rings so material stays on the left.
  const ring = (r: readonly CurveSegment2[]) => det > 0 ? r.map(seg) : reverseRing(r.map(seg));
  const region = (r: CurveRegion2): CurveRegion2 => ({ outer: ring(r.outer), holes: r.holes.map(ring) });
  const z = (v: number) => zs * v + zo;
  const slabs = solid.slabs.map(s => ({ z0: Math.min(z(s.z0), z(s.z1)), z1: Math.max(z(s.z0), z(s.z1)), regions: s.regions.map(region) }));
  const caps = (solid.caps ?? []).map(cp => ({ z: z(cp.z), regions: cp.regions.map(region), tag: typeof transform.retag === 'string' ? cp.tag + transform.retag : transform.retag ? transform.retag(cp.tag) : cp.tag }));
  // (A similarity keeps distinct neighbouring sections distinct: they need no merging check.)
  return normalize(slabs, 0, caps, true);
}

/** Slab-wise Boolean: split at every level of either solid, 2D Boolean of each pair of sections. */
export function booleanPrismatic(a: PrismaticSolid, b: PrismaticSolid, operation: PrismaticBooleanOperation): PrismaticSolid {
  const tol = curveTolerance([...allRings(a.slabs), ...allRings(b.slabs)]);
  const levels = [...new Set([...a.slabs, ...b.slabs].flatMap(s => [s.z0, s.z1]))].sort((x, y) => x - y), out: PrismaticSlab[] = [];
  const sectionAt = (s: PrismaticSolid, lo: number, hi: number) => ringsOf(s.slabs.find(x => x.z0 <= lo && x.z1 >= hi)?.regions ?? []);
  for (let i = 0; i + 1 < levels.length; i++) {
    const A = sectionAt(a, levels[i], levels[i + 1]), B = sectionAt(b, levels[i], levels[i + 1]);
    if (!A.length && !B.length) continue;
    out.push({ z0: levels[i], z1: levels[i + 1], regions: booleanCurveRegions(A, B, operation, tol) });
  }
  return normalize(out, tol, [...(a.caps ?? []), ...(b.caps ?? [])]);
}

export const prismaticVolume = (s: PrismaticSolid) => s.slabs.reduce((v, x) => v + x.regions.reduce((a, r) => a + regionArea(r), 0) * (x.z1 - x.z0), 0);

export const inRegion = (p: XY, r: CurveRegion2) => pointInPolygon(p, sampleRing(r.outer, Math.PI / 720)) && !r.holes.some(h => pointInPolygon(p, sampleRing(h, Math.PI / 720)));
/** Whether a point is inside the solid (boundary points either way). */
export function prismaticContains(s: PrismaticSolid, p: Point): boolean {
  const slab = s.slabs.find(x => x.z0 <= p[2] && p[2] <= x.z1);
  return !!slab && slab.regions.some(r => inRegion([p[0], p[1]], r));
}

class PointSet {
  readonly points: XY[] = []; private readonly grid = new Map<string, number[]>(); private readonly cell: number;
  constructor(readonly eps: number) { this.cell = eps * 64; }
  find(p: XY): number {
    const gx = Math.floor(p[0] / this.cell), gy = Math.floor(p[1] / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of this.grid.get((gx + i) + ',' + (gy + j)) ?? []) if (Math.hypot(this.points[v][0] - p[0], this.points[v][1] - p[1]) <= this.eps) return v;
    return -1;
  }
  add(p: XY): number {
    const f = this.find(p); if (f >= 0) return f;
    const v = this.points.length, k = Math.floor(p[0] / this.cell) + ',' + Math.floor(p[1] / this.cell);
    this.points.push([p[0], p[1]]); this.grid.set(k, [...(this.grid.get(k) ?? []), v]); return v;
  }
}

/** Prismatic sections are lines and arcs only. */
const noCurves = (): never => { throw prismaticSolidError('prismatic sections are made of lines and arcs'); };
const profileSegment = (s: CurveSegment2, start: XY, end: XY): ProfileSegment => s.kind === 'curve' ? noCurves() : s.kind === 'line'
  ? { kind: 'line', start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) }
  : { kind: 'arc', start, end, center: s.c, radius: s.r, startAngle: s.t0, sweep: s.sweep, length: Math.abs(s.sweep) * s.r };

type Tag = 'lowerWall' | 'upperWall' | 'upFace' | 'downFace' | 'strut';
/** pcurve is null for struts until their final extent is known (u is their wall parameter). */
interface Use { key: string; sense: 'forward' | 'reversed'; pcurve: Curve | null; u?: number; face: number; tag: Tag; start: string; end: string; startRoot?: string; endRoot?: string }
interface FaceDraft { id: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer' | 'inner'; uses: Use[] }[]; volume: number; cap?: { region: CurveRegion2; z: number }; wall?: { za: number; zb: number }; base: string; key: Point; name?: string }

/** The solid as a B-rep: walls on extruded lines and arcs, planar caps, pcurves on every coedge. */
export function brepFromPrismatic(solid: PrismaticSolid, options: { readonly id?: string } = {}): Brep {
  const id = options.id ?? 'prismatic', slabs = solid.slabs;
  if (!slabs.length) throw new BrepError('INPUT', 'a prismatic solid without slabs has no B-rep');
  const tol = curveTolerance(allRings(slabs));
  const levels = [...new Set(slabs.flatMap(s => [s.z0, s.z1]))].sort((x, y) => x - y);
  const ringsAt = (z: number, side: 'below' | 'above') => ringsOf(slabs.find(s => (side === 'below' ? s.z1 : s.z0) === z)?.regions ?? []);

  // 1. Global points: every vertex of the arrangement at every level, and every cap ring vertex.
  const set = new PointSet(tol);
  const caps = levels.map(z => {
    const below = ringsAt(z, 'below'), above = ringsAt(z, 'above');
    for (const p of curveArrangementVertices([...below, ...above], tol)) set.add(p);
    return { up: below.length ? booleanCurveRegions(below, above, 'difference', tol) : [], down: above.length ? booleanCurveRegions(above, below, 'difference', tol) : [] };
  });
  for (const c of caps) for (const ring of ringsOf([...c.up, ...c.down])) for (const s of ring) { set.add(segStart(s)); set.add(segEnd(s)); }
  const P = set.points;

  // 2. Pieces: rings split at every global point on them; one canonical (lo → hi) curve per piece.
  const pieces: { seg: CurveSegment2; lo: number; hi: number }[] = [], between = new Map<string, number[]>();
  const piece = (seg: CurveSegment2, a: number, b: number) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ':' + hi, list = between.get(key) ?? [], mid = segAt(seg, 0.5);
    let k = list.find(i => segDistance(pieces[i].seg, mid) <= 4 * tol);
    if (k === undefined) { k = pieces.length; pieces.push({ seg: a === lo ? seg : segReverse(seg), lo, hi }); list.push(k); between.set(key, list); }
    return { piece: k, forward: a === lo };
  };
  const split = (ring: readonly CurveSegment2[]) => ring.flatMap(s => {
    const a = set.find(segStart(s)), b = set.find(segEnd(s));
    if (a < 0 || b < 0) throw new BrepError('GEOMETRY', 'a ring vertex is missing from the arrangement');
    const stops = [{ u: 0, v: a }];
    P.forEach((p, v) => { if (v === a || v === b || segDistance(s, p) > tol) return; const u = paramOf(s, p); if (u > 0 && u < 1) stops.push({ u, v }); });
    stops.sort((x, y) => x.u - y.u); stops.push({ u: 1, v: b });
    const out: { piece: number; forward: boolean; tag?: string }[] = [];
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1]; if (s0.v === s1.v) continue;
      const sub: CurveSegment2 = s.kind === 'line' ? { ...s, a: P[s0.v], b: P[s1.v] } : s.kind === 'arc' ? { ...s, t0: s.t0 + s.sweep * s0.u, sweep: s.sweep * (s1.u - s0.u) } : noCurves();
      out.push({ ...piece(sub, s0.v, s1.v), tag: s.tag });
    }
    return out;
  });
  const curveOf = (k: number, z: number, cid: string) => { const pc = pieces[k]; return segmentCurve(profileSegment(pc.seg, P[pc.lo], P[pc.hi]), z, cid); };

  // 3. Faces.
  const faces: FaceDraft[] = [], pc = (a: Point, b: Point) => lineCurve('pcurve', a, b);
  const hKey = (k: number, level: number) => `h${k}_${level}`, vtx = (p: number, level: number) => `${p}_${level}`;
  const hUse = (k: number, forward: boolean, level: number, face: number, tag: Tag, pcurve: Curve): Use => {
    const s = vtx(pieces[k].lo, level), e = vtx(pieces[k].hi, level);
    return { key: hKey(k, level), sense: forward ? 'forward' : 'reversed', pcurve, face, tag, start: forward ? s : e, end: forward ? e : s };
  };
  // Walls: one cell per piece per slab; cells of one piece and side in adjacent slabs form one face.
  const struts = new Map<string, { p: number; lo: number; hi: number }>();
  const cells = new Map<string, { si: number; k: number; forward: boolean; sStart: string; sEnd: string; pStart: number; pEnd: number; cell: string; tag?: string }[]>();
  slabs.forEach((slab, si) => {
    const iLo = levels.indexOf(slab.z0), iHi = levels.indexOf(slab.z1);
    slab.regions.forEach((region, ri) => [region.outer, ...region.holes].forEach((ring, gi) => {
      const parts = split(ring), n = parts.length;
      const startOf = (j: number) => parts[j % n].forward ? pieces[parts[j % n].piece].lo : pieces[parts[j % n].piece].hi;
      const strut = (j: number) => { const key = `s${si}_${ri}_${gi}_${j % n}`; struts.set(key, { p: startOf(j), lo: iLo, hi: iHi }); return key; };
      parts.forEach(({ piece: k, forward, tag }, j) => {
        const list = cells.get(k + ':' + forward) ?? [];
        list.push({ si, k, forward, sStart: strut(j), sEnd: strut(j + 1), pStart: startOf(j), pEnd: startOf(j + 1), cell: `${si}_${ri}_${gi}_${j}`, tag });
        cells.set(k + ':' + forward, list);
      });
    }));
  });
  for (const list of cells.values()) {
    list.sort((a, b) => a.si - b.si);
    const runs: (typeof list)[] = [];
    for (const c of list) { const last = runs[runs.length - 1]; if (last && last[last.length - 1].si === c.si - 1 && slabs[c.si - 1].z1 === slabs[c.si].z0) last.push(c); else runs.push([c]); }
    for (const run of runs) {
      const { k, forward } = run[0], za = slabs[run[0].si].z0, zb = slabs[run[run.length - 1].si].z1, iLo = levels.indexOf(za), iHi = levels.indexOf(zb);
      const f = faces.length, uEnd = forward ? 1 : 0, uStart = 1 - uEnd, fid = `${id}_w${run[0].cell}`, mid = segAt(pieces[k].seg, 0.5);
      const strutUse = (key: string, up: boolean, u: number): Use => { const st = struts.get(key)!, lo = vtx(st.p, st.lo), hi = vtx(st.p, st.hi); return { key, sense: up ? 'forward' : 'reversed', pcurve: null, u, face: f, tag: 'strut', start: up ? lo : hi, end: up ? hi : lo }; };
      const loop: Use[] = [
        hUse(k, forward, iLo, f, 'upperWall', pc([0, 0, 0], [1, 0, 0])),
        ...run.map(c => strutUse(c.sEnd, true, uEnd)),
        hUse(k, !forward, iHi, f, 'lowerWall', pc([0, 1, 0], [1, 1, 0])),
        ...[...run].reverse().map(c => strutUse(c.sStart, false, uStart)),
      ];
      faces.push({ id: fid, surface: extrudedSurface(curveOf(k, za, fid), za, zb, fid), sense: forward ? 'forward' : 'reversed', loops: [{ kind: 'outer', uses: loop }], volume: 0, wall: { za, zb },
        base: run[0].tag ?? `${id}.wall`, key: [mid[0], mid[1], (za + zb) / 2] });
    }
  }
  caps.forEach((c, level) => {
    const z = levels[level];
    for (const [up, regions] of [[true, c.up], [false, c.down]] as const) regions.forEach((region, n) => {
      const f = faces.length, fid = `${id}_${up ? 'u' : 'd'}${level}_${n}`;
      const rings = [region.outer, ...region.holes].map(r => { const parts = split(r); return up ? parts : [...parts].reverse().map(x => ({ piece: x.piece, forward: !x.forward })); });
      // Bounds from the control points (each curve lies in their hull), so pcurves stay in [0, 1]².
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const ring of rings) for (const { piece: k } of ring) for (const q of curveOf(k, z, 'b').controlPoints) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
      const uv = (q: Point): Point => up ? [(q[0] - x0) / (x1 - x0), (q[1] - y0) / (y1 - y0), 0] : [(q[1] - y0) / (y1 - y0), (q[0] - x0) / (x1 - x0), 0];
      const loops = rings.map((ring, g) => ({ kind: (g === 0 ? 'outer' : 'inner') as 'outer' | 'inner', uses: ring.map(({ piece: k, forward }) => {
        const e = curveOf(k, z, 'p');
        return hUse(k, forward, level, f, up ? 'upFace' : 'downFace', { ...e, id: 'pcurve', controlPoints: e.controlPoints.map(uv) });
      }) }));
      // The cap's name: the authored top or bottom at this height that contains it.
      const q = interiorPoint(region), source = (solid.caps ?? []).find(cp => Math.abs(cp.z - z) <= tol && cp.regions.some(r => inRegion(q, r)));
      faces.push({ id: fid, surface: capSurface({ min: [x0, y0], max: [x1, y1] }, z, fid, up), sense: 'forward', loops, volume: (up ? 1 : -1) * regionArea(region) * z, cap: { region, z },
        base: source?.tag ?? `${id}.${up ? 'top' : 'bottom'}`, key: [q[0], q[1], z] });
    });
  });

  // 4a. Edges: two uses each; a horizontal line where two solids touch (four uses) becomes two wedges.
  const uses = faces.flatMap(f => f.loops.flatMap(l => l.uses)), byKey = new Map<string, Use[]>();
  for (const u of uses) byKey.set(u.key, [...(byKey.get(u.key) ?? []), u]);
  for (const [key, list] of byKey) {
    if (list.length === 4) {
      const tags = new Set(list.map(u => u.tag));
      if (tags.size !== 4) throw new BrepError('TOPOLOGY', `edge ${key} has four uses that are not two wedges`);
      for (const u of list) u.key = key + (u.tag === 'lowerWall' || u.tag === 'upFace' ? 'a' : 'b');
    } else if (list.length !== 2) throw new BrepError('TOPOLOGY', `edge ${key} has ${list.length} uses`);
  }
  const edgeUses = new Map<string, Use[]>(); for (const u of uses) edgeUses.set(u.key, [...(edgeUses.get(u.key) ?? []), u]);
  for (const [key, list] of edgeUses) if (list.length !== 2 || list[0].sense === list[1].sense) throw new BrepError('TOPOLOGY', `edge ${key} is not used once in each direction`);

  // 4b. Vertices: one per disc of faces around a point (edges consecutive in a loop share a disc).
  const parent = new Map<string, string>(), find = (x: string): string => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  const at = (v: string, e: string) => v + '|' + e, unite = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const f of faces) for (const l of f.loops) l.uses.forEach((u, k) => { const n = l.uses[(k + 1) % l.uses.length]; unite(at(u.end, u.key), at(n.start, n.key)); });
  const discEdges = new Map<string, Set<string>>();
  for (const u of uses) {
    u.startRoot = find(at(u.start, u.key)); u.endRoot = find(at(u.end, u.key));
    for (const r of [u.startRoot, u.endRoot]) discEdges.set(r, (discEdges.get(r) ?? new Set()).add(u.key));
  }
  // 4c. Vertical edges meeting only each other (both walls continue past the level) become one edge.
  const sroot = new Map<string, string>(), sfind = (x: string): string => { let r = x; while (sroot.has(r) && sroot.get(r) !== r) r = sroot.get(r)!; return r; };
  for (const keys of discEdges.values()) {
    const [a, b] = [...keys];
    if (keys.size !== 2 || !a.startsWith('s') || !b.startsWith('s')) continue;
    const ra = sfind(a), rb = sfind(b); if (ra === rb) continue;
    sroot.set(ra, rb); const A = struts.get(ra)!, B = struts.get(rb)!; struts.set(rb, { p: B.p, lo: Math.min(A.lo, B.lo), hi: Math.max(A.hi, B.hi) });
  }
  for (const f of faces) for (const l of f.loops) {
    const out: Use[] = [];
    for (const u of l.uses) {
      const key = u.key.startsWith('s') ? sfind(u.key) : u.key, prev = out[out.length - 1];
      if (prev && prev.key === key && key.startsWith('s')) { prev.end = u.end; prev.endRoot = u.endRoot; continue; }
      out.push({ ...u, key });
    }
    l.uses = out;
  }
  for (const f of faces) for (const l of f.loops) for (const u of l.uses) if (u.tag === 'strut') {
    const st = struts.get(u.key)!, w = f.wall!, v = (level: number) => (levels[level] - w.za) / (w.zb - w.za);
    u.pcurve = pc([u.u!, v(st.lo), 0], [u.u!, v(st.hi), 0]);
  }
  const finalUses = new Map<string, Use[]>(); for (const f of faces) for (const l of f.loops) for (const u of l.uses) finalUses.set(u.key, [...(finalUses.get(u.key) ?? []), u]);
  const vertexIds = new Map<string, string>(), vertices: { id: string; point: Point }[] = [];
  const vertexOf = (v: string, root: string) => {
    let vid = vertexIds.get(root);
    if (!vid) { vid = `${id}_v${vertices.length}`; vertexIds.set(root, vid); const [p, level] = v.split('_').map(Number); vertices.push({ id: vid, point: [P[p][0], P[p][1], levels[level]] }); }
    return vid;
  };
  nameFaces(faces);
  const edgeIds = new Map<string, string>(), edges: { id: string; curve: Curve; vertices: [string, string]; name?: string }[] = [];
  const edgeBase = (list: Use[]) => [...new Set(list.map(u => faces[u.face].name!))].sort().join('|');
  for (const [key, list] of finalUses) {
    const fwd = list.find(u => u.sense === 'forward')!, eid = `${id}_e${edges.length}`;
    edgeIds.set(key, eid);
    let curve: Curve;
    if (key.startsWith('s')) { const s = struts.get(key)!; curve = lineCurve(eid, [P[s.p][0], P[s.p][1], levels[s.lo]], [P[s.p][0], P[s.p][1], levels[s.hi]]); }
    else { const [k, level] = key.slice(1).replace(/[ab]$/, '').split('_').map(Number); curve = curveOf(k, levels[level], eid); }
    edges.push({ id: eid, curve, vertices: [vertexOf(fwd.start, fwd.startRoot!), vertexOf(fwd.end, fwd.endRoot!)], name: edgeBase(list) });
  }
  nameEdges(edges);
  // (A cap whose boundary passes one point at two vertices: two walls tangent there along a vertical line. Where the
  // solid lies on both sides of the line — two discs touching from outside, a figure eight — its parts touch along it:
  // not a manifold solid, refused. Where it lies on neither — a disc tangent inside a disc, a wall tangent inside a hole
  // — it is the crescent, kept as one body (D195). The commutativity check's 20261024 #51, D275.)
  const extent = P.reduce((m, q) => Math.max(m, Math.abs(q[0]), Math.abs(q[1])), 1), rho = Math.max(1e-4 * extent, 1e3 * tol);
  for (const f of faces) {
    if (!f.cap) continue;
    const at = new Map<number, Set<string>>();
    for (const l of f.loops) for (const u of l.uses) { const p = Number(u.start.split('_')[0]), ids = at.get(p) ?? new Set<string>(); ids.add(vertexOf(u.start, u.startRoot!)); at.set(p, ids); }
    for (const [p, ids] of at) if (ids.size > 1 && materialAround(f.cap.region, P[p], rho) > 0.5)
      throw new BrepError('GEOMETRY', `the solid touches itself along the vertical line at (${P[p].map(x => +x.toFixed(4))}): two of its walls meet there from outside each other`);
  }

  // 4d. Shells: faces connected through edges. Positive shells are bodies; negative ones are cavities.
  const froot = faces.map((_, i) => i), ff = (i: number): number => { while (froot[i] !== i) i = froot[i] = froot[froot[i]]; return i; };
  for (const list of finalUses.values()) froot[ff(list[0].face)] = ff(list[1].face);
  const shells = new Map<number, number[]>(); faces.forEach((_, i) => shells.set(ff(i), [...(shells.get(ff(i)) ?? []), i]));
  const groups = [...shells.values()].map(fs => ({ faces: fs, volume: fs.reduce((v, i) => v + faces[i].volume, 0) }));
  const outers = groups.filter(g => g.volume > 0), bodies = outers.map(g => ({ outer: g, cavities: [] as typeof groups }));
  for (const cavity of groups.filter(g => g.volume <= 0)) {
    const cap = faces[cavity.faces.find(i => faces[i].cap)!].cap!, q = interiorPoint(cap.region);
    let best = -1;
    bodies.forEach((b, k) => {
      const crossings = b.outer.faces.filter(i => { const c = faces[i].cap; return c && c.z > cap.z && inRegion(q, c.region); }).length;
      if (crossings % 2 === 1 && (best < 0 || b.outer.volume < bodies[best].outer.volume)) best = k;
    });
    if (best < 0) throw new BrepError('TOPOLOGY', 'a cavity shell lies in no body');
    bodies[best].cavities.push(cavity);
  }
  const faceInput = (i: number): BrepFaceInput => ({ id: faces[i].id, name: faces[i].name, surface: faces[i].surface, sense: faces[i].sense,
    loops: faces[i].loops.map((l): BrepLoopInput => ({ kind: l.kind, uses: l.uses.map(u => ({ edge: edgeIds.get(u.key)!, sense: u.sense, pcurve: u.pcurve! })) })) });
  return buildBrep({
    source: { family: 'prismatic-solid', id }, vertices, edges,
    bodies: bodies.map((b, k) => ({ id: `${id}_b${k}`, kind: 'solid' as const, shells: [b.outer, ...b.cavities].map((g, s) => ({ id: `${id}_b${k}_s${s}`, faces: g.faces.map(faceInput), closed: true })) })),
    tolerance: Math.max(tol, 1e-9),
  });
}

const byPosition = (a: Point, b: Point) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
/** Unique names: a base used once is the name; a base used k > 1 times is `base#1` … `base#k` by position. */
function nameFaces(faces: { base: string; key: Point; name?: string }[]): void {
  const groups = new Map<string, typeof faces>();
  for (const f of faces) groups.set(f.base, [...(groups.get(f.base) ?? []), f]);
  for (const [base, list] of groups) {
    if (list.length === 1) { list[0].name = base; continue; }
    [...list].sort((a, b) => byPosition(a.key, b.key)).forEach((f, k) => { f.name = `${base}#${k + 1}`; });
  }
}
/** Edge names from their face names; several edges between the same two faces are numbered by midpoint. */
export function nameEdges(edges: { curve: Curve; name?: string }[]): void {
  const groups = new Map<string, typeof edges>();
  for (const e of edges) groups.set(e.name!, [...(groups.get(e.name!) ?? []), e]);
  const mid = (c: Curve): Point => { const p = c.controlPoints, a = p[0], b = p[p.length - 1], m = p[Math.floor(p.length / 2)]; return [(a[0] + b[0] + m[0]) / 3, (a[1] + b[1] + m[1]) / 3, (a[2] + b[2] + m[2]) / 3]; };
  for (const [base, list] of groups) if (list.length > 1) [...list].sort((a, b) => byPosition(mid(a.curve), mid(b.curve))).forEach((e, k) => { e.name = `${base}#${k + 1}`; });
}

/** The share of 16 points on a circle of radius rho about p that lie in the region. */
function materialAround(region: CurveRegion2, p: XY, rho: number): number {
  let n = 0;
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) * Math.PI / 8; if (inRegion([p[0] + rho * Math.cos(a), p[1] + rho * Math.sin(a)], region)) n++; }
  return n / 16;
}

function interiorPoint(region: CurveRegion2): XY {
  const p = regionInteriorPoint(region);
  if (!p) throw new BrepError('GEOMETRY', 'a region has no interior');
  return p;
}
