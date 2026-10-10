import {prepareCamera, prepareEngineCameraRay, prepareEngineScene, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';
import {inspectRenderSceneObjects, editRenderSceneObjectSource} from './scene-object-source.js';
import type {RenderSceneObjectProperties, RenderSceneObjectPatch} from './scene-object-source.js';

export type RenderSceneGizmoMode = 'translate' | 'rotate' | 'scale';
export type RenderSceneGizmoAxis = 'x' | 'y' | 'z';
export type RenderSceneGizmoKey = RenderSceneGizmoAxis | 'uniform';
type Point = readonly [number, number];
type Vector = [number, number, number];
export interface RenderSceneGizmoViewport {readonly width: number; readonly height: number; readonly backingWidth: number; readonly backingHeight: number}
export interface RenderSceneGizmoHandle {
  readonly key: RenderSceneGizmoKey; readonly mode: RenderSceneGizmoMode; readonly axis: RenderSceneGizmoAxis | null;
  readonly points: readonly Point[]; readonly anchor: Point; readonly label: string;
}
export interface RenderSceneGizmoPreparation {readonly pivot: Point; readonly handles: readonly RenderSceneGizmoHandle[]; readonly unavailable: string | null}
interface Context {
  object: RenderSceneObjectProperties; camera: MeshCamera; viewport: RenderSceneGizmoViewport;
  view: Float32Array; projection: Float32Array; pivot: Point; clip: number[]; radius: number;
}
const AXES: readonly RenderSceneGizmoAxis[] = ['x', 'y', 'z'];
const WORLD: Vector[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function refused(message: string): RenderEditorError {return new RenderEditorError('DOCUMENT_INPUT', message);}
function native(cause: unknown): RenderEditorError {
  const error = normalizeRenderEditorError(cause, 'DOCUMENT_INPUT');
  if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
  return error;
}
function viewportCopy(input: unknown): RenderSceneGizmoViewport {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) throw refused('Gizmo viewport must be plain own data.');
  const keys = ['width', 'height', 'backingWidth', 'backingHeight'], actual = Reflect.ownKeys(input), values: Record<string, number> = {};
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) throw refused('Gizmo viewport has missing or unsupported fields.');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value) || descriptor.value <= 0) throw refused('Gizmo viewport dimensions must be finite positive own numbers.');
    values[key] = descriptor.value;
  }
  if (values.width > 16384 || values.height > 16384 || !Number.isInteger(values.backingWidth) || !Number.isInteger(values.backingHeight)
    || values.backingWidth > 4096 || values.backingHeight > 4096 || values.backingWidth * values.backingHeight > 4194304) throw refused('Gizmo viewport exceeds the Source canvas dimension or pixel budget.');
  return Object.freeze({width: values.width, height: values.height, backingWidth: values.backingWidth, backingHeight: values.backingHeight});
}
function pointCopy(input: unknown): Point {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || Reflect.ownKeys(input).length !== 3) throw refused('Pointer position must be a dense CSS XY array.');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  if (!length || !('value' in length) || length.value !== 2) throw refused('Pointer position must contain two values.');
  const values: number[] = [];
  for (let i = 0; i < 2; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) throw refused('Pointer coordinates must be finite own data.');
    values.push(descriptor.value);
  }
  return Object.freeze(values) as unknown as Point;
}
function dot(a: readonly number[], b: readonly number[]): number {return a.reduce((sum, value, index) => sum + value * b[index]!, 0);}
function unit(v: Vector): Vector {const length = Math.hypot(...v); if (!Number.isFinite(length) || length <= 1e-12) throw refused('Gizmo direction is degenerate.'); return v.map(n => n / length) as Vector;}
function cross(a: Vector, b: Vector): Vector {return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];}
function add(origin: readonly number[], direction: readonly number[], distance: number): Vector {return [0, 1, 2].map(i => origin[i]! + direction[i]! * distance) as Vector;}
function multiply(matrix: Float32Array, vector: readonly number[]): number[] {
  return [0, 1, 2, 3].map(row => [0, 1, 2, 3].reduce((sum, column) => sum + matrix[column * 4 + row]! * vector[column]!, 0));
}
function clipAt(context: Pick<Context, 'view' | 'projection'>, point: readonly number[], direction = false): number[] {
  return multiply(context.projection, multiply(context.view, [...point, direction ? 0 : 1]));
}
function css(context: Pick<Context, 'viewport'>, clip: readonly number[]): Point {
  if (!Number.isFinite(clip[3]) || clip[3]! <= 1e-9) throw refused('The source origin or handle crosses the camera horizon. Use numeric properties.');
  const depth = clip[2]! / clip[3]!;
  if (!Number.isFinite(depth) || depth < -1 || depth > 1) throw refused('The source origin or handle is outside the camera clips. Use numeric properties.');
  const x = (clip[0]! / clip[3]! + 1) * context.viewport.width / 2, y = (1 - clip[1]! / clip[3]!) * context.viewport.height / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw refused('Projected handle coordinates are nonfinite.');
  return Object.freeze([x, y]);
}
function inside(point: Point, viewport: RenderSceneGizmoViewport): boolean {return point[0] >= 0 && point[0] < viewport.width && point[1] >= 0 && point[1] < viewport.height;}
function context(source: string, objectId: string, camera: MeshCamera, input: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode): Context {
  if (!['translate', 'rotate', 'scale'].includes(mode)) throw refused('Gizmo mode must be translate, rotate or scale.');
  if (typeof objectId !== 'string') throw refused('Selected object ID must be an original string.');
  const object = inspectRenderSceneObjects(source).find(value => value.objectId === objectId);
  if (!object) throw refused('The selected object does not exist in the original Source scene.');
  const viewport = viewportCopy(input);
  let owned: MeshCamera, matrices: ReturnType<typeof prepareCamera>;
  try {owned = validateMeshCamera(camera); matrices = prepareCamera(owned, viewport.backingWidth / viewport.backingHeight);} catch (cause) {throw native(cause);}
  const clip = clipAt(matrices, object.translate), pivot = css({viewport}, clip);
  const depth = -multiply(matrices.view, [...object.translate, 1])[2]!;
  const radius = 112 * depth / (matrices.projection[5]! * viewport.height);
  if (!Number.isFinite(radius) || radius <= 0) throw refused('The source origin cannot support visible handles.');
  return {object, camera: owned, viewport, ...matrices, clip, pivot, radius};
}
function handle(key: RenderSceneGizmoKey, mode: RenderSceneGizmoMode, points: readonly Point[], anchor: Point, label?: string): RenderSceneGizmoHandle {
  return Object.freeze({key, mode, axis: key === 'uniform' ? null : key, points: Object.freeze([...points]), anchor,
    label: label ?? (key === 'uniform' ? 'Uniform scale' : `${mode === 'translate' ? 'Move' : 'Rotate'} ${key.toUpperCase()}`)});
}
function pose(context: Context) {
  const quaternion = (axis: number, degrees: number): [number, number, number, number] => {
    const half = degrees * Math.PI / 360, value: [number, number, number, number] = [0, 0, 0, Math.cos(half)]; value[axis] = Math.sin(half); return value;
  };
  try {
    const rig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'editor_gizmo_pose', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [0, 0, 0], camera: context.camera, geometries: [], materials: [], nodes: [
        {id: 'z_pose', type: 'group', parentId: null, translation: [...context.object.translate], rotationXYZW: quaternion(2, context.object.rotateDegrees[2]), scale: [1, 1, 1], visible: true},
        {id: 'y_pose', type: 'group', parentId: 'z_pose', translation: [0, 0, 0], rotationXYZW: quaternion(1, context.object.rotateDegrees[1]), scale: [1, 1, 1], visible: true},
        {id: 'x_pose', type: 'group', parentId: 'y_pose', translation: [0, 0, 0], rotationXYZW: quaternion(0, context.object.rotateDegrees[0]), scale: [1, 1, 1], visible: true},
      ]});
    const column = (node: number, axis: number): Vector => unit([0, 1, 2].map(row => rig.nodes[node]!.worldMatrix[axis * 4 + row]!) as Vector);
    return {
      local: AXES.map((_, index) => column(2, index)),
      x: {normal: column(2, 0), a: column(1, 1), b: column(1, 2)},
      y: {normal: column(1, 1), a: column(0, 2), b: column(0, 0)},
      z: {normal: WORLD[2]!, a: WORLD[0]!, b: WORLD[1]!},
    };
  } catch (cause) {throw native(cause);}
}
function ring(context: Context, axis: RenderSceneGizmoAxis): RenderSceneGizmoHandle | null {
  if (context.viewport.backingWidth > 2048 || context.viewport.backingHeight > 2048) return null;
  const plane = pose(context)[axis], points: Point[] = [];
  for (let step = 0; step <= 64; step++) {
    const angle = step * Math.PI / 32;
    const point = context.object.translate.map((value, i) => value + context.radius * (plane.a[i]! * Math.cos(angle) + plane.b[i]! * Math.sin(angle))) as Vector;
    try {points.push(css(context, clipAt(context, point)));} catch {return null;}
  }
  if (points.some(point => !inside(point, context.viewport))) return null;
  const a = [points[0]![0] - context.pivot[0], points[0]![1] - context.pivot[1]], b = [points[16]![0] - context.pivot[0], points[16]![1] - context.pivot[1]];
  if (Math.abs(a[0]! * b[1]! - a[1]! * b[0]!) < 24) return null;
  return handle(axis, 'rotate', points, points[0]!);
}
function axisHandle(context: Context, direction: Vector, axis: RenderSceneGizmoAxis, mode: 'translate' | 'scale'): RenderSceneGizmoHandle | null {
  const end = css(context, clipAt(context, add(context.object.translate, direction, context.radius)));
  if (!inside(end, context.viewport) || Math.hypot(end[0] - context.pivot[0], end[1] - context.pivot[1]) < 4) return null;
  const label = mode === 'scale' ? `${context.object.type === 'rounded-box' ? 'Size' : 'Scale'} ${axis.toUpperCase()}` : undefined;
  return handle(axis, mode, [context.pivot, end], end, label);
}
function translation(context: Context, axis: RenderSceneGizmoAxis): RenderSceneGizmoHandle | null {
  return axisHandle(context, WORLD[AXES.indexOf(axis)]!, axis, 'translate');
}
function hasLocalSize(object: RenderSceneObjectProperties): boolean {return object.type === 'box' || object.type === 'rounded-box';}
function scaleHandle(context: Context): RenderSceneGizmoHandle | null {
  const anchor = Object.freeze([context.pivot[0] + 46, context.pivot[1] - 46]) as Point;
  return inside(anchor, context.viewport) ? handle('uniform', 'scale', [context.pivot, anchor], anchor) : null;
}

