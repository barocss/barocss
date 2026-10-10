import {prepareCamera, prepareEngineScene, validateMeshCamera} from '@barocss/gpu';
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
  readonly segments?: readonly {readonly points: readonly Point[]; readonly front: boolean}[];
}
export interface RenderSceneGizmoPreparation {readonly pivot: Point; readonly handles: readonly RenderSceneGizmoHandle[]; readonly unavailable: string | null}
interface Context {
  object: RenderSceneObjectProperties; camera: MeshCamera; viewport: RenderSceneGizmoViewport;
  view: Float32Array; projection: Float32Array; pivot: Point; clip: number[]; radius: number;
}
const AXES: readonly RenderSceneGizmoAxis[] = ['x', 'y', 'z'];
const projectedDepths = new WeakMap<RenderSceneGizmoHandle, readonly number[]>();
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
  const radius = 160 * depth / (matrices.projection[5]! * viewport.height);
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
  const plane = pose(context)[axis], points: Point[] = [], depths: number[] = [], facing: number[] = [];
  const eye = unit(context.camera.eye.map((value, index) => value - context.object.translate[index]!) as Vector);
  for (let step = 0; step <= 64; step++) {
    const angle = step * Math.PI / 32;
    const offset = plane.a.map((value, i) => context.radius * (value * Math.cos(angle) + plane.b[i]! * Math.sin(angle))) as Vector;
    const point = add(context.object.translate, offset, 1), clip = clipAt(context, point);
    try {points.push(css(context, clip));} catch {return null;}
    depths.push(clip[2]! / clip[3]!); facing.push(dot(offset, eye));
  }
  if (points.some(point => !inside(point, context.viewport))) return null;
  const a = [points[0]![0] - context.pivot[0], points[0]![1] - context.pivot[1]], b = [points[16]![0] - context.pivot[0], points[16]![1] - context.pivot[1]];
  if (Math.abs(a[0]! * b[1]! - a[1]! * b[0]!) < 24) return null;
  const segments = points.slice(1).map((point, index) => Object.freeze({
    points: Object.freeze([points[index]!, point]), front: (facing[index]! + facing[index + 1]!) / 2 >= -1e-12,
  }));
  let anchor = points[0]!, best = -Infinity;
  for (let index = 0; index < 64; index++) {
    if (facing[index]! < -1e-12) continue;
    const point = points[index]!, distance = Math.hypot(point[0] - context.pivot[0], point[1] - context.pivot[1]);
    if (distance > best) {best = distance; anchor = point;}
  }
  const value = Object.freeze({...handle(axis, 'rotate', points, anchor), segments: Object.freeze(segments)});
  projectedDepths.set(value, Object.freeze(depths));
  return value;
}
function axisHandle(context: Context, direction: Vector, axis: RenderSceneGizmoAxis, mode: 'translate' | 'scale'): RenderSceneGizmoHandle | null {
  const end = css(context, clipAt(context, add(context.object.translate, direction, context.radius)));
  if (!inside(end, context.viewport) || Math.hypot(end[0] - context.pivot[0], end[1] - context.pivot[1]) < 4) return null;
  const label = mode === 'scale' ? `${context.object.type === 'rounded-box' ? 'Size' : 'Scale'} ${axis.toUpperCase()}` : undefined;
  const value = handle(axis, mode, [context.pivot, end], end, label), endClip = clipAt(context, add(context.object.translate, direction, context.radius));
  projectedDepths.set(value, Object.freeze([context.clip[2]! / context.clip[3]!, endClip[2]! / endClip[3]!]));
  return value;
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
      ? 'Rotation handles require backing dimensions up to 2048. Use numeric rotation.' : 'This view cannot support the selected handles. Use numeric properties.'});
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
function grabbedRingTangent(context: Context, axis: RenderSceneGizmoAxis, start: Point, ring: RenderSceneGizmoHandle): Point {
  let nearest = Infinity, phase = 0, front = false;
  for (let index = 0; index < ring.points.length - 1; index++) {
    const candidate = closestSegment(start, ring.points[index]!, ring.points[index + 1]!), facing = ring.segments?.[index]?.front ?? true;
    if (candidate.distance < nearest - 1e-6 || Math.abs(candidate.distance - nearest) <= 1e-6 && facing && !front) {
      nearest = candidate.distance; phase = (index + candidate.ratio) * Math.PI / 32; front = facing;
    }
  }
  const plane = pose(context)[axis], offset = plane.a.map((value, index) => context.radius * (value * Math.cos(phase) + plane.b[index]! * Math.sin(phase))) as Vector;
  const tangent = plane.a.map((value, index) => context.radius * (-value * Math.sin(phase) + plane.b[index]! * Math.cos(phase))) as Vector;
  const clip = clipAt(context, add(context.object.translate, offset, 1)), derivative = clipAt(context, tangent, true), w = clip[3]!;
  const x = context.viewport.width / 2 * (derivative[0]! * w - clip[0]! * derivative[3]!) / (w * w);
  const y = context.viewport.height / 2 * (clip[1]! * derivative[3]! - derivative[1]! * w) / (w * w);
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1e-6) throw refused('The grabbed ring tangent is degenerate. Use numeric rotation.');
  return Object.freeze([x / length, y / length]);
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
    const selectedRing = ring(data, axis);
    if (!selectedRing) throw refused('The effective rotation ring is degenerate. Use numeric rotation.');
    if (!inside(start, data.viewport) || !inside(end, data.viewport)) throw refused('Rotation requires pointer positions inside the admitted canvas.');
    if (start[0] !== end[0] || start[1] !== end[1]) {
      const tangent = grabbedRingTangent(data, axis, start, selectedRing);
      // Direction follows the grabbed arc. Gain stays at the nominal 80 CSS
      // pixels per radian, independent of a foreshortened ellipse's minor axis.
      const angle = ((end[0] - start[0]) * tangent[0] + (end[1] - start[1]) * tangent[1]) / 80;
      if (!Number.isFinite(angle)) throw refused('Rotation displacement is nonfinite.');
      rotation[AXES.indexOf(axis)] += angle * 180 / Math.PI;
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

function gizmoRecord(input: unknown, fields: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) throw refused('Hit geometry must be plain own data.');
  const keys = Reflect.ownKeys(input);
  if (keys.some(key => typeof key !== 'string' || ![...fields, ...optional].includes(key)) || fields.some(key => !keys.includes(key))) throw refused('Hit geometry has missing or unsupported fields.');
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw refused('Hit geometry requires own enumerable fields.');
    result[key as string] = descriptor.value;
  }
  return result;
}
function gizmoArray(input: unknown, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) throw refused('Hit geometry arrays must be dense own data.');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (!descriptor || !('value' in descriptor) || !Number.isInteger(descriptor.value) || descriptor.value < minimum || descriptor.value > maximum
    || Reflect.ownKeys(input).length !== descriptor.value + 1) throw refused('Hit geometry array exceeds its supported count or has extra fields.');
  return Array.from({length: descriptor.value}, (_, index) => {
    const item = Object.getOwnPropertyDescriptor(input, String(index));
    if (!item || !('value' in item) || !item.enumerable) throw refused('Hit geometry items require own enumerable data.');
    return item.value;
  });
}
function closestSegment(pointer: Point, a: Point, b: Point): {distance: number; ratio: number} {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  const ratio = length > 0 ? Math.max(0, Math.min(1, ((pointer[0] - a[0]) * x + (pointer[1] - a[1]) * y) / length)) : 0;
  return {distance: Math.hypot(pointer[0] - a[0] - ratio * x, pointer[1] - a[1] - ratio * y), ratio};
}
/** Nearest projected transform geometry; neither DOM order nor a remembered axis participates. */
export function hitTestRenderSceneGizmo(preparation: RenderSceneGizmoPreparation, pointer: Point, tolerance = 9): RenderSceneGizmoHandle | null {
  try {
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0) throw refused('Hit tolerance must be a finite nonnegative CSS distance.');
    const point = pointCopy(pointer), data = gizmoRecord(preparation, ['pivot', 'handles', 'unavailable']), pivot = pointCopy(data.pivot);
    if (data.unavailable !== null && typeof data.unavailable !== 'string') throw refused('Hit geometry notice must be a string or null.');
    const handles = gizmoArray(data.handles, 0, 4), keys = new Set<string>();
    let best: {handle: RenderSceneGizmoHandle; distance: number; front: boolean; depth: number} | null = null;
    const origin = Math.hypot(point[0] - pivot[0], point[1] - pivot[1]);
    for (const input of handles) {
      const handle = input as RenderSceneGizmoHandle, row = gizmoRecord(input, ['key', 'mode', 'axis', 'points', 'anchor', 'label'], ['segments']);
      if (!['x', 'y', 'z', 'uniform'].includes(row.key as string) || keys.has(row.key as string)
        || !['translate', 'rotate', 'scale'].includes(row.mode as string) || row.axis !== (row.key === 'uniform' ? null : row.key)
        || typeof row.label !== 'string' || row.label.length > 256) throw refused('Hit geometry handle identity is unsupported.');
      keys.add(row.key as string); pointCopy(row.anchor);
      const points = gizmoArray(row.points, 2, 129).map(pointCopy);
      const groups = row.segments === undefined ? [{points, front: true}] : gizmoArray(row.segments, 1, 128).map(input => {
        const segment = gizmoRecord(input, ['points', 'front']);
        if (typeof segment.front !== 'boolean') throw refused('Hit geometry segment facing must be boolean.');
        return {points: gizmoArray(segment.points, 2, 129).map(pointCopy), front: segment.front};
      });
      // Shared line origins are not axis handles. Leave that area to the camera.
      if (origin <= Math.max(12, tolerance * 1.5)) continue;
      const depths = projectedDepths.get(handle);
      for (const [groupIndex, group] of groups.entries()) for (let index = 1; index < group.points.length; index++) {
        const closest = closestSegment(point, group.points[index - 1]!, group.points[index]!);
        if (!Number.isFinite(closest.distance) || closest.distance > tolerance) continue;
        const depthIndex = row.segments === undefined ? index - 1 : groupIndex;
        const a = depths?.[depthIndex], b = depths?.[depthIndex + 1];
        const depth = a !== undefined && b !== undefined ? a + (b - a) * closest.ratio : Infinity;
        const distanceTie = best !== null && Math.abs(closest.distance - best.distance) <= 1e-6;
        const depthTie = best !== null && (!Number.isFinite(depth) || !Number.isFinite(best.depth) || Math.abs(depth - best.depth) <= 1e-10);
        if (!best || closest.distance < best.distance - 1e-6 || distanceTie && (
          !depthTie && depth < best.depth || depthTie && (group.front && !best.front
            || group.front === best.front && ['x', 'y', 'z', 'uniform'].indexOf(row.key as string) < ['x', 'y', 'z', 'uniform'].indexOf(best.handle.key)))) {
          best = {handle, distance: closest.distance, front: group.front, depth};
        }
      }
    }
    return best?.handle ?? null;
  } catch (cause) {throw native(cause);}
}
