import { check, XYNumericalSketchError } from './xy-numerical-sketch-admission-internal.js';
import type { XYNumericalSketchDocumentV0, XYNumericalSketchPoint, XYNumericalSketchReport, XYNumericalSketchResidual } from './xy-numerical-sketch.js';

export const limits = Object.freeze({ points: 16, segments: 16, constraints: 32, scalarResiduals: 64, unknowns: 32, branchGuards: 16,
  coordinateAbsMM: 10000, minimumSegmentMM: .001, iterations: 100, evaluations: 1200 });
/**
 * `bounded-length-angle-v1`: the same solver and tolerances over larger bounded sketches (outlines with
 * several placed circles). v0's limits are unchanged.
 */
export const limitsV1 = Object.freeze({ ...limits, points: 64, segments: 64, constraints: 128, scalarResiduals: 256, unknowns: 128, branchGuards: 32 });
export const limitsFor = (profile: string) => profile === 'bounded-length-angle-v1' ? limitsV1 : limits;
export const tolerances = Object.freeze({ linearMM: 1e-7, angularRad: 1e-9, rankRelative: 1e-10 });
export function wrap(angle: number): number { const a = Math.atan2(Math.sin(angle), Math.cos(angle)); return a === -Math.PI ? Math.PI : a; }

/** Householder QR with recomputed column norms; strict > selects the first current column on a tie. */
export function qr(matrix: number[][], rhs: number[], columns: number): { solution: number[]; rank: number; threshold: number } {
  const a = matrix.map(row => [...row]), b = [...rhs], m = a.length, n = columns, order = Array.from({ length: n }, (_, i) => i), diagonals: number[] = [];
  for (let k = 0; k < Math.min(m, n); k++) {
    let pivot = k, largest = -1;
    for (let j = k; j < n; j++) { const norm = Math.hypot(...a.slice(k).map(row => row[j])); if (norm > largest) { largest = norm; pivot = j; } }
    if (pivot !== k) { for (const row of a) [row[k], row[pivot]] = [row[pivot], row[k]]; [order[k], order[pivot]] = [order[pivot], order[k]]; }
    const norm = Math.hypot(...a.slice(k).map(row => row[k]));
    if (norm === 0) { diagonals.push(0); continue; }
    const alpha = a[k][k] >= 0 ? -norm : norm, v = a.slice(k).map(row => row[k]); v[0] -= alpha;
    const length = Math.hypot(...v); for (let i = 0; i < v.length; i++) v[i] /= length;
    for (let j = k; j < n; j++) { let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * a[k + i][j]; for (let i = 0; i < v.length; i++) a[k + i][j] -= 2 * v[i] * dot; }
    let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * b[k + i]; for (let i = 0; i < v.length; i++) b[k + i] -= 2 * v[i] * dot;
    a[k][k] = alpha; for (let i = k + 1; i < m; i++) a[i][k] = 0; diagonals.push(Math.abs(alpha));
  }
  const threshold = Math.max(1, ...diagonals) * tolerances.rankRelative, rank = diagonals.filter(d => d > threshold).length;
  const z = Array(n).fill(0) as number[];
  // Only the leading rank block is used, avoiding a division by a numerically null diagonal.
  for (let i = rank - 1; i >= 0; i--) { let value = b[i]; for (let j = i + 1; j < rank; j++) value -= a[i][j] * z[j]; z[i] = value / a[i][i]; }
  const solution = Array(n).fill(0) as number[]; for (let i = 0; i < n; i++) solution[order[i]] = z[i];
  check(solution.every(Number.isFinite) && Number.isFinite(threshold), 'NUMERICAL', 'Nonfinite QR arithmetic'); return { solution, rank, threshold };
}

