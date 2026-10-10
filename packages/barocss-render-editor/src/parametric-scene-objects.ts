import type {EngineSceneNodeV0, EngineSceneMaterialV0} from '@barocss/gpu';
import {validateRenderParametricSceneDocumentV2} from './parametric-scene-document-v2.js';
import type {RenderParametricSceneDocumentV2, RenderParametricGeometrySourceV2} from './parametric-scene-document-v2.js';
import {copyRenderParametricObjectData} from './parametric-scene-object-data.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export interface RenderParametricSceneAddV2 {
  readonly node: EngineSceneNodeV0;
  readonly geometrySource: RenderParametricGeometrySourceV2 | null;
  readonly material: EngineSceneMaterialV0 | null;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}
function record(input: unknown, label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label + ' requires a plain record.');
  return input as Record<string, unknown>;
}
function subtree(nodes: readonly EngineSceneNodeV0[], nodeId: string): Set<string> {
  const children = new Map<string, string[]>();
  let found = false;
  for (const node of nodes) {
    if (node.id === nodeId) found = true;
    if (node.parentId !== null) {
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node.id); children.set(node.parentId, siblings);
    }
  }
  check(found, 'The original parametric node does not exist.');
  const selected = new Set<string>(), pending = [nodeId];
  while (pending.length) {
    const id = pending.pop()!;
    if (selected.has(id)) continue;
    selected.add(id); pending.push(...(children.get(id) ?? []));
  }
  return selected;
}
function failure(cause: unknown): never {
  const error = normalizeRenderEditorError(cause);
  if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
  throw error;
}

/** Append one explicit original node and optional new resources. Revision belongs to session Apply. */
export function addRenderParametricSceneNodeV2(document: RenderParametricSceneDocumentV2,
  input: RenderParametricSceneAddV2): RenderParametricSceneDocumentV2 {
  try {
    const original = validateRenderParametricSceneDocumentV2(document);
    const data = record(copyRenderParametricObjectData(input), 'Parametric node addition');
    const fields = ['node', 'geometrySource', 'material'], keys = Object.keys(data);
    check(keys.length === fields.length && keys.every(key => fields.includes(key)), 'Node addition requires exactly node, geometrySource, and material.');
    const node = record(data.node, 'Added parametric node');
    check(node.type === 'group' || node.type === 'mesh', 'Added node must be a group or mesh.');
    const geometrySources = [...original.geometrySources], materials = [...original.materials];
    if (node.type === 'group') {
      check(data.geometrySource === null && data.material === null, 'A group cannot add geometry or material resources.');
    } else {
      if (data.geometrySource !== null) {
        const source = record(data.geometrySource, 'Added geometry source');
        check(typeof source.id === 'string' && source.id === node.geometryId, 'New geometry source ID must match the added mesh geometry ID.');
        check(!geometrySources.some(value => value.id === source.id), 'Added geometry source ID already exists.');
        geometrySources.push(data.geometrySource as RenderParametricGeometrySourceV2);
      }
      if (data.material !== null) {
        const material = record(data.material, 'Added material');
        check(typeof material.id === 'string' && material.id === node.materialId, 'New material ID must match the added mesh material ID.');
        check(!materials.some(value => value.id === material.id), 'Added material ID already exists.');
        materials.push(data.material as EngineSceneMaterialV0);
      }
    }
    return validateRenderParametricSceneDocumentV2({...original, geometrySources, materials,
      nodes: [...original.nodes, data.node as EngineSceneNodeV0]});
  } catch (cause) {return failure(cause);}
}

/** Clone an entire subtree, retaining its external parent and shared resource references. */
export function duplicateRenderParametricSceneNodeV2(document: RenderParametricSceneDocumentV2,
  nodeId: string, newIds: Readonly<Record<string, string>>): RenderParametricSceneDocumentV2 {
  try {
    const original = validateRenderParametricSceneDocumentV2(document);
    const data = record(copyRenderParametricObjectData({nodeId, newIds}), 'Parametric node duplication');
    check(typeof data.nodeId === 'string', 'Duplicate requires an original node ID.');
    const selected = subtree(original.nodes, data.nodeId), ids = record(data.newIds, 'Duplicate node ID map');
    const keys = Object.keys(ids);
    check(keys.length === selected.size && keys.every(key => selected.has(key)), 'Duplicate ID map must cover exactly the original subtree.');
    const existing = new Set(original.nodes.map(node => node.id)), used = new Set<string>();
    for (const key of keys) {
      const id = ids[key];
      check(typeof id === 'string', 'Every duplicate node ID must be a string.');
      check(!existing.has(id) && !used.has(id), 'Duplicate node IDs must be new and unique.');
      used.add(id);
    }
    const clones = original.nodes.filter(node => selected.has(node.id)).map(node => ({...node,
      id: ids[node.id] as string,
      parentId: node.id === data.nodeId ? node.parentId : ids[node.parentId!] as string,
    }));
    return validateRenderParametricSceneDocumentV2({...original, nodes: [...original.nodes, ...clones]});
  } catch (cause) {return failure(cause);}
}

/** Remove only the authored subtree; even unused original resources remain in the document. */
export function removeRenderParametricSceneNodeV2(document: RenderParametricSceneDocumentV2,
  nodeId: string): RenderParametricSceneDocumentV2 {
  try {
    const original = validateRenderParametricSceneDocumentV2(document);
    const data = record(copyRenderParametricObjectData({nodeId}), 'Parametric node removal');
    check(typeof data.nodeId === 'string', 'Remove requires an original node ID.');
    const selected = subtree(original.nodes, data.nodeId);
    return validateRenderParametricSceneDocumentV2({...original,
      nodes: original.nodes.filter(node => !selected.has(node.id))});
  } catch (cause) {return failure(cause);}
}
