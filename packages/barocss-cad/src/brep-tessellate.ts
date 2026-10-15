// Display tessellation of a shared B-rep (brep-core step 2). Every edge is sampled once and both of
// its faces use those exact points, so the mesh is watertight by construction (no welding). The B-rep
// edges come out as polylines too, so viewers can draw real model edges instead of guessing creases.
//
//   planar faces       boundary loops (outer + holes) projected to the plane, holes bridged, ear-clipped
//   ruled faces        two rails joined by straight sides, each side one line or a chain of collinear
//                      lines (extruded sides, cylinder walls with a seam, walls spanning several
//                      levels): triangle strip between the rails, fans over the side chains
//   trimmed cylinders  any other face on a circular cylinder (holes, notches, ellipse and quartic
//                      trims): its loops triangulated in (r·θ, height) from the shared edge samples,
//                      then interior edges wider than one angular step bisected conformingly
//   other faces        refused for now (BrepError GEOMETRY)
import { BrepError, type Brep, type BrepCoedge } from './brep-core.js';
import { evaluateCurve, curveDomain } from './math.js';
import type { Curve, Point, Surface } from './types.js';
import { cross, dot, sub, unit } from './vec3.js';

export interface BrepMeshFace { readonly faceId: string; readonly kind: 'planar' | 'ruled' | 'trimmed'; readonly vertexOffset: number; readonly vertexCount: number; readonly indexOffset: number; readonly indexCount: number }
export interface BrepMeshEdge { readonly edgeId: string; readonly pointsMM: Float64Array }
export interface BrepMesh { readonly positionsMM: Float64Array; readonly normals: Float64Array; readonly indices: Uint32Array; readonly faces: readonly BrepMeshFace[]; readonly edges: readonly BrepMeshEdge[] }
export interface BrepTessellationOptions { readonly segmentsPerQuarter?: number }

type XY = [number, number];
const isLine = (c: Curve) => c.degree === 1 && c.controlPoints.length === 2;

/**
 * A rational quadratic circular arc (spans of control points P2s, P2s+1, P2s+2 with end weights 1):
 * centre, radius, and a frame fixed by the plane alone (canonical normal; first axis from world X),
 * so every circle in one plane shares it.
 */
export function circleOf(curve: Curve): { c: Point; r: number; e1: Point; e2: Point; spans: { k0: number; k1: number; phi: number }[]; a0: number; sign: number } | null {
  const p = curve.controlPoints, w = curve.weights, n = (p.length - 1) / 2;
  if (curve.degree !== 2 || !Number.isInteger(n) || n < 1 || curve.knots.length !== 2 * n + 4) return null;
  const spans: { k0: number; k1: number; phi: number }[] = [];
  for (let s = 0; s < n; s++) {
    if (Math.abs(w[2 * s] - 1) > 1e-12 || Math.abs(w[2 * s + 2] - 1) > 1e-12 || !(w[2 * s + 1] > 0 && w[2 * s + 1] < 1)) return null;
    spans.push({ k0: curve.knots[2 + 2 * s], k1: curve.knots[3 + 2 * s], phi: 2 * Math.acos(w[2 * s + 1]) });
  }
  // Centre: P0 + (M − P0) scaled, where M is the chord midpoint and P1 the tangent intersection.
  const P0 = p[0], P1 = p[1], P2 = p[2], M: Point = [(P0[0] + P2[0]) / 2, (P0[1] + P2[1]) / 2, (P0[2] + P2[2]) / 2];
  const half = spans[0].phi / 2, h = Math.hypot(...sub(M, P1)); if (h === 0) return null;
  const r = Math.hypot(...sub(P0, M)) / Math.sin(half), toward = unit(sub(M, P1)), d = r / Math.cos(half);
  const c: Point = [P1[0] + toward[0] * d, P1[1] + toward[1] * d, P1[2] + toward[2] * d];
  for (let s = 0; s <= n; s++) if (Math.abs(Math.hypot(...sub(p[2 * s], c)) - r) > 1e-9 * Math.max(1, r)) return null;
  let nrm = unit(cross(sub(P0, c), sub(P2, c)));
  const big = [0, 1, 2].reduce((m, i) => Math.abs(nrm[i]) > Math.abs(nrm[m]) ? i : m, 0), sign = nrm[big] > 0 ? 1 : -1;
  nrm = [nrm[0] * sign, nrm[1] * sign, nrm[2] * sign];
  let e1: Point = [1 - nrm[0] * nrm[0], -nrm[0] * nrm[1], -nrm[0] * nrm[2]];
  if (Math.hypot(...e1) < 0.5) e1 = [-nrm[1] * nrm[0], 1 - nrm[1] * nrm[1], -nrm[1] * nrm[2]];
  e1 = unit(e1); const e2 = cross(nrm, e1), q = sub(P0, c);
  return { c, r, e1, e2, spans, a0: Math.atan2(dot(q, e2), dot(q, e1)), sign };
}

