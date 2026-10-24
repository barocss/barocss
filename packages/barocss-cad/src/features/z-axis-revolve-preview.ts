import { buildZAxisRevolvedSurface } from '../nurbs/surfaces/z-axis-revolved-surface.js';
import type { ZAxisRevolvedSurfaceResult, ZAxisRevolvedSurfaceReport } from '../nurbs/surfaces/z-axis-revolved-surface.js';
import { evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { validatePreviewPacket } from '../core/packet.js';
import type { PreviewPacket } from '../core/packet.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Point } from '../types.js';
import { cross } from '../core/vec3.js';

export interface ZAxisRevolvePreviewOptions {
  surfaceId: string; meshId: string; revision: number; segmentsPerMeridianSpan: number; segmentsPerQuarter: number; orientation: 'forward' | 'reverse';
}
export interface ZAxisRevolvePreviewPanel {
  uRange: [number, number]; vRange: [number, number]; meridianSpan: [number, number]; angularSpan: [number, number];
  normalSampleUV: [number, number]; normal: Point; vertexRange: [number, number]; indexRange: [number, number];
}
export type ZAxisRevolveBoundaryRole = 'meridian-start' | 'meridian-end' | 'angle-seam';
export interface ZAxisRevolveBoundaryPath { id: string; points: Point[] }
export interface ZAxisRevolveBoundaryProvenance {
  kind: 'surface-parameter-boundary'; pathId: string; surfaceId: string; meridianId: string; boundary: ZAxisRevolveBoundaryRole;
  parameterAxis: 'u' | 'v'; sampledParameters: number[]; sourceParameterRange: [number, number];
  locations: { constantAxis: 'u' | 'v'; constantParameter: number; sampledUVs: [number, number][] }[];
  observedBindingDifferenceMM: number;
}
export interface ZAxisRevolvePreviewReport {
  kind: 'z-axis-revolve-surface-preview'; native: ZAxisRevolvedSurfaceReport; surfaceId: string; meridianId: string; meshId: string; revision: number; orientation: 'forward' | 'reverse';
  domains: ZAxisRevolvedSurfaceReport['domains']['surface']; panelCount: number; vertexCount: number; triangleCount: number;
  boundaryPathCount: 3; boundaryPathPointCounts: number[]; boundsMM: { min: Point; max: Point }; maximumBoundaryDifferenceMM: number;
  sampling: { segmentsPerMeridianSpan: number; segmentsPerQuarter: number; meridianParameters: number[]; angularParameters: number[]; normalMethod: 'native-midpoint-faceted' };
  limits: { maximumPanels: 960; maximumVertices: 3840; maximumTriangles: 1920; maximumBoundaryPaths: 3; maximumRingPoints: 33; maximumSeamPoints: 31; gpuMaximumPathPoints: 64; bindingComparisonMM: 1e-7; float32Policy: 'positive-parametric-world-coordinate-triangles' };
  periodic: false; certified: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface ZAxisRevolvePreviewResult {
  native: ZAxisRevolvedSurfaceResult; packet: PreviewPacket; panels: ZAxisRevolvePreviewPanel[];
  boundaryPaths: ZAxisRevolveBoundaryPath[]; boundaryProvenance: ZAxisRevolveBoundaryProvenance[]; report: ZAxisRevolvePreviewReport;
}
function check(condition: boolean, path: string, detail: string): asserts condition { if (!condition) throw new Error(('Z-axis revolve preview: ' + path + ': ' + detail).slice(0, 1024)); }
function options(input: unknown): ZAxisRevolvePreviewOptions {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), '$options', 'plain option record required');
  const prototype = Object.getPrototypeOf(input), keys = Reflect.ownKeys(input), fields = ['surfaceId', 'meshId', 'revision', 'segmentsPerMeridianSpan', 'segmentsPerQuarter', 'orientation'];
  check((prototype === Object.prototype || prototype === null) && keys.length === fields.length && keys.every(k => typeof k === 'string' && fields.includes(k)), '$options', 'exact original options required');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  check(keys.every(k => typeof k === 'string' && 'value' in descriptors[k] && descriptors[k].enumerable), '$options', 'getters, symbols or hidden options unsupported');
  const data = Object.fromEntries(fields.map(k => [k, descriptors[k].value]));
  for (const [key, bound] of [['surfaceId', 48], ['meshId', 64]] as const) check(typeof data[key] === 'string' && data[key].length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data[key]), '$options.' + key, 'bounded ASCII ID required');
  check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, '$options.revision', 'integer revision0..2147483647 required');
  check(typeof data.segmentsPerMeridianSpan === 'number' && Number.isInteger(data.segmentsPerMeridianSpan) && data.segmentsPerMeridianSpan >= 1 && data.segmentsPerMeridianSpan <= 2, '$options.segmentsPerMeridianSpan', 'integer subdivision1..2 required');
  check(typeof data.segmentsPerQuarter === 'number' && Number.isInteger(data.segmentsPerQuarter) && data.segmentsPerQuarter >= 2 && data.segmentsPerQuarter <= 8, '$options.segmentsPerQuarter', 'integer subdivision2..8 required');
  check(data.orientation === 'forward' || data.orientation === 'reverse', '$options.orientation', 'explicit forward/reverse orientation required');
  return data as unknown as ZAxisRevolvePreviewOptions;
}
function interpolate(a: number, b: number, t: number): number {
  if (t === 0) return a; if (t === 1) return b;
  const delta = b - a; return Number.isFinite(delta) ? a + delta * t : a * (1 - t) + b * t;
}
function triangleCross(a: Point, b: Point, c: Point): Point { return cross(b.map((n, i) => n - a[i]) as Point, c.map((n, i) => n - a[i]) as Point); }
/** Native knot-span panel bridge; boundaries are parameter paths, not topology. */
export function tessellateZAxisRevolvedSurface(meridian: Curve, inputOptions: ZAxisRevolvePreviewOptions): ZAxisRevolvePreviewResult {
  const settings = options(inputOptions), native = buildZAxisRevolvedSurface(meridian, { surfaceId: settings.surfaceId }), surface = native.surface;
  check(settings.meshId !== native.meridian.id && settings.meshId !== surface.id, '$options.meshId', 'display mesh ID must differ from native IDs');
  const domain = native.report.domains.surface, breaks = [domain.u[0]];
  for (const knot of native.meridian.knots) if (knot > domain.u[0] && knot < domain.u[1] && knot !== breaks.at(-1)) breaks.push(knot);
  breaks.push(domain.u[1]);
  const uCells: { range: [number, number]; span: [number, number] }[] = [], us = [domain.u[0]];
  for (let span = 0; span + 1 < breaks.length; span++) {
    const a = breaks[span], b = breaks[span + 1]; check(a < b, '$sampling.u', 'strict positive original span required');
    for (let j = 0; j < settings.segmentsPerMeridianSpan; j++) {
      const low = interpolate(a, b, j / settings.segmentsPerMeridianSpan), high = interpolate(a, b, (j + 1) / settings.segmentsPerMeridianSpan);
      check(Number.isFinite(low) && Number.isFinite(high) && low < high, '$sampling.u', 'subdivision is not representable; native geometry remains separate');
      uCells.push({ range: [low, high], span: [a, b] }); us.push(high);
    }
  }
  const k = settings.segmentsPerQuarter, vs = Array.from({ length: 4 * k + 1 }, (_, j) => j === 4 * k ? domain.v[1] : Math.floor(j / k) + (j % k) / k);
  const sign = settings.orientation === 'forward' ? 1 : -1;
  const positions: number[] = [], normals: number[] = [], parameters: number[] = [], indices: number[] = [], panels: ZAxisRevolvePreviewPanel[] = [];
  const pointAt = (index: number, float32: boolean): Point => positions.slice(index * 3, index * 3 + 3).map(n => float32 ? Math.fround(n) : n) as Point;
  const emitTriangle = (a: number, b: number, c: number): void => {
    for (const float32 of [false, true]) {
      const vector = triangleCross(pointAt(a, float32), pointAt(b, float32), pointAt(c, float32)), magnitude = Math.hypot(...vector);
      check(vector.every(Number.isFinite) && magnitude > 0 && Number.isFinite(magnitude), '$triangles', float32 ? 'Float32 world triangle collapsed; native geometry remains valid separately' : 'finite nonzero native triangle required');
      for (const vertex of [a, b, c]) {
        const nrm = normals.slice(vertex * 3, vertex * 3 + 3).map(n => float32 ? Math.fround(n) : n);
        check(vector.reduce((sum, n, i) => sum + n * nrm[i], 0) > 0, '$triangles', float32 ? 'Float32 winding disagrees with actual midpoint normal' : 'native winding disagrees with actual midpoint normal');
      }
    }
    indices.push(a, b, c);
  };
  for (const cell of uCells) for (let j = 0; j + 1 < vs.length; j++) {
    const [u0, u1] = cell.range, v0 = vs[j], v1 = vs[j + 1], u = interpolate(u0, u1, 0.5), v = interpolate(v0, v1, 0.5);
    check(u > u0 && u < u1 && v > v0 && v < v1, '$normals', 'strictly interior representable midpoint required');
    const d1 = evaluateSurfaceD1(surface, u, v), vector = cross(d1.du, d1.dv), magnitude = Math.hypot(...vector);
    check(vector.every(Number.isFinite) && Number.isFinite(magnitude) && magnitude > 0, '$normals', 'finite nonzero actual midpoint-D1 normal required');
    const nrm = vector.map(n => sign * n / magnitude) as Point, first = positions.length / 3, start = indices.length;
    for (const uv of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]] as [number, number][]) {
      positions.push(...evaluateSurface(surface, ...uv)); normals.push(...nrm); parameters.push(...uv);
    }
    if (sign === 1) { emitTriangle(first, first + 1, first + 2); emitTriangle(first + 1, first + 3, first + 2); }
    else { emitTriangle(first, first + 2, first + 1); emitTriangle(first + 1, first + 2, first + 3); }
    panels.push({ uRange: cell.range, vRange: [v0, v1], meridianSpan: cell.span, angularSpan: [Math.floor(j / k), Math.floor(j / k) + 1], normalSampleUV: [u, v], normal: nrm, vertexRange: [first, first + 4], indexRange: [start, indices.length] });
  }
  check(panels.length <= 960 && positions.length / 3 <= 3840 && indices.length / 3 <= 1920, '$packet', 'bounded panel budget exceeded');
  const min: Point = [Infinity, Infinity, Infinity], max: Point = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], positions[i]); max[axis] = Math.max(max[axis], positions[i]); }
  const packet: PreviewPacket = { version: 0, surfaceId: settings.meshId, revision: settings.revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, indices, parameters, bounds: { min, max } };
  validatePreviewPacket(packet);
  const pathIds = ['_u_min', '_u_max', '_seam'].map(suffix => settings.meshId + suffix);
  check(new Set(pathIds).size === 3 && pathIds.every(id => id.length <= 128 && id !== native.meridian.id && id !== surface.id && id !== settings.meshId), '$boundaries.ids', 'distinct bounded display boundary IDs required');
  const boundaryPaths: ZAxisRevolveBoundaryPath[] = [], boundaryProvenance: ZAxisRevolveBoundaryProvenance[] = [];
  for (const [i, fixed] of [domain.u[0], domain.u[1]].entries()) {
    const uvs = vs.map(v => [fixed, v] as [number, number]); boundaryPaths.push({ id: pathIds[i], points: uvs.map(uv => evaluateSurface(surface, ...uv)) });
    boundaryProvenance.push({ kind: 'surface-parameter-boundary', pathId: pathIds[i], surfaceId: surface.id, meridianId: native.meridian.id, boundary: i === 0 ? 'meridian-start' : 'meridian-end', parameterAxis: 'v', sampledParameters: vs, sourceParameterRange: domain.v, locations: [{ constantAxis: 'u', constantParameter: fixed, sampledUVs: uvs }], observedBindingDifferenceMM: 0 });
  }
  const seamPoints = us.map(u => evaluateCurve(native.meridian, u)); let observedBindingDifferenceMM = 0;
  const locations = domain.v.map(fixed => ({ constantAxis: 'v' as const, constantParameter: fixed, sampledUVs: us.map(u => [u, fixed] as [number, number]) }));
  for (const location of locations) for (const [i, uv] of location.sampledUVs.entries()) {
    const point = evaluateSurface(surface, ...uv); observedBindingDifferenceMM = Math.max(observedBindingDifferenceMM, Math.hypot(...point.map((n, axis) => n - seamPoints[i][axis])));
  }
  check(observedBindingDifferenceMM <= 1e-7, '$boundaries.seam', 'original meridian/seam correspondence exceeds1e-7mm');
  boundaryPaths.push({ id: pathIds[2], points: seamPoints });
  boundaryProvenance.push({ kind: 'surface-parameter-boundary', pathId: pathIds[2], surfaceId: surface.id, meridianId: native.meridian.id, boundary: 'angle-seam', parameterAxis: 'u', sampledParameters: us, sourceParameterRange: domain.u, locations, observedBindingDifferenceMM });
  check(boundaryPaths[0].points.length <= 33 && boundaryPaths[1].points.length <= 33 && boundaryPaths[2].points.length <= 31, '$boundaries', 'complete path sampling exceeds bound');
  return copyCadData({ native, packet, panels, boundaryPaths, boundaryProvenance, report: {
    kind: 'z-axis-revolve-surface-preview', native: native.report, surfaceId: surface.id, meridianId: native.meridian.id, meshId: settings.meshId, revision: settings.revision, orientation: settings.orientation,
    domains: domain, panelCount: panels.length, vertexCount: positions.length / 3, triangleCount: indices.length / 3, boundaryPathCount: 3, boundaryPathPointCounts: boundaryPaths.map(p => p.points.length), boundsMM: packet.bounds, maximumBoundaryDifferenceMM: observedBindingDifferenceMM,
    sampling: { segmentsPerMeridianSpan: settings.segmentsPerMeridianSpan, segmentsPerQuarter: k, meridianParameters: us, angularParameters: vs, normalMethod: 'native-midpoint-faceted' },
    limits: { maximumPanels: 960, maximumVertices: 3840, maximumTriangles: 1920, maximumBoundaryPaths: 3, maximumRingPoints: 33, maximumSeamPoints: 31, gpuMaximumPathPoints: 64, bindingComparisonMM: 1e-7, float32Policy: 'positive-parametric-world-coordinate-triangles' },
    periodic: false, certified: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
  } });
}
