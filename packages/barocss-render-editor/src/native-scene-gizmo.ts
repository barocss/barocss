import {prepareEngineScene} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeScenePose} from './native-scene-display.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {makeGizmoProjectionContext, GIZMO_AXES as AXES, GIZMO_WORLD as WORLD, refused, native, unit, inside, pointCopy, axisHandle, ring, scaleHandle, axisParameter, grabbedRingTangent} from './gizmo-projection-common.js';
import type {GizmoProjectionContext, GizmoProjectionPlane, RenderSceneGizmoMode, RenderSceneGizmoKey, RenderSceneGizmoAxis, RenderSceneGizmoViewport, RenderSceneGizmoPreparation, RenderSceneGizmoHandle} from './gizmo-projection-common.js';

export type RenderNativeSceneGizmoSpace = 'world' | 'local';
type Point = readonly [number, number];
type XYZ = [number, number, number];
type XYZW = [number, number, number, number];
interface Context extends GizmoProjectionContext {document: RenderNativeSceneDocument; bodyId: string; bodyIds: readonly string[]; pose: RenderNativeScenePose; axes: XYZ[]; space: RenderNativeSceneGizmoSpace}
function identity(bodyId: string): RenderNativeScenePose {return {bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]};}
function context(document: RenderNativeSceneDocument, bodyId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode, space: RenderNativeSceneGizmoSpace): Context {
  if (!['translate', 'rotate', 'scale'].includes(mode) || !['world', 'local'].includes(space)) throw refused('Native gizmo mode or coordinate space is unsupported.');
  if (mode === 'scale' && space !== 'local') throw refused('Native Scale requires local coordinate space.');
  if (typeof bodyId !== 'string') throw refused('Native gizmo requires an original body ID.');
  const actual = prepareRenderNativeSceneAppearance(document), authored = actual.authored;
  const entry = authored.entries.find(entry => entry.binding.bodyId === bodyId);
  if (!entry || entry.kind !== 'surface' || !authored.document.display.visibleBodyIds.includes(bodyId) || !authored.materials.some(material => material.target.bodyId === bodyId)) throw refused('Native gizmo requires an original visible material-bound Surface body.');
  const pose = authored.document.display.poses.find(pose => pose.bodyId === bodyId) ?? identity(bodyId);
  const origin = pose.translationMM.map(value => value * authored.document.display.mmToSceneUnit) as XYZ;
  const projection = makeGizmoProjectionContext(origin, camera, viewport);
  // This unit-scale group is a public pose service, never a replacement native mesh.
  const rig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'native_gizmo_pose', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: projection.camera, geometries: [], materials: [], nodes: [{id: 'body_pose', type: 'group', parentId: null, translation: origin, rotationXYZW: [...pose.rotationXYZW], scale: [1, 1, 1], visible: true}]});
  const local = AXES.map((_, axis) => unit([0, 1, 2].map(row => rig.nodes[0]!.worldMatrix[axis * 4 + row]!) as XYZ));
  return {...projection, document: authored.document, bodyId, bodyIds: authored.entries.map(entry => entry.binding.bodyId), pose, axes: space === 'world' ? WORLD : local, space};
}
function plane(data: Context, axis: RenderSceneGizmoAxis): GizmoProjectionPlane {
  const index = AXES.indexOf(axis);
  return {normal: data.axes[index]!, a: data.axes[(index + 1) % 3]!, b: data.axes[(index + 2) % 3]!};
}
/** Original native origin and public camera/pose projection. No Source1 geometry is synthesized. */
export function prepareRenderNativeSceneGizmo(document: RenderNativeSceneDocument, bodyId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode, space: RenderNativeSceneGizmoSpace): RenderSceneGizmoPreparation {
  try {
    const data = context(document, bodyId, camera, viewport, mode, space), handles: RenderSceneGizmoHandle[] = [];
    if (inside(data.pivot, data.viewport)) {
      for (const [index, axis] of AXES.entries()) {
        try {const value = mode === 'rotate' ? ring(data, plane(data, axis), axis) : axisHandle(data, data.axes[index]!, axis, mode, mode === 'scale' ? 'Scale ' + axis.toUpperCase() : undefined); if (value) handles.push(value);} catch { /* A degenerate projected handle is not shown. */ }
      }
      if (mode === 'scale') {const value = scaleHandle(data); if (value) handles.push(value);}
    }
    return Object.freeze({pivot: data.pivot, handles: Object.freeze(handles), unavailable: handles.length ? null : mode === 'rotate' && (data.viewport.backingWidth > 2048 || data.viewport.backingHeight > 2048) ? 'Rotation handles require backing dimensions up to 2048. Use numeric rotation.' : 'This view cannot support the selected handles. Use numeric properties.'});
  } catch (cause) {throw native(cause);}
}
function product(a: readonly number[], b: readonly number[]): XYZW {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw! * bx! + ax! * bw! + ay! * bz! - az! * by!, aw! * by! - ax! * bz! + ay! * bw! + az! * bx!, aw! * bz! + ax! * by! - ay! * bx! + az! * bw!, aw! * bw! - ax! * bx! - ay! * by! - az! * bz!];
}
/** Captured drag derives original mm/quaternion/positive scale and re-admits the complete native appearance. */
export function deriveRenderNativeSceneGizmoPose(document: RenderNativeSceneDocument, bodyId: string, camera: MeshCamera, viewport: RenderSceneGizmoViewport, mode: RenderSceneGizmoMode, space: RenderNativeSceneGizmoSpace, key: RenderSceneGizmoKey, from: Point, to: Point): RenderNativeScenePose {
  try {
    const data = context(document, bodyId, camera, viewport, mode, space), start = pointCopy(from), end = pointCopy(to);
    if (mode === 'scale' ? key !== 'uniform' && !AXES.includes(key as RenderSceneGizmoAxis) : !AXES.includes(key as RenderSceneGizmoAxis)) throw refused('Handle does not match the native gizmo mode.');
    const translationMM = [...data.pose.translationMM] as XYZ, rotationXYZW = [...data.pose.rotationXYZW] as XYZW, scale = [...data.pose.scale] as XYZ;
    const same = start[0] === end[0] && start[1] === end[1], index = AXES.indexOf(key as RenderSceneGizmoAxis), axis = key as RenderSceneGizmoAxis;
    if (mode === 'translate' && !same) {
      const direction = data.axes[index]!;
      if (!axisHandle(data, direction, axis, 'translate')) throw refused('This native axis aligns with the view or crosses a clip. Use numeric position.');
      const deltaMM = (axisParameter(data, direction, end) - axisParameter(data, direction, start)) / data.document.display.mmToSceneUnit;
      for (let i = 0; i < 3; i++) {if (direction[i] !== 0) translationMM[i] += direction[i]! * deltaMM;}
    } else if (mode === 'rotate') {
      const selected = ring(data, plane(data, axis), axis);
      if (!selected || !inside(start, data.viewport) || !inside(end, data.viewport)) throw refused('Native rotation requires a nondegenerate ring and pointer positions inside the admitted canvas.');
      if (!same) {
        const tangent = grabbedRingTangent(data, plane(data, axis), start, selected), angle = ((end[0] - start[0]) * tangent[0] + (end[1] - start[1]) * tangent[1]) / 80;
        if (!Number.isFinite(angle)) throw refused('Native rotation displacement is nonfinite.');
        const delta: XYZW = [0, 0, 0, Math.cos(angle * .5)]; delta[index] = Math.sin(angle * .5);
        const composed = space === 'world' ? product(delta, rotationXYZW) : product(rotationXYZW, delta);
        for (let i = 0; i < 4; i++) rotationXYZW[i] = composed[i]!;
      }
    } else if (mode === 'scale' && !same) {
      let factor: number;
      if (key === 'uniform') {
        const initial = Math.hypot(start[0] - data.pivot[0], start[1] - data.pivot[1]), final = Math.hypot(end[0] - data.pivot[0], end[1] - data.pivot[1]);
        if (initial <= 1e-8) throw refused('Uniform scale requires a nonzero initial radial distance.');
        factor = final / initial;
      } else {
        const direction = data.axes[index]!;
        if (!axisHandle(data, direction, axis, 'scale')) throw refused('This native scale axis aligns with the view or crosses a clip.');
        factor = 1 + (axisParameter(data, direction, end) - axisParameter(data, direction, start)) / data.radius;
      }
      if (!Number.isFinite(factor) || factor <= 0) throw refused('Native scale requires a finite positive factor.');
      if (key === 'uniform') for (let i = 0; i < 3; i++) scale[i] *= factor; else scale[index] *= factor;
    }
    const result: RenderNativeScenePose = Object.freeze({bodyId, translationMM: Object.freeze(translationMM), rotationXYZW: Object.freeze(rotationXYZW), scale: Object.freeze(scale)});
    if (!same) {
      const poses = data.document.display.poses.length ? data.document.display.poses.map(pose => pose.bodyId === bodyId ? result : pose) : data.bodyIds.map(id => id === bodyId ? result : identity(id));
      prepareRenderNativeSceneAppearance({...data.document, display: {...data.document.display, poses}});
    }
    return result;
  } catch (cause) {throw native(cause);}
}