/** CSS overlay geometry over actual public view/projection and original Euler pose. */
export function prepareRenderSceneGizmo(source: string, objectId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode): RenderSceneGizmoPreparation {
  const data = context(source, objectId, camera, viewport, mode), handles: RenderSceneGizmoHandle[] = [];
  if (inside(data.pivot, data.viewport)) {
    if (mode === 'scale') {
      if (hasLocalSize(data.object)) {
        const local = pose(data).local;
        for (const [index, axis] of AXES.entries()) {
          try {const value = axisHandle(data, local[index]!, axis, 'scale'); if (value) handles.push(value);} catch { /* An unqualified local axis is not shown. */ }
        }
      }
      const value = scaleHandle(data); if (value) handles.push(value);
    }
    else for (const axis of AXES) {
      try {const value = mode === 'translate' ? translation(data, axis) : ring(data, axis); if (value) handles.push(value);} catch { /* An unqualified axis is not shown. */ }
    }
  }
  return Object.freeze({pivot: data.pivot, handles: Object.freeze(handles), unavailable: handles.length ? null
    : mode === 'rotate' && (data.viewport.backingWidth > 2048 || data.viewport.backingHeight > 2048)
      ? 'Rotation rays require backing dimensions up to 2048. Use numeric rotation.' : 'This view cannot support the selected handles. Use numeric properties.'});
}
function axisParameter(context: Context, direction: Vector, pointer: Point): number {
  const axisClip = clipAt(context, direction, true), w0 = context.clip[3]!, wa = axisClip[3]!;
  const numerator: Point = [context.viewport.width / 2 * (axisClip[0]! + wa) - context.pivot[0] * wa,
    context.viewport.height / 2 * (wa - axisClip[1]!) - context.pivot[1] * wa];
  const length = Math.hypot(...numerator), screenDirection: Point = [numerator[0] / length, numerator[1] / length];
  const delta = (pointer[0] - context.pivot[0]) * screenDirection[0] + (pointer[1] - context.pivot[1]) * screenDirection[1];
  const denominator = length - delta * wa;
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= 1e-9) throw refused('Axis movement reaches the projection horizon.');
  const parameter = delta * w0 / denominator;
  if (!Number.isFinite(parameter) || w0 + parameter * wa <= 1e-9) throw refused('Axis movement crosses the projection horizon.');
  return parameter;
}
function planeVector(context: Context, normal: Vector, pointer: Point): Vector {
  if (!inside(pointer, context.viewport) || context.viewport.backingWidth > 2048 || context.viewport.backingHeight > 2048) throw refused('Rotation requires an admitted actual backing-pixel centre inside the canvas.');
  let ray: ReturnType<typeof prepareEngineCameraRay>['ray'];
  try {ray = prepareEngineCameraRay(context.camera, {format: 'barocss-gpu-engine-camera-ray-request', version: 0, pixelOrigin: 'bottom-left', sampling: 'pixel-center',
    viewportWidth: context.viewport.backingWidth, viewportHeight: context.viewport.backingHeight,
    pixelX: Math.floor(pointer[0] * context.viewport.backingWidth / context.viewport.width),
    pixelY: context.viewport.backingHeight - 1 - Math.floor(pointer[1] * context.viewport.backingHeight / context.viewport.height)}).ray;} catch (cause) {throw native(cause);}
  const denominator = dot(ray.direction, normal);
  if (Math.abs(denominator) < 1e-7) throw refused('Rotation ray is parallel to the effective axis plane.');
  const offset = context.object.translate.map((value, i) => value - ray.origin[i]!) as Vector, distance = dot(offset, normal) / denominator;
  if (!Number.isFinite(distance) || distance < ray.near || distance > ray.far) throw refused('Rotation plane intersection is outside the actual ray clips.');
  return unit(add(ray.origin, ray.direction, distance).map((value, i) => value - context.object.translate[i]!) as Vector);
}
function scalePatch(object: RenderSceneObjectProperties, factor: number): RenderSceneObjectPatch {
  const vector = (value: readonly number[]) => Object.freeze(value.map(n => n * factor)) as readonly [number, number, number];
  switch (object.type) {
    case 'sphere': return Object.freeze({radius: object.radius! * factor});
    case 'box': return Object.freeze({size: vector(object.size!)});
    case 'cylinder': return Object.freeze({radius: object.radius! * factor, height: object.height! * factor});
    case 'capsule': return Object.freeze({radius: object.radius! * factor, start: vector(object.start!), end: vector(object.end!)});
    case 'rounded-box': return Object.freeze({radius: object.radius! * factor, size: vector(object.size!)});
    case 'torus': return Object.freeze({majorRadius: object.majorRadius! * factor, minorRadius: object.minorRadius! * factor});
  }
}