/** Independently recomputed from each supplied candidate, with no cached geometry or residual. */
export function evaluate(d: XYNumericalSketchDocumentV0, x: number[]): { jacobian: number[][]; residuals: XYNumericalSketchResidual[]; objective: number } {
  check(x.every(v => Number.isFinite(v) && Math.abs(v) <= 10000), 'NUMERICAL', 'Candidate coordinates exceed finite +/-10000 mm');
  const index = new Map(d.points.map((p, i) => [p.id, 2 * i])), n = x.length;
  const point = (id: string) => index.get(id)!;
  const segment = (id: string) => { const s = d.segments.find(s => s.id === id)!, a = point(s.startPointId), b = point(s.endPointId); return { a, b, dx: x[b] - x[a], dy: x[b + 1] - x[a + 1] }; };
  for (const s of d.segments) { const v = segment(s.id); check(Math.hypot(v.dx, v.dy) >= .001, 'DEGENERATE_GEOMETRY', 'Segment #' + s.id + ' is shorter than 0.001 mm', '$.segments'); }
  for (const g of d.branchGuards) {
    let value: number;
    if (g.kind === 'positive-projection') { const v = segment(g.segmentId), norm = Math.hypot(...g.direction); value = v.dx * (g.direction[0] / norm) + v.dy * (g.direction[1] / norm); }
    else { const a = point(g.pointA), b = point(g.pointB), c = point(g.pointC); value = ((x[b] - x[a]) * (x[c + 1] - x[a + 1]) - (x[b + 1] - x[a + 1]) * (x[c] - x[a])) * (g.orientation === 'ccw' ? 1 : -1); }
    check(Number.isFinite(value) && value > 0, 'BRANCH', 'Authored branch guard #' + g.id + ' failed', '$.branchGuards');
  }
  const jacobian: number[][] = [], residuals: XYNumericalSketchResidual[] = [];
  const add = (constraintId: string, component: string, actual: number, target: number, unit: 'mm' | 'rad', terms: [number, number][]) => {
    const row = Array(n).fill(0) as number[]; for (const [i, v] of terms) row[i] += v;
    const residual = unit === 'rad' ? wrap(actual - target) : actual - target;
    check(Number.isFinite(residual) && row.every(Number.isFinite), 'NUMERICAL', 'Nonfinite residual or Jacobian', '$.constraints');
    jacobian.push(row); residuals.push({ constraintId, component, actual, target, residual, unit, tolerance: unit === 'rad' ? tolerances.angularRad : tolerances.linearMM });
  };
  for (const c of d.constraints) {
    if (c.kind === 'fixed') { const a = point(c.pointId); for (let k = 0; k < 2; k++) add(c.id, k === 0 ? 'x' : 'y', x[a + k], c.target[k], 'mm', [[a + k, 1]]); }
    else if (c.kind === 'coincident') { const a = point(c.pointA), b = point(c.pointB); for (let k = 0; k < 2; k++) add(c.id, k === 0 ? 'dx' : 'dy', x[b + k] - x[a + k], 0, 'mm', [[b + k, 1], [a + k, -1]]); }
    else if (c.kind === 'equal-length') {
      const a = segment(c.segmentA), b = segment(c.segmentB), la = Math.hypot(a.dx, a.dy), lb = Math.hypot(b.dx, b.dy);
      add(c.id, 'equal-length', la - lb, 0, 'mm', [[a.a, -a.dx / la], [a.a + 1, -a.dy / la], [a.b, a.dx / la], [a.b + 1, a.dy / la],
        [b.a, b.dx / lb], [b.a + 1, b.dy / lb], [b.b, -b.dx / lb], [b.b + 1, -b.dy / lb]]);
    } else if (c.kind === 'signed-angle') {
      const a = segment(c.segmentA), b = segment(c.segmentB), aa = a.dx * a.dx + a.dy * a.dy, bb = b.dx * b.dx + b.dy * b.dy;
      add(c.id, 'signed-angle', wrap(Math.atan2(b.dy, b.dx) - Math.atan2(a.dy, a.dx)), c.angleRad, 'rad',
        [[a.a, -a.dy / aa], [a.a + 1, a.dx / aa], [a.b, a.dy / aa], [a.b + 1, -a.dx / aa], [b.a, b.dy / bb], [b.a + 1, -b.dx / bb], [b.b, -b.dy / bb], [b.b + 1, b.dx / bb]]);
    } else {
      const v = segment(c.segmentId);
      if (c.kind === 'length') { const length = Math.hypot(v.dx, v.dy); add(c.id, 'length', length, c.lengthMM, 'mm', [[v.a, -v.dx / length], [v.a + 1, -v.dy / length], [v.b, v.dx / length], [v.b + 1, v.dy / length]]); }
      else { const k = c.kind === 'horizontal' ? 1 : 0; add(c.id, k === 1 ? 'dy' : 'dx', k === 1 ? v.dy : v.dx, 0, 'mm', [[v.b + k, 1], [v.a + k, -1]]); }
    }
  }
  const objective = residuals.reduce((sum, r) => sum + r.residual * r.residual, 0); check(Number.isFinite(objective), 'NUMERICAL', 'Nonfinite objective'); return { jacobian, residuals, objective };
}
export function solve(d: XYNumericalSketchDocumentV0): { points: XYNumericalSketchPoint[]; report: XYNumericalSketchReport } {
  let x = d.points.flatMap(p => p.position), current = evaluate(d, x), evaluations = 1, iterations = 0, damping = 1e-3;
  const satisfied = (e: ReturnType<typeof evaluate>) => e.residuals.every(r => Math.abs(r.residual) <= r.tolerance);
  const lim = limitsFor(d.profile);
  while (!satisfied(current) && iterations < lim.iterations) {
    iterations++; let accepted = false;
    for (let trial = 0; trial < 12; trial++) {
      check(evaluations < lim.evaluations - 1, 'BUDGET', 'Evaluation cap reached');
      const matrix = [...current.jacobian.map(row => [...row]), ...x.map((_, i) => x.map((__, j) => i === j ? Math.sqrt(damping) : 0))];
      const step = qr(matrix, [...current.residuals.map(r => -r.residual), ...x.map(() => 0)], x.length).solution;
      const candidate = x.map((v, i) => v + step[i]); evaluations++;
      let next: ReturnType<typeof evaluate> | null = null;
      try { next = evaluate(d, candidate); } catch (cause) {
        if (!(cause instanceof XYNumericalSketchError) || !['BRANCH', 'DEGENERATE_GEOMETRY', 'NUMERICAL'].includes(cause.code)) throw cause;
      }
      if (next && next.objective < current.objective) { x = candidate; current = next; damping = Math.max(1e-12, damping / 3); accepted = true; break; }
      damping = Math.min(1e12, damping * 10);
    }
    if (!accepted && damping === 1e12) break;
  }
  check(satisfied(current), 'NONCONVERGENCE', 'Bounded local solve did not meet fixed residual tolerances; this is not an inconsistency proof');
  evaluations++; const final = evaluate(d, x); check(satisfied(final), 'NUMERICAL', 'Independent final coefficient residual check failed');
  const rank = qr(final.jacobian, final.residuals.map(() => 0), x.length);
  return { points: d.points.map((p, i) => ({ id: p.id, position: [x[2 * i], x[2 * i + 1]] })), report: {
    numericalRank: rank.rank, rankThreshold: rank.threshold, localDegreesOfFreedom: x.length - rank.rank, fullyConstrainedLocally: rank.rank === x.length,
    unknownCount: x.length, scalarResidualCount: final.residuals.length, residuals: final.residuals, objective: final.objective, iterations, evaluations, termination: 'residual-tolerances-met',
    tolerances: { ...tolerances }, limits: { ...lim }, quality: { arithmetic: 'binary64-local-numerical', objectiveNormalization: 'linear/1mm-angular/1rad-sum-squares',
      rank: 'column-pivoted-householder-qr-local-not-exact-or-global', branch: 'authored-guards-on-seed-and-accepted-iterates', rootSelection: 'seed-dependent-no-global-closest-root-guarantee',
      constraints: 'authored-order-points-xy-order', damping: 'initial1e-3-accept/3-floor1e-12-reject*10-ceiling1e12', nativeGeometry: 'degree1-xy-z-zero',
      ownership: 'copied-cpu-data-gc-no-renderer-resources', topologyCertified: false, manufacturingToleranceCertified: false } } };
}
