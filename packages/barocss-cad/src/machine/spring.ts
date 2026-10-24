// R12c.1a (D153): the helical sweep of a round wire's normal-plane circle, and compression springs.
//
// The centreline C(φ) = (R cos φ, R sin φ, z(φ)) runs on a cylinder of radius R; its pitch 2π z'(φ) is constant on a
// run, or eases from one pitch to the next (smoothstep in φ, so z is C², the wire tangent-continuous across runs). The
// wire's section is the exact circle of radius a in the plane normal to C at φ, on the frame
//   e1 = (−cos φ, −sin φ, 0) (toward the axis),  e2 = T × e1 = (σ sin φ, −σ cos φ, γ),  σ = z'/L, γ = R/L, L = √(R² + z'²),
// so a section point (x, y) (mm along e1, e2) is P(φ; x, y) = ((R − x) cos φ + yσ sin φ, (R − x) sin φ − yσ cos φ, z + yγ).
// P is affine in (x, y), so each of the circle's four rational quarters (degree 2, the quarters' joins at 45°, 135° …)
// is carried along φ by its three control points' paths P(φ; x_k, y_k); each path is fitted by cubic Hermite pieces
// (exact value and φ-derivative at the piece ends — on a constant pitch the gears' rotation fit, `rotationPoles`, with z
// exact). A face is a quarter times its paths' fits: degree 2 × 3, at most 4 pieces (13 poles, the 16-pole convention).
// The surface's distance from the exact pipe at the same parameters is a positively weighted mean of its control
// paths' errors, so the largest path error, measured on every piece, bounds it: that is the reported deviation, held
// within the profile tolerance (1e-4·d by default) by adding pieces; past the budget, PROFILE_BUDGET_EXCEEDED, never a
// looser fit (D129). The level circles are exact (the normal-plane circle itself); the ends are the normal discs.
//
// A compression spring (D139): open ends — one run at its pitch; closed ends — a dead coil at each end at the
// geometric solid pitch (the least pitch keeping neighbouring turns of the centreline d apart: it falls short of d's
// pitch by the helix angle, S0), easing to the body's pitch over the transition (90° by default) centred on the end of
// the dead coil, so the rise is 2 n_e p_s + n_a p; closed and ground — the same wire from z 0, cut square to the axis at
// the centreline's two end heights by the analytic Boolean (the ground faces `.ground0`, `.ground1`). The wire's end
// disc is halved by that cut and the ground face runs about half a turn. A left-hand spring is the right-hand one
// mirrored in the XZ plane. The rate needs the shear modulus G (an input: no default here; the studio prefills steel's
// as a flagged estimate, the owner's decision). Faces `<id>.wire#k`, `.end0`, `.end1` (the discs), `.ground0/1`.
import { buildBrep, type Brep, type BrepFaceInput } from '../brep/brep-core.js';
import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { transformBrep } from '../brep/brep-transform.js';
import { glueAtSharedFace } from '../brep/brep-glue.js';
import type { Curve, Point, Surface } from '../types.js';
import { add as vAdd, cross as vCross, dot as vDot, scale as vScl, sub as vSub } from '../core/vec3.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

export type SpringDiagnosticCode = 'INVALID_INPUT' | 'SELF_INTERSECTION' | 'COILS_OVERLAP' | 'PROFILE_BUDGET_EXCEEDED' | 'UNSUPPORTED_SPRING_KIND' | 'LEG_OVERLAP';
export interface SpringDiagnostic { readonly code: SpringDiagnosticCode; readonly severity: 'error' | 'warning'; readonly message: string }
/** This module's refusal (R7.3a batch 2: the SpringError class folded, D279): a BarocssError, `details.source` 'spring'. */
export const springError = (code: SpringDiagnosticCode, detail: string) => kernelRefusal('spring', code, `spring: ${detail}`) as KernelError & { readonly code: SpringDiagnosticCode };
/** Whether something thrown is this module's refusal. */
export const isSpringError = (e: unknown): e is KernelError & { readonly code: SpringDiagnosticCode } => isFrom<SpringDiagnosticCode>(e, 'spring');

// ---- the helical sweep -------------------------------------------------------------------------------------------------

/** A run of the centreline: `turns` turns at `pitch`, or easing from it to `toPitch` (smoothstep in the angle). */
export interface HelicalRun { readonly turns: number; readonly pitch: number; readonly toPitch?: number }
/** Version 0 of the helical sweep: a circle swept square to a right-hand helix of radius `helixRadius` about +Z. */
export interface HelicalSweepSpec {
  readonly helixRadius: number;
  readonly runs: readonly HelicalRun[];
  /** The section, in the centreline's normal plane: a circle only in this stage (lines and arcs later, D139). */
  readonly section: { readonly kind: 'circle'; readonly radius: number };
  /** The centreline's height at φ 0 (default 0); the wire starts on +X. */
  readonly startZ?: number;
  /** The largest distance of the fitted surface from the exact pipe (default 1e-4 × the section's diameter). */
  readonly profileTolerance?: number;
  /** The most cubic pieces along the sweep (default 1024). */
  readonly maxPieces?: number;
}
export interface HelicalSweepResult {
  readonly brep: Brep;
  /** The centreline's length (constant runs exactly, easing runs by 24-point Gauss–Legendre). */
  readonly wireLength: number;
  /** The centreline's height at its end. */
  readonly endZ: number;
  readonly pieces: number; readonly segments: number;
  /** The measured bound on the surface's distance from the exact pipe, and the tolerance it was held to. */
  readonly profileDeviation: number; readonly profileTolerance: number;
  /** The centreline's least radius of curvature (sampled on easing runs; R(1 + (h/R)²) on constant ones). */
  readonly minCurvatureRadius: number;
}

interface Run { readonly phi0: number; readonly phi1: number; readonly p0: number; readonly p1: number; readonly z0: number }
/** Height, slope and curvature of z on a run at φ: [z, z', z'']. */
function zAt(r: Run, phi: number): [number, number, number] {
  const D = r.phi1 - r.phi0, t = Math.min(1, Math.max(0, (phi - r.phi0) / D)), dp = r.p1 - r.p0;
  return [r.z0 + D / (2 * Math.PI) * (r.p0 * t + dp * (t * t * t - t * t * t * t / 2)), (r.p0 + dp * t * t * (3 - 2 * t)) / (2 * Math.PI), dp * 6 * t * (1 - t) / (2 * Math.PI * D)];
}
/** P(φ; x, y) and its φ-derivative on radius R, given z's [z, z', z''] at φ (written into out[0..5]). */
function sectionPoint(R: number, phi: number, zz: readonly [number, number, number], x: number, y: number, out: number[]): void {
  const c = Math.cos(phi), s = Math.sin(phi), [z, zp, zpp] = zz, L2 = R * R + zp * zp, L = Math.sqrt(L2), L3 = L2 * L;
  const sg = zp / L, gm = R / L, sgp = zpp * R * R / L3, gmp = -R * zp * zpp / L3, r = R - x;
  out[0] = r * c + y * sg * s; out[1] = r * s - y * sg * c; out[2] = z + y * gm;
  out[3] = -r * s + y * (sgp * s + sg * c); out[4] = r * c + y * (sg * s - sgp * c); out[5] = zp + y * gmp;
}
const W = Math.SQRT1_2;
/** The eight section control points (x, y): even k on the circle at 45° + 45°k, odd k the quarters' corners (radius a/w). */
function sectionPoles(a: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 8; k++) { const t = Math.PI / 4 * (k + 1), r = k % 2 ? a / W : a; out.push([r * Math.cos(t), r * Math.sin(t)]); }
  return out;
}
const bezierKnots = (N: number): number[] => { const k = [0, 0, 0, 0]; for (let i = 1; i < N; i++) k.push(i, i, i); k.push(N, N, N, N); return k; };
const runAt = (runs: readonly Run[], phi: number): Run => { for (const r of runs) if (phi <= r.phi1 + 1e-12) return r; return runs[runs.length - 1]; };

