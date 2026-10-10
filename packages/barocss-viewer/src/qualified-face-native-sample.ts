import type { QualifiedFaceSceneV0 } from '@barocss/gpu';
import { pickViewerQualifiedFaceCandidate } from './qualified-face-pick.js';
import type { ViewerQualifiedFacePick } from './qualified-face-pick.js';
import { evaluateViewerQualifiedFacePoint } from './qualified-face-measurement.js';
import type { ViewerQualifiedFacePoint } from './qualified-face-measurement.js';

export interface ViewerQualifiedFaceNativeSample {
  version: 0;
  pick: ViewerQualifiedFacePick;
  parameters: {
    u: number;
    v: number;
    approximate: true;
    method: 'display-triangle-barycentric';
  };
  nativePoint: ViewerQualifiedFacePoint;
  displayToNativeDistanceScene: number;
  certification: 'not-certified';
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer qualified Face sample: ' + message);
}
function finite(value: number): number {
  check(Number.isFinite(value), 'numeric intermediate is not finite'); return value;
}

/** Fresh original evaluation at approximate display parameters, not an original native ray hit. */
export function sampleViewerQualifiedFace(scene: QualifiedFaceSceneV0, input: unknown,
  backingWidth: number, backingHeight: number, cssWidth: number,
  cssHeight: number): ViewerQualifiedFaceNativeSample | null {
  const candidate = pickViewerQualifiedFaceCandidate(scene, input,
    backingWidth, backingHeight, cssWidth, cssHeight);
  if (!candidate) return null;
  const weights = candidate.barycentric, pairs = candidate.triangleParameters;
  check(weights.every(value => Number.isFinite(value) && value >= 0), 'barycentric weights must be finite and nonnegative');
  finite(finite(weights[0] + weights[1]) + weights[2]);
  const vertex = weights.findIndex((value, index) => value === 1
    && weights.every((other, otherIndex) => otherIndex === index || other === 0));
  const interpolate = (axis: number): number => finite(finite(finite(weights[0] * pairs[0][axis])
    + finite(weights[1] * pairs[1][axis])) + finite(weights[2] * pairs[2][axis]));
  const u = vertex >= 0 ? pairs[vertex][0] : interpolate(0);
  const v = vertex >= 0 ? pairs[vertex][1] : interpolate(1);
  const ref = candidate.pick.ref;
  const nativePoint = evaluateViewerQualifiedFacePoint(candidate.scene, { kind: 'surface',
    sourceId: ref.sourceId, expectedSource: ref.expectedSource, faceId: ref.faceId, modelId: ref.modelId,
    geometryId: ref.surfaceId, u, v });
  const displayToNativeDistanceScene = finite(Math.hypot(...nativePoint.pointScene.map((value, axis) =>
    finite(value - candidate.pick.displayPositionScene[axis]))));
  const result: ViewerQualifiedFaceNativeSample = { version: 0, pick: candidate.pick,
    parameters: { u, v, approximate: true, method: 'display-triangle-barycentric' }, nativePoint,
    displayToNativeDistanceScene, certification: 'not-certified' };
  return structuredClone(result);
}
