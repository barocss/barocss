import { prepareEngineScene } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';

/** Opaque, stable-order draw grouping. This is CPU planning, not GPU instancing. */
export interface EngineDrawBatch {
  readonly geometryId: string;
  readonly materialId: string;
  readonly nodeIds: readonly string[];
  readonly instanceCount: number;
  readonly triangleCount: number;
}
export interface EngineDrawBatchPlan {
  readonly batches: readonly EngineDrawBatch[];
  readonly visibleDrawCount: number;
  readonly batchCount: number;
  readonly triangleInstances: number;
  readonly uniqueGeometryCount: number;
  readonly uniqueMaterialCount: number;
  readonly sharedGeometryBufferBytes: number;
  readonly instanceMatrixBytes: number;
}

function plan(prepared: PreparedEngineScene): EngineDrawBatchPlan {
  const batches: EngineDrawBatch[] = [];
  const geometry = new Set<string>(), material = new Set<string>();
  let visibleDrawCount = 0, triangleInstances = 0;
  for (const draw of prepared.draws) {
    if (!draw.node.effectiveVisible) continue;
    visibleDrawCount++;
    triangleInstances += draw.geometry.triangleCount;
    geometry.add(draw.geometryId); material.add(draw.materialId);
    const previous = batches[batches.length - 1];
    // Nonadjacent meshes are deliberately not coalesced: grouping cannot
    // silently reorder the existing opaque draw plan or equal-depth ties.
    if (previous && previous.geometryId === draw.geometryId && previous.materialId === draw.materialId) {
      const nodeIds = Object.freeze([...previous.nodeIds, draw.id]);
      batches[batches.length - 1] = Object.freeze({
        geometryId: previous.geometryId, materialId: previous.materialId,
        nodeIds, instanceCount: nodeIds.length, triangleCount: previous.triangleCount + draw.geometry.triangleCount,
      });
    } else batches.push(Object.freeze({
      geometryId: draw.geometryId, materialId: draw.materialId,
      nodeIds: Object.freeze([draw.id]), instanceCount: 1, triangleCount: draw.geometry.triangleCount,
    }));
  }
  const sharedGeometryBufferBytes = prepared.geometries
    .filter(item => geometry.has(item.geometry.id)).reduce((sum, item) => sum + item.bufferBytes, 0);
  // 16 floats world + 9 floats normal = 100 bytes per visible instance.
  return Object.freeze({
    batches: Object.freeze(batches), visibleDrawCount, batchCount: batches.length,
    triangleInstances, uniqueGeometryCount: geometry.size, uniqueMaterialCount: material.size,
    sharedGeometryBufferBytes, instanceMatrixBytes: visibleDrawCount * 100,
  });
}

/** Re-admits the complete authored scene; never trusts a caller-supplied prepared wrapper. */
export function prepareEngineDrawBatches(input: unknown): EngineDrawBatchPlan {
  return plan(prepareEngineScene(input));
}
