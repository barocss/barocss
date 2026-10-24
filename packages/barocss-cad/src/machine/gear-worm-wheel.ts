// R12b.6 (D137): the throated (single-enveloping) wheel of a ZA worm — attempted, as the owner asked (D129).
//
// The wheel is what a hob of the worm's own thread cuts as worm and wheel turn together: its crest raised by the
// clearance 0.25 m_x (K1's root diameter, d2 − 2·1.25 m_x), its sides the worm's. In each plane square to the wheel's
// axis (z = c from the mid-plane) the worm's section is a fixed curve that slides along its axis as it turns — a rack, of
// the shape D136's pair check carries along the helices — and the wheel turns with it on its pitch circle r2; so the
// wheel's section there is that rack's envelope, in closed form point by point (the normal through the pitch point):
// the hob's flanks give the wheel's flanks, its crest corners their root trochoids, its crest the root circle. At the
// mid-plane a ZA worm's section is a straight-sided rack and the envelope the involute of r2 cos α_x — the oracle.
// The tip and the root are tori about the wheel's axis (the throat, radius R_t = a − r2 − m_x about the worm's axis;
// the root, the hob crest's R_h = r1 + 1.25 m_x): rational, exact. The flanks and fillets are fitted bicubic Hermite
// patches over (the section's parameter, z), their distance from the exact section measured in each plane (z is exact
// along them); past the budget — never a looser tolerance — the wheel is refused, the measured deviation said.
import { buildBrep, type Brep, type BrepFaceInput } from '../brep/brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
import { gearError, safeId, bezierKnots, arcCurve, pointSegment, type GearDiagnostic } from './gear.js';
import { wormDimensions, wormOutline, wormSection, planeClearance, type WormSpec, type WormDimensions, type PlacedWorm } from './gear-worm.js';

export interface ThroatedWheelSpec {
  /** The worm it is cut for (a ZA worm; its length is not read). */
  readonly worm: WormSpec;
  readonly teeth: number;
  /** Along the wheel's axis, centred on the mid-plane (below 1.6 R_t). */
  readonly faceWidthMM: number;
  readonly boreDiameterMM?: number;
  /** The hob's thread thickened by this much along its axis (the wheel's spaces wider: backlash). */
  readonly toothThicknessReductionMM?: number;
  /** The flanks' and fillets' fit within this of the generated surface, in every plane; 1e-4 m_n by default. */
  readonly profileToleranceMM?: number;
}

export interface ThroatedWheelReport {
  readonly generator: 'worm-wheel@0'; readonly kind: 'throated';
  readonly dimensions: {
    readonly referenceDiameterMM: number; readonly throatDiameterMM: number; readonly rootDiameterMM: number; readonly throatRadiusMM: number; readonly rootTorusRadiusMM: number;
    readonly centerDistanceMM: number; readonly faceWidthMM: number; readonly tipDiameterAtFacesMM: number; readonly rootDiameterAtFacesMM: number;
  };
  /** The fits: bicubic pieces across the profile and along the face, the faces they take, and the largest distance from the generated section found in any plane. */
  readonly flank: { readonly piecesAcross: number; readonly piecesAlong: number; readonly faces: number; readonly deviationMM: number };
  readonly fillet: { readonly piecesAcross: number; readonly piecesAlong: number; readonly faces: number; readonly deviationMM: number };
  readonly profileToleranceMM: number;
  readonly manufacturingValidated: false;
  readonly diagnostics: readonly GearDiagnostic[];
}

/** The hob and the wheel's values for the section generator. */
export interface WheelGeom {
  readonly w: WormDimensions; readonly z2: number; readonly r2: number; readonly a: number; readonly Rt: number; readonly Rh: number; readonly b: number;
  /** The hob's section half-thickness angle at radius ρ (ZA, the wheel's backlash added along the axis). */
  readonly psiH: (rho: number) => number;
  readonly bore: number; readonly step: number;
}

export function throatedWheelGeom(spec: ThroatedWheelSpec): WheelGeom {
  const w = wormDimensions({ ...spec.worm, toothThicknessReductionMM: 0 });
  if (w.form !== 'ZA') throw gearError('UNSUPPORTED_GEAR_KIND', `a throated wheel for a ${w.form} worm: only for ZA worms in this stage (its mid-plane is an involute only then)`);
  const z2 = spec.teeth, b = spec.faceWidthMM;
  if (!(Number.isInteger(z2) && z2 >= 18 && z2 <= 200)) throw gearError('INVALID_INPUT', 'teeth must be a whole number from 18 to 200');
  const r2 = z2 * w.m / 2, a = w.r1 + r2, Rt = a - r2 - w.m, Rh = w.r1 + 1.25 * w.m;
  if (!(Number.isFinite(b) && b > 0 && b / 2 < 0.8 * Rt)) throw gearError('INVALID_INPUT', `faceWidthMM must be above 0 and below 1.6 R_t = ${(1.6 * Rt).toFixed(3)} mm (the throat arc's reach)`);
  const j = spec.toothThicknessReductionMM ?? 0;
  if (!(Number.isFinite(j) && j >= 0 && j < w.sx)) throw gearError('INVALID_INPUT', 'toothThicknessReductionMM must be a number of mm, 0 or more, below the thread\'s thickness');
  const sxH = w.sx + j, psiRefH = sxH / (2 * w.p);
  const psiH = (rho: number) => psiRefH - (rho - w.r1) * Math.tan(w.alphaX) / w.p;
  const bd = spec.boreDiameterMM ?? 0, rootMin = a - Rh;
  if (!(Number.isFinite(bd) && bd >= 0)) throw gearError('INVALID_INPUT', 'boreDiameterMM must be a number of mm, 0 or more');
  if (bd > 0 && !(bd / 2 <= rootMin - w.m)) throw gearError('BORE_INTERSECTION', `a bore of ${bd} mm leaves less than the ${w.m} mm rim below the root (Ø${(2 * rootMin).toFixed(3)} mm): at most Ø${Math.max(0, 2 * (rootMin - w.m)).toFixed(3)}`);
  return { w, z2, r2, a, Rt, Rh, b, psiH, bore: bd / 2, step: 2 * Math.PI / z2 };
}

// ——— The section in the plane z = c (the pair's frame: wheel axis +Z at the origin, the worm's along +X at y = −a; the hob at θ 0) ———

