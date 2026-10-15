// A ruled loft: closed profiles at increasing heights joined by straight rulings, each section's edge
// to the matching edge of the next. Sections with fewer edges have their longest edges halved until
// the counts agree, and each section's edges are turned to start where the previous section's start
// (about the centroids). Every side between two sections is one exact NURBS patch, linear across:
// planar or bilinear between parallel lines, otherwise a rational quadratic in u (a line meeting an
// arc takes the arc's weights). The section at a fraction λ of a span is (1 − λ)·C₀(s) + λ·C₁(s), so
// its area moments are polynomials of degree ≤ 4 in λ: the mass integrals are exact by three-point
// Gauss quadrature across, and to rounding along the (rational) edges by 24-point quadrature.
import { buildBrep, lineCurve, BrepError, type Brep, type BrepFaceInput } from './brep-core.js';
import { buildProfileLoop, capSurface, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { solidMassFromIntegrals, type SolidMassProperties } from './solid-mass.js';
import type { Curve, Point, Surface } from './types.js';

type XY = [number, number];
type Piece = { readonly kind: 'line'; readonly a: XY; readonly b: XY } | { readonly kind: 'arc'; readonly c: XY; readonly r: number; readonly t0: number; readonly dt: number };
/** One span of a piece as a Bézier curve in the plane: control points and weights. */
interface Bezier { readonly p: readonly XY[]; readonly w: readonly number[] }

export interface LoftSectionInput { readonly profile: readonly ProfileSegmentInput[]; readonly z: number }
export interface LoftInput {
  readonly id: string; readonly sections: readonly LoftSectionInput[];
  /** Names faces `${name}.bottom`, `.top` and `.side${i}` (two sections) or `.s${k}.side${i}`. */
  readonly name: string;
}

const startOf = (q: Piece): XY => q.kind === 'line' ? q.a : [q.c[0] + q.r * Math.cos(q.t0), q.c[1] + q.r * Math.sin(q.t0)];
const lengthOf = (q: Piece) => q.kind === 'line' ? Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) : q.r * Math.abs(q.dt);
const half = (q: Piece): [Piece, Piece] => {
  if (q.kind === 'line') { const m: XY = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2]; return [{ kind: 'line', a: q.a, b: m }, { kind: 'line', a: m, b: q.b }]; }
  return [{ ...q, dt: q.dt / 2 }, { ...q, t0: q.t0 + q.dt / 2, dt: q.dt / 2 }];
};
const bezier = (q: Piece): Bezier => {
  if (q.kind === 'line') return { p: [q.a, q.b], w: [1, 1] };
  const t1 = q.t0 + q.dt, tm = q.t0 + q.dt / 2, w = Math.cos(Math.abs(q.dt) / 2), rm = q.r / w;
  return { p: [startOf(q), [q.c[0] + rm * Math.cos(tm), q.c[1] + rm * Math.sin(tm)], [q.c[0] + q.r * Math.cos(t1), q.c[1] + q.r * Math.sin(t1)]], w: [1, w, 1] };
};
/** Degree 2 with the given middle weight (a line stays straight). */
const quadratic = (b: Bezier, w: number): Bezier => b.p.length === 3 ? b : { p: [b.p[0], [(b.p[0][0] + b.p[1][0]) / 2, (b.p[0][1] + b.p[1][1]) / 2], b.p[1]], w: [1, w, 1] };
const curve3 = (b: Bezier, z: number, id: string): Curve => ({ kind: 'curve', id, degree: b.p.length - 1, knots: b.p.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], controlPoints: b.p.map(p => [p[0], p[1], z] as Point), weights: [...b.w] });

// Gauss–Legendre nodes and weights on [0, 1].
function gauss(n: number): { x: number[]; w: number[] } {
  const x: number[] = [], w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      d = n * (t * p1 - p0) / (t * t - 1);
      const dx = p1 / d; t -= dx;
      if (Math.abs(dx) < 1e-16) break;
    }
    x.push((1 - t) / 2); w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
}
const G3 = gauss(3), G24 = gauss(24);
/** A rational Bézier's point and derivative at s. */
function at(b: Bezier, s: number): [XY, XY] {
  const n = b.p.length - 1, B = n === 1 ? [1 - s, s] : [(1 - s) ** 2, 2 * s * (1 - s), s * s], dB = n === 1 ? [-1, 1] : [-2 * (1 - s), 2 - 4 * s, 2 * s];
  let W = 0, dW = 0, X = 0, Y = 0, dX = 0, dY = 0;
  for (let j = 0; j <= n; j++) { const c = B[j] * b.w[j], d = dB[j] * b.w[j]; W += c; dW += d; X += c * b.p[j][0]; Y += c * b.p[j][1]; dX += d * b.p[j][0]; dY += d * b.p[j][1]; }
  const x = X / W, y = Y / W;
  return [[x, y], [(dX - x * dW) / W, (dY - y * dW) / W]];
}

