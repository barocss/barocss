import { check, XYCircularNumericalSketchError } from './xy-circular-numerical-sketch-admission-internal.js';
import { isNumericalError } from './xy-numerical-sketch-admission-internal.js';
import { evaluate as evaluateLines, qr as lineQR, tolerances } from './xy-numerical-sketch-solver-internal.js';
import type { XYNumericalSketchDocumentV0, XYNumericalSketchConstraint, XYNumericalSketchResidual } from './xy-numerical-sketch.js';
import type { XYCircularNumericalSketchDocumentV0, XYCircularNumericalSketchPoint, XYCircularNumericalSketchRadius, XYCircularNumericalSketchReport, XYCircularNumericalSketchContact } from './xy-circular-numerical-sketch.js';
export const limits = Object.freeze({ points: 16, segments: 8, circles: 4, constraints: 32, scalarResiduals: 64, unknowns: 32, branchGuards: 16,
  coordinateAbsMM: 10000, minimumSegmentMM: .001, minimumRadiusMM: .001, maximumRadiusMM: 10000, iterations: 100, evaluations: 1200, sourceCharacters: 262144, sourceBytes: 262144 });
function inherited<T>(run: () => T): T {
  try { return run(); } catch (cause) { if (isNumericalError(cause)) throw new XYCircularNumericalSketchError(cause.code, 'Inherited numerical operation refused', cause.path, cause); throw new XYCircularNumericalSketchError('NUMERICAL', 'Inherited numerical operation refused', '$', cause); }
}
export function qr(matrix: number[][], rhs: number[], columns: number): ReturnType<typeof lineQR> { return inherited(() => lineQR(matrix, rhs, columns)); }
/** Every evaluation validates radius/envelope and the finite contact domain before producing rows. */
export function evaluate(d: XYCircularNumericalSketchDocumentV0, x: number[]): { jacobian: number[][]; residuals: XYNumericalSketchResidual[]; objective: number; contacts: XYCircularNumericalSketchContact[] } {
  const pointCount = 2 * d.points.length, n = pointCount + d.circles.length;
  check(x.length === n && x.every(Number.isFinite), 'NUMERICAL', 'Finite candidate vector of declared size required');
  const indices = new Map(d.points.map((p, i) => [p.id, 2 * i]));
  for (let i = 0; i < d.circles.length; i++) {
    const c = indices.get(d.circles[i].centerPointId)!, r = x[pointCount + i];
    check(r >= .001 && r <= 10000, 'NUMERICAL', 'Positive bounded circle radius required', '$.circles');
    check([x[c] - r, x[c] + r, x[c + 1] - r, x[c + 1] + r].every(v => Number.isFinite(v) && Math.abs(v) <= 10000), 'NUMERICAL', 'Circle pole envelope exceeds +/-10000 mm', '$.circles');
  }
  const lineConstraints = d.constraints.filter((c): c is XYNumericalSketchConstraint => c.kind !== 'radius' && c.kind !== 'line-circle-tangent');
  const lineDocument: XYNumericalSketchDocumentV0 = { format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v0', id: d.id, lengthUnit: 'mm', angleUnit: 'rad', points: d.points, segments: d.segments, constraints: lineConstraints, branchGuards: d.branchGuards };
  const old = inherited(() => evaluateLines(lineDocument, x.slice(0, pointCount)));
  const jacobian: number[][] = [], residuals: XYNumericalSketchResidual[] = [], contacts: XYCircularNumericalSketchContact[] = []; let cursor = 0;
  for (const c of d.constraints) {
    if (c.kind !== 'radius' && c.kind !== 'line-circle-tangent') {
      const count = c.kind === 'fixed' || c.kind === 'coincident' ? 2 : 1;
      for (let j = 0; j < count; j++, cursor++) { jacobian.push([...old.jacobian[cursor], ...d.circles.map(() => 0)]); residuals.push(old.residuals[cursor]); }
      continue;
    }
    const ci = d.circles.findIndex(v => v.id === c.circleId), radiusIndex = pointCount + ci, radius = x[radiusIndex], row = Array(n).fill(0) as number[];
    let actual: number, target: number;
    if (c.kind === 'radius') { row[radiusIndex] = 1; actual = radius; target = c.radiusMM; }
    else {
      const segment = d.segments.find(s => s.id === c.segmentId)!, a = indices.get(segment.startPointId)!, b = indices.get(segment.endPointId)!, center = indices.get(d.circles[ci].centerPointId)!;
      const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
      const vx = x[center] - x[a], vy = x[center + 1] - x[a + 1], t = (vx * dx + vy * dy) / (length * length), signed = nx * vx + ny * vy, sigma = c.side === 'left' ? 1 : -1;
      check(Number.isFinite(t) && Number.isFinite(signed), 'NUMERICAL', 'Nonfinite tangent contact');
      check(t > 0 && t < 1 && sigma * signed > 0, 'BRANCH', 'Tangency requires authored side and strictly interior finite-segment contact', '$.constraints');
      for (const [index, scale] of [[a, sigma * (t - 1)], [b, -sigma * t], [center, sigma]] as [number, number][]) { row[index] += scale * nx; row[index + 1] += scale * ny; }
      row[radiusIndex] = -1; actual = sigma * signed; target = radius;
      contacts.push({ constraintId: c.id, segmentId: c.segmentId, circleId: c.circleId, side: c.side, signedDistanceMM: signed, radiusMM: radius, contactParameter: t, contactXY: [x[a] + t * dx, x[a + 1] + t * dy] });
    }
    const residual = actual - target; check(Number.isFinite(residual) && row.every(Number.isFinite), 'NUMERICAL', 'Nonfinite circular residual or Jacobian');
    jacobian.push(row); residuals.push({ constraintId: c.id, component: c.kind, actual, target, residual, unit: 'mm', tolerance: tolerances.linearMM });
  }
  const objective = residuals.reduce((sum, r) => sum + r.residual * r.residual, 0); check(Number.isFinite(objective), 'NUMERICAL', 'Nonfinite objective');
  return { jacobian, residuals, objective, contacts };
}
export function solve(d: XYCircularNumericalSketchDocumentV0): { points: XYCircularNumericalSketchPoint[]; radii: XYCircularNumericalSketchRadius[]; report: XYCircularNumericalSketchReport } {
  let x = [...d.points.flatMap(p => p.position), ...d.circles.map(c => c.radius.valueMM)], current = evaluate(d, x), evaluations = 1, iterations = 0, damping = 1e-3;
  const satisfied = (e: ReturnType<typeof evaluate>) => e.residuals.every(r => Math.abs(r.residual) <= r.tolerance);
  while (!satisfied(current) && iterations < limits.iterations) {
    iterations++; let accepted = false;
    for (let trial = 0; trial < 12; trial++) {
      check(evaluations < limits.evaluations - 1, 'BUDGET', 'Evaluation cap reached');
      const matrix = [...current.jacobian.map(row => [...row]), ...x.map((_, i) => x.map((__, j) => i === j ? Math.sqrt(damping) : 0))];
      const step = qr(matrix, [...current.residuals.map(r => -r.residual), ...x.map(() => 0)], x.length).solution;
      const candidate = x.map((v, i) => v + step[i]); evaluations++;
      let next: ReturnType<typeof evaluate> | null = null;
      try { next = evaluate(d, candidate); } catch (cause) {
        if (!(cause instanceof XYCircularNumericalSketchError) || !['BRANCH', 'DEGENERATE_GEOMETRY', 'NUMERICAL'].includes(cause.code)) throw cause;
      }
      if (next && next.objective < current.objective) { x = candidate; current = next; damping = Math.max(1e-12, damping / 3); accepted = true; break; }
      damping = Math.min(1e12, damping * 10);
    }
    if (!accepted && damping === 1e12) break;
  }
  check(satisfied(current), 'NONCONVERGENCE', 'Bounded local solve did not meet fixed residual tolerances; this is not an inconsistency proof');
  evaluations++; const final = evaluate(d, x); check(satisfied(final), 'NUMERICAL', 'Independent final coefficient residual check failed');
  const rank = qr(final.jacobian, final.residuals.map(() => 0), x.length);
  return { points: d.points.map((p, i) => ({ id: p.id, position: [x[2 * i], x[2 * i + 1]] })), radii: d.circles.map((c, i) => ({ circleId: c.id, radiusId: c.radius.id, valueMM: x[2 * d.points.length + i] })), report: {
    numericalRank: rank.rank, rankThreshold: rank.threshold, localDegreesOfFreedom: x.length - rank.rank, fullyConstrainedLocally: rank.rank === x.length,
    unknownCount: x.length, scalarResidualCount: final.residuals.length, residuals: final.residuals, contacts: final.contacts, objective: final.objective, iterations, evaluations, termination: 'residual-tolerances-met',
    tolerances: { ...tolerances }, limits: { ...limits }, quality: { arithmetic: 'binary64-local-numerical', objectiveNormalization: 'linear/1mm-angular/1rad-sum-squares',
      rank: 'column-pivoted-householder-qr-local-not-exact-or-global', branch: 'authored-guards-radius-envelope-and-strict-interior-sided-contact-on-seed-and-accepted-iterates', rootSelection: 'seed-dependent-no-global-closest-root-guarantee',
      constraints: 'authored-order-points-xy-then-circle-radii-order', damping: 'initial1e-3-accept/3-floor1e-12-reject*10-ceiling1e12', nativeGeometry: 'degree1-lines-degree2-rational-circles-xy-z-zero',
      contact: 'analytic-finite-segment-construction-point-not-native-curve-parameter', ownership: 'copied-cpu-data-gc-no-renderer-resources', topologyCertified: false, manufacturingToleranceCertified: false, regionCertified: false, solid: false } } };
}
