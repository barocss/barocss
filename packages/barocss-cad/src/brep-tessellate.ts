// Display tessellation of a shared B-rep (brep-core step 2). Every edge is sampled once and both of
// its faces use those exact points, so the mesh is watertight by construction (no welding). The B-rep
// edges come out as polylines too, so viewers can draw real model edges instead of guessing creases.
//
//   planar faces       boundary loops (outer + holes) projected to the plane, holes bridged, ear-clipped
//   ruled faces        a 4-coedge loop whose opposite sides are straight lines (extruded sides, cylinder
//                      walls with a seam): triangle strip between the two curved sides
//   other faces        refused for now (BrepError GEOMETRY)
import { BrepError, type Brep, type BrepCoedge } from './brep-core.js';
import { evaluateCurve, curveDomain } from './math.js';
import type { Curve, Point, Surface } from './types.js';

export interface BrepMeshFace { readonly faceId: string; readonly kind: 'planar' | 'ruled'; readonly vertexOffset: number; readonly vertexCount: number; readonly indexOffset: number; readonly indexCount: number }
export interface BrepMeshEdge { readonly edgeId: string; readonly pointsMM: Float64Array }
export interface BrepMesh { readonly positionsMM: Float64Array; readonly normals: Float64Array; readonly indices: Uint32Array; readonly faces: readonly BrepMeshFace[]; readonly edges: readonly BrepMeshEdge[] }
export interface BrepTessellationOptions { readonly segmentsPerQuarter?: number }

type XY = [number, number];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point): Point => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const isLine = (c: Curve) => c.degree === 1 && c.controlPoints.length === 2;

/** Parameters along an edge: its ends for a line; otherwise by the control polygon's turning angle. */
function edgeParameters(curve: Curve, perQuarter: number): number[] {
  const [t0, t1] = curveDomain(curve);
  if (isLine(curve)) return [t0, t1];
  let turning = 0; const p = curve.controlPoints;
  for (let i = 1; i + 1 < p.length; i++) {
    const a = unit(sub(p[i], p[i - 1])), b = unit(sub(p[i + 1], p[i]));
    turning += Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  }
  const n = Math.max(2, Math.ceil(turning / (Math.PI / 2) * perQuarter));
  return Array.from({ length: n + 1 }, (_, k) => k === n ? t1 : t0 + (t1 - t0) * k / n);
}

