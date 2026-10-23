import { buildCompatibleRuledSurface } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { validateCurve, validateSurface } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import type { CoplanarFaceBooleanResult } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanExtrusionOptions, CoplanarFaceBooleanExtrusionResult, CoplanarFaceBooleanExtrusionReport,
  CoplanarFaceBooleanExtrusionDiagnosticCode } from './coplanar-face-boolean-extrusion.js';

type Check = (condition: boolean, code: CoplanarFaceBooleanExtrusionDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanExtrusionDiagnosticCode) => T;
export interface NativeCoplanarExtrusionGeometry {
  bottomSupport: Surface; topSupport: Surface; bottomCurves: Curve[]; topCurves: Curve[]; verticalCurves: Curve[];
  walls: CompatibleRuledSurfaceResult[]; topVertexPoints: Point[]; sources: CoplanarFaceBooleanExtrusionResult['sources'];
  pointers: Map<string, CoplanarFaceBooleanExtrusionResult['edges'][number]['source']>;
  translationEvidence: CoplanarFaceBooleanExtrusionReport['translationEvidence'];
}
/** INTERNAL admitted geometry only. No UV sidecar is ever sent to the world-mm source writer. */
export function buildCoplanarExtrusionGeometry(region: CoplanarFaceBooleanResult, options: CoplanarFaceBooleanExtrusionOptions,
  normal: Point, translation: Point, role: (suffix: string) => string, check: Check, native: Native): NativeCoplanarExtrusionGeometry {
  const finite = (value: number): number => { check(Number.isFinite(value), 'REPRESENTABILITY', 'finite native extrusion coefficient arithmetic required'); return value; };
  const product = (a: number, b: number): number => { const value = finite(a * b);
    check(a === 0 || b === 0 || value !== 0, 'REPRESENTABILITY', 'nonzero extrusion projection product underflow'); return value; };
  const same = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
      return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); }
    return Object.is(a, b);
  };
  const bounded = (point: Point): void => check(point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000),
    'REPRESENTABILITY', 'all derived world coefficients and canonical vertices must remain within10000mm');
  const dominantAxis = normal.reduce((axis, value, index) => Math.abs(value) > Math.abs(normal[axis]) ? index : axis, 0);
  const translationEvidence: CoplanarFaceBooleanExtrusionReport['translationEvidence'] = [];
  const translated = (original: Point, origin: string): Point => {
    bounded(original);
    const point = original.map((value, axis) => finite(value + translation[axis])) as Point; bounded(point);
    const actualOffsetMM = point.map((value, axis) => finite(value - original[axis])) as Point;
    const dominantSeparationMM = Math.abs(actualOffsetMM[dominantAxis]);
    const separationThresholdMM = finite(64 * Number.EPSILON * finite(Math.abs(original[dominantAxis]) + Math.abs(point[dominantAxis]) + Math.abs(translation[dominantAxis]) + 1));
    check(dominantSeparationMM > separationThresholdMM, 'REPRESENTABILITY', 'dominant native top/bottom separation is not safely represented');
    const normalProjectionMM = actualOffsetMM.reduce((sum, value, axis) => finite(sum + product(value, normal[axis])), 0);
    const offsetDifferenceMM = finite(Math.hypot(...actualOffsetMM.map((value, axis) => finite(value - translation[axis]))));
    check(normalProjectionMM > 0 && Math.abs(finite(normalProjectionMM - options.distanceMM)) <= 1e-7 * Math.max(1, options.distanceMM)
      && offsetDifferenceMM <= 1e-7 * Math.max(1, options.distanceMM), 'BINDING', 'actual represented native coefficient offset must agree with positive normal distance');
    translationEvidence.push({ origin, originalPointMM: original, translatedPointMM: point, actualOffsetMM, dominantAxis,
      dominantSeparationMM, separationThresholdMM, normalProjectionMM, offsetDifferenceMM }); return point;
  };
  const bottomSupport: Surface = { ...copyCadData(region.support), id: role('_s_b') };
  const topSupport: Surface = { ...copyCadData(region.support), id: role('_s_t'),
    controlPoints: region.support.controlPoints.map((row, u) => row.map((point, v) => translated(point, 'support[' + u + ',' + v + ']'))) };
  native(() => validateSurface(bottomSupport), 'actual copied bottom support validation');
  native(() => validateSurface(topSupport), 'actual translated top support validation');
  const bottomCurves = region.fragments.map((fragment, i): Curve => ({ ...copyCadData(fragment.curve), id: role('_c_b_' + i) }));
  const topCurves = region.fragments.map((fragment, i): Curve => ({ ...copyCadData(fragment.curve), id: role('_c_t_' + i),
    controlPoints: fragment.curve.controlPoints.map((point, pole) => translated(point, fragment.id + ':pole[' + pole + ']')) }));
  const topVertexPoints = region.vertices.map(vertex => translated(vertex.pointMM, vertex.id + ':canonical-vertex'));
  const verticalCurves = region.vertices.map((vertex, i): Curve => ({ kind: 'curve', id: role('_c_v_' + i), degree: 1,
    knots: [0, 0, 1, 1], controlPoints: [copyCadData(vertex.pointMM), topVertexPoints[i]], weights: [1, 1] }));
  for (const curve of [...bottomCurves, ...topCurves, ...verticalCurves]) {
    curve.controlPoints.forEach(bounded); native(() => validateCurve(curve), 'actual copied/translated/vertical native Curve validation');
  }
  const walls = bottomCurves.map((bottom, i) => native(() => buildCompatibleRuledSurface(bottom, topCurves[i], { surfaceId: role('_s_w_' + i) }),
    'actual compatible native bottom/top ruled wall construction'));
  walls.forEach(wall => wall.surface.controlPoints.flat().forEach(bounded));
  const objects: (Curve | Surface)[] = [bottomSupport, topSupport, ...bottomCurves, ...topCurves, ...verticalCurves, ...walls.map(wall => wall.surface)];
  check(objects.length <= 258 && Math.ceil(objects.length / 16) <= options.maximumSourceChunks, 'BUDGET', 'complete world geometry Source0 chunk capacity exceeded');
  const sources: CoplanarFaceBooleanExtrusionResult['sources'] = [], pointers: NativeCoplanarExtrusionGeometry['pointers'] = new Map();
  for (let start = 0; start < objects.length; start += 16) {
    const chunk = objects.slice(start, start + 16), id = role('_src_' + sources.length);
    const expected: Model = { name: id, version: 0, lengthUnit: 'mm', objects: chunk };
    const file = native(() => adopt(expected), 'actual whole native extrusion world Source0 compilation and bit binding');
    check(file.source.length <= 262144, 'BUDGET', 'native extrusion source string budget exceeded');
    check(same(file.model, expected), 'BINDING', 'actual whole source geometry/order/domain/weights/IDs/sign bits required');
    sources.push({ id, ...file, sourceVersion: 0, objectIds: chunk.map(object => object.id) });
    chunk.forEach((object, objectIndex) => pointers.set(object.id, { assetId: id, objectId: object.id, objectIndex, kind: object.kind }));
  }
  return { bottomSupport, topSupport, bottomCurves, topCurves, verticalCurves, walls, topVertexPoints, sources, pointers, translationEvidence };
}
