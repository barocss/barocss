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
import { planar, polesOf, segmentKey, tessellateBrepWithParameters, type FaceParameters } from './brep-tessellate.js';
import { curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { curveD1Evaluator, type CurveD1Result } from '../core/derivatives.js';
import type { Brep, BrepFace } from './brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
import { facetIntegrals } from '../mesh/facet-patch.js';
import type { FacetPatch } from '../types.js';
import { cross, dot, sub } from '../core/vec3.js';
import { gauss } from '../core/quadrature.js';

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
/**
 * The point the integrals are taken about (the body's box centre, set per call): the field is then small over
 * the body, so a face's small integration error is not magnified by the body's distance from the world origin
 * (the result is the same wherever the body is). `fromCentre` moves them back to the world origin.
 */
const centre: Point = [0, 0, 0];
function accumulate(I: number[], p: Point, n: Point, w: number) {
  accumulateLocal(I, p[0] - centre[0], p[1] - centre[1], p[2] - centre[2], n, w);
}
/** All face fields use the same body origin; the closed body's integrals move back only once. */
function accumulateLocal(I: number[], x: number, y: number, z: number, n: Point, w: number) {
  const nx = n[0] * w, ny = n[1] * w, nz = n[2] * w;
  I[0] += x * nx; I[1] += x * x / 2 * nx; I[2] += y * y / 2 * ny; I[3] += z * z / 2 * nz;
  I[4] += x * x * x / 3 * nx; I[5] += y * y * y / 3 * ny; I[6] += z * z * z / 3 * nz;
  I[7] += x * x * y / 2 * nx; I[8] += x * x * z / 2 * nx; I[9] += y * y * z / 2 * ny;
}
const normal: Point = [0, 0, 0];

/**
 * The indices of the (at most) four grid points nearest p, nearest first, into `out`; their count. Equal distances
 * keep the grid's order, as a stable sort of all of them by squared distance would (R5.2, D216: the sort it replaces).
 * A distance that is not a number takes that sort's own path.
 */
export function nearestGridPoints(grid: readonly { readonly p: Point }[], p: Point, out: number[]): number {
  let n = 0;
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i].p, dx = g[0] - p[0], dy = g[1] - p[1], dz = g[2] - p[2], d = dx * dx + dy * dy + dz * dz;
    if (d !== d) return sortedNearest(grid, p, out);
    if (n === 4 && !(d < dist4(grid, p, out[3]))) continue;
    // (After every kept one at the same or a smaller distance: a stable sort's order.)
    let k = n < 4 ? n : 3;
    while (k > 0 && dist4(grid, p, out[k - 1]) > d) { if (k < 4) out[k] = out[k - 1]; k--; }
    out[k] = i; if (n < 4) n++;
  }
  return n;
}
const dist4 = (grid: readonly { readonly p: Point }[], p: Point, i: number) => { const g = grid[i].p, dx = g[0] - p[0], dy = g[1] - p[1], dz = g[2] - p[2]; return dx * dx + dy * dy + dz * dz; };
function sortedNearest(grid: readonly { readonly p: Point }[], p: Point, out: number[]): number {
  const near = grid.map((g, i) => ({ i, d: dot(sub(g.p, p), sub(g.p, p)) })).sort((x, y) => x.d - y.d).slice(0, 4);
  near.forEach((x, k) => { out[k] = x.i; });
  return near.length;
}

/** Newton's closest point on a surface, from the nearest of a coarse grid or a hint (null when off the surface). */
function inverter(S: Surface) {
  const at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S), N = 24, grid: { a: number; b: number; p: Point }[] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const a = U[0] + (U[1] - U[0]) * i / N, b = V[0] + (V[1] - V[0]) * j / N; grid.push({ a, b, p: at(a, b) }); }
  const size = Math.max(1, ...grid.map(g => Math.hypot(...g.p))), clamp = (x: number, r: readonly number[]) => Math.min(r[1], Math.max(r[0], x));
  const newton = (a: number, b: number, p: Point): [number, number, number] => {
    for (let it = 0; it < 30; it++) {
      const ha = 1e-7 * (U[1] - U[0]), hb = 1e-7 * (V[1] - V[0]), ia = a + ha <= U[1] ? ha : -ha, ib = b + hb <= V[1] ? hb : -hb;
      const q = at(a, b), eu = sub(at(a + ia, b), q), ev = sub(at(a, b + ib), q), Su: Point = [eu[0] / ia, eu[1] / ia, eu[2] / ia], Sv: Point = [ev[0] / ib, ev[1] / ib, ev[2] / ib], r = sub(p, q);
      const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12;
      if (!(Math.abs(det) > 1e-300)) break;
      const da = (dot(r, Su) * g22 - dot(r, Sv) * g12) / det, db = (g11 * dot(r, Sv) - g12 * dot(r, Su)) / det;
      a = clamp(a + da, U); b = clamp(b + db, V);
      if (Math.abs(da) < 1e-14 * (U[1] - U[0]) && Math.abs(db) < 1e-14 * (V[1] - V[0])) break;
    }
    const e = sub(at(a, b), p);
    return [a, b, Math.hypot(e[0], e[1], e[2])];
  };
  const near = [0, 0, 0, 0];
  return (p: Point, hint: XY | null): XY | null => {
    let best: [number, number, number] = hint ? newton(hint[0], hint[1], p) : [0, 0, Infinity];
    if (best[2] > 1e-9 * size) {
      const n = nearestGridPoints(grid, p, near);
      for (let k = 0; k < n; k++) { const g = grid[near[k]], r = newton(g.a, g.b, p); if (r[2] < best[2]) best = r; if (best[2] <= 1e-9 * size) break; }
    }
    return best[2] <= 1e-6 * size ? [best[0], best[1]] : null;
  };
}

/** Gauss–Legendre on [0, 1]: 4 points (exact to degree 7) and 12 points (along curves, per knot span). */
const G4 = gauss(4), G12 = gauss(12), rules = new Map<number, { x: number[]; w: number[] }>();
const gaussOf = (n: number) => { let r = rules.get(n); if (!r) rules.set(n, r = gauss(n)); return r; };

/**
 * A planar face's ten integrals by Green's theorem in its plane (o; e1, e2 with e1 × e2 the outward
 * normal n): ∫∫ h ds dt = ∮ H dt, H(s, t) = ∫₀ˢ h(σ, t) dσ, along each coedge's exact curve.
 */
function planarIntegrals(brep: Brep, face: BrepFace, n: Point, o: Point, maps: Maps): number[] {
  const { loops, coedges, edges } = maps;
  const e1 = (() => { const a: Point = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = dot(a, n), v: Point = [a[0] - n[0] * d, a[1] - n[1] * d, a[2] - n[2] * d], l = Math.hypot(...v); return v.map(x => x / l) as Point; })();
  const e2 = cross(n, e1), I = Array(11).fill(0) as number[];
  const P = (s: number, t: number): Point => [o[0] + s * e1[0] + t * e2[0], o[1] + s * e1[1] + t * e2[1], o[2] + s * e1[2] + t * e2[2]];
  for (const loopId of face.loops) for (const cid of loops.get(loopId)!.coedges) {
    const co = coedges.get(cid)!, curve = edges.get(co.edge)!.curve, [t0, t1] = curveDomain(curve), d1 = curveD1Evaluator(curve);
    const knots = [t0, ...curve.knots.filter(k => k > t0 && k < t1), t1].filter((k, i, all) => i === 0 || k > all[i - 1]);
    const sense = co.sense === 'forward' ? 1 : -1;
    for (let k = 0; k + 1 < knots.length; k++) {
      const a = knots[k], b = knots[k + 1];
      G12.x.forEach((x, g) => {
        const { point, derivative } = d1(a + (b - a) * x), d = sub(point, o), s = dot(d, e1), t = dot(d, e2), dt = dot(derivative, e2) * (b - a) * G12.w[g] * sense;
        // H(s, t)·dt: the field integrated across from s = 0.
        G4.x.forEach((y, j) => accumulate(I, P(s * y, t), n, G4.w[j] * s * dt));
        // The face's area: ∫∫ 1 ds dt = ∮ s dt.
        I[10] += s * dt;
      });
    }
  }
  return I;
}

