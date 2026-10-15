// Display tessellation of a shared B-rep (brep-core step 2). Every edge is sampled once and both of
// its faces use those exact points, so the mesh is watertight by construction (no welding). The B-rep
// edges come out as polylines too, so viewers can draw real model edges instead of guessing creases.
//
//   planar faces       boundary loops (outer + holes) projected to the plane, holes bridged, ear-clipped
//   ruled faces        two rails joined by straight sides, each side one line or a chain of collinear
//                      lines (extruded sides, cylinder walls with a seam, walls spanning several
//                      levels): triangle strip between the rails, fans over the side chains
//   trimmed cylinders  any other face on a circular cylinder (holes, notches, L-shapes in its domain):
//                      boundaries mapped to (r·θ, height), where they are horizontal and vertical; cut
//                      into cells at every boundary sample's θ and triangulated cell by cell. Edges of
//                      such faces first get samples at every vertex θ and height of the face, so the
//                      cells meet the neighbouring faces' samples exactly (watertight)
//   other faces        refused for now (BrepError GEOMETRY)
import { BrepError, type Brep, type BrepCoedge } from './brep-core.js';
import { evaluateCurve, curveDomain } from './math.js';
import type { Curve, Point, Surface } from './types.js';

export interface BrepMeshFace { readonly faceId: string; readonly kind: 'planar' | 'ruled' | 'trimmed'; readonly vertexOffset: number; readonly vertexCount: number; readonly indexOffset: number; readonly indexCount: number }
export interface BrepMeshEdge { readonly edgeId: string; readonly pointsMM: Float64Array }
export interface BrepMesh { readonly positionsMM: Float64Array; readonly normals: Float64Array; readonly indices: Uint32Array; readonly faces: readonly BrepMeshFace[]; readonly edges: readonly BrepMeshEdge[] }
export interface BrepTessellationOptions { readonly segmentsPerQuarter?: number }