/** The Hermite poles (3k + 1 points) of the path of section pole (x, y) over [fa, fb] in k pieces, on run r. */
function pathPoles(R: number, r: Run, fa: number, fb: number, k: number, x: number, y: number, buf: number[]): Point[] {
  const out: Point[] = [], h = (fb - fa) / k / 3;
  for (let i = 0; i <= k; i++) {
    const f = fa + (fb - fa) * i / k;
    sectionPoint(R, f, zAt(r, f), x, y, buf);
    if (i > 0) out.push([buf[0] - h * buf[3], buf[1] - h * buf[4], buf[2] - h * buf[5]]);
    out.push([buf[0], buf[1], buf[2]]);
    if (i < k) out.push([buf[0] + h * buf[3], buf[1] + h * buf[4], buf[2] + h * buf[5]]);
  }
  return out;
}
/** The largest distance of a path's Hermite fit from the path itself (15 points inside each piece). */
function pathDeviation(R: number, r: Run, fa: number, fb: number, k: number, x: number, y: number, P: readonly Point[], buf: number[]): number {
  let worst = 0;
  for (let i = 0; i < k; i++) for (let j = 1; j < 16; j++) {
    const t = j / 16, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t, q = 3 * i, f = fa + (fb - fa) * (i + t) / k;
    sectionPoint(R, f, zAt(r, f), x, y, buf);
    const dx = b0 * P[q][0] + b1 * P[q + 1][0] + b2 * P[q + 2][0] + b3 * P[q + 3][0] - buf[0], dy = b0 * P[q][1] + b1 * P[q + 1][1] + b2 * P[q + 2][1] + b3 * P[q + 3][1] - buf[1], dz = b0 * P[q][2] + b1 * P[q + 1][2] + b2 * P[q + 2][2] + b3 * P[q + 3][2] - buf[2];
    worst = Math.max(worst, Math.hypot(dx, dy, dz));
  }
  return worst;
}
// 24-point Gauss–Legendre on [−1, 1] (nodes and weights computed once by Newton on P_24).
const GL = (() => {
  const n = 24, x: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    let t = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = n * (t * p1 - p0) / (t * t - 1); const step = p1 / dp; t -= step; if (Math.abs(step) < 1e-16) break;
    }
    x.push(t); w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();
const curvatureRadius = (R: number, zp: number, zpp: number): number => { const L2 = R * R + zp * zp; return L2 * Math.sqrt(L2) / (R * Math.sqrt(L2 + zpp * zpp)); };

/** A segment of the sweep: [fa, fb] on run `run` in `k` pieces. */
interface Segment { readonly run: Run; readonly fa: number; readonly fb: number; readonly k: number }
/** A run's segments for `n` pieces: ⌈n/4⌉ segments of equal angle, each ⌈n/segments⌉ pieces. */
function layout(r: Run, n: number): Segment[] {
  const S = Math.max(1, Math.ceil(n / 4)), k = Math.max(1, Math.ceil(n / S)), out: Segment[] = [];
  for (let j = 0; j < S; j++) out.push({ run: r, fa: r.phi0 + (r.phi1 - r.phi0) * j / S, fb: r.phi0 + (r.phi1 - r.phi0) * (j + 1) / S, k });
  return out;
}

/** A sweep's runs and centreline, checked: what each range of it is built from. */
interface Prepared { readonly R: number; readonly a: number; readonly runs: readonly Run[]; readonly tol: number; readonly budget: number; readonly wireLength: number; readonly minRho: number; readonly endZ: number; readonly end: number; readonly poles: readonly [number, number][]; readonly s0: number }
function prepare(spec: HelicalSweepSpec): Prepared {
  const R = spec.helixRadius, a = spec.section?.radius;
  if (spec.section?.kind !== 'circle') throw springError('UNSUPPORTED_SPRING_KIND', 'the helical sweep takes a circle section in this stage');
  if (!(Number.isFinite(R) && R > 0 && Number.isFinite(a) && a > 0)) throw springError('INVALID_INPUT', 'the helix radius and the section radius must be numbers of mm above 0');
  if (!(a < R)) throw springError('SELF_INTERSECTION', `a wire of radius ${a} mm on a helix of radius ${R} mm meets itself at the axis`);
  if (!spec.runs?.length) throw springError('INVALID_INPUT', 'a helical sweep needs at least one run');
  const tol = spec.profileTolerance ?? 2e-4 * a, budget = spec.maxPieces ?? 1024;
  if (!(Number.isFinite(tol) && tol > 0)) throw springError('INVALID_INPUT', 'profileTolerance must be a number of mm above 0');
  const runs: Run[] = [];
  let phi = 0, z = spec.startZ ?? 0;
  for (const r of spec.runs) {
    const p1 = r.toPitch ?? r.pitch;
    if (!(Number.isFinite(r.turns) && r.turns > 0 && Number.isFinite(r.pitch) && r.pitch > 0 && Number.isFinite(p1) && p1 > 0)) throw springError('INVALID_INPUT', 'each run needs turns and pitches above 0');
    const run: Run = { phi0: phi, phi1: phi + 2 * Math.PI * r.turns, p0: r.pitch, p1, z0: z };
    runs.push(run); phi = run.phi1; z = zAt(run, phi)[0];
  }
  // The centreline: its length and least radius of curvature.
  let wireLength = 0, minRho = Infinity;
  for (const r of runs) {
    const D = r.phi1 - r.phi0;
    if (r.p0 === r.p1) { const h = r.p0 / (2 * Math.PI); wireLength += Math.hypot(R, h) * D; minRho = Math.min(minRho, R * (1 + (h / R) ** 2)); continue; }
    for (let i = 0; i < GL.x.length; i++) { const f = r.phi0 + D * (GL.x[i] + 1) / 2, [, zp, zpp] = zAt(r, f); wireLength += GL.w[i] * D / 2 * Math.hypot(R, zp); minRho = Math.min(minRho, curvatureRadius(R, zp, zpp)); }
    for (let i = 0; i <= 64; i++) { const [, zp, zpp] = zAt(r, r.phi0 + D * i / 64); minRho = Math.min(minRho, curvatureRadius(R, zp, zpp)); }
  }
  if (!(a < minRho)) throw springError('SELF_INTERSECTION', `the wire's radius ${a} mm reaches the centreline's least radius of curvature ${minRho.toFixed(6)} mm`);
  // Pieces start from the rotation fit's error (≈ s⁴/384 per unit radius) at the outermost pole, then are measured.
  return { R, a, runs, tol, budget, wireLength, minRho, endZ: z, end: phi, poles: sectionPoles(a), s0: Math.pow(384 * tol / (R + a / W), 0.25) };
}

/** The centreline's height at φ. */
const heightAt = (P: Prepared, phi: number): number => zAt(runAt(P.runs, phi), phi)[0];
/** R/L at φ: the section's tilt (e2's rise per unit). */
const gammaAt = (P: Prepared, phi: number): number => P.R / Math.hypot(P.R, zAt(runAt(P.runs, phi), phi)[1]);

/**
 * The wire over [from, to] (a range of the sweep's angle) as one closed B-rep: its pieces measured and refined within the
 * tolerance; ids prefixed `id`, faces named `<name>.wire#k` from `first`, its discs `<name>.end0` and `.end1` (or `<id>.cap0/1`
 * where `inner` says the range meets another there, for gluing).
 */
function sweepRange(id: string, name: string, P: Prepared, from: number, to: number, first: number, used: number, inner: readonly [boolean, boolean]): { brep: Brep; pieces: number; segments: number; deviation: number } {
  const { R, poles, tol, budget, s0 } = P, buf = [0, 0, 0, 0, 0, 0], segments: Segment[] = [];
  let worst = 0, pieces = used;
  for (const run of P.runs) {
    const lo = Math.max(run.phi0, from), hi = Math.min(run.phi1, to);
    if (!(hi - lo > 1e-12)) continue;
    const r: Run = { ...run }, span = { ...r, phi0: lo, phi1: hi };
    let n = Math.max(1, Math.ceil((hi - lo) / s0)), segs: Segment[] = [], dev = Infinity;
    for (let tries = 0; tries < 12; tries++) {
      segs = layout(span, n).map(g => ({ ...g, run: r })); dev = 0;
      for (const g of segs) for (const [x, y] of poles) dev = Math.max(dev, pathDeviation(R, r, g.fa, g.fb, g.k, x, y, pathPoles(R, r, g.fa, g.fb, g.k, x, y, buf), buf));
      if (dev <= tol || pieces + segs.reduce((s, g) => s + g.k, 0) > budget) break;
      n = Math.ceil(n * Math.max(1.1, Math.pow(dev / tol, 0.25) * 1.05));
    }
    segments.push(...segs); worst = Math.max(worst, dev); pieces += segs.reduce((s, g) => s + g.k, 0);
    if (pieces > budget || dev > tol) throw springError('PROFILE_BUDGET_EXCEEDED', `a wire within ${tol} mm of its pipe needs more than ${budget} cubic pieces along the sweep (${pieces} so far, measured ${dev.toExponential(2)} mm)`);
  }
  // Four vertices and four exact quarter arcs at every level, four side edges and faces per segment.
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  const level = (j: number, f: number, r: Run): void => {
    const zz = zAt(r, f), at: Point[] = [];
    for (const [x, y] of poles) { sectionPoint(R, f, zz, x, y, buf); at.push([buf[0], buf[1], buf[2]]); }
    for (let i = 0; i < 4; i++) vertices.push({ id: `${id}_v${i}_${j}`, point: at[2 * i] });
    for (let i = 0; i < 4; i++) edges.push({ id: `${id}_a${i}_${j}`, curve: { kind: 'curve', id: `${id}_a${i}_${j}c`, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [at[2 * i], at[2 * i + 1], at[(2 * i + 2) % 8]], weights: [1, W, 1] }, vertices: [`${id}_v${i}_${j}`, `${id}_v${(i + 1) % 4}_${j}`] });
  };
  level(0, from, segments[0].run);
  segments.forEach((g, j) => {
    const paths = poles.map(([x, y]) => pathPoles(R, g.run, g.fa, g.fb, g.k, x, y, buf));
    level(j + 1, g.fb, g.run);
    for (let i = 0; i < 4; i++) edges.push({ id: `${id}_s${i}_${j}`, curve: { kind: 'curve', id: `${id}_s${i}_${j}c`, degree: 3, knots: bezierKnots(g.k), controlPoints: paths[2 * i], weights: paths[2 * i].map(() => 1) }, vertices: [`${id}_v${i}_${j}`, `${id}_v${i}_${j + 1}`] });
    for (let i = 0; i < 4; i++) {
      const rows = [paths[2 * i], paths[2 * i + 1], paths[(2 * i + 2) % 8]];
      const surface: Surface = { kind: 'surface', id: `${id}_f${i}_${j}s`, degreeU: 2, degreeV: 3, knotsU: [0, 0, 0, 1, 1, 1], knotsV: bezierKnots(g.k), controlPoints: rows, weights: [1, W, 1].map(w => rows[0].map(() => w)) };
      faces.push({ id: `${id}_f${i}_${j}`, name: `${name}.wire#${first + 4 * j + i}`, sense: 'forward', surface,
        loops: [{ kind: 'outer', uses: [{ edge: `${id}_a${i}_${j}`, sense: 'forward' }, { edge: `${id}_s${(i + 1) % 4}_${j}`, sense: 'forward' }, { edge: `${id}_a${i}_${j + 1}`, sense: 'reversed' }, { edge: `${id}_s${i}_${j}`, sense: 'reversed' }] }] });
    }
  });
  // The discs on planes square to the centreline: the start's normal −T (its patch spanned along e2, then e1).
  const S = segments.length;
  faces.push({ id: `${id}_end0`, name: inner[0] ? `${id}.cap0` : `${name}.end0`, sense: 'forward', surface: disc(id, 'end0', P, from, true, buf), loops: [{ kind: 'outer', uses: [3, 2, 1, 0].map(i => ({ edge: `${id}_a${i}_0`, sense: 'reversed' as const })) }] });
  faces.push({ id: `${id}_end1`, name: inner[1] ? `${id}.cap1` : `${name}.end1`, sense: 'forward', surface: disc(id, 'end1', P, to, false, buf), loops: [{ kind: 'outer', uses: [0, 1, 2, 3].map(i => ({ edge: `${id}_a${i}_${S}`, sense: 'forward' as const })) }] });
  const brep = buildBrep({ source: { family: 'spring', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  return { brep, pieces: pieces - used, segments: S, deviation: worst };
}
/** The disc of the section at φ as a plane patch (2a square), oriented out of the range (−T at its start). */
function disc(id: string, tag: string, P: Prepared, f: number, start: boolean, buf: number[]): Surface {
  const zz = zAt(runAt(P.runs, f), f), q = 2 * P.a, pt = (x: number, y: number): Point => { sectionPoint(P.R, f, zz, x, y, buf); return [buf[0], buf[1], buf[2]]; };
  const controlPoints = start ? [[pt(-q, -q), pt(q, -q)], [pt(-q, q), pt(q, q)]] : [[pt(-q, -q), pt(-q, q)], [pt(q, -q), pt(q, q)]];
  return { kind: 'surface', id: `${id}_${tag}s`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints, weights: [[1, 1], [1, 1]] };
}

/** Sweep a circle square to a helix: the wire of a coil (see the file's header). */
export function helicalSweep(id: string, spec: HelicalSweepSpec): HelicalSweepResult {
  const P = prepare(spec), made = sweepRange(id, id, P, 0, P.end, 1, 0, [false, false]);
  return { brep: made.brep, wireLength: P.wireLength, endZ: P.endZ, pieces: made.pieces, segments: made.segments, profileDeviation: made.deviation, profileTolerance: P.tol, minCurvatureRadius: P.minRho };
}

// ---- compression springs -----------------------------------------------------------------------------------------------

/** Version 0 of a compression spring's inputs (lengths in mm, G in MPa, loads in N). */
export interface SpringSpec {
  /** `compression` (compressionSpring); `extension` and `torsion` are hookedSpring's (R12c.1b). */
  readonly type?: 'compression' | 'extension' | 'torsion';
  /** Only `cylindrical` (conical, barrel and variable-pitch bodies are not in R12c). */
  readonly body?: 'cylindrical' | 'conical' | 'barrel' | 'variable-pitch';
  /** Only `round` wire. */
  readonly wire?: 'round' | 'rectangular';
  readonly wireDiameter: number;
  /** The mean coil diameter D — or the outer (D + d) or inner (D − d); exactly one. */
  readonly meanDiameter?: number; readonly outerDiameter?: number; readonly innerDiameter?: number;
  readonly activeCoils: number;
  /** The body's pitch, or the free length L0; exactly one. */
  readonly pitch?: number; readonly freeLength?: number;
  readonly hand?: 'right' | 'left';
  readonly ends?: 'open' | 'closed' | 'closed-ground';
  /** Dead coils at each closed end (default 1; above 0, at most 1 in this stage: more would touch each other). */
  readonly endCoils?: number;
  /** The pitch's transition from the dead coil to the body, degrees (default 90). */
  readonly transition?: number;
  /** The wire's shear modulus G for the rate; `shearModulusEstimate` flags a value that is an estimate (the studio's steel). */
  readonly shearModulus?: number; readonly shearModulusEstimate?: boolean;
  /** A working load: its deflection, length and corrected shear stress are reported. */
  readonly load?: number;
  readonly profileTolerance?: number;
}
export interface SpringDimensions {
  readonly wireDiameter: number; readonly meanDiameter: number; readonly outerDiameter: number; readonly innerDiameter: number;
  /** C = D/d, and Wahl's factor K_W = (4C − 1)/(4C − 4) + 0.615/C. */
  readonly springIndex: number; readonly wahlFactor: number;
  readonly activeCoils: number; readonly endCoils: number; readonly totalCoils: number;
  readonly pitch: number; readonly helixAngle: number; readonly freeLength: number;
  /** L0 / D. No buckling claim is made. */
  readonly slenderness: number;
  /** The least pitch keeping neighbouring turns of the centreline d apart (geometric), and the solid height at it. */
  readonly solidPitch: number; readonly solidHeight: number;
  /** The supplier's convention (the formula pages, S1 in D139): d·n_t with ground ends, d·(n_t + 1) otherwise. */
  readonly supplierSolidHeight: number; readonly supplierSolidHeightRule: 'd·n_t' | 'd·(n_t + 1)';
  /** L0 less the geometric solid height. */
  readonly travelToSolid: number;
  /** k = G d⁴ / (8 D³ n_a), when G is given; G and whether it is an estimate. */
  readonly rate?: number; readonly shearModulus?: number; readonly shearModulusEstimate?: boolean;
  /** At the working load: deflection F/k, the length then, τ = K_W 8FD/(πd³) and the uncorrected 8FD/(πd³). */
  readonly load?: { readonly force: number; readonly deflection?: number; readonly length?: number; readonly shearStress: number; readonly uncorrectedShearStress: number };
}
export interface SpringReport {
  readonly generator: 'spring@0'; readonly type: 'compression'; readonly ends: 'open' | 'closed' | 'closed-ground'; readonly hand: 'right' | 'left';
  readonly dimensions: SpringDimensions;
  readonly sweep: Omit<HelicalSweepResult, 'brep' | 'endZ'>;
  /** No fatigue, buckling, relaxation or manufacturing claim. */
  readonly manufacturingValidated: false;
  readonly diagnostics: readonly SpringDiagnostic[];
}

/** The least distance, over the angle t near one turn, between C(φ) and C(φ + t) on a helix of radius R and pitch p. */
function turnGap(R: number, p: number): number {
  const h = p / (2 * Math.PI);
  let t = 2 * Math.PI;
  // g(t) = 4R² sin²(t/2) + h²t²; g'(t) = 2R² sin t + 2h² t, g'' = 2R² cos t + 2h² (> 0 near 2π).
  for (let it = 0; it < 60; it++) { const step = (R * R * Math.sin(t) + h * h * t) / (R * R * Math.cos(t) + h * h); t -= step; if (Math.abs(step) < 1e-15) break; }
  return Math.sqrt(4 * R * R * Math.sin(t / 2) ** 2 + h * h * t * t);
}
/** The geometric solid pitch: the least pitch keeping neighbouring turns of the centreline (mean diameter D) d apart. */
export function springSolidPitch(meanDiameter: number, wireDiameter: number): number {
  const R = meanDiameter / 2, d = wireDiameter;
  let lo = d, hi = 2 * d;
  for (let i = 0; i < 200 && hi - lo > 1e-15 * hi; i++) { const m = (lo + hi) / 2; if (turnGap(R, m) < d) lo = m; else hi = m; }
  return hi;
}

const fail = (code: SpringDiagnosticCode, detail: string): never => { throw springError(code, detail); };
const positive = (v: number | undefined, what: string): number => (Number.isFinite(v) && (v as number) > 0 ? v as number : fail('INVALID_INPUT', `${what} must be a number above 0`));

interface Resolved { readonly d: number; readonly D: number; readonly na: number; readonly ne: number; readonly tau: number; readonly ends: 'open' | 'closed' | 'closed-ground'; readonly hand: 'right' | 'left'; readonly p: number; readonly ps: number; readonly L0: number }
function resolve(spec: SpringSpec): Resolved {
  if (spec.type !== undefined && spec.type !== 'compression') fail(spec.type === 'extension' || spec.type === 'torsion' ? 'INVALID_INPUT' : 'UNSUPPORTED_SPRING_KIND', spec.type === 'extension' || spec.type === 'torsion' ? `${spec.type} springs are hookedSpring's (compressionSpring builds compression springs)` : `${String(spec.type)} springs are not supported (compression, extension and torsion)`);
  if (spec.body !== undefined && spec.body !== 'cylindrical') fail('UNSUPPORTED_SPRING_KIND', `a ${String(spec.body)} body is not supported (cylindrical only)`);
  if (spec.wire !== undefined && spec.wire !== 'round') fail('UNSUPPORTED_SPRING_KIND', `${String(spec.wire)} wire is not supported (round only)`);
  const d = positive(spec.wireDiameter, 'wireDiameter');
  const given = [spec.meanDiameter, spec.outerDiameter, spec.innerDiameter].filter(v => v !== undefined).length;
  if (given !== 1) fail('INVALID_INPUT', 'give exactly one of meanDiameter, outerDiameter and innerDiameter');
  const D = spec.meanDiameter !== undefined ? positive(spec.meanDiameter, 'meanDiameter') : spec.outerDiameter !== undefined ? positive(spec.outerDiameter, 'outerDiameter') - d : positive(spec.innerDiameter, 'innerDiameter') + d;
  if (!(D > d)) fail('INVALID_INPUT', `the mean diameter ${D} mm must exceed the wire's ${d} mm (spring index above 1)`);
  const na = positive(spec.activeCoils, 'activeCoils'), ends = spec.ends ?? 'closed-ground', hand = spec.hand ?? 'right';
  if (ends !== 'open' && ends !== 'closed' && ends !== 'closed-ground') fail('INVALID_INPUT', `ends must be open, closed or closed-ground (got ${String(ends)})`);
  if (hand !== 'right' && hand !== 'left') fail('INVALID_INPUT', `hand must be right or left (got ${String(hand)})`);
  const ne = ends === 'open' ? 0 : spec.endCoils === undefined ? 1 : positive(spec.endCoils, 'endCoils');
  if (ne > 1) fail('UNSUPPORTED_SPRING_KIND', `${ne} end coils: dead coils above 1 would touch each other, not modelled in this stage`);
  const tau = (spec.transition === undefined ? 90 : positive(spec.transition, 'transition')) * Math.PI / 180;
  if (ends !== 'open' && !(2 * Math.PI * ne > tau / 2)) fail('INVALID_INPUT', `the transition of ${spec.transition ?? 90}° needs more than ${(tau / (4 * Math.PI)).toFixed(4)} end coils`);
  if (ends !== 'open' && !(2 * Math.PI * na > tau)) fail('INVALID_INPUT', `the transitions of ${spec.transition ?? 90}° need more than ${(tau / (2 * Math.PI)).toFixed(4)} active coils`);
  if ((spec.pitch === undefined) === (spec.freeLength === undefined)) fail('INVALID_INPUT', 'give exactly one of pitch and freeLength');
  const ps = springSolidPitch(D, d), R = D / 2, a = d / 2, gamma = (p: number) => R / Math.hypot(R, p / (2 * Math.PI));
  let p: number, L0: number;
  if (spec.pitch !== undefined) {
    p = positive(spec.pitch, 'pitch');
    L0 = ends === 'open' ? na * p + 2 * a * gamma(p) : 2 * ne * ps + na * p + (ends === 'closed' ? 2 * a * gamma(ps) : 0);
  } else {
    L0 = positive(spec.freeLength, 'freeLength');
    if (ends === 'open') { let lo = 0, hi = L0 / na; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (na * m + 2 * a * gamma(m) < L0) lo = m; else hi = m; } p = (lo + hi) / 2; }
    else p = (L0 - 2 * ne * ps - (ends === 'closed' ? 2 * a * gamma(ps) : 0)) / na;
  }
  if (!(p >= ps)) fail('COILS_OVERLAP', `the body's pitch ${p.toFixed(6)} mm is below the geometric solid pitch ${ps.toFixed(6)} mm (D ${D}, d ${d}): neighbouring turns would overlap`);
  return { d, D, na, ne, tau, ends, hand, p, ps, L0 };
}

/** A compression spring's dimensions, rate and stresses, without its geometry. */
export function springDimensions(spec: SpringSpec): SpringDimensions {
  const r = resolve(spec), { d, D, na, ne, p, ps, L0, ends } = r, R = D / 2, a = d / 2, C = D / d, KW = (4 * C - 1) / (4 * C - 4) + 0.615 / C, nt = na + 2 * ne;
  const gs = R / Math.hypot(R, ps / (2 * Math.PI)), solid = ends === 'closed-ground' ? nt * ps : nt * ps + 2 * a * gs, ground = ends === 'closed-ground';
  let rate: number | undefined;
  if (spec.shearModulus !== undefined) rate = positive(spec.shearModulus, 'shearModulus') * d ** 4 / (8 * D ** 3 * na);
  let load: SpringDimensions['load'];
  if (spec.load !== undefined) {
    const F = spec.load;
    if (!(Number.isFinite(F) && F >= 0)) fail('INVALID_INPUT', 'load must be a number of N, 0 or more');
    const tau0 = 8 * F * D / (Math.PI * d ** 3);
    load = { force: F, ...(rate ? { deflection: F / rate, length: L0 - F / rate } : {}), shearStress: KW * tau0, uncorrectedShearStress: tau0 };
  }
  return {
    wireDiameter: d, meanDiameter: D, outerDiameter: D + d, innerDiameter: D - d, springIndex: C, wahlFactor: KW,
    activeCoils: na, endCoils: ne, totalCoils: nt, pitch: p, helixAngle: Math.atan(p / (Math.PI * D)) * 180 / Math.PI, freeLength: L0, slenderness: L0 / D,
    solidPitch: ps, solidHeight: solid, supplierSolidHeight: ground ? d * nt : d * (nt + 1), supplierSolidHeightRule: ground ? 'd·n_t' : 'd·(n_t + 1)', travelToSolid: L0 - solid,
    ...(rate !== undefined ? { rate: rate, shearModulus: spec.shearModulus, ...(spec.shearModulusEstimate ? { shearModulusEstimate: true } : {}) } : {}),
    ...(load ? { load } : {}),
  };
}

/** A plane-faced box (degree-1 patches, outward), its top face or bottom face named `name`. */
function slab(id: string, half: number, z0: number, z1: number, named: 'top' | 'bottom', name: string): Brep {
  const P = (x: number, y: number, z: number): Point => [x * half, y * half, z];
  const c = [P(-1, -1, z0), P(1, -1, z0), P(1, 1, z0), P(-1, 1, z0), P(-1, -1, z1), P(1, -1, z1), P(1, 1, z1), P(-1, 1, z1)];
  const vertices = c.map((point, i) => ({ id: `${id}_v${i}`, point }));
  const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const edges = pairs.map(([i, j], k) => ({ id: `${id}_e${k}`, curve: { kind: 'curve' as const, id: `${id}_e${k}c`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [c[i], c[j]], weights: [1, 1] }, vertices: [`${id}_v${i}`, `${id}_v${j}`] as [string, string] }));
  const edgeOf = (i: number, j: number) => { const k = pairs.findIndex(([x, y]) => (x === i && y === j) || (x === j && y === i)); return { edge: `${id}_e${k}`, sense: pairs[k][0] === i ? 'forward' as const : 'reversed' as const }; };
  // Each face's corners counter-clockwise seen from outside; its patch spanned so that ∂u × ∂v points out.
  const quads: [number, number, number, number, string][] = [[0, 3, 2, 1, 'bottom'], [4, 5, 6, 7, 'top'], [0, 1, 5, 4, 's0'], [1, 2, 6, 5, 's1'], [2, 3, 7, 6, 's2'], [3, 0, 4, 7, 's3']];
  const faces: BrepFaceInput[] = quads.map(([i, j, k, l, tag]) => ({ id: `${id}_${tag}`, name: tag === named ? name : `${id}.${tag}`, sense: 'forward',
    surface: { kind: 'surface', id: `${id}_${tag}s`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[c[i], c[l]], [c[j], c[k]]], weights: [[1, 1], [1, 1]] },
    loops: [{ kind: 'outer', uses: [edgeOf(i, j), edgeOf(j, k), edgeOf(k, l), edgeOf(l, i)] }] }));
  return buildBrep({ source: { family: 'spring-cut', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
}

/** A compression spring (spring@0) in its own frame: axis +Z, from z 0 (its lowest point, or its ground plane), the wire starting on +X. */
export function compressionSpring(spec: SpringSpec, options: { readonly id?: string } = {}): { readonly brep: Brep; readonly report: SpringReport } {
  const id = (options.id ?? 'spring').replace(/[^A-Za-z0-9_.-]/g, '_'), dims = springDimensions(spec), r = resolve(spec);
  const { d, D, na, ne, tau, ends, hand, p, ps } = r, R = D / 2, a = d / 2, gs = R / Math.hypot(R, ps / (2 * Math.PI)), gp = R / Math.hypot(R, p / (2 * Math.PI));
  const tt = tau / (2 * Math.PI), runs: HelicalRun[] = ends === 'open' ? [{ turns: na, pitch: p }]
    : [{ turns: ne - tt / 2, pitch: ps }, { turns: tt, pitch: ps, toPitch: p }, { turns: na - tt, pitch: p }, { turns: tt, pitch: p, toPitch: ps }, { turns: ne - tt / 2, pitch: ps }];
  const startZ = ends === 'open' ? a * gp : ends === 'closed' ? a * gs : 0;
  const sweepSpec: HelicalSweepSpec = { helixRadius: R, runs, section: { kind: 'circle', radius: a }, startZ: startZ, ...(spec.profileTolerance === undefined ? {} : { profileTolerance: spec.profileTolerance }) };
  let brep: Brep, sw: Omit<HelicalSweepResult, 'brep' | 'endZ'>;
  if (ends !== 'closed-ground') { const made = helicalSweep(id, sweepSpec); brep = made.brep; sw = made; }
  else {
    // The ground ends: everything below the centreline's start height and above its end height, cut away — on the end
    // pieces only (to where the wire's underside clears the plane by a/4), glued back to the body at their shared discs.
    const P = prepare(sweepSpec), half = R + 2 * d + 1;
    let cut = 0;
    while (cut < P.end / 2 && !(heightAt(P, cut) - a * gammaAt(P, cut) > a / 4)) cut += P.end / 2048;
    const g0 = slab(`${id}_g0`, half, -d - 1, 0, 'top', `${id}.ground0`), g1 = slab(`${id}_g1`, half, P.endZ, P.endZ + d + 1, 'bottom', `${id}.ground1`);
    if (!(cut < P.end / 2 - P.s0)) {
      const made = sweepRange(id, id, P, 0, P.end, 1, 0, [false, false]);
      brep = booleanAnalytic(booleanAnalytic(made.brep, g0, 'difference'), g1, 'difference');
      sw = { wireLength: P.wireLength, pieces: made.pieces, segments: made.segments, profileDeviation: made.deviation, profileTolerance: P.tol, minCurvatureRadius: P.minRho };
    } else {
      // (The Boolean numbers a cut piece's faces `<id>.wire#1` … by position; the body's and the top piece's follow on.)
      const s0 = sweepRange(`${id}_0`, id, P, 0, cut, 1, 0, [false, true]), lo = booleanAnalytic(s0.brep, g0, 'difference', { id: `${id}_0` });
      const m0 = lo.faces.filter(f => f.name?.startsWith(`${id}.wire#`)).length;
      const s1 = sweepRange(`${id}_1`, id, P, cut, P.end - cut, m0 + 1, s0.pieces, [true, true]);
      const s2 = sweepRange(`${id}_2`, id, P, P.end - cut, P.end, 1, s0.pieces + s1.pieces, [true, false]);
      const off = m0 + 4 * s1.segments, mark = `${id}.wire#`;
      const hi = transformBrep(booleanAnalytic(s2.brep, g1, 'difference', { id: `${id}_2` }), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split(mark).map((x, i) => i === 0 ? x : x.replace(/^\d+/, k => String(+k + off))).join(mark));
      const source = { family: 'spring', id }, joined = glueAtSharedFace(lo, s1.brep, source), all = joined && glueAtSharedFace(joined, hi, source);
      if (!all) throw springError('PROFILE_BUDGET_EXCEEDED', 'the ground end pieces did not meet the body at their discs');
      brep = all;
      sw = { wireLength: P.wireLength, pieces: s0.pieces + s1.pieces + s2.pieces, segments: s0.segments + s1.segments + s2.segments, profileDeviation: Math.max(s0.deviation, s1.deviation, s2.deviation), profileTolerance: P.tol, minCurvatureRadius: P.minRho };
    }
  }
  if (hand === 'left') brep = transformBrep(brep, { matrix: [1, 0, 0, 0, -1, 0, 0, 0, 1] });
  const diagnostics: SpringDiagnostic[] = [];
  if (dims.load?.length !== undefined && dims.load.length < dims.solidHeight) diagnostics.push({ code: 'COILS_OVERLAP', severity: 'warning', message: `the load of ${dims.load.force} N would compress it to ${dims.load.length.toFixed(3)} mm, below its solid height ${dims.solidHeight.toFixed(3)} mm` });
  return { brep, report: { generator: 'spring@0', type: 'compression', ends, hand, dimensions: dims, sweep: sw, manufacturingValidated: false, diagnostics } };
}

// ---- extension and torsion springs (R12c.1b, D154) ---------------------------------------------------------------------
//
// The body is the helical sweep above, close-wound: at the solid pitch of a wire d + 2·tol thick, so its turns stand
// 2·tol apart and the fitted surfaces (each within tol of its pipe) never meet. The ends are exact pieces of pipe:
// straight runs (the circle translated: degree 2 × 1) and bends (the circle turned about the bend's axis: the rational
// torus, degree 2 × 2, a span per ≤ 90°), each starting on the frame where the last one ended — the section frame is
// carried by the turn itself, so the level circles match exactly — and glued to its neighbour at their shared disc.
// - Extension, `machine-loop` (default): a bend of radius r_b (default d) from the coil's tangent up the axis, then a
//   loop centred on the axis in the plane through it, `loopAngle` (default 180°) — the end bent up over the body.
// - Extension, `crossover`: a quarter bend toward the axis, a straight run to the axis, a loop of radius ρ (default D/2)
//   standing on it in the plane of the run and the axis, centred above that point, `loopAngle` (default 270°).
// - Torsion: straight legs along the coil's tangent at each end (`legLengths`, default D each).
// The bottom end mirrors the top (built outward from the coil's start along −T). Any two pieces that are not
// neighbours must keep their centrelines d apart (sampled): otherwise LEG_OVERLAP.

/** A pipe's section frame: its centre, e1 and e2 (the section's x and y); the tangent is e1 × e2. */
interface Frame { readonly o: Point; readonly e1: Point; readonly e2: Point }
const vUnit = (a: Point): Point => vScl(a, 1 / Math.hypot(a[0], a[1], a[2]));
const tangentOf = (f: Frame): Point => vCross(f.e1, f.e2);
/** v turned by angle t about the unit axis k (Rodrigues). */
function rotate(v: Point, k: Point, t: number): Point {
  const c = Math.cos(t), s = Math.sin(t), kv = vDot(k, v), kx = vCross(k, v);
  return [v[0] * c + kx[0] * s + k[0] * kv * (1 - c), v[1] * c + kx[1] * s + k[1] * kv * (1 - c), v[2] * c + kx[2] * s + k[2] * kv * (1 - c)];
}
/** The helix's section frame at φ (as sectionPoint). */
function helixFrame(P: Prepared, phi: number): Frame {
  const zz = zAt(runAt(P.runs, phi), phi), b = [0, 0, 0, 0, 0, 0];
  sectionPoint(P.R, phi, zz, 0, 0, b); const o: Point = [b[0], b[1], b[2]];
  sectionPoint(P.R, phi, zz, 1, 0, b); const e1 = vSub([b[0], b[1], b[2]], o);
  sectionPoint(P.R, phi, zz, 0, 1, b); const e2 = vSub([b[0], b[1], b[2]], o);
  return { o, e1, e2 };
}
/** A piece of pipe after a frame: a straight run, or a bend of `radius` through `angle` toward the unit `toward` (⟂ the tangent). */
type PipePiece = { readonly kind: 'line'; readonly length: number } | { readonly kind: 'arc'; readonly radius: number; readonly angle: number; readonly toward: Point };
/** The frame at the end of a piece, and its centreline point at s ∈ [0, 1]. */
function pieceEnd(f: Frame, p: PipePiece): Frame {
  const t = tangentOf(f);
  if (p.kind === 'line') return { o: vAdd(f.o, vScl(t, p.length)), e1: f.e1, e2: f.e2 };
  const O = vAdd(f.o, vScl(p.toward, p.radius)), k = vCross(t, p.toward);
  return { o: vAdd(O, rotate(vSub(f.o, O), k, p.angle)), e1: rotate(f.e1, k, p.angle), e2: rotate(f.e2, k, p.angle) };
}
function piecePoint(f: Frame, p: PipePiece, s: number): Point {
  const t = tangentOf(f);
  if (p.kind === 'line') return vAdd(f.o, vScl(t, p.length * s));
  const O = vAdd(f.o, vScl(p.toward, p.radius)), k = vCross(t, p.toward);
  return vAdd(O, rotate(vSub(f.o, O), k, p.angle * s));
}
const pieceLength = (p: PipePiece): number => p.kind === 'line' ? p.length : p.radius * p.angle;

/** One piece of pipe as a closed B-rep from frame f: faces `<name>.<tag>#k` from `first`, its discs `<id>.cap0/1` or named. */
function pipeBrep(id: string, name: string, tag: string, f: Frame, piece: PipePiece, a: number, first: number, discs: readonly [string | null, string | null]): Brep {
  const poles = sectionPoles(a), spans = piece.kind === 'line' ? 1 : Math.max(1, Math.ceil(piece.angle / (Math.PI / 2) - 1e-9));
  const t = tangentOf(f), O = piece.kind === 'arc' ? vAdd(f.o, vScl(piece.toward, piece.radius)) : f.o, k = piece.kind === 'arc' ? vCross(t, piece.toward) : t;
  const at = (fr: Frame, [x, y]: [number, number]): Point => vAdd(fr.o, vAdd(vScl(fr.e1, x), vScl(fr.e2, y)));
  const frames: Frame[] = [f];
  for (let j = 1; j <= spans; j++) frames.push(piece.kind === 'line' ? pieceEnd(f, piece) : pieceEnd(f, { ...piece, angle: piece.angle * j / spans }));
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: BrepFaceInput[] = [];
  frames.forEach((fr, j) => {
    const q = poles.map(p => at(fr, p));
    for (let i = 0; i < 4; i++) vertices.push({ id: `${id}_v${i}_${j}`, point: q[2 * i] });
    for (let i = 0; i < 4; i++) edges.push({ id: `${id}_a${i}_${j}`, curve: { kind: 'curve', id: `${id}_a${i}_${j}c`, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [q[2 * i], q[2 * i + 1], q[(2 * i + 2) % 8]], weights: [1, W, 1] }, vertices: [`${id}_v${i}_${j}`, `${id}_v${(i + 1) % 4}_${j}`] });
  });
  for (let j = 0; j < spans; j++) {
    // Each section pole's path over the span: a segment, or its circle about the bend's axis (rational, weight cos(Δ/2)).
    const D = piece.kind === 'arc' ? piece.angle / spans : 0, wm = Math.cos(D / 2);
    const paths = poles.map(p => {
      const p0 = at(frames[j], p), p2 = at(frames[j + 1], p);
      if (piece.kind === 'line') return { cp: [p0, p2], w: [1, 1] };
      const M = vAdd(O, vScl(k, vDot(vSub(p0, O), k))), mid = vAdd(O, rotate(vSub(p0, O), k, D / 2));
      return { cp: [p0, vAdd(M, vScl(vSub(mid, M), 1 / wm)), p2], w: [1, wm, 1] };
    });
    const degV = piece.kind === 'line' ? 1 : 2, knotsV = degV === 1 ? [0, 0, 1, 1] : [0, 0, 0, 1, 1, 1];
    for (let i = 0; i < 4; i++) edges.push({ id: `${id}_s${i}_${j}`, curve: { kind: 'curve', id: `${id}_s${i}_${j}c`, degree: degV, knots: knotsV, controlPoints: paths[2 * i].cp, weights: paths[2 * i].w }, vertices: [`${id}_v${i}_${j}`, `${id}_v${i}_${j + 1}`] });
    for (let i = 0; i < 4; i++) {
      const rows = [paths[2 * i], paths[2 * i + 1], paths[(2 * i + 2) % 8]], wu = [1, W, 1];
      faces.push({ id: `${id}_f${i}_${j}`, name: `${name}.${tag}#${first + 4 * j + i}`, sense: 'forward',
        surface: { kind: 'surface', id: `${id}_f${i}_${j}s`, degreeU: 2, degreeV: degV, knotsU: [0, 0, 0, 1, 1, 1], knotsV, controlPoints: rows.map(r => r.cp), weights: rows.map((r, u) => r.w.map(w => w * wu[u])) },
        loops: [{ kind: 'outer', uses: [{ edge: `${id}_a${i}_${j}`, sense: 'forward' }, { edge: `${id}_s${(i + 1) % 4}_${j}`, sense: 'forward' }, { edge: `${id}_a${i}_${j + 1}`, sense: 'reversed' }, { edge: `${id}_s${i}_${j}`, sense: 'reversed' }] }] });
    }
  }
  const disc = (fr: Frame, start: boolean, dtag: string): Surface => {
    const q = 2 * a, P = (x: number, y: number) => at(fr, [x, y]);
    return { kind: 'surface', id: `${id}_${dtag}s`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: start ? [[P(-q, -q), P(q, -q)], [P(-q, q), P(q, q)]] : [[P(-q, -q), P(-q, q)], [P(q, -q), P(q, q)]], weights: [[1, 1], [1, 1]] };
  };
  faces.push({ id: `${id}_end0`, name: discs[0] ?? `${id}.cap0`, sense: 'forward', surface: disc(f, true, 'end0'), loops: [{ kind: 'outer', uses: [3, 2, 1, 0].map(i => ({ edge: `${id}_a${i}_0`, sense: 'reversed' as const })) }] });
  faces.push({ id: `${id}_end1`, name: discs[1] ?? `${id}.cap1`, sense: 'forward', surface: disc(frames[spans], false, 'end1'), loops: [{ kind: 'outer', uses: [0, 1, 2, 3].map(i => ({ edge: `${id}_a${i}_${spans}`, sense: 'forward' as const })) }] });
  return buildBrep({ source: { family: 'spring', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
}

/** The pieces of an end, outward from frame f (`up`: the axis direction away from the body). */
function endPieces(f: Frame, up: Point, kind: 'machine-loop' | 'crossover' | 'leg', o: { readonly bend: number; readonly loopRadius?: number; readonly loopAngle: number; readonly leg: number }): PipePiece[] {
  const t = tangentOf(f);
  if (kind === 'leg') return [{ kind: 'line', length: o.leg }];
  if (kind === 'machine-loop') {
    const n = vUnit(vSub(up, vScl(t, vDot(up, t)))), bend: PipePiece = { kind: 'arc', radius: o.bend, angle: Math.acos(Math.max(-1, Math.min(1, vDot(t, up)))), toward: n };
    const p1 = pieceEnd(f, bend).o, h: Point = vSub(p1, vScl(up, vDot(p1, up))), rho = Math.hypot(h[0], h[1], h[2]);
    return [bend, { kind: 'arc', radius: rho, angle: o.loopAngle, toward: vScl(h, -1 / rho) }];
  }
  // Crossover: a quarter bend toward the axis, straight to it, then the loop standing there.
  const radial: Point = vSub(f.o, vScl(up, vDot(f.o, up))), inward = vUnit(vSub(vScl(radial, -1), vScl(t, vDot(vScl(radial, -1), t))));
  const bend: PipePiece = { kind: 'arc', radius: o.bend, angle: Math.PI / 2, toward: inward }, f1 = pieceEnd(f, bend);
  const along = tangentOf(f1), p1h = vSub(f1.o, vScl(up, vDot(f1.o, up))), run = -vDot(p1h, along);
  if (!(run > 0)) fail('LEG_OVERLAP', `the crossover's bend of radius ${o.bend} mm passes the axis`);
  return [bend, { kind: 'line', length: run }, { kind: 'arc', radius: o.loopRadius!, angle: o.loopAngle, toward: up }];
}

/** Version 0 of an extension or a torsion spring's own inputs (beside SpringSpec's wire, diameter and coils). */
export interface HookedSpringSpec extends SpringSpec {
  /** Extension: the hooks at both ends (default machine-loop). */
  readonly hooks?: 'machine-loop' | 'crossover';
  /** The bends' centreline radius (default d), the crossover's loop radius (default D/2), the loops' angle (degrees; 180 machine loop, 270 crossover). */
  readonly bendRadius?: number; readonly loopRadius?: number; readonly loopAngle?: number;
  /** Extension: the initial tension, the user's figure (no data behind it), taken off the load before the rate. */
  readonly initialTension?: number;
  /** Torsion: the legs' lengths along the coil's tangent at its start and end (default D each). */
  readonly legLengths?: readonly [number, number];
  /** Torsion: Young's modulus E for the rate (an input; `youngsModulusEstimate` flags an estimate), a working moment (N·mm). */
  readonly youngsModulus?: number; readonly youngsModulusEstimate?: boolean; readonly moment?: number;
}
export interface HookedSpringDimensions {
  readonly wireDiameter: number; readonly meanDiameter: number; readonly outerDiameter: number; readonly innerDiameter: number;
  readonly springIndex: number; readonly activeCoils: number; readonly pitch: number; readonly helixAngle: number;
  /** The coil's height (its centreline's rise plus the wire), and the wire's whole centreline length. */
  readonly bodyLength: number; readonly wireLength: number;
  /** Extension: the length inside the hooks (the loops' inner extremes along the axis). */
  readonly lengthInsideHooks?: number;
  /** Extension: k = Gd⁴/(8D³n), the initial tension as given, at a load: the extension (F − F_i)/k, τ = K_W 8FD/(πd³). */
  readonly rate?: number; readonly shearModulus?: number; readonly shearModulusEstimate?: boolean; readonly wahlFactor?: number; readonly initialTension?: number;
  readonly load?: { readonly force: number; readonly extension?: number; readonly shearStress: number };
  /** Torsion: k = Ed⁴/(64Dn) per radian and per degree, the free angle between the legs, at a moment: the turn and σ = K_b 32M/(πd³). */
  readonly torsionalRateNmmPerRad?: number; readonly torsionalRate?: number; readonly youngsModulus?: number; readonly youngsModulusEstimate?: boolean;
  readonly legAngle?: number; readonly legLengths?: readonly [number, number]; readonly bendingFactor?: number;
  readonly moment?: { readonly moment: number; readonly turn?: number; readonly bendingStress: number };
  /** The least distance found between the centrelines of pieces that are not neighbours (sampled), against d. */
  readonly leastClearance: number;
}
export interface HookedSpringReport {
  readonly generator: 'spring@0'; readonly type: 'extension' | 'torsion'; readonly hooks?: 'machine-loop' | 'crossover'; readonly hand: 'right' | 'left';
  readonly dimensions: HookedSpringDimensions;
  readonly sweep: Omit<HelicalSweepResult, 'brep' | 'endZ' | 'wireLength'>;
  readonly manufacturingValidated: false;
  readonly diagnostics: readonly SpringDiagnostic[];
}

/** An extension or a torsion spring (spring@0) in its own frame: the coil's axis +Z, from z 0 (its lowest point), its wire starting on +X. */
export function hookedSpring(spec: HookedSpringSpec, options: { readonly id?: string } = {}): { readonly brep: Brep; readonly report: HookedSpringReport } {
  const id = (options.id ?? 'spring').replace(/[^A-Za-z0-9_.-]/g, '_'), type = spec.type;
  if (type !== 'extension' && type !== 'torsion') return fail('INVALID_INPUT', 'hookedSpring builds extension and torsion springs');
  if (spec.body !== undefined && spec.body !== 'cylindrical') fail('UNSUPPORTED_SPRING_KIND', `a ${String(spec.body)} body is not supported (cylindrical only)`);
  if (spec.wire !== undefined && spec.wire !== 'round') fail('UNSUPPORTED_SPRING_KIND', `${String(spec.wire)} wire is not supported (round only)`);
  if (spec.ends !== undefined || spec.endCoils !== undefined || spec.transition !== undefined) fail('INVALID_INPUT', `ends, endCoils and transition are a compression spring's (a${type === 'extension' ? 'n extension spring has hooks' : ' torsion spring has legs'})`);
  if (spec.freeLength !== undefined) fail('INVALID_INPUT', `give an ${type} spring's pitch, or leave it close-wound (no free length)`);
  if (type === 'torsion' && (spec.hooks !== undefined || spec.initialTension !== undefined || spec.loopAngle !== undefined || spec.loopRadius !== undefined || spec.shearModulus !== undefined || spec.initialTension !== undefined)) fail('INVALID_INPUT', 'hooks, loops, initial tension, G and a load are an extension spring\'s (a torsion spring takes E and a moment)');
  if (type === 'extension' && (spec.legLengths !== undefined || spec.youngsModulus !== undefined || spec.moment !== undefined)) fail('INVALID_INPUT', 'legs, E and a moment are a torsion spring\'s');
  const d = positive(spec.wireDiameter, 'wireDiameter'), given = [spec.meanDiameter, spec.outerDiameter, spec.innerDiameter].filter(v => v !== undefined).length;
  if (given !== 1) fail('INVALID_INPUT', 'give exactly one of meanDiameter, outerDiameter and innerDiameter');
  const D = spec.meanDiameter !== undefined ? positive(spec.meanDiameter, 'meanDiameter') : spec.outerDiameter !== undefined ? positive(spec.outerDiameter, 'outerDiameter') - d : positive(spec.innerDiameter, 'innerDiameter') + d;
  if (!(D > d)) fail('INVALID_INPUT', `the mean diameter ${D} mm must exceed the wire's ${d} mm (spring index above 1)`);
  const n = positive(spec.activeCoils, 'activeCoils'), hand = spec.hand ?? 'right', R = D / 2, a = d / 2;
  if (hand !== 'right' && hand !== 'left') fail('INVALID_INPUT', `hand must be right or left (got ${String(hand)})`);
  const tol = spec.profileTolerance ?? 2e-4 * a, ps = springSolidPitch(D, d), pc = springSolidPitch(D, d + 2 * tol);
  const p = spec.pitch === undefined ? pc : positive(spec.pitch, 'pitch');
  if (!(p >= ps)) fail('COILS_OVERLAP', `the body's pitch ${p.toFixed(6)} mm is below the geometric solid pitch ${ps.toFixed(6)} mm (D ${D}, d ${d}): neighbouring turns would overlap`);
  const hooks = type === 'extension' ? spec.hooks ?? 'machine-loop' : undefined;
  if (hooks !== undefined && hooks !== 'machine-loop' && hooks !== 'crossover') fail('INVALID_INPUT', `hooks must be machine-loop or crossover (got ${String(hooks)})`);
  const bend = spec.bendRadius === undefined ? d : positive(spec.bendRadius, 'bendRadius');
  if (!(bend > a)) fail('SELF_INTERSECTION', `a bend of centreline radius ${bend} mm folds a wire of radius ${a} mm onto itself`);
  const loopAngle = (spec.loopAngle === undefined ? (hooks === 'crossover' ? 270 : 180) : positive(spec.loopAngle, 'loopAngle')) * Math.PI / 180;
  if (loopAngle > 2 * Math.PI) fail('INVALID_INPUT', 'loopAngle is at most 360');
  const loopRadius = spec.loopRadius === undefined ? R : positive(spec.loopRadius, 'loopRadius');
  if (hooks === 'crossover' && !(loopRadius > a)) fail('SELF_INTERSECTION', `a loop of radius ${loopRadius} mm folds the wire onto itself`);
  const legs = spec.legLengths ?? [D, D];
  if (type === 'torsion' && !(legs.length === 2 && legs.every(x => Number.isFinite(x) && x > 0))) fail('INVALID_INPUT', 'legLengths must be two lengths above 0');
  // The coil: the sweep from z aγ (its start disc's lowest point at 0, before the ends are added).
  const gp = R / Math.hypot(R, p / (2 * Math.PI)), P = prepare({ helixRadius: R, runs: [{ turns: n, pitch: p }], section: { kind: 'circle', radius: a }, startZ: a * gp, profileTolerance: tol });
  const kind = type === 'torsion' ? 'leg' as const : hooks!, opts = { bend, loopRadius, loopAngle, leg: 0 };
  const top = helixFrame(P, P.end), start0 = helixFrame(P, 0), bottom: Frame = { o: start0.o, e1: start0.e2, e2: start0.e1 };
  const upPieces = endPieces(top, [0, 0, 1], kind, { ...opts, leg: legs[1] }), downPieces = endPieces(bottom, [0, 0, -1], kind, { ...opts, leg: legs[0] });
  // Clearance: the centrelines of pieces that are not neighbours stay d apart (the coil against itself: by its pitch).
  const chain: { frame: Frame; piece: PipePiece }[][] = [[], []];
  [[bottom, downPieces], [top, upPieces]].forEach(([f0, list], e) => { let f = f0 as Frame; for (const pc of list as PipePiece[]) { chain[e].push({ frame: f, piece: pc }); f = pieceEnd(f, pc); } });
  // (Points of the centreline at least πa apart along it — half a turn on the tightest bend a tube allows — keep d
  // apart; nearer ones are the tube's own neighbourhood. The coil against itself is its pitch's.)
  const samples: { at: Point; s: number; coil: boolean }[] = [], turnsN = Math.max(16, Math.ceil(64 * n));
  for (let i = 0; i <= turnsN; i++) samples.push({ at: helixFrame(P, P.end * i / turnsN).o, s: P.wireLength * i / turnsN, coil: true });
  chain.forEach((list, e) => { let s0 = 0; list.forEach(c => { const len = pieceLength(c.piece), m = Math.max(16, Math.ceil(len / (d / 4))); for (let i = 0; i <= m; i++) samples.push({ at: piecePoint(c.frame, c.piece, i / m), s: e ? P.wireLength + s0 + len * i / m : -(s0 + len * i / m), coil: false }); s0 += len; }); });
  let least = Infinity;
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
    const A = samples[i], B = samples[j];
    if ((A.coil && B.coil) || Math.abs(A.s - B.s) < Math.PI * a) continue;
    least = Math.min(least, Math.hypot(A.at[0] - B.at[0], A.at[1] - B.at[1], A.at[2] - B.at[2]));
  }
  if (least < d * (1 - 1e-9)) fail('LEG_OVERLAP', `the ${type === 'torsion' ? 'legs' : 'hooks'} come within ${least.toFixed(4)} mm of the wire elsewhere (centrelines; the wire is ${d} mm)`);
  // The B-rep: the coil, each end's pieces glued on in turn at their shared discs.
  const coil = sweepRange(`${id}_c`, id, P, 0, P.end, 1, 0, [true, true]), tag = type === 'torsion' ? 'leg' : 'hook';
  let brep = coil.brep;
  const glue = (b: Brep, extra: Brep): Brep => glueAtSharedFace(b, extra, { family: 'spring', id }) ?? fail('PROFILE_BUDGET_EXCEEDED', 'an end piece did not meet the wire at its disc');
  chain.forEach((list, e) => { let k = 1; list.forEach((c, j) => {
    const last = j === list.length - 1, piece = pipeBrep(`${id}_${e}_${j}`, id, `${tag}${e}`, c.frame, c.piece, a, k, [null, last ? `${id}.end${e}` : null]);
    k += piece.faces.length - 2; brep = glue(brep, piece);
  }); });
  if (hand === 'left') brep = transformBrep(brep, { matrix: [1, 0, 0, 0, -1, 0, 0, 0, 1] });
  // The report.
  const C = D / d, KW = (4 * C - 1) / (4 * C - 4) + 0.615 / C, ends = chain.flat().reduce((s, c) => s + pieceLength(c.piece), 0), wire = P.wireLength + ends;
  let inside: number | undefined;
  if (type === 'extension') {
    // The loops' inner extremes along the axis: the topmost centreline point of the top loop less a, the lowest of the bottom's plus a.
    const ext = (list: typeof chain[0], sgn: number) => { const c = list[list.length - 1]; let m = -Infinity; for (let i = 0; i <= 720; i++) m = Math.max(m, sgn * piecePoint(c.frame, c.piece, i / 720)[2]); return sgn * m; };
    inside = ext(chain[1], 1) - a - (ext(chain[0], -1) + a);
  }
  const G = spec.shearModulus === undefined ? undefined : positive(spec.shearModulus, 'shearModulus'), E = spec.youngsModulus === undefined ? undefined : positive(spec.youngsModulus, 'youngsModulus');
  const Fi = spec.initialTension ?? 0;
  if (!(Number.isFinite(Fi) && Fi >= 0)) fail('INVALID_INPUT', 'initialTension must be a number of N, 0 or more');
  const rate = G === undefined ? undefined : G * d ** 4 / (8 * D ** 3 * n), krad = E === undefined ? undefined : E * d ** 4 / (64 * D * n), Kb = (4 * C * C - C - 1) / (4 * C * (C - 1));
  let load: HookedSpringDimensions['load'], moment: HookedSpringDimensions['moment'];
  if (spec.load !== undefined) { const F = spec.load; if (!(Number.isFinite(F) && F >= 0)) fail('INVALID_INPUT', 'load must be a number of N, 0 or more'); load = { force: F, ...(rate ? { extension: Math.max(0, F - Fi) / rate } : {}), shearStress: KW * 8 * F * D / (Math.PI * d ** 3) }; }
  if (spec.moment !== undefined) { const M = spec.moment; if (!Number.isFinite(M)) fail('INVALID_INPUT', 'moment must be a number of N·mm'); moment = { moment: M, ...(krad ? { turn: M / krad * 180 / Math.PI } : {}), bendingStress: Kb * 32 * Math.abs(M) / (Math.PI * d ** 3) }; }
  const frac = ((n % 1) + 1) % 1;
  const dims: HookedSpringDimensions = {
    wireDiameter: d, meanDiameter: D, outerDiameter: D + d, innerDiameter: D - d, springIndex: C, activeCoils: n, pitch: p, helixAngle: Math.atan(p / (Math.PI * D)) * 180 / Math.PI,
    bodyLength: n * p + 2 * a * gp, wireLength: wire, ...(inside !== undefined ? { lengthInsideHooks: inside } : {}),
    ...(type === 'extension' ? { wahlFactor: KW, initialTension: Fi, ...(rate !== undefined ? { rate: rate, shearModulus: G, ...(spec.shearModulusEstimate ? { shearModulusEstimate: true } : {}) } : {}), ...(load ? { load } : {}) } : {}),
    ...(type === 'torsion' ? { bendingFactor: Kb, legAngle: frac * 360, legLengths: [legs[0], legs[1]] as const, ...(krad !== undefined ? { torsionalRateNmmPerRad: krad, torsionalRate: krad * Math.PI / 180, youngsModulus: E, ...(spec.youngsModulusEstimate ? { youngsModulusEstimate: true } : {}) } : {}), ...(moment ? { moment } : {}) } : {}),
    leastClearance: least,
  };
  return { brep, report: { generator: 'spring@0', type, ...(hooks ? { hooks } : {}), hand, dimensions: dims, sweep: { pieces: coil.pieces, segments: coil.segments, profileDeviation: coil.deviation, profileTolerance: P.tol, minCurvatureRadius: Math.min(P.minRho, bend, ...(hooks === 'crossover' ? [loopRadius] : [])) }, manufacturingValidated: false, diagnostics: [] } };
}
