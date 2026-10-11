import {createCadGeometryReference, resolveCadGeometryReference} from '@barocss/cad';
import type {CadGeometryReferenceV0, Surface} from '@barocss/cad';
import {prepareCamera, prepareEngineScene, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderNativeSceneDocument} from './native-scene-document.js';
import type {RenderNativeScenePose} from './native-scene-display.js';
import {prepareRenderNativeSceneAppearance} from './native-scene-appearance.js';
import {deriveRenderNativeSceneSurfacePoleEdit} from './native-surface-pole-edit.js';
import type {RenderNativeSceneSurfacePolePatch} from './native-surface-pole-edit.js';
import {GIZMO_AXES, axisHandle, axisParameter, clipAt, css, inside, makeGizmoProjectionContext,
  multiply, native, pointCopy, refused, unit, viewportCopy} from './gizmo-projection-common.js';
import type {RenderSceneGizmoAxis, RenderSceneGizmoPreparation, RenderSceneGizmoViewport,
  RenderSceneGizmoHandle} from './gizmo-projection-common.js';

type XYZ = [number, number, number];
type Point = readonly [number, number];
export interface RenderNativeSceneSurfacePoleSelection {
  readonly uIndex: number;
  readonly vIndex: number;
}
export interface RenderNativeSceneSurfacePolePoint extends RenderNativeSceneSurfacePoleSelection {
  readonly pointMM: readonly [number, number, number];
  readonly weight: number;
  readonly point: Point;
  readonly depthScene: number;
}
export interface RenderNativeSceneSurfacePoleControls {
  readonly reference: CadGeometryReferenceV0;
  /** Original control-grid markers in row-major order; geometry occlusion is not tested. */
  readonly points: readonly RenderNativeSceneSurfacePolePoint[];
  readonly gizmo: RenderSceneGizmoPreparation;
}
function selectionCopy(input: unknown, surface: Surface): RenderNativeSceneSurfacePoleSelection {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw refused('Control-point selection requires ordinary own data.');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 2 || keys.some(key => key !== 'uIndex' && key !== 'vIndex')) throw refused('Control-point selection requires exactly U/V indices.');
  const values = Object.fromEntries(['uIndex', 'vIndex'].map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field) || !field.enumerable || typeof field.value !== 'number'
      || !Number.isInteger(field.value) || Object.is(field.value, -0) || field.value < 0) throw refused('Control-point indices require own nonnegative integers without negative zero.');
    return [key, field.value];
  }));
  const uIndex = values.uIndex as number, vIndex = values.vIndex as number;
  if (uIndex >= surface.controlPoints.length || vIndex >= surface.controlPoints[uIndex]!.length) throw refused('Control-point indices do not identify an original pole.');
  return Object.freeze({uIndex, vIndex});
}
function context(document: RenderNativeSceneDocument, bodyId: string, camera: MeshCamera,
  viewport: RenderSceneGizmoViewport) {
  const authored = prepareRenderNativeSceneAppearance(document).authored, original = authored.document;
  if (typeof bodyId !== 'string') throw refused('Choose an original visible Surface body.');
  const body = original.nativeDocument.bodies.find(value => value.id === bodyId);
  const entries = authored.entries.filter(value => value.binding.bodyId === bodyId);
  if (!body || entries.length !== 1 || entries[0]!.kind !== 'surface'
    || !original.display.visibleBodyIds.includes(bodyId) || !authored.materials.some(value => value.target.bodyId === bodyId)) throw refused('Control points require an original selected visible material Surface.');
  if (original.nativeDocument.bodies.some(value => value.id !== bodyId && value.assetId === body.assetId)) throw refused('This source asset is shared. Duplicate the body before editing its control points.');
  const created = createCadGeometryReference(authored.native, {bodyId});
  const resolved = resolveCadGeometryReference(authored.native, created.reference);
  const asset = original.nativeDocument.assets.find(value => value.id === body.assetId);
  if (!asset || resolved.geometry.kind !== 'surface' || resolved.reference.assetId !== body.assetId
    || resolved.reference.geometryId !== body.geometryId || resolved.source !== asset.source) throw refused('Control points do not bind to the original Surface source.');
  const surface = resolved.geometry;
  if (surface.controlPoints.length > 16 || surface.controlPoints.some(row => row.length > 16)) throw refused('Control points exceed the original 16 by 16 grid limit.');
  const pose: RenderNativeScenePose = original.display.poses.find(value => value.bodyId === bodyId)
    ?? {bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]};
  const ownedViewport = viewportCopy(viewport), ownedCamera = validateMeshCamera(camera);
  const matrices = prepareCamera(ownedCamera, ownedViewport.backingWidth / ownedViewport.backingHeight);
  // Unit scale and neutral translation keep the existing Native pose admission limits.
  const rig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'native_pole_pose',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: ownedCamera,
    geometries: [], materials: [], nodes: [{id: 'pole_axes', type: 'group', parentId: null, translation: [0, 0, 0],
      rotationXYZW: [...pose.rotationXYZW], scale: [1, 1, 1], visible: true}]});
  const rotation = rig.nodes[0]!.worldMatrix;
  const axes = GIZMO_AXES.map((_, axis) => unit([0, 1, 2].map(row => rotation[axis * 4 + row]!) as XYZ));
  const world = (pointMM: readonly number[]): XYZ => {
    const scaled = pointMM.map((value, axis) => value * pose.scale[axis]!);
    const rotated = [0, 1, 2].map(row => rotation[row]! * scaled[0]!
      + rotation[4 + row]! * scaled[1]! + rotation[8 + row]! * scaled[2]!);
    const point = rotated.map((value, axis) => (pose.translationMM[axis]! + value) * original.display.mmToSceneUnit) as XYZ;
    if (!point.every(Number.isFinite)) throw refused('Posed original control-point coordinates are nonfinite.');
    return point;
  };
  const project = (pointMM: readonly number[]) => {
    const position = world(pointMM), clip = clipAt(matrices, position);
    if (!Number.isFinite(clip[3]) || clip[3]! <= 1e-9) return null;
    const depth = clip[2]! / clip[3]!;
    if (!Number.isFinite(depth) || depth < -1 || depth > 1) return null;
    const point = css({viewport: ownedViewport}, clip);
    if (!inside(point, ownedViewport)) return null;
    const depthScene = -multiply(matrices.view, [...position, 1])[2]!;
    if (!Number.isFinite(depthScene) || depthScene <= 0) throw refused('Projected control-point depth is invalid.');
    return {point, depthScene};
  };
  return {document: original, reference: resolved.reference, surface, pose, camera: ownedCamera,
    viewport: ownedViewport, axes, world, project};
}
function unavailable(message: string): RenderSceneGizmoPreparation {
  return Object.freeze({pivot: Object.freeze([0, 0]) as Point, handles: Object.freeze([]), unavailable: message});
}

