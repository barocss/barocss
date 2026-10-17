// Measuring between two picked faces or edges of the display meshes: the shortest distance between
// them (closest points on their triangles and segments), the angle between planes and straight edges,
// and the normal distance between parallel planes. Picks of one face or edge measure that item alone.
import type { DisplayMesh, Vec3 } from '../engine/mesh';

export interface MeasurePick { body: number; face?: number; edge?: number; vertex?: Vec3 }
export interface MeasureResult {
  /** Shortest distance and the closest points (mm). */
  distance: number; a: Vec3; b: Vec3;
  /** Between two planes, two straight edges, or a plane and a straight edge (degrees, 0–90). */
  angle?: number;
  /** Between two parallel planes: their distance along the normal. */
  normalDistance?: number;
  /** Between two round faces (cylinders): the angle between their axes and the distance between them. */
  axes?: { angle: number; offset: number; coaxial: boolean };
}
export interface MeasureItem { label: string; length?: number; area?: number; radius?: number }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));
const at = (p: ArrayLike<number>, i: number): Vec3 => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];

/** A pick's triangles (a face) or segments (an edge). */
function primitives(mesh: DisplayMesh, pick: MeasurePick): { tris: [Vec3, Vec3, Vec3][]; segs: [Vec3, Vec3][] } {
  const tris: [Vec3, Vec3, Vec3][] = [], segs: [Vec3, Vec3][] = [];
  if (pick.face !== undefined) {
    const I = mesh.indices, P = mesh.positions, F = mesh.faceOfVertex;
    for (let t = 0; t < I.length; t += 3) if (F[I[t]] === pick.face) tris.push([at(P, I[t]), at(P, I[t + 1]), at(P, I[t + 2])]);
  }
  if (pick.edge !== undefined) {
    // (edgeOfSegment holds the edge of each line vertex: two per segment.)
    const L = mesh.edgeLines, E = mesh.edgeOfSegment;
    for (let s = 0; 2 * s < E.length; s++) if (E[2 * s] === pick.edge) segs.push([at(L, 2 * s), at(L, 2 * s + 1)]);
  }
  if (pick.vertex) segs.push([pick.vertex, pick.vertex]);
  return { tris, segs };
}

