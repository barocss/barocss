// Private full signed SAT readout (#1344): fresh raw axes; no negative-margin early return.
import type { Body, BoxShape, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add, sub, scale, dot, cross, rotate } from '../../packages/barocss-physics/src/math.js';
import { ID } from '../../packages/barocss-physics/src/limits.js';
import { error } from '../../packages/barocss-physics/src/validation.js';

export const FEATURE_INPUT_MESSAGE = 'signed position reference requires admitted raw boxes';
export const AXIS_MESSAGE = 'signed position reference requires a fresh supported pre-SAT axis';
/** Reporting only. This value never participates in winner selection. */
export const DIAGNOSTIC_TIE_TOLERANCE_M = 1e-12;

export type SATFeature =
  | { kind: 'face-a'; axisA: number }
  | { kind: 'face-b'; axisB: number }
  | { kind: 'edge-cross'; axisA: number; axisB: number };

export interface SATCandidateDiagnostic {
  candidateIndex: number;
  label: string;
  feature: SATFeature;
  rawAxisLength: number;
  skippedByOriginalCutoff: boolean;
  signedDistanceM: number | null;
  overlapM: number | null;
  axis: Vec3 | null;
  orientedNormal: Vec3 | null;
  radiusAM: number | null;
  radiusBM: number | null;
}

export interface SignedSATSelection {
  normal: Vec3;
  boundM: number;
  pointM: Vec3;
  feature: SATFeature;
  label: string;
  candidateIndex: number;
  rawAxisLength: number;
  candidates: SATCandidateDiagnostic[];
  ambiguity: {
    exactMinimumCandidateIndices: number[];
    withinDiagnosticTieToleranceCandidateIndices: number[];
    skippedCandidateIndices: number[];
    diagnosticTieToleranceM: number;
    uniquePhysicalFeatureClaimed: false;
  };
}

function denseFinite(value: unknown, size: number, bound: number): value is number[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && value.length === size && Reflect.ownKeys(value).length === size + 1
    && Array.from({length: size}, (_, i) => i).every(i => Object.hasOwn(value, i)
      && typeof value[i] === 'number' && Number.isFinite(value[i]) && Math.abs(value[i]) <= bound);
}
/** Metadata is originally parsed by the archive adapter; this guards query raw geometry. */
function admittedRawBox(body: Body): boolean {
  return body !== null && typeof body === 'object' && typeof body.id === 'string' && ID.test(body.id)
    && (body.kind === 'dynamic' || body.kind === 'static') && body.shape?.kind === 'box'
    && denseFinite(body.shape.halfExtentsM, 3, 1000) && body.shape.halfExtentsM.every(v => v >= .0001)
    && denseFinite(body.positionM, 3, 10000) && denseFinite(body.velocityMps, 3, 1000)
    && denseFinite(body.angularVelocityRadps, 3, 1000) && denseFinite(body.orientation, 4, 1)
    && Math.abs(Math.hypot(...body.orientation) - 1) <= 1e-9
    && typeof body.inverseMass === 'number' && Number.isFinite(body.inverseMass)
    && (body.kind === 'static' ? body.inverseMass === 0 : body.inverseMass >= 1e-6 && body.inverseMass <= 1e6);
}

function boxAxes(body: Body): Vec3[] {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis as Vec3));
}

/** Preserve the original fresh basis, support threshold and reduction order. */
function boxSupport(body: Body, direction: Vec3): Vec3 {
  const axes = boxAxes(body);
  const extents = (body.shape as BoxShape).halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) => {
    const projection = dot(axis, direction);
    const offset = Math.abs(projection) <= 1e-12 ? 0
      : projection > 0 ? extents[index] : -extents[index];
    return add(result, scale(axis, offset));
  }, [0, 0, 0] as Vec3));
}

