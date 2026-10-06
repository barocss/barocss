import { validateXYPolygonRegion } from './xy-polygon-region.js';
import type { XYPolygonRegionReport } from './xy-polygon-region.js';
import { tessellateXYPolygonRegion } from './xy-polygon-preview.js';
import type { XYPolygonPreviewVertexSource } from './xy-polygon-preview.js';
import { validatePreviewPacket } from './packet.js';
import type { PreviewPacket } from './packet.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Point } from './types.js';

export interface XYPolygonPrismPreviewRequest { bodyId: string; profile: Curve; distanceMM: number; revision: number }
export interface XYPolygonPrismPreviewConstruction { operation: 'xy-polygon-prism-preview'; inputCurveId: string; outputBodyId: string; direction: Point; distanceMM: number }
export interface XYPolygonPrismPreviewRole {
  id: string; role: 'bottom-cap' | 'top-cap' | 'side'; vertexRange: [number, number]; indexRange: [number, number]; normal: Point;
  parameterization: { kind: 'cap-plane' | 'side-segment'; origin: Point; uAxis: Point; vAxis: Point };
  vertexSources?: XYPolygonPreviewVertexSource[]; sourceSegmentIndex?: number; sourceParameterRange?: [number, number];
}
export interface XYPolygonPrismPreviewReport {
  prototypeFamily: 'xy-polygon-prism-preview-v0'; sourceCurveId: string; bodyId: string; meshId: string; revision: number;
  sourceVertexCount: number; vertexCount: number; triangleCount: number; boundaryPerimeterMM: number; volumeMM3: number; areaMM2: number;
  capRanges: [XYPolygonPrismPreviewRole, XYPolygonPrismPreviewRole]; sideRanges: XYPolygonPrismPreviewRole[];
  boundsMM: { min: Point; max: Point }; closedMesh: true; topologyCertified: false; solid: false;
}
export interface XYPolygonPrismPreviewResult { profile: Curve; region: XYPolygonRegionReport; packet: PreviewPacket; construction: XYPolygonPrismPreviewConstruction; report: XYPolygonPrismPreviewReport }
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('XY polygon prism preview: ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function snapshot(input: unknown): unknown {
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
      check(Number.isInteger(length) && length >= 0 && length <= 70 && keys.length === length + 1, path, 'dense bounded arrays required');
      const output: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), path, 'sparse/extra array field'); output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return output;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, '$');
}
/** Actual simple region x[0,distance] display mesh; no generic B-Rep/solid proof. */
export function buildXYPolygonPrismPreview(request: XYPolygonPrismPreviewRequest): XYPolygonPrismPreviewResult {
  const value = snapshot(request);
  check(value !== null && typeof value === 'object' && !Array.isArray(value), '$', 'request record required');
  const data = value as Record<string, unknown>, fields = ['bodyId', 'profile', 'distanceMM', 'revision'];
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), '$', 'exact bodyId/profile/distanceMM/revision fields required');
  check(typeof data.bodyId === 'string' && data.bodyId.length <= 80 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.bodyId), '$.bodyId', 'ASCII body ID1..80 required');
  check(typeof data.distanceMM === 'number' && Number.isInteger(data.distanceMM) && data.distanceMM >= 1 && data.distanceMM <= 10000, '$.distanceMM', 'positive integer distance1..10000mm required');
  check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, '$.revision', 'integer revision0..2147483647 required');
  const profile = data.profile as Curve, region = validateXYPolygonRegion(profile), n = region.vertexCount, bodyId = data.bodyId, distance = data.distanceMM;
  const meshId = bodyId + '_preview', capMeshId = bodyId + '_cap_preview', bottomId = bodyId + '_bottom_cap', topId = bodyId + '_top_cap', sideIds = Array.from({ length: n }, (_, i) => bodyId + '_side_' + i);
  const ids = [bodyId, profile.id, meshId, capMeshId, bottomId, topId, ...sideIds];
  check(ids.every(id => id.length <= 128) && new Set(ids).size === ids.length, '$.bodyId/profile.id', 'source/body/derived role IDs must be distinct and bounded');
  const cap = tessellateXYPolygonRegion(profile, { meshId: capMeshId, revision: data.revision }), m = cap.report.vertexCount;
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [];
  const capRoles: XYPolygonPrismPreviewRole[] = [];
  for (const top of [false, true]) {
    const start = positions.length / 3, indexStart = indices.length, z = top ? distance : 0, normal: Point = [0, 0, top ? 1 : -1];
    for (let i = 0; i < m; i++) { positions.push(cap.packet.positions[i * 3], cap.packet.positions[i * 3 + 1], z); normals.push(...normal); parameters.push(cap.packet.parameters[i * 2], cap.packet.parameters[i * 2 + 1]); }
    for (let i = 0; i < cap.packet.indices.length; i += 3) { const [a, b, c] = cap.packet.indices.slice(i, i + 3); indices.push(start + a, start + (top ? b : c), start + (top ? c : b)); }
    capRoles.push({ id: top ? topId : bottomId, role: top ? 'top-cap' : 'bottom-cap', vertexRange: [start, start + m], indexRange: [indexStart, indices.length], normal,
      parameterization: { kind: 'cap-plane', origin: [cap.report.parameterization.origin[0], cap.report.parameterization.origin[1], z], uAxis: [...cap.report.parameterization.uAxis], vAxis: [...cap.report.parameterization.vAxis] }, vertexSources: copyCadData(cap.report.vertexSources) });
  }
  const sideRanges: XYPolygonPrismPreviewRole[] = []; let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = profile.controlPoints[i], b = profile.controlPoints[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), sign = region.orientation === 'ccw' ? 1 : -1;
    check(Number.isFinite(length) && length > 0, '$.profile.controlPoints[' + i + ']', 'nonzero finite source edge required'); perimeter += length;
    const normal: Point = [sign * dy / length, -sign * dx / length, 0], start = positions.length / 3, indexStart = indices.length;
    positions.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], distance, a[0], a[1], distance);
    for (let j = 0; j < 4; j++) normals.push(...normal); parameters.push(0, 0, 1, 0, 1, 1, 0, 1);
    if (sign === 1) indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    else indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    sideRanges.push({ id: sideIds[i], role: 'side', vertexRange: [start, start + 4], indexRange: [indexStart, indices.length], normal, sourceSegmentIndex: i, sourceParameterRange: [i, i + 1],
      parameterization: { kind: 'side-segment', origin: [a[0], a[1], 0], uAxis: [dx, dy, 0], vAxis: [0, 0, distance] } });
  }
  const bounds: { min: Point; max: Point } = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) { bounds.min[axis] = Math.min(bounds.min[axis], positions[i + axis]); bounds.max[axis] = Math.max(bounds.max[axis], positions[i + axis]); }
  check(positions.length / 3 <= 378 && indices.length / 3 <= 248 && positions.every(p => Number.isFinite(p) && Math.abs(p) <= 10000), '$packet', 'generated prism exceeds bounded coordinates/counts');
  const packet: PreviewPacket = { version: 0, surfaceId: meshId, revision: data.revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw', positions, normals, indices, parameters, bounds };
  validatePreviewPacket(packet);
  const volume = region.areaMM2 * distance, area = 2 * region.areaMM2 + perimeter * distance;
  check([perimeter, volume, area].every(Number.isFinite), '$report', 'nonfinite floating construction metrics');
  const construction: XYPolygonPrismPreviewConstruction = { operation: 'xy-polygon-prism-preview', inputCurveId: profile.id, outputBodyId: bodyId, direction: [0, 0, 1], distanceMM: distance };
  const report: XYPolygonPrismPreviewReport = { prototypeFamily: 'xy-polygon-prism-preview-v0', sourceCurveId: profile.id, bodyId, meshId, revision: data.revision, sourceVertexCount: n, vertexCount: positions.length / 3, triangleCount: indices.length / 3,
    boundaryPerimeterMM: perimeter, volumeMM3: volume, areaMM2: area, capRanges: capRoles as [XYPolygonPrismPreviewRole, XYPolygonPrismPreviewRole], sideRanges, boundsMM: bounds, closedMesh: true, topologyCertified: false, solid: false };
  return { profile: copyCadData(profile), region: copyCadData(region), packet: copyCadData(packet), construction: copyCadData(construction), report: copyCadData(report) };
}
