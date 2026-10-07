import type { XYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
import { curveDomain, evaluateCurve } from './math.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { constructPlaneCylinderCandidate, constructPlaneCylinderBindings, adopt, observe, snapshot, check, same } from './own-plane-cylinder-intersection-internal.js';

export interface XYCirclePrismPlaneIntersectionOptions {
  curveId: string; planeId: string; planePcurveId: string; wallPcurveId: string;
  evaluationId: string; slopeX: number; slopeY: number; zInterceptMM: number;
}
export interface XYCirclePrismPlaneBindings {
  coordinateSystem: 'uv'; domain: [number, number]; evaluationId: string;
  plane: { surfaceId: string; curve: Curve }; wall: { surfaceId: string; curve: Curve };
}
export type PlaneCylinderCurveD1State = { status: 'evaluated'; value: CurveD1Result } | { status: 'native-refused'; reason: string };
export type PlaneCylinderSurfaceD1State = { status: 'evaluated'; value: SurfaceD1Result } | { status: 'native-refused'; reason: string };
export interface PlaneCylinderIntersectionObservation {
  parameter: number; pointMM: Point; planeUV: Point; wallUV: Point;
  planePointMM: Point; wallPointMM: Point; planeResidualMM: number; wallResidualMM: number; wallParameterResidual: number;
  d1: { section: PlaneCylinderCurveD1State; planePcurve: PlaneCylinderCurveD1State; wallPcurve: PlaneCylinderCurveD1State;
    planeSurface: PlaneCylinderSurfaceD1State; wallSurface: PlaneCylinderSurfaceD1State;
    mappedPlaneTangent?: Point; mappedWallTangent?: Point; planeTangentResidual?: number; wallTangentResidual?: number };
}
export interface PlaneCylinderHomogeneousSpan {
  domain: [number, number]; originalPoleIndices: [number, number, number]; outputPoleIndices: [number, number, number, number];
  denominatorCoefficients: number[]; uNumeratorCoefficients: number[]; vNumeratorCoefficients: number[];
}
export interface XYCirclePrismPlaneIntersectionReport {
  family: 'own-transverse-affine-plane-circle-cylinder'; classification: 'full-closed-section' | 'control-hull-disjoint-above' | 'control-hull-disjoint-below';
  evaluationId: string; sourceCircleId: string; wallSurfaceId: string; planeSurfaceId: string;
  axialControlHullMM: [number, number]; axialWallDomainMM: [number, number]; hullSemantics: 'positive-weight-native-section-control-hull-sufficient-bound';
  originalDomain: [number, number]; planeSupportMM: { minXY: [number, number]; maxXY: [number, number]; representedSpansMM: [number, number] };
  homogeneousSpans: PlaneCylinderHomogeneousSpan[]; observations: PlaneCylinderIntersectionObservation[];
  seam?: { startXYZ: Point; endXYZ: Point; startWallUV: Point; endWallUV: Point; closed: true; distinctUVEndpoints: true };
  periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { slopes: [number, number]; interceptMM: [number, number]; nativeResidualObservationMM: number; wallParameterObservation: number; snapshotValues: number; snapshotDepth: number };
}
interface PlaneCylinderResultBase {
  shell: XYCirclePrismShellBundle; options: XYCirclePrismPlaneIntersectionOptions; plane: Surface; wallSurface: Surface;
  source: string; sourceVersion: 0; model: Model; report: XYCirclePrismPlaneIntersectionReport;
}
export interface XYCirclePrismPlaneSection extends PlaneCylinderResultBase { kind: 'intersection'; curve: Curve; bindings: XYCirclePrismPlaneBindings }
export interface XYCirclePrismPlaneDisjoint extends PlaneCylinderResultBase { kind: 'disjoint' }
export type XYCirclePrismPlaneIntersectionResult = XYCirclePrismPlaneSection | XYCirclePrismPlaneDisjoint;
/** Supported full interior sections only. Mixed/touching hull bounds never imply disjointness. */
export function intersectXYCirclePrismWallWithPlane(input: XYCirclePrismShellBundle, inputOptions: XYCirclePrismPlaneIntersectionOptions): XYCirclePrismPlaneIntersectionResult {
  const candidate = constructPlaneCylinderCandidate(input,inputOptions);
  const {shell,options:opt,sourceCircle,section,plane,wallSurface:wall}=candidate,h=shell.construction.heightMM,[min,max]=candidate.axialControlHullMM;
  const classification = min > h ? 'control-hull-disjoint-above' : max < 0 ? 'control-hull-disjoint-below' : min > 0 && max < h ? 'full-closed-section' : null;
  check(classification !== null, 'unsupported touching/mixed/partial axial control hull; no full-section or disjoint proof');
  const report: XYCirclePrismPlaneIntersectionReport = { family: 'own-transverse-affine-plane-circle-cylinder', classification, evaluationId: opt.evaluationId, sourceCircleId: sourceCircle.id, wallSurfaceId: wall.id, planeSurfaceId: plane.id,
    axialControlHullMM: [min,max], axialWallDomainMM: [0,h], hullSemantics: 'positive-weight-native-section-control-hull-sufficient-bound', originalDomain: curveDomain(sourceCircle), planeSupportMM: candidate.planeSupportMM, homogeneousSpans: [], observations: [],
    periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false, limits: { slopes: [-1,1], interceptMM: [-10000,10000], nativeResidualObservationMM: 1e-7, wallParameterObservation: 1e-12, snapshotValues: 131072, snapshotDepth: 24 } };
  if (classification !== 'full-closed-section') { const adopted = adopt({ name: opt.planeId, version: 0, lengthUnit: 'mm', objects: [plane,wall] }); return copyCadData({ kind: 'disjoint', shell, options: opt, plane, wallSurface: wall, ...adopted, sourceVersion: 0, report }); }
  const {bindings,homogeneousSpans}=constructPlaneCylinderBindings(candidate);
  report.homogeneousSpans = homogeneousSpans; report.observations = observe(section,plane,wall,bindings);
  const start = evaluateCurve(section,0), end = evaluateCurve(section,4), uv0 = evaluateCurve(bindings.wall.curve,0), uv4 = evaluateCurve(bindings.wall.curve,4); check(same(start,end) && uv0[0] === 0 && uv4[0] === 4 && uv0[1] === uv4[1], 'closed native XYZ seam requires distinct0/4 wall UV endpoints');
  report.seam = { startXYZ: start, endXYZ: end, startWallUV: uv0, endWallUV: uv4, closed: true, distinctUVEndpoints: true };
  const adopted = adopt({ name: opt.planeId, version: 0, lengthUnit: 'mm', objects: [section,plane,wall] });
  return copyCadData({ kind: 'intersection', shell, options: opt, curve: adopted.model.objects[0] as Curve, plane: adopted.model.objects[1] as Surface, wallSurface: adopted.model.objects[2] as Surface, bindings, ...adopted, sourceVersion: 0, report });
}
/** Reconstruct the bounded native result; reject altered UV, geometry, context, source or report data. */
export function validateXYCirclePrismPlaneIntersection(input: XYCirclePrismPlaneIntersectionResult): XYCirclePrismPlaneIntersectionReport {
  const owned = snapshot(input) as XYCirclePrismPlaneIntersectionResult;
  check(owned !== null && typeof owned === 'object' && !Array.isArray(owned) && (owned.kind === 'intersection' || owned.kind === 'disjoint'), 'native intersection/disjoint result required');
  const expected = intersectXYCirclePrismWallWithPlane(owned.shell,owned.options); check(same(owned,expected), 'owned native geometry/dual-UV binding/context/source/report mismatch'); return copyCadData(expected.report);
}
