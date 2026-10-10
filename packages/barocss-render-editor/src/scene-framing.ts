import {prepareSourceSceneBounds, prepareCamera, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderSceneFramingViewport {
  readonly width: number;
  readonly height: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
}
type Vector = [number, number, number];
const MARGIN = 1.2;
function check(value: unknown, message: string): asserts value {if (!value) throw new RangeError(message);}
function viewportCopy(input: unknown): RenderSceneFramingViewport {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype, 'Framing viewport must be plain own data.');
  const fields = ['width', 'height', 'backingWidth', 'backingHeight'], keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)), 'Framing viewport has missing or unsupported fields.');
  const data: Record<string, number> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number'
      && Number.isFinite(descriptor.value) && descriptor.value > 0, 'Framing viewport requires finite positive own numbers.');
    data[key] = descriptor.value;
  }
  check(data.width <= 16384 && data.height <= 16384 && Number.isInteger(data.backingWidth) && Number.isInteger(data.backingHeight)
    && data.backingWidth <= 4096 && data.backingHeight <= 4096 && data.backingWidth * data.backingHeight <= 4194304,
  'Framing viewport exceeds the actual Source canvas dimension or pixel budget.');
  return Object.freeze({width: data.width, height: data.height, backingWidth: data.backingWidth, backingHeight: data.backingHeight});
}
function dot(a: readonly number[], b: readonly number[]): number {return a.reduce((sum, value, index) => sum + value * b[index]!, 0);}
function viewPoint(matrix: Float32Array, point: Vector): Vector {
  return [0, 1, 2].map(row => matrix[row]! * point[0] + matrix[row + 4]! * point[1] + matrix[row + 8]! * point[2] + matrix[row + 12]!) as Vector;
}

/** Original Number-space box framing with a1.2 visual margin; no pixel/culling certificate. */
export function deriveRenderSceneFramingCamera(source: string, camera: MeshCamera, input: RenderSceneFramingViewport, objectId?: string): MeshCamera | null {
  try {
    const viewport = viewportCopy(input), original = validateMeshCamera(camera), aspect = viewport.backingWidth / viewport.backingHeight;
    const matrices = prepareCamera(original, aspect);
    if (objectId !== undefined) check(typeof objectId === 'string' && objectId.length > 0 && objectId.length <= 65536,
      'Framing selection must be a bounded original Source object ID.');
    // Request all once: provider selector48 limits do not truncate existing Source IDs.
    const prepared = prepareSourceSceneBounds({sourceVersion: 1, source});
    const selected = objectId === undefined ? null : prepared.objects.find(object => object.objectId === objectId);
    if (objectId !== undefined) check(selected, 'Framing selection does not exist in the original Source scene.');
    const bounds = selected ? selected.worldBounds : prepared.bounds;
    if (bounds === null) return null;
    const center = bounds.min.map((value, axis) => value / 2 + bounds.max[axis]! / 2) as Vector;
    const spans = bounds.max.map((value, axis) => value - bounds.min[axis]!);
    check([...center, ...spans].every(Number.isFinite) && spans.some(value => value > 0), 'Original bounds have no resolvable finite extent.');
    const corners = Array.from({length: 8}, (_, corner) => [0, 1, 2].map(axis => corner & (1 << axis) ? bounds.max[axis]! : bounds.min[axis]!) as Vector);
    const offset = original.eye.map((value, axis) => value - original.target[axis]!) as Vector, separation = Math.hypot(...offset);
    const backward = offset.map(value => value / separation) as Vector;
    const right: Vector = [matrices.view[0]!, matrices.view[4]!, matrices.view[8]!], up: Vector = [matrices.view[1]!, matrices.view[5]!, matrices.view[9]!];
    let distance = 0, maxZ = -Infinity;
    for (const corner of corners) {
      const relative = corner.map((value, axis) => value - center[axis]!) as Vector, z = dot(relative, backward);
      maxZ = Math.max(maxZ, z);
      distance = Math.max(distance, z + MARGIN * Math.abs(dot(relative, right)) * matrices.projection[0]!,
        z + MARGIN * Math.abs(dot(relative, up)) * matrices.projection[5]!);
    }
    // Even tiny admitted boxes need a legal, separable eye and near plane.
    distance = Math.max(distance, maxZ + .001);
    check(Number.isFinite(distance) && distance > 0, 'Framing distance is nonfinite or degenerate.');
    const eye = center.map((value, axis) => value + backward[axis]! * distance) as Vector;
    const minDepth = Math.min(...corners.map(corner => distance - dot(corner.map((value, axis) => value - center[axis]!) as Vector, backward)));
    const maxTravel = Math.max(...corners.map(corner => Math.hypot(...corner.map((value, axis) => value - eye[axis]!))));
    check(Number.isFinite(minDepth) && minDepth > 0 && Number.isFinite(maxTravel) && maxTravel < 100,
      'The fitted original bounds exceed the Source radial travel limit of100 scene units.');
    const near = Math.max(1e-4, minDepth * .5), far = Math.max(near * 2, maxTravel * MARGIN);
    const result = validateMeshCamera({...original, eye, target: center, near, far});
    const final = prepareCamera(result, aspect);
    for (const corner of corners) {
      const point = viewPoint(final.view, corner), depth = -point[2], travel = Math.hypot(...corner.map((value, axis) => value - result.eye[axis]!));
      check(point.every(Number.isFinite) && depth > result.near && depth < result.far && travel < Math.min(100, result.far),
        'The fitted camera cannot cover the original bounds within its actual clips and Source travel limit.');
      check(Math.abs(final.projection[0]! * point[0] / depth) <= 1 / MARGIN + 1e-5
        && Math.abs(final.projection[5]! * point[1] / depth) <= 1 / MARGIN + 1e-5,
      'The actual camera projection could not retain the declared framing margin.');
    }
    return result;
  } catch (cause) {
    if (cause instanceof RenderEditorError) throw cause;
    const error = normalizeRenderEditorError(cause, 'DOCUMENT_INPUT');
    Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
