import { tessellateQualifiedTranslatedStripBody } from '@barocss/cad';
import type { QualifiedTranslatedStripBodyMeshResult, QualifiedTranslatedStripBodyResult, TranslatedStripPlaneSplitResult } from '@barocss/cad';
import { prepareCamera, prepareEngineCameraRay, prepareEngineScene, raycastEngineScene } from '@barocss/gpu';
import type { EngineSceneNodeV0, EngineSceneV0, PreparedEngineScene, TriangleGeometryV0 } from '@barocss/gpu';
import type { CadEditorSplitPresentation } from './split-types.js';
import { CadEditorError } from './types.js';

type Triple = [number, number, number];
type Face = QualifiedTranslatedStripBodyResult['faces'][number];
interface Bounds { min: Triple; max: Triple }
export interface SolidSplitFaceQualification {
  componentId: string; bodyId: string; groupNodeId: string; nodeId: string; geometryId: string;
  faceId: string; role: Face['role']; orientation: Face['orientation']; supportRef: Face['supportRef'];
  authorityIndices: number[]; faceSampleIndices: number[]; triangleIndices: number[];
  parametersUV: number[]; quantizationGapsMM: number[];
}
export interface SolidSplitSelection {
  componentId: string; bodyId: string; faceId?: string; role?: Face['role'];
  orientation?: Face['orientation']; supportRef?: Face['supportRef'];
  triangleIndex?: number; nativeTriangleIndex?: number; authorityIndices?: number[];
  faceSampleIndices?: number[]; parametersUV?: number[]; approximate?: true;
}
export interface SolidSplitSceneReceipt {
  authority: TranslatedStripPlaneSplitResult;
  presentationKind: CadEditorSplitPresentation['kind'];
  meshes: QualifiedTranslatedStripBodyMeshResult[];
  scene: EngineSceneV0; prepared: PreparedEngineScene;
  bodies: { componentId: string; bodyId: string; groupNodeId: string; bounds: Bounds; faces: SolidSplitFaceQualification[] }[];
  qualifications: SolidSplitFaceQualification[];
  basis: 'x,z,-y'; textureUV: 'derived-zero';
}
const roles = ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax'];
const LIMIT = 16 * 1024 * 1024;
function check(value: unknown, code: CadEditorError['code'], message: string): asserts value {
  if (!value) throw new CadEditorError(code, message, { field: 'split-scene' });
}
function phase<T>(code: CadEditorError['code'], message: string, action: () => T): T {
  try { return action(); }
  catch (cause) { throw new CadEditorError(code, message, { field: 'split-scene' }, cause); }
}
function freezeOrdinary<T>(value: T, visited = new Set<object>()): T {
  if (value !== null && typeof value === 'object' && !ArrayBuffer.isView(value) && !visited.has(value)) {
    visited.add(value);
    for (const item of Object.values(value)) freezeOrdinary(item, visited);
    Object.freeze(value);
  }
  return value;
}
// Match #1455's complete signed UTF16-code-unit/UTF8 accounting, including
// repeated owned references and execution arrays, without a whole JSON string.
function checkWholeSize(value: unknown): void {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder(), ancestors = new Set<object>();
  const append = (text: string) => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(utf16 <= LIMIT && utf8 <= LIMIT, 'BUDGET', 'Complete Solid Split display evidence exceeds 16MiB UTF16/UTF8.');
  };
  const visit = (item: unknown, depth: number): void => {
    check(depth <= 128, 'BUDGET', 'Solid Split display evidence exceeds its traversal depth.');
    if (typeof item === 'number') {
      check(Number.isFinite(item), 'DISPLAY', 'Display evidence contains a nonfinite number.');
      append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return;
    }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') { append(JSON.stringify(item)); return; }
    check(typeof item === 'object' && !ancestors.has(item), 'DISPLAY', 'Display evidence must be complete acyclic data.');
    ancestors.add(item);
    if (Array.isArray(item) || ArrayBuffer.isView(item)) {
      append('['); let index = 0;
      for (const element of item as Iterable<unknown>) { if (index++) append(','); visit(element, depth + 1); }
      append(']');
    } else {
      append('{'); Object.entries(item).forEach(([key, element], index) => {
        if (index) append(','); append(JSON.stringify(key)); append(':'); visit(element, depth + 1);
      }); append('}');
    }
    ancestors.delete(item);
  };
  visit(value, 0);
}
function xyz(values: readonly number[]): number[] {
  const result: number[] = [];
  for (let index = 0; index < values.length; index += 3) result.push(values[index], values[index + 2], -values[index + 1]);
  return result;
}
function transform(id: string, parentId: string | null) {
  return { id, parentId, translation: [0, 0, 0] as Triple,
    rotationXYZW: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as Triple, visible: true };
}
function boundsOf(positions: readonly number[][]): Bounds {
  const min: Triple = [Infinity, Infinity, Infinity], max: Triple = [-Infinity, -Infinity, -Infinity];
  for (const values of positions) for (let index = 0; index < values.length; index += 3)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[index + axis]); max[axis] = Math.max(max[axis], values[index + axis]);
    }
  check([...min, ...max].every(Number.isFinite), 'DISPLAY', 'Complete admitted display bounds are required.');
  return { min, max };
}