type Maps = { loops: Map<string, Brep['loops'][number]>; coedges: Map<string, Brep['coedges'][number]>; edges: Map<string, Brep['edges'][number]> };

/**
 * The ten volume integrals over the exact surfaces, or null when a face cannot be integrated so;
 * `meshed`: whether any face was integrated over its tessellation (its result then depends on
 * `segmentsPerQuarter`, and the caller extrapolates): `squared` holds the meshed faces' part whose error falls
 * with the square of the step (surfaces with a pole), `cubed` the rest (within `integrals` too); `dropped` the trims' strips
 * left unintegrated (each such face held to its vector area to 1e-9).
 */
export function brepQuadratureIntegrals(brep: Brep, segmentsPerQuarter: number): { integrals: number[]; meshed: boolean; squared?: number[]; cubed?: number[]; dropped?: number } | null {
  const maps: Maps = { loops: new Map(brep.loops.map(l => [l.id, l])), coedges: new Map(brep.coedges.map(c => [c.id, c])), edges: new Map(brep.edges.map(e => [e.id, e])) };
  const I = Array(11).fill(0) as number[], rest = new Set<string>();
  setCentre(brep);
  // (A body of facet faces alone: tetrahedra from the centre. Beside other faces (F2) the facet faces take the
  // same field as they do, F·N per triangle: the two agree only summed over a closed surface.)
  const mixed = brep.faces.some(f => f.surface.kind === 'facets') && brep.faces.some(f => f.surface.kind !== 'facets');
  for (const face of brep.faces) {
    const sign = face.sense === 'forward' ? 1 : -1;
    // (A facet face: exact, no tessellation.)
    if (face.surface.kind === 'facets') { if (mixed) facetFieldIntegrals(face.surface, sign, I); else facetIntegrals(face.surface, sign, centre, I); continue; }
    const plane = planar(face.surface);
    if (plane) { planarIntegrals(brep, face, [plane.normal[0] * sign, plane.normal[1] * sign, plane.normal[2] * sign], plane.origin, maps).forEach((x, k) => { I[k] += x; }); continue; }
    if (wholePatch(face, maps)) { patchIntegrals(face, I); continue; }
    rest.add(face.id);
  }
  if (!rest.size) return { integrals: fromCentre(I), meshed: false };
  const { mesh, parameters, segments } = tessellateBrepWithParameters(brep, { segmentsPerQuarter }, rest), P = mesh.positions, ix = mesh.indices;
  let dropped = 0;
  const moments = new Map<Curve, Point>(), surfaces = new Map(brep.faces.map(f => [f.id, f.surface as Surface])), faces = new Map(brep.faces.map(f => [f.id, f])), squared = Array(11).fill(0) as number[], cubed = Array(11).fill(0) as number[];
  const point = (i: number): Point => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  // (A face whose area is a millionth of the body's size squared — a sliver a Boolean left at a fillet's end, R10.5 —
  // that the checks below would turn down is taken by its flat triangles: its sag is below the volume's rounding, D100.)
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of brep.vertices) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v.point[k]); hi[k] = Math.max(hi[k], v.point[k]); }
  const tinyArea = 1e-6 * ((hi[0] - lo[0]) ** 2 + (hi[1] - lo[1]) ** 2 + (hi[2] - lo[2]) ** 2);
  for (const face of mesh.faces) {
    const flat = Array(10).fill(0) as number[], tris: [number, number, number][] = [];
    for (let t = face.indexOffset; t < face.indexOffset + face.indexCount; t += 3) tris.push([ix[t], ix[t + 1], ix[t + 2]]);
    // Flat triangles: exact for planar faces (the rule integrates the degree-4 field exactly).
    let areaSum = 0;
    for (const [a, b, c] of tris) {
      const A = point(a), B = point(b), C = point(c), n = cross(sub(B, A), sub(C, A)).map(x => x / 2) as Point, tri = Array(10).fill(0) as number[];
      for (const [wa, wb, wc, w] of RULE) accumulate(tri, [wa * A[0] + wb * B[0] + wc * C[0], wa * A[1] + wb * B[1] + wc * C[1], wa * A[2] + wb * B[2] + wc * C[2]], n, w);
      tri.forEach((x, k) => { flat[k] += x; }); areaSum += Math.hypot(...n);
    }
    // Curved: each vertex's (u, v) (from the tessellation, else inverted), the triangle mapped through the surface.
    let fp: FaceParameters | undefined = parameters.get(face.faceId);
    if (!fp) {
      const S = surfaces.get(face.faceId)!, invert = inverter(S), uv: XY[] = []; let hint: XY | null = null;
      let lost = false;
      for (let i = 0; i < face.vertexCount; i++) { const q = invert(point(face.vertexOffset + i), hint); if (!q) { lost = true; break; } uv.push(q); hint = q; }
      if (lost) { if (areaSum <= tinyArea) { flatInto(cubed, flat, areaSum); continue; } return null; }
      fp = { uv: uv as [number, number][], at: surfaceEvaluator(S), own: true };
    }
    const { uv, at } = fp, curved = Array(10).fill(0) as number[], curvedVec: Point = [0, 0, 0];
    const domain = fp.domain ? fp.domain.map(([a, b, c]) => [a + face.vertexOffset, b + face.vertexOffset, c + face.vertexOffset] as [number, number, number]) : tris;
    const uvArea = ([a, b, c]: readonly number[]) => { const qa = uv[a - face.vertexOffset], qb = uv[b - face.vertexOffset], qc = uv[c - face.vertexOffset]; return ((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0])) / 2; };
    let du = 0, dv = 0; for (const q of uv) { du = Math.max(du, Math.abs(q[0] - uv[0][0])); dv = Math.max(dv, Math.abs(q[1] - uv[0][1])); }
    const hu = 1e-6 * (du || 1), hv = 1e-6 * (dv || 1), dom = surfaceDomain(surfaces.get(face.faceId)!);
    // Both derivative stencils and inversion must use the evaluator's coordinate system.
    // A cylinder frame uses arc length/height, not the NURBS knot domain: it runs free.
    const own = fp.own === true; sink.lu0 = own ? dom.u[0] : -Infinity; sink.lu1 = own ? dom.u[1] : Infinity; sink.lv0 = own ? dom.v[0] : -Infinity; sink.lv1 = own ? dom.v[1] : Infinity;
    sink.u0 = sink.lu0; sink.u1 = sink.lu1; sink.v0 = sink.lv0; sink.v1 = sink.lv1; sink.hu = hu; sink.hv = hv;
    sink.analytic = fp.analytic;
    const J = (u: number, v: number) => { if (fp.analytic) { const [du, dv] = fp.analytic.partials(u, v); return cross(du, dv); } const cu = stencilU(sink, u), cv = stencilV(sink, v); return cross(sub(at(cu + hu, v), at(cu - hu, v)), sub(at(u, cv + hv), at(u, cv - hv))); };
    // Which way the parameter map turns against the outward winding: from the face's largest triangle.
    let sigma = 0, best = 0;
    for (const t of tris) {
      const o = cross(sub(point(t[1]), point(t[0])), sub(point(t[2]), point(t[0]))), l = Math.hypot(...o); if (!(l > best)) continue;
      const [qa, qb, qc] = t.map(i => uv[i - face.vertexOffset]), s0 = Math.sign(dot(J((qa[0] + qb[0] + qc[0]) / 3, (qa[1] + qb[1] + qc[1]) / 3), o)) * Math.sign(uvArea(t));
      if (s0) { sigma = s0; best = l; }
    }
    if (!sigma) { if (areaSum <= tinyArea) { flatInto(cubed, flat, areaSum); continue; } return null; }
    // (The hottest loop of a curved body's mass: no callbacks or temporary vectors per point.)
    const off = face.vertexOffset;
    sink.at = at; sink.hu = hu; sink.hv = hv; sink.sigma = sigma; sink.curved = curved; sink.vec = curvedVec; sink.area = 0; sink.signed = 0; sink.dropped = 0;
    // (Each domain triangle cut along the surface's knot lines first, so the rule never spans a knot: FRk8b, D167.)
    const S = surfaces.get(face.faceId)!, us = own ? interiorKnots(S.knotsU, dom.u) : [], vs = own ? interiorKnots(S.knotsV, dom.v) : [];
    for (const t of domain) cellTriangles(sink, uv[t[0] - off], uv[t[1] - off], uv[t[2] - off], us, vs);
    // The surface over the domain and the flat triangles share the boundary samples: their areas differ by the
    // surface's sag inside the triangles alone, a few % at most at 8 segments a quarter. Coverage gone wrong
    // shows as much more. (Before the strips: those add the chord error, no small part of a thin face's area.)
    // (Where a domain triangle spans a wide turn — a cap about a sphere's pole, its trim round the whole turn of u in a few
    // samples — the surface over it bends from the flat triangle by more than a step's sag: the flat triangles of the same
    // domain cut in sixteen are the measure then. Coverage gone wrong still shows. L4 fuzz 171, D199.)
    // (Where the trims bow far from their chords in (u, v) — a plane cutting a ball a few hundredths from its pole, its
    // trim steep there in v — the domain itself covers much more than the face, and the strips take that off. Such a face
    // is held instead to its area with the strips, signed as the domain's own, against the flat triangles'. L4 fuzz
    // 20261025 case 24, D245.)
    let bowed = 0;
    if (!(Math.abs(sink.area - areaSum) <= 5e-2 * areaSum)) {
      const fine = finerFlatArea(at, uv, domain, off);
      if (!(Math.abs(sink.area - fine) <= 5e-2 * fine)) { if (areaSum <= tinyArea) { flatInto(cubed, flat, areaSum); continue; } bowed = Math.sign(sink.signed); }
    }
    // The curved strips between the domain's boundary chords and the edges, each integrated at once (`strip`).
    // (Not beside a surface's pole: there the parameters crowd and inversions are not to be trusted; such a face
    // keeps the square-of-the-step error, extrapolated as such.)
    // (Edges counted by position, not vertex index: a face's vertex list repeats points, and a chord counted
    // twice would add its strip twice.)
    // (A pole counts where the face reaches it: a ball's patch away from both poles — a corner blend's, D93 — is a plain
    // trimmed face.)
    const span = Math.max(du, dv, 1e-300), poles = polesOf(surfaces.get(face.faceId)!).filter(q => uv.some(x => Math.abs(x[q.along === 0 ? 1 : 0] - q.at) <= 1e-9 * span)).map(q => q.point);
    const pole = poles.length > 0, users = new Map<string, { t: number; e: number }[]>();
    // (Beside a pole: within a thousandth of the face's size of it, the same at every step, so that the parts
    // extrapolated keep one form of error.)
    let poleNear = 0;
    if (pole) { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < face.vertexCount; i++) for (let k = 0; k < 3; k++) { const x = P[(face.vertexOffset + i) * 3 + k]; if (x < lo[k]) lo[k] = x; if (x > hi[k]) hi[k] = x; } poleNear = 1e-3 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); }
    for (let t = 0; t < domain.length; t++) {
      const [i, j, k] = domain[t], qa = uv[i - off], qb = uv[j - off], qc = uv[k - off];
      // (A triangle with two corners at one point bounds nothing; one of three distinct points in a line — three samples
      // of a straight run of the boundary, left by the ear clipping — does: its two short chords are the edge's. D179.)
      if ((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0]) === 0) {
        const A = point(i), B = point(j), C = point(k);
        if ((A[0] === B[0] && A[1] === B[1] && A[2] === B[2]) || (B[0] === C[0] && B[1] === C[1] && B[2] === C[2]) || (C[0] === A[0] && C[1] === A[1] && C[2] === A[2])) continue;
        if ((qa[0] === qb[0] && qa[1] === qb[1]) || (qb[0] === qc[0] && qb[1] === qc[1]) || (qc[0] === qa[0] && qc[1] === qa[1])) continue;
      }
      for (let e = 0; e < 3; e++) { const key = segmentKey(point(domain[t][e]), point(domain[t][(e + 1) % 3])), l = users.get(key); if (l) l.push({ t, e }); else users.set(key, [{ t, e }]); }
    }
    for (const [key, list] of users) {
      if (list.length !== 1) continue;
      const seg = segments.get(key);
      if (!seg) continue;
      {
        const tri = domain[list[0].t], a = tri[list[0].e], b = tri[(list[0].e + 1) % 3];
        // (The segment's parameters in the direction a → b.)
        const pa = point(a), fromA = seg.from[0] === pa[0] && seg.from[1] === pa[1] && seg.from[2] === pa[2];
        sink.ev = curveEvaluator(seg.curve); sink.d1 = curveD1Evaluator(seg.curve);
        // (Beside a pole the strips stay out, their chord error extrapolated; the ribbon to the edge is no step's error,
        // and goes in alone: the facet rims about an exact ball, D184. Only beside it: a chord farther from the pole than
        // a thousandth of the face's size is inverted as well as on any face, and takes its strip. Without them, a cone's
        // long trims kept their whole chord error, its square still 6e-6 of the volume after the extrapolation: L4 fuzz
        // 93, D192. That distance is the step's own no more: a chord within four of its lengths, as D192 had it, took its
        // strip at 16 segments a quarter and not at 8, and the extrapolation took the jump for the square of the step's
        // error, 2400 e off: L4 fuzz 65, D198.)
        if (pole && besidePole(pa, point(b), poles, poleNear)) ribbonOnly(sink, uv[a - off], uv[b - off], fromA ? seg.tFrom : seg.tTo, fromA ? seg.tTo : seg.tFrom);
        else strip(sink, uv[a - off], uv[b - off], fromA ? seg.tFrom : seg.tTo, fromA ? seg.tTo : seg.tFrom);
      }
    }
    // Its vector area (∫ n dA) against the exact one, ½∮ x × dx along its edges: coverage or orientation gone
    // wrong shows as a large part of its area. (Beside a pole, without strips, the chords' sag is in it too.)
    // A face whose trims left a strip unintegrated (an edge's point off the domain — across a seam — or not to be
    // inverted) is held to its vector area to 1e-9 instead: what the strip would have added shows there, and a face
    // that does not hold sends the B-rep to the tessellation's route, said by its method (FRk8b, D167: never dropped
    // silently. Over the conformance cases, 8 faces drop strips, all within 7e-11).
    const exact = boundaryVectorArea(faces.get(face.faceId)!, maps, moments), vecOff = Math.hypot(curvedVec[0] - exact[0], curvedVec[1] - exact[1], curvedVec[2] - exact[2]);
    if (!(vecOff <= (sink.dropped ? 1e-9 : 5e-2) * areaSum)) { if (areaSum <= tinyArea) { flatInto(cubed, flat, areaSum); continue; } return null; }
    if (bowed && !(Math.abs(bowed * sink.signed - areaSum) <= 5e-2 * areaSum)) return null;
    // (A face whose surface has a pole keeps an error falling with the square of the step beside it; the
    // others, their trims' strips integrated, with its cube: their parts are extrapolated apart.)
    dropped += sink.dropped;
    const part = pole ? squared : cubed;
    curved.forEach((x, k) => { part[k] += x; });
    part[10] += sink.area;
  }
  return { integrals: fromCentre(I.map((x, k) => x + squared[k] + cubed[k])), meshed: true, squared: fromCentre(squared), cubed: fromCentre(cubed), dropped };
}

