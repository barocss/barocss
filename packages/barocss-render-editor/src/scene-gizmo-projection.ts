import {prepareEngineScene} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {inspectRenderSceneObjects, editRenderSceneObjectSource} from './scene-object-source.js';
import type {RenderSceneObjectProperties, RenderSceneObjectPatch} from './scene-object-source.js';
import {makeGizmoProjectionContext, refused, native, pointCopy, unit, inside, axisHandle, ring, scaleHandle, axisParameter, grabbedRingTangent, GIZMO_AXES as AXES, GIZMO_WORLD as WORLD} from './gizmo-projection-common.js';
import type {RenderSceneGizmoMode, RenderSceneGizmoAxis, RenderSceneGizmoKey, RenderSceneGizmoViewport, RenderSceneGizmoHandle, RenderSceneGizmoPreparation, GizmoProjectionContext} from './gizmo-projection-common.js';
export type {RenderSceneGizmoMode, RenderSceneGizmoAxis, RenderSceneGizmoKey, RenderSceneGizmoViewport, RenderSceneGizmoHandle, RenderSceneGizmoPreparation} from './gizmo-projection-common.js';
export {hitTestRenderSceneGizmo} from './gizmo-projection-common.js';
type Point = readonly [number, number];
type Vector = [number, number, number];
interface Context extends GizmoProjectionContext {object: RenderSceneObjectProperties}

function context(source: string, objectId: string, camera: MeshCamera, input: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode): Context {
  if (!['translate', 'rotate', 'scale'].includes(mode)) throw refused('Gizmo mode must be translate, rotate or scale.');
  if (typeof objectId !== 'string') throw refused('Selected object ID must be an original string.');
  const object = inspectRenderSceneObjects(source).find(value => value.objectId === objectId);
  if (!object) throw refused('The selected object does not exist in the original Source scene.');
  return {object, ...makeGizmoProjectionContext(object.translate, camera, input)};
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
function translation(context: Context, axis: RenderSceneGizmoAxis): RenderSceneGizmoHandle | null {
  return axisHandle(context, WORLD[AXES.indexOf(axis)]!, axis, 'translate');
}
function hasLocalSize(object: RenderSceneObjectProperties): boolean {return object.type === 'box' || object.type === 'rounded-box';}
/** CSS overlay geometry over actual public view/projection and original Euler pose. */
export function prepareRenderSceneGizmo(source: string, objectId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode): RenderSceneGizmoPreparation {
  const data = context(source, objectId, camera, viewport, mode), handles: RenderSceneGizmoHandle[] = [];
  if (inside(data.pivot, data.viewport)) {
    if (mode === 'scale') {
      if (hasLocalSize(data.object)) {
        const local = pose(data).local;
        for (const [index, axis] of AXES.entries()) {
          try {const value = axisHandle(data, local[index]!, axis, 'scale', `${data.object.type === 'rounded-box' ? 'Size' : 'Scale'} ${axis.toUpperCase()}`); if (value) handles.push(value);} catch { /* An unqualified local axis is not shown. */ }
        }
      }
      const value = scaleHandle(data); if (value) handles.push(value);
    }
    else for (const axis of AXES) {
      try {const value = mode === 'translate' ? translation(data, axis) : ring(data, pose(data)[axis], axis); if (value) handles.push(value);} catch { /* An unqualified axis is not shown. */ }
    }
  }
  return Object.freeze({pivot: data.pivot, handles: Object.freeze(handles), unavailable: handles.length ? null
    : mode === 'rotate' && (data.viewport.backingWidth > 2048 || data.viewport.backingHeight > 2048)
      ? 'Rotation handles require backing dimensions up to 2048. Use numeric rotation.' : 'This view cannot support the selected handles. Use numeric properties.'});
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
    const selectedRing = ring(data, pose(data)[axis], axis);
    if (!selectedRing) throw refused('The effective rotation ring is degenerate. Use numeric rotation.');
    if (!inside(start, data.viewport) || !inside(end, data.viewport)) throw refused('Rotation requires pointer positions inside the admitted canvas.');
    if (start[0] !== end[0] || start[1] !== end[1]) {
      const tangent = grabbedRingTangent(data, pose(data)[axis], start, selectedRing);
      // Direction follows the grabbed arc. Gain stays at the nominal 80 CSS
      // pixels per radian, independent of a foreshortened ellipse's minor axis.
      const angle = ((end[0] - start[0]) * tangent[0] + (end[1] - start[1]) * tangent[1]) / 80;
      if (!Number.isFinite(angle)) throw refused('Rotation displacement is nonfinite.');
      rotation[AXES.indexOf(axis)] += angle * 180 / Math.PI;
    }
    patch = Object.freeze({rotateDegrees: Object.freeze(rotation)});
  } else if (key !== 'uniform') {
    const axis = key as RenderSceneGizmoAxis, index = AXES.indexOf(axis), direction = pose(data).local[index]!;
    if (!axisHandle(data, direction, axis, 'scale', `${data.object.type === 'rounded-box' ? 'Size' : 'Scale'} ${axis.toUpperCase()}`)) throw refused('This local size axis aligns with the view or crosses a clip. Use numeric size.');
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