/** The hob's section point at radius ρ on side σ (+1 the flank at φ0 = −ψ, −1 at +ψ) and its derivative in ρ: (x, y, dx, dy). */
function rackPoint(G: WheelGeom, sigma: number, c: number, rho: number, o: number[]): void {
  const w = G.w, s = Math.sqrt(rho * rho - c * c), as = Math.asin(c / rho), k = Math.tan(w.alphaX) / w.p;
  // x = (asin(c/ρ) + σ ψ(ρ)) p / h; dψ/dρ = −k; d asin(c/ρ)/dρ = −c / (ρ s).
  o[0] = (as + sigma * G.psiH(rho)) * w.p / w.h; o[1] = s - G.a;
  o[2] = (-c / (rho * s) - sigma * k) * w.p / w.h; o[3] = rho / s;
}
const R4 = [0, 0, 0, 0];
/** The rack's displacement at which its point (ρ, σ) is in contact: its normal through the pitch point (0, −r2). */
function contactShift(G: WheelGeom, sigma: number, c: number, rho: number): number {
  rackPoint(G, sigma, c, rho, R4);
  // (Normal N = (dy, −dx): (x + d) N_y − (y + r2) N_x = 0.)
  const Nx = R4[3], Ny = -R4[2];
  return (R4[1] + G.r2) * Nx / Ny - R4[0];
}
/** The wheel-frame point generated by the rack point (x, y) at displacement d: Rot(−d / r2)(x + d, y), into o. */
function carried(G: WheelGeom, x: number, y: number, d: number, o: number[]): void {
  const t = -d / G.r2, cs = Math.cos(t), sn = Math.sin(t), X = x + d;
  o[0] = cs * X - sn * y; o[1] = sn * X + cs * y;
}
/** The flank's generated point from the hob's (ρ, σ) at plane c (pair frame, at θ 0), into o. */
export function flankPoint(G: WheelGeom, sigma: number, c: number, rho: number, o: number[]): void {
  const d = contactShift(G, sigma, c, rho);
  rackPoint(G, sigma, c, rho, R4); carried(G, R4[0], R4[1], d, o);
}
/** The hob's crest corner on side σ at plane c: (x, y). */
function corner(G: WheelGeom, sigma: number, c: number, o: number[]): void { rackPoint(G, sigma, c, G.Rh, R4); o[0] = R4[0]; o[1] = R4[1]; }
/** The trochoid of side σ's crest corner at plane c, its parameter t ∈ [0, 1] from the root (d = −x_K) to where it meets the flank (d at the corner's contact), into o. */
export function filletPoint(G: WheelGeom, sigma: number, c: number, t: number, o: number[]): void {
  corner(G, sigma, c, R4); const kx = R4[0], ky = R4[1], dK = contactShift(G, sigma, c, G.Rh);
  carried(G, kx, ky, -kx + (dK + kx) * t, o);
}
/** The radius of side σ's flank point (ρ) at plane c. */
const T2 = [0, 0];
function flankRadius(G: WheelGeom, sigma: number, c: number, rho: number): number { flankPoint(G, sigma, c, rho, T2); return Math.hypot(T2[0], T2[1]); }
/** The wheel's tip and root radii at plane c: the throat torus and the hob crest's. */
export const tipRadius = (G: WheelGeom, c: number) => G.a - Math.sqrt(G.Rt * G.Rt - c * c);
export const rootRadius = (G: WheelGeom, c: number) => G.a - Math.sqrt(G.Rh * G.Rh - c * c);
/** The hob radius ρ whose flank point reaches the wheel's tip at plane c (bisection: the radius falls as ρ grows). */
export function rhoAtTip(G: WheelGeom, sigma: number, c: number): number {
  const rt = tipRadius(G, c);
  let lo = Math.max(Math.abs(c) * 1.000001, G.w.rf * 0.5), hi = G.Rh;
  if (!(flankRadius(G, sigma, c, lo) > rt)) throw gearError('UNSUPPORTED_GEAR_KIND', `throated wheel: at ${c.toFixed(3)} mm from the mid-plane the hob's flank does not reach the wheel's tip`);
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (flankRadius(G, sigma, c, m) > rt) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ——— The fitted faces ———

/**
 * A ring piece: a fitted face (`fillet` or `flank` of side σ, its own run's share s from sA at u 0 to sB at u 1 — sB < sA
 * running it backwards, the same two numbers its neighbours use, so shared edges agree to the last bit) or a torus
 * (`tip`, `root`), turned by `rot` into the wheel's frame.
 */
interface WPiece { readonly name: string; readonly kind: 'fillet' | 'flank' | 'tip' | 'root'; readonly sigma: number; readonly sA: number; readonly sB: number; readonly rot: number }

/**
 * A fitted piece's exact point (the wheel's frame, z = c + b/2) at its own u ∈ [0, 1] and c, into o: the fillet's
 * trochoid t, the flank's hob radius ρ = R_h + (ρ_tip(c) − R_h) s, s the piece's share of its whole run (reversed when `rev`).
 */
function pieceAt(G: WheelGeom, P: WPiece, u: number, c: number, o: number[]): void {
  const s = u <= 0 ? P.sA : u >= 1 ? P.sB : P.sA + (P.sB - P.sA) * u;
  if (P.kind === 'fillet') {
    corner(G, P.sigma, c, R4); const kx = R4[0], ky = R4[1], dK = contactShift(G, P.sigma, c, G.Rh);
    carried(G, kx, ky, s >= 1 ? dK : -kx + (dK + kx) * s, T2);
  } else {
    // (At s 0 the corner itself, computed as the fillet's end computes it: the shared edge the same to the last bit.)
    const rho = s <= 0 ? G.Rh : G.Rh + (rhoAtTip(G, P.sigma, c) - G.Rh) * s, d = contactShift(G, P.sigma, c, rho);
    rackPoint(G, P.sigma, c, rho, R4); carried(G, R4[0], R4[1], d, T2);
  }
  const cs = Math.cos(P.rot), sn = Math.sin(P.rot);
  o[0] = cs * T2[0] - sn * T2[1]; o[1] = sn * T2[0] + cs * T2[1]; o[2] = c + G.b / 2;
}
const PA = [0, 0, 0], PB = [0, 0, 0];
/** ∂/∂u, ∂/∂c and ∂²/∂u∂c of a piece's point by central differences (one-sided at the ends of u), into du, dc, duc. */
function pieceDerivatives(G: WheelGeom, P: WPiece, u: number, c: number, du: number[], dc: number[], duc: number[]): void {
  const hu = 1e-5, hc = 1e-5 * G.w.m, ua = Math.max(0, u - hu), ub = Math.min(1, u + hu), Q1 = [0, 0, 0], Q2 = [0, 0, 0], Q3 = [0, 0, 0], Q4 = [0, 0, 0];
  pieceAt(G, P, ub, c, PB); pieceAt(G, P, ua, c, PA); for (let k = 0; k < 3; k++) du[k] = (PB[k] - PA[k]) / (ub - ua);
  pieceAt(G, P, u, c + hc, PB); pieceAt(G, P, u, c - hc, PA); for (let k = 0; k < 3; k++) dc[k] = (PB[k] - PA[k]) / (2 * hc);
  pieceAt(G, P, ub, c + hc, Q1); pieceAt(G, P, ua, c + hc, Q2); pieceAt(G, P, ub, c - hc, Q3); pieceAt(G, P, ua, c - hc, Q4);
  for (let k = 0; k < 3; k++) duc[k] = (Q1[k] - Q2[k] - Q3[k] + Q4[k]) / ((ub - ua) * 2 * hc);
}
/** A piece's curve along u at c (a cubic Hermite chain, n pieces): the face's level edge. */
function levelCurve(G: WheelGeom, P: WPiece, c: number, n: number): Curve {
  const pts: Point[] = [], f = [0, 0, 0], g = [0, 0, 0], du = [0, 0, 0], dc = [0, 0, 0], duc = [0, 0, 0], du2 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const ua = i / n, ub = (i + 1) / n, h = (ub - ua) / 3;
    pieceAt(G, P, ua, c, f); pieceDerivatives(G, P, ua, c, du, dc, duc); pieceAt(G, P, ub, c, g); pieceDerivatives(G, P, ub, c, du2, dc, duc);
    if (i === 0) pts.push([f[0], f[1], f[2]]);
    pts.push([f[0] + h * du[0], f[1] + h * du[1], f[2]], [g[0] - h * du2[0], g[1] - h * du2[1], g[2]], [g[0], g[1], g[2]]);
  }
  return { kind: 'curve', id: 'l', degree: 3, knots: bezierKnots(n), controlPoints: pts, weights: pts.map(() => 1) };
}
/** A piece's curve along c at its u (a cubic Hermite chain over c0 … c1, n pieces): the edge between it and its neighbour. */
function sideCurve(G: WheelGeom, P: WPiece, u: number, c0: number, c1: number, n: number): Curve {
  const pts: Point[] = [], f = [0, 0, 0], g = [0, 0, 0], du = [0, 0, 0], dc = [0, 0, 0], dc2 = [0, 0, 0], duc = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const ca = c0 + (c1 - c0) * i / n, cb = c0 + (c1 - c0) * (i + 1) / n, h = (cb - ca) / 3;
    pieceAt(G, P, u, ca, f); pieceDerivatives(G, P, u, ca, du, dc, duc); pieceAt(G, P, u, cb, g); pieceDerivatives(G, P, u, cb, du, dc2, duc);
    if (i === 0) pts.push([f[0], f[1], f[2]]);
    pts.push([f[0] + h * dc[0], f[1] + h * dc[1], f[2] + h * dc[2]], [g[0] - h * dc2[0], g[1] - h * dc2[1], g[2] - h * dc2[2]], [g[0], g[1], g[2]]);
  }
  return { kind: 'curve', id: 's', degree: 3, knots: bezierKnots(n), controlPoints: pts, weights: pts.map(() => 1) };
}
/** A fitted piece's surface over c0 … c1: bicubic Hermite patches (nu × nv) from the point and its derivatives at the grid's nodes. */
function pieceSurface(G: WheelGeom, P: WPiece, c0: number, c1: number, nu: number, nv: number, sid: string): Surface {
  const F: number[][][] = [], Du: number[][][] = [], Dc: number[][][] = [], Duc: number[][][] = [];
  for (let i = 0; i <= nu; i++) {
    F.push([]); Du.push([]); Dc.push([]); Duc.push([]);
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, c = c0 + (c1 - c0) * j / nv, f = [0, 0, 0], du = [0, 0, 0], dc = [0, 0, 0], duc = [0, 0, 0];
      pieceAt(G, P, u, c, f); pieceDerivatives(G, P, u, c, du, dc, duc); F[i].push(f); Du[i].push(du); Dc[i].push(dc); Duc[i].push(duc);
    }
  }
  const hu = 1 / nu / 3, hv = (c1 - c0) / nv / 3, cp: Point[][] = [];
  for (let I = 0; I <= 3 * nu; I++) {
    const row: Point[] = [], i = Math.floor(I / 3), ri = I % 3;
    for (let J = 0; J <= 3 * nv; J++) {
      const j = Math.floor(J / 3), rj = J % 3;
      // (Node (i, j) and its neighbours' Bézier offsets: +h f_u after a node, −h f_u before the next.)
      const ni = ri === 2 ? i + 1 : i, nj = rj === 2 ? j + 1 : j, su = ri === 0 ? 0 : ri === 1 ? 1 : -1, sv = rj === 0 ? 0 : rj === 1 ? 1 : -1;
      const f = F[ni][nj], du = Du[ni][nj], dc = Dc[ni][nj], duc = Duc[ni][nj], p: Point = [0, 0, 0];
      for (let k = 0; k < 3; k++) p[k] = f[k] + su * hu * du[k] + sv * hv * dc[k] + su * sv * hu * hv * duc[k];
      row.push(p);
    }
    cp.push(row);
  }
  return { kind: 'surface', id: sid, degreeU: 3, degreeV: 3, knotsU: bezierKnots(nu), knotsV: bezierKnots(nv), controlPoints: cp, weights: cp.map(r => r.map(() => 1)) };
}

