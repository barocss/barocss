// Volume integrals of a B-rep over its exact surfaces. A curved face that is a whole patch (its one loop
// runs along the patch's domain boundary) is integrated by tensor Gauss–Legendre over each knot span with
// the surface's analytic derivatives: no tessellation, exact to rounding for polynomial patches. Each
// display triangle of any other curved face is integrated in the face's parameter domain (Gauss points
// mapped through the surface itself), so the result no longer carries the tessellation's chord error; only
// trims that are not straight in (u, v) keep a small error along them. Faces tessellated without
// parameters (ruled strips) are inverted onto their surface first; each is checked against its flat
// triangles, and one that disagrees by more than its chord error could explain returns null (the caller
// falls back to the tessellation). Planar faces are integrated by Green's theorem along their exact edge
// curves (a disc's rim is a circle, not its chords).
import { planar, tessellateBrepWithParameters, type FaceParameters } from './brep-tessellate.js';
import { curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { Brep, BrepFace } from './brep-core.js';
import type { Point, Surface } from './types.js';

type XY = readonly [number, number];
/** Dunavant's degree-8 rule on the unit triangle (16 points): barycentric (a, b, c) and weight (sum 1). */
const RULE: readonly (readonly [number, number, number, number])[] = (() => {
  const out: [number, number, number, number][] = [[1 / 3, 1 / 3, 1 / 3, 0.144315607677787]];
  const orbit = (a: number, w: number) => { const b = (1 - a) / 2; out.push([a, b, b, w], [b, a, b, w], [b, b, a, w]); };
  orbit(0.081414823414554, 0.095091634267285); orbit(0.658861384496480, 0.103217370534718);
  orbit(0.898905543365938, 0.032458497623198);
  const six = (a: number, b: number, w: number) => { const c = 1 - a - b; out.push([a, b, c, w], [a, c, b, w], [b, a, c, w], [b, c, a, w], [c, a, b, w], [c, b, a, w]); };
  six(0.008394777409958, 0.263112829634638, 0.027230314174435);
  return out;
})();

/** F·N for the ten integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] (one field F for every face). */
function accumulate(I: number[], p: Point, n: Point, w: number) {
  const [x, y, z] = p, nx = n[0] * w, ny = n[1] * w, nz = n[2] * w;
  I[0] += x * nx; I[1] += x * x / 2 * nx; I[2] += y * y / 2 * ny; I[3] += z * z / 2 * nz;
  I[4] += x * x * x / 3 * nx; I[5] += y * y * y / 3 * ny; I[6] += z * z * z / 3 * nz;
  I[7] += x * x * y / 2 * nx; I[8] += x * x * z / 2 * nx; I[9] += y * y * z / 2 * ny;
}
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normal: Point = [0, 0, 0];

/** Newton's closest point on a surface, from the nearest of a coarse grid or a hint (null when off the surface). */
function inverter(S: Surface) {
  const at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S), N = 24, grid: { a: number; b: number; p: Point }[] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const a = U[0] + (U[1] - U[0]) * i / N, b = V[0] + (V[1] - V[0]) * j / N; grid.push({ a, b, p: at(a, b) }); }
  const size = Math.max(1, ...grid.map(g => Math.hypot(...g.p))), clamp = (x: number, r: readonly number[]) => Math.min(r[1], Math.max(r[0], x));
  const newton = (a: number, b: number, p: Point): [number, number, number] => {
    for (let it = 0; it < 30; it++) {
      const ha = 1e-7 * (U[1] - U[0]), hb = 1e-7 * (V[1] - V[0]), ia = a + ha <= U[1] ? ha : -ha, ib = b + hb <= V[1] ? hb : -hb;
      const q = at(a, b), Su = sub(at(a + ia, b), q).map(c => c / ia) as Point, Sv = sub(at(a, b + ib), q).map(c => c / ib) as Point, r = sub(p, q);
      const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12;
      if (!(Math.abs(det) > 1e-300)) break;
      const da = (dot(r, Su) * g22 - dot(r, Sv) * g12) / det, db = (g11 * dot(r, Sv) - g12 * dot(r, Su)) / det;
      a = clamp(a + da, U); b = clamp(b + db, V);
      if (Math.abs(da) < 1e-14 * (U[1] - U[0]) && Math.abs(db) < 1e-14 * (V[1] - V[0])) break;
    }
    return [a, b, Math.hypot(...sub(at(a, b), p))];
  };
  return (p: Point, hint: XY | null): XY | null => {
    let best: [number, number, number] = hint ? newton(hint[0], hint[1], p) : [0, 0, Infinity];
    if (best[2] > 1e-9 * size) {
      const near = grid.map(g => ({ g, d: dot(sub(g.p, p), sub(g.p, p)) })).sort((x, y) => x.d - y.d).slice(0, 4);
      for (const { g } of near) { const r = newton(g.a, g.b, p); if (r[2] < best[2]) best = r; if (best[2] <= 1e-9 * size) break; }
    }
    return best[2] <= 1e-6 * size ? [best[0], best[1]] : null;
  };
}