function featureAt(candidateIndex: number): SATFeature {
  if (candidateIndex < 3) return { kind: 'face-a', axisA: candidateIndex };
  if (candidateIndex < 6) return { kind: 'face-b', axisB: candidateIndex - 3 };
  const crossIndex = candidateIndex - 6;
  return { kind: 'edge-cross', axisA: Math.floor(crossIndex / 3), axisB: crossIndex % 3 };
}

function featureLabel(feature: SATFeature): string {
  if (feature.kind === 'face-a') return `A.face.${feature.axisA}`;
  if (feature.kind === 'face-b') return `B.face.${feature.axisB}`;
  return `A.edge.${feature.axisA}xB.edge.${feature.axisB}`;
}

/**
 * Inputs have already passed the original finite/quaternion/box admission.
 * Mirror boxBox's 15-axis order and strict minimum; continue after separation. No preferred face,
 * tie repair, new separation epsilon or normalized quaternion is introduced.
 * Caller-owned bodies and vectors are read only; output contains no references.
 */
export function inspectSignedBoxSAT(a: Body, b: Body): SignedSATSelection {
  if (!admittedRawBox(a) || !admittedRawBox(b)) {
    error('INVALID_CONFIG', FEATURE_INPUT_MESSAGE);
  }
  const axesA = boxAxes(a), axesB = boxAxes(b);
  const extentA = (a.shape as BoxShape).halfExtentsM, extentB = (b.shape as BoxShape).halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis: Vec3 = [1, 0, 0], bestOverlap = Infinity;
  let bestCandidateIndex = 0, bestRawLength = 0;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  const diagnostics: SATCandidateDiagnostic[] = [];
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const length = Math.hypot(...candidate);
    const feature = featureAt(candidateIndex);
    const diagnostic: SATCandidateDiagnostic = {
      candidateIndex, label: featureLabel(feature), feature, rawAxisLength: length,
      skippedByOriginalCutoff: length < 1e-12, signedDistanceM: null, overlapM: null,
      axis: null, orientedNormal: null, radiusAM: null, radiusBM: null,
    };
    diagnostics.push(diagnostic);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis, index) => sum + extentA[index] * Math.abs(dot(basis, axis)), 0);
    const radiusB = axesB.reduce((sum, basis, index) => sum + extentB[index] * Math.abs(dot(basis, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    diagnostic.signedDistanceM = signedDistance;
    diagnostic.overlapM = overlap;
    diagnostic.axis = [...axis] as Vec3;
    diagnostic.orientedNormal = scale(axis, signedDistance < 0 ? -1 : 1);
    diagnostic.radiusAM = radiusA; diagnostic.radiusBM = radiusB;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
      bestCandidateIndex = candidateIndex;
      bestRawLength = length;
    }
  }
  if (!Number.isFinite(bestOverlap) || !Number.isFinite(bestRawLength) || bestRawLength < 1e-12) error('NUMERIC_LIMIT', AXIS_MESSAGE);
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
  const pointM = scale(add(aPoint, bPoint), 0.5);
  const feature = featureAt(bestCandidateIndex);
  return {
    normal: [...bestAxis] as Vec3, boundM: bestOverlap, pointM: [...pointM] as Vec3,
    feature, label: featureLabel(feature), candidateIndex: bestCandidateIndex, rawAxisLength: bestRawLength,
    candidates: diagnostics,
    ambiguity: {
      exactMinimumCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null
        && candidate.overlapM === bestOverlap).map((candidate) => candidate.candidateIndex),
      withinDiagnosticTieToleranceCandidateIndices: diagnostics.filter((candidate) => candidate.overlapM !== null
        && Math.abs(candidate.overlapM - bestOverlap) <= DIAGNOSTIC_TIE_TOLERANCE_M).map((candidate) => candidate.candidateIndex),
      skippedCandidateIndices: diagnostics.filter((candidate) => candidate.skippedByOriginalCutoff)
        .map((candidate) => candidate.candidateIndex),
      diagnosticTieToleranceM: DIAGNOSTIC_TIE_TOLERANCE_M,
      uniquePhysicalFeatureClaimed: false,
    },
  };
}
