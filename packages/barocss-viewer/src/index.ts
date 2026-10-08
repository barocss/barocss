import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadNativeResult } from '@barocss/cad-interop/native';
import { mountMeshScene, prepareMesh, validateMeshCamera, validatePreviewPacket } from '@barocss/gpu';
import type { MeshCamera, PreviewPacket } from '@barocss/gpu';
import { MOTION_LIMITS } from '@barocss/motion';
import type { MotionFrame } from '@barocss/motion';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export interface ViewerOptions { mmToSceneUnit: number; background: Vec3 }
export interface NativeLoadOptions { sourceVersion: 0; countU: number; countV: number }
export interface ViewerRef { modelId: string; surfaceId: string }
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
export interface ViewerPick {
  ref: ViewerRef;
  triangleIndex: number;
  distanceScene: number;
  positionScene: Vec3;
  parameterUV: [number, number];
  approximate: true;
  ambiguous: boolean;
}
export interface ViewerState {
  status: 'empty' | 'ready' | 'context-lost' | 'disposed';
  frame: 'right-handed-y-up';
  sourceUnit: 'mm';
  mmToSceneUnit: number;
  camera: MeshCamera;
  surfaces: ViewerRef[];
  packets: ViewerPacket[];
  selected: ViewerRef | null;
  native: BaroCadNativeResult | null;
  measurement: ViewerNativeSurfaceMeasurement | null;
  motion: ViewerMotionState | null;
  curveMeasurement: ViewerNativeCurveMeasurement | null;
}