/** Gauss–Legendre on [0, 1]: 4 points (exact to degree 7) and 12 points (along curves, per knot span). */
const gauss = (n: number): { x: number[]; w: number[] } => {
  const x: number[] = [], w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      d = n * (t * p1 - p0) / (t * t - 1); const dt = p1 / d; t -= dt; if (Math.abs(dt) < 1e-16) break;
    }
    x.push((1 - t) / 2); w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
};
const G4 = gauss(4), G12 = gauss(12), rules = new Map<number, { x: number[]; w: number[] }>();
const gaussOf = (n: number) => { let r = rules.get(n); if (!r) rules.set(n, r = gauss(n)); return r; };

/**
 * A planar face's ten integrals by Green's theorem in its plane (o; e1, e2 with e1 × e2 the outward
 * normal n): ∫∫ h ds dt = ∮ H dt, H(s, t) = ∫₀ˢ h(σ, t) dσ, along each coedge's exact curve.
 */
function planarIntegrals(brep: Brep, face: BrepFace, n: Point, o: Point, maps: Maps): number[] {
  const { loops, coedges, edges } = maps;
  const e1 = (() => { const a: Point = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = dot(a, n), v: Point = [a[0] - n[0] * d, a[1] - n[1] * d, a[2] - n[2] * d], l = Math.hypot(...v); return v.map(x => x / l) as Point; })();
  const e2 = cross(n, e1), I = Array(10).fill(0) as number[];
  const P = (s: number, t: number): Point => [o[0] + s * e1[0] + t * e2[0], o[1] + s * e1[1] + t * e2[1], o[2] + s * e1[2] + t * e2[2]];
  for (const loopId of face.loops) for (const cid of loops.get(loopId)!.coedges) {
    const co = coedges.get(cid)!, curve = edges.get(co.edge)!.curve, [t0, t1] = curveDomain(curve);
    const knots = [t0, ...curve.knots.filter(k => k > t0 && k < t1), t1].filter((k, i, all) => i === 0 || k > all[i - 1]);
    const sense = co.sense === 'forward' ? 1 : -1;
    for (let k = 0; k + 1 < knots.length; k++) {
      const a = knots[k], b = knots[k + 1];
      G12.x.forEach((x, g) => {
        const { point, derivative } = evaluateCurveD1(curve, a + (b - a) * x), d = sub(point, o), s = dot(d, e1), t = dot(d, e2), dt = dot(derivative, e2) * (b - a) * G12.w[g] * sense;
        // H(s, t)·dt: the field integrated across from s = 0.
        G4.x.forEach((y, j) => accumulate(I, P(s * y, t), n, G4.w[j] * s * dt));
      });
    }
  }
  return I;
}

type Maps = { loops: Map<string, Brep['loops'][number]>; coedges: Map<string, Brep['coedges'][number]>; edges: Map<string, Brep['edges'][number]> };

/**
 * The ten volume integrals over the exact surfaces, or null when a face cannot be integrated so;
 * `meshed`: whether any face was integrated over its tessellation (its result then depends on
 * `segmentsPerQuarter`, and the caller extrapolates).
 */
