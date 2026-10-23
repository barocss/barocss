import { compileCadModel } from './model-compiler.js';
import type { CadModelIR1 } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model } from './types.js';
import type { XYPoint } from './xy-profile.js';
import { admit, check, exact, isNumericalError, snapshot, XYNumericalSketchError } from './xy-numerical-sketch-admission-internal.js';
import { solve } from './xy-numerical-sketch-solver-internal.js';
export { XYNumericalSketchError, XYNumericalSketchDiagnosticCode } from './xy-numerical-sketch-admission-internal.js';
import type { XYNumericalSketchDiagnosticCode } from './xy-numerical-sketch-admission-internal.js';

export interface XYNumericalSketchPoint { id: string; position: XYPoint }
export interface XYNumericalSketchSegment { id: string; startPointId: string; endPointId: string }
export type XYNumericalSketchConstraint =
  | { id: string; kind: 'fixed'; pointId: string; target: XYPoint }
  | { id: string; kind: 'coincident'; pointA: string; pointB: string }
  | { id: string; kind: 'horizontal' | 'vertical'; segmentId: string }
  | { id: string; kind: 'length'; segmentId: string; lengthMM: number }
  | { id: string; kind: 'signed-angle'; segmentA: string; segmentB: string; angleRad: number }
  /** |segmentA| − |segmentB| = 0: arc radii, equal sides. */
  | { id: string; kind: 'equal-length'; segmentA: string; segmentB: string };
export type XYNumericalSketchBranchGuard =
  | { id: string; kind: 'positive-projection'; segmentId: string; direction: XYPoint }
  | { id: string; kind: 'oriented-triplet'; pointA: string; pointB: string; pointC: string; orientation: 'ccw' | 'cw' };
export interface XYNumericalSketchDocumentV0 {
  /** `bounded-length-angle-v1`: the same, over larger sketches (64 points, 64 segments, 128 constraints, 256 residuals). */
  format: 'barocss-xy-numerical-sketch'; version: 0; profile: 'bounded-length-angle-v0' | 'bounded-length-angle-v1'; id: string; lengthUnit: 'mm'; angleUnit: 'rad';
  points: XYNumericalSketchPoint[]; segments: XYNumericalSketchSegment[]; constraints: XYNumericalSketchConstraint[];
  /** Required array; empty means no authored branch guards. */
  branchGuards: XYNumericalSketchBranchGuard[];
}
export interface XYNumericalSketchResidual { constraintId: string; component: string; actual: number; target: number; residual: number; unit: 'mm' | 'rad'; tolerance: number }
export interface XYNumericalSketchReport {
  numericalRank: number; rankThreshold: number; localDegreesOfFreedom: number; fullyConstrainedLocally: boolean;
  unknownCount: number; scalarResidualCount: number; residuals: XYNumericalSketchResidual[]; objective: number; iterations: number; evaluations: number;
  termination: 'residual-tolerances-met'; tolerances: { linearMM: number; angularRad: number; rankRelative: number };
  limits: { points: number; segments: number; constraints: number; scalarResiduals: number; unknowns: number; branchGuards: number; coordinateAbsMM: number; minimumSegmentMM: number; iterations: number; evaluations: number };
  quality: { arithmetic: 'binary64-local-numerical'; objectiveNormalization: 'linear/1mm-angular/1rad-sum-squares'; rank: 'column-pivoted-householder-qr-local-not-exact-or-global';
    branch: 'authored-guards-on-seed-and-accepted-iterates'; rootSelection: 'seed-dependent-no-global-closest-root-guarantee'; constraints: 'authored-order-points-xy-order';
    damping: 'initial1e-3-accept/3-floor1e-12-reject*10-ceiling1e12'; nativeGeometry: 'degree1-xy-z-zero'; ownership: 'copied-cpu-data-gc-no-renderer-resources';
    topologyCertified: false; manufacturingToleranceCertified: false };
}
export interface XYNumericalSketchSuccess { ok: true; document: XYNumericalSketchDocumentV0; solution: { points: XYNumericalSketchPoint[]; source: string; sourceVersion: 0; model: Model; ir: CadModelIR1 }; report: XYNumericalSketchReport }
export interface XYNumericalSketchDiagnostic { code: XYNumericalSketchDiagnosticCode; message: string; path: string }
export type XYNumericalSketchResult = XYNumericalSketchSuccess | { ok: false; diagnostics: XYNumericalSketchDiagnostic[] };

