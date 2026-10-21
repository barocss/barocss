// FRg (O122): the 3D skeleton sketch — points, straight segments and constraints among them, solved by our own
// Levenberg–Marquardt (no WASM, no numeric library): each constraint a residual with its analytic Jacobian, the step
// (JᵀJ + λI)δ = −Jᵀr by Cholesky, λ cut on a step that lowers ‖r‖ and raised on one that does not. Diagnosis at the
// solution, typed: the degrees of freedom left (3N less the Jacobian's rank, rows normalised), the constraints that
// add no rank to those before them (redundant), the ones still unmet (a conflict), the points not fixed by the rest.
// A sketch with nothing fixed keeps its 6 rigid motions (3 for points on a line), as a 2D sketch keeps 3.
// The viewport's tool on it is the GPU lane's (G17).

export type V3 = [number, number, number];
export type Axis3 = 'x' | 'y' | 'z';
export type Constraint3D =
  | { kind: 'coincident'; a: number; b: number }
  | { kind: 'fixed'; point: number; at?: V3 }
  | { kind: 'length'; segment: number; value: number }
  | { kind: 'distance'; a: number; b: number; value: number }
  | { kind: 'angle'; a: number; b: number; degrees: number }
  | { kind: 'parallel'; a: number; b: number }
  | { kind: 'perpendicular'; a: number; b: number }
  | { kind: 'on-axis'; point: number; axis: Axis3 | { origin: V3; direction: V3 } }
  | { kind: 'on-plane'; point: number; plane: { origin: V3; normal: V3 } }
  | { kind: 'along'; segment: number; axis: Axis3 | V3 };

export type Solve3DStatus = 'well' | 'under' | 'over' | 'conflict';
export interface Solve3D {
  readonly points: V3[];
  /** well: no freedom left and nothing redundant; under: freedom left; over: met, but some constraint adds nothing; conflict: some unmet. */
  readonly status: Solve3DStatus;
  readonly dof: number;
  /** Constraints adding no rank to those before them (by index); a conflict: those left unmet, with their residual. */
  readonly redundant: readonly number[];
  readonly unmet: readonly { readonly constraint: number; readonly residual: number }[];
  /** Points the constraints leave free to move (not every coordinate fixed by them). */
  readonly free: readonly number[];
  readonly iterations: number;
}

const TOL = 1e-10, MET = 1e-9, RANK = 1e-8, MAX_IT = 200;
const AXES: Record<Axis3, V3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const unit = (v: readonly number[]): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

/** A residual row: its value and its nonzero Jacobian entries (column, derivative). */
interface Row { r: number; j: [number, number][] }

/** Why the sketch's data is refused (an index out of range, a length not positive …), or null. */
export function sketch3dRefusal(points: readonly V3[], segments: readonly [number, number][], constraints: readonly Constraint3D[]): string | null {
  const P = points.length, S = segments.length, pt = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < P, sg = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < S;
  for (const [k, c] of constraints.entries()) {
    const at = `constraint ${k} (${c.kind})`;
    switch (c.kind) {
      case 'coincident': case 'distance': if (!pt(c.a) || !pt(c.b) || c.a === c.b) return `${at}: two different points`; if (c.kind === 'distance' && !(c.value > 0)) return `${at}: a distance above 0`; break;
      case 'fixed': if (!pt(c.point)) return `${at}: a point of the sketch`; break;
      case 'length': if (!sg(c.segment) || !(c.value > 0)) return `${at}: a segment and a length above 0`; break;
      case 'angle': case 'parallel': case 'perpendicular': if (!sg(c.a) || !sg(c.b) || c.a === c.b) return `${at}: two different segments`; if (c.kind === 'angle' && !(c.degrees > 0 && c.degrees < 180)) return `${at}: degrees between 0 and 180 (parallel for 0 or 180)`; break;
      case 'on-axis': case 'on-plane': if (!pt(c.point)) return `${at}: a point of the sketch`; break;
      case 'along': if (!sg(c.segment)) return `${at}: a segment of the sketch`; break;
      default: return `constraint ${k}: no kind "${String((c as { kind?: unknown }).kind)}" (coincident, fixed, length, distance, angle, parallel, perpendicular, on-axis, on-plane, along)`;
    }
  }
  return null;
}