export function brepQuadratureIntegrals(brep: Brep, segmentsPerQuarter: number): { integrals: number[]; meshed: boolean } | null {
  const maps: Maps = { loops: new Map(brep.loops.map(l => [l.id, l])), coedges: new Map(brep.coedges.map(c => [c.id, c])), edges: new Map(brep.edges.map(e => [e.id, e])) };
  const I = Array(10).fill(0) as number[], rest = new Set<string>();
  for (const face of brep.faces) {
    const plane = planar(face.surface), sign = face.sense === 'forward' ? 1 : -1;
    if (plane) { planarIntegrals(brep, face, [plane.normal[0] * sign, plane.normal[1] * sign, plane.normal[2] * sign], plane.origin, maps).forEach((x, k) => { I[k] += x; }); continue; }
    if (wholePatch(face, maps)) { patchIntegrals(face, I); continue; }
    rest.add(face.id);
  }
  if (!rest.size) return { integrals: I, meshed: false };
  const { mesh, parameters } = tessellateBrepWithParameters(brep, { segmentsPerQuarter }, rest), P = mesh.positionsMM, ix = mesh.indices;
  const surfaces = new Map(brep.faces.map(f => [f.id, f.surface]));
  const point = (i: number): Point => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (const face of mesh.faces) {
    const flat = Array(10).fill(0) as number[], tris: [number, number, number][] = [];
    for (let t = face.indexOffset; t < face.indexOffset + face.indexCount; t += 3) tris.push([ix[t], ix[t + 1], ix[t + 2]]);
    // Flat triangles: exact for planar faces (the rule integrates the degree-4 field exactly).
    let areaSum = 0; const flatVec: Point = [0, 0, 0];
    for (const [a, b, c] of tris) {
      const A = point(a), B = point(b), C = point(c), n = cross(sub(B, A), sub(C, A)).map(x => x / 2) as Point, tri = Array(10).fill(0) as number[];
      for (const [wa, wb, wc, w] of RULE) accumulate(tri, [wa * A[0] + wb * B[0] + wc * C[0], wa * A[1] + wb * B[1] + wc * C[1], wa * A[2] + wb * B[2] + wc * C[2]], n, w);
      tri.forEach((x, k) => { flat[k] += x; }); areaSum += Math.hypot(...n);
      flatVec[0] += n[0]; flatVec[1] += n[1]; flatVec[2] += n[2];
    }
    // Curved: each vertex's (u, v) (from the tessellation, else inverted), the triangle mapped through the surface.
    let fp: FaceParameters | undefined = parameters.get(face.faceId);
    if (!fp) {
      const S = surfaces.get(face.faceId)!, invert = inverter(S), uv: XY[] = []; let hint: XY | null = null;
      for (let i = 0; i < face.vertexCount; i++) { const q = invert(point(face.vertexOffset + i), hint); if (!q) return null; uv.push(q); hint = q; }
      fp = { uv: uv as [number, number][], at: surfaceEvaluator(S) };
    }
    const { uv, at } = fp, curved = Array(10).fill(0) as number[], curvedVec: Point = [0, 0, 0];
    let curvedArea = 0;
    const domain = fp.domain ? fp.domain.map(([a, b, c]) => [a + face.vertexOffset, b + face.vertexOffset, c + face.vertexOffset] as [number, number, number]) : tris;
    const uvArea = ([a, b, c]: readonly number[]) => { const qa = uv[a - face.vertexOffset], qb = uv[b - face.vertexOffset], qc = uv[c - face.vertexOffset]; return ((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0])) / 2; };
    let du = 0, dv = 0; for (const q of uv) { du = Math.max(du, Math.abs(q[0] - uv[0][0])); dv = Math.max(dv, Math.abs(q[1] - uv[0][1])); }
    const hu = 1e-6 * (du || 1), hv = 1e-6 * (dv || 1);
    const J = (u: number, v: number) => cross(sub(at(u + hu, v), at(u - hu, v)), sub(at(u, v + hv), at(u, v - hv)));
    // Which way the parameter map turns against the outward winding: from the face's largest triangle.
    let sigma = 0, best = 0;
    for (const t of tris) {
      const o = cross(sub(point(t[1]), point(t[0])), sub(point(t[2]), point(t[0]))), l = Math.hypot(...o); if (!(l > best)) continue;
      const [qa, qb, qc] = t.map(i => uv[i - face.vertexOffset]), s0 = Math.sign(dot(J((qa[0] + qb[0] + qc[0]) / 3, (qa[1] + qb[1] + qc[1]) / 3), o)) * Math.sign(uvArea(t));
      if (s0) { sigma = s0; best = l; }
    }
    if (!sigma) return null;
    // (The hottest loop of a curved body's mass: no callbacks or temporary vectors per point.)
    const off = face.vertexOffset, su = 2 * hu, sv = 2 * hv;
    for (const t of domain) {
      const qa = uv[t[0] - off], qb = uv[t[1] - off], qc = uv[t[2] - off], area = ((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0])) / 2;
      if (area === 0) continue;
      for (const r of RULE) {
        const wa = r[0], wb = r[1], wc = r[2], u = wa * qa[0] + wb * qb[0] + wc * qc[0], v = wa * qa[1] + wb * qb[1] + wc * qc[1];
        const pu = at(u + hu, v), mu = at(u - hu, v), pv = at(u, v + hv), mv = at(u, v - hv);
        const ux = (pu[0] - mu[0]) / su, uy = (pu[1] - mu[1]) / su, uz = (pu[2] - mu[2]) / su, vx = (pv[0] - mv[0]) / sv, vy = (pv[1] - mv[1]) / sv, vz = (pv[2] - mv[2]) / sv;
        // The mesh is wound outward throughout: sigma times the triangle's signed (u, v) area is outward.
        normal[0] = uy * vz - uz * vy; normal[1] = uz * vx - ux * vz; normal[2] = ux * vy - uy * vx;
        const k = r[3] * area * sigma;
        accumulate(curved, at(u, v), normal, k);
        curvedVec[0] += normal[0] * k; curvedVec[1] += normal[1] * k; curvedVec[2] += normal[2] * k; curvedArea += Math.hypot(normal[0], normal[1], normal[2]) * Math.abs(k);
      }
    }
    // The surface and its flat triangles share the boundary samples: their areas and vector areas (∫ n dA,
    // which only the boundary decides) differ by the chord error alone, a few % at most at 8 segments a
    // quarter. Coverage or orientation gone wrong shows as much more.
    if (!(Math.abs(curvedArea - areaSum) <= 5e-2 * areaSum && Math.hypot(...sub(curvedVec, flatVec)) <= 5e-2 * areaSum)) return null;
    curved.forEach((x, k) => { I[k] += x; });
  }
  return { integrals: I, meshed: true };
}

