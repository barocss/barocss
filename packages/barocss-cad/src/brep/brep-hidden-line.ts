// Hidden-line projection of B-rep solids for 2D drawings: an orthographic view of one or more B-reps
// as exact 2D curves, each split into visible and hidden pieces.
//
//   curves       every B-rep edge except seams, edges between coplanar faces and smooth (tangent)
//                joints, plus the silhouettes of curved faces (where the surface turns away from the
//                viewer). Lines stay lines and circular arcs become (elliptic) arcs, exactly; other
//                edges and silhouettes are polylines from the tessellation. A cylinder's silhouette is
//                its exact generator line.
//   visibility   each curve is sampled along its length and every sample is tested against the
//                tessellated faces (any face whose projection covers it nearer to the viewer hides it);
//                changes between samples are found by bisection. Hidden runs that lie on visible ink
//                are dropped (visible lines take precedence), as are silhouettes along a visible edge.
import { faceGeometry } from './analytic-boolean.js';
import type { Brep } from './brep-core.js';
import { circleOf, tessellateBrep } from './brep-tessellate.js';
import type { Point } from '../types.js';
import { cross, dot, len, lerp as lerp3, sub, unit } from '../core/vec3.js';

export type ProjectedXY = readonly [number, number];
/** `toward`: from the model to the viewer; `up`: the direction shown upwards (need not be orthogonal). */
export interface HiddenLineView { readonly toward: Point; readonly up: Point }
/** An arc is `center + u·cos t + v·sin t` for t from t0 to t1 (an ellipse unless u, v are orthogonal and equal). */
export type ProjectedCurve =
  | { readonly kind: 'line'; readonly a: ProjectedXY; readonly b: ProjectedXY }
  | { readonly kind: 'arc'; readonly center: ProjectedXY; readonly u: ProjectedXY; readonly v: ProjectedXY; readonly t0: number; readonly t1: number }
  | { readonly kind: 'polyline'; readonly points: readonly ProjectedXY[] };
export interface ProjectedPiece { readonly curve: ProjectedCurve; readonly visible: boolean }
/**
 * One curve of the view: a B-rep edge (by its persistent name) or a face's silhouette (`<face>~sil<k>`).
 * `ends`: its 3D end points (none for a closed circle); `circle`: a circular edge's exact geometry (`sweep`: its angle).
 * `pieces` is empty when the whole curve lies on visible ink (a hole's rim seen edge-on along the outline).
 */
export interface ProjectedEdge {
  readonly name: string;
  readonly kind: 'line' | 'circle' | 'curve' | 'silhouette';
  /** A tangent edge: a smooth joint between two different surfaces (only with `tangentEdges`). */
  readonly tangent?: true;
  readonly ends: readonly [Point, Point] | null;
  readonly circle: { readonly center: Point; readonly radius: number; readonly normal: Point; readonly full: boolean; readonly sweep: number } | null;
  readonly pieces: readonly ProjectedPiece[];
}
/** 2D coordinates are `p·right`, `p·up`; `min`/`max` bound every piece. */
export interface BrepProjection {
  readonly right: Point; readonly up: Point; readonly toward: Point;
  readonly edges: readonly ProjectedEdge[];
  readonly min: ProjectedXY; readonly max: ProjectedXY;
}
/** `prefixes`: put before the names of each B-rep's curves (parallel to the B-reps), to tell copies of one part apart. */
/** `tangentEdges`: also the smooth joints between different surfaces (a fillet's boundaries), marked `tangent`. */
/** A mesh solid's facet (brepFromTriangles names them `<id>.facet<k>`). */
const FACET = /\.facet\d+$/;
/** A face of a mesh solid: a planar mesh's by name, a facet face by kind (F0). */
const meshy = (f: Brep['faces'][number]) => f.surface.kind === 'facets' || FACET.test(f.name ?? '');
export interface HiddenLineOptions { readonly segmentsPerQuarter?: number; readonly prefixes?: readonly string[]; readonly tangentEdges?: boolean }

type XY = [number, number];
interface Candidate {
  name: string; kind: ProjectedEdge['kind']; tangent?: true; ends: [Point, Point] | null; circle: ProjectedEdge['circle'];
  s0: number; s1: number; at(s: number): Point; out(s0: number, s1: number): ProjectedCurve;
  /** Where visibility is tested at s (default `at`): a circle's chord on the tessellation, so its own faces' facets do not stand in front of it. */
  probe?(s: number): Point;
  /** Sample parameters (increasing, from s0 to s1). */
  samples(): number[];
  /** Depth margin below which a nearer face does not hide this curve. */
  eps: number;
  /**
   * A silhouette's face, whose facets do not hide it close by: on a cylinder only from farther than
   * their sag (a generator snapped onto a concave wall sits behind its facets); on other surfaces not
   * within `rho` (the facets turning edge-on there fold over it).
   */
  own?: Own;
}

const dist2 = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1]);
type Own = { face: number; eps: number; rho: number };