/** Each constraint's rows at x (the points flattened). */
function rows(x: Float64Array, segments: readonly [number, number][], cs: readonly Constraint3D[], out: Row[][]): void {
  for (let k = 0; k < cs.length; k++) {
    const c = cs[k], R: Row[] = out[k] = [];
    switch (c.kind) {
      case 'coincident': for (let d = 0; d < 3; d++) R.push({ r: x[3 * c.a + d] - x[3 * c.b + d], j: [[3 * c.a + d, 1], [3 * c.b + d, -1]] }); break;
      case 'fixed': { const at = c.at ?? [0, 0, 0]; for (let d = 0; d < 3; d++) R.push({ r: x[3 * c.point + d] - at[d], j: [[3 * c.point + d, 1]] }); break; }
      case 'length': case 'distance': {
        const [i, j] = c.kind === 'length' ? segments[c.segment] : [c.a, c.b], a = at(x, i), b = at(x, j), d = sub(b, a), l = norm(d), J: [number, number][] = [];
        for (let e = 0; e < 3; e++) J.push([3 * j + e, d[e] / l], [3 * i + e, -d[e] / l]);
        R.push({ r: l - c.value, j: J }); break;
      }
      case 'angle': case 'perpendicular': {
        const [a0, a1] = segments[c.a], [b0, b1] = segments[c.b], u = sub(at(x, a1), at(x, a0)), v = sub(at(x, b1), at(x, b0)), lu = norm(u), lv = norm(v), cos = dot(u, v) / (lu * lv);
        const want = c.kind === 'perpendicular' ? 0 : Math.cos(c.degrees * Math.PI / 180), J: [number, number][] = [];
        for (let e = 0; e < 3; e++) { const du = v[e] / (lu * lv) - cos * u[e] / (lu * lu), dv = u[e] / (lu * lv) - cos * v[e] / (lv * lv); J.push([3 * a1 + e, du], [3 * a0 + e, -du], [3 * b1 + e, dv], [3 * b0 + e, -dv]); }
        R.push({ r: cos - want, j: J }); break;
      }
      case 'parallel': {
        // (r = (u × v)/(|u||v|): zero along either sense.)
        const [a0, a1] = segments[c.a], [b0, b1] = segments[c.b], u = sub(at(x, a1), at(x, a0)), v = sub(at(x, b1), at(x, b0)), lu = norm(u), lv = norm(v), s = lu * lv, w = cross(u, v);
        for (let d = 0; d < 3; d++) {
          // ∂w_d/∂u_e = −[v]×(d,e), ∂w_d/∂v_e = [u]×(d,e); the norm's part −w_d·u_e/(|u|²·s), −w_d·v_e/(|v|²·s).
          const j: [number, number][] = [];
          for (let e = 0; e < 3; e++) { const gu = -skew(v, d, e) / s - w[d] * u[e] / (lu * lu * s), gv = skew(u, d, e) / s - w[d] * v[e] / (lv * lv * s); j.push([3 * a1 + e, gu], [3 * a0 + e, -gu], [3 * b1 + e, gv], [3 * b0 + e, -gv]); }
          R.push({ r: w[d] / s, j });
        }
        break;
      }
      case 'on-axis': {
        const o = typeof c.axis === 'string' ? [0, 0, 0] : c.axis.origin, a = typeof c.axis === 'string' ? AXES[c.axis] : unit(c.axis.direction), q = sub(at(x, c.point), o), w = cross(q, a);
        for (let d = 0; d < 3; d++) { const j: [number, number][] = []; for (let e = 0; e < 3; e++) j.push([3 * c.point + e, -skew(a, d, e)]); R.push({ r: w[d], j }); }
        break;
      }
      case 'on-plane': { const n = unit(c.plane.normal), q = sub(at(x, c.point), c.plane.origin); R.push({ r: dot(q, n), j: [[3 * c.point, n[0]], [3 * c.point + 1, n[1]], [3 * c.point + 2, n[2]]] }); break; }
      case 'along': {
        const [s0, s1] = segments[c.segment], a = typeof c.axis === 'string' ? AXES[c.axis] : unit(c.axis), u = sub(at(x, s1), at(x, s0)), lu = norm(u), w = cross(u, a);
        for (let d = 0; d < 3; d++) { const j: [number, number][] = []; for (let e = 0; e < 3; e++) { const g = -skew(a, d, e) / lu - w[d] * u[e] / (lu * lu * lu); j.push([3 * s1 + e, g], [3 * s0 + e, -g]); } R.push({ r: w[d] / lu, j }); }
        break;
      }
    }
  }
}
/** Point i of the flattened coordinates. */
const at = (x: Float64Array, i: number): V3 => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]) || 1e-300;
const cross = (a: readonly number[], b: readonly number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** [a]×'s entry (d, e): (a × q)_d = Σ_e [a]×(d, e) q_e. */
const skew = (a: readonly number[], d: number, e: number) => d === e ? 0 : (d + 1) % 3 === e ? -a[(d + 2) % 3] : a[(d + 1) % 3];

const sumSq = (R: readonly Row[][]) => { let t = 0; for (const g of R) for (const r of g) t += r.r * r.r; return t; };

/** The sketch solved from its points as they are (the start), its constraints met where they can be, and its diagnosis. */
export function solveSketch3D(points: readonly V3[], segments: readonly [number, number][], constraints: readonly Constraint3D[]): Solve3D {
  const n = 3 * points.length, x = new Float64Array(n);
  points.forEach((q, i) => { x[3 * i] = q[0]; x[3 * i + 1] = q[1]; x[3 * i + 2] = q[2]; });
  let R: Row[][] = new Array(constraints.length);
  rows(x, segments, constraints, R);
  let f = sumSq(R), lambda = 1e-3, it = 0;
  const A = new Float64Array(n * n), g = new Float64Array(n), trial = new Float64Array(n), R2: Row[][] = new Array(constraints.length);
  for (; it < MAX_IT && f > TOL * TOL; it++) {
    normalEquations(R, n, A, g);
    let moved = false;
    for (let tries = 0; tries < 30; tries++) {
      const d = choleskySolve(A, g, n, lambda);
      if (d) {
        for (let i = 0; i < n; i++) trial[i] = x[i] - d[i];
        rows(trial, segments, constraints, R2);
        const f2 = sumSq(R2);
        if (f2 < f) { x.set(trial); f = f2; R = R2.slice(); lambda = Math.max(lambda / 3, 1e-15); moved = true; break; }
      }
      lambda *= 4;
    }
    if (!moved) break;
  }
  return diagnose(x, constraints, R, it);
}

/** JᵀJ (dense, into A) and Jᵀr (into g). */
function normalEquations(R: readonly Row[][], n: number, A: Float64Array, g: Float64Array): void {
  A.fill(0); g.fill(0);
  for (const group of R) for (const row of group) {
    for (const [a, da] of row.j) { g[a] += da * row.r; for (const [b, db] of row.j) A[a * n + b] += da * db; }
  }
}
/** (A + λI)δ = g by Cholesky; null when not positive definite. */
function choleskySolve(A: Float64Array, g: Float64Array, n: number, lambda: number): Float64Array | null {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * n + j] + (i === j ? lambda : 0);
    for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
    if (i === j) { if (!(s > 0)) return null; L[i * n + i] = Math.sqrt(s); } else L[i * n + j] = s / L[j * n + j];
  }
  const y = new Float64Array(n), d = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = g[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]; y[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * d[k]; d[i] = s / L[i * n + i]; }
  return d;
}