/** The piece's exact section at c as a dense polyline (its own run, 400 points), x y pairs (the wheel's frame). */
function exactSection(G: WheelGeom, P: WPiece, c: number): Float64Array {
  const o = [0, 0, 0], out = new Float64Array(2 * 401);
  for (let i = 0; i <= 400; i++) { pieceAt(G, P, i / 400, c, o); out[2 * i] = o[0]; out[2 * i + 1] = o[1]; }
  return out;
}
/** The fitted surface's largest distance from the exact section in the plane of each sample (z exact along it). */
function surfaceDeviation(G: WheelGeom, P: WPiece, S: Surface, c0: number, c1: number, nu: number, nv: number): number {
  let worst = 0;
  for (let j = 0; j <= 4 * nv; j++) {
    const v = j / (4 * nv), c = c0 + (c1 - c0) * v, X = exactSection(G, P, c);
    for (let i = 0; i <= 8 * nu; i++) {
      const q = evalBezierSurface(S, i / (8 * nu), v, nu, nv);
      let d = Infinity; for (let k = 0; k + 3 < X.length; k += 2) d = Math.min(d, pointSegment(q[0], q[1], X[k], X[k + 1], X[k + 2], X[k + 3]));
      worst = Math.max(worst, d);
    }
  }
  return worst;
}
/** A bicubic Bézier-chain surface (non-rational) at (u, v) ∈ [0, 1]². */
function evalBezierSurface(S: Surface, u: number, v: number, nu: number, nv: number): Point {
  const iu = Math.min(nu - 1, Math.floor(u * nu)), iv = Math.min(nv - 1, Math.floor(v * nv)), s = u * nu - iu, t = v * nv - iv;
  const bs = [(1 - s) ** 3, 3 * (1 - s) ** 2 * s, 3 * (1 - s) * s * s, s ** 3], bt = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3], p: Point = [0, 0, 0];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const q = S.controlPoints[3 * iu + a][3 * iv + b], w = bs[a] * bt[b]; p[0] += w * q[0]; p[1] += w * q[1]; p[2] += w * q[2]; }
  return p;
}