/** The flat area of a face's domain triangles, each cut in sixteen (four along each side) and mapped onto the surface. */
function finerFlatArea(at: (u: number, v: number) => Point, uv: readonly XY[], domain: readonly (readonly number[])[], off: number): number {
  let area = 0;
  for (const t of domain) {
    const qa = uv[t[0] - off], qb = uv[t[1] - off], qc = uv[t[2] - off], n = 4, row: Point[][] = [];
    for (let i = 0; i <= n; i++) { const r: Point[] = []; for (let j = 0; i + j <= n; j++) { const a = (n - i - j) / n, b = i / n, c = j / n; r.push(at(a * qa[0] + b * qb[0] + c * qc[0], a * qa[1] + b * qb[1] + c * qc[1])); } row.push(r); }
    for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {
      area += Math.hypot(...cross(sub(row[i + 1][j], row[i][j]), sub(row[i][j + 1], row[i][j]))) / 2;
      if (i + j + 1 < n) area += Math.hypot(...cross(sub(row[i + 1][j + 1], row[i + 1][j]), sub(row[i][j + 1], row[i + 1][j]))) / 2;
    }
  }
  return area;
}
/** Whether chord a → b passes within `near` of one of `poles` (points). */
function besidePole(a: Point, b: Point, poles: readonly Point[], near: number): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz;
  for (const P of poles) {
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy + (P[2] - a[2]) * dz) / l2)) : 0;
    if (Math.hypot(a[0] + t * dx - P[0], a[1] + t * dy - P[1], a[2] + t * dz - P[2]) <= near) return true;
  }
  return false;
}
/** A face's flat triangles' integrals (and area) into a part of the sum. */
function flatInto(part: number[], flat: readonly number[], area: number): void { for (let k = 0; k < 10; k++) part[k] += flat[k]; part[10] += area; }
/** A facet patch's ten integrals and area by the faces' common field F·N, the triangle rule exact for it (degree 4). */
const fieldPoint: Point = [0, 0, 0], fieldNormal: Point = [0, 0, 0];
function facetFieldIntegrals(f: FacetPatch, sign: 1 | -1, I: number[]): void {
  const P = f.positions, X = f.indices;
  for (let t = 0; t < X.length; t += 3) {
    const a = 3 * X[t], b = 3 * X[t + 1], c = 3 * X[t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    fieldNormal[0] = sign * (uy * vz - uz * vy) / 2; fieldNormal[1] = sign * (uz * vx - ux * vz) / 2; fieldNormal[2] = sign * (ux * vy - uy * vx) / 2;
    for (const [wa, wb, wc, w] of RULE) {
      fieldPoint[0] = wa * P[a] + wb * P[b] + wc * P[c]; fieldPoint[1] = wa * P[a + 1] + wb * P[b + 1] + wc * P[c + 1]; fieldPoint[2] = wa * P[a + 2] + wb * P[b + 2] + wc * P[c + 2];
      accumulate(I, fieldPoint, fieldNormal, w);
    }
    I[10] += Math.hypot(fieldNormal[0], fieldNormal[1], fieldNormal[2]);
  }
}
/** A face's vector area ∫ n dA (outward) from its boundary alone: ½∮ x × dx along each coedge's exact curve. */
function boundaryVectorArea(face: BrepFace, maps: Maps, moments: Map<Curve, Point>): Point {
  const out: Point = [0, 0, 0];
  for (const loopId of face.loops) for (const cid of maps.loops.get(loopId)!.coedges) {
    const co = maps.coedges.get(cid)!, v = curveMoment(maps.edges.get(co.edge)!.curve, moments), sense = co.sense === 'forward' ? 1 : -1;
    out[0] += v[0] * sense; out[1] += v[1] * sense; out[2] += v[2] * sense;
  }
  return out;
}
/** ½∫ x × x′ dt along a curve (forward), once per curve in `moments`: each edge bounds two faces. */
function curveMoment(curve: Curve, moments: Map<Curve, Point>): Point {
  let out = moments.get(curve);
  if (out) return out;
  out = [0, 0, 0];
  const [t0, t1] = curveDomain(curve), d1 = curveD1Evaluator(curve);
  const knots = [t0, ...curve.knots.filter(k => k > t0 && k < t1), t1].filter((k, i, all) => i === 0 || k > all[i - 1]);
  // (x × x′ on a polynomial span is a polynomial of degree 2p − 1: 4 points are exact up to cubics.)
  const G = curve.degree <= 3 && curve.weights.every(w => w === 1) ? G4 : G12;
  for (let k = 0; k + 1 < knots.length; k++) {
    const a = knots[k], b = knots[k + 1];
    for (let g = 0; g < G.x.length; g++) {
      const { point: x, derivative: d } = d1(a + (b - a) * G.x[g]), w = (b - a) * G.w[g] / 2;
      out[0] += (x[1] * d[2] - x[2] * d[1]) * w; out[1] += (x[2] * d[0] - x[0] * d[2]) * w; out[2] += (x[0] * d[1] - x[1] * d[0]) * w;
    }
  }
  moments.set(curve, out);
  return out;
}

/**
 * Where a face's integrals over its parameter domain go (one face at a time): its surface `at`, the steps for
 * its derivatives, the orientation `sigma`, the integrals, its vector area and area; for its trims' strips the
 * edge's evaluators `ev` (points) and `d1` (with derivatives).
 */
const sink = { at: null as unknown as (u: number, v: number) => Point, analytic: undefined as FaceParameters['analytic'], hu: 0, hv: 0, u0: 0, u1: 1, v0: 0, v1: 1, lu0: 0, lu1: 1, lv0: 0, lv1: 1, dropped: 0, sigma: 1, curved: [] as number[], vec: [0, 0, 0] as Point, area: 0, signed: 0,
  ev: null as unknown as (t: number) => Point, d1: null as unknown as (t: number) => CurveD1Result };
/**
 * Where a derivative's central difference about u is taken: u itself, else (u within a step of its domain's edge — a
 * trimmed face's mesh reaches it) a step inside, so the stencil stays on the surface. The shift moves the derivative
 * by at most a step's curvature (1e-6 of the face's span), on a band a step wide. (u outside the domain — a surface
 * evaluated round its seam — is left as it is. Unbounded frame coordinates are never shifted.)
 */
function stencilU(s: typeof sink, u: number): number { return u >= s.u0 && u - s.hu < s.u0 ? s.u0 + s.hu : u <= s.u1 && u + s.hu > s.u1 ? s.u1 - s.hu : u; }
function stencilV(s: typeof sink, v: number): number { return v >= s.v0 && v - s.hv < s.v0 ? s.v0 + s.hv : v <= s.v1 && v + s.hv > s.v1 ? s.v1 - s.hv : v; }
/** A knot vector's distinct knots strictly inside a domain. */
function interiorKnots(knots: readonly number[], range: readonly number[]): number[] {
  const out: number[] = [];
  for (const k of knots) if (k > range[0] && k < range[1] && (!out.length || k > out[out.length - 1])) out.push(k);
  return out;
}
/** A convex (u, v) polygon cut by the line where coordinate `axis` is k: the parts below and above it, each convex, in the polygon's turn. */
function cutPolygon(P: readonly XY[], axis: 0 | 1, k: number): [XY[], XY[]] {
  const below: XY[] = [], above: XY[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], da = a[axis] - k, db = b[axis] - k;
    if (da <= 0) below.push(a);
    if (da >= 0) above.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db), x: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      below.push(x); above.push(x);
    }
  }
  return [below, above];
}
/** The polygons' parts between each pair of knot lines along `axis` (lines outside a polygon leave it whole). */
function cutAlong(pieces: XY[][], axis: 0 | 1, knots: readonly number[]): XY[][] {
  for (const k of knots) {
    const next: XY[][] = [];
    for (const P of pieces) {
      let lo = Infinity, hi = -Infinity;
      for (const q of P) { if (q[axis] < lo) lo = q[axis]; if (q[axis] > hi) hi = q[axis]; }
      if (!(k > lo && k < hi)) { next.push(P); continue; }
      const [a, b] = cutPolygon(P, axis, k);
      if (a.length >= 3) next.push(a);
      if (b.length >= 3) next.push(b);
    }
    pieces = next;
  }
  return pieces;
}
/**
 * A domain triangle integrated cell by cell (FRk8b, D167): cut along the surface's knot lines, each convex piece fanned
 * into triangles, so the 16-point rule runs within one polynomial span. A triangle across several knot spans of a fitted
 * flank (a bevel gear's) had the rule straddle the spans' breaks: its integrals moved by 1–2 % with the tessellation.
 * (Each piece split in four besides changed the bevel pair by 1e-11 at twice the time: not done.)
 */