/** The rank each constraint adds (its rows, normalised, against an orthonormal basis of those before), the unmet ones, the free points. */
function diagnose(x: Float64Array, cs: readonly Constraint3D[], R: Row[][], iterations: number): Solve3D {
  const n = x.length, basis: Float64Array[] = [], redundant: number[] = [], unmet: { constraint: number; residual: number }[] = [];
  const v = new Float64Array(n);
  for (let k = 0; k < cs.length; k++) {
    let added = 0, worst = 0;
    for (const row of R[k]) {
      worst = Math.max(worst, Math.abs(row.r));
      v.fill(0); for (const [c, d] of row.j) v[c] += d;
      if (orthoAdd(basis, v)) added++;
    }
    if (!added) redundant.push(k);
    if (worst > MET) unmet.push({ constraint: k, residual: worst });
  }
  const rank = basis.length, dof = n - rank;
  // (A point is fixed when each of its three coordinates lies in the rows' span: its unit vector projects onto it whole.)
  const free: number[] = [];
  for (let i = 0; i < n / 3; i++) for (let d = 0; d < 3; d++) {
    let inSpan = 0; for (const b of basis) inSpan += b[3 * i + d] * b[3 * i + d];
    if (inSpan < 1 - RANK) { free.push(i); break; }
  }
  const status: Solve3DStatus = unmet.length ? 'conflict' : redundant.length ? 'over' : dof ? 'under' : 'well';
  const points: V3[] = []; for (let i = 0; i < n / 3; i++) points.push([x[3 * i], x[3 * i + 1], x[3 * i + 2]]);
  return { points, status, dof, redundant, unmet, free, iterations };
}
/** Gram–Schmidt (twice, for its accuracy): the row normalised against the basis; added when what is left is not within RANK of none. */
function orthoAdd(basis: Float64Array[], row: Float64Array): boolean {
  const l0 = Math.hypot(...row); if (!(l0 > 0)) return false;
  const w = Float64Array.from(row, e => e / l0);
  for (let pass = 0; pass < 2; pass++) for (const b of basis) { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * b[i]; for (let i = 0; i < w.length; i++) w[i] -= s * b[i]; }
  const l = Math.hypot(...w); if (l < RANK) return false;
  for (let i = 0; i < w.length; i++) w[i] /= l;
  basis.push(w); return true;
}
