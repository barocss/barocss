import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { validateMeshCamera } from '../mesh/camera.js';
import type { MeshCamera } from '../mesh/camera.js';
import type { EngineRayV0 } from './engine-raycast.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineCameraRayDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', CAMERA: 'CAMERA', RANGE: 'RANGE', NUMERICAL: 'NUMERICAL',
} as const);
export type EngineCameraRayDiagnosticCode = typeof EngineCameraRayDiagnosticCode[keyof typeof EngineCameraRayDiagnosticCode];
export class EngineCameraRayError extends BarocssError {
  constructor(readonly code: EngineCameraRayDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Engine camera ray: ' + detail, cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
    this.name = 'EngineCameraRayError';
  }
}

/** Explicit backing-pixel indices; no CSS coordinates or inferred dimensions. */
export interface EngineCameraRayRequestV0 {
  format: 'barocss-gpu-engine-camera-ray-request'; version: 0;
  pixelOrigin: 'bottom-left'; sampling: 'pixel-center';
  viewportWidth: number; viewportHeight: number; pixelX: number; pixelY: number;
}
export interface PreparedEngineCameraRay {
  readonly camera: MeshCamera;
  readonly request: EngineCameraRayRequestV0;
  /** Derived Number-space ray; not a Float32 or rendered-pixel observation. */
  readonly ray: EngineRayV0;
}
const CODE = EngineCameraRayDiagnosticCode;
function check(value: unknown, code: EngineCameraRayDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineCameraRayError(code, detail);
}
function integer(value: unknown, minimum: number, maximum: number, label: string): number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum,
    CODE.RANGE, label + ' must be an integer within ' + minimum + '..' + maximum);
  return value;
}
function request(input: unknown): EngineCameraRayRequestV0 {
  let data: Record<string, unknown>;
  try {
    data = ownRecord(input, ['format', 'version', 'pixelOrigin', 'sampling',
      'viewportWidth', 'viewportHeight', 'pixelX', 'pixelY']);
  } catch (cause) {
    throw new EngineCameraRayError(CODE.INPUT, 'Request own-data reflection refused', cause);
  }
  check(data.format === 'barocss-gpu-engine-camera-ray-request' && data.version === 0
    && data.pixelOrigin === 'bottom-left' && data.sampling === 'pixel-center', CODE.VERSION,
  'Only request0/bottom-left/pixel-center metadata is supported');
  const viewportWidth = integer(data.viewportWidth, 1, 2048, 'Viewport width');
  const viewportHeight = integer(data.viewportHeight, 1, 2048, 'Viewport height');
  const pixelX = integer(data.pixelX, 0, viewportWidth - 1, 'Pixel X');
  const pixelY = integer(data.pixelY, 0, viewportHeight - 1, 'Pixel Y');
  return Object.freeze({ format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth, viewportHeight, pixelX, pixelY });
}
function normalize(value: Vec3): Vec3 {
  const scale = Math.max(...value.map(Math.abs));
  check(Number.isFinite(scale) && scale > 0, CODE.NUMERICAL, 'Direction scale is nonfinite or zero');
  const scaled = value.map(n => n / scale), length = Math.hypot(...scaled);
  check(Number.isFinite(length) && length > 0, CODE.NUMERICAL, 'Direction length is nonfinite or zero');
  return scaled.map(n => n / length) as [number, number, number];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Derive a ray0 from the complete original camera and one admitted pixel centre. */
export function prepareEngineCameraRay(cameraInput: unknown, requestInput: unknown): PreparedEngineCameraRay {
  const originalRequest = request(requestInput);
  let camera: MeshCamera;
  try { camera = validateMeshCamera(cameraInput); }
  catch (cause) { throw new EngineCameraRayError(CODE.CAMERA, 'Actual original camera validation refused', cause); }
  const backward = normalize(camera.eye.map((n, i) => n - camera.target[i]) as [number, number, number]);
  const right = normalize(cross(normalize(camera.up), backward)), vertical = cross(backward, right);
  const x = 2 * (originalRequest.pixelX + 0.5) / originalRequest.viewportWidth - 1;
  const y = 2 * (originalRequest.pixelY + 0.5) / originalRequest.viewportHeight - 1;
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const horizontal = x * (originalRequest.viewportWidth / originalRequest.viewportHeight) * tangent;
  const direction = normalize(right.map((n, i) => n * horizontal + vertical[i] * y * tangent - backward[i]) as [number, number, number]);
  const length = Math.hypot(...direction);
  check(direction.every(n => Number.isFinite(n) && Math.abs(n) <= 1)
    && Number.isFinite(length) && Math.abs(length - 1) <= 1e-9, CODE.NUMERICAL,
  'Derived direction does not satisfy the existing ray0 unit contract');
  // Match the existing ray query's second normalization when mapping camera planes.
  const queryDirection = direction.map(n => n / length) as [number, number, number];
  const facing = -dot(queryDirection, backward);
  check(Number.isFinite(facing) && facing > 0, CODE.NUMERICAL, 'Derived ray does not face the camera clip planes');
  const near = camera.near / facing, far = camera.far / facing;
  check(Number.isFinite(near) && Number.isFinite(far) && near >= 0 && near <= far && far <= 10000,
    CODE.RANGE, 'Along-ray clips exceed the existing ray0 distance limit; no clamp is applied');
  const origin = [...camera.eye] as Vec3;
  Object.freeze(origin); Object.freeze(direction);
  const ray: EngineRayV0 = Object.freeze({ format: 'barocss-gpu-engine-ray', version: 0,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near, far });
  return Object.freeze({ camera, request: originalRequest, ray });
}