function cellTriangles(s: typeof sink, qa: XY, qb: XY, qc: XY, us: readonly number[], vs: readonly number[]): void {
  const pieces = cutAlong(cutAlong([[qa, qb, qc]], 0, us), 1, vs);
  if (pieces.length === 1) { triangle(s, qa, qb, qc); return; }
  // (A knot line through a vertex, to rounding, leaves a sliver of no area there: left out. Its rule's points, at the
  // domain's edge, could fall an ulp outside it.)
  const whole = Math.abs((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0]));
  for (const P of pieces) for (let i = 1; i + 1 < P.length; i++) {
    const a = P[0], b = P[i], c = P[i + 1];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-12 * whole) triangle(s, a, b, c);
  }
}
/** One triangle of the domain (signed by its (u, v) orientation) integrated by the 16-point rule. */
function triangle(s: typeof sink, qa: XY, qb: XY, qc: XY): void {
  const area = ((qb[0] - qa[0]) * (qc[1] - qa[1]) - (qb[1] - qa[1]) * (qc[0] - qa[0])) / 2;
  if (area === 0) return;
  for (const r of RULE) {
    const wa = r[0], wb = r[1], wc = r[2];
    surfacePoint(s, wa * qa[0] + wb * qb[0] + wc * qc[0], wa * qa[1] + wb * qb[1] + wc * qc[1], r[3] * area * s.sigma, s.curved, s.vec);
  }
}
/**
 * The surface at (u, v) with weight k (its (u, v) area times the rule's weight, signed outward by sigma) into the
 * integrals I and vector area vec, and its share of the area (`area` unsigned; `signed` by k, so that a strip inside its
 * chord takes off). (The hottest loop of a curved body's mass: no callbacks or temporary vectors per point.)
 */
