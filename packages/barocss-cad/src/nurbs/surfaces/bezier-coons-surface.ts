import { validateCurve, validateSurface } from '../../core/math.js';
import { same } from '../../core/structural-equality.js';
import { copyCadData } from '../../data-copy.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal, requireCurveValue } from '../curves/curve-source.js';
import type { Curve, Model, Point, Surface } from '../../types.js';

/** Bottom/top run in increasing U; left/right run in increasing V. All coordinates are mm. */
export interface BezierCoonsBoundaries { bottom: Curve; top: Curve; left: Curve; right: Curve }
export interface BezierCoonsSurfaceOptions { surfaceId: string }
export interface BezierCoonsSurfaceReport {
  kind: 'bezier-coons-surface'; lengthUnit: 'mm'; degreeU: number; degreeV: number;
  boundaryIds: { bottom: string; top: string; left: string; right: string };
  geometricValidity: 'not-certified'; solid: false; topologyCertified: false;
}
export interface BezierCoonsSurfaceResult {
  boundaries: BezierCoonsBoundaries; surface: Surface; model: Model; source: string; report: BezierCoonsSurfaceReport;
}

const LABEL = 'Bezier Coons surface';
const BOUND = 10000;
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }

/** Read own data descriptors before values: no getters, sparse arrays or foreign prototypes. */
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'an own-data record is required');
  const prototype = Object.getPrototypeOf(input), keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  check(prototype === Object.prototype || prototype === null, 'foreign record prototype is unsupported');
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)) && fields.every(key => Object.hasOwn(descriptors, key)), 'exact fields required: ' + fields.join(','));
  check(fields.every(key => 'value' in descriptors[key] && descriptors[key].enumerable), 'getters and hidden fields are unsupported');
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
function array(input: unknown, length: number): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, 'an ordinary dense array is required');
  const keys = Reflect.ownKeys(input), descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(input);
  check(descriptors.length.value === length && keys.length === length + 1, 'array has the wrong length or extra fields');
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const field = descriptors[String(i)];
    check(field !== undefined && 'value' in field && field.enumerable === true, 'sparse arrays and getters are unsupported');
    result.push(field.value);
  }
  return result;
}
function id(input: unknown): string {
  check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), 'an ASCII identifier of at most48 characters is required');
  return input;
}
function coordinate(input: unknown): number {
  check(typeof input === 'number' && Number.isFinite(input) && Math.abs(input) <= BOUND, 'coordinates must be finite and within10000mm');
  return input;
}
function point(input: unknown): Point {
  const data = array(input, 3);
  return [coordinate(data[0]), coordinate(data[1]), coordinate(data[2])];
}
function curve(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), degree = data.degree;
  check(data.kind === 'curve', 'each boundary must be a native Curve');
  check(typeof degree === 'number' && Number.isInteger(degree) && degree >= 1 && degree <= 3, 'boundary degree must be1..3');
  const curveId = id(data.id), controlPoints = array(data.controlPoints, degree + 1).map(point);
  const knots = array(data.knots, 2 * (degree + 1)).map((value, i) => {
    check(value === (i <= degree ? 0 : 1), 'one clamped Bezier span on[0,1] is required'); return value as number;
  });
  const weights = array(data.weights, degree + 1).map(value => { check(value === 1, 'only polynomial boundaries with every weight1 are supported'); return value as number; });
  const accepted: Curve = { kind: 'curve', id: curveId, degree, knots, controlPoints, weights };
  validateCurve(accepted);
  return accepted;
}
const equalPoint = (a: Point, b: Point) => a.every((value, axis) => Object.is(value, b[axis]));

/**
 * Polynomial Coons blending of four degree1..3 Bezier boundaries with exact shared corners.
 * The first grid index is U. This returns a native surface, without sewing, regularity or solid certification.
 */
export function buildBezierCoonsSurface(boundaries: BezierCoonsBoundaries, options: BezierCoonsSurfaceOptions): BezierCoonsSurfaceResult {
  try {
    const data = record(boundaries, ['bottom', 'top', 'left', 'right']), opts = record(options, ['surfaceId']);
    const surfaceId = id(opts.surfaceId), bottom = curve(data.bottom), top = curve(data.top), left = curve(data.left), right = curve(data.right);
    check(bottom.degree === top.degree && left.degree === right.degree, 'opposite boundary degrees must match');
    const p = bottom.degree, q = left.degree, p00 = bottom.controlPoints[0], p10 = bottom.controlPoints[p], p01 = top.controlPoints[0], p11 = top.controlPoints[p];
    check(equalPoint(p00, left.controlPoints[0]) && equalPoint(p10, right.controlPoints[0]) && equalPoint(p01, left.controlPoints[q]) && equalPoint(p11, right.controlPoints[q]), 'four boundary corners must match exactly, including signed zero, in the authored directions');
    const net: Point[][] = Array.from({ length: p + 1 }, (_, i) => Array.from({ length: q + 1 }, (_, j): Point => {
      if (j === 0) return [...bottom.controlPoints[i]];
      if (j === q) return [...top.controlPoints[i]];
      if (i === 0) return [...left.controlPoints[j]];
      if (i === p) return [...right.controlPoints[j]];
      const u = i / p, v = j / q;
      const axis = (k: number) => coordinate((1 - v) * bottom.controlPoints[i][k] + v * top.controlPoints[i][k]
        + (1 - u) * left.controlPoints[j][k] + u * right.controlPoints[j][k]
        - ((1 - u) * (1 - v) * p00[k] + u * (1 - v) * p10[k] + (1 - u) * v * p01[k] + u * v * p11[k]));
      return [axis(0), axis(1), axis(2)];
    }));
    const candidate: Surface = { kind: 'surface', id: surfaceId, degreeU: p, degreeV: q, knotsU: [...bottom.knots], knotsV: [...left.knots], controlPoints: net, weights: net.map(row => row.map(() => 1)) };
    validateSurface(candidate);
    const decimal = (value: number) => curveDecimal(value, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const source = '@model ' + surfaceId + ' { version:0; length-unit:mm; @surface #' + surfaceId + ' { type:nurbs; degree-u:' + decimal(p) + '; degree-v:' + decimal(q)
      + '; knots-u:' + list(candidate.knotsU) + '; knots-v:' + list(candidate.knotsV) + '; control-points:[' + net.map(row => '[' + row.map(list).join(',') + ']').join(',')
      + ']; weights:[' + candidate.weights.map(list).join(',') + ']; } }\n';
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'generated source0 surface must compile');
    check(compiled.model.objects.length === 1 && compiled.model.objects[0].kind === 'surface' && same(compiled.model.objects[0], candidate), 'source0 must preserve the complete surface identity and coefficients');
    return copyCadData({ boundaries: { bottom, top, left, right }, surface: compiled.model.objects[0], model: compiled.model, source,
      report: { kind: 'bezier-coons-surface', lengthUnit: 'mm', degreeU: p, degreeV: q,
        boundaryIds: { bottom: bottom.id, top: top.id, left: left.id, right: right.id }, geometricValidity: 'not-certified', solid: false, topologyCertified: false } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid boundary surface input';
    throw new Error((detail.startsWith(LABEL + ':') ? detail : LABEL + ': ' + detail).slice(0, 1024), { cause: error });
  }
}