/**
 * Whether a curved face is its whole patch: one loop, every edge on the patch's domain boundary (sampled
 * at nine points, each within 1e-7 of the surface's size of one of the four boundary iso-curves), and the
 * loop as long as that boundary (to 1e-3, both measured as 64-segment polylines a curve). A closed loop made
 * only of boundary pieces, as long as the boundary, goes round it once: the face is the full domain.
 */
function wholePatch(face: BrepFace, maps: Maps): boolean {
  if (face.loops.length !== 1) return false;
  const S = face.surface, at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S);
  let size = 1; for (const row of S.controlPoints) for (const p of row) size = Math.max(size, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
  // The four boundary iso-curves sampled once (side k, sample i at SIDE[k][3i..3i+2]).
  const sides: Float64Array[] = [];
  for (let k = 0; k < 4; k++) {
    const out = new Float64Array(3 * (ISO_SAMPLES + 1));
    for (let i = 0; i <= ISO_SAMPLES; i++) { const q = sidePoint(at, U, V, k, i / ISO_SAMPLES); out[3 * i] = q[0]; out[3 * i + 1] = q[1]; out[3 * i + 2] = q[2]; }
    sides.push(out);
  }
  const tol = 1e-7 * size;
  // (The loop must also be as long as the boundary: a surface can stop short of the face its loop bounds.)
  let perimeter = 0, length = 0;
  for (const s of sides) perimeter += polylineLength(s);
  for (const cid of maps.loops.get(face.loops[0])!.coedges) {
    const curve = maps.edges.get(maps.coedges.get(cid)!.edge)!.curve, c = curveEvaluator(curve), [t0, t1] = curveDomain(curve);
    let last: Point | null = null;
    for (let k = 0; k <= EDGE_SAMPLES; k++) {
      const p = c(t0 + (t1 - t0) * k / EDGE_SAMPLES);
      if (k % (EDGE_SAMPLES / 8) === 0 && !(boundaryDistance(at, U, V, sides, p) <= tol)) return false;
      if (last) length += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
      last = p;
    }
  }
  return Math.abs(length - perimeter) <= 1e-3 * perimeter;
}
const EDGE_SAMPLES = 64;
/** The length of a polyline of points (x, y, z each). */
function polylineLength(s: Float64Array): number {
  let out = 0;
  for (let i = 3; i < s.length; i += 3) out += Math.hypot(s[i] - s[i - 3], s[i + 1] - s[i - 2], s[i + 2] - s[i - 1]);
  return out;
}
const ISO_SAMPLES = 64;
/** The point at fraction s along boundary side k of the domain: u = U0, u = U1 (along v), v = V0, v = V1 (along u). */
function sidePoint(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], k: number, s: number): Point {
  return k < 2 ? at(U[k], V[0] + (V[1] - V[0]) * s) : at(U[0] + (U[1] - U[0]) * s, V[k - 2]);
}
/** The distance from p to the domain boundary's image: the nearest cached sample, refined by golden section on its side. */
function boundaryDistance(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], sides: Float64Array[], p: Point): number {
  let side = 0, best = 0, bestD = Infinity;
  for (let k = 0; k < 4; k++) for (let i = 0; i <= ISO_SAMPLES; i++) {
    const s = sides[k], d = Math.hypot(s[3 * i] - p[0], s[3 * i + 1] - p[1], s[3 * i + 2] - p[2]);
    if (d < bestD) { bestD = d; side = k; best = i; }
  }
  const d = (s: number) => { const q = sidePoint(at, U, V, side, s); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); };
  let a = Math.max(0, best - 1) / ISO_SAMPLES, b = Math.min(ISO_SAMPLES, best + 1) / ISO_SAMPLES;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = d(x1), f2 = d(x2);
  for (let it = 0; it < 60 && b - a > 1e-15; it++) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = d(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = d(x2); }
  }
  return Math.min(bestD, f1, f2);
}
/**
 * A whole patch's ten integrals, added to I: tensor Gauss–Legendre on each knot span, n points a direction
 * from the integrand's degree (field cubic in the point, the point degree p, its Jacobian 2p − 1: n = ⌈5p/2⌉,
 * four more for rational patches), the outward normal ±∂S/∂u × ∂S/∂v by the face's sense.
 */