/**
 * Parameters along an edge: its ends for a line; for a circular arc, the points of one angular grid
 * (shared by all circles of a plane) — internally tangent circles then sample as scaled copies of each
 * other about the tangent point, so their polylines never cross; otherwise by the control polygon's
 * turning angle.
 */
function edgeParameters(curve: Curve, perQuarter: number): number[] {
  const [t0, t1] = curveDomain(curve);
  if (isLine(curve)) return [t0, t1];
  const circle = circleOf(curve);
  if (circle) {
    const step = Math.PI / 2 / perQuarter, total = circle.spans.reduce((a, s) => a + s.phi, 0), out = [t0];
    // Angles measured from the start along the curve; grid angles are absolute (sign: frame orientation).
    const dir = circle.sign, from = circle.a0;
    const first = dir > 0 ? Math.ceil(from / step) : Math.floor(from / step);
    for (let k = first; ; k += dir) {
      const beta = (k * step - from) * dir; if (beta >= total - step / 4) break;
      if (beta <= step / 4) continue;
      let acc = 0, s = 0; while (s < circle.spans.length - 1 && acc + circle.spans[s].phi < beta) acc += circle.spans[s++].phi;
      const sp = circle.spans[s], tau = (Math.tan((beta - acc - sp.phi / 2) / 2) / Math.tan(sp.phi / 4) + 1) / 2;
      out.push(sp.k0 + (sp.k1 - sp.k0) * Math.min(1, Math.max(0, tau)));
    }
    out.push(t1); return out;
  }
  let turning = 0; const p = curve.controlPoints;
  for (let i = 1; i + 1 < p.length; i++) {
    const a = unit(sub(p[i], p[i - 1])), b = unit(sub(p[i + 1], p[i]));
    turning += Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  }
  const n = Math.max(2, Math.ceil(turning / (Math.PI / 2) * perQuarter));
  return Array.from({ length: n + 1 }, (_, k) => k === n ? t1 : t0 + (t1 - t0) * k / n);
}

/**
 * Triangulates a polygon with holes (outer counter-clockwise, holes clockwise); returns index triples.
 * Weakly simple input is accepted: rings may touch at shared points (a hole touching the boundary is
 * bridged there with no new edge), and zero-width spikes (curves tangent at a point, sampled as
 * overlapping chords) are cut off as degenerate triangles, so every boundary segment stays in the
 * mesh. Orientation tests use a tolerance relative to the polygon's size.
 */