// ——— The tori ———

/**
 * A torus patch about the wheel's axis: the meridian arc of radius R about (a, b/2) in the (r, z) half-plane — r = a −
 * R cos τ, z = b/2 + R sin τ — over the plane levels z0 … z1, revolved over the azimuths α0 … α0 + sweep. Rational
 * biquadratic: the circle's arcs (u) by the meridian's (v).
 */
function torusSurface(G: WheelGeom, R: number, z0: number, z1: number, a0: number, sweep: number, sid: string): Surface {
  const t0 = Math.asin((z0 - G.b / 2) / R), t1 = Math.asin((z1 - G.b / 2) / R), h = (t1 - t0) / 2, wm = Math.cos(h), tm = (t0 + t1) / 2;
  const mer: [number, number, number][] = [[G.a - R * Math.cos(t0), G.b / 2 + R * Math.sin(t0), 1], [G.a - R / wm * Math.cos(tm), G.b / 2 + R / wm * Math.sin(tm), wm], [G.a - R * Math.cos(t1), G.b / 2 + R * Math.sin(t1), 1]];
  const arc = arcCurve('c', 1, a0, sweep), cp: Point[][] = [], wt: number[][] = [];
  arc.controlPoints.forEach((q, i) => { cp.push(mer.map(m => [m[0] * q[0], m[0] * q[1], m[1]])); wt.push(mer.map(m => m[2] * arc.weights[i])); });
  return { kind: 'surface', id: sid, degreeU: 2, degreeV: 2, knotsU: [...arc.knots], knotsV: [0, 0, 0, 1, 1, 1], controlPoints: cp, weights: wt };
}
/** A circular arc about the wheel's axis at height z from the point p to the point q (counter-clockwise), radius taken from p. */
function arcBetween(p: readonly number[], q: readonly number[], z: number): Curve {
  const r = Math.hypot(p[0], p[1]), a0 = Math.atan2(p[1], p[0]); let sw = Math.atan2(q[1], q[0]) - a0; while (sw <= 0) sw += 2 * Math.PI;
  const c = arcCurve('a', r, a0, sw);
  return { ...c, controlPoints: c.controlPoints.map(x => [x[0], x[1], z]) };
}

const turnPt = (p: Point, c: number, s: number): Point => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
const turnCurve = (k: Curve, a: number, id: string): Curve => { const c = Math.cos(a), s = Math.sin(a); return { ...k, id, controlPoints: k.controlPoints.map(p => turnPt(p, c, s)) }; };
const turnSurface = (S: Surface, a: number, id: string): Surface => { const c = Math.cos(a), s = Math.sin(a); return { ...S, id, controlPoints: S.controlPoints.map(r => r.map(p => turnPt(p, c, s))) }; };
const MAX_ACROSS = 15, MAX_ALONG = 20, PER = 5;

/** The fit of one kind (fillet or flank, its whole run): pieces across (from its level curves) and along (from its side curves), then the whole surface checked. */
function fitKind(G: WheelGeom, kind: 'fillet' | 'flank', sigma: number, tol: number): { nu: number; nv: number; dev: number } {
  const P: WPiece = { name: '', kind, sigma, sA: 0, sB: 1, rot: 0 }, cs = [-G.b / 2, -G.b / 4, 0, G.b / 4, G.b / 2];
  // Across: the level curves' distance from the exact section, in their planes.
  let nu = 1;
  for (; nu <= MAX_ACROSS; nu++) {
    let d = 0;
    for (const c of cs) {
      const L = levelCurve(G, P, c, nu), X = exactSection(G, P, c);
      for (let i = 0; i < nu; i++) for (let k = 0; k <= 16; k++) {
        const t = k / 16, u = 1 - t, A = L.controlPoints.slice(3 * i, 3 * i + 4), x = u * u * u * A[0][0] + 3 * u * u * t * A[1][0] + 3 * u * t * t * A[2][0] + t * t * t * A[3][0], y = u * u * u * A[0][1] + 3 * u * u * t * A[1][1] + 3 * u * t * t * A[2][1] + t * t * t * A[3][1];
        let e = Infinity; for (let q = 0; q + 3 < X.length; q += 2) e = Math.min(e, pointSegment(x, y, X[q], X[q + 1], X[q + 2], X[q + 3]));
        d = Math.max(d, e);
      }
    }
    if (d <= tol / 2) break;
  }
  // Along: the side curves' distance from the exact point at the same u (a bound on the distance in the plane).
  let nv = 1;
  for (; nv <= MAX_ALONG; nv++) {
    let d = 0; const o = [0, 0, 0];
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const C = sideCurve(G, P, u, -G.b / 2, G.b / 2, nv);
      for (let i = 0; i < nv; i++) for (let k = 0; k <= 16; k++) {
        const t = k / 16, w = 1 - t, A = C.controlPoints.slice(3 * i, 3 * i + 4), q = [0, 1, 2].map(m => w * w * w * A[0][m] + 3 * w * w * t * A[1][m] + 3 * w * t * t * A[2][m] + t * t * t * A[3][m]);
        pieceAt(G, P, u, q[2] - G.b / 2, o); d = Math.max(d, Math.hypot(q[0] - o[0], q[1] - o[1]));
      }
    }
    if (d <= tol / 2) break;
  }
  // (Past the budget: the surface at the budget, measured — what the refusal says.)
  nu = Math.min(nu, MAX_ACROSS); nv = Math.min(nv, MAX_ALONG);
  return { nu, nv, dev: surfaceDeviation(G, P, pieceSurface(G, P, -G.b / 2, G.b / 2, nu, nv, 'x'), -G.b / 2, G.b / 2, nu, nv) };
}

