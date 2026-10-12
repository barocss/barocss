import { checkSerialLineage } from './prism-feature-lineage.js';
import type { ConvexPlanarSolidMeshResult, XYAffinePrismFeatureResult, XYAffinePrismFeatureResultV2 } from '@barocss/cad';
import { prepareEngineScene, prepareEngineCameraRay, raycastEngineScene } from '@barocss/gpu';
import type { EngineSceneV0, TriangleGeometryV0 } from '@barocss/gpu';

export type PrismDisplayRole = 'source' | 'first' | 'second';
export type PrismDisplayView = 'source' | 'result';
/** No native Solid/Model crosses the worker boundary. Native UV and all provenance remain copied CPU data. */
export interface PrismSerialLineage {
  kind: 'serial-part-v2'; parentSolidId: string; finalSolidId: string;
  original: XYAffinePrismFeatureResultV2['prisms'][0]['lineage'];
  subtraction: XYAffinePrismFeatureResultV2['subtraction']['second']['lineage'];
  chamfer: XYAffinePrismFeatureResultV2['chamfer']['lineage'];
  split: XYAffinePrismFeatureResultV2['chamfer']['split']['lineage'];
  resolution: XYAffinePrismFeatureResultV2['chamferResolution'];
}
export interface PrismDisplayComponent extends Pick<ConvexPlanarSolidMeshResult, 'mesh' | 'boundaries' | 'internalDiagonals' | 'report'> {
  role: PrismDisplayRole;
  lineage: XYAffinePrismFeatureResult['prisms'][number]['lineage'] | XYAffinePrismFeatureResult['subtraction']['first']['lineage'] | PrismSerialLineage;
}
export interface PrismDisplayPacket {
  documentId: string; revision: number; components: PrismDisplayComponent[];
  outcomes: { role: 'first' | 'second'; solidId: string; status: 'solid' | 'empty' }[];
}
export interface PrismDisplayScene { packet: PrismDisplayPacket; view: PrismDisplayView; scene: EngineSceneV0 }
export interface PrismFaceSelection {
  documentId: string; revision: number; role: PrismDisplayRole; solidId: string;
  face: ConvexPlanarSolidMeshResult['mesh']['faces'][number];
  vertices: ConvexPlanarSolidMeshResult['mesh']['vertices'];
  boundaries: ConvexPlanarSolidMeshResult['boundaries'];
  lineage: PrismDisplayComponent['lineage']; triangleIndex: number; approximate: true;
}
function check(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error(`Prism display: ${detail}`); }
function exact(value: object, keys: string[]) { check(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'exact copied DTO fields required'); }
const xyz = (values: number[]) => values.flatMap((value, i) => i % 3 ? [] : [value, values[i + 2], -values[i + 1]]);
/** Software admission only; no native reconstruction, GPU execution or pixel claim. */
export function preparePrismFeatureScene(packet: PrismDisplayPacket, view: PrismDisplayView, aspect = 1): PrismDisplayScene {
  check(packet && typeof packet.documentId === 'string' && Number.isSafeInteger(packet.revision) && packet.revision >= 0, 'document qualification required');
  exact(packet, ['documentId', 'revision', 'components', 'outcomes']);
  check(view === 'source' || view === 'result', 'unknown view');
  check(Number.isFinite(aspect) && aspect >= 1 / 2048 && aspect <= 2048, 'invalid viewport aspect');
  check(Array.isArray(packet.components) && packet.components.length >= 1 && packet.components.length <= 3, 'component budget');
  check(new Set(packet.components.map(c => c.role)).size === packet.components.length && packet.components.some(c => c.role === 'source')
    && packet.components.every(c => ['source', 'first', 'second'].includes(c.role)), 'fixed role inventory required');
  check(Array.isArray(packet.outcomes) && packet.outcomes.length === 2 && packet.outcomes[0].role === 'first' && packet.outcomes[1].role === 'second', 'ordered result roles required');
  for (const outcome of packet.outcomes) {
    const component = packet.components.find(c => c.role === outcome.role);
    check(outcome.status === 'empty' ? !component : outcome.status === 'solid' && component?.report.solidId === outcome.solidId, 'result inventory mismatch');
  }
  check(JSON.stringify(packet).length <= 2 * 1024 * 1024, 'copied packet exceeds 2 MiB');
  for (const component of packet.components) {
    exact(component, ['role', 'mesh', 'boundaries', 'internalDiagonals', 'report', 'lineage']);
    const { mesh, report, boundaries, internalDiagonals } = component;
    if ('kind' in component.lineage && component.lineage.kind === 'serial-part-v2') {
      const lineage = component.lineage;
      exact(lineage, ['kind', 'parentSolidId', 'finalSolidId', 'original', 'subtraction', 'chamfer', 'split', 'resolution']);
      check(component.role === 'second' && lineage.finalSolidId === report.solidId
        && lineage.parentSolidId === lineage.resolution.parent.solidId
        && lineage.parentSolidId !== lineage.finalSolidId
        && lineage.resolution.parent.componentRole === 'second'
        && lineage.resolution.policy === 'original-face-and-complete-use-lineage-to-one-opposite-pair'
        && lineage.resolution.persistentNamingCertified === false, 'serial final/parent identity mismatch');
    }
    exact(mesh, ['positionsMM', 'normals', 'parametersUV', 'indices', 'vertices', 'faces']);
    check(report.schema === 'barocss-convex-planar-solid-mesh' && report.version === 0 && report.lengthUnit === 'mm'
      && report.sourceFrame === 'authored-xyz-no-axis-conversion', 'mesh profile mismatch');
    check(mesh.faces.length >= 4 && mesh.faces.length <= 12 && mesh.vertices.length <= 64 && mesh.indices.length <= 120
      && mesh.faces.length === report.faceCount && mesh.vertices.length === report.vertexCount && mesh.indices.length === report.triangleCount * 3, 'mesh inventory budget');
    check(mesh.positionsMM.length === mesh.vertices.length * 3 && mesh.normals.length === mesh.positionsMM.length
      && mesh.parametersUV.length === mesh.vertices.length * 2 && mesh.indices.length % 3 === 0, 'attribute cardinality');
    check([...mesh.positionsMM, ...mesh.normals, ...mesh.parametersUV].every(Number.isFinite), 'finite attributes required');
    check(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.vertices.length), 'index outside mesh');
    check(boundaries.every(b => Number.isInteger(b.faceIndex) && b.faceIndex >= 0 && b.faceIndex < mesh.faces.length)
      && internalDiagonals.every(d => Number.isInteger(d.faceIndex) && d.faceIndex >= 0 && d.faceIndex < mesh.faces.length), 'provenance face index');
    let vertexOffset = 0, indexOffset = 0;
    for (const [faceIndex, face] of mesh.faces.entries()) {
      check(face.vertexOffset === vertexOffset && face.indexOffset === indexOffset && face.vertexCount >= 3 && face.vertexCount <= 8
        && face.indexCount === (face.vertexCount - 2) * 3, 'complete ordered face ranges required');
      check(['forward', 'reverse'].includes(face.orientation), 'face orientation');
      for (let i = 0; i < face.vertexCount; i++) {
        const vertex = mesh.vertices[vertexOffset + i], normal = mesh.normals.slice((vertexOffset + i) * 3, (vertexOffset + i + 1) * 3);
        check(vertex && vertex.sourceId === face.sourceId && vertex.faceId === face.faceId && vertex.surfaceId === face.surfaceId && vertex.loopId === face.loopId, 'vertex face/source mismatch');
        check(Math.abs(Math.hypot(...normal) - 1) <= 1e-6, 'unit normals required');
      }
      for (let k = 1; k + 1 < face.vertexCount; k++) {
        const indices = mesh.indices.slice(indexOffset + (k - 1) * 3, indexOffset + k * 3);
        check(indices[0] === vertexOffset && indices[1] === vertexOffset + k && indices[2] === vertexOffset + k + 1, 'exact native fan mapping required');
        const [a, b, c] = indices.map(i => mesh.positionsMM.slice(i * 3, i * 3 + 3));
        const u = b.map((v, i) => v - a[i]), v = c.map((x, i) => x - a[i]);
        const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        check(cross.reduce((sum, value, i) => sum + value * mesh.normals[vertexOffset * 3 + i], 0) > 0, 'outward triangle required');
      }
      const edges = boundaries.filter(b => b.faceIndex === faceIndex), diagonals = internalDiagonals.filter(d => d.faceIndex === faceIndex);
      check(edges.length === face.vertexCount && diagonals.length === face.vertexCount - 3, 'boundary/diagonal inventory');
      edges.forEach((edge, i) => check(edge.vertexIndices.length === 2 && edge.nativeVertexIds.length === 2 && edge.solidVertexIds.length === 2 && edge.role === 'native-boundary' && edge.sourceId === face.sourceId && edge.faceId === face.faceId
        && edge.loopId === face.loopId && edge.useId === mesh.vertices[vertexOffset + i].useId
        && edge.vertexIndices[0] === vertexOffset + i && edge.vertexIndices[1] === vertexOffset + (i + 1) % face.vertexCount
        && edge.nativeVertexIds.every((id, j) => id === mesh.vertices[edge.vertexIndices[j]].nativeVertexId)
        && edge.solidVertexIds.every((id, j) => id === mesh.vertices[edge.vertexIndices[j]].solidVertexId), 'true boundary mapping required'));
      diagonals.forEach((diagonal, i) => check(diagonal.vertexIndices.length === 2 && diagonal.role === 'display-internal-not-brep-edge' && diagonal.vertexIndices[0] === vertexOffset
        && diagonal.vertexIndices[1] === vertexOffset + i + 2, 'internal fan diagonal mapping required'));
      vertexOffset += face.vertexCount; indexOffset += face.indexCount;
    }
    check(vertexOffset === mesh.vertices.length && indexOffset === mesh.indices.length && boundaries.length === report.boundaryUseCount
      && internalDiagonals.length === report.internalDiagonalCount, 'complete mesh ranges required');
  }
  const visible = packet.components.filter(c => view === 'source' ? c.role === 'source' : c.role !== 'source');
  for (const component of packet.components) if ('kind' in component.lineage && component.lineage.kind === 'serial-part-v2')
    checkSerialLineage(component, packet.components.find(c => c.role === 'source')!);
  const geometries: TriangleGeometryV0[] = visible.map(c => ({ format: 'barocss-gpu-triangle-geometry', version: 0, id: `prism_geometry_${c.role}`,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', positions: xyz(c.mesh.positionsMM), normals: xyz(c.mesh.normals),
    uvs: Array(c.mesh.vertices.length * 2).fill(0), indices: [...c.mesh.indices] }));
  const points = geometries.flatMap(g => g.positions);
  const min = [0, 1, 2].map(axis => points.length ? Math.min(...points.filter((_, i) => i % 3 === axis)) : -1);
  const max = [0, 1, 2].map(axis => points.length ? Math.max(...points.filter((_, i) => i % 3 === axis)) : 1);
  const target = min.map((v, i) => (v + max[i]) / 2) as [number, number, number];
  const radius = Math.max(.001, Math.hypot(...max.map((v, i) => (v - min[i]) / 2)));
  const halfAngle = Math.min(Math.PI / 7.2, Math.atan(Math.tan(Math.PI / 7.2) * aspect));
  const distance = radius * 1.2 / Math.sin(halfAngle), direction = [1, .75, 1], length = Math.hypot(...direction);
  const scene: EngineSceneV0 = { format: 'barocss-gpu-engine-scene', version: 0, id: 'prism_feature_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
    background: [.025, .035, .05], camera: { eye: direction.map((v, i) => target[i] + v * distance / length) as [number, number, number], target,
      up: [0, 1, 0], fovYDegrees: 50, near: Math.max(.0001, distance - radius * 1.1), far: distance + radius * 1.1 },
    geometries, materials: [{ id: 'prism_material', type: 'unlit', colorSpace: 'linear', color: [.3, .58, .8] }],
    nodes: visible.map(c => ({ id: `prism_node_${c.role}`, parentId: null, type: 'mesh', geometryId: `prism_geometry_${c.role}`, materialId: 'prism_material',
      translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true })) };
  // The generic scene supports zero draws: empty material remains a real empty scene.
  prepareEngineScene(scene);
  return { packet: structuredClone(packet), view, scene };
}
export function pickPrismFeatureScene(display: PrismDisplayScene, width: number, height: number, x: number, y: number): PrismFaceSelection | null {
  if (!display.scene.geometries.length) return null;
  const { ray } = prepareEngineCameraRay(display.scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y });
  const hit = raycastEngineScene(display.scene, ray); if (!hit) return null;
  const component = display.packet.components.find(c => `prism_node_${c.role}` === hit.nodeId);
  check(component, 'picked component missing');
  const face = component.mesh.faces.find(f => hit.triangleIndex * 3 >= f.indexOffset && hit.triangleIndex * 3 < f.indexOffset + f.indexCount);
  check(face, 'picked face missing');
  return structuredClone({ documentId: display.packet.documentId, revision: display.packet.revision, role: component.role, solidId: component.report.solidId,
    face, vertices: component.mesh.indices.slice(hit.triangleIndex * 3, hit.triangleIndex * 3 + 3).map(i => component.mesh.vertices[i]),
    boundaries: component.boundaries.filter(b => b.sourceId === face.sourceId && b.faceId === face.faceId), lineage: component.lineage,
    triangleIndex: hit.triangleIndex, approximate: true });
}
