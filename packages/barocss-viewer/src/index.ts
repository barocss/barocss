import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from '@barocss/cad';
import type { AdaptiveCurveSamplingResult } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadNativeResult } from '@barocss/cad-interop/native';
import { mountMeshScene, mountPrimitiveScene, PrimitiveSceneRenderer, prepareMesh,
  validateMeshCamera, validatePreviewPacket } from '@barocss/gpu';
import type { MeshCamera, PreviewPacket } from '@barocss/gpu';
import { MOTION_LIMITS } from '@barocss/motion';
import type { MotionFrame } from '@barocss/motion';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export interface ViewerOptions { mmToSceneUnit: number; background: Vec3 }
export interface NativeLoadOptions { sourceVersion: 0; countU: number; countV: number }
export interface ViewerNativeCurveLoadOptions extends NativeLoadOptions {
  curveDisplay: { chordToleranceMM: number; maxSegments: number; maxDepth: number };
}
export interface ViewerRef { modelId: string; surfaceId: string }
export type ViewerGeometryRef =
  | ({ kind: 'surface' } & ViewerRef)
  | ({ kind: 'curve' } & ViewerCurveRef);
export interface ViewerPacket { modelId: string; packet: PreviewPacket }
export interface ViewerNativeSurfaceParameter extends ViewerRef { u: number; v: number }
export interface ViewerNativeSurfacePoint {
  ref: ViewerRef;
  u: number;
  v: number;
  pointMM: Vec3;
}
export interface ViewerNativeSurfaceMeasurement {
  first: ViewerNativeSurfacePoint;
  second: ViewerNativeSurfacePoint;
  distanceMM: number;
  space: 'native-authored';
  certification: 'not-certified';
}
export interface ViewerMotionBinding { contextId: string; targetId: string; ref: ViewerRef }
export interface ViewerDisplayPose { ref: ViewerRef; translationMm: Vec3; rotationXYZW: Quat; scale: Vec3 }
export interface ViewerMotionState {
  basis: 'part-xyz-matches-rhyup';
  frame: MotionFrame;
  bindings: ViewerMotionBinding[];
  displayPoses: ViewerDisplayPose[];
}
export interface ViewerGeometryMotionBinding { contextId: string; targetId: string; ref: ViewerGeometryRef }
export interface ViewerGeometryDisplayPose {
  ref: ViewerGeometryRef; translationMm: Vec3; rotationXYZW: Quat; scale: Vec3
}
export interface ViewerGeometryMotionState {
  basis: 'part-xyz-matches-rhyup';
  frame: MotionFrame;
  bindings: ViewerGeometryMotionBinding[];
  displayPoses: ViewerGeometryDisplayPose[];
}
export interface ViewerCurveRef { modelId: string; curveId: string }
export interface ViewerNativeCurveParameter extends ViewerCurveRef { t: number }
export interface ViewerNativeCurvePoint { ref: ViewerCurveRef; t: number; pointMM: Vec3 }
export interface ViewerNativeCurveMeasurement {
  first: ViewerNativeCurvePoint;
  second: ViewerNativeCurvePoint;
  distanceMM: number;
  metric: 'straight-chord';
  space: 'native-authored';
  certification: 'not-certified';
}
export interface ViewerNativeSurfaceCurveMeasurement {
  surface: ViewerNativeSurfacePoint;
  curve: ViewerNativeCurvePoint;
  distanceMM: number;
  metric: 'straight-line';
  space: 'native-authored';
  certification: 'not-certified';
}
export type ViewerNativePointInput =
  | ({ kind: 'surface' } & ViewerNativeSurfaceParameter)
  | ({ kind: 'curve' } & ViewerNativeCurveParameter);
export type ViewerNativePoint =
  | ({ kind: 'surface' } & ViewerNativeSurfacePoint)
  | ({ kind: 'curve' } & ViewerNativeCurvePoint);
export interface ViewerNativePointDistance {
  first: ViewerNativePoint;
  second: ViewerNativePoint;
  distanceMM: number;
  metric: 'straight-line';
  space: 'native-authored';
  certification: 'not-certified';
}
export interface ViewerPick {
  ref: ViewerRef;
  triangleIndex: number;
  distanceScene: number;
  positionScene: Vec3;
  parameterUV: [number, number];
  approximate: true;
  ambiguous: boolean;
}
export interface ViewerGeometryPoint { xCss: number; yCss: number }
export type ViewerGeometryPick =
  | ({ kind: 'surface' } & ViewerPick)
  | { kind: 'curve'; ref: ViewerCurveRef; segmentIndex: number;
      parameterInterval: [number, number]; parameterApprox: number;
      displayPositionScene: Vec3; nativePointMM: Vec3; depthScene: number;
      screenDistancePx: number; approximate: true; ambiguous: boolean };
export interface ViewerState {
  status: 'empty' | 'ready' | 'context-lost' | 'disposed';
  frame: 'right-handed-y-up';
  sourceUnit: 'mm';
  mmToSceneUnit: number;
  camera: MeshCamera;
  surfaces: ViewerRef[];
  curves: ViewerCurveRef[];
  packets: ViewerPacket[];
  selected: ViewerRef | null;
  selectedGeometry: ViewerGeometryRef | null;
  native: BaroCadNativeResult | null;
  measurement: ViewerNativeSurfaceMeasurement | null;
  motion: ViewerMotionState | null;
  geometryMotion: ViewerGeometryMotionState | null;
  curveMeasurement: ViewerNativeCurveMeasurement | null;
  surfaceCurveMeasurement: ViewerNativeSurfaceCurveMeasurement | null;
  nativeMeasurement: ViewerNativePointDistance | null;
}

