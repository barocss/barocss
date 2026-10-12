import {createCadGeometryReference, queryCadDocumentBounds, validateCadDocumentBounds} from '@barocss/cad';
import {prepareCamera, prepareEngineScene, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {prepareRenderNativeLightDocument, normalizeRenderEditorError, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument} from '@barocss/render-editor';

type XYZ = [number, number, number];
interface Viewport {width: number; height: number; backingWidth: number; backingHeight: number}
const MARGIN = 1.2;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function viewportCopy(input: Viewport): Viewport {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'Framing dimensions require plain own data.');
  const fields = ['width', 'height', 'backingWidth', 'backingHeight'] as const, keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => fields.some(field => field === key)), 'Framing dimensions have unsupported fields.');
  const owned = {} as Viewport;
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number'
      && Number.isFinite(descriptor.value) && descriptor.value > 0, 'Framing requires finite positive dimensions.');
    owned[key] = descriptor.value;
  }
  check(owned.width <= 16384 && owned.height <= 16384 && Number.isInteger(owned.backingWidth) && Number.isInteger(owned.backingHeight)
    && owned.backingWidth <= 4096 && owned.backingHeight <= 4096 && owned.backingWidth * owned.backingHeight <= 4194304,
  'Framing dimensions exceed the bounded viewport.');
  return owned;
}
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);

/** App-local conservative control-hull fit. Original scene authority is never edited. */
export function deriveNativeLightFramingCamera(document: RenderNativeLightDocument, camera: MeshCamera,
  input: Viewport, bodyId?: string): MeshCamera {
  try {
    const viewport = viewportCopy(input), current = validateMeshCamera(camera);
    check(bodyId === undefined || typeof bodyId === 'string' && bodyId.length > 0, 'Framing requires an original body ID.');
    const prepared = prepareRenderNativeLightDocument(document), accepted = prepared.document;
    const ids = bodyId === undefined ? accepted.display.visibleBodyIds.filter(id =>
      prepared.materials.some(material => material.target.bodyId === id)) : [bodyId];
    check(ids.length > 0, 'There are no visible material-bound bodies to frame.');
    const corners: XYZ[] = [];
    for (const id of ids) {
      const entries = prepared.entries.filter(entry => entry.binding.bodyId === id);
      const materials = prepared.materials.filter(material => material.target.bodyId === id);
      check(entries.length === 1 && entries[0].kind === 'surface' && materials.length === 1
        && accepted.display.visibleBodyIds.includes(id), 'Frame requires a unique visible material-bound Surface body.');
      const binding = entries[0].binding, target = materials[0].target;
      check((['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'] as const)
        .every(key => Object.is(binding[key], target[key])), 'Framing material and original body pins differ.');
      const {reference} = createCadGeometryReference(prepared.native, {bodyId: id});
      check((['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'geometryId', 'geometryKind', 'sourceFrame'] as const)
        .every(key => Object.is(reference[key], binding[key])), 'Framing bounds and qualified body pins differ.');
      const bounds = queryCadDocumentBounds(prepared.native, reference);
      validateCadDocumentBounds(prepared.native, bounds);
      const pose = accepted.display.poses.find(value => value.bodyId === id);
      const scale = pose?.scale ?? [1, 1, 1], translation = pose?.translationMM ?? [0, 0, 0];
      // The existing GPU SRT service owns the normalized quaternion convention. Unit
      // scale/zero translation avoids narrowing the Native .001..100/mm pose limits.
      const rig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'light_frame_pose',
        coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: current,
        geometries: [], materials: [], nodes: [{id: 'body', type: 'group', parentId: null, translation: [0, 0, 0],
          rotationXYZW: [...(pose?.rotationXYZW ?? [0, 0, 0, 1])], scale: [1, 1, 1], visible: true}]});
      const matrix = rig.nodes[0].worldMatrix;
      for (let index = 0; index < 8; index++) {
        const point = [0, 1, 2].map(axis => (index & (1 << axis) ? bounds.boundsMM.max[axis] : bounds.boundsMM.min[axis]) * scale[axis]);
        const transformed = [0, 1, 2].map(row => (matrix[row] * point[0] + matrix[4 + row] * point[1]
          + matrix[8 + row] * point[2] + translation[row]) * accepted.display.mmToSceneUnit) as XYZ;
        check(transformed.every(Number.isFinite), 'Posed control-hull bounds are nonfinite.'); corners.push(transformed);
      }
    }
    const low = [0, 1, 2].map(axis => Math.min(...corners.map(point => point[axis])));
    const high = [0, 1, 2].map(axis => Math.max(...corners.map(point => point[axis])));
    const center = low.map((value, axis) => value / 2 + high[axis] / 2) as XYZ;
    check(center.every(Number.isFinite) && high.some((value, axis) => value > low[axis]), 'Bounds have no resolvable finite extent.');
    const aspect = viewport.backingWidth / viewport.backingHeight, original = prepareCamera(current, aspect);
    const offset = current.eye.map((value, axis) => value - current.target[axis]), length = Math.hypot(...offset);
    const backward = offset.map(value => value / length);
    const right = [original.view[0], original.view[4], original.view[8]], up = [original.view[1], original.view[5], original.view[9]];
    const relative = corners.map(point => point.map((value, axis) => value - center[axis]));
    const depths = relative.map(point => dot(point, backward));
    let distance = Math.max(...depths) + .001;
    for (const [index, point] of relative.entries()) distance = Math.max(distance,
      depths[index] + MARGIN * Math.abs(dot(point, right)) * original.projection[0],
      depths[index] + MARGIN * Math.abs(dot(point, up)) * original.projection[5]);
    check(Number.isFinite(distance) && distance > 0, 'Framing distance is nonfinite or degenerate.');
    const near = Math.max(.0001, Math.min(...depths.map(depth => distance - depth)) * .5);
    const far = Math.max(near * 2, Math.max(...depths.map(depth => distance - depth)) * MARGIN);
    const result = validateMeshCamera({...current, eye: center.map((value, axis) => value + backward[axis] * distance) as XYZ,
      target: center, near, far});
    const final = prepareCamera(result, aspect);
    for (const point of corners) {
      const view = [0, 1, 2].map(row => final.view[row] * point[0] + final.view[4 + row] * point[1]
        + final.view[8 + row] * point[2] + final.view[12 + row]), depth = -view[2];
      check(view.every(Number.isFinite) && depth > result.near && depth < result.far,
        'The admitted camera cannot retain every bounds corner inside its clips.');
      check(Math.abs(final.projection[0] * view[0] / depth) <= 1 / MARGIN + 1e-5
        && Math.abs(final.projection[5] * view[1] / depth) <= 1 / MARGIN + 1e-5,
      'The admitted camera cannot retain the declared control-hull framing margin.');
    }
    return result;
  } catch (cause) {
    const error = normalizeRenderEditorError(cause, 'DOCUMENT_INPUT');
    if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
    throw error;
  }
}