const PALETTE: Vec3[] = [[0.14, 0.58, 0.86], [0.95, 0.57, 0.22], [0.36, 0.72, 0.49], [0.72, 0.48, 0.87]];
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
function parseNativeOptions(input: unknown): NativeLoadOptions {
  const value = ownRecord(input, ['sourceVersion', 'countU', 'countV'], 'Native options');
  check(value.sourceVersion === 0, 'Only sourceVersion 0 is supported');
  const countU = finite(value.countU, 'countU', 2, 17), countV = finite(value.countV, 'countV', 2, 17);
  check(Number.isInteger(countU) && Number.isInteger(countV), 'Grid counts must be integers');
  return { sourceVersion: 0, countU, countV };
}
function parseRef(input: unknown): ViewerRef {
  const value = ownRecord(input, ['modelId', 'surfaceId'], 'Surface reference');
  check(typeof value.modelId === 'string' && ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
  check(typeof value.surfaceId === 'string' && ID.test(value.surfaceId), 'surfaceId must be a bounded ASCII identifier');
  return { modelId: value.modelId, surfaceId: value.surfaceId };
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
function displayVertex(native: Vec3, pose: ViewerDisplayPose | undefined, mmToSceneUnit: number): Vec3 {
  if (!pose) return multiply(native, mmToSceneUnit);
  const scaled = native.map((value, axis) => value * pose.scale[axis]) as Vec3;
  return multiply(add(pose.translationMm, rotated(pose.rotationXYZW, scaled)), mmToSceneUnit);
}

function fittedCamera(packets: ViewerPacket[], scale: number, width: number, height: number,
  motion: ViewerMotionState | null = null): MeshCamera {
  const low: Vec3 = [Infinity, Infinity, Infinity], high: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const entry of packets) {
    const pose = motion?.displayPoses.find(value => sameRef(value.ref,
      { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }));
    for (let offset = 0; offset < entry.packet.positions.length; offset += 3) {
      const point = displayVertex(entry.packet.positions.slice(offset, offset + 3) as Vec3, pose, scale);
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

/** One canvas and one BaroCSS GPU scene backend. The caller retains canvas ownership. */
export class Viewer {
  private renderer: ReturnType<typeof mountMeshScene> | null = null;
  private packets: ViewerPacket[] = [];
  private native: BaroCadNativeResult | null = null;
  private measurement: ViewerNativeSurfaceMeasurement | null = null;
  private curveMeasurement: ViewerNativeCurveMeasurement | null = null;
  private camera: MeshCamera = validateMeshCamera(INITIAL_CAMERA);
  private selected: ViewerRef | null = null;
  private motion: ViewerMotionState | null = null;
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
  private gpuEntries(packets: ViewerPacket[], selected: ViewerRef | null, motion: ViewerMotionState | null) {
    return packets.map((entry, index) => {
      const ref = { modelId: entry.modelId, surfaceId: entry.packet.surfaceId };
      const pose = motion?.displayPoses.find(value => sameRef(value.ref, ref));
      return { packet: entry.packet,
        color: sameRef(ref, selected) ? [1, 0.94, 0.38] as Vec3 : PALETTE[index],
        ...(pose ? { transform: { translationMm: pose.translationMm,
          rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}) };
    });
  }
  private present(packets: ViewerPacket[], camera: MeshCamera, selected: ViewerRef | null,
    motion: ViewerMotionState | null): void {
    const entries = this.gpuEntries(packets, selected, motion), options = this.gpuOptions(camera);
    if (this.renderer) {
      const result = this.renderer.update(entries, options);
      if (!result.ok) throw result.error;
    } else {
      this.renderer = mountMeshScene(this.canvas, entries, options);
    }
  }
  private validatedPackets(input: unknown): ViewerPacket[] {
    check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype
      && input.length >= 1 && input.length <= 4 && Reflect.ownKeys(input).length === input.length + 1,
    'Viewer requires a dense array of 1..4 surfaces');
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
  private accept(input: unknown, native: BaroCadNativeResult | null): void {
    const packets = this.validatedPackets(input);
    const camera = fittedCamera(packets, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height);
    this.present(packets, camera, null, null);
    this.packets = packets; this.camera = camera; this.selected = null; this.native = native;
    this.measurement = null; this.motion = null; this.curveMeasurement = null;
  }
  loadNative(source: string, input: NativeLoadOptions): void {
    this.live();
    check(typeof source === 'string' && source.length > 0 && source.length <= 65536, 'Native source length exceeds limits');
    const options = parseNativeOptions(input);
    const native = parseBaroCadSource(source, { ...options, unitsPerMillimeter: 1 });
    check(native.model.objects.length <= 64, 'Native model exceeds object limit');
    this.accept(native.surfaces.map(surface => ({ modelId: native.model.name, packet: surface.packet })), native);
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
    this.measurement = result;
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
    this.present(this.packets, this.camera, this.selected, motion);
    this.motion = motion;
  }
  resetMotion(): void {
    this.live();
    if (this.motion) this.present(this.packets, this.camera, this.selected, null);
    this.motion = null;
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
    this.curveMeasurement = result;
    return structuredClone(result);
  }
  fit(): void {
    this.live(); check(this.packets.length > 0, 'Viewer has no surfaces');
    this.setView(fittedCamera(this.packets, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height,
      this.motion));
  }
  setView(input: MeshCamera): void {
    this.live(); const camera = validateMeshCamera(input);
    if (this.renderer) this.present(this.packets, camera, this.selected, this.motion);
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
      const pose = this.motion?.displayPoses.find(value => sameRef(value.ref,
        { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }));
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
  select(input: ViewerRef | null): void {
    this.live(); const selected = input === null ? null : parseRef(input);
    check(selected === null || this.packets.some(entry => sameRef(
      { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, selected)), 'Unknown surface reference');
    if (this.renderer) this.present(this.packets, this.camera, selected, this.motion);
    this.selected = selected;
  }
  resize(width: number, height: number): void {
    this.live(); this.dimensions(width, height);
    if (this.renderer) this.renderer.resize(width, height);
    else { this.canvas.width = width; this.canvas.height = height; }
  }
  getState(): ViewerState {
    const status = this.disposed ? 'disposed' : this.contextLost ? 'context-lost'
      : this.packets.length ? 'ready' : 'empty';
    return structuredClone({ status, frame: 'right-handed-y-up', sourceUnit: 'mm',
      mmToSceneUnit: this.options.mmToSceneUnit, camera: this.camera,
      surfaces: this.packets.map(entry => ({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
      packets: this.packets,
      selected: this.selected, native: this.native, measurement: this.measurement,
      curveMeasurement: this.curveMeasurement, motion: this.motion });
  }
  readPixels(): Uint8Array { this.live(); check(this.renderer, 'Viewer has no surfaces'); return this.renderer.readPixels(); }
  dispose(): void { if (this.disposed) return; this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.dispose(); this.renderer = null; }
}

export function createViewer(canvas: HTMLCanvasElement, options: ViewerOptions): Viewer {
  return new Viewer(canvas, parseViewerOptions(options));
}