function patchIntegrals(face: BrepFace, I: number[]): void {
  const S = face.surface, sign = face.sense === 'forward' ? 1 : -1, { u: U, v: V } = surfaceDomain(S);
  const rational = S.weights.some(row => row.some(w => w !== 1));
  const gu = gaussOf(Math.min(20, Math.ceil(5 * S.degreeU / 2) + (rational ? 4 : 0))), gv = gaussOf(Math.min(20, Math.ceil(5 * S.degreeV / 2) + (rational ? 4 : 0)));
  const spansU = spans(S.knotsU, U), spansV = spans(S.knotsV, V);
  for (let a = 0; a + 1 < spansU.length; a++) for (let b = 0; b + 1 < spansV.length; b++) {
    const u0 = spansU[a], lu = spansU[a + 1] - u0, v0 = spansV[b], lv = spansV[b + 1] - v0;
    for (let i = 0; i < gu.x.length; i++) for (let j = 0; j < gv.x.length; j++) {
      const { point, du, dv } = evaluateSurfaceD1(S, u0 + lu * gu.x[i], v0 + lv * gv.x[j]);
      normal[0] = du[1] * dv[2] - du[2] * dv[1]; normal[1] = du[2] * dv[0] - du[0] * dv[2]; normal[2] = du[0] * dv[1] - du[1] * dv[0];
      accumulate(I, point, normal, sign * gu.w[i] * gv.w[j] * lu * lv);
    }
  }
}
/** A knot vector's distinct values inside the domain, ends included. */
function spans(knots: readonly number[], range: readonly number[]): number[] {
  const out = [range[0]];
  for (const k of knots) if (k > out[out.length - 1] && k < range[1]) out.push(k);
  out.push(range[1]);
  return out;
}