/** Triangulates a polygon with holes (outer counter-clockwise, holes clockwise); returns index triples. */
export function triangulatePolygonWithHoles(outer: readonly XY[], holes: readonly (readonly XY[])[]): [number, number, number][] {
  const pts: XY[] = [...outer, ...holes.flat()];
  let ring = outer.map((_, i) => i), offset = outer.length;
  const holeRings = holes.map(h => { const r = h.map((_, i) => offset + i); offset += h.length; return r; });
  const cr = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  // Bridge holes, right to left: from the hole's rightmost vertex M to the nearest ring vertex occurrence
  // that M can see (the segment crosses no ring edge) and whose interior wedge contains M. Checking the
  // wedge per occurrence keeps bridges apart when a vertex already appears twice from an earlier bridge.
  holeRings.sort((a, b) => Math.max(...b.map(i => pts[i][0])) - Math.max(...a.map(i => pts[i][0])));
  const same0 = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];
  const crosses = (p: XY, q: XY, a: XY, b: XY) => {
    if (same0(p, a) || same0(p, b) || same0(q, a) || same0(q, b)) return false;
    const d1 = cr(a, b, p), d2 = cr(a, b, q), d3 = cr(p, q, a), d4 = cr(p, q, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    const on = (o: XY, x: XY, y: XY) => cr(o, x, y) === 0 && Math.min(o[0], x[0]) <= y[0] && y[0] <= Math.max(o[0], x[0]) && Math.min(o[1], x[1]) <= y[1] && y[1] <= Math.max(o[1], x[1]);
    return on(p, q, a) || on(p, q, b);
  };
  const inWedge = (A: XY, V: XY, B: XY, P: XY) => { const l1 = cr(A, V, P) > 0, l2 = cr(V, B, P) > 0; return cr(A, V, B) > 0 ? l1 && l2 : l1 || l2; };
  for (const [h, hole] of holeRings.entries()) {
    const mi = hole.reduce((best, i) => pts[i][0] > pts[best][0] ? i : best, hole[0]), M = pts[mi], at = hole.indexOf(mi);
    const MA = pts[hole[(at - 1 + hole.length) % hole.length]], MB = pts[hole[(at + 1) % hole.length]];
    const pending = holeRings.slice(h + 1);
    let chosen = -1, bestD = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const V = pts[ring[k]], A = pts[ring[(k - 1 + ring.length) % ring.length]], B = pts[ring[(k + 1) % ring.length]];
      const d = Math.hypot(V[0] - M[0], V[1] - M[1]);
      if (d >= bestD || d === 0) continue;
      // The bridge must leave M into the material (left of the clockwise hole) and enter V's interior wedge.
      if (!inWedge(A, V, B, M) || !inWedge(MA, M, MB, V)) continue;
      let blocked = false;
      for (let e = 0; e < ring.length && !blocked; e++) blocked = crosses(M, V, pts[ring[e]], pts[ring[(e + 1) % ring.length]]);
      for (const other of [hole, ...pending]) for (let e = 0; e < other.length && !blocked; e++) blocked = crosses(M, V, pts[other[e]], pts[other[(e + 1) % other.length]]);
      if (!blocked) { bestD = d; chosen = k; }
    }
    if (chosen < 0) throw new BrepError('GEOMETRY', 'A hole is not inside its face boundary');
    const start = hole.indexOf(mi), rotated = [...hole.slice(start), ...hole.slice(0, start)];
    ring = [...ring.slice(0, chosen + 1), ...rotated, mi, ...ring.slice(chosen)];
  }
  // Ear clipping over the bridged ring (bridge vertices appear twice; coincident points are ignored).
  const tris: [number, number, number][] = [], same = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];
  let guard = 0;
  while (ring.length > 3 && guard++ < 100000) {
    let clipped = false;
    for (let k = 0; k < ring.length; k++) {
      const ia = ring[(k - 1 + ring.length) % ring.length], ib = ring[k], ic = ring[(k + 1) % ring.length], a = pts[ia], b = pts[ib], c = pts[ic];
      if (cr(a, b, c) <= 0) continue;
      let blocked = false;
      for (const j of ring) {
        const q = pts[j];
        if (j === ia || j === ib || j === ic || same(q, a) || same(q, b) || same(q, c)) continue;
        if (cr(a, b, q) >= 0 && cr(b, c, q) >= 0 && cr(c, a, q) >= 0) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push([ia, ib, ic]); ring.splice(k, 1); clipped = true; break;
    }
    if (!clipped) {
      // Degenerate (collinear) leftovers: drop a zero-area vertex, or give up.
      const k = ring.findIndex((ib, k2) => cr(pts[ring[(k2 - 1 + ring.length) % ring.length]], pts[ib], pts[ring[(k2 + 1) % ring.length]]) === 0);
      if (k < 0) throw new BrepError('GEOMETRY', 'Planar face could not be triangulated');
      ring.splice(k, 1);
    }
  }
  if (ring.length === 3 && cr(pts[ring[0]], pts[ring[1]], pts[ring[2]]) > 0) tris.push([ring[0], ring[1], ring[2]]);
  return tris;
}

function planar(surface: Surface): { origin: Point; normal: Point; e1: Point; e2: Point } | null {
  if (surface.degreeU !== 1 || surface.degreeV !== 1 || surface.controlPoints.length !== 2 || surface.controlPoints[0].length !== 2) return null;
  const [[p00, p01], [p10, p11]] = surface.controlPoints, u = sub(p10, p00), v = sub(p01, p00), n = cross(u, v);
  const corner = sub(p11, [p10[0] + v[0], p10[1] + v[1], p10[2] + v[2]]);
  if (Math.hypot(...corner) > 1e-9 * Math.max(1, Math.hypot(...u), Math.hypot(...v)) || Math.hypot(...n) === 0) return null;
  const e1 = unit(u), normal = unit(n); return { origin: p00, normal, e1, e2: cross(normal, e1) };
}

