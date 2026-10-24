// A ruled loft: closed profiles at increasing heights joined by straight rulings, each section's edge
// to the matching edge of the next. Sections with fewer edges have their longest edges halved until
// the counts agree, and each section's edges are turned to start where the previous section's start
// (about the centroids). Every side between two sections is one exact NURBS patch, linear across:
// planar or bilinear between parallel lines, otherwise a rational quadratic in u (a line meeting an
// arc takes the arc's weights). The section at a fraction λ of a span is (1 − λ)·C₀(s) + λ·C₁(s), so
// its area moments are polynomials of degree ≤ 4 in λ: the mass integrals are exact by three-point
// Gauss quadrature across, and to rounding along the (rational) edges by 24-point quadrature.
import { buildBrep, lineCurve, BrepError, type Brep, type BrepFaceInput } from '../brep/brep-core.js';
import { buildProfileLoop, capSurface, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { solidMassFromIntegrals, type MassProperties } from '../brep/solid-mass.js';
import type { Curve, Point, Surface } from '../types.js';
import { gauss } from '../core/quadrature.js';

type XY = [number, number];
type Piece = { readonly kind: 'line'; readonly a: XY; readonly b: XY } | { readonly kind: 'arc'; readonly c: XY; readonly r: number; readonly t0: number; readonly dt: number };
/** One span of a piece as a Bézier curve in the plane: control points and weights. */
interface Bezier { readonly p: readonly XY[]; readonly w: readonly number[] }

export interface LoftSectionInput { readonly profile: readonly ProfileSegmentInput[]; readonly z: number }
export interface LoftInput {
  readonly id: string; readonly sections: readonly LoftSectionInput[];
  /** Names faces `${name}.bottom`, `.top` and `.side${i}` (two sections, or smooth) or `.s${k}.side${i}`. */
  readonly name: string;
  /** Through three or more sections: one smooth (C1) side per edge instead of a ruled side per span. */
  readonly smooth?: boolean;
  /**
   * The first section's segment tags (R10a, D86): each side named `side[t]` by the segment of the first section it
   * runs from (several from one segment numbered `#k`), instead of by position.
   */
  readonly sideTags?: readonly string[];
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

const G3 = gauss(3), G24 = gauss(24);
/** A rational Bézier's point and derivative at s. */
function at(b: Bezier, s: number): [XY, XY] {
  const n = b.p.length - 1, B = n === 1 ? [1 - s, s] : [(1 - s) ** 2, 2 * s * (1 - s), s * s], dB = n === 1 ? [-1, 1] : [-2 * (1 - s), 2 - 4 * s, 2 * s];
  let W = 0, dW = 0, X = 0, Y = 0, dX = 0, dY = 0;
  for (let j = 0; j <= n; j++) { const c = B[j] * b.w[j], d = dB[j] * b.w[j]; W += c; dW += d; X += c * b.p[j][0]; Y += c * b.p[j][1]; dX += d * b.p[j][0]; dY += d * b.p[j][1]; }
  const x = X / W, y = Y / W;
  return [[x, y], [(dX - x * dW) / W, (dY - y * dW) / W]];
}

export function loftSolid(input: LoftInput): { brep: Brep; mass: (density: number) => MassProperties } {
  const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: ${detail}`); };
  const S = input.sections;
  if (S.length < 2) fail('needs at least two sections');
  for (let k = 1; k < S.length; k++) if (!(S[k].z > S[k - 1].z)) fail(`section ${k} must lie above section ${k - 1}`);

  // Each section's pieces (arcs in spans of at most 90°), counter-clockwise.
  // (The first section's pieces each keep the authored segment they come from, for tagged names.)
  const src0: number[] = [];
  const sections = S.map((s, si) => { const loop = buildProfileLoop(s.profile), m = loop.segments.length; return loop.segments.flatMap((g, gi): Piece[] => {
    const from = loop.reversed ? m - 1 - gi : gi;
    if (g.kind === 'line') { if (si === 0) src0.push(from); return [{ kind: 'line', a: g.start, b: g.end }]; }
    const n = Math.max(1, Math.ceil(Math.abs(g.sweep) / (Math.PI / 2) - 1e-9));
    if (si === 0) for (let k = 0; k < n; k++) src0.push(from);
    return Array.from({ length: n }, (_, k) => ({ kind: 'arc' as const, c: g.center, r: g.radius, t0: g.startAngle + g.sweep * k / n, dt: g.sweep / n }));
  }); });
  const n = Math.max(...sections.map(p => p.length));
  for (const p of sections) while (p.length < n) { let i = 0; p.forEach((q, j) => { if (lengthOf(q) > lengthOf(p[i])) i = j; }); p.splice(i, 1, ...half(p[i])); if (p === sections[0]) src0.splice(i, 1, src0[i], src0[i]); }
  const tagged = taggedSides(src0, input.sideTags);
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
  if (input.smooth && K >= 2) return smoothLoft(sections.map((p, k) => p.map((_, i) => piece(k, i))), z, id, nm, tagged);
  const sideName = (k: number, i: number) => K === 1 ? `${nm}.${tagged ? tagged[i] : `side${i}`}` : `${nm}.s${k}.${tagged ? tagged[i] : `side${i}`}`;
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

/**
 * A smooth loft: each edge's pieces through the sections joined by a cubic in v, C1 — non-uniform
 * Catmull–Rom tangents on the homogeneous control points (so it passes through every section exactly),
 * as Bézier spans (triple knots). Adjacent sides share their columns, so their edges are exact. The
 * mass is the divergence theorem over the sides (Gauss quadrature on each span) and the caps (exact
 * section moments).
 */
/** Side names from the first section's pieces' source segments and the tags (`side[t]`, `#k` when one segment gives several), or null untagged. */
function taggedSides(src0: readonly number[], tags: readonly string[] | undefined): string[] | null {
  if (!tags) return null;
  const count = new Map<number, number>(), seen = new Map<number, number>();
  for (const g of src0) count.set(g, (count.get(g) ?? 0) + 1);
  return src0.map(g => { const k = (seen.get(g) ?? 0) + 1; seen.set(g, k); return count.get(g)! > 1 ? `side[${tags[g]}]#${k}` : `side[${tags[g]}]`; });
}
function smoothLoft(rows: Bezier[][], z: number[], id: string, nm: string, tagged: string[] | null = null): { brep: Brep; mass: (density: number) => MassProperties } {
  const K = rows.length - 1, n = rows[0].length, v = z.map(x => (x - z[0]) / (z[K] - z[0]));
  type H = [number, number, number, number];
  const hom = (p: XY, zz: number, w: number): H => [p[0] * w, p[1] * w, zz * w, w];
  // Per edge i: its pieces raised to one degree (a line among arcs becomes quadratic, straight still).
  const columns = Array.from({ length: n }, (_, i) => {
    const deg = Math.max(...rows.map(r => r[i].p.length - 1)), pcs = rows.map(r => deg === 2 ? quadratic(r[i], 1) : r[i]);
    // cols[j] = the j-th control point through the sections, homogeneous.
    return Array.from({ length: deg + 1 }, (_, j) => pcs.map((b, k) => hom(b.p[j], z[k], b.w[j])));
  });
  const spline = (H: H[]): H[] => {
    const T = H.map((_, k) => { const a = Math.max(0, k - 1), b = Math.min(K, k + 1); return H[b].map((x, c) => (x - H[a][c]) / (v[b] - v[a])) as H; });
    const out: H[] = [H[0]];
    for (let k = 0; k < K; k++) { const d = (v[k + 1] - v[k]) / 3; out.push(H[k].map((x, c) => x + T[k][c] * d) as H, H[k + 1].map((x, c) => x - T[k + 1][c] * d) as H, H[k + 1]); }
    return out;
  };
  const knotsV = [0, 0, 0, 0, ...v.slice(1, K).flatMap(x => [x, x, x]), 1, 1, 1, 1];
  const nets = columns.map(cols => cols.map(spline));
  for (const net of nets) for (const col of net) for (const h of col) if (!(h[3] > 0)) throw new BrepError('GEOMETRY', 'loft: the sections are too far apart for a smooth side (a weight turned negative)');
  const point = (h: H): Point => [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
  const curveOf = (col: H[], cid: string): Curve => ({ kind: 'curve', id: cid, degree: 3, knots: [...knotsV], controlPoints: col.map(point), weights: col.map(h => h[3]) });
  const side = (i: number) => `${nm}.${tagged ? tagged[i] : `side${i}`}`;
  const vertices = rows.flatMap((r, k) => k === 0 || k === K ? r.map((b, i) => ({ id: `v${k}_${i}`, point: [b.p[0][0], b.p[0][1], z[k]] as Point })) : []);
  const edges: { id: string; curve: Curve; vertices: [string, string]; name?: string }[] = [];
  for (const k of [0, K]) rows[k].forEach((b, i) => edges.push({ id: `r${k}_${i}`, curve: curve3(b, z[k], `r${k}_${i}`), vertices: [`v${k}_${i}`, `v${k}_${(i + 1) % n}`], name: [k ? `${nm}.top` : `${nm}.bottom`, side(i)].sort().join('|') }));
  nets.forEach((net, i) => edges.push({ id: `c${i}`, curve: curveOf(net[0], `c${i}`), vertices: [`v0_${i}`, `v${K}_${i}`], name: [side((i + n - 1) % n), side(i)].sort().join('|') }));
  const faces: BrepFaceInput[] = nets.map((net, i) => ({ id: `f${i}`, sense: 'forward' as const, name: side(i),
    surface: { kind: 'surface' as const, id: `f${i}`, degreeU: net.length - 1, degreeV: 3, knotsU: net.length === 2 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1], knotsV: [...knotsV], controlPoints: net.map(col => col.map(point)), weights: net.map(col => col.map(h => h[3])) },
    loops: [{ kind: 'outer' as const, uses: [{ edge: `r0_${i}`, sense: 'forward' as const }, { edge: `c${(i + 1) % n}`, sense: 'forward' as const }, { edge: `r${K}_${i}`, sense: 'reversed' as const }, { edge: `c${i}`, sense: 'reversed' as const }] }] }));
  const bounds = (r: Bezier[]) => { const pts = r.flatMap(b => b.p); return { min: [Math.min(...pts.map(q => q[0])) - 1, Math.min(...pts.map(q => q[1])) - 1] as XY, max: [Math.max(...pts.map(q => q[0])) + 1, Math.max(...pts.map(q => q[1])) + 1] as XY }; };
  faces.push({ id: 'bottom', surface: capSurface(bounds(rows[0]), z[0], 'bottom', false), sense: 'forward', name: `${nm}.bottom`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: `r0_${n - 1 - j}`, sense: 'reversed' as const })) }] });
  faces.push({ id: 'top', surface: capSurface(bounds(rows[K]), z[K], 'top', true), sense: 'forward', name: `${nm}.top`, loops: [{ kind: 'outer', uses: Array.from({ length: n }, (_, j) => ({ edge: `r${K}_${j}`, sense: 'forward' as const })) }] });
  const brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });

  // ∫f dV = ∮ g n_z dA with ∂g/∂z = f, for f in [1, x, y, z, x², y², z², xy, xz, yz].
  const gOf = (x: number, y: number, zz: number) => [zz, x * zz, y * zz, zz * zz / 2, x * x * zz, y * y * zz, zz ** 3 / 3, x * y * zz, x * zz * zz / 2, y * zz * zz / 2];
  const I = Array(10).fill(0) as number[], G = gauss(16);
  const bern = (d: number, t: number): [number[], number[]] => d === 1 ? [[1 - t, t], [-1, 1]] : d === 2 ? [[(1 - t) ** 2, 2 * t * (1 - t), t * t], [-2 * (1 - t), 2 - 4 * t, 2 * t]] : [[(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], [-3 * (1 - t) ** 2, 3 * (1 - t) ** 2 - 6 * t * (1 - t), 6 * t * (1 - t) - 3 * t * t, 3 * t * t]];
  for (const net of nets) for (let k = 0; k < K; k++) {
    const dv = v[k + 1] - v[k], du = net.length - 1;
    G.x.forEach((a, ia) => G.x.forEach((b, ib) => {
      const [Bu, dBu] = bern(du, a), [Bv, dBv] = bern(3, b), N = [0, 0, 0, 0], Nu = [0, 0, 0, 0], Nv = [0, 0, 0, 0];
      for (let j = 0; j <= du; j++) for (let m = 0; m < 4; m++) { const h = net[j][3 * k + m]; for (let c = 0; c < 4; c++) { N[c] += Bu[j] * Bv[m] * h[c]; Nu[c] += dBu[j] * Bv[m] * h[c]; Nv[c] += Bu[j] * dBv[m] * h[c] / dv; } }
      const P = [N[0] / N[3], N[1] / N[3], N[2] / N[3]], Su = [0, 1, 2].map(c => (Nu[c] - P[c] * Nu[3]) / N[3]), Sv = [0, 1, 2].map(c => (Nv[c] - P[c] * Nv[3]) / N[3]);
      const nz = Su[0] * Sv[1] - Su[1] * Sv[0], wgt = G.w[ia] * G.w[ib] * dv, g = gOf(P[0], P[1], P[2]);
      for (let q = 0; q < 10; q++) I[q] += wgt * g[q] * nz;
    }));
  }
  // The caps: down at the bottom, up at the top (section moments by Green's theorem).
  for (const [k, sign] of [[0, -1], [K, 1]] as const) {
    let A = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0;
    for (const b of rows[k]) G24.x.forEach((t, j) => { const [p, d] = at(b, t), w = G24.w[j], [x, y] = p; A += w * x * d[1]; Sx += w * x * x / 2 * d[1]; Sy -= w * y * y / 2 * d[0]; Sxx += w * x ** 3 / 3 * d[1]; Syy -= w * y ** 3 / 3 * d[0]; Sxy += w * x * x * y / 2 * d[1]; });
    const zc = z[k], m = [zc * A, zc * Sx, zc * Sy, zc * zc / 2 * A, zc * Sxx, zc * Syy, zc ** 3 / 3 * A, zc * Sxy, zc * zc / 2 * Sx, zc * zc / 2 * Sy];
    for (let q = 0; q < 10; q++) I[q] += sign * m[q];
  }
  return { brep, mass: density => solidMassFromIntegrals(I, density, 'quadrature') };
}