function surfacePoint(s: typeof sink, u: number, v: number, k: number, I: number[], vec: Point): void {
  const at = s.at, hu = s.hu, hv = s.hv;
  if (s.analytic) {
    const [du, dv] = s.analytic.partials(u, v), n = cross(du, dv);
    accumulate(I, at(u, v), n, k);
    const a = Math.hypot(...n);
    vec[0] += n[0] * k; vec[1] += n[1] * k; vec[2] += n[2] * k; s.area += a * Math.abs(k); s.signed += a * k;
    return;
  }
  // (The point itself between the two stencils: each of its parameters then repeats the call before, and the evaluator
  // keeps that basis. K13, D244.)
  const cu = stencilU(s, u), cv = stencilV(s, v), pu = at(cu + hu, v), mu = at(cu - hu, v), p = at(u, v), pv = at(u, cv + hv), mv = at(u, cv - hv), su = 2 * hu, sv = 2 * hv;
  const ux = (pu[0] - mu[0]) / su, uy = (pu[1] - mu[1]) / su, uz = (pu[2] - mu[2]) / su, vx = (pv[0] - mv[0]) / sv, vy = (pv[1] - mv[1]) / sv, vz = (pv[2] - mv[2]) / sv;
  // The mesh is wound outward throughout: sigma times the signed (u, v) area is outward.
  normal[0] = uy * vz - uz * vy; normal[1] = uz * vx - ux * vz; normal[2] = ux * vy - uy * vx;
  accumulate(I, p, normal, k);
  const a = Math.hypot(normal[0], normal[1], normal[2]);
  vec[0] += normal[0] * k; vec[1] += normal[1] * k; vec[2] += normal[2] * k; s.area += a * Math.abs(k); s.signed += a * k;
}
// (A strip's edge parameters and their derivatives at the t nodes, and its integrals before they are kept.)
const ST = gauss(8), SS = gauss(4), PROBES = [0.5, 0.25, 0.75], stripC = new Float64Array(16), stripD = new Float64Array(16), stripI = Array(10).fill(0) as number[], stripVec: Point = [0, 0, 0];
// (At each t node: the edge's point E and the surface curve's tangent P′ = Su C′u + Sv C′v, for the ribbon from P to E; D177.)
const stripE = new Float64Array(24), stripT = new Float64Array(24), ribbonN: Point = [0, 0, 0], ribbonM: Point = [0, 0, 0];
/**
 * The strip between the domain's boundary chord p → q (in the domain's orientation) and the edge it stands for
 * (parameters tp → tq), integrated at once: ruled from the chord L(t) to the edge's parameters C(t) on the
 * surface, Φ(t, s) = L + s (C − L), by Gauss–Legendre (8 × 4: the strip is thin, its integrand smooth). The
 * Jacobian's sign adds what lies outside the chord and takes off what lies inside. An edge point that cannot be
 * put on the surface, or lands far off its chord (a seam), drops the strip, counted (`dropped`): the face's
 * vector-area check then holds it to 1e-9.
 */
function strip(s: typeof sink, p: XY, q: XY, tp: number, tq: number): void {
  const ex = q[0] - p[0], ey = q[1] - p[1], chord2 = ex * ex + ey * ey;
  if (!(chord2 > 0)) return;
  // An edge straight in (u, v) to rounding (a circle about a cylinder's axis, a ruling) leaves no strip. (Its
  // points only: the probes can fall on a circle's C0 knots, where it has no derivative.)
  // (Straight in (u, v) but off the surface — a facet mesh's chord against an exact wall — it still has its ribbon: the
  // strip is taken, its own part nil. D179.)
  let straight = true;
  for (const t of PROBES) {
    const l0 = p[0] + ex * t, l1 = p[1] + ey * t;
    let c: XY | null, E: Point; try { E = s.ev(tp + (tq - tp) * t); c = nearUV(s, E, [l0, l1]); } catch { s.dropped++; return; }
    if (!c) { s.dropped++; return; }
    const off = ex * (c[1] - l1) - ey * (c[0] - l0);
    if (off * off > 1e-24 * chord2 * chord2) { straight = false; break; }
    const P = s.at(c[0], c[1]), gap = Math.hypot(E[0] - P[0], E[1] - P[1], E[2] - P[2]);
    if (gap > 1e-12 * (1 + Math.abs(E[0]) + Math.abs(E[1]) + Math.abs(E[2]))) { straight = false; break; }
  }
  if (straight) return;
  for (let i = 0; i < 8; i++) {
    const t = ST.x[i], l0 = p[0] + ex * t, l1 = p[1] + ey * t;
    let c: XY | null, E: Point, dE: Point;
    try { ({ point: E, derivative: dE } = s.d1(tp + (tq - tp) * t)); c = nearUV(s, E, [l0, l1]); } catch { s.dropped++; return; }
    if (!c) { s.dropped++; return; }
    const off = ex * (c[1] - l1) - ey * (c[0] - l0);
    if (off * off > 0.25 * chord2 * chord2) { s.dropped++; return; }
    if (s.analytic) {
      try {
        const dc = s.analytic.projectDerivative(E, dE), [su, sv] = s.analytic.partials(c[0], c[1]), d0 = dc[0] * (tq - tp), d1 = dc[1] * (tq - tp);
        stripC[2 * i] = c[0]; stripC[2 * i + 1] = c[1]; stripD[2 * i] = d0; stripD[2 * i + 1] = d1;
        stripE[3 * i] = E[0]; stripE[3 * i + 1] = E[1]; stripE[3 * i + 2] = E[2];
        stripT[3 * i] = su[0] * d0 + sv[0] * d1; stripT[3 * i + 1] = su[1] * d0 + sv[1] * d1; stripT[3 * i + 2] = su[2] * d0 + sv[2] * d1;
      } catch { s.dropped++; return; }
      continue;
    }
    // C′(t) from the surface's tangents there: dE/dt = Su du + Sv dv (least squares).
    let Su: Point, Sv: Point;
    try { const cu = stencilU(s, c[0]), cv = stencilV(s, c[1]), pu = s.at(cu + s.hu, c[1]), mu = s.at(cu - s.hu, c[1]), pv = s.at(c[0], cv + s.hv), mv = s.at(c[0], cv - s.hv); Su = sub(pu, mu); Sv = sub(pv, mv); } catch { s.dropped++; return; }
    Su = [Su[0] / (2 * s.hu), Su[1] / (2 * s.hu), Su[2] / (2 * s.hu)]; Sv = [Sv[0] / (2 * s.hv), Sv[1] / (2 * s.hv), Sv[2] / (2 * s.hv)];
    const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12, r1 = dot(Su, dE) * (tq - tp), r2 = dot(Sv, dE) * (tq - tp);
    if (!(Math.abs(det) > 0)) { s.dropped++; return; }
    const d0 = (r1 * g22 - r2 * g12) / det, d1 = (g11 * r2 - g12 * r1) / det;
    stripC[2 * i] = c[0]; stripC[2 * i + 1] = c[1]; stripD[2 * i] = d0; stripD[2 * i + 1] = d1;
    stripE[3 * i] = E[0]; stripE[3 * i + 1] = E[1]; stripE[3 * i + 2] = E[2];
    stripT[3 * i] = Su[0] * d0 + Sv[0] * d1; stripT[3 * i + 1] = Su[1] * d0 + Sv[1] * d1; stripT[3 * i + 2] = Su[2] * d0 + Sv[2] * d1;
  }
  stripI.fill(0); stripVec[0] = stripVec[1] = stripVec[2] = 0;
  const area = s.area, signed = s.signed;
  try {
    for (let i = 0; i < 8; i++) {
      const t = ST.x[i], l0 = p[0] + ex * t, l1 = p[1] + ey * t, c0 = stripC[2 * i], c1 = stripC[2 * i + 1], d0 = stripD[2 * i], d1 = stripD[2 * i + 1];
      for (let j = 0; j < 4; j++) {
        // ∂Φ/∂t = L′ + s (C′ − L′), ∂Φ/∂s = C − L; the strip's area element is −det (chord left to right).
        const f = SS.x[j], at0 = ex + f * (d0 - ex), at1 = ey + f * (d1 - ey), as0 = c0 - l0, as1 = c1 - l1;
        surfacePoint(s, l0 + f * as0, l1 + f * as1, -(at0 * as1 - at1 * as0) * ST.w[i] * SS.w[j] * s.sigma, stripI, stripVec);
      }
      // The ribbon from the surface's point P = S(C) out to the edge's own point E: the edge lies off the surface by
      // its fit (a plane's cut through a cylinder, 2e-8 mm), and the neighbouring face is integrated up to E. The
      // strip continued, Y(t, s) = P + s (E − P), to first order in E − P: F(P + g/2)·(P′ × g), oriented as the strip.
      // (Without it the body's surface has that gap and its volume the flux through it: the V notch's 1.4e-11, D177.)
      const P = s.at(c0, c1), gx = stripE[3 * i] - P[0], gy = stripE[3 * i + 1] - P[1], gz = stripE[3 * i + 2] - P[2], tx = stripT[3 * i], ty = stripT[3 * i + 1], tz = stripT[3 * i + 2];
      ribbonN[0] = ty * gz - tz * gy; ribbonN[1] = tz * gx - tx * gz; ribbonN[2] = tx * gy - ty * gx;
      ribbonM[0] = P[0] + gx / 2; ribbonM[1] = P[1] + gy / 2; ribbonM[2] = P[2] + gz / 2;
      const w = -ST.w[i] * s.sigma;
      accumulate(stripI, ribbonM, ribbonN, w);
      stripVec[0] += ribbonN[0] * w; stripVec[1] += ribbonN[1] * w; stripVec[2] += ribbonN[2] * w; s.area += Math.hypot(ribbonN[0], ribbonN[1], ribbonN[2]) * Math.abs(w);
    }
  } catch { s.area = area; s.signed = signed; s.dropped++; return; }
  for (let k = 0; k < 10; k++) s.curved[k] += stripI[k];
  s.vec[0] += stripVec[0]; s.vec[1] += stripVec[1]; s.vec[2] += stripVec[2];
}
/**
 * The ribbon alone (D184), for a chord beside a surface's pole, where the strip stays out: from the surface's point
 * P = S(C) to the edge's own E at the strip's t nodes, F(P + g/2)·(P′ × g) as in `strip`, with P′ by central differences
 * of P itself (the surface's tangents degenerate at the pole). An edge on the surface adds nothing; a node not to be
 * inverted leaves the chord without its ribbon (its gap stays, as before D184).
 */
