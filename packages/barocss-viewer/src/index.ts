import { createCadGeometryReference, curveDomain, evaluateCurve, evaluateSurface,
  queryCadDocumentBounds, queryCadAssemblyInstancePoint, surfaceDomain, validateCadDocumentBounds } from '@barocss/cad';
import type { AdaptiveCurveSamplingResult, WideAdaptiveCurveSamplingResult, CadAssemblyResult,
  CadAssemblyInstancePointQuery, CadAssemblyInstancePointResult } from '@barocss/cad';
import { BaroCadLoadAbortError, loadBaroCadSource, parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadLoadTransportOptions, BaroCadNativeResult } from '@barocss/cad-interop/native';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import type { BaroCadDocumentPrimitiveBindingV2, BaroCadDocumentPrimitiveOptionsV2,
  CadDocumentResult } from '@barocss/cad-interop/document';
import { loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveNativeRefsV2 } from '@barocss/cad-interop/model-set';
import type { BaroCadModelSetLoadOptions, BaroCadModelSetManifest,
  BaroCadModelSetResult } from '@barocss/cad-interop/model-set';
import { mountMeshScene, mountPrimitiveScene, mountPrimitiveSceneV1, mountPrimitiveSceneV2,
  mountPrimitiveViewport, PrimitiveSceneRenderer, PrimitiveSceneRendererV1,
  PrimitiveSceneRendererV2, PrimitiveViewport, PrimitiveSceneRecoveryError, prepareMesh,
  validateMeshCamera, validatePreviewPacket, mountBooleanShellScene, BooleanShellSceneRenderer,
  validateUniformCurvePreview, validateSelectedUniformCurvePreview, mountMixedDepthScene,
  MixedDepthRenderer, MixedDepthError, prepareMixedDepthFrame, mountQualifiedFaceScene,
  QualifiedFaceSceneRenderer, QualifiedFaceSceneError, prepareQualifiedFaceScene } from '@barocss/gpu';
import type { MeshCamera, MeshLighting, PreviewPacket, PrimitiveSceneEntryV1,
  PrimitiveSceneEntryV2, PrimitiveSceneFrameV0, PrimitiveSceneFrameV1, MeshMaterialBinding, ParticleLayerV0, ClothLayerV0,
  UniformCurvePreview, SelectedUniformCurvePreview, QualifiedFaceSceneV0 } from '@barocss/gpu';

import { prepareViewerClothFrame } from './cloth-frame.js';
import { prepareMountedNativeSceneAppearance } from './mounted-native-scene-appearance.js';
import type { ViewerNativeSceneAppearanceInputV1 } from './native-scene-appearance.js';
import type { ViewerClothFrameV0 } from './cloth-frame.js';
export type { ViewerClothFrameV0 } from './cloth-frame.js';
import { prepareViewerAssembly } from './assembly.js';
import type { ViewerAssemblyLoadOptions, ViewerAssemblyInstanceBinding } from './assembly.js';
export type { ViewerAssemblyLoadOptions, ViewerAssemblyInstanceBinding } from './assembly.js';
export type ViewerAssemblyPointQuery = CadAssemblyInstancePointQuery;
export type ViewerAssemblyPoint = CadAssemblyInstancePointResult;

import { prepareViewerShellGraph } from './shell-graph.js';
import type { ViewerShellLoadOptions, ViewerShellState } from './shell-graph.js';
export type { ViewerShellEntry, ViewerShellLoadOptions, ViewerShellState } from './shell-graph.js';
import { pickViewerShell } from './shell-pick.js';
import type { ViewerShellPick } from './shell-pick.js';
export type { ViewerShellPick } from './shell-pick.js';
import type { BooleanExtrusionFeatureGraphResult } from '@barocss/cad';
import { prepareViewerMixedDepth } from './mixed-depth.js';
import type { ViewerMixedDepthInputV0, ViewerMixedDepthState } from './mixed-depth.js';
export type { ViewerMixedDepthInputV0, ViewerMixedDepthState } from './mixed-depth.js';
import { prepareViewerQualifiedFaces } from './qualified-faces.js';
import { qualifiedFaceAssetDisplayBounds, qualifiedFaceDisplayBounds } from './qualified-face-fit.js';
import type { ViewerQualifiedFaceFitInput } from './qualified-face-fit.js';
export type { ViewerQualifiedFaceFitInput } from './qualified-face-fit.js';
import type { ViewerQualifiedFaceInputV0 } from './qualified-faces.js';
export type { ViewerQualifiedFaceInputV0 } from './qualified-faces.js';
import { measureViewerQualifiedFacePoints } from './qualified-face-measurement.js';
import type { ViewerQualifiedFacePointInput, ViewerQualifiedFacePointDistance } from './qualified-face-measurement.js';
export type { ViewerQualifiedFacePointInput, ViewerQualifiedFacePoint, ViewerQualifiedFacePointDistance }
  from './qualified-face-measurement.js';
import { projectViewerQualifiedFacePoint } from './qualified-face-projection.js';
import type { ViewerQualifiedFacePointProjection } from './qualified-face-projection.js';
export type { ViewerQualifiedFacePointProjection } from './qualified-face-projection.js';
import { pickViewerQualifiedFace } from './qualified-face-pick.js';
import type { ViewerQualifiedFacePick } from './qualified-face-pick.js';
export type { ViewerQualifiedFacePick } from './qualified-face-pick.js';
import { sampleViewerQualifiedFace } from './qualified-face-native-sample.js';
import type { ViewerQualifiedFaceNativeSample } from './qualified-face-native-sample.js';
export type { ViewerQualifiedFaceNativeSample } from './qualified-face-native-sample.js';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export interface ViewerOptions { mmToSceneUnit: number; background: Vec3; lighting?: MeshLighting }
export interface ViewerPointerControlOptions { onError?: (error: unknown) => void }
export interface ViewerPointerControls { dispose(): void }
export interface ViewerKeyboardControlOptions { onError?: (error: unknown) => void }
export interface ViewerKeyboardControls { dispose(): void }
export interface NativeLoadOptions { sourceVersion: 0; countU: number; countV: number }
export interface ViewerNativeCurveLoadOptions extends NativeLoadOptions {
  curveDisplay: { chordToleranceMM: number; maxSegments: number; maxDepth: number };
}
export interface ViewerNativeCurveLoadOptionsV1 extends NativeLoadOptions {
  curveDisplay: { version: 1; chordToleranceMM: number; maxSegments: number; maxDepth: number };
}
export interface ViewerRef { modelId: string; surfaceId: string }
export interface ViewerSurfaceMaterial { ref: ViewerRef; binding: MeshMaterialBinding }
export type ViewerGeometryRef =
  | ({ kind: 'surface' } & ViewerRef)
  | ({ kind: 'curve' } & ViewerCurveRef);
export interface ViewerPacket { modelId: string; packet: PreviewPacket }
/** Actual Physics metre positions mapped by the host; Viewer owns the copied display frame. */
export interface ViewerFluidFrameV0 {
  version: 0;
  contextId: string;
  sceneRevision: string;
  stepIndex: number;
  particleCount: 256;
  positionsM: Float64Array;
}
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
export interface ViewerPose {
  targetId: string;
  translation?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
}
export interface ViewerPoseFrame { contextId: string; timeSeconds: number; poses: ViewerPose[] }
export const VIEWER_POSE_LIMITS = Object.freeze({
  durationSeconds: 3600,
  translationMm: 10000,
  scaleMin: 0.001,
  scaleMax: 100,
  quaternionNormTolerance: 1e-9,
});
export interface ViewerDisplayPose { ref: ViewerRef; translationMm: Vec3; rotationXYZW: Quat; scale: Vec3 }
export interface ViewerMotionState {
  basis: 'part-xyz-matches-rhyup';
  frame: ViewerPoseFrame;
  bindings: ViewerMotionBinding[];
  displayPoses: ViewerDisplayPose[];
}
export interface ViewerGeometryMotionBinding { contextId: string; targetId: string; ref: ViewerGeometryRef }
export interface ViewerGeometryDisplayPose {
  ref: ViewerGeometryRef; translationMm: Vec3; rotationXYZW: Quat; scale: Vec3
}
export interface ViewerGeometryMotionState {
  basis: 'part-xyz-matches-rhyup';
  frame: ViewerPoseFrame;
  bindings: ViewerGeometryMotionBinding[];
  displayPoses: ViewerGeometryDisplayPose[];
}
export type ViewerNativeSceneSourceV0 =
  | { kind: 'native'; source: string;
      options: NativeLoadOptions | ViewerNativeCurveLoadOptions | ViewerNativeCurveLoadOptionsV1;
      basis: 'authored-xyz-matches-rhyup' }
  | { kind: 'document'; result: CadDocumentResult; options: BaroCadDocumentPrimitiveOptionsV2;
      bindings: BaroCadDocumentPrimitiveBindingV2[] };
export interface ViewerNativeSceneReplacementV0 {
  version: 0;
  source: ViewerNativeSceneSourceV0;
  display: {
    motion: { frame: ViewerPoseFrame; bindings: ViewerGeometryMotionBinding[];
      basis: 'part-xyz-matches-rhyup' } | null;
    visibleGeometry: ViewerGeometryRef[];
    camera: MeshCamera | null;
  };
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
export interface ViewerNativePointProjection {
  point: ViewerNativePoint;
  displayPositionScene: Vec3;
  xCss: number;
  yCss: number;
  depthScene: number;
  approximate: true;
  occlusion: 'not-tested';
  documentBody: BaroCadDocumentPrimitiveBindingV2 | null;
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
export interface ViewerGeometryPickOptions {
  curveTolerancePx?: number;
  kinds?: Array<'surface' | 'curve'>;
}
export type ViewerGeometryPick =
  | ({ kind: 'surface' } & ViewerPick)
  | { kind: 'curve'; ref: ViewerCurveRef; segmentIndex: number;
      parameterInterval: [number, number]; parameterApprox: number;
      displayPositionScene: Vec3; nativePointMM: Vec3; depthScene: number;
      screenDistancePx: number; approximate: true; ambiguous: boolean };
export interface ViewerDocumentBody {
  ref: ViewerGeometryRef;
  binding: BaroCadDocumentPrimitiveBindingV2;
}
/** Current document revision is required so a saved caller selection cannot silently fit a replacement scene. */
export interface ViewerNativeDocumentFitInput {
  ref: ViewerGeometryRef;
  documentRevision: number;
}
/** An explicit set of visible bodies in one current CAD document. */
export interface ViewerNativeDocumentBodiesFitInput {
  refs: ViewerGeometryRef[];
  documentRevision: number;
}
export interface ViewerState {
  status: 'empty' | 'ready' | 'unavailable' | 'context-lost' | 'disposed';
  frame: 'right-handed-y-up';
  sourceUnit: 'mm';
  mmToSceneUnit: number;
  lighting: MeshLighting | null;
  camera: MeshCamera;
  surfaces: ViewerRef[];
  curves: ViewerCurveRef[];
  visibleGeometry: ViewerGeometryRef[];
  curveSampleVersion: 0 | 1 | 2 | 3 | null;
  uniformCurve: UniformCurvePreview | null;
  selectedUniformCurve: SelectedUniformCurvePreview | null;
  mixedDepth: ViewerMixedDepthState | null;
  qualifiedFaceScene: QualifiedFaceSceneV0 | null;
  packets: ViewerPacket[];
  selected: ViewerRef | null;
  selectedGeometry: ViewerGeometryRef | null;
  native: BaroCadNativeResult | null;
  modelSet: BaroCadModelSetResult | null;
  document: CadDocumentResult | null;
  documentBodies: ViewerDocumentBody[];
  assembly: CadAssemblyResult | null;
  assemblyInstances: ViewerAssemblyInstanceBinding[];
  shell: ViewerShellState | null;
  measurement: ViewerNativeSurfaceMeasurement | null;
  motion: ViewerMotionState | null;
  geometryMotion: ViewerGeometryMotionState | null;
  curveMeasurement: ViewerNativeCurveMeasurement | null;
  surfaceCurveMeasurement: ViewerNativeSurfaceCurveMeasurement | null;
  nativeMeasurement: ViewerNativePointDistance | null;
  fluidFrame: ViewerFluidFrameV0 | null;
  clothFrame: ViewerClothFrameV0 | null;
  surfaceMaterial: ViewerSurfaceMaterial | null;
  surfaceMaterials: ViewerSurfaceMaterial[];
}

const PALETTE: Vec3[] = [[0.14, 0.58, 0.86], [0.95, 0.57, 0.22], [0.36, 0.72, 0.49], [0.72, 0.48, 0.87]];
const SELECTED_COLOR: Vec3 = [1, 0.94, 0.38];
const INITIAL_CAMERA: MeshCamera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.01, far: 100 };
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const MODEL_ID = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
const MOTION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FLUID_TAG = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;

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
  check(Math.abs(Math.hypot(...values) - 1) <= VIEWER_POSE_LIMITS.quaternionNormTolerance,
    'Motion rotation must be a unit XYZW quaternion');
  return values;
}
function motionId(input: unknown, label: string): string {
  check(typeof input === 'string' && MOTION_ID.test(input), `${label} must be a bounded Motion identifier`);
  return input;
}
function parseMotionFrame(input: unknown): ViewerPoseFrame {
  const data = ownRecord(input, ['contextId', 'timeSeconds', 'poses'], 'Motion frame');
  const contextId = motionId(data.contextId, 'Motion contextId');
  const timeSeconds = finite(data.timeSeconds, 'Motion timeSeconds', 0, VIEWER_POSE_LIMITS.durationSeconds);
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
        -VIEWER_POSE_LIMITS.translationMm, VIEWER_POSE_LIMITS.translationMm) } : {}),
      ...(Object.hasOwn(pose, 'rotation') ? { rotation: quaternion(pose.rotation) } : {}),
      ...(Object.hasOwn(pose, 'scale') ? { scale: vector(pose.scale, 'Motion scale',
        VIEWER_POSE_LIMITS.scaleMin, VIEWER_POSE_LIMITS.scaleMax) } : {}) };
  });
  check(new Set(poses.map(pose => pose.targetId)).size === poses.length, 'Duplicate Motion targetId');
  return { contextId, timeSeconds, poses };
}
function parseViewerOptions(input: unknown): ViewerOptions {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Viewer options must be plain data');
  const hasLighting = Object.hasOwn(input, 'lighting');
  const value = ownRecord(input, hasLighting
    ? ['mmToSceneUnit', 'background', 'lighting'] : ['mmToSceneUnit', 'background'], 'Viewer options');
  let lighting: MeshLighting | undefined;
  if (hasLighting) {
    const data = ownRecord(value.lighting,
      ['ambientStrength', 'directionalStrength', 'direction'], 'Viewer lighting');
    const ambientStrength = finite(data.ambientStrength, 'Ambient strength', 0, 1);
    const directionalStrength = finite(data.directionalStrength, 'Directional strength', 0, 1);
    check(ambientStrength + directionalStrength <= 1, 'Lighting strengths must sum to at most 1');
    const direction = vector(data.direction, 'Light direction', -1000, 1000);
    check(Math.hypot(...direction) > 0, 'Light direction must be nonzero');
    lighting = { ambientStrength, directionalStrength, direction };
  }
  return { mmToSceneUnit: finite(value.mmToSceneUnit, 'mmToSceneUnit', 1e-6, 1),
    background: vector(value.background, 'background', 0, 1),
    ...(lighting ? { lighting } : {}) };
}
function parseNativeOptions(input: unknown):
  NativeLoadOptions | ViewerNativeCurveLoadOptions | ViewerNativeCurveLoadOptionsV1 {
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
  check(value.curveDisplay !== null && typeof value.curveDisplay === 'object'
    && Object.getPrototypeOf(value.curveDisplay) === Object.prototype,
  'Curve display options must be plain data');
  const wide = Object.hasOwn(value.curveDisplay, 'version');
  const display = ownRecord(value.curveDisplay, wide
    ? ['version', 'chordToleranceMM', 'maxSegments', 'maxDepth']
    : ['chordToleranceMM', 'maxSegments', 'maxDepth'], 'Curve display options');
  if (wide) check(display.version === 1, 'Only Curve display version 1 is supported');
  const chordToleranceMM = finite(display.chordToleranceMM, 'chordToleranceMM', 1e-7, 1000);
  const maxSegments = finite(display.maxSegments, 'maxSegments', 1, wide ? 4092 : 1024);
  const maxDepth = finite(display.maxDepth, 'maxDepth', 0, 16);
  check(Number.isInteger(maxSegments) && Number.isInteger(maxDepth), 'Curve display budgets must be integers');
  return { sourceVersion: 0, countU, countV,
    curveDisplay: wide ? { version: 1, chordToleranceMM, maxSegments, maxDepth }
      : { chordToleranceMM, maxSegments, maxDepth } };
}
function parseRef(input: unknown): ViewerRef {
  const value = ownRecord(input, ['modelId', 'surfaceId'], 'Surface reference');
  check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
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
  check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
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
  check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
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
function sameGeometryRef(a: ViewerGeometryRef, b: ViewerGeometryRef): boolean {
  if (a.kind === 'surface' && b.kind === 'surface') {
    return a.modelId === b.modelId && a.surfaceId === b.surfaceId;
  }
  return a.kind === 'curve' && b.kind === 'curve'
    && a.modelId === b.modelId && a.curveId === b.curveId;
}
function refKey(ref: ViewerRef): string { return `${ref.modelId}\0${ref.surfaceId}`; }
function parseMotionBindings(input: unknown, frame: ViewerPoseFrame, packets: ViewerPacket[]): ViewerMotionBinding[] {
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
function parseGeometryMotionBindings(input: unknown, frame: ViewerPoseFrame,
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
      curveId: viewerCurveId(entry) }))),
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