type XY = [number, number];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point): Point => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
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
export function triangulatePolygonWithHoles(outer: readonly XY[], holes: readonly (readonly XY[])[]): [number, number, number][] {
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
    for (let k = 0; k < ring.length; k++) {
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
  // Trimmed cylinder faces: every edge of such a face gets samples at every sample θ (arcs) and every
  // vertex height (generators) of the face, repeated until no edge changes (edges are shared).
  const trimmed = new Map<string, CylinderFrame>(), params = new Map(brep.edges.map(e => [e.id, edgeParameters(e.curve, perQuarter)]));
  const faceEdges = new Map<string, string[]>();
  for (const face of brep.faces) {
    if (planar(face.surface)) continue;
    const frame = cylinderFrame(face.surface); if (!frame || railsOf(face, loops, coedges, edges) !== undefined) continue;
    trimmed.set(face.id, frame); faceEdges.set(face.id, face.loops.flatMap(l => loops.get(l)!.coedges.map(c => coedges.get(c)!.edge)));
  }
  const circles = new Map<string, NonNullable<ReturnType<typeof circleOf>>>();
  for (let round = 0, changed = trimmed.size > 0; changed && round < 16; round++) {
    changed = false;
    for (const [faceId, frame] of trimmed) {
      const ids = faceEdges.get(faceId)!, us: number[] = [], vs: number[] = [];
      for (const id of ids) {
        const c = edges.get(id)!.curve, ts = params.get(id)!;
        for (const t of [ts[0], ts[ts.length - 1]]) vs.push(frame.uv(evaluateCurve(c, t))[1]);
        if (!isLine(c)) for (const t of ts) us.push(frame.uv(evaluateCurve(c, t))[0]);
      }
      for (const id of ids) {
        const c = edges.get(id)!.curve, ts = params.get(id)!, [t0, t1] = curveDomain(c), more: number[] = [];
        if (isLine(c)) {
          const v0 = frame.uv(evaluateCurve(c, t0))[1], v1 = frame.uv(evaluateCurve(c, t1))[1], have = ts.map(t => v0 + (v1 - v0) * (t - t0) / (t1 - t0));
          for (const v of vs) { const t = (v - v0) / (v1 - v0); if (t > 1e-9 && t < 1 - 1e-9 && !have.some(h => Math.abs(h - v) <= 1e-9 * Math.max(1, Math.abs(v)))) more.push(t0 + (t1 - t0) * t); }
        } else {
          let circle = circles.get(id); if (!circle) { circle = circleOf(c) ?? undefined; if (circle) circles.set(id, circle); }
          if (!circle) continue;
          const have = ts.map(t => frame.uv(evaluateCurve(c, t))[0]);
          for (const u of us) { if (have.some(h => Math.abs(h - u) <= 1e-9 * Math.max(1, Math.abs(u)))) continue; const t = arcParameterAt(c, circle, u / frame.r); if (t !== null && t > t0 + 1e-12 && t < t1 - 1e-12) more.push(t); }
        }
        if (more.length) {
          // Values found through different vertices of one height or angle differ by rounding: keep one.
          const all = [...ts, ...more].sort((a, b) => a - b), gap = 1e-9 * (t1 - t0), clean = [all[0]];
          for (const t of all) if (t - clean[clean.length - 1] > gap) clean.push(t);
          clean[clean.length - 1] = t1;
          if (clean.length !== ts.length) { params.set(id, clean); changed = true; }
        }
      }
    }
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
    if (frame) { const { pts, tris } = cylinderCells(face, frame, [ring(outerId), ...innerIds.map(ring)]); emit(face.id, 'trimmed', pts, tris, null); continue; }
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

interface CylinderFrame { c: Point; a: Point; e1: Point; e2: Point; r: number; ref: number; outwardRadial: boolean; uv(p: Point): XY; at(u: number, v: number): Point }
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
  return { c, a, e1, e2, r, ref, outwardRadial: dot(nParam, radial) > 0,
    uv: p => { const q = sub(p, c); return [r * (ref + wrap(Math.atan2(dot(q, e2), dot(q, e1)) - ref)), dot(q, a)]; },
    at: (u, v) => { const t = u / r; return [c[0] + a[0] * v + r * (Math.cos(t) * e1[0] + Math.sin(t) * e2[0]), c[1] + a[1] * v + r * (Math.cos(t) * e1[1] + Math.sin(t) * e2[1]), c[2] + a[2] * v + r * (Math.cos(t) * e1[2] + Math.sin(t) * e2[2])]; } };
}
function evaluateSurfaceLocal(S: Surface, u: number, v: number): Point {
  // Linear in v over [0, 1] knots: blend the two rows of the u-curve.
  const row = (k: 0 | 1): Curve => ({ kind: 'curve', id: 'row', degree: S.degreeU, knots: S.knotsU, controlPoints: S.controlPoints.map(r => r[k]), weights: S.weights.map(w => w[k]) });
  const p = evaluateCurve(row(0), u), q = evaluateCurve(row(1), u), [v0, v1] = [S.knotsV[0], S.knotsV[S.knotsV.length - 1]], t = (v - v0) / (v1 - v0);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
}
/** The parameter of a circular-arc edge at absolute frame angle θ, or null outside the arc. */
function arcParameterAt(curve: Curve, circle: NonNullable<ReturnType<typeof circleOf>>, theta: number): number | null {
  const total = circle.spans.reduce((a, s) => a + s.phi, 0);
  let beta = (theta - circle.a0) * circle.sign; beta = ((beta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (beta > total) return null;
  let acc = 0, s = 0; while (s < circle.spans.length - 1 && acc + circle.spans[s].phi < beta) acc += circle.spans[s++].phi;
  const sp = circle.spans[s], tau = (Math.tan((beta - acc - sp.phi / 2) / 2) / Math.tan(sp.phi / 4) + 1) / 2;
  return sp.k0 + (sp.k1 - sp.k0) * Math.min(1, Math.max(0, tau));
}

/** Cells between consecutive boundary θ values, each triangulated in (U, V); boundary points are kept exactly. */
function cylinderCells(face: Brep['faces'][number], frame: CylinderFrame, rings: Point[][]): { pts: Point[]; tris: [number, number, number][] } {
  const boundary = rings.flat(), uvs = boundary.map(p => frame.uv(p));
  let scale = 1; for (const [u, v] of uvs) scale = Math.max(scale, Math.abs(u), Math.abs(v));
  const eps = 1e-9 * scale;
  // Column lines: the distinct U of the boundary points (merged within eps).
  const sortedU = uvs.map(x => x[0]).sort((a, b) => a - b), Us: number[] = [];
  for (const u of sortedU) if (!Us.length || u - Us[Us.length - 1] > eps) Us.push(u);
  const col = (u: number) => { let lo = 0, hi = Us.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (Us[m] < u - eps) lo = m + 1; else hi = m; } return lo; };
  const segs: { k0: number; k1: number; v: number }[] = [];
  let off = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = uvs[off + i], b = uvs[off + (i + 1) % ring.length], ka = col(a[0]), kb = col(b[0]);
      if (ka !== kb && Math.abs(a[1] - b[1]) > eps * 1e3)
        throw new BrepError('GEOMETRY', `face ${face.id}: only planar and ruled faces, and cylinders trimmed along generators and cross-section circles, can be tessellated yet`);
      if (ka !== kb) segs.push({ k0: Math.min(ka, kb), k1: Math.max(ka, kb), v: (a[1] + b[1]) / 2 });
    }
    off += ring.length;
  }
  // Nodes: boundary points by (column, V); interior nodes are added on demand.
  const pts: Point[] = [], nodes = new Map<number, { v: number; i: number }[]>();
  const node = (k: number, v: number, p?: Point) => {
    const list = nodes.get(k) ?? []; let n = list.find(x => Math.abs(x.v - v) <= eps);
    if (!n) { n = { v, i: pts.length }; pts.push(p ?? frame.at(Us[k], v)); list.push(n); nodes.set(k, list); }
    return n.i;
  };
  uvs.forEach((x, i) => node(col(x[0]), x[1], boundary[i]));
  const cells: { k: number; v0: number; v1: number }[] = [];
  for (let k = 0; k + 1 < Us.length; k++) {
    const vs = segs.filter(s => s.k0 <= k && s.k1 >= k + 1).map(s => s.v).sort((a, b) => a - b);
    if (vs.length % 2) throw new BrepError('GEOMETRY', `face ${face.id}: its cylinder domain does not close`);
    for (let j = 0; j < vs.length; j += 2) if (vs[j + 1] - vs[j] > eps) { cells.push({ k, v0: vs[j], v1: vs[j + 1] }); node(k, vs[j]); node(k, vs[j + 1]); node(k + 1, vs[j]); node(k + 1, vs[j + 1]); }
  }
  const tris: [number, number, number][] = [];
  for (const { k, v0, v1 } of cells) {
    const side = (kk: number, up: boolean) => (nodes.get(kk) ?? []).filter(n => n.v > v0 + eps && n.v < v1 - eps).sort((x, y) => up ? x.v - y.v : y.v - x.v).map(n => n.i);
    const ring = [node(k, v0), node(k + 1, v0), ...side(k + 1, true), node(k + 1, v1), node(k, v1), ...side(k, false)];
    const flat = ring.map(i => { const q = frame.uv(pts[i]); return [Math.abs(q[0] - Us[k]) < Math.abs(q[0] - Us[k + 1]) ? Us[k] : Us[k + 1], q[1]] as XY; });
    for (const [a, b, c] of triangulatePolygonWithHoles(flat, [])) tris.push(frame.outwardRadial === (face.sense === 'forward') ? [ring[a], ring[b], ring[c]] : [ring[a], ring[c], ring[b]]);
  }
  return { pts, tris };
}
