import { ownRecord, freezeGpuData } from './gpu-data.js';
import { EngineSceneError } from './engine-scene.js';
import type { EngineSceneDiagnosticCode, PreparedEngineScene, PreparedEngineSceneNode } from './engine-scene.js';

/** Optional presentation only; the accompanying triangle scene retains all picking authority. */
export interface EngineSceneEdgeOverlayV0 {
  format: 'barocss-gpu-engine-scene-edges';
  version: 0;
  sceneId: string;
  color: [number, number, number];
  owners: { nodeId: string; geometryId: string; indices: number[] }[];
}
interface PreparedEdgeOwner {
  readonly nodeId: string;
  readonly geometryId: string;
  readonly node: PreparedEngineSceneNode;
  readonly indices: Uint16Array | Uint32Array;
  readonly indexType: 'uint16' | 'uint32';
}
export interface PreparedEngineSceneEdges {
  readonly overlay: EngineSceneEdgeOverlayV0;
  readonly owners: readonly PreparedEdgeOwner[];
}
function check(condition: unknown, code: EngineSceneDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new EngineSceneError(code, 'Edge overlay: ' + detail);
}
function array(input: unknown, maximum: number, label: string): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, 'INPUT', label + ' must be a plain array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value as number;
  check(Number.isInteger(length) && length >= 0 && length <= maximum, 'BUDGET', label + ' exceeds its cardinality limit');
  const keys = Reflect.ownKeys(input);
  check(keys.length === length + 1, 'INPUT', label + ' must be dense without additional fields');
  const result: unknown[] = [];
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length, 'INPUT', label + ' has unsupported array fields');
  }
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    check(descriptor && 'value' in descriptor && descriptor.enumerable, 'INPUT', label + ' requires enumerable own data');
    result.push(descriptor.value);
  }
  return result;
}
function identifier(input: unknown, label: string): string {
  check(typeof input === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(input), 'INPUT', label + ' must be an ASCII identifier of 1..64 characters');
  return input;
}
function worldPoint(positions: Float32Array, index: number, matrix: Float32Array): number[] {
  return [0, 1, 2].map(axis => {
    let value = Math.fround(matrix[axis] * positions[index * 3]);
    value = Math.fround(value + Math.fround(matrix[4 + axis] * positions[index * 3 + 1]));
    value = Math.fround(value + Math.fround(matrix[8 + axis] * positions[index * 3 + 2]));
    return Math.fround(value + matrix[12 + axis]);
  });
}

/** Internal, pure admission against the exact prepared scene, including hidden/empty owners. */
export function prepareEngineSceneEdges(input: unknown, source: PreparedEngineScene): PreparedEngineSceneEdges | null {
  if (input === undefined || input === null) return null;
  try {
    const data = ownRecord(input, ['format', 'version', 'sceneId', 'color', 'owners']);
    check(data.format === 'barocss-gpu-engine-scene-edges' && data.version === 0, 'VERSION', 'Only edge overlay0 metadata is supported');
    const sceneId = identifier(data.sceneId, 'sceneId');
    check(sceneId === source.scene.id, 'REFERENCE', 'sceneId must match the accompanying scene');
    const color = array(data.color, 3, 'color');
    check(color.length === 3 && color.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1),
      'INPUT', 'color requires three finite linear RGB values in0..1');
    const rows = array(data.owners, 16, 'owners').map(input => {
      const row = ownRecord(input, ['nodeId', 'geometryId', 'indices']);
      return { nodeId: identifier(row.nodeId, 'nodeId'), geometryId: identifier(row.geometryId, 'geometryId'),
        indices: array(row.indices, 64, 'indices') };
    });
    check(rows.reduce((sum, row) => sum + row.indices.length, 0) <= 512, 'BUDGET', 'At most256 aggregate segments are supported');
    const nodes = new Map(source.scene.nodes.map(node => [node.id, node]));
    const preparedNodes = new Map(source.nodes.map(node => [node.id, node]));
    const geometries = new Map(source.geometries.map(geometry => [geometry.geometry.id, geometry]));
    const seen = new Set<string>();
    const owners = rows.map(row => {
      check(!seen.has(row.nodeId), 'REFERENCE', 'Each owner node must occur once'); seen.add(row.nodeId);
      const sourceNode = nodes.get(row.nodeId), node = preparedNodes.get(row.nodeId);
      check(sourceNode?.type === 'mesh' && node, 'REFERENCE', 'Every owner must name a current mesh node');
      check(sourceNode.geometryId === row.geometryId, 'REFERENCE', 'Owner geometry must match its mesh');
      const geometry = geometries.get(row.geometryId)!;
      check(row.indices.length % 2 === 0, 'GEOMETRY', 'Indices require complete endpoint pairs');
      const indices: number[] = [];
      for (const index of row.indices) {
        check(typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < geometry.vertexCount,
          'GEOMETRY', 'Every endpoint must address a current vertex');
        indices.push(index);
      }
      const pairs = new Set<string>();
      for (let i = 0; i < indices.length; i += 2) {
        const a = indices[i], b = indices[i + 1], key = Math.min(a, b) + ':' + Math.max(a, b);
        check(a !== b && !pairs.has(key), 'GEOMETRY', 'Self segments and duplicate undirected pairs are refused'); pairs.add(key);
        check([0, 1, 2].some(axis => geometry.positions[a * 3 + axis] !== geometry.positions[b * 3 + axis]),
          'REPRESENTATION', 'Endpoint positions collapse in Float32');
        const start = worldPoint(geometry.positions, a, node.worldMatrixF32), end = worldPoint(geometry.positions, b, node.worldMatrixF32);
        check(start.every(Number.isFinite) && end.every(Number.isFinite) && start.some((value, axis) => value !== end[axis]),
          'REPRESENTATION', 'Transformed endpoints collapse in Float32');
      }
      const indexType = indices.some(index => index > 65535) ? 'uint32' : 'uint16';
      return Object.freeze({ nodeId: row.nodeId, geometryId: row.geometryId, node,
        indices: indexType === 'uint16' ? Uint16Array.from(indices) : Uint32Array.from(indices), indexType });
    });
    const overlay = freezeGpuData({ format: 'barocss-gpu-engine-scene-edges' as const, version: 0 as const, sceneId,
      color: color as [number, number, number], owners: rows.map(row => ({ ...row, indices: row.indices as number[] })) });
    return Object.freeze({ overlay, owners: Object.freeze(owners) });
  } catch (cause) {
    if (cause instanceof EngineSceneError) throw cause;
    throw new EngineSceneError('INPUT', 'Edge overlay requires exact own plain data', cause);
  }
}