/** Project original control coefficients as x-ray markers, never sampled Surface vertices. */
export function prepareRenderNativeSceneSurfacePoleControls(document: RenderNativeSceneDocument, bodyId: string,
  camera: MeshCamera, viewport: RenderSceneGizmoViewport,
  selection: RenderNativeSceneSurfacePoleSelection | null): RenderNativeSceneSurfacePoleControls {
  try {
    const data = context(document, bodyId, camera, viewport);
    const selected = selection === null ? null : selectionCopy(selection, data.surface);
    const points: RenderNativeSceneSurfacePolePoint[] = [];
    data.surface.controlPoints.forEach((row, uIndex) => row.forEach((pointMM, vIndex) => {
      const projected = data.project(pointMM);
      if (projected) points.push(Object.freeze({uIndex, vIndex, pointMM: Object.freeze([...pointMM]) as readonly [number, number, number],
        weight: data.surface.weights[uIndex]![vIndex]!, ...projected}));
    }));
    let gizmo = unavailable('Select an original control point.');
    if (selected) {
      const pointMM = data.surface.controlPoints[selected.uIndex]![selected.vIndex]!;
      if (!data.project(pointMM)) gizmo = unavailable('The selected control point is outside this view. Use numeric fields.');
      else {
        const projection = makeGizmoProjectionContext(data.world(pointMM), data.camera, data.viewport);
        const handles: RenderSceneGizmoHandle[] = [];
        GIZMO_AXES.forEach((axis, index) => {
          try {const handle = axisHandle(projection, data.axes[index]!, axis, 'translate'); if (handle) handles.push(handle);}
          catch { /* A clipped or degenerate projected source axis is not offered. */ }
        });
        gizmo = Object.freeze({pivot: projection.pivot, handles: Object.freeze(handles),
          unavailable: handles.length ? null : 'This view cannot support point axes. Use numeric fields.'});
      }
    }
    return Object.freeze({reference: Object.freeze(data.reference), points: Object.freeze(points), gizmo});
  } catch (cause) {throw native(cause);}
}

/** One captured local source-axis displacement; the complete pole edit re-admits actual CAD and GPU data. */
export function deriveRenderNativeSceneSurfacePoleAxisDrag(document: RenderNativeSceneDocument, bodyId: string,
  selection: RenderNativeSceneSurfacePoleSelection, camera: MeshCamera, viewport: RenderSceneGizmoViewport,
  axis: RenderSceneGizmoAxis, from: Point, to: Point): RenderNativeSceneSurfacePolePatch {
  try {
    if (!GIZMO_AXES.includes(axis)) throw refused('Control-point drag requires one original XYZ axis.');
    const data = context(document, bodyId, camera, viewport), selected = selectionCopy(selection, data.surface);
    const start = pointCopy(from), end = pointCopy(to);
    if (!inside(start, data.viewport) || !inside(end, data.viewport)) throw refused('Control-point drag requires positions inside the admitted Canvas.');
    const pointMM = data.surface.controlPoints[selected.uIndex]![selected.vIndex]!, moved = [...pointMM] as XYZ;
    if (!data.project(pointMM)) throw refused('The selected control point is outside this view.');
    const projection = makeGizmoProjectionContext(data.world(pointMM), data.camera, data.viewport);
    const index = GIZMO_AXES.indexOf(axis), direction = data.axes[index]!;
    if (!axisHandle(projection, direction, axis, 'translate')) throw refused('This source axis aligns with the view or crosses a clip. Use numeric fields.');
    if (start[0] !== end[0] || start[1] !== end[1]) {
      const deltaSourceMM = (axisParameter(projection, direction, end) - axisParameter(projection, direction, start))
        / (data.document.display.mmToSceneUnit * data.pose.scale[index]!);
      if (!Number.isFinite(deltaSourceMM)) throw refused('Control-point source-axis displacement is nonfinite.');
      if (deltaSourceMM !== 0) moved[index] += deltaSourceMM;
    }
    const patch = Object.freeze({uIndex: selected.uIndex, vIndex: selected.vIndex,
      xMM: moved[0], yMM: moved[1], zMM: moved[2], weight: data.surface.weights[selected.uIndex]![selected.vIndex]!});
    deriveRenderNativeSceneSurfacePoleEdit(data.document, bodyId, patch);
    return patch;
  } catch (cause) {throw native(cause);}
}
