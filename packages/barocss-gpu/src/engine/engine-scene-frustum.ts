import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineSceneFrustumDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', RANGE: 'RANGE', SCENE: 'SCENE', NUMERICAL: 'NUMERICAL',
} as const);
export type EngineSceneFrustumDiagnosticCode = typeof EngineSceneFrustumDiagnosticCode[keyof typeof EngineSceneFrustumDiagnosticCode];
export class EngineSceneFrustumError extends Error {
  constructor(readonly code: EngineSceneFrustumDiagnosticCode, detail: string, cause?: unknown) {
    super(('Engine scene frustum: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'EngineSceneFrustumError';
  }
}
export interface EngineSceneFrustumRequestV0 {
  format: 'barocss-gpu-engine-scene-frustum-request'; version: 0;
  viewportWidth: number; viewportHeight: number;
}
type PlaneName = 'near' | 'far' | 'left' | 'right' | 'bottom' | 'top';
export interface EngineSceneFrustumEntryV0 {
  nodeId: string; geometryId: string; materialId: string;
  classification: 'inside' | 'intersecting' | 'outside' | 'hidden';
  outsidePlane: PlaneName | null;
}
export interface PreparedEngineSceneFrustum {
  readonly scene: EngineSceneV0;
  readonly request: EngineSceneFrustumRequestV0;
  readonly entries: EngineSceneFrustumEntryV0[];
  readonly candidateNodeIds: string[];
}
const CODE = EngineSceneFrustumDiagnosticCode;
function check(value: unknown, code: EngineSceneFrustumDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineSceneFrustumError(code, detail);
}
function request(input: unknown): EngineSceneFrustumRequestV0 {
  const data = ownRecord(input, ['format', 'version', 'viewportWidth', 'viewportHeight']);
  check(data.format === 'barocss-gpu-engine-scene-frustum-request' && data.version === 0,
    CODE.VERSION, 'Only frustum request0 is supported');
  for (const field of ['viewportWidth', 'viewportHeight']) check(typeof data[field] === 'number'
    && Number.isInteger(data[field]) && (data[field] as number) >= 1 && (data[field] as number) <= 2048,
  CODE.RANGE, 'Viewport dimensions must be explicit integers within1..2048');
  return Object.freeze({ format: 'barocss-gpu-engine-scene-frustum-request', version: 0,
    viewportWidth: data.viewportWidth as number, viewportHeight: data.viewportHeight as number });
}
function normalize(value: Vec3): Vec3 {
  const scale = Math.max(...value.map(Math.abs));
  check(Number.isFinite(scale) && scale > 0, CODE.NUMERICAL, 'Plane direction scale is unsafe');
  const scaled = value.map(n => n / scale), length = Math.hypot(...scaled);
  check(Number.isFinite(length) && length > 0, CODE.NUMERICAL, 'Plane direction length is unsafe');
  const result = scaled.map(n => n / length) as Vec3;
  check(result.every(Number.isFinite), CODE.NUMERICAL, 'Plane direction is nonfinite'); return result;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
interface Plane { name: PlaneName; normal: Vec3; offset: number }
function classify(min: Vec3, max: Vec3, eye: Vec3, planes: Plane[]): Pick<EngineSceneFrustumEntryV0, 'classification' | 'outsidePlane'> {
  const center = min.map((n, i) => (n + max[i]) / 2 - eye[i]) as Vec3;
  const extents = min.map((n, i) => (max[i] - n) / 2) as Vec3;
  check(center.every(Number.isFinite) && extents.every(n => Number.isFinite(n) && n >= 0),
    CODE.NUMERICAL, 'Original bounds cannot form finite centre and radii');
  let inside = true;
  for (const plane of planes) {
    const normal = plane.normal;
    const distance = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2] + plane.offset;
    const radius = Math.abs(normal[0]) * extents[0] + Math.abs(normal[1]) * extents[1] + Math.abs(normal[2]) * extents[2];
    const minimum = distance - radius, maximum = distance + radius, band = 1e-9 * (1 + Math.abs(distance) + radius);
    check([distance, radius, minimum, maximum, band].every(Number.isFinite), CODE.NUMERICAL,
      'Plane interval or boundary band is nonfinite');
    if (maximum < -band) return { classification: 'outside', outsidePlane: plane.name };
    if (minimum <= band) inside = false;
  }
  return { classification: inside ? 'inside' : 'intersecting', outsidePlane: null };
}

/** Original Number-camera/AABB candidates; never changes renderer draws or source. */
export function prepareEngineSceneFrustum(sceneInput: unknown, requestInput: unknown): PreparedEngineSceneFrustum {
  try {
    const originalRequest = request(requestInput);
    let prepared: ReturnType<typeof prepareEngineScene>;
    try { prepared = prepareEngineScene(sceneInput); }
    catch (cause) { throw new EngineSceneFrustumError(CODE.SCENE, 'Actual complete scene admission refused', cause); }
    const camera = prepared.scene.camera;
    const backward = normalize(camera.eye.map((n, i) => n - camera.target[i]) as Vec3);
    const forward = backward.map(n => -n) as Vec3;
    const right = normalize(cross(normalize(camera.up), backward)), vertical = cross(backward, right);
    const tanY = Math.tan(camera.fovYDegrees * Math.PI / 360);
    const tanX = tanY * originalRequest.viewportWidth / originalRequest.viewportHeight;
    check(Number.isFinite(tanY) && tanY > 0 && Number.isFinite(tanX) && tanX > 0,
      CODE.NUMERICAL, 'Original viewport camera tangent is unsafe');
    const side = (axis: Vec3, tangent: number, sign: number) => normalize(forward.map((n, i) =>
      n * tangent + sign * axis[i]) as Vec3);
    const planes: Plane[] = [
      { name: 'near', normal: forward, offset: -camera.near },
      { name: 'far', normal: backward, offset: camera.far },
      { name: 'left', normal: side(right, tanX, 1), offset: 0 },
      { name: 'right', normal: side(right, tanX, -1), offset: 0 },
      { name: 'bottom', normal: side(vertical, tanY, 1), offset: 0 },
      { name: 'top', normal: side(vertical, tanY, -1), offset: 0 },
    ];
    const nodes = new Map(prepared.nodes.map(node => [node.id, node]));
    const entries: EngineSceneFrustumEntryV0[] = [];
    const candidateNodeIds: string[] = [];
    for (const source of prepared.scene.nodes) if (source.type === 'mesh') {
      const node = nodes.get(source.id)!;
      let observation: Pick<EngineSceneFrustumEntryV0, 'classification' | 'outsidePlane'>;
      if (!node.effectiveVisible) observation = { classification: 'hidden', outsidePlane: null };
      else {
        check(node.bounds, CODE.NUMERICAL, 'An admitted mesh must have original world bounds');
        observation = classify(node.bounds.min, node.bounds.max, camera.eye, planes);
      }
      entries.push(Object.freeze({ nodeId: source.id, geometryId: source.geometryId,
        materialId: source.materialId, ...observation }));
      if (observation.classification === 'inside' || observation.classification === 'intersecting') candidateNodeIds.push(source.id);
    }
    Object.freeze(entries); Object.freeze(candidateNodeIds);
    return Object.freeze({ scene: prepared.scene, request: originalRequest, entries, candidateNodeIds });
  } catch (cause) {
    if (cause instanceof EngineSceneFrustumError) throw cause;
    throw new EngineSceneFrustumError(CODE.INPUT, 'Own request reflection refused', cause);
  }
}