/** Complete native authority stays outside the display DTO. No codec reconstruction here. */
export function prepareSolidSplitScene(presentation: CadEditorSplitPresentation,
  authority: TranslatedStripPlaneSplitResult): SolidSplitSceneReceipt {
  check(presentation.kind === 'original' || presentation.kind === 'split', 'INPUT', 'A current complete Split presentation is required.');
  checkWholeSize(authority);
  const displayed = presentation.kind === 'original' ? [presentation.body] : presentation.result.outputs.map(output => output.body);
  check(displayed.length === (presentation.kind === 'original' ? 1 : 2), 'DISPLAY', 'Original or both complete split Bodies are required.');
  const meshes = phase('NATIVE', 'Complete Solid Split Body tessellation refused.', () => displayed.map((body, component) =>
    tessellateQualifiedTranslatedStripBody(body, { evaluationId: `editor_split_eval_${component}`, meshId: `editor_split_mesh_${component}`,
      subdivisionsPerOriginalUSpan: 4, subdivisionsT: 4, subdivisionsW: 4,
      maximumVertices: 290, maximumTriangles: 576, maximumNativeSamples: 1104 })));
  const geometries: TriangleGeometryV0[] = [], nodes: EngineSceneNodeV0[] = [], qualifications: SolidSplitFaceQualification[] = [];
  const bodyRows = meshes.map((mesh, component) => {
    check(mesh.renderChunks.length === 6 && mesh.renderChunks.every((chunk, face) => chunk.role === roles[face]),
      'DISPLAY', 'Each complete Body must retain all six ordered Face chunks.');
    const componentId = presentation.kind === 'original' ? 'original' : `split_${component}`;
    const bodyId = mesh.body.body.id, groupNodeId = `solid_${componentId}_group`;
    nodes.push({ ...transform(groupNodeId, null), type: 'group' });
    const faces = mesh.renderChunks.map((chunk, face) => {
      const geometryId = `solid_${componentId}_geometry_${face}`, nodeId = `solid_${componentId}_node_${face}`;
      // Native chunks already carry effective orientation; do not reverse again.
      geometries.push({ format: 'barocss-gpu-triangle-geometry', version: 0, id: geometryId,
        coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
        positions: xyz(chunk.positionsMM), normals: xyz(chunk.normals),
        uvs: Array(chunk.authorityIndices.length * 2).fill(0), indices: [...chunk.indices] });
      nodes.push({ ...transform(nodeId, groupNodeId), type: 'mesh', geometryId, materialId: 'solid_split_material' });
      const qualification: SolidSplitFaceQualification = { componentId, bodyId, groupNodeId, geometryId, nodeId,
        faceId: chunk.faceId, role: chunk.role, orientation: chunk.orientation, supportRef: { ...mesh.body.faces[face].supportRef },
        authorityIndices: [...chunk.authorityIndices], faceSampleIndices: [...chunk.faceSampleIndices],
        triangleIndices: [...chunk.triangleIndices], parametersUV: [...chunk.parametersUV], quantizationGapsMM: [...chunk.quantizationGapsMM] };
      qualifications.push(qualification); return qualification;
    });
    return { componentId, bodyId, groupNodeId, faces };
  });
  const scene: EngineSceneV0 = { format: 'barocss-gpu-engine-scene', version: 0, id: 'solid_split_scene',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [.025, .035, .05],
    camera: { eye: [40, 30, 40], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 50, near: .1, far: 200 },
    geometries, materials: [{ id: 'solid_split_material', type: 'unlit', colorSpace: 'linear', color: [.3, .58, .8] }], nodes };
  const prepared = phase('DISPLAY', 'Real GPU EngineScene admission refused the complete Solid Split.', () => prepareEngineScene(scene));
  check(meshes.length <= 2 && geometries.length <= 12 && nodes.length <= 14 && prepared.draws.length <= 12
    && scene.materials.length === 1, 'BUDGET', 'Solid Split display cardinality limit exceeded.');
  const bodies = bodyRows.map(body => ({ ...body, bounds: boundsOf(prepared.draws
    .filter(draw => draw.node.parentId === body.groupNodeId).map(draw => draw.geometry.geometry.positions)) }));
  const receipt: SolidSplitSceneReceipt = { authority, presentationKind: presentation.kind, meshes, scene, prepared,
    bodies, qualifications, basis: 'x,z,-y', textureUV: 'derived-zero' };
  checkWholeSize(receipt);
  return fitSolidSplitScene(receipt, 1);
}