/** Captured CSS drag to selected Source1 properties, with no clamping or geometry rewrite. */
export function deriveRenderSceneGizmoPatch(source: string, objectId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport,
  mode: RenderSceneGizmoMode, key: RenderSceneGizmoKey, from: Point, to: Point): RenderSceneObjectPatch {
  const data = context(source, objectId, camera, viewport, mode), start = pointCopy(from), end = pointCopy(to);
  if (mode === 'scale' ? key !== 'uniform' && (!hasLocalSize(data.object) || !AXES.includes(key as RenderSceneGizmoAxis)) : !AXES.includes(key as RenderSceneGizmoAxis)) throw refused('Handle does not match the gizmo mode.');
  let patch: RenderSceneObjectPatch;
  if (mode === 'translate') {
    const axis = key as RenderSceneGizmoAxis, position = [...data.object.translate] as Vector;
    if (start[0] !== end[0] || start[1] !== end[1]) {
      if (!translation(data, axis)) throw refused('This axis aligns with the view or crosses a clip. Use numeric position.');
      const direction = WORLD[AXES.indexOf(axis)]!;
      position[AXES.indexOf(axis)] += axisParameter(data, direction, end) - axisParameter(data, direction, start);
    }
    patch = Object.freeze({translate: Object.freeze(position)});
  } else if (mode === 'rotate') {
    const axis = key as RenderSceneGizmoAxis, rotation = [...data.object.rotateDegrees] as Vector;
    if (!ring(data, axis)) throw refused('The effective rotation ring is degenerate. Use numeric rotation.');
    if (start[0] !== end[0] || start[1] !== end[1]) {
      const normal = pose(data)[axis].normal, a = planeVector(data, normal, start), b = planeVector(data, normal, end);
      rotation[AXES.indexOf(axis)] += Math.atan2(dot(normal, cross(a, b)), dot(a, b)) * 180 / Math.PI;
    }
    patch = Object.freeze({rotateDegrees: Object.freeze(rotation)});
  } else if (key !== 'uniform') {
    const axis = key as RenderSceneGizmoAxis, index = AXES.indexOf(axis), direction = pose(data).local[index]!;
    if (!axisHandle(data, direction, axis, 'scale')) throw refused('This local size axis aligns with the view or crosses a clip. Use numeric size.');
    const factor = start[0] === end[0] && start[1] === end[1] ? 1
      : 1 + (axisParameter(data, direction, end) - axisParameter(data, direction, start)) / data.radius;
    if (!Number.isFinite(factor) || factor <= 0) throw refused('Local size needs a finite positive axis factor.');
    const size = [...data.object.size!] as Vector; size[index] *= factor;
    patch = Object.freeze({size: Object.freeze(size)});
  } else {
    const initial = Math.hypot(start[0] - data.pivot[0], start[1] - data.pivot[1]), final = Math.hypot(end[0] - data.pivot[0], end[1] - data.pivot[1]);
    if (initial <= 1e-8 || !Number.isFinite(final / initial) || final <= 0) throw refused('Uniform scale needs a finite positive radial ratio.');
    patch = scalePatch(data.object, start[0] === end[0] && start[1] === end[1] ? 1 : final / initial);
  }
  // The actual source writer/compiler applies dimensional, rotation and shape guards.
  editRenderSceneObjectSource(source, objectId, patch);
  return patch;
}
