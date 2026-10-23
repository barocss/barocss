import { validateXYPolygonRegion } from '../sketch/xy-polygon-region.js';
import type { XYPolygonRegionReport } from '../sketch/xy-polygon-region.js';
import { validatePreviewPacket } from '../core/packet.js';
import type { PreviewPacket } from '../core/packet.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Point } from '../types.js';

export interface XYPolygonPreviewOptions { meshId: string; revision: number }
export type XYPolygonPreviewVertexSource = { kind: 'curve-vertex'; index: number; parameter: number }
  | { kind: 'triangle-centroid'; indices: [0, 1, 2] };
export interface XYPolygonPreviewReport {
  kind: 'xy-polygon-region-preview'; sourceCurveId: string; meshId: string; revision: number;
  sourceVertexCount: number; vertexCount: number; triangleCount: number; addedInteriorVertex: boolean;
  parameterization: { origin: Point; uAxis: Point; vAxis: Point };
  vertexSources: XYPolygonPreviewVertexSource[]; certified: false; face: false; solid: false;
}
export interface XYPolygonPreviewResult { packet: PreviewPacket; region: XYPolygonRegionReport; report: XYPolygonPreviewReport }
function check(condition: boolean, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(('XY polygon preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
function snapshot(input: unknown, rootPath: string): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 4, path, 'input exceeds 4096 own values/depth4');
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 71 : 8) && keys.every(key => typeof key === 'string' && key.length <= 128), path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), path, 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 70 && keys.length === length + 1, path, 'dense bounded array required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array fields unsupported'); result.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, rootPath);
}
/** Original region boundary -> display triangles; no trimmed Surface/Face creation. */
export function tessellateXYPolygonRegion(curve: Curve, options: XYPolygonPreviewOptions): XYPolygonPreviewResult {
  const owned = snapshot(curve, '$curve') as Curve, data = snapshot(options, '$options');
  check(data !== null && typeof data === 'object' && !Array.isArray(data), '$options', 'options record required');
  const o = data as Record<string, unknown>;
  check(Object.keys(o).length === 2 && Object.hasOwn(o, 'meshId') && Object.hasOwn(o, 'revision'), '$options', 'exact meshId/revision fields required');
  check(typeof o.meshId === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.meshId) && o.meshId.length <= 128, '$options.meshId', 'bounded ASCII mesh ID required');
  check(typeof o.revision === 'number' && Number.isInteger(o.revision) && o.revision >= 0 && o.revision <= 2147483647, '$options.revision', 'integer revision0..2147483647 required');
  const region = validateXYPolygonRegion(owned), n = region.vertexCount;
  check(o.meshId !== owned.id, '$options.meshId', 'derived mesh ID must differ from source Curve ID');
  const points = owned.controlPoints.slice(0, n).map(p => [...p] as Point), work = Array.from({ length: n }, (_, i) => i);
  if (region.orientation === 'cw') work.reverse();
  const indices: number[] = [], vertexSources: XYPolygonPreviewVertexSource[] = points.map((_, i) => ({ kind: 'curve-vertex', index: i, parameter: i }));
  const determinant = (a: number, b: number, c: number): number => {
    const p = points[a], q = points[b], r = points[c], value = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    check(Number.isSafeInteger(value) && Math.abs(value) <= 8e8, '$triangles', 'unsafe exact boundary orientation'); return value;
  };
  if (n === 3) {
    const centroid = [0, 1, 2].map(axis => (points[0][axis] + points[1][axis] + points[2][axis]) / 3) as Point;
    check(centroid.every(Number.isFinite), '$centroid', 'finite centroid required'); points.push(centroid);
    vertexSources.push({ kind: 'triangle-centroid', indices: [0, 1, 2] });
    for (let i = 0; i < 3; i++) indices.push(work[i], work[(i + 1) % 3], 3);
  } else {
    let attempts = 0;
    while (work.length > 3) {
      let clipped = false;
      for (let i = 0; i < work.length; i++) {
        check(++attempts <= 4096, '$triangles', 'bounded ear-clipping attempts exceeded');
        const a = work[(i + work.length - 1) % work.length], b = work[i], c = work[(i + 1) % work.length];
        if (determinant(a, b, c) <= 0) continue;
        const contains = work.some(p => p !== a && p !== b && p !== c && determinant(a, b, p) >= 0 && determinant(b, c, p) >= 0 && determinant(c, a, p) >= 0);
        if (contains) continue;
        indices.push(a, b, c); work.splice(i, 1); clipped = true; break;
      }
      check(clipped, '$triangles', 'no nondegenerate ear found without dropping boundary vertices');
    }
    check(determinant(work[0], work[1], work[2]) > 0, '$triangles', 'final ear is collapsed'); indices.push(...work);
  }
  const origin: Point = [...region.boundsMM.min], width = region.boundsMM.max[0] - origin[0], height = region.boundsMM.max[1] - origin[1];
  check(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height), '$parameterization', 'nonzero bounded XY extents required');
  const positions = points.flat(), normals = points.flatMap(() => [0, 0, 1]), parameters = points.flatMap(p => [(p[0] - origin[0]) / width, (p[1] - origin[1]) / height]);
  const packet: PreviewPacket = { version: 0, surfaceId: o.meshId, revision: o.revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters,
    bounds: { min: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.min(...points.map(p => p[2]))], max: [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1])), Math.max(...points.map(p => p[2]))] } };
  check(points.length <= 64 && indices.length / 3 <= 61 && indices.length / 3 === (n === 3 ? 3 : n - 2), '$packet', 'fixed vertex/triangle bounds violated');
  validatePreviewPacket(packet);
  const report: XYPolygonPreviewReport = { kind: 'xy-polygon-region-preview', sourceCurveId: owned.id, meshId: o.meshId, revision: o.revision, sourceVertexCount: n, vertexCount: points.length, triangleCount: indices.length / 3, addedInteriorVertex: n === 3,
    parameterization: { origin, uAxis: [width, 0, 0], vAxis: [0, height, 0] }, vertexSources, certified: false, face: false, solid: false };
  return { packet: copyCadData(packet), region: copyCadData(region), report: copyCadData(report) };
}
