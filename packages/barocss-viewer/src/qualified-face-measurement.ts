import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from '@barocss/cad';
import type { Curve, Surface } from '@barocss/cad';
import type { QualifiedFaceSceneV0 } from '@barocss/gpu';

interface QualifiedFacePointPin {
  sourceId: string;
  expectedSource: string;
  faceId: string;
  modelId: string;
  geometryId: string;
}
export type ViewerQualifiedFacePointInput =
  | (QualifiedFacePointPin & { kind: 'surface'; u: number; v: number })
  | (QualifiedFacePointPin & { kind: 'curve'; t: number });
export type ViewerQualifiedFacePoint = ViewerQualifiedFacePointInput & {
  pointMM: [number, number, number];
  pointScene: [number, number, number];
};
export interface ViewerQualifiedFacePointDistance {
  first: ViewerQualifiedFacePoint;
  second: ViewerQualifiedFacePoint;
  distanceMM: number;
  distanceScene: number;
  metric: 'straight-chord';
  basis: 'authored-xyz-matches-rhyup';
  certification: 'not-certified';
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Qualified Face measurement: ' + message);
}
function nativeMath<T>(action: () => T): T {
  try { return action(); }
  catch (cause) { throw new RangeError('Qualified Face measurement: original native math refused', { cause }); }
}
function parsePoint(input: unknown): ViewerQualifiedFacePointInput {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'point input must be plain own data');
  const kind = Object.getOwnPropertyDescriptor(input, 'kind');
  check(kind && kind.enumerable && 'value' in kind && (kind.value === 'surface' || kind.value === 'curve'),
    'point kind must be own surface or curve data');
  const fields = ['kind', 'sourceId', 'expectedSource', 'faceId', 'modelId', 'geometryId',
    ...(kind.value === 'surface' ? ['u', 'v'] : ['t'])];
  const keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)),
    'point input has missing or unsupported fields');
  const data: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && descriptor.enumerable && 'value' in descriptor, key + ' must be own data');
    data[key] = descriptor.value;
  }
  for (const key of ['sourceId', 'faceId', 'modelId', 'geometryId']) {
    const value = data[key], maximum = key === 'sourceId' ? 48 : 128;
    check(typeof value === 'string' && value.length >= 1 && value.length <= maximum, key + ' length is invalid');
  }
  check(typeof data.expectedSource === 'string' && data.expectedSource.length >= 1
    && data.expectedSource.length <= 65536 && new TextEncoder().encode(data.expectedSource).length <= 65536,
  'expectedSource must contain1..65536UTF8bytes');
  for (const key of kind.value === 'surface' ? ['u', 'v'] : ['t'])
    check(typeof data[key] === 'number' && Number.isFinite(data[key]), key + ' must be a finite binary64 number');
  // Accessors have already refused. A Proxy is not a supported own-data request.
  try { structuredClone(input); }
  catch (cause) { throw new RangeError('Qualified Face measurement: point input cannot be copied', { cause }); }
  return data as unknown as ViewerQualifiedFacePointInput;
}
function resolve(scene: QualifiedFaceSceneV0, input: ViewerQualifiedFacePointInput): Curve | Surface {
  const asset = scene.assets.find(value => value.sourceId === input.sourceId);
  check(asset, 'sourceId is not in the current qualified Face scene');
  check(asset.source === input.expectedSource, 'expectedSource differs from the current original source');
  check(asset.face.topology.face.id === input.faceId, 'faceId differs from the current original Face');
  check(asset.face.geometry.name === input.modelId, 'modelId differs from the original source Model');
  const geometry = asset.face.geometry.objects.find(value => value.id === input.geometryId && value.kind === input.kind);
  check(geometry, 'geometryId/kind does not identify original geometry in this source');
  if (input.kind === 'surface') {
    check(geometry.kind === 'surface' && input.geometryId === asset.face.topology.face.surfaceId,
      'Surface query must identify the current Face Surface');
    const domain = nativeMath(() => surfaceDomain(geometry));
    check(input.u >= domain.u[0] && input.u <= domain.u[1]
      && input.v >= domain.v[0] && input.v <= domain.v[1], 'U/V is outside the original inclusive Surface domain');
  } else {
    check(geometry.kind === 'curve', 'Curve query must identify an original Curve');
    const domain = nativeMath(() => curveDomain(geometry));
    check(input.t >= domain[0] && input.t <= domain[1], 'T is outside the original inclusive Curve domain');
  }
  return geometry;
}
function evaluate(scene: QualifiedFaceSceneV0, input: ViewerQualifiedFacePointInput,
  geometry: Curve | Surface): ViewerQualifiedFacePoint {
  const point = nativeMath(() => {
    if (input.kind === 'surface' && geometry.kind === 'surface') return evaluateSurface(geometry, input.u, input.v);
    check(input.kind === 'curve' && geometry.kind === 'curve', 'resolved geometry kind changed');
    return evaluateCurve(geometry, input.t);
  });
  const pointMM: [number, number, number] = [...point];
  check(pointMM.every(Number.isFinite), 'evaluated native point is not finite');
  const pointScene = pointMM.map((value, axis) =>
    value * scene.mmToSceneUnit + scene.translate[axis]) as [number, number, number];
  check(pointScene.every(Number.isFinite), 'converted scene point is not finite');
  return { ...input, pointMM, pointScene };
}

/** No scene mutation, source compilation, GPU call or measurement cache. */
export function measureViewerQualifiedFacePoints(scene: QualifiedFaceSceneV0,
  firstInput: unknown, secondInput: unknown): ViewerQualifiedFacePointDistance {
  const first = parsePoint(firstInput), second = parsePoint(secondInput);
  const firstGeometry = resolve(scene, first), secondGeometry = resolve(scene, second);
  const firstPoint = evaluate(scene, first, firstGeometry), secondPoint = evaluate(scene, second, secondGeometry);
  const distanceMM = Math.hypot(...firstPoint.pointMM.map((value, axis) => value - secondPoint.pointMM[axis]));
  const distanceScene = distanceMM * scene.mmToSceneUnit;
  check(Number.isFinite(distanceMM) && Number.isFinite(distanceScene), 'native or scene chord distance is not finite');
  return { first: firstPoint, second: secondPoint, distanceMM, distanceScene,
    metric: 'straight-chord', basis: 'authored-xyz-matches-rhyup', certification: 'not-certified' };
}