function ribbonOnly(s: typeof sink, p: XY, q: XY, tp: number, tq: number): void {
  const ex = q[0] - p[0], ey = q[1] - p[1];
  if (!(ex * ex + ey * ey > 0)) return;
  stripI.fill(0); stripVec[0] = stripVec[1] = stripVec[2] = 0;
  const area = s.area, h = 1e-4;
  let any = false;
  try {
    for (let i = 0; i < 8; i++) {
      const t = ST.x[i], E = s.ev(tp + (tq - tp) * t), c = nearUV(s, E, [p[0] + ex * t, p[1] + ey * t]);
      if (!c) throw new Error('ribbon projection failed');
      const P = s.at(c[0], c[1]), gx = E[0] - P[0], gy = E[1] - P[1], gz = E[2] - P[2];
      if (Math.hypot(gx, gy, gz) <= 1e-12 * (1 + Math.abs(E[0]) + Math.abs(E[1]) + Math.abs(E[2]))) continue;
      const Ea = s.ev(tp + (tq - tp) * (t - h)), Eb = s.ev(tp + (tq - tp) * (t + h));
      const ca = nearUV(s, Ea, [p[0] + ex * (t - h), p[1] + ey * (t - h)]), cb = nearUV(s, Eb, [p[0] + ex * (t + h), p[1] + ey * (t + h)]);
      if (!ca || !cb) throw new Error('ribbon projection failed');
      const Pa = s.at(ca[0], ca[1]), Pb = s.at(cb[0], cb[1]), tx = (Pb[0] - Pa[0]) / (2 * h), ty = (Pb[1] - Pa[1]) / (2 * h), tz = (Pb[2] - Pa[2]) / (2 * h);
      ribbonN[0] = ty * gz - tz * gy; ribbonN[1] = tz * gx - tx * gz; ribbonN[2] = tx * gy - ty * gx;
      ribbonM[0] = P[0] + gx / 2; ribbonM[1] = P[1] + gy / 2; ribbonM[2] = P[2] + gz / 2;
      const w = -ST.w[i] * s.sigma;
      accumulate(stripI, ribbonM, ribbonN, w);
      stripVec[0] += ribbonN[0] * w; stripVec[1] += ribbonN[1] * w; stripVec[2] += ribbonN[2] * w; s.area += Math.hypot(ribbonN[0], ribbonN[1], ribbonN[2]) * Math.abs(w);
      any = true;
    }
  } catch { s.area = area; return; }
  if (!any) return;
  for (let k = 0; k < 10; k++) s.curved[k] += stripI[k];
  s.vec[0] += stripVec[0]; s.vec[1] += stripVec[1]; s.vec[2] += stripVec[2];
}
/**
 * The parameters of the surface point nearest p, by Gauss–Newton (finite differences) from a nearby seed, its steps kept
 * within the face's own domain (`s`'s lu0 … lv1, where `uv` is the surface's own) and its differences taken inwards at the domain's edge; null when the point
 * it settles on at the domain's edge is not p (p lies off the domain: an edge's point across a seam) or the evaluator refuses. (FRk8b, D167:
 * a step past the domain's edge made the evaluator refuse, and the strip was dropped — 5764 strips over the conformance
 * cases, half of them seeded on the domain's edge.)
 */