/**
 * The throated wheel (R12b.6, D137) as a solid in its own frame: the axis +Z, the faces at z 0 and b (its mid-plane at
 * b/2), tooth 1 centred on +X in the mid-plane. Faces `<id>.filletL#k`, `.flankL#k` (more pieces across on `.flankL2#k`
 * …), `.tip#k` (the throat torus), `.flankR#k`, `.filletR#k`, `.root#k` (the root torus, the space after tooth k),
 * `.face0`, `.face1`, `.bore#1/2`; along the axis in segments `.2` ….
 */
export function throatedWormWheel(spec: ThroatedWheelSpec, options: { readonly id?: string } = {}): { brep: Brep; report: ThroatedWheelReport } {
  const id = safeId(options.id ?? 'wheel'), G = throatedWheelGeom(spec), tol = spec.profileToleranceMM ?? 1e-4 * G.w.mn;
  if (!(Number.isFinite(tol) && tol > 0)) throw gearError('INVALID_INPUT', 'profileToleranceMM must be a number of mm above 0');
  // Which side of the hob's thread cuts a space's upper (counter-clockwise) side: its corner's point at the greater angle.
  const o = [0, 0, 0]; flankPoint(G, 1, 0, G.Rh, o); const a1 = Math.atan2(o[1], o[0]); flankPoint(G, -1, 0, G.Rh, o); const a2 = Math.atan2(o[1], o[0]);
  const up = a1 > a2 ? 1 : -1, lo = -up;
  // The flank must climb from the corner to the tip (no undercut): its radius falls as ρ grows.
  for (const c of [-G.b / 2, 0, G.b / 2]) for (const s of [up, lo]) {
    const rt = rhoAtTip(G, s, c); let prev = Infinity;
    for (let i = 0; i <= 64; i++) { const r = flankRadius(G, s, c, rt + (G.Rh - rt) * i / 64); if (!(r < prev + 1e-12)) throw gearError('UNSUPPORTED_GEAR_KIND', `throated wheel: the generated flank turns back (undercut) ${c.toFixed(3)} mm from the mid-plane — more teeth`); prev = r; }
  }
  const fl = fitKind(G, 'flank', up, tol), fi = fitKind(G, 'fillet', up, tol);
  // Past the budget, or the surfaces' measured distance past the tolerance: refused, with what was measured (the owner's word, D129).
  for (const [what, f] of [['flank', fl], ['root fillet', fi]] as const)
    if (!(f.dev <= tol)) throw gearError('UNSUPPORTED_GEAR_KIND', `throated wheel: its generated ${what} fits within ${f.dev.toExponential(2)} mm at the budget (${f.nu} × ${f.nv} bicubic pieces; at most ${MAX_ACROSS} across and ${MAX_ALONG} along), not ${tol.toExponential(2)} mm — the cylindrical wheel stays`);
  // (One set of levels along the axis for the whole ring, and one count of pieces along it for fillets and flanks alike:
  // the edge they share is one curve.)
  const nvAll = Math.max(fl.nv, fi.nv), S = Math.ceil(nvAll / PER), nvs = Math.ceil(nvAll / S), Ff = Math.ceil(fl.nu / PER), Fi = Math.ceil(fi.nu / PER), nuf = Math.ceil(fl.nu / Ff), nui = Math.ceil(fi.nu / Fi), nvf = nvs, nvi = nvs;
  // Tooth 1's pieces, counter-clockwise; the other teeth turned copies.
  const wL = Math.PI / 2 + Math.PI / G.z2 - G.step, wR = Math.PI / 2 + Math.PI / G.z2;
  const T: { P: WPiece; nu: number; nv: number }[] = [];
  for (let f = 0; f < Fi; f++) T.push({ P: { name: `filletL${f ? f + 1 : ''}`, kind: 'fillet', sigma: up, sA: f / Fi, sB: (f + 1) / Fi, rot: wL }, nu: nui, nv: nvi });
  for (let f = 0; f < Ff; f++) T.push({ P: { name: `flankL${f ? f + 1 : ''}`, kind: 'flank', sigma: up, sA: f / Ff, sB: (f + 1) / Ff, rot: wL }, nu: nuf, nv: nvf });
  T.push({ P: { name: 'tip', kind: 'tip', sigma: 0, sA: 0, sB: 1, rot: 0 }, nu: 0, nv: 0 });
  // (The far side runs backwards: from the tip down the flank, then the fillet down to the root.)
  for (let f = Ff - 1; f >= 0; f--) T.push({ P: { name: `flankR${f ? f + 1 : ''}`, kind: 'flank', sigma: lo, sA: (f + 1) / Ff, sB: f / Ff, rot: wR }, nu: nuf, nv: nvf });
  for (let f = Fi - 1; f >= 0; f--) T.push({ P: { name: `filletR${f ? f + 1 : ''}`, kind: 'fillet', sigma: lo, sA: (f + 1) / Fi, sB: f / Fi, rot: wR }, nu: nui, nv: nvi });
  T.push({ P: { name: 'root', kind: 'root', sigma: 0, sA: 0, sB: 1, rot: 0 }, nu: 0, nv: 0 });
  const m = T.length, cj = (j: number) => -G.b / 2 + G.b * j / S, fitted = (k: number) => T[k].P.kind === 'fillet' || T[k].P.kind === 'flank';
  // Per template piece: its start point at each level, its level curves (fitted), its start side curves per segment, its surfaces.
  const start: Point[][] = [], level: (Curve | null)[][] = [], side: Curve[][] = [], surf: (Surface | null)[][] = [];
  for (let k = 0; k < m; k++) {
    const P = T[k].P, fk = fitted(k), src = fk ? k : k - 1, Ps = T[src].P, us = fk ? 0 : 1, st: Point[] = [], lv: (Curve | null)[] = [], sd: Curve[] = [], sf: (Surface | null)[] = [];
    for (let j = 0; j <= S; j++) { pieceAt(G, Ps, us, cj(j), o); st.push([o[0], o[1], o[2]]); lv.push(fk ? levelCurve(G, P, cj(j), T[k].nu) : null); }
    for (let j = 0; j < S; j++) {
      sd.push(sideCurve(G, Ps, us, cj(j), cj(j + 1), T[src].nv));
      sf.push(fk ? pieceSurface(G, P, cj(j), cj(j + 1), T[k].nu, T[k].nv, 's') : null);
    }
    start.push(st); level.push(lv); side.push(sd); surf.push(sf);
  }
  // The faces as built, measured in their planes (both sides of tooth 1; the other teeth are turned copies).
  let devFlank = 0, devFillet = 0;
  for (let k = 0; k < m; k++) if (fitted(k)) for (let j = 0; j < S; j++) {
    const d = surfaceDeviation(G, T[k].P, surf[k][j]!, cj(j), cj(j + 1), T[k].nu, T[k].nv);
    if (T[k].P.kind === 'flank') devFlank = Math.max(devFlank, d); else devFillet = Math.max(devFillet, d);
  }
  for (const [what, d] of [['flank', devFlank], ['root fillet', devFillet]] as const)
    if (!(d <= tol)) throw gearError('UNSUPPORTED_GEAR_KIND', `throated wheel: its generated ${what}'s faces as built come within ${d.toExponential(2)} mm, not ${tol.toExponential(2)} mm — the cylindrical wheel stays`);
  // The ring: z2 teeth of m pieces.
  const n = G.z2 * m, vertices: { id: string; point: Point; toleranceMM?: number }[] = [], edges: { id: string; curve: Curve; vertices: [string, string]; toleranceMM?: number }[] = [], faces: BrepFaceInput[] = [];
  const V = (i: number, j: number) => `${id}_v${i}_${j}`, EL = (i: number, j: number) => `${id}_l${i}_${j}`, ES = (i: number, j: number) => `${id}_s${i}_${j}`;
  const toothOf = (i: number) => Math.floor(i / m), tk = (i: number) => i % m, rotOf = (i: number) => G.step * toothOf(i);
  const ptOf = (i: number, j: number) => { const p = start[tk(i)][j], a = rotOf(i); return turnPt(p, Math.cos(a), Math.sin(a)); };
  const tolEdge = 2 * Math.max(devFlank, devFillet) + 1e-9;
  for (let i = 0; i < n; i++) for (let j = 0; j <= S; j++) vertices.push({ id: V(i, j), point: ptOf(i, j) });
  for (let i = 0; i < n; i++) {
    const k = tk(i), a = rotOf(i), nx = (i + 1) % n;
    for (let j = 0; j <= S; j++) {
      const z = cj(j) + G.b / 2, curve = fitted(k) ? turnCurve(level[k][j]!, a, `${EL(i, j)}c`) : { ...arcBetween(ptOf(i, j), ptOf(nx, j), z), id: `${EL(i, j)}c` };
      edges.push({ id: EL(i, j), curve, vertices: [V(i, j), V(nx, j)] });
    }
    // (A side edge beside a torus is the fitted neighbour's: on the torus within the fit, so tolerant by it.)
    const tolerant = !fitted(k) || !fitted((k + m - 1) % m);
    for (let j = 0; j < S; j++) edges.push({ id: ES(i, j), curve: turnCurve(side[k][j], a, `${ES(i, j)}c`), vertices: [V(i, j), V(i, j + 1)], ...(tolerant ? { toleranceMM: tolEdge } : {}) });
  }
  for (let i = 0; i < n; i++) {
    const k = tk(i), a = rotOf(i), P = T[k].P, nx = (i + 1) % n, tooth = toothOf(i) + 1;
    for (let j = 0; j < S; j++) {
      let surface: Surface;
      if (fitted(k)) surface = turnSurface(surf[k][j]!, a, `${id}_f${i}_${j}`);
      else {
        // (The tooth's tip or the space's root, its patch a pitch wide about the middle.)
        const mid = P.kind === 'tip' ? G.step * (tooth - 1) : G.step * (tooth - 1) + G.step / 2;
        surface = torusSurface(G, P.kind === 'tip' ? G.Rt : G.Rh, cj(j) + G.b / 2, cj(j + 1) + G.b / 2, mid - G.step / 2, G.step, `${id}_f${i}_${j}`);
      }
      faces.push({ id: `${id}_f${i}_${j}`, name: `${id}.${P.name}#${tooth}${j ? `.${j + 1}` : ''}`, sense: 'forward', surface,
        loops: [{ kind: 'outer', uses: [{ edge: EL(i, j), sense: 'forward' }, { edge: ES(nx, j), sense: 'forward' }, { edge: EL(i, j + 1), sense: 'reversed' }, { edge: ES(i, j), sense: 'reversed' }] }] });
    }
  }
  // The ends and the bore.
  const Rend = tipRadius(G, G.b / 2) + 1, plane = (z: number, upFace: boolean, sid: string): Surface => ({ kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: upFace ? [[[-Rend, -Rend, z], [-Rend, Rend, z]], [[Rend, -Rend, z], [Rend, Rend, z]]] : [[[-Rend, -Rend, z], [Rend, -Rend, z]], [[-Rend, Rend, z], [Rend, Rend, z]]], weights: [[1, 1], [1, 1]] });
  const holeUses: { bottom: string[]; top: string[] } = { bottom: [], top: [] };
  if (G.bore > 0) {
    const arcs = [arcCurve('b', G.bore, 0, -Math.PI), arcCurve('b', G.bore, -Math.PI, -Math.PI)];
    arcs.forEach((c, q) => { for (const [e, z] of [['b', 0], ['t', G.b]] as const) vertices.push({ id: `${id}_h${q}${e}`, point: [c.controlPoints[0][0], c.controlPoints[0][1], z] }); });
    arcs.forEach((c, q) => {
      for (const [e, z] of [['b', 0], ['t', G.b]] as const) { const eid = `${id}_h${q}e${e}`; edges.push({ id: eid, curve: { ...c, id: `${eid}c`, controlPoints: c.controlPoints.map(p => [p[0], p[1], z]) }, vertices: [`${id}_h${q}${e}`, `${id}_h${(q + 1) % 2}${e}`] }); (e === 'b' ? holeUses.bottom : holeUses.top).push(eid); }
      const p0 = c.controlPoints[0]; edges.push({ id: `${id}_h${q}ev`, curve: { kind: 'curve', id: `${id}_h${q}evc`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[p0[0], p0[1], 0], [p0[0], p0[1], G.b]], weights: [1, 1] }, vertices: [`${id}_h${q}b`, `${id}_h${q}t`] });
    });
    arcs.forEach((c, q) => faces.push({ id: `${id}_bore${q}`, name: `${id}.bore#${q + 1}`, sense: 'forward',
      surface: { kind: 'surface', id: `${id}_bs${q}`, degreeU: 2, degreeV: 1, knotsU: [...c.knots], knotsV: [0, 0, 1, 1], controlPoints: c.controlPoints.map(p => [[p[0], p[1], 0], [p[0], p[1], G.b]]), weights: c.weights.map(w => [w, w]) },
      loops: [{ kind: 'outer', uses: [{ edge: `${id}_h${q}eb`, sense: 'forward' }, { edge: `${id}_h${(q + 1) % 2}ev`, sense: 'forward' }, { edge: `${id}_h${q}et`, sense: 'reversed' }, { edge: `${id}_h${q}ev`, sense: 'reversed' }] }] }));
  }
  const ringB = Array.from({ length: n }, (_, i) => EL(i, 0)), ringT = Array.from({ length: n }, (_, i) => EL(i, S));
  const loopsOf = (uses: string[], upFace: boolean) => upFace ? uses.map(edge => ({ edge, sense: 'forward' as const })) : [...uses].reverse().map(edge => ({ edge, sense: 'reversed' as const }));
  faces.push({ id: `${id}_face0`, name: `${id}.face0`, surface: plane(0, false, `${id}_p0`), sense: 'forward', loops: [{ kind: 'outer', uses: loopsOf(ringB, false) }, ...(G.bore > 0 ? [{ kind: 'inner' as const, uses: loopsOf(holeUses.bottom, false) }] : [])] });
  faces.push({ id: `${id}_face1`, name: `${id}.face1`, surface: plane(G.b, true, `${id}_p1`), sense: 'forward', loops: [{ kind: 'outer', uses: loopsOf(ringT, true) }, ...(G.bore > 0 ? [{ kind: 'inner' as const, uses: loopsOf(holeUses.top, true) }] : [])] });
  const brep = buildBrep({ source: { family: 'gear', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  const diagnostics: GearDiagnostic[] = [{ code: 'ROOT_TRANSITION_UNVALIDATED', severity: 'warning', message: 'cut by a hob of the worm\'s own thread, its crest the worm\'s raised by the 0.25 m_x clearance and sharp-cornered: the hob a real shop uses (its tip round, its oversize, its resharpening) is not modelled' }];
  return { brep, report: { generator: 'worm-wheel@0', kind: 'throated',
    dimensions: { referenceDiameterMM: 2 * G.r2, throatDiameterMM: 2 * tipRadius(G, 0), rootDiameterMM: 2 * rootRadius(G, 0), throatRadiusMM: G.Rt, rootTorusRadiusMM: G.Rh, centerDistanceMM: G.a, faceWidthMM: G.b,
      tipDiameterAtFacesMM: 2 * tipRadius(G, G.b / 2), rootDiameterAtFacesMM: 2 * rootRadius(G, G.b / 2) },
    flank: { piecesAcross: Ff * nuf, piecesAlong: S * nvs, faces: Ff * S, deviationMM: devFlank }, fillet: { piecesAcross: Fi * nui, piecesAlong: S * nvs, faces: Fi * S, deviationMM: devFillet },
    profileToleranceMM: tol, manufacturingValidated: false, diagnostics } };
}

// ——— The pair and its placement ———

/** A throated wheel's worm (R12b.6): the wheel's own, its length and thinning the worm's. */
export function throatedWheelWorm(wheel: ThroatedWheelSpec, worm: { readonly lengthMM: number; readonly boreDiameterMM?: number; readonly toothThicknessReductionMM?: number }): WormSpec {
  return { ...wheel.worm, form: 'ZA', lengthMM: worm.lengthMM, ...(worm.boreDiameterMM ? { boreDiameterMM: worm.boreDiameterMM } : {}), ...(worm.toothThicknessReductionMM ? { toothThicknessReductionMM: worm.toothThicknessReductionMM } : {}) };
}
export interface ThroatedPairCheck {
  readonly centerDistanceMM: number; readonly speedRatio: number; readonly backlashMM: number;
  /** Sections square to the wheel's axis (the mid-plane, ±b/4, ±b/2.2), each swept over an axial pitch of the worm. */
  readonly planes: readonly { readonly offsetMM: number; readonly minimumClearanceMM: number; readonly interference: boolean }[];
  readonly interference: boolean;
  /** How close two sections may come and be in contact (the throated wheel touches its worm along lines): the fits and the sections' chords. */
  readonly touchMM: number;
  readonly diagnostics: readonly GearDiagnostic[];
}
function sameWorm(a: WormSpec, b: WormSpec): void {
  const A = wormDimensions({ ...a, lengthMM: 1 }), B = wormDimensions({ ...b, lengthMM: 1 });
  if (B.form !== 'ZA' || A.m !== B.m || A.z1 !== B.z1 || Math.abs(A.d1 - B.d1) > 1e-9 * A.d1 || A.h !== B.h) throw gearError('MATE_INCOMPATIBLE', `a throated wheel meshes with the ZA worm it was cut for (m_x ${A.m}, ${A.z1} starts, d1 ${A.d1}, ${A.h > 0 ? 'right' : 'left'} hand)`);
}
/** The wheel's exact sections near the mesh (the pair's frame, the wheel turned Δ from its cutting pose), segments x0 y0 x1 y1 within the band. */
function wheelSections(G: WheelGeom, c: number, delta: number, yLo: number, yHi: number, reach: number): Float64Array {
  const out: number[] = [], o = [0, 0, 0];
  const sides: [WPiece['kind'], number, number, number][] = [];
  // (Per space j near −π/2: both sides' fillet and flank, root to tip.)
  const o1 = [0, 0, 0]; flankPoint(G, 1, 0, G.Rh, o1); const a1 = Math.atan2(o1[1], o1[0]); flankPoint(G, -1, 0, G.Rh, o1); const s1 = a1 > Math.atan2(o1[1], o1[0]) ? 1 : -1;
  for (let j = -3; j <= 3; j++) for (const sg of [s1, -s1]) for (const kind of ['fillet', 'flank'] as const) sides.push([kind, sg, j, 0]);
  const cs = Math.cos(delta), sn = Math.sin(delta);
  for (const [kind, sg, j] of sides) {
    const P: WPiece = { name: '', kind, sigma: sg, sA: 0, sB: 1, rot: G.step * j };
    let px = 0, py = 0, prev = false;
    for (let i = 0; i <= 200; i++) {
      pieceAt(G, P, i / 200, c, o); const x = cs * o[0] - sn * o[1], y = sn * o[0] + cs * o[1], keep = y > yLo && y < yHi && Math.abs(x) < reach;
      if (prev && keep) out.push(px, py, x, y);
      px = x; py = y; prev = true;
    }
  }
  return Float64Array.from(out);
}
/**
 * A ZA worm and the throated wheel cut for it (R12b.6, D137): the worm the wheel's (else MATE_INCOMPATIBLE); sections
 * square to the wheel's axis — the mid-plane, ±b/4 and ±b/2.2 — each swept through one axial pitch of the worm (the worm
 * turned θ, the wheel −h θ z1/z2 from its cutting pose, plus the phase: the worm's own extra turn). In contact the two
 * touch along lines: sections nearer than the touch bound (the faces' fits and the chords) are in contact, not crossing.
 */
export function checkThroatedWormPair(worm: WormSpec, wheel: ThroatedWheelSpec, options: { readonly relativePhaseDeg?: number; readonly samples?: number; readonly mode?: 'report' | 'verdict' } = {}): ThroatedPairCheck {
  sameWorm(wheel.worm, worm);
  const G = throatedWheelGeom(wheel), w = wormDimensions(worm), tol = wheel.profileToleranceMM ?? 1e-4 * G.w.mn;
  const reach = Math.sqrt(Math.max(0, tipRadius(G, 0) ** 2 - (G.a - w.ra) ** 2)) + Math.PI * w.m, yLo = -tipRadius(G, G.b / 2) - w.m, yHi = -(G.a - w.ra) + w.m;
  const Wk = { w, W: wormOutline(w), a: G.a, reach, yLo, yHi }, N = Math.max(8, options.samples ?? 32), phase = (options.relativePhaseDeg ?? 0) * Math.PI / 180, verdict = options.mode === 'verdict', period = 2 * Math.PI / w.z1;
  // (Touch: twice the fit's tolerance — the wheel's faces lie within it of the generated surface — and the 200-point chords' sag.)
  const touch = 2 * tol + 2e-5 * w.m;
  const planes = [0, -G.b / 4, G.b / 4, -G.b / 2.2, G.b / 2.2].map(c => {
    let least = Infinity;
    for (let i = 0; i < N; i++) {
      const th = period * i / N, d = planeClearance(wormSection(Wk, c, th + phase), wheelSections(G, c, -w.h * th * w.z1 / G.z2, yLo, yHi, reach), touch, w.m);
      if (d < least) least = d; if (d < 0 && verdict) break;
    }
    return { offsetMM: c, minimumClearanceMM: least, interference: least < 0 };
  });
  const crossed = planes.filter(p => p.interference), diagnostics: GearDiagnostic[] = [];
  if (crossed.length) diagnostics.push({ code: 'SELF_INTERSECTION', severity: 'error', message: `the worm's thread and the throated wheel's teeth cross in the section${crossed.length > 1 ? 's' : ''} ${crossed.map(p => p.offsetMM.toFixed(3)).join(', ')} mm from its mid-plane` });
  return { centerDistanceMM: G.a, speedRatio: G.z2 / w.z1, backlashMM: (wheel.toothThicknessReductionMM ?? 0) + w.red, planes, interference: crossed.length > 0, touchMM: touch, diagnostics };
}

/** A throated wheel as placed: its spec, its axis +Z through `center` from `from` (its mid-plane at from + b/2), turned `rotation` (tooth 1 on +X in the mid-plane at 0). */
export interface PlacedThroatedWheel { readonly spec: ThroatedWheelSpec; readonly center: readonly [number, number]; readonly from: number; readonly rotation: number }
/**
 * Where its worm stands (R12b.6): as D136's — square to the wheel's axis at a toward φ in its mid-plane, its length centred
 * there, local X toward the wheel — turned so a thread meets a space in the mid-plane as the hob did (plus `phase`).
 */
export function throatedWormPlacement(wheel: PlacedThroatedWheel, worm: WormSpec, phi: number, phase: number): PlacedWorm {
  sameWorm(wheel.spec.worm, worm);
  const G = throatedWheelGeom(wheel.spec), w = wormDimensions(worm), t: Point = [-Math.sin(phi), Math.cos(phi), 0], zm = wheel.from + G.b / 2;
  const mid: Point = [wheel.center[0] + G.a * Math.cos(phi), wheel.center[1] + G.a * Math.sin(phi), zm];
  return { spec: worm, origin: [mid[0] - t[0] * w.L / 2, mid[1] - t[1] * w.L / 2, zm], axis: t, xAxis: [-Math.cos(phi), -Math.sin(phi), 0], rotation: throatedTurnFor(wheel, G, w, phi) + phase };
}
/** The worm's turn meshing with the throated wheel as it stands (the wheel's frame: tooth 1 at +X, its cutting pose's space at −π/2 turned by π/2 + π/z2). */
function throatedTurnFor(wheel: PlacedThroatedWheel, G: WheelGeom, w: WormDimensions, phi: number): number {
  // The wheel's frame is its cutting pose turned by ω = π/2 + π/z2; standing turned `rotation` with its worm toward φ, it
  // is, in the pair's frame (the worm toward −Y), its cutting pose turned Δ = rotation + ω − (φ + π/2); and Δ = −h θ z1/z2.
  const delta = wheel.rotation + (Math.PI / 2 + Math.PI / G.z2) - (phi + Math.PI / 2);
  const theta = -delta * G.z2 / (w.h * w.z1);
  return theta - w.h * (w.L / 2) / w.p;
}
/** The pair checks for a throated wheel and its worm as placed: square, at a, in the mid-plane (else MATE_INCOMPATIBLE); the relative phase from the worm's turn; then `checkThroatedWormPair`. */
export function checkPlacedThroatedPair(wheel: PlacedThroatedWheel, wp: PlacedWorm, options: { readonly samples?: number; readonly mode?: 'report' | 'verdict' } = {}): ThroatedPairCheck & { readonly relativePhaseDeg: number } {
  sameWorm(wheel.spec.worm, wp.spec);
  const G = throatedWheelGeom(wheel.spec), w = wormDimensions(wp.spec), Z = wp.axis, mid: Point = [wp.origin[0] + Z[0] * w.L / 2, wp.origin[1] + Z[1] * w.L / 2, wp.origin[2] + Z[2] * w.L / 2];
  const dx = mid[0] - wheel.center[0], dy = mid[1] - wheel.center[1], phi = Math.atan2(dy, dx);
  if (Math.abs(Z[2]) > 1e-12 || Math.abs(Math.hypot(dx, dy) - G.a) > 1e-9 * G.a || Math.abs(mid[2] - (wheel.from + G.b / 2)) > 1e-9 * G.a || Math.abs(Z[0] * Math.cos(phi) + Z[1] * Math.sin(phi)) > 1e-12) throw gearError('MATE_INCOMPATIBLE', `the worm is not square to the throated wheel at ${G.a.toFixed(4)} mm in its mid-plane`);
  const pitch = 2 * Math.PI / w.z1, raw = wp.rotation - throatedTurnFor(wheel, G, w, phi);
  let phase = ((raw % pitch) + pitch) % pitch; if (phase < 1e-9 * pitch || pitch - phase < 1e-9 * pitch) phase = 0;
  const deg = phase * 180 / Math.PI;
  return { ...checkThroatedWormPair(wp.spec, wheel.spec, { ...options, relativePhaseDeg: deg }), relativePhaseDeg: deg };
}
