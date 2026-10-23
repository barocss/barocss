import { compileCadModel } from './model-compiler.js';
import type { CadModelIR1 } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model } from './types.js';
import type { XYPoint } from './xy-profile.js';
import { admit, check, exact, isAffineError, snapshot, solve, XYAffineSketchError } from './xy-affine-sketch-internal.js';
export { XYAffineSketchError, XYAffineSketchDiagnosticCode } from './xy-affine-sketch-internal.js';
import type { XYAffineSketchDiagnosticCode } from './xy-affine-sketch-internal.js';

export interface XYAffineSketchPoint { id: string; position: XYPoint }
export interface XYAffineSketchSegment { id: string; startPointId: string; endPointId: string }
/** Authored constant; neither anchor nor direction is a solved variable. */
export interface XYAffineSketchReferenceLine { id: string; anchor: XYPoint; direction: XYPoint }
export type XYAffineSketchConstraint =
  | { id: string; kind: 'fixed'; pointId: string; target: XYPoint }
  | { id: string; kind: 'coincident'; pointA: string; pointB: string }
  | { id: string; kind: 'horizontal' | 'vertical'; segmentId: string }
  | { id: string; kind: 'midpoint'; midpointId: string; pointA: string; pointB: string }
  | { id: string; kind: 'point-on-authored-line'; pointId: string; referenceLineId: string }
  | { id: string; kind: 'segment-parallel-to-fixed-direction'; segmentId: string; referenceLineId: string };
export interface XYAffineSketchDocumentV0 {
  format: 'barocss-xy-affine-sketch'; version: 0; profile: 'exact-affine-binary64'; id: string; lengthUnit: 'mm';
  points: XYAffineSketchPoint[]; segments: XYAffineSketchSegment[];
  referenceLines: XYAffineSketchReferenceLine[]; constraints: XYAffineSketchConstraint[];
}
export interface XYAffineSketchCoordinate { pointId: string; axis: 'x' | 'y' }
export interface XYAffineSketchDiagnostic {
  code: XYAffineSketchDiagnosticCode; message: string; path: string; constraintIds: string[];
  coordinate: XYAffineSketchCoordinate | null; exactFraction: { numerator: string; denominator: string } | null;
}
export interface XYAffineSketchReport {
  rank: number; degreesOfFreedom: number; fullyConstrained: boolean; equationCount: number; unknownCount: number;
  redundantConstraintIds: string[]; pivotCoordinates: XYAffineSketchCoordinate[]; freeCoordinates: XYAffineSketchCoordinate[];
  rationalWork: { operations: number; gcdSteps: number; floatSearchSteps: number; floatConversions: number; maximumObservedBits: number };
  quality: { arithmetic: 'exact-represented-binary64-rationals'; coordinateConversion: 'exact-or-refuse';
    freeVariables: 'authored-seeds-in-point-xy-order'; pivotOrder: 'leftmost-in-authored-equation-order';
    redundancy: 'chronological-zero-rank-increase'; conflictProvenance: 'chronological-nonminimal-contributing-union';
    referenceLines: 'immutable-authored-constants'; sourceFrame: 'authored-xy-z-zero'; directionUnit: 'dimensionless';
    ownership: 'copied-cpu-data-gc-no-renderer-resources'; topologyCertified: false; solid: false; manufacturingToleranceCertified: false };
  limits: { points: 16; segments: 8; referenceLines: 8; constraints: 32; scalarEquations: 64; unknowns: 32;
    coordinateAbsMM: 10000; directionAbs: 10000; minimumSegmentMM: 0.001;
    rationalOperations: 200000; gcdSteps: 200000; integerBits: 8192; floatSearchIterations: 64 };
}
export interface XYAffineSketchSuccess {
  ok: true; document: XYAffineSketchDocumentV0;
  solution: { points: XYAffineSketchPoint[]; source: string; sourceVersion: 0; model: Model; ir: CadModelIR1 };
  report: XYAffineSketchReport;
}
export type XYAffineSketchResult = XYAffineSketchSuccess | { ok: false; diagnostics: XYAffineSketchDiagnostic[] };

/** Build only after all exact coordinates and equations have passed atomic admission. */
export function buildXYAffineSketch(input: XYAffineSketchDocumentV0): XYAffineSketchSuccess {
  try {
    const document = admit(input), { points, report } = solve(document), positions = new Map(points.map(p => [p.id, p.position]));
    // Preflight every native segment before any source compilation.
    for (const [i, segment] of document.segments.entries()) {
      const a = positions.get(segment.startPointId)!, b = positions.get(segment.endPointId)!;
      check(Math.hypot(b[0] - a[0], b[1] - a[1]) >= .001, 'DEGENERATE_GEOMETRY', 'Solved segment #' + segment.id + ' is shorter than 0.001 mm', '$.segments[' + i + ']');
    }
    const curves: Curve[] = document.segments.map(segment => ({ kind: 'curve', id: segment.id, degree: 1,
      knots: [0, 0, 1, 1], controlPoints: [positions.get(segment.startPointId)!, positions.get(segment.endPointId)!].map(p => [p[0], p[1], 0]), weights: [1, 1] }));
    const decimal = (n: number) => curveDecimal(n, 'XY affine sketch');
    const source = '@model ' + document.id + ' { version:0; length-unit:mm; ' + curves.map(curve => '@curve #' + curve.id
      + ' { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[' + curve.controlPoints.map(p => '[' + p.map(decimal).join(',') + ']').join(',')
      + ']; weights:[1,1]; }').join(' ') + ' }\n';
    check(source.length <= 262144, 'LIMIT', 'Native source exceeds bounded text', '$.solution.source');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'COMPILATION', 'Actual native line source must compile', '$.solution.source');
    check(compiled.ir.schemaVersion === 1 && exact(compiled.model.objects, curves), 'COMPILATION', 'Actual native line identities and coefficients must match solved coordinates', '$.solution.model');
    return copyCadData({ ok: true, document, solution: { points, source, sourceVersion: 0, model: compiled.model, ir: compiled.ir }, report });
  } catch (cause) {
    if (isAffineError(cause)) throw cause;
    throw new XYAffineSketchError('COMPILATION', 'Native construction refused', '$', [], null, null, cause);
  }
}

/** An atomic failure has diagnostics only, with no partial document or geometry. */
export function solveXYAffineSketch(document: XYAffineSketchDocumentV0): XYAffineSketchResult {
  try { return buildXYAffineSketch(document); }
  catch (cause) {
    const error = isAffineError(cause) ? cause : new XYAffineSketchError('INVALID_DOCUMENT', 'Sketch refused');
    return { ok: false, diagnostics: [copyCadData({ code: error.code, message: error.message, path: error.path,
      constraintIds: error.constraintIds, coordinate: error.coordinate, exactFraction: error.exactFraction })] };
  }
}

/** Whole-result reconstruction, not a report-only or source-only validity check. */
export function validateXYAffineSketch(input: XYAffineSketchSuccess): XYAffineSketchReport {
  try {
    const data = snapshot(input, true) as XYAffineSketchSuccess;
    check(data !== null && typeof data === 'object' && Object.hasOwn(data, 'document'), 'OWNED', 'Complete owned success result required');
    const rebuilt = buildXYAffineSketch(data.document);
    check(exact(data, rebuilt), 'OWNED', 'Complete result differs from deterministic native rebuild');
    return copyCadData(rebuilt.report);
  } catch (cause) {
    if (isAffineError(cause) && cause.code === 'OWNED') throw cause;
    throw new XYAffineSketchError('OWNED', 'Complete owned result rebuild refused', '$', [], null, null, cause);
  }
}