function nearUV(s: typeof sink, p: Point, seed: XY): XY | null {
  try { return s.analytic ? s.analytic.project(p, seed) : gaussNewton(s, p, seed); } catch { return null; }
}
function gaussNewton(s: typeof sink, p: Point, seed: XY): XY | null {
  const at = s.at, inU = (x: number) => x < s.lu0 ? s.lu0 : x > s.lu1 ? s.lu1 : x, inV = (x: number) => x < s.lv0 ? s.lv0 : x > s.lv1 ? s.lv1 : x;
  let a = inU(seed[0]), b = inV(seed[1]);
  for (let it = 0; it < 20; it++) {
    const h0 = 1e-7 * (1 + Math.abs(a)), k0 = 1e-7 * (1 + Math.abs(b)), h = a + h0 > s.lu1 ? -h0 : h0, k = b + k0 > s.lv1 ? -k0 : k0, q = at(a, b), qa = at(a + h, b), qb = at(a, b + k);
    const Su: Point = [(qa[0] - q[0]) / h, (qa[1] - q[1]) / h, (qa[2] - q[2]) / h], Sv: Point = [(qb[0] - q[0]) / k, (qb[1] - q[1]) / k, (qb[2] - q[2]) / k], r = sub(p, q);
    const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12;
    if (!(Math.abs(det) > 1e-300)) return null;
    const da = (dot(r, Su) * g22 - dot(r, Sv) * g12) / det, db = (g11 * dot(r, Sv) - g12 * dot(r, Su)) / det, a1 = inU(a + da), b1 = inV(b + db);
    const still = Math.abs(a1 - a) < 1e-13 * (1 + Math.abs(a1)) && Math.abs(b1 - b) < 1e-13 * (1 + Math.abs(b1));
    a = a1; b = b1;
    if (still) break;
  }
  // (Held at the domain's edge, it must have reached p — within its edge's fit, 1e-6 of its size — else p lies off the
  // domain. Inside, Gauss–Newton's nearest point stands as it always did: an intersection edge's fitted points lie a
  // little off either surface.)
  if (a > s.lu0 && a < s.lu1 && b > s.lv0 && b < s.lv1) return [a, b];
  const q = at(a, b), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), tol = 1e-6 * (1 + Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]));
  if (d <= tol) return [a, b];
  // (Off the surface along its normal only — a chord of a facet mesh against an exact wall, its sag — p is the edge's,
  // not across a seam: its residual has no part along the surface (the unclamped step's tangent), D179.)
  const h0 = 1e-7 * (1 + Math.abs(a)), k0 = 1e-7 * (1 + Math.abs(b)), h = a + h0 > s.lu1 ? -h0 : h0, k = b + k0 > s.lv1 ? -k0 : k0, qa = at(a + h, b), qb = at(a, b + k);
  const ux = (qa[0] - q[0]) / h, uy = (qa[1] - q[1]) / h, uz = (qa[2] - q[2]) / h, vx = (qb[0] - q[0]) / k, vy = (qb[1] - q[1]) / k, vz = (qb[2] - q[2]) / k;
  const rx = p[0] - q[0], ry = p[1] - q[1], rz = p[2] - q[2], ru = rx * ux + ry * uy + rz * uz, rv = rx * vx + ry * vy + rz * vz;
  const g11 = ux * ux + uy * uy + uz * uz, g12 = ux * vx + uy * vy + uz * vz, g22 = vx * vx + vy * vy + vz * vz, det = g11 * g22 - g12 * g12;
  if (!(Math.abs(det) > 1e-300)) return null;
  const da = (ru * g22 - rv * g12) / det, db = (g11 * rv - g12 * ru) / det;
  return Math.hypot(ux * da + vx * db, uy * da + vy * db, uz * da + vz * db) <= tol ? [a, b] : null;
}
/**
 * The centre of the box of a B-rep's surfaces' control points (or the origin when it has none) as the
 * integrals' origin: the middle of the shape the faces lie on (a torus cut by a box: the torus's centre, not
 * its cut's), so errors that cancel by symmetry still do.
 */
function setCentre(brep: Brep): void {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of brep.faces) {
    if (f.surface.kind === 'facets') { const b = f.surface.bounds; for (let k = 0; k < 3; k++) { if (b[k] < lo[k]) lo[k] = b[k]; if (b[k + 3] > hi[k]) hi[k] = b[k + 3]; } continue; }
    for (const row of f.surface.controlPoints) for (const q of row) for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; }
  }
  for (let k = 0; k < 3; k++) centre[k] = lo[k] <= hi[k] ? (lo[k] + hi[k]) / 2 : 0;
}
/**
 * The integrals about the centre c moved to the world origin: ∫x = ∫x' + c_x V, ∫x² = ∫x'² + 2c_x ∫x' + c_x² V,
 * ∫xy = ∫x'y' + c_x ∫y' + c_y ∫x' + c_x c_y V (the area, the eleventh, is unchanged).
 */
function fromCentre(I: number[]): number[] {
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I, [cx, cy, cz] = centre;
  return [V, X + cx * V, Y + cy * V, Z + cz * V, XX + 2 * cx * X + cx * cx * V, YY + 2 * cy * Y + cy * cy * V, ZZ + 2 * cz * Z + cz * cz * V,
    XY + cx * Y + cy * X + cx * cy * V, XZ + cx * Z + cz * X + cx * cz * V, YZ + cy * Z + cz * Y + cy * cz * V, I[10]];
}
/**
 * Whether a curved face is its whole patch: one loop, every edge on the patch's domain boundary (sampled
 * at nine points, each within 1e-7 of the surface's size of one of the four boundary iso-curves, or within
 * the edge's own tolerance where it is a tolerant edge — a fitted offset's, D110), and the
 * loop as long as that boundary (to 1e-3, both measured as 64-segment polylines a curve). A closed loop made
 * only of boundary pieces, as long as the boundary, goes round it once: the face is the full domain.
 */
/** A test of whether a face of `brep` is its surface's whole patch, bounded by the four sides of its domain (D151: exact extremes). */
export function wholePatchTest(brep: Brep): (face: BrepFace) => boolean {
  const maps: Maps = { loops: new Map(brep.loops.map(l => [l.id, l])), coedges: new Map(brep.coedges.map(c => [c.id, c])), edges: new Map(brep.edges.map(e => [e.id, e])) };
  return face => face.surface.kind === 'surface' && wholePatch(face, maps);
}
function wholePatch(face: BrepFace, maps: Maps): boolean {
  if (face.loops.length !== 1) return false;
  const S = face.surface as Surface, at = surfaceEvaluator(S), { u: U, v: V } = surfaceDomain(S);
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
    const edge = maps.edges.get(maps.coedges.get(cid)!.edge)!, curve = edge.curve, c = curveEvaluator(curve), [t0, t1] = curveDomain(curve), near = Math.max(tol, edge.tolerance);
    let last: Point | null = null;
    for (let k = 0; k <= EDGE_SAMPLES; k++) {
      const p = c(t0 + (t1 - t0) * k / EDGE_SAMPLES);
      if (k % (EDGE_SAMPLES / 8) === 0 && !nearBoundary(at, U, V, sides, p, near)) return false;
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
/**
 * Whether p lies within `near` of the domain boundary's image: the nearest cached sample, refined by golden section on its
 * side. (A sample within `near` settles it: the search only lowers the distance. Its points lie between the side's
 * samples, which were evaluated without fault. K13, D244.)
 */
function nearBoundary(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], sides: Float64Array[], p: Point, near: number): boolean {
  let side = 0, best = 0, bestD = Infinity;
  for (let k = 0; k < 4; k++) for (let i = 0; i <= ISO_SAMPLES; i++) {
    const s = sides[k], dx = s[3 * i] - p[0], dy = s[3 * i + 1] - p[1], dz = s[3 * i + 2] - p[2];
    // A norm cannot be smaller than a component. bestD is still above near, or an earlier sample returned.
    if (Math.abs(dx) > bestD || Math.abs(dy) > bestD || Math.abs(dz) > bestD) continue;
    const d = Math.hypot(dx, dy, dz);
    if (d <= near) return true;
    if (d < bestD) { bestD = d; side = k; best = i; }
  }
  if (bestD <= near) return true;
  let a = Math.max(0, best - 1) / ISO_SAMPLES, b = Math.min(ISO_SAMPLES, best + 1) / ISO_SAMPLES;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = sideDistance(at, U, V, side, x1, p), f2 = sideDistance(at, U, V, side, x2, p);
  for (let it = 0; it < 60 && b - a > 1e-15; it++) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = sideDistance(at, U, V, side, x1, p); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = sideDistance(at, U, V, side, x2, p); }
  }
  return Math.min(bestD, f1, f2) <= near;
}
/** The distance from p to the point at fraction s along boundary side k. */
function sideDistance(at: (u: number, v: number) => Point, U: readonly number[], V: readonly number[], k: number, s: number, p: Point): number {
  const q = sidePoint(at, U, V, k, s); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
}
/**
 * A whole patch's ten integrals, added to I: tensor Gauss–Legendre on each knot span, n points a direction
 * from the integrand's degree (field cubic in the point, the point degree p, its Jacobian 2p − 1: n = ⌈5p/2⌉,
 * eight more for rational patches, whose cubic moments need more points than volume),
 * the outward normal ±∂S/∂u × ∂S/∂v by the face's sense.
 */