// Each face's plane or cylinder (or neither), read once per face object: every view asks for it.
const faceGeometries = new WeakMap<object, ReturnType<typeof faceGeometry>>();
function geometryOfFace(face: Brep['faces'][number]): ReturnType<typeof faceGeometry> {
  let g = faceGeometries.get(face);
  if (!g) { try { g = faceGeometry(face); } catch { g = { kind: 'other' }; } faceGeometries.set(face, g); }
  return g;
}
// A B-rep's tessellation per quality, made once: a drawing projects the same part in several views.
const meshes = new WeakMap<Brep, Map<number, ReturnType<typeof tessellateBrep>>>();
function meshOf(b: Brep, perQuarter: number): ReturnType<typeof tessellateBrep> {
  let byQuality = meshes.get(b); if (!byQuality) meshes.set(b, byQuality = new Map());
  let m = byQuality.get(perQuarter); if (!m) byQuality.set(perQuarter, m = tessellateBrep(b, { segmentsPerQuarter: perQuarter }));
  return m;
}
export function projectBrepHiddenLines(breps: readonly Brep[], view: HiddenLineView, options: HiddenLineOptions = {}): BrepProjection {
  const toward = unit(view.toward), right = unit(cross(view.up, toward));
  if (len(right) < 0.5) throw new Error('The view up direction is parallel to the view direction.');
  const up = cross(toward, right);
  const P = (p: Point): XY => [dot(p, right), dot(p, up)];
  const D = (p: Point) => dot(p, toward);

  // Occluders: every face's triangles in view coordinates.
  const tris: number[] = [], triFace: number[] = [], triAt: number[] = [], faceSag: number[] = [], faceSpan: number[] = [];
  const perQuarter = options.segmentsPerQuarter ?? 12;
  const meshes = breps.map(b => meshOf(b, perQuarter));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of meshes) {
    const X = m.positions;
    for (let k = 0; k < X.length; k += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], X[k + c]); hi[c] = Math.max(hi[c], X[k + c]); }
  }
  const size = Number.isFinite(lo[0]) ? Math.max(1e-6, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])) : 1;
  // Faces are numbered across all B-reps (mesh face order); `faceSag`: how far a face's facets stand off
  // its surface, from each facet side's length and the turn of the normals along it (chord · turn / 8).
  const faceBase: number[] = [];
  for (const m of meshes) {
    faceBase.push(faceSag.length);
    const X = m.positions, I = m.indices, N = m.normals;
    const turn = (i: number, j: number) => { const a: Point = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], b: Point = [N[j * 3], N[j * 3 + 1], N[j * 3 + 2]]; return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b) || 1)))); };
    for (const f of m.faces) {
      const fi = faceSag.length; let sag = 0, span = 0;
      for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) {
        const ix = [I[t], I[t + 1], I[t + 2]], v = ix.map(i => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]] as Point);
        for (let k = 0; k < 3; k++) { const l = len(sub(v[(k + 1) % 3], v[k])); sag = Math.max(sag, l * turn(ix[k], ix[(k + 1) % 3]) / 8); span = Math.max(span, l); }
        const q = v.map(P);
        const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
        if (Math.abs(area) <= 1e-12 * size * size) continue; // seen edge-on: covers nothing
        tris.push(q[0][0], q[0][1], D(v[0]), q[1][0], q[1][1], D(v[1]), q[2][0], q[2][1], D(v[2]));
        triFace.push(fi); triAt.push(...[0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k]) / 3));
      }
      faceSag.push(sag); faceSpan.push(span);
    }
  }
  const occluder = triangleGrid(tris, triFace, triAt);
  const hidden = (p: Point, c: Candidate) => occluder.covers(P(p), p, D(p) + c.eps, c.own ?? null);

  const candidates: Candidate[] = [], silhouettes: Candidate[] = [];
  const h = size / 300; // sampling step along a curve (view units)
  breps.forEach((brep, bi) => {
    const mesh = meshes[bi];
    const loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
    const faceById = new Map(brep.faces.map(f => [f.id, f]));
    const facesOf = new Map<string, string[]>();
    for (const c of brep.coedges) facesOf.set(c.edge, [...(facesOf.get(c.edge) ?? []), loopFace.get(c.loop)!]);
    const meshFace = new Map(mesh.faces.map(f => [f.faceId, f]));
    const X = mesh.positions, N = mesh.normals;
    // A face's tessellation normal at one of its vertices (by position).
    const normalAt = (faceId: string, p: Point): Point | null => {
      const f = meshFace.get(faceId); if (!f) return null;
      let best = -1, bestD = Infinity;
      for (let v = f.vertexOffset; v < f.vertexOffset + f.vertexCount; v++) {
        const d = Math.abs(X[v * 3] - p[0]) + Math.abs(X[v * 3 + 1] - p[1]) + Math.abs(X[v * 3 + 2] - p[2]);
        if (d < bestD) { bestD = d; best = v; }
      }
      return best < 0 || bestD > 1e-6 * size ? null : [N[best * 3], N[best * 3 + 1], N[best * 3 + 2]];
    };
    const normalOn = (g: ReturnType<typeof faceGeometry>, faceId: string, p: Point): Point | null => {
      if (g.kind === 'plane') return g.n;
      if (g.kind === 'cylinder') { const rel = sub(p, g.c), t = dot(rel, g.a); return sub(rel, [g.a[0] * t, g.a[1] * t, g.a[2] * t]); }
      return normalAt(faceId, p);
    };
    const geomOf = (id: string) => geometryOfFace(faceById.get(id)!);
    const polylineOf = new Map(mesh.edges.map(e => [e.edgeId, e.points]));
    const vertex = new Map(brep.vertices.map(v => [v.id, v.point]));

    for (const edge of brep.edges) {
      const fs = facesOf.get(edge.id) ?? [];
      if (fs.length === 2 && fs[0] === fs[1]) continue; // a seam
      const pts = polylineOf.get(edge.id);
      if (!pts || pts.length < 6) continue;
      let kind: 'edge' | 'silhouette' | 'tangent' = 'edge';
      if (fs.length === 2) {
        const ga = geomOf(fs[0]), gb = geomOf(fs[1]);
        if (ga.kind === 'plane' && gb.kind === 'plane' && Math.abs(dot(ga.n, gb.n)) > 1 - 1e-9 && Math.abs(dot(sub(ga.o, gb.o), ga.n)) < 1e-6 * size) continue;
        const k = Math.floor(pts.length / 6) * 3, mid: Point = [pts[k], pts[k + 1], pts[k + 2]];
        // A smooth joint: the faces' normals agree there (exactly for planes and cylinders; within a
        // facet's turn for tessellation normals). It is drawn only where the surface turns away from
        // the viewer along it (a silhouette on the joint).
        const exact = (g: ReturnType<typeof faceGeometry>) => g.kind === 'plane' || g.kind === 'cylinder';
        const na = normalOn(ga, fs[0], mid), nb = normalOn(gb, fs[1], mid);
        // Facets of a mesh solid (a modelled thread, an STL) join smoothly within 20°: drawn only where
        // the solid's outline runs along them (one facet towards the viewer, the other away).
        const facets = meshy(faceById.get(fs[0])!) && meshy(faceById.get(fs[1])!);
        if (facets && na && nb && dot(unit(na), unit(nb)) > Math.cos(Math.PI / 9)) {
          if (Math.sign(dot(na, toward)) !== Math.sign(dot(nb, toward))) kind = 'silhouette';
          else if (options.tangentEdges) kind = 'tangent';
          else continue;
        }
        const within = exact(ga) && exact(gb) ? Math.PI / 180 : 1.5 * Math.PI / 2 / perQuarter;
        if (kind === 'edge' && na && nb && Math.abs(dot(unit(na), unit(nb))) > Math.cos(within)) {
          // (Between other surfaces, the silhouettes found on the faces run on across the joint.)
          if (exact(ga) && exact(gb) && Math.abs(dot(unit(na), toward)) < 1e-6) kind = 'silhouette';
          else if (options.tangentEdges && !sameSurface(ga, gb, faceById.get(fs[0])!.name ?? fs[0], faceById.get(fs[1])!.name ?? fs[1])) kind = 'tangent';
          else continue;
        }
      }
      const name = (options.prefixes?.[bi] ?? '') + (edge.name ?? edge.id) + (kind === 'silhouette' ? '~sil' : ''), c = edge.curve, into = kind === 'silhouette' ? silhouettes : candidates;
      const tangent = kind === 'tangent' ? { tangent: true as const } : {};
      const a = vertex.get(edge.vertices[0])!, b = vertex.get(edge.vertices[1])!;
      if (c.degree === 1 && c.controlPoints.length === 2) {
        const A = c.controlPoints[0] as Point, B = c.controlPoints[1] as Point;
        const L = dist2(P(A), P(B));
        if (L <= 1e-9 * size) continue; // seen end-on
        into.push({ name, ...tangent, kind: kind === 'silhouette' ? 'silhouette' : 'line', ends: [A, B], circle: null, s0: 0, s1: 1, eps: 1e-5 * size,
          at: s => lerp3(A, B, s), out: (s0, s1) => ({ kind: 'line', a: P(lerp3(A, B, s0)), b: P(lerp3(A, B, s1)) }),
          samples: () => steps(0, 1, Math.ceil(L / h)) });
        continue;
      }
      const circle = circleOf(c);
      if (circle) {
        const total = circle.spans.reduce((t, s) => t + s.phi, 0), full = total > 2 * Math.PI - 1e-9;
        const theta = (s: number) => circle.a0 + circle.sign * s;
        const at = (s: number): Point => { const t = theta(s), co = Math.cos(t) * circle.r, si = Math.sin(t) * circle.r;
          return [circle.c[0] + co * circle.e1[0] + si * circle.e2[0], circle.c[1] + co * circle.e1[1] + si * circle.e2[1], circle.c[2] + co * circle.e1[2] + si * circle.e2[2]]; };
        const C = P(circle.c), U = P(circle.e1).map(x => x * circle.r) as XY, V = P(circle.e2).map(x => x * circle.r) as XY;
        const extent = Math.max(Math.hypot(...U), Math.hypot(...V));
        if (extent <= 1e-9 * size) continue;
        const normal = cross(circle.e1, circle.e2);
        // The tessellation's samples of the arc, by their parameter s along it.
        let poly: Point[] = []; for (let k = 0; k < pts.length; k += 3) poly.push([pts[k], pts[k + 1], pts[k + 2]]);
        const sOf = (p: Point) => { const q = sub(p, circle.c), t = Math.atan2(dot(q, circle.e2), dot(q, circle.e1)); let x = (circle.sign * (t - circle.a0)) % (2 * Math.PI); if (x < -1e-9) x += 2 * Math.PI; return Math.max(0, x); };
        if (!full && sOf(poly[0]) > total / 2) poly = poly.reverse();
        const ps = poly.map(sOf); ps[0] = 0;
        for (let k = 1; k < ps.length; k++) if (ps[k] < ps[k - 1] - 1e-9) ps[k] += 2 * Math.PI;
        ps[ps.length - 1] = total;
        const probe = (s: number): Point => {
          let k = 0; while (k < ps.length - 2 && ps[k + 1] < s) k++;
          const d = ps[k + 1] - ps[k]; return lerp3(poly[k], poly[k + 1], d > 0 ? Math.min(1, Math.max(0, (s - ps[k]) / d)) : 0);
        };
        into.push({ name, ...tangent, kind: kind === 'silhouette' ? 'silhouette' : 'circle', ends: full ? null : [a, b], circle: { center: circle.c, radius: circle.r, normal, full, sweep: total }, s0: 0, s1: total, eps: 1e-5 * size, at, probe,
          out: (s0, s1) => arcOut(C, U, V, theta(s0), theta(s1)),
          samples: () => steps(0, total, Math.max(Math.ceil(extent * total / h), Math.ceil(total / (Math.PI / 32)))) });
        continue;
      }
      const poly: Point[] = []; for (let k = 0; k < pts.length; k += 3) poly.push([pts[k], pts[k + 1], pts[k + 2]]);
      const cand = polylineCandidate(name, kind === 'silhouette' ? 'silhouette' : 'curve', poly, P, h, 1e-5 * size);
      if (cand) into.push({ ...cand, ...tangent });
    }

    // Silhouettes: where the tessellation's vertex normals turn edge-on, face by face. Off cylinders
    // the normals are averaged with smooth neighbours' at shared points, so a silhouette crossing from
    // one face to the next meets itself there.
    const I = mesh.indices;
    const key = (v: number) => `${X[v * 3]},${X[v * 3 + 1]},${X[v * 3 + 2]}`;
    const together = new Map<string, number[]>();
    for (let v = 0; v < X.length / 3; v++) { const k = key(v); together.set(k, [...(together.get(k) ?? []), v]); }
    const smoothTurn = Math.cos(3 * Math.PI / 2 / perQuarter);
    const smoothNormal = (v: number): Point => {
      const n: Point = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], sum: Point = [0, 0, 0];
      for (const u of together.get(key(v)) ?? [v]) {
        const m: Point = [N[u * 3], N[u * 3 + 1], N[u * 3 + 2]];
        if (dot(m, n) >= smoothTurn * len(m) * len(n)) for (let k = 0; k < 3; k++) sum[k] += m[k];
      }
      return sum;
    };
    mesh.faces.forEach((f, fk) => {
      const face = faceById.get(f.faceId)!, g = geomOf(f.faceId), faceIndex = faceBase[bi] + fk;
      if (g.kind === 'plane' || f.kind === 'planar') return;
      let w: Point | null = null;
      if (g.kind === 'cylinder') {
        const aw = cross(g.a, toward); if (len(aw) < 1e-6) return; // seen along its axis: no silhouette
        w = unit(aw);
      }
      const normals = new Map<number, Point>();
      const s = (v: number) => {
        let n = normals.get(v);
        if (!n) { n = g.kind === 'cylinder' ? [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]] : smoothNormal(v); normals.set(v, n); }
        const x = dot(n, toward) / (len(n) || 1); return Math.abs(x) < 1e-9 ? 0 : x;
      };
      const pos = (v: number): Point => [X[v * 3], X[v * 3 + 1], X[v * 3 + 2]];
      const crossing = (i: number, j: number): Point => {
        // Canonical order (by position), so both triangles of an edge compute the same point.
        const pi = pos(i), pj = pos(j);
        if (pi[0] > pj[0] || (pi[0] === pj[0] && (pi[1] > pj[1] || (pi[1] === pj[1] && pi[2] > pj[2])))) return crossing(j, i);
        const si = s(i), sj = s(j); return lerp3(pi, pj, si / (si - sj));
      };
      const segs: [Point, Point][] = [];
      for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) {
        const v = [I[t], I[t + 1], I[t + 2]], neg = v.map(x => s(x) < 0);
        const n = neg.filter(Boolean).length; if (n === 0 || n === 3) continue;
        const odd = neg.findIndex(x => x === (n === 1)), o1 = (odd + 1) % 3, o2 = (odd + 2) % 3;
        segs.push([crossing(v[odd], v[o1]), crossing(v[odd], v[o2])]);
      }
      if (!segs.length) return;
      const cyl = g.kind === 'cylinder' ? g : null;
      const snap = (p: Point): Point => {
        if (!cyl || !w) return p;
        const rel = sub(p, cyl.c), t = dot(rel, cyl.a), sg = dot(rel, w) >= 0 ? 1 : -1;
        return [cyl.c[0] + cyl.a[0] * t + w[0] * cyl.r * sg, cyl.c[1] + cyl.a[1] * t + w[1] * cyl.r * sg, cyl.c[2] + cyl.a[2] * t + w[2] * cyl.r * sg];
      };
      const chains = chainSegments(segs, 1e-7 * size).map(ch => simplify(ch.map(snap), 1e-9 * size)).filter(ch => ch.length >= 2);
      chains.sort((p, q) => { const a = P(p[Math.floor(p.length / 2)]), b = P(q[Math.floor(q.length / 2)]); return a[0] - b[0] || a[1] - b[1]; });
      chains.forEach((ch, k) => {
        const name = `${options.prefixes?.[bi] ?? ''}${face.name ?? face.id}~sil${k}`;
        // A silhouette lies on facets turning edge-on, which their neighbours fold over.
        const eps = 1e-5 * size, own: Own = cyl ? { face: faceIndex, eps: 4 * faceSag[faceIndex] + eps, rho: 0 } : { face: faceIndex, eps: 0, rho: 2.5 * faceSpan[faceIndex] };
        if (ch.length === 2) {
          const [A, B] = ch, L = dist2(P(A), P(B));
          if (L <= 1e-6 * size) return;
          silhouettes.push({ name, kind: 'silhouette', ends: [A, B], circle: null, s0: 0, s1: 1, eps, own,
            at: s => lerp3(A, B, s), out: (s0, s1) => ({ kind: 'line', a: P(lerp3(A, B, s0)), b: P(lerp3(A, B, s1)) }),
            samples: () => steps(0, 1, Math.ceil(L / h)) });
        } else { const cand = polylineCandidate(name, 'silhouette', ch, P, h, eps); if (cand) silhouettes.push({ ...cand, own }); }
      });
    });
  });

  // Visible runs first (edges, then silhouettes not lying on visible edges), then hidden runs off visible ink.
  const edges = new Map<Candidate, ProjectedPiece[]>();
  const visibleInk: XY[][] = [];
  const minRun = 2e-3 * size;
  const runsOf = (c: Candidate) => intervals(c, s => !hidden((c.probe ?? c.at)(s), c), P, minRun);
  const visibleRuns = new Map<Candidate, [number, number, boolean][]>();
  for (const c of candidates) {
    const runs = runsOf(c); visibleRuns.set(c, runs);
    for (const [s0, s1, vis] of runs) if (vis) visibleInk.push(flatten(c.out(s0, s1), 2e-6 * size));
  }
  // On visible ink: within `cover` of a visible curve running the same way (a curve merely touching
  // or crossing one keeps its ink there).
  const cover = 1e-5 * size;
  const onInk = (c: Candidate, s: number) => {
    const ds = (c.s1 - c.s0) * 1e-4, a = P(c.at(Math.max(c.s0, s - ds))), b = P(c.at(Math.min(c.s1, s + ds)));
    return edgeInk.near(P(c.at(s)), cover, [b[0] - a[0], b[1] - a[1]]);
  };
  let edgeInk = segmentGrid(visibleInk);
  for (const c of silhouettes) {
    const runs = runsOf(c).flatMap(([s0, s1, vis]): [number, number, boolean][] => vis
      ? intervals({ ...c, s0, s1, samples: () => c.samples().filter(s => s > s0 && s < s1).concat([s0, s1]).sort((x, y) => x - y) }, s => !onInk(c, s), P, minRun).filter(r => r[2]).map(r => [r[0], r[1], true])
      : [[s0, s1, false]]);
    visibleRuns.set(c, runs);
    for (const [s0, s1, vis] of runs) if (vis) visibleInk.push(flatten(c.out(s0, s1), 2e-6 * size));
  }
  edgeInk = segmentGrid(visibleInk);
  for (const c of [...candidates, ...silhouettes]) {
    const pieces: ProjectedPiece[] = [];
    for (const [s0, s1, vis] of visibleRuns.get(c)!) {
      if (vis) { pieces.push({ curve: c.out(s0, s1), visible: true }); continue; }
      const sub_ = { ...c, s0, s1, samples: () => c.samples().filter(s => s > s0 && s < s1).concat([s0, s1]).sort((x, y) => x - y) };
      for (const [a, b, off] of intervals(sub_, s => !onInk(c, s), P, minRun)) if (off) pieces.push({ curve: c.out(a, b), visible: false });
    }
    edges.set(c, pieces);
  }

  const out: ProjectedEdge[] = [];
  const min: XY = [Infinity, Infinity], max: XY = [-Infinity, -Infinity];
  for (const [c, pieces] of edges) {
    out.push({ name: c.name, kind: c.kind, ...(c.tangent ? { tangent: true as const } : {}), ends: c.ends, circle: c.circle, pieces });
    for (const p of pieces) for (const q of flatten(p.curve, 1e-6 * size)) for (const k of [0, 1]) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
  }
  if (!out.length) { min[0] = min[1] = max[0] = max[1] = 0; }
  return { right, up, toward, edges: out, min, max };
}

