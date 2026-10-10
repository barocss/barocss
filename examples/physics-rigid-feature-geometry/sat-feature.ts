// Private original-SAT selector frozen for geometry qualification (#1233).
import type { Body, BoxShape, Hit, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add, sub, scale, dot, cross, rotate } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';

export const FEATURE_INPUT_MESSAGE = 'private feature geometry requires two admitted boxes';
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
}

export interface SATFeatureSelection {
  /** Bit-preserved original boxBox hit arithmetic, with detached vectors. */
  hit: Hit;
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
 * Mirror boxBox's 15-axis order and strict minimum exactly. No preferred face,
 * tie repair, new separation epsilon or normalized quaternion is introduced.
 * Caller-owned bodies and vectors are read only; output contains no references.
 */
export function selectBoxSATFeature(a: Body, b: Body): SATFeatureSelection | null {
  if (a.shape.kind !== 'box' || b.shape.kind !== 'box') {
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
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = scale(axis, signedDistance < 0 ? -1 : 1);
      bestCandidateIndex = candidateIndex;
      bestRawLength = length;
    }
  }
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
  const originalHit: Hit = {
    normal: bestAxis, penetration: Math.max(0, bestOverlap),
    pointM: scale(add(aPoint, bPoint), 0.5),
  };
  const feature = featureAt(bestCandidateIndex);
  return {
    hit: { normal: [...originalHit.normal] as Vec3, penetration: originalHit.penetration,
      pointM: [...originalHit.pointM] as Vec3 },
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