export function tessellateBrep(brep: Brep, options: BrepTessellationOptions = {}): BrepMesh {
  const perQuarter = Math.max(1, Math.min(64, Math.floor(options.segmentsPerQuarter ?? 8)));
  const edges = new Map(brep.edges.map(e => [e.id, e])), loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
  const samples = new Map(brep.edges.map(e => [e.id, edgeParameters(e.curve, perQuarter).map(t => evaluateCurve(e.curve, t))]));
  const along = (c: BrepCoedge) => { const s = samples.get(c.edge)!; return c.sense === 'forward' ? s : [...s].reverse(); };
  /** A loop as one ring of points (each coedge without its last point). */
  const ring = (loopId: string) => loops.get(loopId)!.coedges.flatMap(id => along(coedges.get(id)!).slice(0, -1));

  const positions: number[] = [], normals: number[] = [], indices: number[] = [], faces: BrepMeshFace[] = [];
  const emit = (faceId: string, kind: BrepMeshFace['kind'], pts: Point[], tris: [number, number, number][], flat: Point | null) => {
    const base = positions.length / 3, indexOffset = indices.length;
    for (const p of pts) positions.push(p[0], p[1], p[2]);
    const acc = pts.map(() => [0, 0, 0] as Point);
    for (const [a, b, c] of tris) {
      indices.push(base + a, base + b, base + c);
      const n = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]));
      for (const i of [a, b, c]) { acc[i][0] += n[0]; acc[i][1] += n[1]; acc[i][2] += n[2]; }
    }
    // Smooth within the face: points at one position (a seam) share one normal.
    const key = (p: Point) => p.join(','), byPos = new Map<string, Point>();
    acc.forEach((n, i) => { const k = key(pts[i]), s = byPos.get(k) ?? [0, 0, 0]; byPos.set(k, [s[0] + n[0], s[1] + n[1], s[2] + n[2]]); });
    pts.forEach(p => { const n = flat ?? unit(byPos.get(key(p))!); normals.push(n[0], n[1], n[2]); });
    faces.push({ faceId, kind, vertexOffset: base, vertexCount: pts.length, indexOffset, indexCount: indices.length - indexOffset });
  };

  for (const face of brep.faces) {
    const sign = face.sense === 'forward' ? 1 : -1, plane = planar(face.surface);
    const outerId = face.loops.find(l => loops.get(l)!.kind === 'outer')!, innerIds = face.loops.filter(l => l !== outerId);
    if (plane) {
      const normal: Point = [plane.normal[0] * sign, plane.normal[1] * sign, plane.normal[2] * sign], e2 = cross(normal, plane.e1);
      const to2 = (p: Point): XY => { const d = sub(p, plane.origin); return [dot(d, plane.e1), dot(d, e2)]; };
      const outer = ring(outerId), holes = innerIds.map(ring);
      const tris = triangulatePolygonWithHoles(outer.map(to2), holes.map(h => h.map(to2)));
      emit(face.id, 'planar', [...outer, ...holes.flat()], tris, normal);
      continue;
    }
    const outer = loops.get(outerId)!;
    const sides = outer.coedges.map(id => coedges.get(id)!);
    const rail = sides.length === 4 && innerIds.length === 0 ? [0, 1].find(i => isLine(edges.get(sides[i + 1].edge)!.curve) && isLine(edges.get(sides[(i + 3) % 4].edge)!.curve)) : undefined;
    if (rail === undefined) throw new BrepError('GEOMETRY', `face ${face.id}: only planar and ruled four-sided faces can be tessellated yet`);
    const A = along(sides[rail]), B = [...along(sides[(rail + 2) % 4])].reverse();
    const pts = [...A, ...B], tris: [number, number, number][] = [];
    // Zipper the two sides (A runs with the loop; B was reversed to run the same way).
    let i = 0, j = 0; const n = A.length - 1, m = B.length - 1, b0 = A.length;
    while (i < n || j < m) {
      const advanceA = j >= m || (i < n && (i + 1) / n <= (j + 1) / m);
      if (advanceA) { tris.push([i, i + 1, b0 + j]); i++; } else { tris.push([i, b0 + j + 1, b0 + j]); j++; }
    }
    emit(face.id, 'ruled', pts, tris, null);
  }
  return {
    positionsMM: new Float64Array(positions), normals: new Float64Array(normals), indices: new Uint32Array(indices), faces,
    edges: brep.edges.map(e => ({ edgeId: e.id, pointsMM: new Float64Array(samples.get(e.id)!.flat()) })),
  };
}