/**
 * Two faces of one surface (no tangent edge between them): the same plane or cylinder, the pieces of one
 * named face (`x#1`, `x#2`), or two general surfaces of one feature (a revolve's seams).
 */
function sameSurface(ga: ReturnType<typeof faceGeometry>, gb: ReturnType<typeof faceGeometry>, na: string, nb: string): boolean {
  const near = (p: readonly number[], q: readonly number[], tol: number) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= tol;
  if (ga.kind === 'plane' && gb.kind === 'plane') return Math.abs(dot(ga.n, gb.n)) > 1 - 1e-9 && Math.abs(dot(sub(ga.o, gb.o), ga.n)) < 1e-6;
  if (ga.kind === 'cylinder' && gb.kind === 'cylinder') {
    const scale = 1e-6 * Math.max(1, ga.r);
    return Math.abs(ga.r - gb.r) < scale && Math.abs(Math.abs(dot(ga.a, gb.a)) - 1) < 1e-9 && near(cross(sub(gb.c, ga.c), ga.a), [0, 0, 0], scale);
  }
  const base = (n: string) => n.replace(/(#\d+)+$/, '');
  if (base(na) === base(nb)) return true;
  return ga.kind === 'other' && gb.kind === 'other' && na.split('.')[0] === nb.split('.')[0];
}

const steps = (s0: number, s1: number, n: number) => { const m = Math.max(1, Math.min(4000, n)); return Array.from({ length: m + 1 }, (_, k) => k === m ? s1 : s0 + (s1 - s0) * k / m); };

function polylineCandidate(name: string, kind: Candidate['kind'], poly: Point[], P: (p: Point) => XY, h: number, eps: number): Candidate | null {
  const q = poly.map(P); let L = 0; for (let k = 1; k < q.length; k++) L += Math.hypot(q[k][0] - q[k - 1][0], q[k][1] - q[k - 1][1]);
  if (L <= 1e-9 * h * 300) return null;
  const n = poly.length - 1;
  const at = (s: number): Point => { const i = Math.min(n - 1, Math.max(0, Math.floor(s))); return lerp3(poly[i], poly[i + 1], s - i); };
  return { name, kind, ends: [poly[0], poly[n]], circle: null, s0: 0, s1: n, eps, at,
    out: (s0, s1) => { const pts: XY[] = [P(at(s0))]; for (let k = Math.floor(s0) + 1; k < s1; k++) pts.push(q[k]); pts.push(P(at(s1))); return { kind: 'polyline', points: pts }; },
    samples: () => { const out: number[] = []; for (let k = 0; k < n; k++) { const m = Math.max(1, Math.ceil(Math.hypot(q[k + 1][0] - q[k][0], q[k + 1][1] - q[k][1]) / h)); for (let j = 0; j < m; j++) out.push(k + j / m); } out.push(n); return out; } };
}

/** An arc of the projected circle; seen edge-on (a degenerate ellipse) it is the line it covers. */
function arcOut(C: XY, U: XY, V: XY, ta: number, tb: number): ProjectedCurve {
  const t0 = Math.min(ta, tb), t1 = Math.max(ta, tb);
  const area = U[0] * V[1] - U[1] * V[0], scale = Math.max(Math.hypot(...U), Math.hypot(...V));
  if (Math.abs(area) > 1e-9 * scale * scale) return { kind: 'arc', center: [...C], u: [...U], v: [...V], t0, t1 };
  const d = Math.hypot(...U) >= Math.hypot(...V) ? U : V, dl = Math.hypot(...d), e: XY = [d[0] / dl, d[1] / dl];
  const a = U[0] * e[0] + U[1] * e[1], b = V[0] * e[0] + V[1] * e[1];
  const f = (t: number) => a * Math.cos(t) + b * Math.sin(t), phi = Math.atan2(b, a);
  const ts = [t0, t1]; for (let k = Math.ceil((t0 - phi) / Math.PI); phi + k * Math.PI <= t1; k++) ts.push(phi + k * Math.PI);
  const vals = ts.map(f), lo = Math.min(...vals), hi = Math.max(...vals);
  return { kind: 'line', a: [C[0] + e[0] * lo, C[1] + e[1] * lo], b: [C[0] + e[0] * hi, C[1] + e[1] * hi] };
}

/** Runs of [s0, s1] where `test` holds or not, its changes found by bisection; runs shorter than `minRun` (in view units) join their neighbours. */
function intervals(c: Candidate, test: (s: number) => boolean, P: (p: Point) => XY, minRun: number): [number, number, boolean][] {
  const ss = c.samples().filter(s => s >= c.s0 && s <= c.s1);
  if (!ss.length || ss[0] !== c.s0) ss.unshift(c.s0);
  if (ss[ss.length - 1] !== c.s1) ss.push(c.s1);
  const states = ss.map(test);
  const runs: [number, number, boolean][] = [];
  let start = ss[0], state = states[0];
  for (let k = 1; k < ss.length; k++) {
    if (states[k] === state) continue;
    let a = ss[k - 1], b = ss[k];
    for (let it = 0; it < 30 && b - a > 1e-12 * Math.max(1, Math.abs(b)); it++) { const m = (a + b) / 2; if (test(m) === state) a = m; else b = m; }
    const cut = (a + b) / 2; runs.push([start, cut, state]); start = cut; state = states[k];
  }
  runs.push([start, ss[ss.length - 1], state]);
  // Absorb slivers (numerical noise at tangencies) into their neighbours.
  const length = (r: [number, number, boolean]) => { const a = P(c.at(r[0])), b = P(c.at((r[0] + r[1]) / 2)), z = P(c.at(r[1])); return Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(z[0] - b[0], z[1] - b[1]); };
  for (let changed = true; changed && runs.length > 1;) {
    changed = false;
    for (let k = 0; k < runs.length; k++) {
      if (length(runs[k]) >= minRun) continue;
      const into = k > 0 ? k - 1 : k + 1;
      runs[into] = [Math.min(runs[into][0], runs[k][0]), Math.max(runs[into][1], runs[k][1]), runs[into][2]];
      runs.splice(k, 1); changed = true; break;
    }
    for (let k = 1; k < runs.length; k++) if (runs[k][2] === runs[k - 1][2]) { runs[k - 1] = [runs[k - 1][0], runs[k][1], runs[k][2]]; runs.splice(k, 1); k--; changed = true; }
  }
  return runs;
}

/** A curve as a polyline within `tol` of it. */
function flatten(c: ProjectedCurve, tol: number): XY[] {
  if (c.kind === 'line') return [[...c.a], [...c.b]];
  if (c.kind === 'polyline') return c.points.map(p => [...p] as XY);
  const r = Math.max(Math.hypot(...c.u), Math.hypot(...c.v)), step = Math.min(Math.PI / 16, Math.sqrt(8 * tol / Math.max(r, 1e-12)));
  const n = Math.max(1, Math.ceil((c.t1 - c.t0) / step));
  return Array.from({ length: n + 1 }, (_, k) => { const t = c.t0 + (c.t1 - c.t0) * k / n; return [c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t)] as XY; });
}

/** Joins segments end to end into chains (open or closed: a closed chain repeats its first point). */
function chainSegments(segs: [Point, Point][], tol: number): Point[][] {
  const key = (p: Point) => p.map(x => Math.round(x / tol)).join(',');
  const at = new Map<string, number[]>();
  segs.forEach(([a, b], i) => { for (const k of [key(a), key(b)]) at.set(k, [...(at.get(k) ?? []), i]); });
  const used = new Set<number>(), chains: Point[][] = [];
  const extend = (chain: Point[]) => {
    for (;;) {
      const end = chain[chain.length - 1], next = (at.get(key(end)) ?? []).find(i => !used.has(i));
      if (next === undefined) return;
      used.add(next); const [a, b] = segs[next]; chain.push(key(a) === key(end) ? b : a);
    }
  };
  // Open chains start at an end used once.
  const order = [...segs.keys()].sort((i, j) => Number((at.get(key(segs[j][0]))?.length ?? 0) === 1 || (at.get(key(segs[j][1]))?.length ?? 0) === 1) - Number((at.get(key(segs[i][0]))?.length ?? 0) === 1 || (at.get(key(segs[i][1]))?.length ?? 0) === 1));
  for (const i of order) {
    if (used.has(i)) continue; used.add(i);
    const [a, b] = segs[i], first = (at.get(key(a))?.length ?? 0) === 1;
    const chain: Point[] = first ? [a, b] : [b, a]; extend(chain);
    if (!first) { chain.reverse(); extend(chain); }
    chains.push(chain);
  }
  return chains;
}

/** Drops repeated and collinear interior points. */
function simplify(chain: Point[], tol: number): Point[] {
  const out: Point[] = [];
  for (const p of chain) { if (out.length && len(sub(p, out[out.length - 1])) <= tol) continue; out.push(p); }
  for (let k = 1; k + 1 < out.length;) {
    const a = out[k - 1], b = out[k], c = out[k + 1], ab = sub(b, a), ac = sub(c, a);
    if (len(cross(ab, ac)) <= tol * len(ac) && dot(ab, ac) > 0 && dot(ab, ac) < dot(ac, ac)) out.splice(k, 1); else k++;
  }
  return out;
}

/** Projected triangles (x, y, depth per corner) in a uniform grid: `covers(p, …, depth)` — any triangle over p nearer than depth. */
function triangleGrid(t: number[], face: number[], at: number[]) {
  const n = t.length / 9;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < t.length; i += 3) { x0 = Math.min(x0, t[i]); x1 = Math.max(x1, t[i]); y0 = Math.min(y0, t[i + 1]); y1 = Math.max(y1, t[i + 1]); }
  const G = Math.max(4, Math.min(128, Math.round(Math.sqrt(n / 2)))), w = (x1 - x0) / G || 1, hgt = (y1 - y0) / G || 1;
  const cells: number[][] = Array.from({ length: G * G }, () => []);
  const cx = (x: number) => Math.min(G - 1, Math.max(0, Math.floor((x - x0) / w))), cy = (y: number) => Math.min(G - 1, Math.max(0, Math.floor((y - y0) / hgt)));
  for (let k = 0; k < n; k++) {
    const o = k * 9, ax = Math.min(t[o], t[o + 3], t[o + 6]), bx = Math.max(t[o], t[o + 3], t[o + 6]), ay = Math.min(t[o + 1], t[o + 4], t[o + 7]), by = Math.max(t[o + 1], t[o + 4], t[o + 7]);
    for (let i = cx(ax); i <= cx(bx); i++) for (let j = cy(ay); j <= cy(by); j++) cells[j * G + i].push(k);
  }
  return {
    covers(p: XY, p3: Point, depth: number, own: Own | null) {
      if (!n || p[0] < x0 - w || p[0] > x1 + w || p[1] < y0 - hgt || p[1] > y1 + hgt) return false;
      for (const k of cells[cy(p[1]) * G + cx(p[0])]) {
        const o = k * 9, ax = t[o], ay = t[o + 1], bx = t[o + 3], by = t[o + 4], qx = t[o + 6], qy = t[o + 7];
        const det = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
        const l1 = ((p[0] - ax) * (qy - ay) - (qx - ax) * (p[1] - ay)) / det, l2 = ((bx - ax) * (p[1] - ay) - (p[0] - ax) * (by - ay)) / det, l0 = 1 - l1 - l2;
        const tol = -1e-7;
        if (l0 < tol || l1 < tol || l2 < tol) continue;
        const z = l0 * t[o + 2] + l1 * t[o + 5] + l2 * t[o + 8];
        if (z <= depth) continue;
        if (own && face[k] === own.face && (z <= depth + own.eps || Math.hypot(at[k * 3] - p3[0], at[k * 3 + 1] - p3[1], at[k * 3 + 2] - p3[2]) < own.rho)) continue;
        return true;
      }
      return false;
    },
  };
}