function patchIntegrals(face: BrepFace, I: number[]): void {
  const S = face.surface as Surface, sign = face.sense === 'forward' ? 1 : -1, { u: U, v: V } = surfaceDomain(S);
  const rational = S.weights.some(row => row.some(w => w !== 1));
  const gu = gaussOf(Math.min(20, Math.ceil(5 * S.degreeU / 2) + (rational ? 8 : 0))), gv = gaussOf(Math.min(20, Math.ceil(5 * S.degreeV / 2) + (rational ? 8 : 0)));
  // (Batched: each direction's basis values and first derivatives at its Gauss points worked out once per span; the
  // poles kept homogeneous in one array; the u sums made once per Gauss point in u and reused along v. No evaluator
  // call, validation or allocation per point: a 20k-span SubD body in a fraction of a second.)
  const bu = spanBases(S.knotsU, S.degreeU, spans(S.knotsU, U), gu.x), bv = spanBases(S.knotsV, S.degreeV, spans(S.knotsV, V), gv.x);
  // Center before weighting and column sums: late subtraction cannot recover a tiny derivative
  // lost between large absolute homogeneous coordinates. Native poles remain untouched.
  const nu = S.controlPoints.length, nv = S.controlPoints[0].length, Pw = new Float64Array(4 * nu * nv);
  for (let r = 0; r < nu; r++) for (let c = 0; c < nv; c++) { const w = S.weights[r][c], q = S.controlPoints[r][c], o = 4 * (r * nv + c); Pw[o] = (q[0] - centre[0]) * w; Pw[o + 1] = (q[1] - centre[1]) * w; Pw[o + 2] = (q[2] - centre[2]) * w; Pw[o + 3] = w; }
  const p = S.degreeU, q = S.degreeV, R = new Float64Array(4 * (q + 1)), Ru = new Float64Array(4 * (q + 1));
  for (let a = 0; a < bu.length; a++) {
    const A = bu[a];
    for (let i = 0; i < gu.x.length; i++) for (let b = 0; b < bv.length; b++) {
      const B = bv[b];
      uSums(Pw, nv, A.first, B.first, p, q, A.N, A.D, i, R, Ru);
      for (let j = 0; j < gv.x.length; j++) patchPoint(I, R, Ru, B.N, B.D, j, q, sign * gu.w[i] * gv.w[j] * A.length * B.length);
    }
  }
}
/** One span's basis values N and first derivatives D (p + 1 each) at every Gauss point, and its first pole index. */
interface SpanBasis { first: number; length: number; N: Float64Array; D: Float64Array }
function spanBases(knots: readonly number[], p: number, edges: readonly number[], x: readonly number[]): SpanBasis[] {
  const out: SpanBasis[] = [], left = new Float64Array(p + 1), right = new Float64Array(p + 1), ndu = new Float64Array((p + 1) * (p + 1));
  for (let a = 0; a + 1 < edges.length; a++) {
    const t0 = edges[a], length = edges[a + 1] - t0;
    let k = p; while (k + 1 < knots.length - p - 1 && knots[k + 1] <= t0) k++;
    const N = new Float64Array(x.length * (p + 1)), D = new Float64Array(x.length * (p + 1));
    for (let g = 0; g < x.length; g++) basisDerivatives(knots, p, k, t0 + length * x[g], left, right, ndu, N, D, g * (p + 1));
    out.push({ first: k - p, length, N, D });
  }
  return out;
}
/**
 * The p + 1 nonzero B-spline basis values at t in knot span k (knots[k] ≤ t < knots[k + 1]) and their first
 * derivatives, written at N[o…], D[o…] (the NURBS Book's triangle of ndu, then N′ from the degree p − 1 values).
 */
function basisDerivatives(knots: readonly number[], p: number, k: number, t: number, left: Float64Array, right: Float64Array, ndu: Float64Array, N: Float64Array, D: Float64Array, o: number): void {
  const w = p + 1;
  ndu[0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = t - knots[k + 1 - j]; right[j] = knots[k + j] - t;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      ndu[j * w + r] = right[r + 1] + left[j - r];
      const temp = ndu[r * w + j - 1] / ndu[j * w + r];
      ndu[r * w + j] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    ndu[j * w + j] = saved;
  }
  for (let r = 0; r <= p; r++) N[o + r] = ndu[r * w + p];
  // N′(i, p) = p N(i, p − 1)/(u(i+p) − u(i)) − p N(i+1, p − 1)/(u(i+p+1) − u(i+1)), i = k − p + r; the degree p − 1
  // values of i = k − p + 1 + s are ndu[s][p − 1].
  for (let r = 0; r <= p; r++) {
    const i = k - p + r;
    let d = 0;
    if (r > 0) { const den = knots[i + p] - knots[i]; if (den > 0) d += p * ndu[(r - 1) * w + p - 1] / den; }
    if (r < p) { const den = knots[i + p + 1] - knots[i + 1]; if (den > 0) d -= p * ndu[r * w + p - 1] / den; }
    D[o + r] = d;
  }
}
/** At Gauss point i in u of a span pair: for each pole column s of the v span, Σ_r N_r Pw and Σ_r N′_r Pw (homogeneous). */
function uSums(Pw: Float64Array, nv: number, ru: number, cv: number, p: number, q: number, N: Float64Array, D: Float64Array, i: number, R: Float64Array, Ru: Float64Array): void {
  const o = i * (p + 1);
  for (let s = 0; s <= q; s++) {
    let x = 0, y = 0, z = 0, w = 0, xu = 0, yu = 0, zu = 0, wu = 0;
    for (let r = 0; r <= p; r++) {
      const n = N[o + r], d = D[o + r], at = 4 * ((ru + r) * nv + cv + s);
      x += n * Pw[at]; y += n * Pw[at + 1]; z += n * Pw[at + 2]; w += n * Pw[at + 3];
      xu += d * Pw[at]; yu += d * Pw[at + 1]; zu += d * Pw[at + 2]; wu += d * Pw[at + 3];
    }
    R[4 * s] = x; R[4 * s + 1] = y; R[4 * s + 2] = z; R[4 * s + 3] = w;
    Ru[4 * s] = xu; Ru[4 * s + 1] = yu; Ru[4 * s + 2] = zu; Ru[4 * s + 3] = wu;
  }
}
/** At Gauss point j in v: the surface point and its partials (the quotient rule from the homogeneous sums), into I. */
function patchPoint(I: number[], R: Float64Array, Ru: Float64Array, N: Float64Array, D: Float64Array, j: number, q: number, weight: number): void {
  const o = j * (q + 1);
  let x = 0, y = 0, z = 0, w = 0, xu = 0, yu = 0, zu = 0, wu = 0, xv = 0, yv = 0, zv = 0, wv = 0;
  for (let s = 0; s <= q; s++) {
    const n = N[o + s], d = D[o + s], k = 4 * s;
    x += n * R[k]; y += n * R[k + 1]; z += n * R[k + 2]; w += n * R[k + 3];
    xu += n * Ru[k]; yu += n * Ru[k + 1]; zu += n * Ru[k + 2]; wu += n * Ru[k + 3];
    xv += d * R[k]; yv += d * R[k + 1]; zv += d * R[k + 2]; wv += d * R[k + 3];
  }
  const px = x / w, py = y / w, pz = z / w;
  const ux = (xu - px * wu) / w, uy = (yu - py * wu) / w, uz = (zu - pz * wu) / w, vx = (xv - px * wv) / w, vy = (yv - py * wv) / w, vz = (zv - pz * wv) / w;
  normal[0] = uy * vz - uz * vy; normal[1] = uz * vx - ux * vz; normal[2] = ux * vy - uy * vx;
  // The projected point is already local. Re-adding and subtracting the origin would lose bits again.
  accumulateLocal(I, px, py, pz, normal, weight);
  I[10] += Math.hypot(normal[0], normal[1], normal[2]) * Math.abs(weight);
}
/** A knot vector's distinct values inside the domain, ends included. */
function spans(knots: readonly number[], range: readonly number[]): number[] {
  const out = [range[0]];
  for (const k of knots) if (k > out[out.length - 1] && k < range[1]) out.push(k);
  out.push(range[1]);
  return out;
}
