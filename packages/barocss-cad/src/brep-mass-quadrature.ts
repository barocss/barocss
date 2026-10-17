// Volume integrals of a B-rep over its exact surfaces: each display triangle of a curved face is
// integrated in the face's parameter domain (Gauss points mapped through the surface itself), so the
// result no longer carries the tessellation's chord error; only trims that are not straight in (u, v)
// keep a small error along them. Faces tessellated without parameters (ruled strips) are inverted onto
// their surface first. Planar faces are integrated by Green's theorem along their exact edge curves (a
// disc's rim is a circle, not its chords). Every face is checked against its flat triangles; one that
// disagrees by more than its chord error could explain returns null, and the caller falls back to the
// tessellation.
import { tessellateBrepWithParameters, type FaceParameters } from './brep-tessellate.js';
import { curveDomain, surfaceDomain, surfaceEvaluator } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { Brep } from './brep-core.js';
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
const G4 = gauss(4), G12 = gauss(12);

/**
 * A planar face's ten integrals by Green's theorem in its plane (o; e1, e2 with e1 × e2 the outward
 * normal n): ∫∫ h ds dt = ∮ H dt, H(s, t) = ∫₀ˢ h(σ, t) dσ, along each coedge's exact curve.
 */
function planarIntegrals(brep: Brep, faceId: string, n: Point, o: Point): number[] {
  const face = brep.faces.find(f => f.id === faceId)!, loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e]));
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

/** The ten volume integrals over the exact surfaces, or null when a face cannot be integrated so. */
export function brepQuadratureIntegrals(brep: Brep, segmentsPerQuarter: number): number[] | null {
  const { mesh, parameters } = tessellateBrepWithParameters(brep, { segmentsPerQuarter }), P = mesh.positionsMM, ix = mesh.indices;
  const surfaces = new Map(brep.faces.map(f => [f.id, f.surface]));
  const point = (i: number): Point => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  let size = 1; for (let i = 0; i < P.length; i++) size = Math.max(size, Math.abs(P[i]));
  const I = Array(10).fill(0) as number[];
  for (const face of mesh.faces) {
    const flat = Array(10).fill(0) as number[], tris: [number, number, number][] = [];
    for (let t = face.indexOffset; t < face.indexOffset + face.indexCount; t += 3) tris.push([ix[t], ix[t + 1], ix[t + 2]]);
    // Flat triangles: exact for planar faces (the rule integrates the degree-4 field exactly).
    let scale = 0, areaSum = 0; const flatVec: Point = [0, 0, 0];
    for (const [a, b, c] of tris) {
      const A = point(a), B = point(b), C = point(c), n = cross(sub(B, A), sub(C, A)).map(x => x / 2) as Point, tri = Array(10).fill(0) as number[];
      for (const [wa, wb, wc, w] of RULE) accumulate(tri, [wa * A[0] + wb * B[0] + wc * C[0], wa * A[1] + wb * B[1] + wc * C[1], wa * A[2] + wb * B[2] + wc * C[2]], n, w);
      tri.forEach((x, k) => { flat[k] += x; }); scale += Math.abs(tri[0]); areaSum += Math.hypot(...n);
      flatVec[0] += n[0]; flatVec[1] += n[1]; flatVec[2] += n[2];
    }
    if (face.kind === 'planar') {
      const [a, b, c] = tris[0] ?? [];
      if (a === undefined) continue;
      const nn = cross(sub(point(b), point(a)), sub(point(c), point(a))), l = Math.hypot(...nn);
      const exact = planarIntegrals(brep, face.faceId, nn.map(x => x / l) as Point, point(a));
      if (!(Math.abs(exact[0] - flat[0]) <= 5e-2 * scale + 1e-6 * areaSum * size)) return null;
      exact.forEach((x, k) => { I[k] += x; }); continue;
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
  return I;
}