/** Closest point on a triangle to p (Ericson, Real-Time Collision Detection 5.1.5). */
function closestOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(a, scale(ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(a, scale(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(b, scale(sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  const denom = 1 / (va + vb + vc); return add(a, add(scale(ab, vb * denom), scale(ac, vc * denom)));
}
/** Closest points of two segments. */
function closestSegments(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): [Vec3, Vec3] {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-24 && e <= 1e-24) return [p1, p2];
  if (a <= 1e-24) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = dot(d1, r);
    if (e <= 1e-24) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-24 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return [add(p1, scale(d1, s)), add(p2, scale(d2, t))];
}

/** The plane of a planar face, or the direction of a straight edge. */
function flatOf(mesh: DisplayMesh, pick: MeasurePick): { plane?: { n: Vec3; d: number }; line?: Vec3 } {
  if (pick.face !== undefined) { const f = mesh.faces[pick.face]; return f.kind === 'plane' ? { plane: { n: f.normal, d: dot(f.normal, f.centroid) } } : {}; }
  if (pick.edge !== undefined) { const e = mesh.edges[pick.edge]; return e.straight ? { line: unit(sub(e.b, e.a)) } : {}; }
  return {};
}

export function measureBetween(ma: DisplayMesh, pa: MeasurePick, mb: DisplayMesh, pb: MeasurePick): MeasureResult {
  const A = primitives(ma, pa), B = primitives(mb, pb);
  let best = Infinity, ca: Vec3 = [0, 0, 0], cb: Vec3 = [0, 0, 0];
  const offer = (x: Vec3, y: Vec3) => { const d = len(sub(x, y)); if (d < best) { best = d; ca = x; cb = y; } };
  const edgesOf = (P: typeof A) => [...P.segs, ...P.tris.flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]] as [Vec3, Vec3][])];
  const pointsOf = (P: typeof A) => [...P.segs.flat(), ...P.tris.flat()];
  // Vertex against triangle, both ways; then segment against segment (triangle sides included).
  for (const p of pointsOf(A)) for (const [a, b, c] of B.tris) offer(p, closestOnTriangle(p, a, b, c));
  for (const p of pointsOf(B)) for (const [a, b, c] of A.tris) offer(closestOnTriangle(p, a, b, c), p);
  const ea = edgesOf(A), eb = edgesOf(B);
  for (const [p1, q1] of ea) for (const [p2, q2] of eb) { const [x, y] = closestSegments(p1, q1, p2, q2); offer(x, y); }
  const result: MeasureResult = { distance: best, a: ca, b: cb };
  const fa = flatOf(ma, pa), fb = flatOf(mb, pb), deg = (c: number) => Math.acos(Math.min(1, Math.abs(c))) * 180 / Math.PI;
  if (fa.plane && fb.plane) {
    result.angle = deg(dot(fa.plane.n, fb.plane.n));
    if (result.angle < 1e-6) {
      result.normalDistance = Math.abs(fa.plane.d - Math.sign(dot(fa.plane.n, fb.plane.n)) * fb.plane.d);
      // Shown from the middle of one face where it faces the other (a dimension across, not at a corner).
      for (const [P, Q, from] of [[A, B, ma.faces[pa.face!].centroid], [B, A, mb.faces[pb.face!].centroid]] as const) {
        if (!P.tris.length) continue;
        let foot: Vec3 | null = null, d = Infinity;
        for (const [a, b, c] of Q.tris) { const q = closestOnTriangle(from, a, b, c), e = len(sub(q, from)); if (e < d) { d = e; foot = q; } }
        if (foot && Math.abs(d - result.normalDistance) <= 1e-6 * Math.max(1, d)) { [result.a, result.b] = P === A ? [from, foot] : [foot, from]; break; }
      }
    }
  } else if (fa.line && fb.line) result.angle = deg(dot(fa.line, fb.line));
  // Two round faces: their axes (coaxial within 0.001° and 0.001 mm).
  const xa = pa.face !== undefined ? roundFaceAxis(ma, pa.face) : null, xb = pb.face !== undefined ? roundFaceAxis(mb, pb.face) : null;
  if (xa && xb) {
    const angle = deg(dot(xa.dir, xb.dir)), w = sub(xb.point, xa.point), off = sub(w, scale3(xa.dir, dot(w, xa.dir)));
    const offset = angle < 1e-6 ? len(off) : (() => { const n = cross3(xa.dir, xb.dir); return Math.abs(dot(w, n)) / len(n); })();
    result.axes = { angle, offset, coaxial: angle < 1e-3 && offset < 1e-3 };
  }
  else if ((fa.plane && fb.line) || (fa.line && fb.plane)) { const n = (fa.plane ?? fb.plane)!.n, l = (fa.line ?? fb.line)!; result.angle = 90 - deg(dot(n, l)); }
  return result;
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
/**
 * A cylindrical face's axis (a point on it and its direction): the direction square to every vertex
 * normal, the point the normals' feet at the face's radius gather round. Null for any other face.
 */
export function roundFaceAxis(mesh: DisplayMesh, face: number): { point: Vec3; dir: Vec3 } | null {
  const f = mesh.faces[face]; if (!f || f.kind !== 'curved' || !f.radius) return null;
  const vs: number[] = []; for (let v = 0; v < mesh.faceOfVertex.length; v++) if (mesh.faceOfVertex[v] === face) vs.push(v);
  if (vs.length < 3) return null;
  const N = (v: number): Vec3 => [mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]], P = (v: number): Vec3 => [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]];
  // The axis: the cross of the two most different normals.
  let best = 0, dir: Vec3 = [0, 0, 1];
  const n0 = N(vs[0]);
  for (const v of vs) { const c = cross3(n0, N(v)); if (len(c) > best) { best = len(c); dir = scale3(c, 1 / len(c)); } }
  if (best < 1e-3 || vs.some(v => Math.abs(dot(N(v), dir)) > 1e-2)) return null;
  // The centre: a least-squares circle (x² + y² + Dx + Ey + F = 0) through the vertices seen along the
  // axis (the display normals are averaged, so only their plane is exact, not their direction).
  const e1 = len(cross3(dir, [1, 0, 0])) > 0.5 ? scale3(cross3(dir, [1, 0, 0]), 1 / len(cross3(dir, [1, 0, 0]))) : scale3(cross3(dir, [0, 1, 0]), 1 / len(cross3(dir, [0, 1, 0]))), e2 = cross3(dir, e1);
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const v of vs) { const p = P(v), x = dot(p, e1), y = dot(p, e2), row = [x, y, 1], r = -(x * x + y * y); for (let i = 0; i < 3; i++) { b[i] += row[i] * r; for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j]; } }
  const det = (M: number[][]) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D0 = det(A); if (Math.abs(D0) < 1e-12) return null;
  const solve = (k: number) => det(A.map((row, i) => row.map((x, j) => j === k ? b[i] : x))) / D0;
  const D = solve(0), E = solve(1), F = solve(2), cx = -D / 2, cy = -E / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - F));
  if (Math.abs(r - f.radius) > 0.05 * f.radius) return null;
  const along = dot(P(vs[0]), dir), point: Vec3 = [0, 1, 2].map(k => e1[k] * cx + e2[k] * cy + dir[k] * along) as Vec3;
  return { point, dir };
}