const PALETTE: Vec3[] = [[0.14, 0.58, 0.86], [0.95, 0.57, 0.22], [0.36, 0.72, 0.49], [0.72, 0.48, 0.87]];
const SELECTED_COLOR: Vec3 = [1, 0.94, 0.38];
const INITIAL_CAMERA: MeshCamera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.01, far: 100 };
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const MOTION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function check(ok: unknown, message: string): asserts ok { if (!ok) throw new RangeError(message); }
function ownRecord(input: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    `${label} must be plain data`);
  const actual = Reflect.ownKeys(input);
  check(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)),
    `${label} has missing or unsupported fields`);
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && descriptor.enumerable && 'value' in descriptor, `${label}.${key} must be data`);
    result[key] = descriptor.value;
  }
  return result;
}
function finite(value: unknown, label: string, min: number, max: number): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${label} must be finite in ${min}..${max}`);
  return value;
}
function vector(input: unknown, label: string, min: number, max: number): Vec3 {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype && input.length === 3
    && Reflect.ownKeys(input).length === 4, `${label} must be a dense XYZ array`);
  return [0, 1, 2].map(index => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && descriptor.enumerable && 'value' in descriptor, `${label} must contain data`);
    return finite(descriptor.value, label, min, max);
  }) as Vec3;
}
function denseArray(input: unknown, length: number, label: string): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype
    && input.length === length && Reflect.ownKeys(input).length === length + 1, `${label} must be a dense array`);
  return Array.from({ length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && descriptor.enumerable && 'value' in descriptor, `${label}[${index}] must be data`);
    return descriptor.value;
  });
}
function quaternion(input: unknown): Quat {
  const values = denseArray(input, 4, 'Motion rotation').map(value => finite(value, 'Motion rotation', -1, 1)) as Quat;
  check(Math.abs(Math.hypot(...values) - 1) <= MOTION_LIMITS.quaternionNormTolerance,
    'Motion rotation must be a unit XYZW quaternion');
  return values;
}
function motionId(input: unknown, label: string): string {
  check(typeof input === 'string' && MOTION_ID.test(input), `${label} must be a bounded Motion identifier`);
  return input;
}
function parseMotionFrame(input: unknown): MotionFrame {
  const data = ownRecord(input, ['contextId', 'timeSeconds', 'poses'], 'Motion frame');
  const contextId = motionId(data.contextId, 'Motion contextId');
  const timeSeconds = finite(data.timeSeconds, 'Motion timeSeconds', 0, MOTION_LIMITS.durationSeconds);
  check(Array.isArray(data.poses) && data.poses.length >= 1 && data.poses.length <= 4,
    'Motion frame needs 1..4 poses');
  const poses = denseArray(data.poses, data.poses.length, 'Motion poses').map((inputPose, index) => {
    check(inputPose !== null && typeof inputPose === 'object' && Object.getPrototypeOf(inputPose) === Object.prototype,
      `Motion pose ${index} must be plain data`);
    const keys = Reflect.ownKeys(inputPose);
    check(keys.includes('targetId') && keys.every(key => typeof key === 'string'
      && ['targetId', 'translation', 'rotation', 'scale'].includes(key)), 'Motion pose has unsupported fields');
    const pose = ownRecord(inputPose, keys as string[], 'Motion pose');
    return { targetId: motionId(pose.targetId, 'Motion targetId'),
      ...(Object.hasOwn(pose, 'translation') ? { translation: vector(pose.translation, 'Motion translation',
        -MOTION_LIMITS.translationMm, MOTION_LIMITS.translationMm) } : {}),
      ...(Object.hasOwn(pose, 'rotation') ? { rotation: quaternion(pose.rotation) } : {}),
      ...(Object.hasOwn(pose, 'scale') ? { scale: vector(pose.scale, 'Motion scale',
        MOTION_LIMITS.scaleMin, MOTION_LIMITS.scaleMax) } : {}) };
  });
  check(new Set(poses.map(pose => pose.targetId)).size === poses.length, 'Duplicate Motion targetId');
  return { contextId, timeSeconds, poses };
}
function parseViewerOptions(input: unknown): ViewerOptions {
  const value = ownRecord(input, ['mmToSceneUnit', 'background'], 'Viewer options');
  return { mmToSceneUnit: finite(value.mmToSceneUnit, 'mmToSceneUnit', 1e-6, 1),
    background: vector(value.background, 'background', 0, 1) };
}
function parseNativeOptions(input: unknown): NativeLoadOptions | ViewerNativeCurveLoadOptions {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Native options must be plain data');
  const hasCurves = Object.hasOwn(input, 'curveDisplay');
  const value = ownRecord(input, hasCurves
    ? ['sourceVersion', 'countU', 'countV', 'curveDisplay']
    : ['sourceVersion', 'countU', 'countV'], 'Native options');
  check(value.sourceVersion === 0, 'Only sourceVersion 0 is supported');
  const countU = finite(value.countU, 'countU', 2, 17), countV = finite(value.countV, 'countV', 2, 17);
  check(Number.isInteger(countU) && Number.isInteger(countV), 'Grid counts must be integers');
  if (!hasCurves) return { sourceVersion: 0, countU, countV };
  const display = ownRecord(value.curveDisplay,
    ['chordToleranceMM', 'maxSegments', 'maxDepth'], 'Curve display options');
  const chordToleranceMM = finite(display.chordToleranceMM, 'chordToleranceMM', 1e-7, 1000);
  const maxSegments = finite(display.maxSegments, 'maxSegments', 1, 1024);
  const maxDepth = finite(display.maxDepth, 'maxDepth', 0, 16);
  check(Number.isInteger(maxSegments) && Number.isInteger(maxDepth), 'Curve display budgets must be integers');
  return { sourceVersion: 0, countU, countV,
    curveDisplay: { chordToleranceMM, maxSegments, maxDepth } };
}
function parseRef(input: unknown): ViewerRef {
  const value = ownRecord(input, ['modelId', 'surfaceId'], 'Surface reference');
  check(typeof value.modelId === 'string' && ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
  check(typeof value.surfaceId === 'string' && ID.test(value.surfaceId), 'surfaceId must be a bounded ASCII identifier');
  return { modelId: value.modelId, surfaceId: value.surfaceId };
}
function parseGeometryRef(input: unknown): ViewerGeometryRef {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Geometry reference must be plain data');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'kind');
  check(descriptor && descriptor.enumerable && 'value' in descriptor,
    'Geometry reference kind must be data');
  if (descriptor.value === 'surface') {
    const value = ownRecord(input, ['kind', 'modelId', 'surfaceId'], 'Surface geometry reference');
    return { kind: 'surface', ...parseRef({ modelId: value.modelId, surfaceId: value.surfaceId }) };
  }
  check(descriptor.value === 'curve', 'Geometry reference kind must be surface or curve');
  const value = ownRecord(input, ['kind', 'modelId', 'curveId'], 'Curve geometry reference');
  check(typeof value.modelId === 'string' && ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
  check(typeof value.curveId === 'string' && ID.test(value.curveId), 'curveId must be a bounded ASCII identifier');
  return { kind: 'curve', modelId: value.modelId, curveId: value.curveId };
}
function parseNativeParameter(input: unknown): ViewerNativeSurfaceParameter {
  const value = ownRecord(input, ['modelId', 'surfaceId', 'u', 'v'], 'Native Surface parameter');
  const ref = parseRef({ modelId: value.modelId, surfaceId: value.surfaceId });
  check(typeof value.u === 'number' && Number.isFinite(value.u)
    && typeof value.v === 'number' && Number.isFinite(value.v), 'Native U/V parameters must be finite');
  return { ...ref, u: value.u, v: value.v };
}
function parseNativeCurveParameter(input: unknown): ViewerNativeCurveParameter {
  const value = ownRecord(input, ['modelId', 'curveId', 't'], 'Native Curve parameter');
  check(typeof value.modelId === 'string' && ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
  check(typeof value.curveId === 'string' && ID.test(value.curveId), 'curveId must be a bounded ASCII identifier');
  check(typeof value.t === 'number' && Number.isFinite(value.t), 'Native Curve parameter must be finite');
  return { modelId: value.modelId, curveId: value.curveId, t: value.t };
}
function parseNativePointInput(input: unknown): ViewerNativePointInput {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Native point must be plain data');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'kind');
  check(descriptor && descriptor.enumerable && 'value' in descriptor, 'Native point kind must be data');
  if (descriptor.value === 'surface') {
    const value = ownRecord(input, ['kind', 'modelId', 'surfaceId', 'u', 'v'], 'Native Surface point');
    return { kind: 'surface', ...parseNativeParameter({
      modelId: value.modelId, surfaceId: value.surfaceId, u: value.u, v: value.v }) };
  }
  check(descriptor.value === 'curve', 'Native point kind must be surface or curve');
  const value = ownRecord(input, ['kind', 'modelId', 'curveId', 't'], 'Native Curve point');
  return { kind: 'curve', ...parseNativeCurveParameter({
    modelId: value.modelId, curveId: value.curveId, t: value.t }) };
}
function tagSurfacePoint(point: ViewerNativeSurfacePoint): ViewerNativePoint {
  return { kind: 'surface', ref: { ...point.ref }, u: point.u, v: point.v,
    pointMM: [...point.pointMM] as Vec3 };
}
function tagCurvePoint(point: ViewerNativeCurvePoint): ViewerNativePoint {
  return { kind: 'curve', ref: { ...point.ref }, t: point.t, pointMM: [...point.pointMM] as Vec3 };
}
function nativeDistance(first: ViewerNativePoint, second: ViewerNativePoint): ViewerNativePointDistance {
  const distanceMM = Math.hypot(...subtract(first.pointMM, second.pointMM));
  check(Number.isFinite(distanceMM), 'Native point distance is not finite');
  return { first, second, distanceMM, metric: 'straight-line',
    space: 'native-authored', certification: 'not-certified' };
}
function sameRef(a: ViewerRef | null, b: ViewerRef | null): boolean {
  return !!a && !!b && a.modelId === b.modelId && a.surfaceId === b.surfaceId;
}
function refKey(ref: ViewerRef): string { return `${ref.modelId}\0${ref.surfaceId}`; }
function parseMotionBindings(input: unknown, frame: MotionFrame, packets: ViewerPacket[]): ViewerMotionBinding[] {
  const bindings = denseArray(input, packets.length, 'Motion bindings').map(raw => {
    const value = ownRecord(raw, ['contextId', 'targetId', 'ref'], 'Motion binding');
    const contextId = motionId(value.contextId, 'Binding contextId');
    check(contextId === frame.contextId, 'Binding contextId differs from Motion frame');
    return { contextId, targetId: motionId(value.targetId, 'Binding targetId'), ref: parseRef(value.ref) };
  });
  const targets = new Set(bindings.map(binding => binding.targetId));
  const refs = new Set(bindings.map(binding => refKey(binding.ref)));
  check(targets.size === bindings.length && refs.size === bindings.length, 'Motion bindings must be one-to-one');
  check(frame.poses.length === bindings.length && frame.poses.every(pose => targets.has(pose.targetId)),
    'Motion frame must cover every bound target exactly once');
  check(packets.every(packet => refs.has(refKey({ modelId: packet.modelId, surfaceId: packet.packet.surfaceId }))),
    'Motion bindings must cover every Viewer surface exactly once');
  return bindings;
}
function geometryKey(ref: ViewerGeometryRef): string {
  return ref.kind === 'surface' ? `surface\0${ref.modelId}\0${ref.surfaceId}`
    : `curve\0${ref.modelId}\0${ref.curveId}`;
}
function parseGeometryMotionBindings(input: unknown, frame: MotionFrame,
  packets: ViewerPacket[], curves: ViewerCurveEntry[]): ViewerGeometryMotionBinding[] {
  const count = packets.length + curves.length;
  const bindings = denseArray(input, count, 'Geometry Motion bindings').map(raw => {
    const value = ownRecord(raw, ['contextId', 'targetId', 'ref'], 'Geometry Motion binding');
    const contextId = motionId(value.contextId, 'Binding contextId');
    check(contextId === frame.contextId, 'Binding contextId differs from Motion frame');
    return { contextId, targetId: motionId(value.targetId, 'Binding targetId'),
      ref: parseGeometryRef(value.ref) };
  });
  const targets = new Set(bindings.map(binding => binding.targetId));
  const refs = new Set(bindings.map(binding => geometryKey(binding.ref)));
  check(targets.size === count && refs.size === count, 'Geometry Motion bindings must be one-to-one');
  check(frame.poses.length === count && frame.poses.every(pose => targets.has(pose.targetId)),
    'Motion frame must cover every bound target exactly once');
  check(packets.every(entry => refs.has(geometryKey({ kind: 'surface', modelId: entry.modelId,
    surfaceId: entry.packet.surfaceId })))
    && curves.every(entry => refs.has(geometryKey({ kind: 'curve', modelId: entry.modelId,
      curveId: entry.sample.curve.id }))),
  'Geometry Motion bindings must cover every displayed object exactly once');
  return bindings;
}
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function multiply(a: Vec3, n: number): Vec3 { return [a[0] * n, a[1] * n, a[2] * n]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(a: Vec3): Vec3 { const length = Math.hypot(...a); check(length > 1e-12, 'Degenerate camera vector'); return multiply(a, 1 / length); }
function rotated(q: Quat, v: Vec3): Vec3 {
  const t = multiply(cross([q[0], q[1], q[2]], v), 2);
  return add(v, add(multiply(t, q[3]), cross([q[0], q[1], q[2]], t)));
}
type DisplayTransform = Pick<ViewerDisplayPose, 'translationMm' | 'rotationXYZW' | 'scale'>;
function displayVertex(native: Vec3, pose: DisplayTransform | undefined, mmToSceneUnit: number): Vec3 {
  if (!pose) return multiply(native, mmToSceneUnit);
  const scaled = native.map((value, axis) => value * pose.scale[axis]) as Vec3;
  return multiply(add(pose.translationMm, rotated(pose.rotationXYZW, scaled)), mmToSceneUnit);
}
function surfacePose(ref: ViewerRef, motion: ViewerMotionState | null,
  geometryMotion: ViewerGeometryMotionState | null): DisplayTransform | undefined {
  return geometryMotion?.displayPoses.find(value => value.ref.kind === 'surface'
    && sameRef(value.ref, ref)) ?? motion?.displayPoses.find(value => sameRef(value.ref, ref));
}
function curvePose(ref: ViewerCurveRef, geometryMotion: ViewerGeometryMotionState | null):
  DisplayTransform | undefined {
  return geometryMotion?.displayPoses.find(value => value.ref.kind === 'curve'
    && value.ref.modelId === ref.modelId && value.ref.curveId === ref.curveId);
}

interface ViewerCurveEntry {
  modelId: string;
  sample: AdaptiveCurveSamplingResult;
}

function isGpuCurveSample(sample: BaroCadNativeResult['curves'][number]['sample']): sample is AdaptiveCurveSamplingResult {
  return sample.report.dto.version === 0;
}

function fittedCamera(packets: ViewerPacket[], curves: ViewerCurveEntry[], scale: number, width: number, height: number,
  motion: ViewerMotionState | null = null, geometryMotion: ViewerGeometryMotionState | null = null): MeshCamera {
  const low: Vec3 = [Infinity, Infinity, Infinity], high: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const entry of packets) {
    const pose = surfacePose({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, motion, geometryMotion);
    for (let offset = 0; offset < entry.packet.positions.length; offset += 3) {
      const point = displayVertex(entry.packet.positions.slice(offset, offset + 3) as Vec3, pose, scale);
      for (let axis = 0; axis < 3; axis++) {
        low[axis] = Math.min(low[axis], point[axis]);
        high[axis] = Math.max(high[axis], point[axis]);
      }
    }
  }
  for (const entry of curves) {
    const pose = curvePose({ modelId: entry.modelId, curveId: entry.sample.curve.id }, geometryMotion);
    for (const raw of entry.sample.pointsMM) {
      const point = displayVertex(raw as Vec3, pose, scale);
      for (let axis = 0; axis < 3; axis++) {
        low[axis] = Math.min(low[axis], point[axis]);
        high[axis] = Math.max(high[axis], point[axis]);
      }
    }
  }
  const target = low.map((n, axis) => (n + high[axis]) / 2) as Vec3;
  const radius = Math.max(0.01, Math.hypot(...high.map((n, axis) => n - target[axis])));
  const halfFov = 45 * Math.PI / 360;
  const distance = radius * 1.3 / Math.sin(Math.atan(Math.tan(halfFov) * Math.min(1, width / height)));
  check(distance + radius * 2 < 10000, 'Scene cannot fit within camera clipping bounds');
  return validateMeshCamera({ eye: add(target, multiply(unit([1, 1, 1]), distance)), target, up: [0, 1, 0],
    fovYDegrees: 45, near: Math.max(0.0001, distance - radius * 2), far: distance + radius * 2 });
}

function rayTriangle(origin: Vec3, direction: Vec3, a: Vec3, b: Vec3, c: Vec3): { distance: number; u: number; v: number } | null {
  const edge1 = subtract(b, a), edge2 = subtract(c, a), p = cross(direction, edge2), determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-10) return null;
  const inverse = 1 / determinant, offset = subtract(origin, a), u = dot(offset, p) * inverse;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = cross(offset, edge1), v = dot(direction, q) * inverse;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const distance = dot(edge2, q) * inverse;
  return distance > 0 ? { distance, u, v } : null;
}
function interpolate(a: Vec3, b: Vec3, fraction: number): Vec3 {
  return add(multiply(a, 1 - fraction), multiply(b, fraction));
}

/** One canvas and one BaroCSS GPU scene backend. The caller retains canvas ownership. */
export class Viewer {
  private renderer: ReturnType<typeof mountMeshScene> | PrimitiveSceneRenderer | null = null;
  private packets: ViewerPacket[] = [];
  private curves: ViewerCurveEntry[] = [];
  private native: BaroCadNativeResult | null = null;
  private measurement: ViewerNativeSurfaceMeasurement | null = null;
  private curveMeasurement: ViewerNativeCurveMeasurement | null = null;
  private surfaceCurveMeasurement: ViewerNativeSurfaceCurveMeasurement | null = null;
  private nativeMeasurement: ViewerNativePointDistance | null = null;
  private camera: MeshCamera = validateMeshCamera(INITIAL_CAMERA);
  private selected: ViewerRef | null = null;
  private selectedGeometry: ViewerGeometryRef | null = null;
  private motion: ViewerMotionState | null = null;
  private geometryMotion: ViewerGeometryMotionState | null = null;
  private disposed = false;
  private contextLost = false;
  private readonly onContextLost = (): void => { this.contextLost = true; };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: ViewerOptions) {
    check(canvas instanceof HTMLCanvasElement, 'Viewer requires an HTMLCanvasElement');
    this.dimensions(canvas.width, canvas.height);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }
  private live(): void { check(!this.disposed, 'Viewer is disposed'); }
  private dimensions(width: number, height: number): void {
    check(Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1
      && width <= 4096 && height <= 4096 && width * height <= 4194304, 'Canvas dimensions exceed limits');
  }
  private gpuOptions(camera = this.camera) {
    return { mmToSceneUnit: this.options.mmToSceneUnit, translate: [0, 0, 0] as Vec3,
      background: this.options.background, camera };
  }
  private gpuEntries(packets: ViewerPacket[], selected: ViewerRef | null, motion: ViewerMotionState | null,
    geometryMotion: ViewerGeometryMotionState | null) {
    return packets.map((entry, index) => {
      const ref = { modelId: entry.modelId, surfaceId: entry.packet.surfaceId };
      const pose = surfacePose(ref, motion, geometryMotion);
      return { packet: entry.packet,
        color: sameRef(ref, selected) ? SELECTED_COLOR : PALETTE[index],
        ...(pose ? { transform: { translationMm: pose.translationMm,
          rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}) };
    });
  }
  private present(packets: ViewerPacket[], curves: ViewerCurveEntry[], camera: MeshCamera, selected: ViewerRef | null,
    motion: ViewerMotionState | null, geometrySelection: ViewerGeometryRef | null = this.selectedGeometry,
    geometryMotion: ViewerGeometryMotionState | null = this.geometryMotion): void {
    const surfaces = this.gpuEntries(packets, selected, motion, geometryMotion), options = this.gpuOptions(camera);
    if (curves.length) {
      const entries = [
        ...surfaces.map(entry => ({ kind: 'surface' as const, ...entry })),
        ...curves.map((entry, index) => {
          const pose = curvePose({ modelId: entry.modelId, curveId: entry.sample.curve.id }, geometryMotion);
          return { kind: 'curve' as const, sample: entry.sample,
            basis: 'authored-xyz-matches-rhyup' as const,
            color: geometrySelection?.kind === 'curve' && geometrySelection.modelId === entry.modelId
              && geometrySelection.curveId === entry.sample.curve.id
              ? SELECTED_COLOR : PALETTE[(packets.length + index) % PALETTE.length],
            ...(pose ? { transform: { translationMm: pose.translationMm,
              rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}) };
        }),
      ];
      if (this.renderer instanceof PrimitiveSceneRenderer) {
        const result = this.renderer.update(entries, options);
        if (!result.ok) throw result.error;
      } else {
        const prior = this.renderer;
        try {
          const candidate = mountPrimitiveScene(this.canvas, entries, options);
          this.renderer = candidate;
          prior?.dispose();
        } catch (error) { prior?.render(); throw error; }
      }
    } else if (this.renderer && !(this.renderer instanceof PrimitiveSceneRenderer)) {
      const result = this.renderer.update(surfaces, options);
      if (!result.ok) throw result.error;
    } else {
      const prior = this.renderer;
      try {
        const candidate = mountMeshScene(this.canvas, surfaces, options);
        this.renderer = candidate;
        prior?.dispose();
      } catch (error) { prior?.render(); throw error; }
    }
  }
  private validatedPackets(input: unknown, allowEmpty = false): ViewerPacket[] {
    check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype
      && input.length >= (allowEmpty ? 0 : 1) && input.length <= 4
      && Reflect.ownKeys(input).length === input.length + 1,
    'Viewer requires a dense bounded Surface array');
    const result: ViewerPacket[] = [], identities = new Set<string>(), surfaceIds = new Set<string>();
    let vertices = 0, indices = 0;
    for (let i = 0; i < input.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
      check(descriptor && descriptor.enumerable && 'value' in descriptor, 'Surface entry must be data');
      const value = ownRecord(descriptor.value, ['modelId', 'packet'], 'Surface entry');
      check(typeof value.modelId === 'string' && ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
      const packet = validatePreviewPacket(value.packet);
      const identity = `${value.modelId}\0${packet.surfaceId}`;
      check(!identities.has(identity), 'Duplicate surface reference'); identities.add(identity);
      check(!surfaceIds.has(packet.surfaceId), 'GPU scene requires distinct original surface IDs');
      surfaceIds.add(packet.surfaceId);
      vertices += packet.positions.length / 3; indices += packet.indices.length;
      check(vertices <= 4096 && indices <= 24576, 'Viewer geometry exceeds total limits');
      prepareMesh(packet, { ...this.gpuOptions(), color: PALETTE[i] });
      result.push({ modelId: value.modelId, packet });
    }
    return result;
  }
  private accept(input: unknown, native: BaroCadNativeResult | null, curves: ViewerCurveEntry[] = []): void {
    const packets = this.validatedPackets(input, curves.length > 0);
    check(packets.length + curves.length >= 1 && packets.length + curves.length <= 4,
      'Viewer requires 1..4 total display objects');
    const camera = fittedCamera(packets, curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height);
    this.present(packets, curves, camera, null, null, null, null);
    this.packets = packets; this.curves = curves; this.camera = camera;
    this.selected = null; this.selectedGeometry = null; this.native = native;
    this.measurement = null; this.motion = null; this.geometryMotion = null; this.curveMeasurement = null;
    this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
  }
  loadNative(source: string, input: NativeLoadOptions | ViewerNativeCurveLoadOptions): void {
    this.live();
    check(typeof source === 'string' && source.length > 0 && source.length <= 65536, 'Native source length exceeds limits');
    const options = parseNativeOptions(input);
    const native = parseBaroCadSource(source, { ...options, unitsPerMillimeter: 1 });
    check(native.model.objects.length <= 64, 'Native model exceeds object limit');
    this.accept(native.surfaces.map(surface => ({ modelId: native.model.name, packet: surface.packet })), native,
      native.curves.map(curve => {
        check(isGpuCurveSample(curve.sample), 'Viewer GPU requires Curve sample v0');
        return { modelId: native.model.name, sample: curve.sample };
      }));
  }
  setPackets(input: ViewerPacket[]): void { this.live(); this.accept(input, null); }
  measureNativeSurfacePoints(firstInput: ViewerNativeSurfaceParameter,
    secondInput: ViewerNativeSurfaceParameter): ViewerNativeSurfaceMeasurement {
    this.live();
    const first = parseNativeParameter(firstInput), second = parseNativeParameter(secondInput);
    const model = this.native?.model;
    check(model && first.modelId === model.name && second.modelId === model.name,
      'Both points must belong to the accepted native model');
    const point = (input: ViewerNativeSurfaceParameter): ViewerNativeSurfacePoint => {
      const surface = model.objects.find(object => object.kind === 'surface' && object.id === input.surfaceId);
      check(surface && surface.kind === 'surface', 'Native Surface reference is unknown');
      const domain = surfaceDomain(surface);
      check(input.u >= domain.u[0] && input.u <= domain.u[1]
        && input.v >= domain.v[0] && input.v <= domain.v[1],
      'Native U/V parameters must be inside the original Surface domain');
      return { ref: { modelId: input.modelId, surfaceId: input.surfaceId }, u: input.u, v: input.v,
        pointMM: [...evaluateSurface(surface, input.u, input.v)] as Vec3 };
    };
    const firstPoint = point(first), secondPoint = point(second);
    const distanceMM = Math.hypot(...subtract(firstPoint.pointMM, secondPoint.pointMM));
    check(Number.isFinite(distanceMM), 'Native point distance is not finite');
    const result: ViewerNativeSurfaceMeasurement = { first: firstPoint, second: secondPoint,
      distanceMM, space: 'native-authored', certification: 'not-certified' };
    const latest = nativeDistance(tagSurfacePoint(firstPoint), tagSurfacePoint(secondPoint));
    this.measurement = result;
    this.nativeMeasurement = latest;
    return structuredClone(result);
  }
  applyMotionFrame(input: MotionFrame, inputBindings: ViewerMotionBinding[],
    inputOptions: { basis: 'part-xyz-matches-rhyup' }): void {
    this.live(); check(this.packets.length > 0, 'Viewer has no surfaces');
    const basis = ownRecord(inputOptions, ['basis'], 'Motion basis');
    check(basis.basis === 'part-xyz-matches-rhyup', 'Motion part XYZ/mm basis must explicitly match Viewer Y-up/mm');
    const frame = parseMotionFrame(input);
    const bindings = parseMotionBindings(inputBindings, frame, this.packets);
    const poses = new Map(frame.poses.map(pose => [pose.targetId, pose]));
    const displayPoses = bindings.map(binding => {
      const pose = poses.get(binding.targetId)!;
      return { ref: binding.ref,
        translationMm: pose.translation ?? [0, 0, 0] as Vec3,
        rotationXYZW: pose.rotation ?? [0, 0, 0, 1] as Quat,
        scale: pose.scale ?? [1, 1, 1] as Vec3 };
    });
    const motion: ViewerMotionState = { basis: 'part-xyz-matches-rhyup', frame, bindings, displayPoses };
    for (const entry of this.packets) {
      const pose = displayPoses.find(value => sameRef(value.ref,
        { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }))!;
      for (let offset = 0; offset < entry.packet.positions.length; offset += 3) {
        const point = displayVertex(entry.packet.positions.slice(offset, offset + 3) as Vec3,
          pose, this.options.mmToSceneUnit);
        check(point.every(value => Number.isFinite(value) && Math.abs(value) <= 1000),
          'Transformed Viewer position exceeds GPU scene bounds');
      }
    }
    this.present(this.packets, this.curves, this.camera, this.selected, motion, this.selectedGeometry, null);
    this.motion = motion;
    this.geometryMotion = null;
  }
  applyGeometryMotionFrame(input: MotionFrame, inputBindings: ViewerGeometryMotionBinding[],
    inputOptions: { basis: 'part-xyz-matches-rhyup' }): void {
    this.live(); check(this.packets.length + this.curves.length > 0, 'Viewer has no geometry');
    const basis = ownRecord(inputOptions, ['basis'], 'Motion basis');
    check(basis.basis === 'part-xyz-matches-rhyup', 'Motion part XYZ/mm basis must explicitly match Viewer Y-up/mm');
    const frame = parseMotionFrame(input);
    const bindings = parseGeometryMotionBindings(inputBindings, frame, this.packets, this.curves);
    const poses = new Map(frame.poses.map(pose => [pose.targetId, pose]));
    const displayPoses: ViewerGeometryDisplayPose[] = bindings.map(binding => {
      const pose = poses.get(binding.targetId)!;
      return { ref: binding.ref,
        translationMm: pose.translation ?? [0, 0, 0] as Vec3,
        rotationXYZW: pose.rotation ?? [0, 0, 0, 1] as Quat,
        scale: pose.scale ?? [1, 1, 1] as Vec3 };
    });
    const geometryMotion: ViewerGeometryMotionState = {
      basis: 'part-xyz-matches-rhyup', frame, bindings, displayPoses,
    };
    const withinBounds = (point: Vec3): void => check(point.every(value =>
      Number.isFinite(value) && Math.abs(value) <= 1000), 'Transformed Viewer position exceeds GPU scene bounds');
    for (const entry of this.packets) {
      const pose = surfacePose({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, null, geometryMotion);
      for (let offset = 0; offset < entry.packet.positions.length; offset += 3) {
        withinBounds(displayVertex(entry.packet.positions.slice(offset, offset + 3) as Vec3,
          pose, this.options.mmToSceneUnit));
      }
    }
    for (const entry of this.curves) {
      const pose = curvePose({ modelId: entry.modelId, curveId: entry.sample.curve.id }, geometryMotion);
      for (const point of entry.sample.pointsMM) {
        withinBounds(displayVertex(point as Vec3, pose, this.options.mmToSceneUnit));
      }
    }
    this.present(this.packets, this.curves, this.camera, this.selected, null,
      this.selectedGeometry, geometryMotion);
    this.motion = null;
    this.geometryMotion = geometryMotion;
  }
  resetMotion(): void {
    this.live();
    if (this.motion || this.geometryMotion) this.present(this.packets, this.curves, this.camera,
      this.selected, null, this.selectedGeometry, null);
    this.motion = null;
    this.geometryMotion = null;
  }
  measureNativeCurvePoints(firstInput: ViewerNativeCurveParameter,
    secondInput: ViewerNativeCurveParameter): ViewerNativeCurveMeasurement {
    this.live();
    const first = parseNativeCurveParameter(firstInput), second = parseNativeCurveParameter(secondInput);
    const model = this.native?.model;
    check(model && first.modelId === model.name && second.modelId === model.name,
      'Both Curve points must belong to the accepted native model');
    const point = (input: ViewerNativeCurveParameter): ViewerNativeCurvePoint => {
      const curve = model.objects.find(object => object.kind === 'curve' && object.id === input.curveId);
      check(curve && curve.kind === 'curve', 'Native Curve reference is unknown');
      const domain = curveDomain(curve);
      check(input.t >= domain[0] && input.t <= domain[1],
        'Native Curve parameter must be inside the original domain');
      return { ref: { modelId: input.modelId, curveId: input.curveId }, t: input.t,
        pointMM: [...evaluateCurve(curve, input.t)] as Vec3 };
    };
    const firstPoint = point(first), secondPoint = point(second);
    const distanceMM = Math.hypot(...subtract(firstPoint.pointMM, secondPoint.pointMM));
    check(Number.isFinite(distanceMM), 'Native Curve chord distance is not finite');
    const result: ViewerNativeCurveMeasurement = { first: firstPoint, second: secondPoint,
      distanceMM, metric: 'straight-chord', space: 'native-authored', certification: 'not-certified' };
    const latest = nativeDistance(tagCurvePoint(firstPoint), tagCurvePoint(secondPoint));
    this.curveMeasurement = result;
    this.nativeMeasurement = latest;
    return structuredClone(result);
  }
  measureNativeSurfaceCurvePoints(surfaceInput: ViewerNativeSurfaceParameter,
    curveInput: ViewerNativeCurveParameter): ViewerNativeSurfaceCurveMeasurement {
    this.live();
    const surfaceParameter = parseNativeParameter(surfaceInput);
    const curveParameter = parseNativeCurveParameter(curveInput);
    const model = this.native?.model;
    check(model && surfaceParameter.modelId === model.name && curveParameter.modelId === model.name,
      'Both points must belong to the accepted native model');
    const surface = model.objects.find(object => object.kind === 'surface'
      && object.id === surfaceParameter.surfaceId);
    check(surface && surface.kind === 'surface', 'Native Surface reference is unknown');
    const surfaceBounds = surfaceDomain(surface);
    check(surfaceParameter.u >= surfaceBounds.u[0] && surfaceParameter.u <= surfaceBounds.u[1]
      && surfaceParameter.v >= surfaceBounds.v[0] && surfaceParameter.v <= surfaceBounds.v[1],
    'Native U/V parameters must be inside the original Surface domain');
    const curve = model.objects.find(object => object.kind === 'curve'
      && object.id === curveParameter.curveId);
    check(curve && curve.kind === 'curve', 'Native Curve reference is unknown');
    const curveBounds = curveDomain(curve);
    check(curveParameter.t >= curveBounds[0] && curveParameter.t <= curveBounds[1],
      'Native Curve parameter must be inside the original domain');
    const surfacePoint: ViewerNativeSurfacePoint = { ref: { modelId: surfaceParameter.modelId,
      surfaceId: surfaceParameter.surfaceId }, u: surfaceParameter.u, v: surfaceParameter.v,
    pointMM: [...evaluateSurface(surface, surfaceParameter.u, surfaceParameter.v)] as Vec3 };
    const curvePoint: ViewerNativeCurvePoint = { ref: { modelId: curveParameter.modelId,
      curveId: curveParameter.curveId }, t: curveParameter.t,
    pointMM: [...evaluateCurve(curve, curveParameter.t)] as Vec3 };
    const distanceMM = Math.hypot(...subtract(surfacePoint.pointMM, curvePoint.pointMM));
    check(Number.isFinite(distanceMM), 'Native Surface-to-Curve distance is not finite');
    const result: ViewerNativeSurfaceCurveMeasurement = { surface: surfacePoint, curve: curvePoint,
      distanceMM, metric: 'straight-line', space: 'native-authored', certification: 'not-certified' };
    const latest = nativeDistance(tagSurfacePoint(surfacePoint), tagCurvePoint(curvePoint));
    this.surfaceCurveMeasurement = result;
    this.nativeMeasurement = latest;
    return structuredClone(result);
  }
  measureNativePoints(firstInput: ViewerNativePointInput,
    secondInput: ViewerNativePointInput): ViewerNativePointDistance {
    this.live();
    const first = parseNativePointInput(firstInput), second = parseNativePointInput(secondInput);
    const model = this.native?.model;
    check(model && first.modelId === model.name && second.modelId === model.name,
      'Both points must belong to the accepted native model');
    const evaluate = (input: ViewerNativePointInput): ViewerNativePoint => {
      if (input.kind === 'surface') {
        const surface = model.objects.find(object => object.kind === 'surface' && object.id === input.surfaceId);
        check(surface && surface.kind === 'surface', 'Native Surface reference is unknown');
        const domain = surfaceDomain(surface);
        check(input.u >= domain.u[0] && input.u <= domain.u[1]
          && input.v >= domain.v[0] && input.v <= domain.v[1],
        'Native U/V parameters must be inside the original Surface domain');
        return { kind: 'surface', ref: { modelId: input.modelId, surfaceId: input.surfaceId },
          u: input.u, v: input.v, pointMM: [...evaluateSurface(surface, input.u, input.v)] as Vec3 };
      }
      const curve = model.objects.find(object => object.kind === 'curve' && object.id === input.curveId);
      check(curve && curve.kind === 'curve', 'Native Curve reference is unknown');
      const domain = curveDomain(curve);
      check(input.t >= domain[0] && input.t <= domain[1],
        'Native Curve parameter must be inside the original domain');
      return { kind: 'curve', ref: { modelId: input.modelId, curveId: input.curveId },
        t: input.t, pointMM: [...evaluateCurve(curve, input.t)] as Vec3 };
    };
    const result = nativeDistance(evaluate(first), evaluate(second));
    this.nativeMeasurement = result;
    return structuredClone(result);
  }
  fit(): void {
    this.live(); check(this.packets.length + this.curves.length > 0, 'Viewer has no geometry');
    this.setView(fittedCamera(this.packets, this.curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height,
      this.motion, this.geometryMotion));
  }
  fitGeometry(input: ViewerGeometryRef): void {
    this.live();
    const ref = parseGeometryRef(input);
    const packets = ref.kind === 'surface' ? this.packets.filter(entry =>
      entry.modelId === ref.modelId && entry.packet.surfaceId === ref.surfaceId) : [];
    const curves = ref.kind === 'curve' ? this.curves.filter(entry =>
      entry.modelId === ref.modelId && entry.sample.curve.id === ref.curveId) : [];
    check(packets.length + curves.length === 1, 'Unknown displayed geometry reference');
    this.setView(fittedCamera(packets, curves, this.options.mmToSceneUnit,
      this.canvas.width, this.canvas.height, this.motion, this.geometryMotion));
  }
  setView(input: MeshCamera): void {
    this.live(); const camera = validateMeshCamera(input);
    if (this.renderer) this.present(this.packets, this.curves, camera, this.selected, this.motion);
    this.camera = camera;
  }
  orbit(deltaAzimuthRadians: number, deltaElevationRadians: number): void {
    this.live(); const az = finite(deltaAzimuthRadians, 'Orbit azimuth', -Math.PI * 2, Math.PI * 2);
    const el = finite(deltaElevationRadians, 'Orbit elevation', -Math.PI, Math.PI);
    const offset = subtract(this.camera.eye, this.camera.target), distance = Math.hypot(...offset);
    const azimuth = Math.atan2(offset[0], offset[2]) + az;
    const elevation = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001,
      Math.asin(offset[1] / distance) + el));
    this.setView({ ...this.camera, eye: add(this.camera.target,
      [distance * Math.sin(azimuth) * Math.cos(elevation), distance * Math.sin(elevation),
        distance * Math.cos(azimuth) * Math.cos(elevation)]) });
  }
  pan(deltaXScene: number, deltaYScene: number): void {
    this.live(); const x = finite(deltaXScene, 'Pan X', -1000, 1000), y = finite(deltaYScene, 'Pan Y', -1000, 1000);
    const backward = unit(subtract(this.camera.eye, this.camera.target));
    const right = unit(cross(this.camera.up, backward)), vertical = cross(backward, right);
    const shift = add(multiply(right, x), multiply(vertical, y));
    this.setView({ ...this.camera, eye: add(this.camera.eye, shift), target: add(this.camera.target, shift) });
  }
  zoom(factor: number): void {
    this.live(); finite(factor, 'Zoom factor', 0.1, 10);
    const offset = multiply(subtract(this.camera.eye, this.camera.target), 1 / factor);
    const distance = Math.hypot(...offset), near = Math.max(0.0001, distance / 1000), far = Math.min(10000, distance * 1000);
    this.setView({ ...this.camera, eye: add(this.camera.target, offset), near, far });
  }
  pick(xCss: number, yCss: number): ViewerPick | null {
    this.live(); check(!this.contextLost, 'Cannot pick after WebGL2 context loss');
    finite(xCss, 'Pick X', 0, 4096); finite(yCss, 'Pick Y', 0, 4096);
    if (this.packets.length === 0) return null;
    const rect = this.canvas.getBoundingClientRect();
    check(rect.width > 0 && rect.height > 0, 'Canvas must have a visible CSS size for picking');
    check(xCss <= rect.width && yCss <= rect.height, 'Pick point is outside canvas');
    const backward = unit(subtract(this.camera.eye, this.camera.target));
    const right = unit(cross(this.camera.up, backward)), up = cross(backward, right);
    const tangent = Math.tan(this.camera.fovYDegrees * Math.PI / 360);
    const aspect = this.canvas.width / this.canvas.height;
    const direction = unit(add(multiply(backward, -1), add(
      multiply(right, (2 * xCss / rect.width - 1) * tangent * aspect),
      multiply(up, (1 - 2 * yCss / rect.height) * tangent))));
    let best: ViewerPick | null = null;
    for (const entry of this.packets) {
      const { positions, indices, parameters } = entry.packet, scale = this.options.mmToSceneUnit;
      const pose = surfacePose({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId },
        this.motion, this.geometryMotion);
      for (let offset = 0; offset < indices.length; offset += 3) {
        const vertex = (index: number): Vec3 => displayVertex(positions.slice(index * 3, index * 3 + 3) as Vec3,
          pose, scale);
        const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
        const hit = rayTriangle(this.camera.eye, direction, vertex(a), vertex(b), vertex(c));
        if (!hit) continue;
        const depth = dot(multiply(direction, hit.distance), multiply(backward, -1));
        if (depth < this.camera.near || depth > this.camera.far) continue;
        if (best && Math.abs(hit.distance - best.distanceScene) <= 1e-6) {
          best.ambiguous = true;
          continue;
        }
        if (best && hit.distance >= best.distanceScene) continue;
        const w = 1 - hit.u - hit.v;
        best = { ref: { modelId: entry.modelId, surfaceId: entry.packet.surfaceId },
          triangleIndex: offset / 3, distanceScene: hit.distance,
          positionScene: add(this.camera.eye, multiply(direction, hit.distance)),
          parameterUV: [0, 1].map(axis => w * parameters[a * 2 + axis]
            + hit.u * parameters[b * 2 + axis] + hit.v * parameters[c * 2 + axis]) as [number, number],
          approximate: true, ambiguous: false };
      }
    }
    return best;
  }
  pickGeometry(pointInput: ViewerGeometryPoint,
    optionsInput?: { curveTolerancePx?: number }): ViewerGeometryPick | null {
    this.live(); check(!this.contextLost, 'Cannot pick after WebGL2 context loss');
    const point = ownRecord(pointInput, ['xCss', 'yCss'], 'Geometry pick point');
    const xCss = finite(point.xCss, 'Pick X', 0, 4096);
    const yCss = finite(point.yCss, 'Pick Y', 0, 4096);
    let tolerance = 4;
    if (optionsInput !== undefined) {
      check(optionsInput !== null && typeof optionsInput === 'object'
        && Object.getPrototypeOf(optionsInput) === Object.prototype,
      'Geometry pick options must be plain data');
      const keys = Reflect.ownKeys(optionsInput);
      check(keys.length <= 1 && keys.every(key => key === 'curveTolerancePx'),
        'Geometry pick options have unsupported fields');
      const options = ownRecord(optionsInput, keys as string[], 'Geometry pick options');
      if (Object.hasOwn(options, 'curveTolerancePx')) {
        tolerance = finite(options.curveTolerancePx, 'Curve pick tolerance', 0.5, 16);
      }
    }
    const rect = this.canvas.getBoundingClientRect();
    check(rect.width > 0 && rect.height > 0, 'Canvas must have a visible CSS size for picking');
    check(xCss <= rect.width && yCss <= rect.height, 'Pick point is outside canvas');
    const surface = this.pick(xCss, yCss);
    const backward = unit(subtract(this.camera.eye, this.camera.target));
    const forward = multiply(backward, -1);
    const right = unit(cross(this.camera.up, backward));
    const up = cross(backward, right);
    const tangent = Math.tan(this.camera.fovYDegrees * Math.PI / 360);
    const aspect = this.canvas.width / this.canvas.height;
    const depth = (position: Vec3) => dot(subtract(position, this.camera.eye), forward);
    const project = (position: Vec3, z: number): [number, number] => {
      const offset = subtract(position, this.camera.eye);
      return [rect.width * (1 + dot(offset, right) / (z * tangent * aspect)) / 2,
        rect.height * (1 - dot(offset, up) / (z * tangent)) / 2];
    };
    const candidates: { result: ViewerGeometryPick; depth: number; distance: number }[] = [];
    if (surface) candidates.push({ result: { kind: 'surface', ...surface },
      depth: depth(surface.positionScene), distance: 0 });
    for (const entry of this.curves) {
      const sample = entry.sample;
      const pose = curvePose({ modelId: entry.modelId, curveId: sample.curve.id }, this.geometryMotion);
      for (let index = 0; index + 1 < sample.pointsMM.length; index++) {
        const displayed = (pointMM: number[]): Vec3 => displayVertex(pointMM as Vec3,
          pose, this.options.mmToSceneUnit).map(Math.fround) as Vec3;
        const a = displayed(sample.pointsMM[index]);
        const b = displayed(sample.pointsMM[index + 1]);
        const view = (position: Vec3): Vec3 => {
          const offset = subtract(position, this.camera.eye);
          return [dot(offset, right), dot(offset, up), dot(offset, forward)];
        };
        const firstView = view(a), secondView = view(b);
        const planes = (position: Vec3): number[] => [
          position[2] - this.camera.near, this.camera.far - position[2],
          position[0] + position[2] * tangent * aspect,
          position[2] * tangent * aspect - position[0],
          position[1] + position[2] * tangent,
          position[2] * tangent - position[1],
        ];
        const firstPlanes = planes(firstView), secondPlanes = planes(secondView);
        let low = 0, high = 1;
        for (let plane = 0; plane < firstPlanes.length; plane++) {
          const start = firstPlanes[plane], end = secondPlanes[plane];
          if (start < 0 && end < 0) { low = 1; high = 0; break; }
          if (start < 0 || end < 0) {
            const boundary = start / (start - end);
            if (start < 0) low = Math.max(low, boundary);
            else high = Math.min(high, boundary);
          }
        }
        if (low > high) continue;
        const first = interpolate(a, b, low), second = interpolate(a, b, high);
        const zFirst = depth(first), zSecond = depth(second);
        if (zFirst <= 0 || zSecond <= 0) continue;
        const screenFirst = project(first, zFirst), screenSecond = project(second, zSecond);
        const dx = screenSecond[0] - screenFirst[0], dy = screenSecond[1] - screenFirst[1];
        const lengthSquared = dx * dx + dy * dy;
        const screenFraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
          ((xCss - screenFirst[0]) * dx + (yCss - screenFirst[1]) * dy) / lengthSquared));
        const closestX = screenFirst[0] + screenFraction * dx;
        const closestY = screenFirst[1] + screenFraction * dy;
        const screenDistancePx = Math.hypot(xCss - closestX, yCss - closestY);
        if (screenDistancePx > tolerance) continue;
        const denominator = (1 - screenFraction) * zSecond + screenFraction * zFirst;
        const visibleFraction = denominator === 0 ? 0 : screenFraction * zFirst / denominator;
        const segmentFraction = low + (high - low) * visibleFraction;
        const displayPositionScene = interpolate(a, b, segmentFraction);
        const depthScene = depth(displayPositionScene);
        const cover = this.packets.length ? this.pick(closestX, closestY) : null;
        if (cover && depth(cover.positionScene) <= depthScene + 1e-6) continue;
        const parameterInterval: [number, number] =
          [sample.parameters[index], sample.parameters[index + 1]];
        const parameterApprox = parameterInterval[0]
          + (parameterInterval[1] - parameterInterval[0]) * segmentFraction;
        const curve = this.native?.model.objects.find(object => object.kind === 'curve'
          && object.id === sample.curve.id);
        check(curve && curve.kind === 'curve', 'Displayed Curve has no accepted native authority');
        const nativePointMM = [...evaluateCurve(curve, parameterApprox)] as Vec3;
        candidates.push({ result: { kind: 'curve',
          ref: { modelId: entry.modelId, curveId: sample.curve.id }, segmentIndex: index,
          parameterInterval, parameterApprox, displayPositionScene, nativePointMM,
          depthScene, screenDistancePx, approximate: true, ambiguous: false },
        depth: depthScene, distance: screenDistancePx });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.depth - b.depth || a.distance - b.distance);
    const best = candidates[0];
    const ambiguous = candidates.slice(1).some(candidate =>
      Math.abs(candidate.depth - best.depth) <= 1e-6
      && Math.abs(candidate.distance - best.distance) <= 0.5);
    return { ...best.result, ambiguous: best.result.ambiguous || ambiguous };
  }
  select(input: ViewerRef | null): void {
    this.live(); const selected = input === null ? null : parseRef(input);
    check(selected === null || this.packets.some(entry => sameRef(
      { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, selected)), 'Unknown surface reference');
    const geometrySelection: ViewerGeometryRef | null = selected
      ? { kind: 'surface', ...selected } : null;
    if (this.renderer) this.present(this.packets, this.curves, this.camera, selected, this.motion,
      geometrySelection);
    this.selected = selected;
    this.selectedGeometry = geometrySelection;
  }
  selectGeometry(input: ViewerGeometryRef | null): void {
    this.live();
    const selection = input === null ? null : parseGeometryRef(input);
    if (selection?.kind === 'surface') {
      check(this.packets.some(entry => entry.modelId === selection.modelId
        && entry.packet.surfaceId === selection.surfaceId), 'Unknown displayed Surface reference');
    } else if (selection?.kind === 'curve') {
      check(this.curves.some(entry => entry.modelId === selection.modelId
        && entry.sample.curve.id === selection.curveId), 'Unknown displayed Curve reference');
    }
    const surface = selection?.kind === 'surface'
      ? { modelId: selection.modelId, surfaceId: selection.surfaceId } : null;
    if (this.renderer) this.present(this.packets, this.curves, this.camera, surface, this.motion, selection);
    this.selected = surface;
    this.selectedGeometry = selection;
  }
  resize(width: number, height: number): void {
    this.live(); this.dimensions(width, height);
    if (this.renderer) this.renderer.resize(width, height);
    else { this.canvas.width = width; this.canvas.height = height; }
  }
  getState(): ViewerState {
    const status = this.disposed ? 'disposed' : this.contextLost ? 'context-lost'
      : this.packets.length + this.curves.length ? 'ready' : 'empty';
    return structuredClone({ status, frame: 'right-handed-y-up', sourceUnit: 'mm',
      mmToSceneUnit: this.options.mmToSceneUnit, camera: this.camera,
      surfaces: this.packets.map(entry => ({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
      curves: this.curves.map(entry => ({ modelId: entry.modelId, curveId: entry.sample.curve.id })),
      packets: this.packets,
      selected: this.selected, selectedGeometry: this.selectedGeometry,
      native: this.native, measurement: this.measurement,
      curveMeasurement: this.curveMeasurement, surfaceCurveMeasurement: this.surfaceCurveMeasurement,
      nativeMeasurement: this.nativeMeasurement, motion: this.motion,
      geometryMotion: this.geometryMotion });
  }
  readPixels(): Uint8Array { this.live(); check(this.renderer, 'Viewer has no geometry'); return this.renderer.readPixels(); }
  dispose(): void { if (this.disposed) return; this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.dispose(); this.renderer = null; }
}

export function createViewer(canvas: HTMLCanvasElement, options: ViewerOptions): Viewer {
  return new Viewer(canvas, parseViewerOptions(options));
}
