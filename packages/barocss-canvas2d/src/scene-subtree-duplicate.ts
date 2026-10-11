import { Canvas2DError, validateScene } from './schema.js';
import type { NodeV29, SceneV29 } from './schema.js';

export type SceneSubtreeDuplicateOptions = {
  nodeIds: Record<string, string>;
  assetIds: Record<string, string>;
  offset: { x: number; y: number };
};
export type SceneSubtreeDuplicateResult = {
  scene: SceneV29;
  duplicateRootId: string;
  nodeIdMap: Record<string, string>;
  assetIdMap: Record<string, string>;
};

const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }
function dataRecord(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid(`${label} must be a plain record`);
  }
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
    invalid(`${label} has unknown or missing fields`);
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field || !field.enumerable || !('value' in field)) invalid(`${label}.${key} must be a data field`);
    result[key] = field.value;
  }
  return result;
}
function validId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) invalid(`${label} is not a valid ID`);
  return value;
}
function admittedMap(value: unknown, inventory: string[], occupied: Set<string>, label: string): Record<string, string> {
  const raw = dataRecord(value, inventory, label);
  const result: Record<string, string> = Object.create(null), fresh = new Set<string>();
  for (const oldId of inventory) {
    const newId = validId(raw[oldId], `${label}.${oldId}`);
    if (fresh.has(newId) || occupied.has(newId)) invalid(`${label} has a colliding new ID`);
    fresh.add(newId); result[oldId] = newId;
  }
  return result;
}

/** Duplicate authored data and references. Asset pixels and display resources are acquired by the caller. */
export function duplicateSceneSubtree(input: unknown, sourceId: string,
  options: SceneSubtreeDuplicateOptions): SceneSubtreeDuplicateResult {
  const validated = validateScene(input);
  if (validated.version !== 29) throw new Canvas2DError('UNSUPPORTED_FEATURE', 'subtree duplication needs Scene29');
  const scene = validated;
  const selectedId = validId(sourceId, 'sourceId');
  const allNodes: NodeV29[] = [], allAssets = new Set<string>();
  let source: NodeV29 | undefined, siblings: NodeV29[] | undefined;
  function visit(nodes: NodeV29[]): void {
    for (const node of nodes) {
      allNodes.push(node);
      if (node.id === selectedId) { source = node; siblings = nodes; }
      if (node.kind === 'image') allAssets.add(node.imageId);
      if (node.kind === 'glyphRun') allAssets.add(node.atlasId);
      if (node.kind === 'group' || node.kind === 'frame') visit(node.children);
    }
  }
  visit(scene.nodes);
  if (!source || !siblings) invalid('sourceId is absent from the scene');
  const selected: NodeV29[] = [], selectedAssets = new Set<string>();
  function inventory(node: NodeV29): void {
    selected.push(node);
    if (node.kind === 'image') selectedAssets.add(node.imageId);
    if (node.kind === 'glyphRun') selectedAssets.add(node.atlasId);
    if (node.kind === 'group' || node.kind === 'frame') node.children.forEach(inventory);
  }
  inventory(source);
  const raw = dataRecord(options, ['nodeIds', 'assetIds', 'offset'], 'options');
  const occupiedNodes = new Set(allNodes.map(node => node.id)); occupiedNodes.add(scene.contextId);
  const nodeIdMap = admittedMap(raw.nodeIds, selected.map(node => node.id), occupiedNodes, 'nodeIds');
  const assetIdMap = admittedMap(raw.assetIds, [...selectedAssets], allAssets, 'assetIds');
  const offset = dataRecord(raw.offset, ['x', 'y'], 'offset');
  function coordinate(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > 1e6) {
      invalid(`${label} is outside its finite range`);
    }
    return value;
  }
  const dx = coordinate(offset.x, 'offset.x'), dy = coordinate(offset.y, 'offset.y');
  if (allNodes.length + selected.length > 256) throw new Canvas2DError('SCENE_LIMIT', 'duplicate exceeds 256 nodes');
  const x = source.transform.x + dx, y = source.transform.y + dy;
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
    throw new Canvas2DError('SCENE_LIMIT', 'duplicate root offset exceeds coordinate limits');
  }
  // Only validated, privately copied JSON data reaches this second copy.
  const duplicate = JSON.parse(JSON.stringify(source)) as NodeV29;
  function remap(node: NodeV29): void {
    node.id = nodeIdMap[node.id];
    if (node.kind === 'image') node.imageId = assetIdMap[node.imageId];
    if (node.kind === 'glyphRun') node.atlasId = assetIdMap[node.atlasId];
    if (node.kind === 'group' || node.kind === 'frame') node.children.forEach(remap);
  }
  remap(duplicate);
  duplicate.transform.x = x === 0 ? 0 : x; duplicate.transform.y = y === 0 ? 0 : y;
  siblings.splice(siblings.indexOf(source) + 1, 0, duplicate);
  const candidate = validateScene(scene) as SceneV29;
  return { scene: candidate, duplicateRootId: duplicate.id, nodeIdMap, assetIdMap };
}