/** One pick alone: an edge's length (and radius when it is an arc), a face's area (and radius when it is round). */
export function measureItem(mesh: DisplayMesh, pick: MeasurePick): MeasureItem {
  if (pick.vertex) return { label: `Point ${pick.vertex.map(v => Math.round(v * 1000) / 1000).join(', ')}` };
  if (pick.face !== undefined) {
    const f = mesh.faces[pick.face];
    return { label: f.kind === 'plane' ? 'Planar face' : 'Curved face', area: f.areaMM2, ...(f.radius ? { radius: f.radius } : {}) };
  }
  const { segs } = primitives(mesh, pick), e = mesh.edges[pick.edge!];
  const length = segs.reduce((acc, [a, b]) => acc + len(sub(b, a)), 0);
  if (e.straight || segs.length < 2) return { label: 'Line', length };
  // A circle through three well spread samples (the segments need not run in order), when every sample lies on it.
  const pts = segs.flat(), p = pts[0], m = pts.reduce((x, y) => len(sub(y, p)) > len(sub(x, p)) ? y : x, p), pm = unit(sub(m, p));
  const off = (x: Vec3) => len(cross(sub(x, p), pm)), q = pts.reduce((x, y) => off(y) > off(x) ? y : x, p);
  const u = sub(m, p), v = sub(q, p), n = cross(u, v), nn = dot(n, n);
  if (nn > 1e-18) {
    const c = add(p, scale(add(scale(cross(n, u), dot(v, v)), scale(cross(v, n), dot(u, u))), 1 / (2 * nn))), r = len(sub(p, c));
    if (pts.every(x => Math.abs(len(sub(x, c)) - r) < 1e-3 * Math.max(1, r))) {
      // The samples lie on the circle: each chord spans 2·asin(chord / 2r), so r·Σθ is the true arc length.
      const arc = r * segs.reduce((acc, [a, b]) => acc + 2 * Math.asin(Math.min(1, len(sub(b, a)) / (2 * r))), 0);
      return { label: 'Arc', length: arc, radius: r };
    }
  }
  return { label: 'Curve', length };
}