export function loftSolid(input: LoftInput): { brep: Brep; mass: (densityKgPerM3: number) => SolidMassProperties } {
  const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: ${detail}`); };
  const S = input.sections;
  if (S.length < 2) fail('needs at least two sections');
  for (let k = 1; k < S.length; k++) if (!(S[k].z > S[k - 1].z)) fail(`section ${k} must lie above section ${k - 1}`);

  // Each section's pieces (arcs in spans of at most 90°), counter-clockwise.
  const sections = S.map(s => buildProfileLoop(s.profile).segments.flatMap((g): Piece[] => {
    if (g.kind === 'line') return [{ kind: 'line', a: g.start, b: g.end }];
    const n = Math.max(1, Math.ceil(Math.abs(g.sweep) / (Math.PI / 2) - 1e-9));
    return Array.from({ length: n }, (_, k) => ({ kind: 'arc' as const, c: g.center, r: g.radiusMM, t0: g.startAngle + g.sweep * k / n, dt: g.sweep / n }));
  }));
  const n = Math.max(...sections.map(p => p.length));
  for (const p of sections) while (p.length < n) { let i = 0; p.forEach((q, j) => { if (lengthOf(q) > lengthOf(p[i])) i = j; }); p.splice(i, 1, ...half(p[i])); }
  // Turn each section to start nearest the previous one's start (directions about the centroids).
  const shape = (p: Piece[]) => { const pts = p.map(startOf), c = pts.reduce((m, q) => [m[0] + q[0] / n, m[1] + q[1] / n], [0, 0]), rms = Math.sqrt(pts.reduce((m, q) => m + (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2, 0) / n) || 1; return pts.map(q => [(q[0] - c[0]) / rms, (q[1] - c[1]) / rms]); };
  for (let k = 1; k < sections.length; k++) {
    const a = shape(sections[k - 1]), b = shape(sections[k]);
    let best = 0, cost = Infinity;
    for (let sh = 0; sh < n; sh++) { const c = a.reduce((m, q, i) => m + (q[0] - b[(i + sh) % n][0]) ** 2 + (q[1] - b[(i + sh) % n][1]) ** 2, 0); if (c < cost - 1e-12) { cost = c; best = sh; } }
    sections[k] = [...sections[k].slice(best), ...sections[k].slice(0, best)];
  }

  const K = sections.length - 1, z = S.map(s => s.z), id = input.id, nm = input.name;
  const scale = Math.max(1, ...sections.flat().map(q => Math.max(...startOf(q).map(Math.abs))), ...z.map(Math.abs)), tol = 1e-9 * scale;
  // Each piece as a Bézier ending exactly where the next one starts (its vertex).
  const piece = (k: number, i: number): Bezier => { const b = bezier(sections[k][i]); return { p: [...b.p.slice(0, -1), startOf(sections[k][(i + 1) % n])], w: b.w }; };
  const sideName = (k: number, i: number) => K === 1 ? `${nm}.side${i}` : `${nm}.s${k}.side${i}`;
  const vid = (k: number, i: number) => `v${k}_${i % n}`, rid = (k: number, i: number) => `r${k}_${i % n}`, lid = (k: number, i: number) => `l${k}_${i % n}`;
  const vertices = sections.flatMap((p, k) => p.map((q, i) => ({ id: vid(k, i), point: [...startOf(q), z[k]] as Point })));
  const edges: { id: string; curve: Curve; vertices: [string, string]; name?: string }[] = [];
  sections.forEach((p, k) => p.forEach((q, i) => {
    const below = k > 0 ? sideName(k - 1, i) : `${nm}.bottom`, above = k < K ? sideName(k, i) : `${nm}.top`;
    edges.push({ id: rid(k, i), curve: curve3(piece(k, i), z[k], rid(k, i)), vertices: [vid(k, i), vid(k, i + 1)], name: [below, above].sort().join('|') });
    if (k < K) edges.push({ id: lid(k, i), curve: lineCurve(lid(k, i), [...startOf(q), z[k]], [...startOf(sections[k + 1][i]), z[k + 1]]), vertices: [vid(k, i), vid(k + 1, i)], name: [sideName(k, (i + n - 1) % n), sideName(k, i)].sort().join('|') });
  }));

  // The sides: each a patch between a section's edge and the next one's, with the curves the mass uses.
  const faces: BrepFaceInput[] = [], spans: { lo: Bezier; hi: Bezier; z0: number; z1: number }[] = [];
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) {
    let lo = piece(k, i), hi = piece(k + 1, i);
    if (lo.p.length !== hi.p.length) { const w = (lo.p.length === 3 ? lo : hi).w[1]; lo = quadratic(lo, w); hi = quadratic(hi, w); }
    else if (lo.p.length === 2) {
      // Two lines: a plane when they are parallel or meet, otherwise twisted (made quadratic, exact still).
      const [a0, b0] = lo.p.map(p => [p[0], p[1], z[k]]), [a1, b1] = hi.p.map(p => [p[0], p[1], z[k + 1]]);
      const u = [b0[0] - a0[0], b0[1] - a0[1], 0], v = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], d = [b1[0] - a0[0], b1[1] - a0[1], b1[2] - a0[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0], nl = Math.hypot(nx, ny, nz);
      if (Math.abs(nx * d[0] + ny * d[1] + nz * d[2]) / nl > tol) { lo = quadratic(lo, 1); hi = quadratic(hi, 1); }
    }
    spans.push({ lo, hi, z0: z[k], z1: z[k + 1] });
    const surface: Surface = { kind: 'surface', id: `f${k}_${i}`, degreeU: lo.p.length - 1, degreeV: 1, knotsU: lo.p.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
      controlPoints: lo.p.map((p, j) => [[p[0], p[1], z[k]], [hi.p[j][0], hi.p[j][1], z[k + 1]]]), weights: lo.w.map((w, j) => [w, hi.w[j]]) };
    faces.push({ id: `f${k}_${i}`, surface, sense: 'forward', name: sideName(k, i), loops: [{ kind: 'outer', uses: [
      { edge: rid(k, i), sense: 'forward' }, { edge: lid(k, i + 1), sense: 'forward' }, { edge: rid(k + 1, i), sense: 'reversed' }, { edge: lid(k, i), sense: 'reversed' }] }] });
  }
  const bounds = (p: Piece[]) => { const pts = p.flatMap(q => bezier(q).p); return { min: [Math.min(...pts.map(q => q[0])) - 1, Math.min(...pts.map(q => q[1])) - 1] as XY, max: [Math.max(...pts.map(q => q[0])) + 1, Math.max(...pts.map(q => q[1])) + 1] as XY }; };
  faces.push({ id: 'bottom', surface: capSurface(bounds(sections[0]), z[0], 'bottom', false), sense: 'forward', name: `${nm}.bottom`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: rid(0, n - 1 - j), sense: 'reversed' as const })) }] });
  faces.push({ id: 'top', surface: capSurface(bounds(sections[K]), z[K], 'top', true), sense: 'forward', name: `${nm}.top`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: rid(K, j), sense: 'forward' as const })) }] });
  const brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });

  // Volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] by sections (Green's theorem along them).
  const I = Array(10).fill(0) as number[];
  for (const { lo, hi, z0, z1 } of spans) {
    const h = z1 - z0;
    G3.x.forEach((l, a) => {
      const zz = z0 + l * h, wl = G3.w[a] * h;
      let A = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
      G24.x.forEach((s, b) => {
        const [p0, d0] = at(lo, s), [p1, d1] = at(hi, s), ws = G24.w[b];
        const x = (1 - l) * p0[0] + l * p1[0], y = (1 - l) * p0[1] + l * p1[1], dx = (1 - l) * d0[0] + l * d1[0], dy = (1 - l) * d0[1] + l * d1[1];
        A += ws * x * dy; Sx += ws * x * x / 2 * dy; Sy -= ws * y * y / 2 * dx; Sxx += ws * x ** 3 / 3 * dy; Syy -= ws * y ** 3 / 3 * dx; Sxy += ws * x * x * y / 2 * dy;
      });
      I[0] += wl * A; I[1] += wl * Sx; I[2] += wl * Sy; I[3] += wl * zz * A; I[4] += wl * Sxx; I[5] += wl * Syy; I[6] += wl * zz * zz * A; I[7] += wl * Sxy; I[8] += wl * zz * Sx; I[9] += wl * zz * Sy;
    });
  }
  return { brep, mass: density => solidMassFromIntegrals(I, density, 'quadrature') };
}