/** Display-only shape shared with the bounded worker DTO. */
export type SolidSplitDisplay = Pick<SolidSplitSceneReceipt, 'scene' | 'bodies' | 'qualifications' | 'presentationKind' | 'basis' | 'textureUV'>;
/** Camera-only fit from admitted display positions, without native calls or history edits. */
export function fitSolidSplitScene<T extends SolidSplitDisplay>(receipt: T, aspect: number, componentId?: string): T {
  check(Number.isFinite(aspect) && aspect >= 1 / 2048 && aspect <= 2048, 'INPUT', 'Fit requires the actual bounded viewport aspect.');
  const selected = componentId === undefined ? receipt.bodies : receipt.bodies.filter(body => body.componentId === componentId);
  check(selected.length > 0, 'STALE', 'The selected Solid Split Body is no longer displayed.');
  const bounds = boundsOf(selected.map(body => [...body.bounds.min, ...body.bounds.max]));
  const target: Triple = [0, 1, 2].map(axis => (bounds.min[axis] + bounds.max[axis]) / 2) as Triple;
  const radius = Math.max(.001, Math.hypot(...bounds.max.map((value, axis) => (value - bounds.min[axis]) / 2)));
  const fovYDegrees = receipt.scene.camera.fovYDegrees, vertical = fovYDegrees * Math.PI / 360;
  const halfAngle = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect));
  const distance = radius * 1.15 / Math.sin(halfAngle), direction: Triple = [1, .75, 1];
  const length = Math.hypot(...direction);
  const eye: Triple = direction.map((value, axis) => target[axis] + value * distance / length) as Triple;
  const camera = { eye, target, up: [0, 1, 0] as Triple, fovYDegrees,
    near: Math.max(.0001, distance - radius * 1.1), far: distance + radius * 1.1 };
  phase('DISPLAY', 'Solid Split fitted camera is not representable at this viewport aspect.', () => prepareCamera(camera, aspect));
  const scene: EngineSceneV0 = { ...receipt.scene, camera };
  const prepared = phase('DISPLAY', 'GPU admission refused the fitted Solid Split scene.', () => prepareEngineScene(scene));
  const result = (Object.hasOwn(receipt, 'prepared') ? { ...receipt, scene, prepared } : { ...receipt, scene }) as T;
  checkWholeSize(result); return freezeOrdinary(result);
}

/** x/y are actual backing pixel indices, bottom-left origin. Approximate triangles only. */
export function pickSolidSplitScene(receipt: SolidSplitDisplay, width: number, height: number,
  x: number, y: number): SolidSplitSelection | null {
  const hit = phase('DISPLAY', 'Approximate Solid Split camera-ray query refused.', () => {
    const { ray } = prepareEngineCameraRay(receipt.scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
      pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y });
    return raycastEngineScene(receipt.scene, ray);
  });
  if (hit === null) return null;
  const face = receipt.qualifications.find(item => item.nodeId === hit.nodeId && item.geometryId === hit.geometryId);
  check(face !== undefined && hit.triangleIndex >= 0 && hit.triangleIndex < face.triangleIndices.length,
    'STALE', 'The displayed triangle has no current native-qualified Solid Split identity.');
  const geometry = receipt.scene.geometries.find(item => item.id === face.geometryId);
  check(geometry !== undefined, 'STALE', 'The picked geometry is no longer displayed.');
  const corners = geometry.indices.slice(hit.triangleIndex * 3, hit.triangleIndex * 3 + 3);
  return freezeOrdinary({ componentId: face.componentId, bodyId: face.bodyId, faceId: face.faceId, role: face.role,
    orientation: face.orientation, supportRef: { ...face.supportRef }, triangleIndex: hit.triangleIndex,
    nativeTriangleIndex: face.triangleIndices[hit.triangleIndex], authorityIndices: corners.map(index => face.authorityIndices[index]),
    faceSampleIndices: corners.map(index => face.faceSampleIndices[index]),
    parametersUV: corners.flatMap(index => [face.parametersUV[index * 2], face.parametersUV[index * 2 + 1]]), approximate: true as const });
}