export function triangulatePolygonWithHoles(outer: readonly XY[], holes: readonly (readonly XY[])[], earCost?: (a: XY, b: XY, c: XY) => number): [number, number, number][] {
  const pts: XY[] = [...outer, ...holes.flat()];
  let ring = outer.map((_, i) => i), offset = outer.length;
  const holeRings = holes.map(h => { const r = h.map((_, i) => offset + i); offset += h.length; return r; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const eps = 1e-12 * ((x1 - x0) ** 2 + (y1 - y0) ** 2 || 1);
  const cr = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const same = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];
  const tris: [number, number, number][] = [];
  const crosses = (p: XY, q: XY, a: XY, b: XY) => {
    if (same(p, a) || same(p, b) || same(q, a) || same(q, b)) return false;
    const d1 = cr(a, b, p), d2 = cr(a, b, q), d3 = cr(p, q, a), d4 = cr(p, q, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    const on = (o: XY, x: XY, y: XY) => cr(o, x, y) === 0 && Math.min(o[0], x[0]) <= y[0] && y[0] <= Math.max(o[0], x[0]) && Math.min(o[1], x[1]) <= y[1] && y[1] <= Math.max(o[1], x[1]);
    return on(p, q, a) || on(p, q, b);
  };
  const inWedge = (A: XY, V: XY, B: XY, P: XY) => { const l1 = cr(A, V, P) > 0, l2 = cr(V, B, P) > 0; return cr(A, V, B) > 0 ? l1 && l2 : l1 || l2; };
  // Holes, right to left. A hole sharing a point with the ring joins it there (the ring passes the
  // point twice); otherwise a bridge runs from the hole's rightmost vertex M to the nearest ring
  // vertex occurrence that M can see and whose interior wedge contains M.
  holeRings.sort((a, b) => Math.max(...b.map(i => pts[i][0])) - Math.max(...a.map(i => pts[i][0])));
  for (const [h, hole] of holeRings.entries()) {
    const rotate = (at: number) => [...hole.slice(at), ...hole.slice(0, at)];
    let joined = false;
    for (let j = 0; j < hole.length && !joined; j++) {
      const M = pts[hole[j]], MA = pts[hole[(j - 1 + hole.length) % hole.length]], MB = pts[hole[(j + 1) % hole.length]];
      // A point just inside the material next to M (right of both hole edges: the hole runs clockwise).
      const nIn = [M[1] - MA[1], MA[0] - M[0]], nOut = [MB[1] - M[1], M[0] - MB[0]], len = (v: number[]) => Math.hypot(v[0], v[1]) || 1;
      const probe: XY = [M[0] - (nIn[0] / len(nIn) + nOut[0] / len(nOut)) * 1e-9 * Math.sqrt(eps / 1e-12), M[1] - (nIn[1] / len(nIn) + nOut[1] / len(nOut)) * 1e-9 * Math.sqrt(eps / 1e-12)];
      const occurrences = ring.flatMap((v, k) => same(pts[v], M) ? [k] : []);
      const k = occurrences.length === 1 ? occurrences[0] : occurrences.find(k => inWedge(pts[ring[(k - 1 + ring.length) % ring.length]], M, pts[ring[(k + 1) % ring.length]], probe));
      if (k === undefined) continue;
      const r = rotate(j);
      ring = [...ring.slice(0, k + 1), ...r.slice(1), r[0], ...ring.slice(k + 1)];
      joined = true;
    }
    if (joined) continue;
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
    const rotated = rotate(at);
    ring = [...ring.slice(0, chosen + 1), ...rotated, mi, ...ring.slice(chosen)];
  }
  // Spikes: a vertex whose two edges fold back onto each other (zero width) is cut off.
  const despike = () => {
    for (let again = true; again && ring.length > 3;) {
      again = false;
      for (let k = 0; k < ring.length && ring.length > 3; k++) {
        const ia = ring[(k - 1 + ring.length) % ring.length], ib = ring[k], ic = ring[(k + 1) % ring.length], a = pts[ia], b = pts[ib], c = pts[ic];
        const back = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0;
        if (same(a, b) || same(b, c) || (Math.abs(cr(a, b, c)) <= eps && back)) { if (!same(a, b) && !same(b, c)) tris.push([ia, ib, ic]); ring.splice(k, 1); k--; again = true; }
      }
    }
  };
  despike();
  // Ear clipping over the bridged ring (bridge vertices appear twice; coincident points are ignored).
  let guard = 0;
  while (ring.length > 3 && guard++ < 100000) {
    let clipped = false;
    // With a cost, ears are tried cheapest first (e.g. narrowest in one direction); otherwise in order.
    const order = earCost ? ring.map((_, k) => ({ k, cost: earCost(pts[ring[(k - 1 + ring.length) % ring.length]], pts[ring[k]], pts[ring[(k + 1) % ring.length]]) })).sort((x, y) => x.cost - y.cost).map(x => x.k) : ring.map((_, k) => k);
    for (const k of order) {
      const ia = ring[(k - 1 + ring.length) % ring.length], ib = ring[k], ic = ring[(k + 1) % ring.length], a = pts[ia], b = pts[ib], c = pts[ic];
      if (cr(a, b, c) <= eps) continue;
      let blocked = false;
      for (const j of ring) {
        const q = pts[j];
        if (j === ia || j === ib || j === ic || same(q, a) || same(q, b) || same(q, c)) continue;
        if (cr(a, b, q) >= -eps && cr(b, c, q) >= -eps && cr(c, a, q) >= -eps) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push([ia, ib, ic]); ring.splice(k, 1); clipped = true; break;
    }
    if (clipped) { despike(); continue; }
    // Degenerate leftovers: cut off a (near) zero-area vertex as a degenerate triangle, or give up.
    const k = ring.findIndex((ib, k2) => Math.abs(cr(pts[ring[(k2 - 1 + ring.length) % ring.length]], pts[ib], pts[ring[(k2 + 1) % ring.length]])) <= eps);
    if (k < 0) throw new BrepError('GEOMETRY', 'Planar face could not be triangulated');
    tris.push([ring[(k - 1 + ring.length) % ring.length], ring[k], ring[(k + 1) % ring.length]]); ring.splice(k, 1);
  }
  if (ring.length === 3 && !same(pts[ring[0]], pts[ring[1]]) && !same(pts[ring[1]], pts[ring[2]]) && !same(pts[ring[2]], pts[ring[0]])) tris.push([ring[0], ring[1], ring[2]]);
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
  // Faces on a cylinder that are not two rails with straight sides: triangulated in their (r·θ, height) domain.
  const trimmed = new Map<string, CylinderFrame>(), params = new Map(brep.edges.map(e => [e.id, edgeParameters(e.curve, perQuarter)]));
  for (const face of brep.faces) {
    if (planar(face.surface)) continue;
    const frame = cylinderFrame(face.surface); if (!frame || railsOf(face, loops, coedges, edges) !== undefined) continue;
    trimmed.set(face.id, frame);
  }
  const samples = new Map(brep.edges.map(e => [e.id, params.get(e.id)!.map(t => evaluateCurve(e.curve, t))]));
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

  for (const l of brep.loops) for (const id of l.coedges) { const c = coedges.get(id); if (!c || !edges.has(c.edge)) throw new BrepError('TOPOLOGY', `loop ${l.id}: coedge ${id} or its edge is missing`); }
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
    const frame = trimmed.get(face.id);
    if (frame) {
      // Per coedge, so a full-turn wall's seam (an edge used twice) can be told apart.
      const ids = [outerId, ...innerIds], used = ids.flatMap(l => loops.get(l)!.coedges.map(c => coedges.get(c)!.edge));
      const seam = new Set(used.filter((e, i) => used.indexOf(e) !== i));
      const parts = ids.map(l => loops.get(l)!.coedges.map(c => { const co = coedges.get(c)!; return { points: along(co).slice(0, -1), seam: seam.has(co.edge) }; }));
      const { pts, tris } = cylinderTriangles(face, frame, parts, Math.PI / 2 / perQuarter); emit(face.id, 'trimmed', pts, tris, null); continue;
    }
    const sides = loops.get(outerId)!.coedges.map(id => coedges.get(id)!), count = sides.length;
    const rails = railsOf(face, loops, coedges, edges);
    if (rails === undefined) throw new BrepError('GEOMETRY', `face ${face.id}: only planar and ruled faces (two rails, straight sides) can be tessellated yet`);
    const [r1, r2] = rails, A = along(sides[r1]), B = [...along(sides[r2])].reverse();
    const chain = (from: number, to: number) => { const out: Point[] = []; for (let i = (from + 1) % count; i !== to; i = (i + 1) % count) out.push(...along(sides[i]).slice(0, -1)); return out.slice(1); };
    const right = chain(r1, r2), left = chain(r2, r1);
    const pts = [...A, ...B, ...right, ...left], tris: [number, number, number][] = [];
    // Zipper the two sides (A runs with the loop; B was reversed to run the same way).
    let i = 0, j = 0; const n = A.length - 1, m = B.length - 1, b0 = A.length;
    while (i < n || j < m) {
      const advanceA = j >= m || (i < n && (i + 1) / n <= (j + 1) / m);
      if (advanceA) { tris.push([i, i + 1, b0 + j]); i++; } else { tris.push([i, b0 + j + 1, b0 + j]); j++; }
    }
    // Side chains: the end triangle on each straight side becomes a fan over the chain's points.
    const fan = (t: number, from: number, to: number, interior: number[]) => {
      const x = tris[t].find(v => v !== from && v !== to)!, c = [from, ...interior, to];
      tris.splice(t, 1, ...c.slice(0, -1).map((v, k): [number, number, number] => [v, c[k + 1], x]));
    };
    const r0 = b0 + B.length, l0 = r0 + right.length;
    if (right.length) fan(tris.length - 1, n, b0 + m, right.map((_, k) => r0 + k));
    if (left.length) fan(0, b0, 0, left.map((_, k) => l0 + k));
    emit(face.id, 'ruled', pts, tris, null);
  }
  return {
    positionsMM: new Float64Array(positions), normals: new Float64Array(normals), indices: new Uint32Array(indices), faces,
    edges: brep.edges.map(e => ({ edgeId: e.id, pointsMM: new Float64Array(samples.get(e.id)!.flat()) })),
  };
}

/** Two rails facing each other with straight sides between them (each one line or a chain of lines). */
function railsOf(face: Brep['faces'][number], loops: Map<string, Brep['loops'][number]>, coedges: Map<string, BrepCoedge>, edges: Map<string, Brep['edges'][number]>): [number, number] | undefined {
  const outerId = face.loops.find(l => loops.get(l)!.kind === 'outer')!, inner = face.loops.length - 1;
  const sides = loops.get(outerId)!.coedges.map(id => coedges.get(id)!), count = sides.length, straight = sides.map(c => isLine(edges.get(c.edge)!.curve));
  if (inner === 0 && count === 4) { const i = [0, 1].find(i => straight[i + 1] && straight[(i + 3) % 4]); if (i !== undefined) return [i, i + 2]; }
  else if (inner === 0 && count > 4) { const curved = sides.flatMap((_, i) => straight[i] ? [] : [i]); if (curved.length === 2) return [curved[0], curved[1]]; }
  return undefined;
}

/** sameU: one tolerance for "the same θ column" in the sample pre-pass and in the cells. */
interface CylinderFrame { c: Point; a: Point; e1: Point; e2: Point; r: number; ref: number; outwardRadial: boolean; sameU: number; uv(p: Point): XY; at(u: number, v: number): Point }
/** A surface that extrudes a circular arc along its axis, with (U, V) = (r·θ unwrapped about the face centre, height). */
function cylinderFrame(S: Surface): CylinderFrame | null {
  if (S.degreeV !== 1 || S.controlPoints[0]?.length !== 2) return null;
  const base: Curve = { kind: 'curve', id: 'base', degree: S.degreeU, knots: S.knotsU, controlPoints: S.controlPoints.map(r => r[0]), weights: S.weights.map(w => w[0]) };
  const circle = circleOf(base); if (!circle) return null;
  const axis = sub(S.controlPoints[0][1], S.controlPoints[0][0]);
  const big = [0, 1, 2].reduce((m, i) => Math.abs(axis[i]) > Math.abs(axis[m]) ? i : m, 0), a = unit(axis[big] > 0 ? axis : [-axis[0], -axis[1], -axis[2]]);
  if (Math.abs(Math.abs(dot(cross(circle.e1, circle.e2), a)) - 1) > 1e-9) return null;
  const e1 = circle.e1, e2 = circle.e2, c = circle.c, r = circle.r;
  const u0 = S.knotsU[0], u1 = S.knotsU[S.knotsU.length - 1];
  const mid = evaluateSurfaceLocal(S, (u0 + u1) / 2, 0.5), d = sub(mid, c), ref = Math.atan2(dot(d, e2), dot(d, e1));
  const radial = unit(sub(d, [a[0] * dot(d, a), a[1] * dot(d, a), a[2] * dot(d, a)]));
  const du = evaluateSurfaceLocal(S, (u0 + u1) / 2 + 1e-6 * (u1 - u0), 0.5), dv = evaluateSurfaceLocal(S, (u0 + u1) / 2, 0.5 + 1e-6);
  const nParam = cross(sub(du, mid), sub(dv, mid));
  const wrap = (x: number) => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return { c, a, e1, e2, r, ref, outwardRadial: dot(nParam, radial) > 0, sameU: 1e-11 * Math.max(1, r),
    uv: p => { const q = sub(p, c); return [r * (ref + wrap(Math.atan2(dot(q, e2), dot(q, e1)) - ref)), dot(q, a)]; },
    at: (u, v) => { const t = u / r; return [c[0] + a[0] * v + r * (Math.cos(t) * e1[0] + Math.sin(t) * e2[0]), c[1] + a[1] * v + r * (Math.cos(t) * e1[1] + Math.sin(t) * e2[1]), c[2] + a[2] * v + r * (Math.cos(t) * e1[2] + Math.sin(t) * e2[2])]; } };
}
function evaluateSurfaceLocal(S: Surface, u: number, v: number): Point {
  // Linear in v over [0, 1] knots: blend the two rows of the u-curve.
  const row = (k: 0 | 1): Curve => ({ kind: 'curve', id: 'row', degree: S.degreeU, knots: S.knotsU, controlPoints: S.controlPoints.map(r => r[k]), weights: S.weights.map(w => w[k]) });
  const p = evaluateCurve(row(0), u), q = evaluateCurve(row(1), u), [v0, v1] = [S.knotsV[0], S.knotsV[S.knotsV.length - 1]], t = (v - v0) / (v1 - v0);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
}
/**
 * A trimmed cylinder face: its loops (the shared edge samples) triangulated in (r·θ, height), then
 * every interior edge spanning more than one angular step is bisected (with both triangles beside
 * it, so the mesh stays conforming). Boundary edges are never split: the face meets its neighbours
 * exactly at the shared edge samples.
 */
function cylinderTriangles(face: Brep['faces'][number], frame0: CylinderFrame, parts: { points: Point[]; seam: boolean }[][], step: number): { pts: Point[]; tris: [number, number, number][] } {
  const rings = parts.map(r => r.flatMap(c => c.points)), pts: Point[] = rings.flat(), outward = frame0.outwardRadial === (face.sense === 'forward');
  // A full-turn wall: its domain is centred opposite the seam; the seam going up lies on the right
  // when loops run counter-clockwise in (U, V) (outward radial), and points on the domain's edges take
  // the side of their neighbours along their coedge.
  let frame = frame0, uv: XY[];
  if (parts.some(r => r.some(c => c.seam))) {
    const p0 = parts.flat().find(c => c.seam)!.points[0], d = sub(p0, frame0.c), ref = Math.atan2(dot(d, frame0.e2), dot(d, frame0.e1)) + Math.PI, r = frame0.r;
    const wrap = (x: number) => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    frame = { ...frame0, ref, uv: p => { const q = sub(p, frame0.c); return [r * (ref + wrap(Math.atan2(dot(q, frame0.e2), dot(q, frame0.e1)) - ref)), dot(q, frame0.a)]; } };
    const lo = r * (ref - Math.PI), hi = r * (ref + Math.PI), edge = (u: number) => Math.abs(u - lo) < 1e-9 * r || Math.abs(u - hi) < 1e-9 * r;
    uv = parts.flatMap(ring => ring.flatMap((c, ci) => {
      const local = c.points.map(p => frame.uv(p));
      if (c.seam) {
        const next = ring[(ci + 1) % ring.length].points[0], up = frame.uv(next)[1] > local[0][1], right = up === outward;
        return local.map(([, v]) => [right ? hi : lo, v] as XY);
      }
      return local.map((q, i) => {
        if (!edge(q[0])) return q;
        const n = local.find((x, j) => j !== i && !edge(x[0])) ?? frame.uv(ring[(ci + 1) % ring.length].points[0]);
        return [Math.abs(n[0] - lo) < Math.abs(n[0] - hi) ? lo : hi, q[1]] as XY;
      });
    }));
  } else uv = pts.map(p => frame.uv(p));
  // Rings run counter-clockwise about the outward normal; in (U, V) that is counter-clockwise when the
  // outward normal is radial. Otherwise mirror U for the triangulation.
  let area = 0; const outerN = rings[0].length;
  for (let i = 0; i < outerN; i++) { const a = uv[i], b = uv[(i + 1) % outerN]; area += a[0] * b[1] - b[0] * a[1]; }
  const flip = area < 0, flat = (q: XY): XY => flip ? [-q[0], q[1]] : q;
  // Ears narrowest in U first: a zipper of strips across the face, not slivers spanning its width (and
  // samples along a straight run are never convex ears, so no zero-area triangles).
  let off = 0; const ringsUV = rings.map(r => { const out = uv.slice(off, off + r.length).map(flat); off += r.length; return out; });
  const uWidth = (a: XY, b: XY, c: XY) => Math.max(a[0], b[0], c[0]) - Math.min(a[0], b[0], c[0]);
  const tris = triangulatePolygonWithHoles(ringsUV[0], ringsUV.slice(1), uWidth).map(t => [...t] as [number, number, number]);
  const key = (a: number, b: number) => a < b ? a * 1e7 + b : b * 1e7 + a;
  const around = new Map<number, Set<number>>();
  const link = (t: number) => { const [a, b, c] = tris[t]; for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = key(x, y); if (!around.has(k)) around.set(k, new Set()); around.get(k)!.add(t); } };
  const unlink = (t: number) => { const [a, b, c] = tris[t]; for (const [x, y] of [[a, b], [b, c], [c, a]]) around.get(key(x, y))?.delete(t); };
  tris.forEach((_, t) => link(t));
  // Rivara's longest-edge bisection (LEPP): to refine a triangle wider (in U) than one angular step,
  // follow neighbours across widest edges until two triangles share their widest edge, bisect it in
  // both, and repeat. Terminates; boundary chords (at most one step) are never the edge split.
  // Lengths in (U, V/20): the surface is straight along V, so triangles may be long that way (an
  // affine metric keeps Rivara's termination); ties are broken by index.
  const span = frame.r * step, width = (a: number, b: number) => Math.hypot(uv[a][0] - uv[b][0], (uv[a][1] - uv[b][1]) / 20) + 1e-15 * (a + b) / (a * b + 1);
  const widest = (t: number): [number, number] => { const [a, b, c] = tris[t]; return ([[a, b], [b, c], [c, a]] as [number, number][]).reduce((m, e) => width(e[0], e[1]) > width(m[0], m[1]) ? e : m); };
  const across = (t: number, a: number, b: number) => [...(around.get(key(a, b)) ?? [])].find(x => x !== t);
  const bisect = (a: number, b: number) => {
    const m = pts.length, mid: XY = [(uv[a][0] + uv[b][0]) / 2, (uv[a][1] + uv[b][1]) / 2];
    pts.push(frame.at(mid[0], mid[1])); uv.push(mid);
    for (const t of [...around.get(key(a, b))!]) {
      const tri = tris[t], i = tri.indexOf(a), j = tri.indexOf(b), c = tri[3 - i - j];
      unlink(t);
      // Keep the winding: (x, y, c) with (x, y) in the triangle's own order.
      const [x, y] = (j === (i + 1) % 3) ? [a, b] : [b, a];
      tris[t] = [x, m, c]; link(t); tris.push([m, y, c]); link(tris.length - 1);
    }
  };
  for (let t = 0, guard = 0; t < tris.length && guard < 1e6; guard++) {
    const [a, b] = widest(t), [p0, p1, p2] = tris[t];
    if (Math.max(uv[p0][0], uv[p1][0], uv[p2][0]) - Math.min(uv[p0][0], uv[p1][0], uv[p2][0]) <= span) { t++; continue; }
    // The longest-edge propagation path from t.
    let cur = t, [x, y] = [a, b];
    for (let depth = 0; depth < 1000; depth++) {
      const next = across(cur, x, y);
      if (next === undefined) break; // a boundary edge (cannot happen when wider than a step)
      const [p, q] = widest(next);
      if (key(p, q) === key(x, y)) break;
      cur = next; [x, y] = [p, q];
    }
    if (across(cur, x, y) === undefined) { t++; continue; }
    bisect(x, y);
  }
  // Wound for the outward normal.
  return { pts, tris: tris.map(([a, b, c]) => (outward !== flip) ? [a, b, c] : [a, c, b]) };
}