type ViewerCurveEntry = { modelId: string } & (
  | { sampleVersion: 0; sample: AdaptiveCurveSamplingResult }
  | { sampleVersion: 1; sample: WideAdaptiveCurveSamplingResult }
  | { sampleVersion: 2; sample: UniformCurvePreview }
  | { sampleVersion: 3; sample: SelectedUniformCurvePreview });

function viewerCurveId(entry: ViewerCurveEntry): string {
  if (entry.sampleVersion === 3) return entry.sample.curveId;
  return entry.sampleVersion === 2 ? entry.sample.model.objects[0].id : entry.sample.curve.id;
}

function isGpuCurveSample(sample: BaroCadNativeResult['curves'][number]['sample']): sample is AdaptiveCurveSamplingResult {
  return sample.report.dto.version === 0;
}
function isWideGpuCurveSample(sample: BaroCadNativeResult['curves'][number]['sample']):
  sample is WideAdaptiveCurveSamplingResult {
  return sample.report.dto.version === 1;
}

function cameraForBounds(low: Vec3, high: Vec3, width: number, height: number): MeshCamera {
  const target = low.map((n, axis) => (n + high[axis]) / 2) as Vec3;
  const radius = Math.max(0.01, Math.hypot(...high.map((n, axis) => n - target[axis])));
  const halfFov = 45 * Math.PI / 360;
  const distance = radius * 1.3 / Math.sin(Math.atan(Math.tan(halfFov) * Math.min(1, width / height)));
  check(distance + radius * 2 < 10000, 'Scene cannot fit within camera clipping bounds');
  return validateMeshCamera({ eye: add(target, multiply(unit([1, 1, 1]), distance)), target, up: [0, 1, 0],
    fovYDegrees: 45, near: Math.max(0.0001, distance - radius * 2), far: distance + radius * 2 });
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
    const pose = curvePose({ modelId: entry.modelId, curveId: viewerCurveId(entry) }, geometryMotion);
    for (const raw of entry.sample.pointsMM) {
      const point = displayVertex(raw as Vec3, pose, scale);
      for (let axis = 0; axis < 3; axis++) {
        low[axis] = Math.min(low[axis], point[axis]);
        high[axis] = Math.max(high[axis], point[axis]);
      }
    }
  }
  return cameraForBounds(low, high, width, height);
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
  private renderer: ReturnType<typeof mountMeshScene> | PrimitiveSceneRenderer |
    PrimitiveSceneRendererV1 | PrimitiveSceneRendererV2 | PrimitiveViewport | BooleanShellSceneRenderer | MixedDepthRenderer
    | QualifiedFaceSceneRenderer | null = null;
  private packets: ViewerPacket[] = [];
  private curves: ViewerCurveEntry[] = [];
  private native: BaroCadNativeResult | null = null;
  private uniformCurve: UniformCurvePreview | null = null;
  private selectedUniformCurve: SelectedUniformCurvePreview | null = null;
  private mixedDepth: ViewerMixedDepthState | null = null;
  private qualifiedFaceScene: QualifiedFaceSceneV0 | null = null;
  private presentationUnavailable = false;
  private nativeReplacement = false;
  private appearanceDocument: CadDocumentResult | null = null;
  private acceptedLighting: MeshLighting | null = null;
  private modelSet: BaroCadModelSetResult | null = null;
  private document: CadDocumentResult | null = null;
  private documentBodies: ViewerDocumentBody[] = [];
  private shell: ViewerShellState | null = null;
  private assembly: CadAssemblyResult | null = null;
  private assemblyInstances: ViewerAssemblyInstanceBinding[] = [];
  private hiddenGeometry: ViewerGeometryRef[] = [];
  private measurement: ViewerNativeSurfaceMeasurement | null = null;
  private curveMeasurement: ViewerNativeCurveMeasurement | null = null;
  private surfaceCurveMeasurement: ViewerNativeSurfaceCurveMeasurement | null = null;
  private nativeMeasurement: ViewerNativePointDistance | null = null;
  private fluidFrame: ViewerFluidFrameV0 | null = null;
  private particleLayer: ParticleLayerV0 | null = null;
  private clothFrame: ViewerClothFrameV0 | null = null;
  private clothLayer: ClothLayerV0 | null = null;
  private surfaceMaterials: ViewerSurfaceMaterial[] = [];
  private camera: MeshCamera = validateMeshCamera(INITIAL_CAMERA);
  private selected: ViewerRef | null = null;
  private selectedGeometry: ViewerGeometryRef | null = null;
  private motion: ViewerMotionState | null = null;
  private geometryMotion: ViewerGeometryMotionState | null = null;
  private sceneRequest = 0;
  private disposed = false;
  private contextLost = false;
  private readonly onContextLost = (event: Event): void => {
    this.contextLost = true;
    if (this.renderer instanceof BooleanShellSceneRenderer || this.renderer instanceof MixedDepthRenderer
      || this.renderer instanceof QualifiedFaceSceneRenderer
      || this.uniformCurve || this.selectedUniformCurve || this.nativeReplacement || this.assembly) {
      event.preventDefault();
      // CPU provenance is Viewer-owned; retire old GL handles before caller restoration.
      this.renderer?.dispose();
    }
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: ViewerOptions) {
    check(canvas instanceof HTMLCanvasElement, 'Viewer requires an HTMLCanvasElement');
    this.dimensions(canvas.width, canvas.height);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }
  private live(): void { check(!this.disposed, 'Viewer is disposed'); }
  private gpuLive(): void {
    this.live(); check(!this.presentationUnavailable, 'Viewer presentation is unavailable; create a fresh Viewer');
    check(!this.mixedDepth || !this.contextLost, 'Mixed depth context is lost; create a fresh Viewer');
    check(!this.qualifiedFaceScene || !this.contextLost, 'Qualified Face context is lost; create a fresh Viewer');
  }
  private nativeScope(): void {
    check(!this.shell, 'This native operation is unavailable in native Shell mode');
    check(!this.qualifiedFaceScene, 'Unqualified native inspection is unavailable for independent qualified Face sources');
  }
  private primitiveScope(): void {
    this.nativeScope(); check(!this.mixedDepth, 'This primitive operation is unavailable in mixed depth mode');
  }
  private primitiveResult(result: ReturnType<PrimitiveSceneRenderer['update']>): void {
    if (result.ok) return;
    if (!this.contextLost && result.error instanceof PrimitiveSceneRecoveryError && result.error.code === 'CONTEXT')
      this.presentationUnavailable = true;
    throw result.error;
  }
  private mixedResult(result: ReturnType<MixedDepthRenderer['updateFrame']>): void {
    if (result.ok) return;
    if (!this.contextLost && result.error instanceof MixedDepthError && result.error.code === 'CONTEXT')
      this.presentationUnavailable = true;
    throw result.error;
  }
  private qualifiedFaceResult(result: ReturnType<QualifiedFaceSceneRenderer['updateScene']>): void {
    if (result.ok) return;
    if (!this.contextLost && result.error instanceof QualifiedFaceSceneError && result.error.code === 'CONTEXT')
      this.presentationUnavailable = true;
    throw result.error;
  }
  private recoverPresentation(prior: Viewer['renderer'], failure: unknown, structuredCandidate = false): never {
    try {
      if (prior instanceof QualifiedFaceSceneRenderer) {
        const restored = prior.updateScene(prior.getScene());
        if (!restored.ok) throw restored.error;
      } else if (prior instanceof MixedDepthRenderer) {
        const restored = prior.updateFrame(prior.getFrame());
        if (!restored.ok) throw restored.error;
      } else prior?.render();
    } catch (recovery) {
      if (structuredCandidate || prior instanceof MixedDepthRenderer || prior instanceof QualifiedFaceSceneRenderer) {
        if (!this.contextLost) this.presentationUnavailable = true;
        throw new AggregateError([failure, recovery], 'Viewer candidate and accepted presentation recovery failed');
      }
      throw recovery;
    }
    throw failure;
  }
  private dimensions(width: number, height: number): void {
    check(Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1
      && width <= 4096 && height <= 4096 && width * height <= 4194304, 'Canvas dimensions exceed limits');
  }
  private gpuOptions(camera = this.camera) {
    const lighting = this.acceptedLighting ?? this.options.lighting;
    return { mmToSceneUnit: this.options.mmToSceneUnit, translate: [0, 0, 0] as Vec3,
      background: this.options.background, camera,
      ...(lighting ? { lighting } : {}) };
  }
  private gpuEntries(packets: ViewerPacket[], selected: ViewerRef | null, motion: ViewerMotionState | null,
    geometryMotion: ViewerGeometryMotionState | null, paletteInventory: ViewerGeometryRef[] | null = null) {
    return packets.map((entry, index) => {
      const ref = { modelId: entry.modelId, surfaceId: entry.packet.surfaceId };
      const pose = surfacePose(ref, motion, geometryMotion);
      const colorIndex = paletteInventory ? paletteInventory.findIndex(value =>
        sameGeometryRef(value, { kind: 'surface', ...ref })) : index;
      check(colorIndex >= 0, 'Native appearance Surface is absent from the current palette inventory');
      return { packet: entry.packet,
        color: sameRef(ref, selected) ? SELECTED_COLOR : PALETTE[colorIndex],
        ...(pose ? { transform: { translationMm: pose.translationMm,
          rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}) };
    });
  }
  private geometryRefs(): ViewerGeometryRef[] {
    return [...this.packets.map(entry => ({ kind: 'surface' as const,
      modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
    ...this.curves.map(entry => ({ kind: 'curve' as const,
      modelId: entry.modelId, curveId: viewerCurveId(entry) }))];
  }
  private visible(ref: ViewerGeometryRef): boolean {
    return !this.hiddenGeometry.some(hidden => sameGeometryRef(hidden, ref));
  }
  private present(allPackets: ViewerPacket[], allCurves: ViewerCurveEntry[], camera: MeshCamera, selected: ViewerRef | null,
    motion: ViewerMotionState | null, geometrySelection: ViewerGeometryRef | null = this.selectedGeometry,
    geometryMotion: ViewerGeometryMotionState | null = this.geometryMotion,
    qualified = this.modelSet !== null || this.document !== null || this.assembly !== null || this.uniformCurve !== null
      || this.selectedUniformCurve !== null || this.nativeReplacement,
    hiddenGeometry = this.hiddenGeometry,
    particleLayer: ParticleLayerV0 | null = this.particleLayer,
    surfaceMaterials: ViewerSurfaceMaterial[] = this.surfaceMaterials,
    clothLayer: ClothLayerV0 | null = this.clothLayer): void {
    this.gpuLive();
    check(!this.contextLost, 'Cannot present after WebGL2 context loss; create a fresh Viewer');
    const packets = allPackets.filter(entry => !hiddenGeometry.some(hidden => sameGeometryRef(hidden,
      { kind: 'surface', modelId: entry.modelId, surfaceId: entry.packet.surfaceId })));
    const curves = allCurves.filter(entry => !hiddenGeometry.some(hidden => sameGeometryRef(hidden,
      { kind: 'curve', modelId: entry.modelId, curveId: viewerCurveId(entry) })));
    check(!clothLayer || (qualified && packets.length === 1 && curves.length === 0),
      'Active cloth requires one visible qualified native Surface');
    const paletteInventory = this.appearanceDocument !== null && this.appearanceDocument === this.document
      && allPackets === this.packets && allCurves === this.curves ? this.geometryRefs() : null;
    const surfaces = this.gpuEntries(packets, selected, motion, geometryMotion, paletteInventory), options = this.gpuOptions(camera);
    if (packets.length + curves.length === 0) {
      if (this.renderer instanceof PrimitiveViewport) {
        const result = this.renderer.clear(options);
        this.primitiveResult(result);
      } else {
        const prior = this.renderer;
        try {
          const candidate = mountPrimitiveViewport(this.canvas, options);
          this.renderer = candidate;
          prior?.dispose();
        } catch (error) { this.recoverPresentation(prior, error); }
      }
    } else if (qualified) {
      const entries: PrimitiveSceneEntryV2[] = [
        ...surfaces.map((entry, index): PrimitiveSceneEntryV2 => ({
          kind: 'surface', ...entry,
          ref: { modelId: packets[index].modelId, geometryId: packets[index].packet.surfaceId },
        })),
        ...curves.map((entry, index): PrimitiveSceneEntryV2 => {
          const ref = { modelId: entry.modelId, geometryId: viewerCurveId(entry) };
          const pose = curvePose({ modelId: entry.modelId, curveId: ref.geometryId }, geometryMotion);
          const colorIndex = paletteInventory ? paletteInventory.findIndex(value => sameGeometryRef(value,
            { kind: 'curve', modelId: ref.modelId, curveId: ref.geometryId })) : packets.length + index;
          check(colorIndex >= 0, 'Native appearance Curve is absent from the current palette inventory');
          const fields = {
            basis: 'authored-xyz-matches-rhyup' as const, ref,
            color: geometrySelection?.kind === 'curve' && geometrySelection.modelId === ref.modelId
              && geometrySelection.curveId === ref.geometryId
              ? SELECTED_COLOR : PALETTE[colorIndex % PALETTE.length],
            ...(pose ? { transform: { translationMm: pose.translationMm,
              rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}),
          };
          if (entry.sampleVersion === 3) {
            return { kind: 'curve', sampleVersion: 3, sample: entry.sample, ...fields };
          }
          if (entry.sampleVersion === 2) {
            return { kind: 'curve', sampleVersion: 2, sample: entry.sample, ...fields };
          }
          return entry.sampleVersion === 1
            ? { kind: 'curve', sampleVersion: 1, sample: entry.sample, ...fields }
            : { kind: 'curve', sampleVersion: 0, sample: entry.sample, ...fields };
        }),
      ];
      const input = { version: 2 as const, entries };
      if (this.renderer instanceof PrimitiveSceneRendererV2
        || this.renderer instanceof PrimitiveViewport) {
        const materials = surfaceMaterials.map(value => ({ ref: {
          modelId: value.ref.modelId, geometryId: value.ref.surfaceId }, binding: value.binding }));
        const result = clothLayer
          ? this.renderer.updateFrameV1({ version: 1, scene: input, options,
            particles: particleLayer, materials, cloth: clothLayer } satisfies PrimitiveSceneFrameV1)
          : surfaceMaterials.length
            ? this.renderer.updateFrame({ version: 0, scene: input, options,
              particles: particleLayer, materials } satisfies PrimitiveSceneFrameV0)
            : this.renderer.update(input, options, particleLayer);
        this.primitiveResult(result);
      } else {
        const prior = this.renderer;
        try {
          const candidate = mountPrimitiveSceneV2(this.canvas, input, options);
          this.renderer = candidate;
          prior?.dispose();
        } catch (error) { this.recoverPresentation(prior, error); }
      }
    } else if (curves.length) {
      check(curves.every(entry => entry.sampleVersion === 0 || entry.sampleVersion === 1),
        'Uniform Curve requires a qualified GPU scene');
      const surfaceEntries = surfaces.map(entry => ({ kind: 'surface' as const, ...entry }));
      const curveEntries = curves.map((entry, index) => {
        const pose = curvePose({ modelId: entry.modelId, curveId: viewerCurveId(entry) }, geometryMotion);
        return {
          basis: 'authored-xyz-matches-rhyup' as const,
          color: geometrySelection?.kind === 'curve' && geometrySelection.modelId === entry.modelId
            && geometrySelection.curveId === viewerCurveId(entry)
            ? SELECTED_COLOR : PALETTE[(packets.length + index) % PALETTE.length],
          ...(pose ? { transform: { translationMm: pose.translationMm,
            rotationXYZW: pose.rotationXYZW, scale: pose.scale } } : {}),
        };
      });
      if (curves[0].sampleVersion === 1) {
        const entries: PrimitiveSceneEntryV1[] = [
          ...surfaceEntries,
          ...curves.map((entry, index): PrimitiveSceneEntryV1 => {
            if (entry.sampleVersion === 1) {
              return { kind: 'curve', sampleVersion: 1, sample: entry.sample, ...curveEntries[index] };
            }
            check(entry.sampleVersion === 0, 'Legacy Viewer scene requires Curve sample v0 or v1');
            return { kind: 'curve', sampleVersion: 0, sample: entry.sample, ...curveEntries[index] };
          }),
        ];
        const input = { version: 1 as const, entries };
        if (this.renderer instanceof PrimitiveSceneRendererV1) {
          const result = this.renderer.update(input, options);
          this.primitiveResult(result);
        } else {
          const prior = this.renderer;
          try {
            const candidate = mountPrimitiveSceneV1(this.canvas, input, options);
            this.renderer = candidate;
            prior?.dispose();
          } catch (error) { this.recoverPresentation(prior, error); }
        }
      } else {
        const entries = [
          ...surfaceEntries,
          ...curves.map((entry, index) => {
            check(entry.sampleVersion === 0, 'Legacy Viewer scene requires Curve sample v0');
            return { kind: 'curve' as const, sample: entry.sample, ...curveEntries[index] };
          }),
        ];
        if (this.renderer instanceof PrimitiveSceneRenderer) {
          const result = this.renderer.update(entries, options);
          this.primitiveResult(result);
        } else {
          const prior = this.renderer;
          try {
            const candidate = mountPrimitiveScene(this.canvas, entries, options);
            this.renderer = candidate;
            prior?.dispose();
          } catch (error) { this.recoverPresentation(prior, error); }
        }
      }
    } else if (this.renderer && !(this.renderer instanceof PrimitiveSceneRenderer)
      && !(this.renderer instanceof PrimitiveSceneRendererV1)
      && !(this.renderer instanceof PrimitiveSceneRendererV2)
      && !(this.renderer instanceof PrimitiveViewport)
      && !(this.renderer instanceof BooleanShellSceneRenderer)
      && !(this.renderer instanceof MixedDepthRenderer)
      && !(this.renderer instanceof QualifiedFaceSceneRenderer)) {
      const result = this.renderer.update(surfaces, options);
      if (!result.ok) throw result.error;
    } else {
      const prior = this.renderer;
      try {
        const candidate = mountMeshScene(this.canvas, surfaces, options);
        this.renderer = candidate;
        prior?.dispose();
      } catch (error) { this.recoverPresentation(prior, error); }
    }
  }
  private validatedPackets(input: unknown, allowEmpty = false, qualified = false,
    initialPoses: ViewerGeometryMotionState | null = null, deferDisplayValidation = false): ViewerPacket[] {
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
      check(typeof value.modelId === 'string' && MODEL_ID.test(value.modelId), 'modelId must be a bounded ASCII identifier');
      const packet = validatePreviewPacket(value.packet);
      const identity = `${value.modelId}\0${packet.surfaceId}`;
      check(!identities.has(identity), 'Duplicate surface reference'); identities.add(identity);
      check(qualified || !surfaceIds.has(packet.surfaceId), 'GPU scene requires distinct original surface IDs');
      surfaceIds.add(packet.surfaceId);
      vertices += packet.positions.length / 3; indices += packet.indices.length;
      check(vertices <= 4096 && indices <= 24576, 'Viewer geometry exceeds total limits');
      if (!deferDisplayValidation) {
        const pose = surfacePose({ modelId: value.modelId, surfaceId: packet.surfaceId }, null, initialPoses);
        if (pose) {
          for (let offset = 0; offset < packet.positions.length; offset += 3) {
            const displayed = displayVertex(packet.positions.slice(offset, offset + 3) as Vec3,
              pose, this.options.mmToSceneUnit);
            check(displayed.every(value => Number.isFinite(value) && Math.abs(value) <= 1000),
              'Transformed assembly Surface exceeds GPU scene bounds');
          }
        } else prepareMesh(packet, { ...this.gpuOptions(), color: PALETTE[i] });
      }
      result.push({ modelId: value.modelId, packet });
    }
    return result;
  }
  private accept(input: unknown, native: BaroCadNativeResult | null, curves: ViewerCurveEntry[] = [],
    modelSet: BaroCadModelSetResult | null = null, document: CadDocumentResult | null = null,
    documentBodies: ViewerDocumentBody[] = []): void {
    const qualified = modelSet !== null || document !== null;
    const packets = this.validatedPackets(input, curves.length > 0, qualified);
    check(curves.every(entry => entry.sampleVersion === curves[0].sampleVersion),
      'Viewer requires one Curve sample version per native scene');
    check(packets.length + curves.length >= 1 && packets.length + curves.length <= 4,
      'Viewer requires 1..4 total display objects');
    const camera = fittedCamera(packets, curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height);
    this.present(packets, curves, camera, null, null, null, null, qualified, [], null, [], null);
    this.packets = packets; this.curves = curves; this.camera = camera; this.shell = null; this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.nativeReplacement = false; this.appearanceDocument = null;
    this.selected = null; this.selectedGeometry = null; this.native = native; this.modelSet = modelSet;
    this.document = document; this.documentBodies = documentBodies;
    this.assembly = null; this.assemblyInstances = [];
    this.hiddenGeometry = [];
    this.measurement = null; this.motion = null; this.geometryMotion = null; this.curveMeasurement = null;
    this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.fluidFrame = null; this.particleLayer = null; this.surfaceMaterials = [];
    this.clothFrame = null; this.clothLayer = null;
  }
  private admitNative(native: BaroCadNativeResult,
    options: NativeLoadOptions | ViewerNativeCurveLoadOptions | ViewerNativeCurveLoadOptionsV1): void {
    check(native.source.length > 0 && native.source.length <= 65536, 'Native source length exceeds limits');
    check(native.model.objects.length <= 64, 'Native model exceeds object limit');
    const expectedVersion = 'curveDisplay' in options
      ? ('version' in options.curveDisplay ? 1 : 0) : null;
    check(native.curves.every(curve => curve.sample.report.dto.version === expectedVersion),
      'Native Curve sample version differs from requested display profile');
    this.accept(native.surfaces.map(surface => ({ modelId: native.model.name, packet: surface.packet })), native,
      native.curves.map((curve): ViewerCurveEntry => {
        if (isGpuCurveSample(curve.sample)) return { modelId: native.model.name,
          sampleVersion: 0, sample: curve.sample };
        check(isWideGpuCurveSample(curve.sample), 'Viewer requires Curve sample v0 or v1');
        return { modelId: native.model.name, sampleVersion: 1, sample: curve.sample };
      }));
  }
  loadMixedDepthScene(input: ViewerMixedDepthInputV0): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load mixed depth after WebGL2 context loss');
    const candidate = prepareViewerMixedDepth(input, this.options.mmToSceneUnit);
    if (this.renderer instanceof MixedDepthRenderer) this.mixedResult(this.renderer.updateFrame(candidate.frame));
    else {
      const prior = this.renderer;
      try {
        const renderer = mountMixedDepthScene(this.canvas, candidate.frame);
        this.renderer = renderer;
        prior?.dispose();
      } catch (error) { this.recoverPresentation(prior, error, true); }
    }
    this.mixedDepth = candidate; this.camera = candidate.frame.camera; this.qualifiedFaceScene = null;
    this.acceptedLighting = null;
    this.packets = [{ modelId: candidate.frame.surface.ref.modelId, packet: candidate.frame.surface.packet }];
    this.curves = []; this.native = null; this.modelSet = null; this.document = null; this.documentBodies = [];
    this.uniformCurve = null; this.selectedUniformCurve = null; this.nativeReplacement = false; this.appearanceDocument = null;
    this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    this.motion = null; this.geometryMotion = null; this.measurement = null; this.curveMeasurement = null;
    this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.surfaceMaterials = []; this.fluidFrame = null; this.particleLayer = null; this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  loadQualifiedFaceScene(input: ViewerQualifiedFaceInputV0): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load qualified Faces after WebGL2 context loss');
    const candidate = prepareViewerQualifiedFaces(input, this.options.mmToSceneUnit, this.options.background);
    if (this.renderer instanceof QualifiedFaceSceneRenderer) this.qualifiedFaceResult(this.renderer.updateScene(candidate));
    else {
      const prior = this.renderer;
      try {
        const renderer = mountQualifiedFaceScene(this.canvas, candidate);
        this.renderer = renderer;
        prior?.dispose();
      } catch (error) { this.recoverPresentation(prior, error, true); }
    }
    this.qualifiedFaceScene = candidate; this.camera = candidate.camera;
    this.acceptedLighting = null;
    this.packets = []; this.curves = []; this.native = null; this.document = null; this.documentBodies = [];
    this.modelSet = null; this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.nativeReplacement = false; this.appearanceDocument = null;
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = []; this.motion = null; this.geometryMotion = null;
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.surfaceMaterials = []; this.fluidFrame = null; this.particleLayer = null; this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  measureQualifiedFacePoints(first: ViewerQualifiedFacePointInput,
    second: ViewerQualifiedFacePointInput): ViewerQualifiedFacePointDistance {
    this.live(); check(this.qualifiedFaceScene, 'Viewer has no current qualified Face scene');
    return measureViewerQualifiedFacePoints(this.qualifiedFaceScene, first, second);
  }
  projectQualifiedFacePoint(input: ViewerQualifiedFacePointInput): ViewerQualifiedFacePointProjection | null {
    this.gpuLive(); check(!this.contextLost, 'Cannot project qualified Faces after WebGL2 context loss');
    check(this.qualifiedFaceScene, 'Viewer has no current qualified Face scene');
    const rect = this.canvas.getBoundingClientRect();
    return projectViewerQualifiedFacePoint(this.qualifiedFaceScene, input,
      this.canvas.width, this.canvas.height, rect.width, rect.height);
  }
  pickQualifiedFace(point: ViewerGeometryPoint): ViewerQualifiedFacePick | null {
    this.gpuLive(); check(!this.contextLost, 'Cannot pick qualified Faces after WebGL2 context loss');
    check(this.qualifiedFaceScene, 'Viewer has no current qualified Face scene');
    const rect = this.canvas.getBoundingClientRect();
    return pickViewerQualifiedFace(this.qualifiedFaceScene, point,
      this.canvas.width, this.canvas.height, rect.width, rect.height);
  }
  sampleQualifiedFace(point: ViewerGeometryPoint): ViewerQualifiedFaceNativeSample | null {
    this.gpuLive(); check(!this.contextLost, 'Cannot sample qualified Faces after WebGL2 context loss');
    check(this.qualifiedFaceScene, 'Viewer has no current qualified Face scene');
    const rect = this.canvas.getBoundingClientRect();
    return sampleViewerQualifiedFace(this.qualifiedFaceScene, point,
      this.canvas.width, this.canvas.height, rect.width, rect.height);
  }
  replaceNativeScene(input: ViewerNativeSceneReplacementV0): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot replace native scene after WebGL2 context loss');
    const envelope = ownRecord(input, ['version', 'source', 'display'], 'Native scene replacement');
    check(envelope.version === 0, 'Only native scene replacement version0 is supported');
    const display = ownRecord(envelope.display, ['motion', 'visibleGeometry', 'camera'], 'Native scene display');
    check(envelope.source !== null && typeof envelope.source === 'object'
      && Object.getPrototypeOf(envelope.source) === Object.prototype, 'Native scene source must be plain data');
    const kind = Object.getOwnPropertyDescriptor(envelope.source, 'kind');
    check(kind && kind.enumerable && 'value' in kind, 'Native scene source.kind must be own data');
    let native: BaroCadNativeResult | null = null, document: CadDocumentResult | null = null;
    let packets: ViewerPacket[] = [];
    const curves: ViewerCurveEntry[] = [], documentBodies: ViewerDocumentBody[] = [];
    if (kind.value === 'native') {
      const source = ownRecord(envelope.source, ['kind', 'source', 'options', 'basis'], 'Native scene source');
      check(source.basis === 'authored-xyz-matches-rhyup', 'Native source basis must explicitly match Viewer Y-up/mm');
      check(typeof source.source === 'string' && source.source.length > 0 && source.source.length <= 65536
        && new TextEncoder().encode(source.source).length <= 65536, 'Native source exceeds65536bytes/code units');
      const options = parseNativeOptions(source.options);
      native = parseBaroCadSource(source.source, { ...options, unitsPerMillimeter: 1 });
      const expectedVersion = 'curveDisplay' in options ? ('version' in options.curveDisplay ? 1 : 0) : null;
      check(native.model.objects.length <= 64 && native.curves.every(entry =>
        entry.sample.report.dto.version === expectedVersion), 'Native source differs from Viewer sampling profile');
      packets = native.surfaces.map(entry => ({ modelId: native!.model.name, packet: entry.packet }));
      for (const entry of native.curves) {
        if (isGpuCurveSample(entry.sample)) curves.push({ modelId: native.model.name, sampleVersion: 0, sample: entry.sample });
        else {
          check(isWideGpuCurveSample(entry.sample), 'Native scene requires Curve sample0 or1');
          curves.push({ modelId: native.model.name, sampleVersion: 1, sample: entry.sample });
        }
      }
    } else {
      check(kind.value === 'document', 'Native scene source must be native or document');
      const source = ownRecord(envelope.source, ['kind', 'result', 'options', 'bindings'], 'Document scene source');
      check(source.options !== null && typeof source.options === 'object'
        && Object.getPrototypeOf(source.options) === Object.prototype, 'Document scene options must be plain data');
      const options = ownRecord(source.options, Object.hasOwn(source.options, 'bodyIds')
        ? ['native', 'basis', 'bodyIds'] : ['native', 'basis'], 'Document scene options');
      check(options.basis === 'authored-xyz-matches-rhyup', 'Document source basis must explicitly match Viewer Y-up/mm');
      check(options.native !== null && typeof options.native === 'object'
        && Object.getPrototypeOf(options.native) === Object.prototype, 'Document native options must be plain data');
      const nativeFields = ownRecord(options.native, Reflect.ownKeys(options.native) as string[], 'Document native options');
      const { unitsPerMillimeter, ...profile } = nativeFields;
      check(unitsPerMillimeter === 1, 'Document native unitsPerMillimeter must be1');
      const nativeOptions = parseNativeOptions(profile);
      let bodyIds: string[] | undefined;
      if (Object.hasOwn(options, 'bodyIds')) {
        check(Array.isArray(options.bodyIds) && options.bodyIds.length >= 1 && options.bodyIds.length <= 4,
          'Document scene bodyIds requires1..4 entries');
        bodyIds = denseArray(options.bodyIds, options.bodyIds.length, 'Document scene bodyIds').map(value => {
          check(typeof value === 'string', 'Document scene bodyId must be a string'); return value;
        });
        check(new Set(bodyIds).size === bodyIds.length, 'Duplicate document scene bodyId');
      }
      check(Array.isArray(source.bindings) && source.bindings.length >= 1 && source.bindings.length <= 4,
        'Document scene requires1..4 expected bindings');
      const bindingFields = ['documentId', 'documentRevision', 'nativeFrame', 'bodyId', 'assetId',
        'assetRevision', 'sourceFrame', 'modelId', 'geometryKind', 'geometryId'];
      const expected = denseArray(source.bindings, source.bindings.length, 'Document scene bindings')
        .map(value => ownRecord(value, bindingFields, 'Document scene binding'));
      check(new Set(expected.map(value => value.bodyId)).size === expected.length, 'Duplicate document scene binding bodyId');
      const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(source.result as CadDocumentResult,
        { native: { ...nativeOptions, unitsPerMillimeter: 1 }, basis: 'authored-xyz-matches-rhyup',
          ...(bodyIds ? { bodyIds } : {}) });
      check(projected.length === expected.length && projected.every(entry => expected.some(pin =>
        bindingFields.every(key => Object.is(pin[key], entry.binding[key as keyof BaroCadDocumentPrimitiveBindingV2])))),
      'Document scene bindings differ from rebuilt current original authority');
      document = structuredClone(source.result) as CadDocumentResult;
      for (const entry of projected) {
        const modelId = entry.ref.modelId, geometryId = entry.ref.geometryId;
        if (entry.kind === 'surface') {
          packets.push({ modelId, packet: entry.packet });
          documentBodies.push({ ref: { kind: 'surface', modelId, surfaceId: geometryId }, binding: entry.binding });
        } else {
          curves.push(entry.sampleVersion === 1 ? { modelId, sampleVersion: 1, sample: entry.sample }
            : { modelId, sampleVersion: 0, sample: entry.sample });
          documentBodies.push({ ref: { kind: 'curve', modelId, curveId: geometryId }, binding: entry.binding });
        }
      }
    }
    check(packets.length + curves.length >= 1 && packets.length + curves.length <= 4,
      'Native scene requires1..4 admitted objects');
    check(curves.every(entry => entry.sampleVersion === curves[0].sampleVersion), 'Native scene requires one Curve sample version');
    let curvePoints = 0, curveSegments = 0;
    for (const entry of curves) {
      check(entry.sampleVersion === 0 || entry.sampleVersion === 1, 'Native scene requires adaptive Curve sample0 or1');
      const count = entry.sample.pointsMM.length;
      check(count >= 2 && count <= (entry.sampleVersion === 1 ? 4097 : 1025), 'Native scene Curve exceeds sample capacity');
      curvePoints += count; curveSegments += count - 1;
    }
    check(curvePoints <= 16388 && curveSegments <= 16384, 'Native scene exceeds qualified GPU Curve totals');
    packets = this.validatedPackets(packets, curves.length > 0, true, null, true);
    const inventory: ViewerGeometryRef[] = [
      ...packets.map(entry => ({ kind: 'surface' as const, modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
      ...curves.map(entry => ({ kind: 'curve' as const, modelId: entry.modelId, curveId: viewerCurveId(entry) }))
    ].map(parseGeometryRef);
    let geometryMotion: ViewerGeometryMotionState | null = null;
    if (display.motion !== null) {
      const motion = ownRecord(display.motion, ['frame', 'bindings', 'basis'], 'Native scene motion');
      check(motion.basis === 'part-xyz-matches-rhyup', 'Native scene motion basis must explicitly match Viewer Y-up/mm');
      const frame = parseMotionFrame(motion.frame);
      const bindings = parseGeometryMotionBindings(motion.bindings, frame, packets, curves);
      const poses = new Map(frame.poses.map(pose => [pose.targetId, pose]));
      const displayPoses: ViewerGeometryDisplayPose[] = bindings.map(binding => {
        const pose = poses.get(binding.targetId)!;
        return { ref: binding.ref, translationMm: pose.translation ?? [0, 0, 0],
          rotationXYZW: pose.rotation ?? [0, 0, 0, 1], scale: pose.scale ?? [1, 1, 1] };
      });
      geometryMotion = { basis: 'part-xyz-matches-rhyup', frame, bindings, displayPoses };
    }
    const withinBounds = (point: Vec3): void => check(point.every(value => Number.isFinite(value)
      && Math.abs(value) <= 1000), 'Posed native scene exceeds GPU scene bounds');
    for (const entry of packets) {
      const pose = surfacePose({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, null, geometryMotion);
      for (let offset = 0; offset < entry.packet.positions.length; offset += 3)
        withinBounds(displayVertex(entry.packet.positions.slice(offset, offset + 3) as Vec3, pose, this.options.mmToSceneUnit));
    }
    for (const entry of curves) {
      const pose = curvePose({ modelId: entry.modelId, curveId: viewerCurveId(entry) }, geometryMotion);
      for (const point of entry.sample.pointsMM) withinBounds(displayVertex(point as Vec3, pose, this.options.mmToSceneUnit));
    }
    check(Array.isArray(display.visibleGeometry) && display.visibleGeometry.length <= 4,
      'Native scene visibility requires0..4 references');
    const visible = denseArray(display.visibleGeometry, display.visibleGeometry.length, 'Native scene visibility').map(parseGeometryRef);
    check(new Set(visible.map(geometryKey)).size === visible.length
      && visible.every(ref => inventory.some(value => sameGeometryRef(ref, value))),
    'Native scene visibility must be a unique admitted subset');
    const hidden = inventory.filter(ref => !visible.some(value => sameGeometryRef(value, ref)));
    let camera: MeshCamera;
    if (display.camera === null) {
      check(visible.length > 0, 'Native scene auto-fit requires visible geometry');
      camera = fittedCamera(packets.filter(entry => visible.some(ref => sameGeometryRef(ref,
        { kind: 'surface', modelId: entry.modelId, surfaceId: entry.packet.surfaceId }))),
      curves.filter(entry => visible.some(ref => sameGeometryRef(ref,
        { kind: 'curve', modelId: entry.modelId, curveId: viewerCurveId(entry) }))),
      this.options.mmToSceneUnit, this.canvas.width, this.canvas.height, null, geometryMotion);
    } else camera = validateMeshCamera(display.camera);
    this.present(packets, curves, camera, null, null, null, geometryMotion, true, hidden, null, [], null);
    this.packets = packets; this.curves = curves; this.camera = camera; this.native = native;
    this.document = document; this.documentBodies = documentBodies; this.hiddenGeometry = hidden;
    this.geometryMotion = geometryMotion; this.motion = null; this.selected = null; this.selectedGeometry = null;
    this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null; this.modelSet = null; this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.surfaceMaterials = []; this.fluidFrame = null; this.particleLayer = null; this.clothFrame = null; this.clothLayer = null;
    this.nativeReplacement = true;
    this.appearanceDocument = null;
    this.sceneRequest++;
  }
  /** One complete frame update on an already accepted qualified primitive backend. */
  replaceNativeSceneAppearance(input: ViewerNativeSceneAppearanceInputV1): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot replace native appearance after WebGL2 context loss');
    const renderer = this.renderer, request = this.sceneRequest;
    check(renderer instanceof PrimitiveSceneRendererV2 || renderer instanceof PrimitiveViewport,
      'Native appearance requires an already mounted qualified V2 or Viewport backend');
    const candidate = prepareMountedNativeSceneAppearance(input,
      { mmToSceneUnit: this.options.mmToSceneUnit, background: this.options.background });
    check(renderer instanceof PrimitiveViewport || candidate.prepared.prepared.frame.scene.entries.length > 0,
      'An empty native appearance requires an already mounted Viewport backend');
    this.gpuLive(); check(!this.contextLost, 'Cannot replace native appearance after WebGL2 context loss');
    check(this.renderer === renderer && this.sceneRequest === request,
      'Native appearance preparation changed the accepted renderer or source request');
    this.primitiveResult(renderer.updateFrame(candidate.prepared.prepared.frame));
    this.packets = candidate.packets; this.curves = candidate.curves;
    this.document = candidate.prepared.source.result; this.documentBodies = candidate.documentBodies;
    this.hiddenGeometry = candidate.hiddenGeometry; this.geometryMotion = candidate.prepared.display.motion;
    this.camera = candidate.prepared.display.camera; this.surfaceMaterials = candidate.surfaceMaterials;
    this.acceptedLighting = candidate.lighting; this.appearanceDocument = this.document;
    this.native = null; this.modelSet = null; this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.motion = null; this.selected = null; this.selectedGeometry = null;
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.fluidFrame = null; this.particleLayer = null; this.clothFrame = null; this.clothLayer = null;
    this.nativeReplacement = true; this.sceneRequest++;
  }
  loadUniformCurvePreview(input: UniformCurvePreview,
    options: { basis: 'authored-xyz-matches-rhyup' }): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load uniform Curve after WebGL2 context loss');
    const request = ownRecord(options, ['basis'], 'Uniform Curve options');
    check(request.basis === 'authored-xyz-matches-rhyup',
      'Uniform Curve authored XYZ/mm basis must explicitly match Viewer Y-up/mm');
    const uniformCurve = validateUniformCurvePreview(input);
    const modelId = uniformCurve.model.name, curveId = uniformCurve.model.objects[0].id;
    check(MODEL_ID.test(modelId) && ID.test(curveId), 'Uniform Curve original IDs exceed Viewer identity profile');
    for (const point of uniformCurve.pointsMM) {
      check(point.every(value => Number.isFinite(value * this.options.mmToSceneUnit)
        && Math.abs(value * this.options.mmToSceneUnit) <= 1000), 'Uniform Curve exceeds GPU scene bounds');
    }
    const curves: ViewerCurveEntry[] = [{ modelId, sampleVersion: 2, sample: uniformCurve }];
    const camera = fittedCamera([], curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height);
    this.present([], curves, camera, null, null, null, null, true, [], null, [], null);
    this.packets = []; this.curves = curves; this.camera = camera; this.uniformCurve = uniformCurve; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.nativeReplacement = false; this.appearanceDocument = null;
    this.native = null; this.modelSet = null; this.document = null; this.documentBodies = [];
    this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null;
    this.nativeMeasurement = null; this.motion = null; this.geometryMotion = null;
    this.fluidFrame = null; this.particleLayer = null; this.surfaceMaterials = [];
    this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  loadSelectedUniformCurvePreview(input: SelectedUniformCurvePreview,
    options: { basis: 'authored-xyz-matches-rhyup' }): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load selected uniform Curve after WebGL2 context loss');
    const request = ownRecord(options, ['basis'], 'Selected uniform Curve options');
    check(request.basis === 'authored-xyz-matches-rhyup',
      'Selected uniform Curve authored XYZ/mm basis must explicitly match Viewer Y-up/mm');
    const selectedUniformCurve = validateSelectedUniformCurvePreview(input);
    const modelId = selectedUniformCurve.model.name, curveId = selectedUniformCurve.curveId;
    const identity = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
    check(identity.test(modelId) && identity.test(curveId), 'Selected uniform Curve original IDs exceed Viewer ASCII1..64 profile');
    for (const point of selectedUniformCurve.pointsMM) {
      check(point.every(value => Number.isFinite(value * this.options.mmToSceneUnit)
        && Math.abs(value * this.options.mmToSceneUnit) <= 1000), 'Selected uniform Curve exceeds GPU scene bounds');
    }
    const curves: ViewerCurveEntry[] = [{ modelId, sampleVersion: 3, sample: selectedUniformCurve }];
    const camera = fittedCamera([], curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height);
    this.present([], curves, camera, null, null, null, null, true, [], null, [], null);
    this.packets = []; this.curves = curves; this.camera = camera; this.selectedUniformCurve = selectedUniformCurve; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.uniformCurve = null; this.nativeReplacement = false; this.appearanceDocument = null;
    this.native = null; this.modelSet = null; this.document = null; this.documentBodies = [];
    this.assembly = null; this.assemblyInstances = []; this.shell = null;
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null;
    this.nativeMeasurement = null; this.motion = null; this.geometryMotion = null;
    this.fluidFrame = null; this.particleLayer = null; this.surfaceMaterials = [];
    this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  loadShellGraph(input: BooleanExtrusionFeatureGraphResult, options: ViewerShellLoadOptions): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load Shell graph after WebGL2 context loss');
    const candidate = prepareViewerShellGraph(input, options, this.options.mmToSceneUnit);
    const bounds = candidate.boundsScene;
    const camera = bounds ? cameraForBounds(bounds.min, bounds.max, this.canvas.width, this.canvas.height) : this.camera;
    if (this.renderer instanceof BooleanShellSceneRenderer) {
      const result = this.renderer.update(candidate.scene, this.gpuOptions(camera));
      if (!result.ok) throw result.error;
    } else {
      const prior = this.renderer;
      try {
        const renderer = mountBooleanShellScene(this.canvas, candidate.scene, this.gpuOptions(camera));
        this.renderer = renderer;
        prior?.dispose();
      } catch (error) { this.recoverPresentation(prior, error); }
    }
    this.shell = candidate; this.camera = camera; this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null; this.nativeReplacement = false; this.appearanceDocument = null;
    this.packets = []; this.curves = []; this.native = null; this.modelSet = null;
    this.document = null; this.documentBodies = []; this.assembly = null; this.assemblyInstances = [];
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null;
    this.nativeMeasurement = null; this.motion = null; this.geometryMotion = null;
    this.fluidFrame = null; this.particleLayer = null; this.clothFrame = null; this.clothLayer = null;
    this.surfaceMaterials = []; this.sceneRequest++;
  }
  loadAssembly(input: CadAssemblyResult, options: ViewerAssemblyLoadOptions): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot load assembly after WebGL2 context loss');
    const request = ownRecord(options, ['native', 'basis', 'instanceIds'], 'Assembly options');
    check(request.basis === 'authored-xyz-matches-rhyup',
      'Assembly authored XYZ/mm basis must explicitly match Viewer Y-up/mm');
    const nativeOptions = parseNativeOptions(request.native);
    const candidate = prepareViewerAssembly(input, request.instanceIds,
      { ...nativeOptions, unitsPerMillimeter: 1 });
    const packets = this.validatedPackets(candidate.packets, candidate.curves.length > 0,
      true, candidate.geometryMotion);
    const curves = candidate.curves;
    check(packets.length + curves.length >= 1 && packets.length + curves.length <= 4,
      'Assembly requires 1..4 total display objects');
    check(curves.every(entry => entry.sampleVersion === curves[0].sampleVersion),
      'Assembly requires one Curve sample version');
    for (const entry of curves) {
      const pose = curvePose({ modelId: entry.modelId, curveId: viewerCurveId(entry) }, candidate.geometryMotion);
      for (const point of entry.sample.pointsMM) {
        const displayed = displayVertex(point as Vec3, pose, this.options.mmToSceneUnit);
        check(displayed.every(value => Number.isFinite(value) && Math.abs(value) <= 1000),
          'Transformed assembly Curve exceeds GPU scene bounds');
      }
    }
    const camera = fittedCamera(packets, curves, this.options.mmToSceneUnit,
      this.canvas.width, this.canvas.height, null, candidate.geometryMotion);
    this.present(packets, curves, camera, null, null, null, candidate.geometryMotion,
      true, [], null, [], null);
    this.packets = packets; this.curves = curves; this.camera = camera; this.shell = null; this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.nativeReplacement = false; this.appearanceDocument = null;
    this.native = null; this.modelSet = null; this.document = null; this.documentBodies = [];
    this.assembly = candidate.assembly; this.assemblyInstances = candidate.instances;
    this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    this.motion = null; this.geometryMotion = candidate.geometryMotion;
    this.measurement = null; this.curveMeasurement = null;
    this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.fluidFrame = null; this.particleLayer = null; this.surfaceMaterials = [];
    this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  queryAssemblyInstancePoint(input: ViewerAssemblyPointQuery): ViewerAssemblyPoint {
    this.live(); this.primitiveScope(); check(this.assembly, 'Viewer has no accepted assembly');
    const query = ownRecord(input,
      ['assemblyId', 'assemblyRevision', 'instanceId', 'reference', 'query'], 'Assembly point query');
    check(this.assemblyInstances.some(value => value.instanceId === query.instanceId),
      'Assembly point must reference an admitted instance');
    return queryCadAssemblyInstancePoint(this.assembly, input);
  }
  loadNative(source: string, input: NativeLoadOptions | ViewerNativeCurveLoadOptions
    | ViewerNativeCurveLoadOptionsV1): void {
    this.gpuLive();
    check(typeof source === 'string' && source.length > 0 && source.length <= 65536, 'Native source length exceeds limits');
    const options = parseNativeOptions(input);
    this.admitNative(parseBaroCadSource(source, { ...options, unitsPerMillimeter: 1 }), options);
    this.sceneRequest++;
  }
  loadModelSet(input: BaroCadModelSetResult): void {
    this.gpuLive();
    const projected = prepareBaroCadModelSetPrimitiveNativeRefsV2(input);
    const modelSet = structuredClone(input);
    const packets: ViewerPacket[] = [];
    const curves: ViewerCurveEntry[] = [];
    for (const entry of projected) {
      if (entry.kind === 'surface') {
        packets.push({ modelId: entry.ref.modelId, packet: entry.packet });
      } else if (entry.sampleVersion === 1) {
        curves.push({ modelId: entry.ref.modelId, sampleVersion: 1, sample: entry.sample });
      } else {
        curves.push({ modelId: entry.ref.modelId, sampleVersion: 0, sample: entry.sample });
      }
    }
    this.accept(packets, null, curves, modelSet);
    this.sceneRequest++;
  }
  async loadModelSetUrls(manifest: BaroCadModelSetManifest,
    options: BaroCadModelSetLoadOptions = {}): Promise<void> {
    this.gpuLive();
    const request = ++this.sceneRequest;
    const modelSet = await loadBaroCadModelSet(manifest, options);
    this.gpuLive();
    if (request !== this.sceneRequest) throw new BaroCadLoadAbortError();
    this.loadModelSet(modelSet);
  }
  loadDocument(input: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2): void {
    this.gpuLive();
    this.admitDocument(input, options);
    this.sceneRequest++;
  }
  private admitDocument(input: CadDocumentResult, options: BaroCadDocumentPrimitiveOptionsV2): void {
    const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(input, options);
    const document = structuredClone(input);
    const packets: ViewerPacket[] = [];
    const curves: ViewerCurveEntry[] = [];
    const documentBodies: ViewerDocumentBody[] = [];
    for (const entry of projected) {
      const modelId = entry.ref.modelId;
      const geometryId = entry.ref.geometryId;
      if (entry.kind === 'surface') {
        packets.push({ modelId, packet: entry.packet });
        documentBodies.push({ ref: { kind: 'surface', modelId, surfaceId: geometryId },
          binding: entry.binding });
      } else {
        curves.push(entry.sampleVersion === 1
          ? { modelId, sampleVersion: 1, sample: entry.sample }
          : { modelId, sampleVersion: 0, sample: entry.sample });
        documentBodies.push({ ref: { kind: 'curve', modelId, curveId: geometryId },
          binding: entry.binding });
      }
    }
    this.accept(packets, null, curves, null, document, documentBodies);
  }
  async loadDocumentUrl(url: string, options: BaroCadDocumentPrimitiveOptionsV2,
    transport: BaroCadLoadTransportOptions = {}): Promise<void> {
    this.gpuLive();
    const request = ++this.sceneRequest;
    const document = await loadBaroCadDocument(url, transport);
    this.gpuLive();
    if (request !== this.sceneRequest) throw new BaroCadLoadAbortError();
    this.admitDocument(document, options);
  }
  async loadNativeUrl(url: string, input: NativeLoadOptions | ViewerNativeCurveLoadOptions
    | ViewerNativeCurveLoadOptionsV1, transport: BaroCadLoadTransportOptions = {}): Promise<void> {
    this.gpuLive();
    const options = parseNativeOptions(input);
    const request = ++this.sceneRequest;
    const native = await loadBaroCadSource(url, { ...options, unitsPerMillimeter: 1 }, transport);
    this.gpuLive();
    if (request !== this.sceneRequest) throw new BaroCadLoadAbortError();
    this.admitNative(native, options);
  }
  setPackets(input: ViewerPacket[]): void { this.gpuLive(); this.accept(input, null); this.sceneRequest++; }
  clear(): void {
    this.gpuLive();
    this.present([], [], this.camera, null, null, null, null, false, [], null, [], null);
    this.packets = []; this.curves = []; this.native = null; this.modelSet = null; this.shell = null; this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.nativeReplacement = false; this.appearanceDocument = null;
    this.document = null; this.documentBodies = [];
    this.assembly = null; this.assemblyInstances = [];
    this.hiddenGeometry = [];
    this.selected = null; this.selectedGeometry = null;
    this.measurement = null; this.curveMeasurement = null;
    this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    this.motion = null; this.geometryMotion = null;
    this.fluidFrame = null; this.particleLayer = null; this.surfaceMaterials = [];
    this.clothFrame = null; this.clothLayer = null;
    this.sceneRequest++;
  }
  setClothFrame(input: ViewerClothFrameV0 | null): void {
    this.gpuLive();
    check(!this.qualifiedFaceScene, 'Qualified Faces do not support simulation layers');
    check(!this.mixedDepth, 'Mixed depth does not support simulation layers');
    if (this.shell) { check(!this.contextLost, 'Cannot change frames after WebGL2 context loss');
      check(input === null, 'Native Shell mode does not support simulation layers'); return; }
    check(!this.contextLost, 'Cannot change cloth frame after WebGL2 context loss');
    if (input === null) {
      if (!this.clothFrame) return;
      check(this.renderer instanceof PrimitiveSceneRendererV2 || this.renderer instanceof PrimitiveViewport,
        'Cloth layer requires a qualified GPU scene');
      const result = this.renderer.setClothLayer(null);
      this.primitiveResult(result);
      this.clothFrame = null; this.clothLayer = null;
      return;
    }
    check(this.modelSet !== null || this.document !== null,
      'Cloth layer requires a qualified native scene');
    check(this.packets.length === 1 && this.curves.length === 0 &&
      this.visible({ kind: 'surface', modelId: this.packets[0].modelId,
        surfaceId: this.packets[0].packet.surfaceId }),
    'Cloth layer requires one visible native Surface and no Curves');
    check(this.renderer instanceof PrimitiveSceneRendererV2 || this.renderer instanceof PrimitiveViewport,
      'Cloth layer requires a qualified GPU scene');
    const candidate = prepareViewerClothFrame(input, this.options.mmToSceneUnit, this.clothFrame);
    if (candidate.unchanged) return;
    const result = this.renderer.setClothLayer(candidate.layer);
    this.primitiveResult(result);
    this.clothFrame = candidate.frame; this.clothLayer = candidate.layer;
  }
  setFluidFrame(input: ViewerFluidFrameV0 | null): void {
    this.gpuLive();
    check(!this.qualifiedFaceScene, 'Qualified Faces do not support simulation layers');
    check(!this.mixedDepth, 'Mixed depth does not support simulation layers');
    if (this.shell) { check(!this.contextLost, 'Cannot change frames after WebGL2 context loss');
      check(input === null, 'Native Shell mode does not support simulation layers'); return; }
    check(!this.contextLost, 'Cannot change fluid frame after WebGL2 context loss');
    if (input === null) {
      if (!this.fluidFrame) return;
      check(this.renderer instanceof PrimitiveSceneRendererV2 || this.renderer instanceof PrimitiveViewport,
        'Fluid layer requires a qualified GPU scene');
      const result = this.renderer.setParticleLayer(null);
      this.primitiveResult(result);
      this.fluidFrame = null; this.particleLayer = null;
      return;
    }
    check(this.modelSet !== null || this.document !== null,
      'Fluid layer requires a qualified native scene');
    check(this.packets.length === 1 && this.curves.length === 0 &&
      this.visible({ kind: 'surface', modelId: this.packets[0].modelId,
        surfaceId: this.packets[0].packet.surfaceId }),
    'Fluid layer requires one visible native Surface and no Curves');
    check(this.renderer instanceof PrimitiveSceneRendererV2 || this.renderer instanceof PrimitiveViewport,
      'Fluid layer requires a qualified GPU scene');
    const data = ownRecord(input,
      ['version', 'contextId', 'sceneRevision', 'stepIndex', 'particleCount', 'positionsM'], 'Fluid frame');
    check(data.version === 0 && data.particleCount === 256, 'Fluid frame requires version 0 and 256 particles');
    check(typeof data.contextId === 'string' && FLUID_TAG.test(data.contextId)
      && typeof data.sceneRevision === 'string' && FLUID_TAG.test(data.sceneRevision),
    'Fluid frame requires bounded context and revision tags');
    check(typeof data.stepIndex === 'number' && Number.isInteger(data.stepIndex)
      && data.stepIndex >= 0 && data.stepIndex <= 2147483647, 'Fluid step is out of range');
    check(data.positionsM instanceof Float64Array && Object.getPrototypeOf(data.positionsM) === Float64Array.prototype
      && data.positionsM.buffer instanceof ArrayBuffer && data.positionsM.length === 768,
    'Fluid frame requires 256 copied Float64 XYZ metre positions');
    const positionsM = new Float64Array(768), positions: number[] = [];
    for (let i = 0; i < 768; i++) {
      const metre = data.positionsM[i];
      check(Number.isFinite(metre), 'Fluid metre position must be finite');
      positionsM[i] = metre;
      const scene = metre * 1000 * this.options.mmToSceneUnit;
      check(Number.isFinite(scene) && Math.abs(scene) <= 1000,
        'Fluid scene position exceeds GPU bounds');
      positions.push(scene);
    }
    const prior = this.fluidFrame;
    if (prior) {
      check(data.contextId === prior.contextId && data.sceneRevision === prior.sceneRevision,
        'Fluid context or revision requires explicit clear or scene replacement');
      check(data.stepIndex >= prior.stepIndex, 'Fluid step regressed');
      if (data.stepIndex === prior.stepIndex) check(positionsM.every((value, index) =>
        Object.is(value, prior.positionsM[index])), 'Equal fluid step changed metre positions');
    }
    const layer: ParticleLayerV0 = { version: 0, contextId: data.contextId,
      sceneRevision: data.sceneRevision, stepIndex: data.stepIndex,
      coordinateSystem: 'right-handed-y-up-scene-units', positions };
    const result = this.renderer.setParticleLayer(layer);
    this.primitiveResult(result);
    this.fluidFrame = { version: 0, contextId: data.contextId, sceneRevision: data.sceneRevision,
      stepIndex: data.stepIndex, particleCount: 256, positionsM };
    this.particleLayer = layer;
  }
  setSurfaceMaterial(inputRef: ViewerRef, binding: MeshMaterialBinding | null): void {
    this.gpuLive(); this.primitiveScope();
    check(!this.contextLost, 'Cannot change Surface material after WebGL2 context loss');
    const ref = parseRef(inputRef);
    check(this.modelSet !== null || this.document !== null,
      'Surface material requires a qualified native scene');
    check(this.packets.length >= 1 && this.packets.length + this.curves.length <= 4 &&
      this.packets.some(entry => sameRef(ref,
        { modelId: entry.modelId, surfaceId: entry.packet.surfaceId })) &&
      this.visible({ kind: 'surface', ...ref }),
    'Surface material requires a visible qualified native Surface in a scene of 1..4 objects');
    check(!sameRef(ref, this.selected), 'Clear Surface selection before binding material');
    check(this.renderer instanceof PrimitiveSceneRendererV2 || this.renderer instanceof PrimitiveViewport,
      'Surface material requires a qualified GPU scene');
    const result = this.renderer.setMaterial({ modelId: ref.modelId, geometryId: ref.surfaceId }, binding);
    this.primitiveResult(result);
    const accepted = this.renderer.materials;
    this.surfaceMaterials = this.packets.flatMap(entry => {
      const material = accepted.find(item => item.ref.modelId === entry.modelId
        && item.ref.geometryId === entry.packet.surfaceId);
      return material ? [{ ref: { modelId: entry.modelId, surfaceId: entry.packet.surfaceId },
        binding: material.binding }] : [];
    });
  }
  private nativeModel(modelId: string): BaroCadNativeResult['model'] | null {
    if (this.mixedDepth) return this.mixedDepth.native.model.name === modelId ? this.mixedDepth.native.model : null;
    if (this.selectedUniformCurve) return this.selectedUniformCurve.model.name === modelId
      ? this.selectedUniformCurve.model : null;
    if (this.uniformCurve) return this.uniformCurve.model.name === modelId ? this.uniformCurve.model : null;
    if (this.assembly) {
      const binding = this.assemblyInstances.find(value => value.ref.modelId === modelId);
      const document = this.assembly.documents.find(value =>
        value.document.documentId === binding?.reference.documentId);
      return document?.compiledAssets.find(value => value.assetId === binding?.reference.assetId)?.model ?? null;
    }
    if (this.document) {
      const body = this.documentBodies.find(value => value.ref.modelId === modelId);
      return body ? this.document.compiledAssets.find(asset =>
        asset.assetId === body.binding.assetId)?.model ?? null : null;
    }
    if (this.modelSet) return this.modelSet.entries.find(entry =>
      entry.aliasId.replaceAll('-', '.') === modelId)?.result.model ?? null;
    return this.native?.model.name === modelId ? this.native.model : null;
  }
  measureNativeSurfacePoints(firstInput: ViewerNativeSurfaceParameter,
    secondInput: ViewerNativeSurfaceParameter): ViewerNativeSurfaceMeasurement {
    this.live(); this.nativeScope(); check(!this.assembly, 'Use revision-pinned queryAssemblyInstancePoint for assembly inspection');
    const first = parseNativeParameter(firstInput), second = parseNativeParameter(secondInput);
    const model = this.nativeModel(first.modelId);
    check(model && second.modelId === first.modelId,
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
  applyMotionFrame(input: ViewerPoseFrame, inputBindings: ViewerMotionBinding[],
    inputOptions: { basis: 'part-xyz-matches-rhyup' }): void {
    this.gpuLive(); this.primitiveScope(); check(!this.assembly, 'Assembly authored poses cannot be overridden or reset'); check(this.packets.length > 0, 'Viewer has no surfaces');
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
  applyGeometryMotionFrame(input: ViewerPoseFrame, inputBindings: ViewerGeometryMotionBinding[],
    inputOptions: { basis: 'part-xyz-matches-rhyup' }): void {
    this.gpuLive(); this.primitiveScope(); check(!this.assembly, 'Assembly authored poses cannot be overridden or reset'); check(this.packets.length + this.curves.length > 0, 'Viewer has no geometry');
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
      const pose = curvePose({ modelId: entry.modelId, curveId: viewerCurveId(entry) }, geometryMotion);
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
    this.gpuLive(); this.primitiveScope(); check(!this.assembly, 'Assembly authored poses cannot be overridden or reset');
    if (this.motion || this.geometryMotion) this.present(this.packets, this.curves, this.camera,
      this.selected, null, this.selectedGeometry, null);
    this.motion = null;
    this.geometryMotion = null;
  }
  measureNativeCurvePoints(firstInput: ViewerNativeCurveParameter,
    secondInput: ViewerNativeCurveParameter): ViewerNativeCurveMeasurement {
    this.live(); this.nativeScope(); check(!this.assembly, 'Use revision-pinned queryAssemblyInstancePoint for assembly inspection');
    const first = parseNativeCurveParameter(firstInput), second = parseNativeCurveParameter(secondInput);
    const model = this.nativeModel(first.modelId);
    check(model && second.modelId === first.modelId,
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
    this.live(); this.nativeScope(); check(!this.assembly, 'Use revision-pinned queryAssemblyInstancePoint for assembly inspection');
    const surfaceParameter = parseNativeParameter(surfaceInput);
    const curveParameter = parseNativeCurveParameter(curveInput);
    const model = this.nativeModel(surfaceParameter.modelId);
    check(model && curveParameter.modelId === surfaceParameter.modelId,
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
    this.live(); this.nativeScope(); check(!this.assembly, 'Use revision-pinned queryAssemblyInstancePoint for assembly inspection');
    const first = parseNativePointInput(firstInput), second = parseNativePointInput(secondInput);
    const model = this.nativeModel(first.modelId);
    check(model && second.modelId === first.modelId,
      'Both points must belong to the accepted native model');
    const result = nativeDistance(this.evaluateNativePoint(first, model),
      this.evaluateNativePoint(second, model));
    this.nativeMeasurement = result;
    return structuredClone(result);
  }
  private evaluateNativePoint(input: ViewerNativePointInput,
    model: BaroCadNativeResult['model']): ViewerNativePoint {
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
  }
  projectNativePoint(input: ViewerNativePointInput): ViewerNativePointProjection | null {
    this.gpuLive(); this.primitiveScope(); check(!this.assembly, 'Use revision-pinned queryAssemblyInstancePoint for assembly inspection'); check(!this.contextLost, 'Cannot project after WebGL2 context loss');
    const parsed = parseNativePointInput(input);
    const ref: ViewerGeometryRef = parsed.kind === 'surface'
      ? { kind: 'surface', modelId: parsed.modelId, surfaceId: parsed.surfaceId }
      : { kind: 'curve', modelId: parsed.modelId, curveId: parsed.curveId };
    check(this.geometryRefs().some(value => sameGeometryRef(value, ref))
      && (this.visible(ref) || this.uniformCurve !== null || this.selectedUniformCurve !== null),
      'Native point must reference visible displayed geometry');
    const model = this.nativeModel(parsed.modelId);
    check(model, 'Native point has no accepted model');
    const point = this.evaluateNativePoint(parsed, model);
    if ((this.uniformCurve || this.selectedUniformCurve) && !this.visible(ref)) return null;
    const pose = parsed.kind === 'surface'
      ? surfacePose({ modelId: parsed.modelId, surfaceId: parsed.surfaceId }, this.motion, this.geometryMotion)
      : curvePose({ modelId: parsed.modelId, curveId: parsed.curveId }, this.geometryMotion);
    const displayPositionScene = displayVertex(point.pointMM, pose, this.options.mmToSceneUnit);
    check(displayPositionScene.every(Number.isFinite), 'Projected native point is not finite');
    const rect = this.canvas.getBoundingClientRect();
    check(rect.width > 0 && rect.height > 0, 'Canvas must have a visible CSS size for projection');
    const backward = unit(subtract(this.camera.eye, this.camera.target));
    const forward = multiply(backward, -1);
    const right = unit(cross(this.camera.up, backward)), up = cross(backward, right);
    const offset = subtract(displayPositionScene, this.camera.eye);
    const depthScene = dot(offset, forward);
    if (depthScene < this.camera.near || depthScene > this.camera.far) return null;
    const tangent = Math.tan(this.camera.fovYDegrees * Math.PI / 360);
    const aspect = this.canvas.width / this.canvas.height;
    const x = dot(offset, right) / (depthScene * tangent * aspect);
    const y = dot(offset, up) / (depthScene * tangent);
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return null;
    const documentBody = this.documentBodies.find(body => sameGeometryRef(body.ref, ref))?.binding ?? null;
    return structuredClone({ point, displayPositionScene,
      xCss: rect.width * (1 + x) / 2, yCss: rect.height * (1 - y) / 2,
      depthScene, approximate: true, occlusion: 'not-tested', documentBody });
  }
  setVisibleGeometry(input: ViewerGeometryRef[]): void {
    this.gpuLive(); this.primitiveScope();
    check(Array.isArray(input) && input.length <= 4, 'Visible geometry requires 0..4 references');
    const requested = denseArray(input, input.length, 'Visible geometry').map(parseGeometryRef);
    const inventory = this.geometryRefs();
    check(requested.every(ref => inventory.some(value => sameGeometryRef(value, ref))),
      'Visible geometry reference is unknown');
    check(requested.every((ref, index) => requested.findIndex(value => sameGeometryRef(value, ref)) === index),
      'Visible geometry references must be unique');
    const hidden = inventory.filter(ref => !requested.some(value => sameGeometryRef(value, ref)));
    check(!this.clothFrame || requested.some(ref => ref.kind === 'surface'),
      'Clear cloth layer before hiding the native Surface');
    check(!this.fluidFrame || requested.some(ref => ref.kind === 'surface'),
      'Clear fluid layer before hiding the native Surface');
    check(this.surfaceMaterials.every(material => requested.some(ref => ref.kind === 'surface'
      && sameRef(ref, material.ref))), 'Clear Surface material before hiding its native Surface');
    const selection = this.selectedGeometry && !hidden.some(ref => sameGeometryRef(ref, this.selectedGeometry!))
      ? this.selectedGeometry : null;
    const selected = selection?.kind === 'surface'
      ? { modelId: selection.modelId, surfaceId: selection.surfaceId } : null;
    if (this.renderer) this.present(this.packets, this.curves, this.camera, selected,
      this.motion, selection, this.geometryMotion, this.modelSet !== null || this.document !== null || this.assembly !== null || this.uniformCurve !== null
        || this.selectedUniformCurve !== null || this.nativeReplacement, hidden);
    this.hiddenGeometry = hidden;
    this.selected = selected;
    this.selectedGeometry = selection;
  }
  fit(): void {
    this.gpuLive();
    if (this.qualifiedFaceScene) {
      const bounds = qualifiedFaceDisplayBounds(this.qualifiedFaceScene);
      this.setView(cameraForBounds(bounds.min, bounds.max, this.canvas.width, this.canvas.height)); return;
    }
    check(!this.mixedDepth, 'Combined Sphere/native fit is unavailable in mixed depth mode');
    if (this.shell) {
      const bounds = this.shell.boundsScene;
      check(bounds, 'Native Shell scene has no filled display geometry to fit');
      this.setView(cameraForBounds(bounds.min, bounds.max, this.canvas.width, this.canvas.height)); return;
    }
    const packets = this.packets.filter(entry => this.visible({ kind: 'surface',
      modelId: entry.modelId, surfaceId: entry.packet.surfaceId }));
    const curves = this.curves.filter(entry => this.visible({ kind: 'curve',
      modelId: entry.modelId, curveId: viewerCurveId(entry) }));
    check(packets.length + curves.length > 0, 'Viewer has no visible geometry');
    this.setView(fittedCamera(packets, curves, this.options.mmToSceneUnit, this.canvas.width, this.canvas.height,
      this.motion, this.geometryMotion));
  }
  fitQualifiedFace(input: ViewerQualifiedFaceFitInput): void {
    this.gpuLive(); check(!this.contextLost, 'Cannot fit qualified Faces after WebGL2 context loss');
    check(this.qualifiedFaceScene, 'Viewer has no current qualified Face scene');
    const bounds = qualifiedFaceAssetDisplayBounds(this.qualifiedFaceScene, input);
    this.setView(cameraForBounds(bounds.min, bounds.max, this.canvas.width, this.canvas.height));
  }
  fitGeometry(input: ViewerGeometryRef): void {
    this.gpuLive(); this.primitiveScope();
    const ref = parseGeometryRef(input);
    check(this.visible(ref), 'Geometry reference is hidden');
    const packets = ref.kind === 'surface' ? this.packets.filter(entry =>
      entry.modelId === ref.modelId && entry.packet.surfaceId === ref.surfaceId) : [];
    const curves = ref.kind === 'curve' ? this.curves.filter(entry =>
      entry.modelId === ref.modelId && viewerCurveId(entry) === ref.curveId) : [];
    check(packets.length + curves.length === 1, 'Unknown displayed geometry reference');
    this.setView(fittedCamera(packets, curves, this.options.mmToSceneUnit,
      this.canvas.width, this.canvas.height, this.motion, this.geometryMotion));
  }
  private nativeDocumentBodyBounds(ref: ViewerGeometryRef, documentRevision: number):
    { low: Vec3; high: Vec3 } {
    check(this.document !== null, 'Native document fit requires an accepted CAD document');
    const body = this.documentBodies.find(value => sameGeometryRef(value.ref, ref));
    check(body && this.visible(ref), 'Native document fit requires one visible selected body');
    check(body.binding.documentRevision === documentRevision,
      'Native document fit reference is stale');
    const { reference } = createCadGeometryReference(this.document, { bodyId: body.binding.bodyId });
    const result = queryCadDocumentBounds(this.document, reference);
    validateCadDocumentBounds(this.document, result);
    check(reference.documentId === body.binding.documentId
      && reference.documentRevision === body.binding.documentRevision
      && reference.bodyId === body.binding.bodyId
      && reference.assetId === body.binding.assetId
      && reference.assetRevision === body.binding.assetRevision
      && reference.geometryId === body.binding.geometryId
      && reference.geometryKind === body.binding.geometryKind
      && reference.sourceFrame === body.binding.sourceFrame,
    'Native document bounds differ from the accepted Viewer body');
    const pose = ref.kind === 'surface'
      ? surfacePose(ref, this.motion, this.geometryMotion)
      : curvePose(ref, this.geometryMotion);
    const low: Vec3 = [Infinity, Infinity, Infinity], high: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const x of [result.boundsMM.min[0], result.boundsMM.max[0]]) {
      for (const y of [result.boundsMM.min[1], result.boundsMM.max[1]]) {
        for (const z of [result.boundsMM.min[2], result.boundsMM.max[2]]) {
          const point = displayVertex([x, y, z], pose, this.options.mmToSceneUnit);
          for (let axis = 0; axis < 3; axis++) {
            low[axis] = Math.min(low[axis], point[axis]);
            high[axis] = Math.max(high[axis], point[axis]);
          }
        }
      }
    }
    check(low.every((value, axis) => Number.isFinite(value) && Number.isFinite(high[axis])
      && value <= high[axis] && Math.abs(value) <= 1000 && Math.abs(high[axis]) <= 1000),
    'Native document bounds exceed finite GPU coordinates');
    return { low, high };
  }
  fitNativeDocumentBody(input: ViewerNativeDocumentFitInput): void {
    this.gpuLive(); this.primitiveScope(); check(!this.contextLost, 'Cannot fit after WebGL2 context loss');
    const data = ownRecord(input, ['ref', 'documentRevision'], 'Native document fit');
    const ref = parseGeometryRef(data.ref);
    check(Number.isInteger(data.documentRevision) && (data.documentRevision as number) >= 0
      && (data.documentRevision as number) <= 2147483647,
    'Native document fit requires a bounded document revision');
    const { low, high } = this.nativeDocumentBodyBounds(ref, data.documentRevision as number);
    this.setView(cameraForBounds(low, high, this.canvas.width, this.canvas.height));
  }
  fitNativeDocumentBodies(input: ViewerNativeDocumentBodiesFitInput): void {
    this.gpuLive(); this.primitiveScope(); check(!this.contextLost, 'Cannot fit after WebGL2 context loss');
    const data = ownRecord(input, ['refs', 'documentRevision'], 'Native document body-set fit');
    check(Array.isArray(data.refs) && data.refs.length >= 2 && data.refs.length <= 4,
      'Native document body-set fit requires 2..4 references');
    const refs = denseArray(data.refs, data.refs.length, 'Native document body-set references')
      .map(parseGeometryRef);
    check(refs.every((ref, index) => refs.findIndex(other => sameGeometryRef(ref, other)) === index),
      'Native document body-set references must be unique');
    check(Number.isInteger(data.documentRevision) && (data.documentRevision as number) >= 0
      && (data.documentRevision as number) <= 2147483647,
    'Native document body-set fit requires a bounded document revision');
    const low: Vec3 = [Infinity, Infinity, Infinity], high: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const ref of refs) {
      const bounds = this.nativeDocumentBodyBounds(ref, data.documentRevision as number);
      for (let axis = 0; axis < 3; axis++) {
        low[axis] = Math.min(low[axis], bounds.low[axis]);
        high[axis] = Math.max(high[axis], bounds.high[axis]);
      }
    }
    this.setView(cameraForBounds(low, high, this.canvas.width, this.canvas.height));
  }
  attachPointerControls(options: ViewerPointerControlOptions = {}): ViewerPointerControls {
    this.live();
    check(options !== null && typeof options === 'object'
      && Object.getPrototypeOf(options) === Object.prototype,
    'Pointer control options must be plain data');
    const keys = Reflect.ownKeys(options);
    check(keys.length <= 1 && keys.every(key => key === 'onError'),
      'Pointer control options have unsupported fields');
    const value = ownRecord(options, keys as string[], 'Pointer control options');
    check(value.onError === undefined || typeof value.onError === 'function',
      'Pointer control onError must be a function');
    const onError = value.onError as ((error: unknown) => void) | undefined;
    const canvas = this.canvas;
    type Gesture = { id: number; x: number; y: number; startX: number; startY: number;
      mode: 'orbit' | 'pan'; dragged: boolean };
    let active: Gesture | null = null;
    let suppressClick = false;
    let disposed = false;
    const report = (error: unknown): void => { onError?.(error); };
    const rect = (): DOMRect => {
      const value = canvas.getBoundingClientRect();
      check(Number.isFinite(value.width) && Number.isFinite(value.height)
        && value.width > 0 && value.height > 0,
      'Pointer controls require a visible CSS canvas');
      return value;
    };
    const end = (): void => {
      const gesture = active;
      active = null;
      if (gesture && canvas.hasPointerCapture(gesture.id)) {
        try { canvas.releasePointerCapture(gesture.id); } catch { /* Capture was already lost. */ }
      }
    };
    const down = (event: PointerEvent): void => {
      if (disposed || active || !event.isPrimary || event.button !== 0) return;
      try {
        rect();
        check(Number.isFinite(event.clientX) && Number.isFinite(event.clientY),
          'Pointer coordinates must be finite');
        canvas.setPointerCapture(event.pointerId);
        active = { id: event.pointerId, x: event.clientX, y: event.clientY,
          startX: event.clientX, startY: event.clientY,
          mode: event.shiftKey ? 'pan' : 'orbit', dragged: false };
        suppressClick = false;
        event.preventDefault();
      } catch (error) { report(error); }
    };
    const move = (event: PointerEvent): void => {
      const gesture = active;
      if (disposed || !gesture || event.pointerId !== gesture.id) return;
      if (!canvas.hasPointerCapture(gesture.id)) { active = null; return; }
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) { end(); return; }
      try {
        const bounds = rect();
        check(Number.isFinite(event.clientX) && Number.isFinite(event.clientY),
          'Pointer coordinates must be finite');
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (dx === 0 && dy === 0) return;
        if (gesture.mode === 'orbit') {
          this.orbit(Math.max(-Math.PI * 2, Math.min(Math.PI * 2, 2 * Math.PI * dx / bounds.width)),
            Math.max(-Math.PI, Math.min(Math.PI, Math.PI * dy / bounds.height)));
        } else {
          const camera = this.camera;
          const distance = Math.hypot(...subtract(camera.eye, camera.target));
          const perPixel = 2 * distance * Math.tan(camera.fovYDegrees * Math.PI / 360) / bounds.height;
          check(Number.isFinite(perPixel), 'Pointer pan scale must be finite');
          this.pan(Math.max(-1000, Math.min(1000, -dx * perPixel)),
            Math.max(-1000, Math.min(1000, dy * perPixel)));
        }
        gesture.x = event.clientX; gesture.y = event.clientY;
        gesture.dragged ||= Math.hypot(event.clientX - gesture.startX,
          event.clientY - gesture.startY) > 3;
        event.preventDefault();
      } catch (error) { end(); report(error); }
    };
    const up = (event: PointerEvent): void => {
      if (!active || event.pointerId !== active.id) return;
      suppressClick = active.dragged;
      end();
    };
    const cancel = (event: PointerEvent): void => {
      if (active?.id === event.pointerId) { suppressClick = false; end(); }
    };
    const lost = (event: PointerEvent): void => {
      if (active?.id === event.pointerId) active = null;
    };
    const click = (event: MouseEvent): void => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const wheel = (event: WheelEvent): void => {
      if (disposed) return;
      try {
        const bounds = rect();
        check(Number.isFinite(event.deltaY) && [0, 1, 2].includes(event.deltaMode),
          'Wheel delta must be finite in a supported mode');
        const pixels = event.deltaY * (event.deltaMode === 1 ? 16
          : event.deltaMode === 2 ? bounds.height : 1);
        this.zoom(Math.max(0.1, Math.min(10, Math.exp(-pixels * 0.001))));
        event.preventDefault();
      } catch (error) { report(error); }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', lost);
    canvas.addEventListener('click', click, true);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return { dispose: (): void => {
      if (disposed) return;
      disposed = true;
      end();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', lost);
      canvas.removeEventListener('click', click, true);
      canvas.removeEventListener('wheel', wheel);
    } };
  }
  attachKeyboardControls(options: ViewerKeyboardControlOptions = {}): ViewerKeyboardControls {
    this.live();
    check(options !== null && typeof options === 'object'
      && Object.getPrototypeOf(options) === Object.prototype,
    'Keyboard control options must be plain data');
    const keys = Reflect.ownKeys(options);
    check(keys.length <= 1 && keys.every(key => key === 'onError'),
      'Keyboard control options have unsupported fields');
    const value = ownRecord(options, keys as string[], 'Keyboard control options');
    check(value.onError === undefined || typeof value.onError === 'function',
      'Keyboard control onError must be a function');
    const onError = value.onError as ((error: unknown) => void) | undefined;
    const canvas = this.canvas;
    let disposed = false;
    const keydown = (event: KeyboardEvent): void => {
      if (disposed || this.disposed || event.target !== canvas || event.repeat || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'f' && event.key !== 'F' && event.key !== 'Escape') return;
      try {
        if (event.key === 'Escape') this.selectGeometry(null);
        else this.fit();
        event.preventDefault();
      } catch (error) { onError?.(error); }
    };
    canvas.addEventListener('keydown', keydown);
    return { dispose: (): void => {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('keydown', keydown);
    } };
  }
  setView(input: MeshCamera): void {
    this.gpuLive(); const camera = validateMeshCamera(input);
    if (this.renderer instanceof QualifiedFaceSceneRenderer) {
      check(this.qualifiedFaceScene, 'Qualified Face authority is missing');
      const scene = prepareQualifiedFaceScene({ ...this.qualifiedFaceScene, camera });
      this.qualifiedFaceResult(this.renderer.updateScene(scene));
      this.qualifiedFaceScene = scene;
    } else if (this.renderer instanceof MixedDepthRenderer) {
      check(this.mixedDepth, 'Mixed depth authority is missing');
      const frame = prepareMixedDepthFrame({ ...this.mixedDepth.frame, camera });
      this.mixedResult(this.renderer.updateFrame(frame));
      this.mixedDepth = { native: this.mixedDepth.native, frame };
    } else if (this.renderer instanceof BooleanShellSceneRenderer) {
      const result = this.renderer.setOptions(this.gpuOptions(camera));
      if (!result.ok) throw result.error;
    } else if (this.renderer) this.present(this.packets, this.curves, camera, this.selected, this.motion);
    this.camera = camera;
  }
  orbit(deltaAzimuthRadians: number, deltaElevationRadians: number): void {
    this.gpuLive(); const az = finite(deltaAzimuthRadians, 'Orbit azimuth', -Math.PI * 2, Math.PI * 2);
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
    this.gpuLive(); const x = finite(deltaXScene, 'Pan X', -1000, 1000), y = finite(deltaYScene, 'Pan Y', -1000, 1000);
    const backward = unit(subtract(this.camera.eye, this.camera.target));
    const right = unit(cross(this.camera.up, backward)), vertical = cross(backward, right);
    const shift = add(multiply(right, x), multiply(vertical, y));
    this.setView({ ...this.camera, eye: add(this.camera.eye, shift), target: add(this.camera.target, shift) });
  }
  zoom(factor: number): void {
    this.gpuLive(); finite(factor, 'Zoom factor', 0.1, 10);
    const offset = multiply(subtract(this.camera.eye, this.camera.target), 1 / factor);
    const distance = Math.hypot(...offset), near = Math.max(0.0001, distance / 1000), far = Math.min(10000, distance * 1000);
    this.setView({ ...this.camera, eye: add(this.camera.target, offset), near, far });
  }
  pick(xCss: number, yCss: number): ViewerPick | null {
    this.gpuLive(); this.primitiveScope(); check(!this.contextLost, 'Cannot pick after WebGL2 context loss');
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
      if (!this.visible({ kind: 'surface', modelId: entry.modelId,
        surfaceId: entry.packet.surfaceId })) continue;
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
  pickShell(point: ViewerGeometryPoint): ViewerShellPick | null {
    this.gpuLive(); check(!this.contextLost, 'Cannot pick Shell after WebGL2 context loss');
    check(this.shell, 'Viewer has no current Shell scene');
    const rect = this.canvas.getBoundingClientRect();
    return pickViewerShell(this.shell, point, this.camera, this.options.mmToSceneUnit,
      this.canvas.width, this.canvas.height, rect.width, rect.height);
  }
  pickGeometry(pointInput: ViewerGeometryPoint,
    optionsInput?: ViewerGeometryPickOptions): ViewerGeometryPick | null {
    this.gpuLive(); this.primitiveScope(); check(!this.contextLost, 'Cannot pick after WebGL2 context loss');
    const point = ownRecord(pointInput, ['xCss', 'yCss'], 'Geometry pick point');
    const xCss = finite(point.xCss, 'Pick X', 0, 4096);
    const yCss = finite(point.yCss, 'Pick Y', 0, 4096);
    let tolerance = 4;
    let kinds: Array<'surface' | 'curve'> = ['surface', 'curve'];
    if (optionsInput !== undefined) {
      check(optionsInput !== null && typeof optionsInput === 'object'
        && Object.getPrototypeOf(optionsInput) === Object.prototype,
      'Geometry pick options must be plain data');
      const keys = Reflect.ownKeys(optionsInput);
      check(keys.length <= 2 && keys.every(key => key === 'curveTolerancePx' || key === 'kinds'),
        'Geometry pick options have unsupported fields');
      const options = ownRecord(optionsInput, keys as string[], 'Geometry pick options');
      if (Object.hasOwn(options, 'curveTolerancePx')) {
        tolerance = finite(options.curveTolerancePx, 'Curve pick tolerance', 0.5, 16);
      }
      if (Object.hasOwn(options, 'kinds')) {
        check(Array.isArray(options.kinds) && options.kinds.length <= 2,
          'Geometry pick kinds require 0..2 entries');
        kinds = denseArray(options.kinds, options.kinds.length, 'Geometry pick kinds').map(kind => {
          check(kind === 'surface' || kind === 'curve', 'Unknown geometry pick kind');
          return kind;
        });
        check(new Set(kinds).size === kinds.length, 'Duplicate geometry pick kind');
      }
    }
    const rect = this.canvas.getBoundingClientRect();
    check(rect.width > 0 && rect.height > 0, 'Canvas must have a visible CSS size for picking');
    check(xCss <= rect.width && yCss <= rect.height, 'Pick point is outside canvas');
    if (!kinds.length) return null;
    const surface = kinds.includes('surface') ? this.pick(xCss, yCss) : null;
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
    for (const entry of kinds.includes('curve') ? this.curves : []) {
      if (!this.visible({ kind: 'curve', modelId: entry.modelId,
        curveId: viewerCurveId(entry) })) continue;
      const sample = entry.sample, curveId = viewerCurveId(entry);
      const pose = curvePose({ modelId: entry.modelId, curveId }, this.geometryMotion);
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
        const curve = this.nativeModel(entry.modelId)?.objects.find(object => object.kind === 'curve'
          && object.id === curveId);
        check(curve && curve.kind === 'curve', 'Displayed Curve has no accepted native authority');
        const nativePointMM = [...evaluateCurve(curve, parameterApprox)] as Vec3;
        candidates.push({ result: { kind: 'curve',
          ref: { modelId: entry.modelId, curveId }, segmentIndex: index,
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
    this.gpuLive();
    check(!this.qualifiedFaceScene, 'Qualified Face selection is unavailable');
    check(!this.mixedDepth, 'Mixed depth native selection is unavailable');
    if (this.shell) {
      check(!this.contextLost, 'Cannot select after WebGL2 context loss');
      check(input === null, 'Native Shell selection is unavailable'); return;
    }
    const selected = input === null ? null : parseRef(input);
    check(selected === null || this.packets.some(entry => this.visible({ kind: 'surface',
      modelId: entry.modelId, surfaceId: entry.packet.surfaceId }) && sameRef(
      { modelId: entry.modelId, surfaceId: entry.packet.surfaceId }, selected)), 'Unknown surface reference');
    check(!this.surfaceMaterials.some(material => sameRef(selected, material.ref)),
      'Clear Surface material before selecting the bound Surface');
    const geometrySelection: ViewerGeometryRef | null = selected
      ? { kind: 'surface', ...selected } : null;
    if (this.renderer) this.present(this.packets, this.curves, this.camera, selected, this.motion,
      geometrySelection);
    this.selected = selected;
    this.selectedGeometry = geometrySelection;
  }
  selectGeometry(input: ViewerGeometryRef | null): void {
    this.gpuLive();
    check(!this.qualifiedFaceScene, 'Qualified Face selection is unavailable');
    check(!this.mixedDepth, 'Mixed depth native selection is unavailable');
    if (this.shell) {
      check(!this.contextLost, 'Cannot select after WebGL2 context loss');
      check(input === null, 'Native Shell selection is unavailable'); return;
    }
    const selection = input === null ? null : parseGeometryRef(input);
    check(selection === null || this.visible(selection), 'Geometry reference is hidden');
    if (selection?.kind === 'surface') {
      check(this.packets.some(entry => entry.modelId === selection.modelId
        && entry.packet.surfaceId === selection.surfaceId), 'Unknown displayed Surface reference');
      check(!this.surfaceMaterials.some(material => sameRef(selection, material.ref)),
        'Clear Surface material before selecting the bound Surface');
    } else if (selection?.kind === 'curve') {
      check(this.curves.some(entry => entry.modelId === selection.modelId
        && viewerCurveId(entry) === selection.curveId), 'Unknown displayed Curve reference');
    }
    const surface = selection?.kind === 'surface'
      ? { modelId: selection.modelId, surfaceId: selection.surfaceId } : null;
    if (this.renderer) this.present(this.packets, this.curves, this.camera, surface, this.motion, selection);
    this.selected = surface;
    this.selectedGeometry = selection;
  }
  resize(width: number, height: number): void {
    this.gpuLive(); this.dimensions(width, height);
    if (this.renderer instanceof QualifiedFaceSceneRenderer) this.qualifiedFaceResult(this.renderer.resize(width, height));
    else if (this.renderer instanceof MixedDepthRenderer) this.mixedResult(this.renderer.resize(width, height));
    else if (this.renderer) this.renderer.resize(width, height);
    else { this.canvas.width = width; this.canvas.height = height; }
  }
  getState(): ViewerState {
    const status = this.disposed ? 'disposed' : this.contextLost ? 'context-lost' : this.presentationUnavailable ? 'unavailable'
      : this.packets.length + this.curves.length || this.shell?.boundsScene || this.qualifiedFaceScene ? 'ready' : 'empty';
    return structuredClone({ status, frame: 'right-handed-y-up', sourceUnit: 'mm',
      mmToSceneUnit: this.options.mmToSceneUnit, camera: this.camera,
      lighting: this.acceptedLighting ?? this.options.lighting ?? null,
      surfaces: this.packets.map(entry => ({ modelId: entry.modelId, surfaceId: entry.packet.surfaceId })),
      curves: this.curves.map(entry => ({ modelId: entry.modelId, curveId: viewerCurveId(entry) })),
      visibleGeometry: this.geometryRefs().filter(ref => this.visible(ref)),
      curveSampleVersion: this.curves.length ? this.curves[0].sampleVersion : null,
      uniformCurve: this.uniformCurve,
      selectedUniformCurve: this.selectedUniformCurve,
      mixedDepth: this.mixedDepth,
      qualifiedFaceScene: this.qualifiedFaceScene,
      packets: this.packets,
      selected: this.selected, selectedGeometry: this.selectedGeometry,
      native: this.native, modelSet: this.modelSet, document: this.document,
      documentBodies: this.documentBodies, assembly: this.assembly, shell: this.shell,
      assemblyInstances: this.assemblyInstances, measurement: this.measurement,
      curveMeasurement: this.curveMeasurement, surfaceCurveMeasurement: this.surfaceCurveMeasurement,
      nativeMeasurement: this.nativeMeasurement, motion: this.motion,
      geometryMotion: this.geometryMotion, fluidFrame: this.fluidFrame, clothFrame: this.clothFrame,
      surfaceMaterial: this.surfaceMaterials.length === 1 ? this.surfaceMaterials[0] : null,
      surfaceMaterials: this.surfaceMaterials });
  }
  readPixels(): Uint8Array {
    this.gpuLive(); check(this.renderer, 'Viewer has no geometry');
    try { return this.renderer.readPixels(); }
    catch (error) {
      if (!this.contextLost && this.renderer instanceof MixedDepthRenderer
        && error instanceof MixedDepthError && error.code === 'CONTEXT') this.presentationUnavailable = true;
      if (!this.contextLost && this.renderer instanceof QualifiedFaceSceneRenderer
        && error instanceof QualifiedFaceSceneError && error.code === 'CONTEXT') this.presentationUnavailable = true;
      throw error;
    }
  }
  dispose(): void { if (this.disposed) return; this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.dispose(); this.renderer = null; this.fluidFrame = null; this.particleLayer = null;
    this.surfaceMaterials = []; this.clothFrame = null; this.clothLayer = null;
    if (this.qualifiedFaceScene) {
      this.packets = []; this.curves = []; this.hiddenGeometry = []; this.selected = null; this.selectedGeometry = null;
      this.motion = null; this.geometryMotion = null; this.measurement = null; this.curveMeasurement = null;
      this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    }
    if (this.mixedDepth) {
      this.packets = []; this.curves = []; this.hiddenGeometry = []; this.selected = null; this.selectedGeometry = null;
      this.motion = null; this.geometryMotion = null; this.measurement = null; this.curveMeasurement = null;
      this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    }
    if (this.nativeReplacement) {
      this.native = null; this.document = null; this.documentBodies = []; this.packets = []; this.curves = [];
      this.hiddenGeometry = []; this.motion = null; this.geometryMotion = null; this.selected = null; this.selectedGeometry = null;
      this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    }
    this.nativeReplacement = false; this.appearanceDocument = null;
    if (this.assembly || this.uniformCurve || this.selectedUniformCurve) { this.motion = null; this.geometryMotion = null; }
    if (this.selectedUniformCurve) {
      this.curves = []; this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
      this.measurement = null; this.curveMeasurement = null; this.surfaceCurveMeasurement = null; this.nativeMeasurement = null;
    }
    if (this.uniformCurve) {
      this.curves = []; this.selected = null; this.selectedGeometry = null; this.hiddenGeometry = [];
    }
    this.uniformCurve = null; this.selectedUniformCurve = null; this.mixedDepth = null; this.qualifiedFaceScene = null;
    this.assembly = null; this.assemblyInstances = []; this.shell = null; }
}

export function createViewer(canvas: HTMLCanvasElement, options: ViewerOptions): Viewer {
  return new Viewer(canvas, parseViewerOptions(options));
}

export { prepareViewerNativeSceneAppearance } from './native-scene-appearance.js';
export type { ViewerNativeSceneAppearanceInputV1, ViewerNativeSceneAppearanceContext,
  PreparedViewerNativeSceneAppearance } from './native-scene-appearance.js';

// Explicit async native-document authored-light consumer; no default backend change.
export { createNativeDirectionalLightWebGPUViewer } from './native-directional-light-webgpu.js';
export { ViewerNativeDirectionalLightError } from './native-directional-light-candidate.js';
export type { ViewerNativeDirectionalLightCode, ViewerNativeDirectionalLightOwner,
  ViewerNativeDirectionalLightInput, ViewerNativeDirectionalLightAccepted,
  ViewerNativeDirectionalLightPick } from './native-directional-light-candidate.js';
export type { ViewerNativeDirectionalLightWebGPU } from './native-directional-light-webgpu.js';

// Explicit original-document native UV01 route; existing Viewer defaults are unchanged.
export { createNativeSurfaceUV01WebGPUViewer } from './native-surface-uv01-webgpu.js';
export { ViewerNativeSurfaceUV01Error } from './native-surface-uv01-candidate.js';
export type { ViewerNativeSurfaceUV01Code, ViewerNativeSurfaceUV01Owner, ViewerNativeSurfaceUV01Material,
  ViewerNativeSurfaceUV01Input, ViewerNativeSurfaceUV01Accepted, ViewerNativeSurfaceUV01Pick } from './native-surface-uv01-candidate.js';
export type { ViewerNativeSurfaceUV01WebGPU } from './native-surface-uv01-webgpu.js';
