/** #1455 example composition. Complete native authority remains separate from display data. */
import { parseTranslatedStripPlaneSplit, tessellateQualifiedTranslatedStripBody } from '../../packages/barocss-cad/src/index.js';
import { prepareEngineScene } from '../../packages/barocss-gpu/src/index.js';
import type { EngineSceneV0, EngineSceneNodeV0, TriangleGeometryV0 } from '../../packages/barocss-gpu/src/index.js';

type Code = 'INPUT' | 'SOURCE' | 'MESH' | 'SCENE' | 'BUDGET';
export class SplitBodyEngineSceneError extends Error {
  constructor(readonly code: Code, detail: string, cause?: unknown) {
    super(('Split Body engine example: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'SplitBodyEngineSceneError';
  }
}
function phase<T>(code: Code, detail: string, action: () => T): T {
  try { return action(); } catch (cause) { throw new SplitBodyEngineSceneError(code, detail, cause); }
}
const roles = ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax'];
function xyz(values: readonly number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 3) result.push(values[i], values[i + 2], -values[i + 1]);
  return result;
}
function transform(id: string, parentId: string | null) {
  return { id, parentId, translation: [0, 0, 0] as [number, number, number],
    rotationXYZW: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number], visible: true };
}
function freezeOrdinary<T>(value: T, visited = new Set<object>()): T {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value) && !visited.has(value)) {
    visited.add(value); Object.values(value).forEach(item => freezeOrdinary(item, visited)); Object.freeze(value);
  }
  return value;
}
// Count the complete signed representation, including repeated owned references and
// typed execution arrays. Do not assemble an oversized serialized string first.
function checkWholeSize(value: unknown): void {
  let utf16 = 0, utf8 = 0;
  const append = (text: string) => {
    utf16 += text.length; utf8 += new TextEncoder().encode(text).length;
    if (utf16 > 16777216 || utf8 > 16777216) throw new SplitBodyEngineSceneError('BUDGET', 'Complete example exceeds16MiB UTF16/UTF8');
  };
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item !== 'object') { append(JSON.stringify(item)); return; }
    if (Array.isArray(item) || ArrayBuffer.isView(item)) {
      append('['); let index = 0;
      for (const element of item as Iterable<unknown>) { if (index++) append(','); visit(element); }
      append(']'); return;
    }
    append('{'); Object.entries(item).forEach(([key, element], i) => { if (i) append(','); append(JSON.stringify(key)); append(':'); visit(element); }); append('}');
  };
  visit(value);
}

/** Example-only CPU provider. No device/frame/resource handle or native picking certificate. */
export function prepareSplitBodyEngineScene(authoredText: string) {
  if (typeof authoredText !== 'string') throw new SplitBodyEngineSceneError('INPUT', 'Complete authored split text required');
  const split = phase('SOURCE', 'Complete authored split codec refused', () => parseTranslatedStripPlaneSplit(authoredText));
  const meshes = phase('MESH', 'Complete output Body tessellation refused', () => split.outputs.map((output, component) =>
    tessellateQualifiedTranslatedStripBody(output.body, {
      evaluationId: 'gpu_split_eval_' + component, meshId: 'gpu_split_mesh_' + component,
      subdivisionsPerOriginalUSpan: 4, subdivisionsT: 4, subdivisionsW: 4,
      maximumVertices: 290, maximumTriangles: 576, maximumNativeSamples: 1104,
    })));
  if (meshes.length !== 2 || meshes.some(mesh => mesh.renderChunks.length !== 6 || mesh.renderChunks.some((chunk, face) => chunk.role !== roles[face])))
    throw new SplitBodyEngineSceneError('MESH', 'Two whole Bodies with six ordered Face chunks required');
  const geometries: TriangleGeometryV0[] = [], nodes: EngineSceneNodeV0[] = [];
  const components = meshes.map((mesh, component) => {
    const groupNodeId = 'split_group_' + component;
    nodes.push({ ...transform(groupNodeId, null), type: 'group' });
    const faces = mesh.renderChunks.map((chunk, face) => {
      const geometryId = `split_geometry_${component}_${face}`, nodeId = `split_node_${component}_${face}`;
      geometries.push({ format: 'barocss-gpu-triangle-geometry', version: 0, id: geometryId,
        coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
        positions: xyz(chunk.positionsMM), normals: xyz(chunk.normals),
        uvs: Array(chunk.authorityIndices.length * 2).fill(0), indices: [...chunk.indices] });
      nodes.push({ ...transform(nodeId, groupNodeId), type: 'mesh', geometryId, materialId: 'split_material' });
      return { geometryId, nodeId, faceId: chunk.faceId, role: chunk.role, orientation: chunk.orientation,
        supportRef: { ...mesh.body.faces[face].supportRef }, authorityIndices: [...chunk.authorityIndices],
        faceSampleIndices: [...chunk.faceSampleIndices], triangleIndices: [...chunk.triangleIndices],
        parametersUV: [...chunk.parametersUV], quantizationGapsMM: [...chunk.quantizationGapsMM] };
    });
    return { index: component, bodyId: mesh.body.body.id, groupNodeId, faces };
  });
  const scene: EngineSceneV0 = { format: 'barocss-gpu-engine-scene', version: 0, id: 'split_body_pair_scene',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [.02, .03, .04],
    camera: { eye: [40, 30, 40], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 60, near: .1, far: 200 },
    geometries, materials: [{ id: 'split_material', type: 'unlit', colorSpace: 'linear', color: [.25, .5, .75] }], nodes };
  const prepared = phase('SCENE', 'Existing GPU EngineScene admission refused', () => prepareEngineScene(scene));
  const result = { format: 'barocss-gpu-example-split-body-engine-scene' as const, version: 0 as const,
    authoredText, split, meshes, scene, prepared,
    qualification: { sourceFrame: 'authored-xyz-mm' as const, targetFrame: 'right-handed-y-up' as const,
      sceneUnitsPerMillimeter: 1 as const, basis: 'x,z,-y' as const, textureUV: 'derived-zero' as const, components } };
  checkWholeSize(result);
  return freezeOrdinary(result);
}