/** Atomic native construction after independently re-evaluating final solved coefficients. */
export function buildXYNumericalSketch(input: XYNumericalSketchDocumentV0): XYNumericalSketchSuccess {
  try {
    const document = admit(input), { points, report } = solve(document), positions = new Map(points.map(p => [p.id, p.position]));
    const curves: Curve[] = document.segments.map(s => ({ kind: 'curve', id: s.id, degree: 1, knots: [0, 0, 1, 1],
      controlPoints: [positions.get(s.startPointId)!, positions.get(s.endPointId)!].map(p => [p[0], p[1], 0]), weights: [1, 1] }));
    const decimal = (n: number) => curveDecimal(n, 'XY numerical sketch');
    const source = '@model ' + document.id + ' { version:0; length-unit:mm; ' + curves.map(c => '@curve #' + c.id + ' { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:['
      + c.controlPoints.map(p => '[' + p.map(decimal).join(',') + ']').join(',') + ']; weights:[1,1]; }').join(' ') + ' }\n';
    check(source.length <= 262144, 'LIMIT', 'Native source exceeds bounded text');
    const compiled = compileCadModel(source, { sourceVersion: 0 }); check(compiled.ok, 'COMPILATION', 'Native line source must compile');
    check(compiled.ir.schemaVersion === 1 && exact(compiled.model.objects, curves), 'COMPILATION', 'Native IDs and coefficients differ from independently verified solution');
    return copyCadData({ ok: true, document, solution: { points, source, sourceVersion: 0, model: compiled.model, ir: compiled.ir }, report });
  } catch (cause) { if (isNumericalError(cause)) throw cause; throw new XYNumericalSketchError('COMPILATION', 'Native construction refused', '$', cause); }
}
export function solveXYNumericalSketch(document: XYNumericalSketchDocumentV0): XYNumericalSketchResult {
  try { return buildXYNumericalSketch(document); }
  catch (cause) { const e = isNumericalError(cause) ? cause : new XYNumericalSketchError('INVALID_DOCUMENT', 'Sketch refused'); return { ok: false, diagnostics: [{ code: e.code, message: e.message, path: e.path }] }; }
}
/**
 * The solved points and the solver's report only — no native curve model (whose source is bounded to 16
 * geometry declarations) — for sketchers that need positions, including -v1 sketches of up to 64 points.
 */
export interface XYNumericalSketchPointsSuccess { ok: true; document: XYNumericalSketchDocumentV0; solution: { points: XYNumericalSketchPoint[] }; report: XYNumericalSketchReport }
export function solveXYNumericalSketchPoints(document: XYNumericalSketchDocumentV0): XYNumericalSketchPointsSuccess | { ok: false; diagnostics: XYNumericalSketchDiagnostic[] } {
  try {
    const admitted = admit(document), { points, report } = solve(admitted);
    return copyCadData({ ok: true as const, document: admitted, solution: { points }, report });
  } catch (cause) { const e = isNumericalError(cause) ? cause : new XYNumericalSketchError('INVALID_DOCUMENT', 'Sketch refused'); return { ok: false, diagnostics: [{ code: e.code, message: e.message, path: e.path }] }; }
}
/** Complete deterministic reconstruction proves self-consistency only, never provenance/authenticity. */
export function validateXYNumericalSketch(input: XYNumericalSketchSuccess): XYNumericalSketchReport {
  try {
    const data = snapshot(input, true) as XYNumericalSketchSuccess;
    check(data !== null && typeof data === 'object' && Object.hasOwn(data, 'document'), 'OWNED', 'Complete success result required');
    const rebuilt = buildXYNumericalSketch(data.document); check(exact(data, rebuilt), 'OWNED', 'Complete result differs from deterministic native rebuild'); return copyCadData(rebuilt.report);
  } catch (cause) { if (isNumericalError(cause) && cause.code === 'OWNED') throw cause; throw new XYNumericalSketchError('OWNED', 'Complete result reconstruction refused', '$', cause); }
}