/** Polylines' segments in a uniform grid: `near(p, tol)` — any segment within tol of p. */
function segmentGrid(lines: XY[][]) {
  const segs: number[] = [];
  for (const l of lines) for (let k = 1; k < l.length; k++) segs.push(l[k - 1][0], l[k - 1][1], l[k][0], l[k][1]);
  const n = segs.length / 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < segs.length; i += 2) { x0 = Math.min(x0, segs[i]); x1 = Math.max(x1, segs[i]); y0 = Math.min(y0, segs[i + 1]); y1 = Math.max(y1, segs[i + 1]); }
  const G = Math.max(4, Math.min(128, Math.round(Math.sqrt(n)))), w = (x1 - x0) / G || 1, hgt = (y1 - y0) / G || 1;
  const cells: number[][] = Array.from({ length: G * G }, () => []);
  const cx = (x: number) => Math.min(G - 1, Math.max(0, Math.floor((x - x0) / w))), cy = (y: number) => Math.min(G - 1, Math.max(0, Math.floor((y - y0) / hgt)));
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    for (let i = cx(Math.min(segs[o], segs[o + 2])); i <= cx(Math.max(segs[o], segs[o + 2])); i++) for (let j = cy(Math.min(segs[o + 1], segs[o + 3])); j <= cy(Math.max(segs[o + 1], segs[o + 3])); j++) cells[j * G + i].push(k);
  }
  return {
    near(p: XY, tol: number, dir: XY) {
      const dl = Math.hypot(dir[0], dir[1]);
      if (!n) return false;
      const seen = new Set<number>();
      for (let i = cx(p[0] - tol); i <= cx(p[0] + tol); i++) for (let j = cy(p[1] - tol); j <= cy(p[1] + tol); j++) for (const k of cells[j * G + i]) {
        if (seen.has(k)) continue; seen.add(k);
        const o = k * 4, ax = segs[o], ay = segs[o + 1], dx = segs[o + 2] - ax, dy = segs[o + 3] - ay, dd = dx * dx + dy * dy;
        const u = dd > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / dd)) : 0;
        if (Math.hypot(p[0] - ax - dx * u, p[1] - ay - dy * u) > tol) continue;
        if (dl === 0 || dd === 0 || Math.abs(dx * dir[1] - dy * dir[0]) <= Math.sin(Math.PI / 36) * Math.sqrt(dd) * dl) return true;
      }
      return false;
    },
  };
}
