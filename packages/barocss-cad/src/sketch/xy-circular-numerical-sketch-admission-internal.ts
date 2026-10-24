import type { XYPoint } from './xy-profile.js';
import type { XYCircularNumericalSketchDocumentV0, XYCircularNumericalSketchConstraint, XYCircularNumericalSketchBranchGuard } from './xy-circular-numerical-sketch.js';
import { KernelError } from '../core/barocss-error.js';
export const XYCircularNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: 'INVALID_DOCUMENT', UNSUPPORTED: 'UNSUPPORTED', LIMIT: 'LIMIT', REFERENCE: 'REFERENCE', NONCONVERGENCE: 'NONCONVERGENCE', NUMERICAL: 'NUMERICAL', BUDGET: 'BUDGET', BRANCH: 'BRANCH', DEGENERATE_GEOMETRY: 'DEGENERATE_GEOMETRY', COMPILATION: 'COMPILATION', OWNED: 'OWNED' } as const);
export type XYCircularNumericalSketchDiagnosticCode = typeof XYCircularNumericalSketchDiagnosticCode[keyof typeof XYCircularNumericalSketchDiagnosticCode];
export class XYCircularNumericalSketchError extends KernelError {
  constructor(readonly code: XYCircularNumericalSketchDiagnosticCode, detail: string, readonly path = '$', cause?: unknown) {
    super(('XY circular numerical sketch: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYCircularNumericalSketchError';
  }
}
export function isNumericalError(value: unknown): value is XYCircularNumericalSketchError { try { return value instanceof XYCircularNumericalSketchError; } catch { return false; } }
export function check(condition: boolean, code: XYCircularNumericalSketchDiagnosticCode, detail: string, path = '$'): asserts condition {
  if (!condition) throw new XYCircularNumericalSketchError(code, detail, path);
}
export function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? 'OWNED' : 'INVALID_DOCUMENT', ancestors = new Set<object>(); let remaining = owned ? 131072 : 4096;
  // Reflection can execute Proxy traps: never inspect a value they throw.
  const reflect = <T>(read: () => T, path: string): T => {
    try { return read(); } catch (cause) { throw new XYCircularNumericalSketchError(code, 'Own-data reflection refused', path, cause); }
  };
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), owned ? 'OWNED' : 'LIMIT', 'Own-value/depth budget exceeded', path);
    if (owned && (value === null || typeof value === 'boolean')) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers required', path); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), owned ? 'OWNED' : 'LIMIT', 'Own string budget exceeded', path); return value; }
    check(value !== null && typeof value === 'object', code, 'Plain own data required', path);
    check(!ancestors.has(value), code, 'Cycles refused', path);
    const array = reflect(() => Array.isArray(value), path), prototype = reflect(() => Object.getPrototypeOf(value), path), keys = reflect(() => Reflect.ownKeys(value), path);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Foreign prototype refused', path);
    check(keys.length <= (array ? (owned ? 257 : 65) : (owned ? 64 : 16)), owned ? 'OWNED' : 'LIMIT', 'Own field capacity exceeded', path);
    const descriptors = reflect(() => Object.getOwnPropertyDescriptors(value), path);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Accessors, symbols and hidden fields refused', path);
    ancestors.add(value);
    try {
      if (array) {
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= (owned ? 256 : 64) && keys.length === n + 1, code, 'Dense bounded array required', path);
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'Sparse or extra array fields refused', path); return copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']'); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0, '$');
}
export function exact(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => exact(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && exact(x[k], y[k]));
  } return Object.is(a, b);
}
function record(value: unknown, fields: string[], path: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DOCUMENT', 'Own record required', path);
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), 'INVALID_DOCUMENT', 'Exact fields required: ' + fields.join(','), path); return data;
}
function identifier(value: unknown, path: string): string {
  check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'INVALID_DOCUMENT', 'Nonempty ASCII identifier required', path);
  check(value.length <= 48, 'LIMIT', 'Identifier exceeds 48 characters', path); return value;
}
function xy(value: unknown, path: string): XYPoint {
  check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number'), 'INVALID_DOCUMENT', 'Two numeric coordinates required', path);
  check(value.every(n => Math.abs(n) <= 10000), 'UNSUPPORTED', 'Coordinate or dimensionless direction exceeds +/-10000', path); return [value[0], value[1]];
}
function list(value: unknown, min: number, max: number, path: string): unknown[] {
  check(Array.isArray(value), 'INVALID_DOCUMENT', 'Array required', path);
  check(value.length >= min, 'INVALID_DOCUMENT', 'At least ' + min + ' items required', path);
  check(value.length <= max, 'LIMIT', 'At most ' + max + ' items supported', path); return value;
}
export function admit(input: unknown): XYCircularNumericalSketchDocumentV0 {
  const d = record(snapshot(input), ['format', 'version', 'profile', 'id', 'lengthUnit', 'angleUnit', 'points', 'segments', 'circles', 'constraints', 'branchGuards'], '$');
  check(d.format === 'barocss-xy-circular-numerical-sketch' && d.version === 0 && d.profile === 'bounded-radius-interior-tangent-v0' && d.lengthUnit === 'mm' && d.angleUnit === 'rad', 'UNSUPPORTED', 'Circular numerical sketch v0 bounded-radius-interior-tangent-v0/mm/rad required');
  const id = identifier(d.id, '$.id'), ids = new Set([id]);
  const unique = (v: unknown, p: string) => { const s = identifier(v, p); check(!ids.has(s), 'INVALID_DOCUMENT', 'Duplicate global ID #' + s, p); ids.add(s); return s; };
  const ref = (v: unknown, set: Set<string>, p: string) => { const s = identifier(v, p); check(set.has(s), 'REFERENCE', 'Unresolved reference #' + s, p); return s; };
  const points = list(d.points, 1, 16, '$.points').map((v, i) => { const p = '$.points[' + i + ']', a = record(v, ['id', 'position'], p); return { id: unique(a.id, p), position: xy(a.position, p) }; });
  const pointIds = new Set(points.map(p => p.id));
  const segments = list(d.segments, 0, 8, '$.segments').map((v, i) => {
    const p = '$.segments[' + i + ']', a = record(v, ['id', 'startPointId', 'endPointId'], p);
    const startPointId = ref(a.startPointId, pointIds, p), endPointId = ref(a.endPointId, pointIds, p);
    check(startPointId !== endPointId, 'REFERENCE', 'Distinct endpoint IDs required', p);
    return { id: unique(a.id, p), startPointId, endPointId };
  });
  const circles = list(d.circles, 1, 4, '$.circles').map((v, i) => {
    const path = '$.circles[' + i + ']', c = record(v, ['id', 'centerPointId', 'radius', 'seamId'], path), r = record(c.radius, ['id', 'valueMM'], path + '.radius');
    check(typeof r.valueMM === 'number' && r.valueMM >= .001 && r.valueMM <= 10000, 'UNSUPPORTED', 'Radius must be [0.001,10000] mm', path);
    return { id: unique(c.id, path), centerPointId: ref(c.centerPointId, pointIds, path), radius: { id: unique(r.id, path), valueMM: r.valueMM }, seamId: unique(c.seamId, path) };
  });
  check(2 * points.length + circles.length <= 32, 'LIMIT', 'At most 32 scalar unknowns');
  const circleIds = new Set(circles.map(c => c.id));
  const segmentIds = new Set(segments.map(s => s.id)); let rows = 0;
  const constraints = list(d.constraints, 0, 32, '$.constraints').map((v, i): XYCircularNumericalSketchConstraint => {
    const p = '$.constraints[' + i + ']'; check(v !== null && typeof v === 'object' && !Array.isArray(v), 'INVALID_DOCUMENT', 'Constraint record required', p);
    const k = (v as Record<string, unknown>).kind;
    const fields = k === 'fixed' ? ['pointId', 'target'] : k === 'coincident' ? ['pointA', 'pointB'] : k === 'horizontal' || k === 'vertical' ? ['segmentId'] : k === 'length' ? ['segmentId', 'lengthMM'] : k === 'signed-angle' ? ['segmentA', 'segmentB', 'angleRad'] : k === 'radius' ? ['circleId', 'radiusMM'] : k === 'line-circle-tangent' ? ['segmentId', 'circleId', 'side'] : null;
    check(fields !== null, 'UNSUPPORTED', 'Unsupported constraint kind', p);
    const a = record(v, ['id', 'kind', ...fields], p), name = unique(a.id, p);
    rows += k === 'fixed' || k === 'coincident' ? 2 : 1; check(rows <= 64, 'LIMIT', 'At most 64 scalar residuals', p);
    if (k === 'radius') { check(typeof a.radiusMM === 'number' && a.radiusMM >= .001 && a.radiusMM <= 10000, 'UNSUPPORTED', 'Radius target must be [0.001,10000] mm', p); return { id: name, kind: k, circleId: ref(a.circleId, circleIds, p), radiusMM: a.radiusMM }; }
    if (k === 'line-circle-tangent') { check(a.side === 'left' || a.side === 'right', 'UNSUPPORTED', 'Explicit left or right side required', p); return { id: name, kind: k, segmentId: ref(a.segmentId, segmentIds, p), circleId: ref(a.circleId, circleIds, p), side: a.side }; }
    if (k === 'fixed') return { id: name, kind: k, pointId: ref(a.pointId, pointIds, p), target: xy(a.target, p) };
    if (k === 'coincident') return { id: name, kind: k, pointA: ref(a.pointA, pointIds, p), pointB: ref(a.pointB, pointIds, p) };
    if (k === 'horizontal' || k === 'vertical') return { id: name, kind: k, segmentId: ref(a.segmentId, segmentIds, p) };
    if (k === 'length') { check(typeof a.lengthMM === 'number' && a.lengthMM >= .001 && a.lengthMM <= 20000 * Math.SQRT2, 'UNSUPPORTED', 'Length must be [0.001,20000sqrt(2)] mm', p); return { id: name, kind: k, segmentId: ref(a.segmentId, segmentIds, p), length: a.lengthMM }; }
    check(typeof a.angleRad === 'number' && a.angleRad > -Math.PI && a.angleRad <= Math.PI, 'UNSUPPORTED', 'Signed angle must be (-pi,pi] radians', p);
    return { id: name, kind: 'signed-angle', segmentA: ref(a.segmentA, segmentIds, p), segmentB: ref(a.segmentB, segmentIds, p), angle: a.angleRad };
  });
  const branchGuards = list(d.branchGuards, 0, 16, '$.branchGuards').map((v, i): XYCircularNumericalSketchBranchGuard => {
    const p = '$.branchGuards[' + i + ']'; check(v !== null && typeof v === 'object' && !Array.isArray(v), 'INVALID_DOCUMENT', 'Guard record required', p);
    const k = (v as Record<string, unknown>).kind;
    if (k === 'positive-projection') { const a = record(v, ['id', 'kind', 'segmentId', 'direction'], p), direction = xy(a.direction, p); check(Math.hypot(...direction) > 0, 'INVALID_DOCUMENT', 'Nonzero authored direction required', p); return { id: unique(a.id, p), kind: k, segmentId: ref(a.segmentId, segmentIds, p), direction }; }
    check(k === 'oriented-triplet', 'UNSUPPORTED', 'Unsupported branch guard', p);
    const a = record(v, ['id', 'kind', 'pointA', 'pointB', 'pointC', 'orientation'], p);
    check(a.orientation === 'ccw' || a.orientation === 'cw', 'UNSUPPORTED', 'Orientation must be ccw or cw', p);
    return { id: unique(a.id, p), kind: k, pointA: ref(a.pointA, pointIds, p), pointB: ref(a.pointB, pointIds, p), pointC: ref(a.pointC, pointIds, p), orientation: a.orientation };
  });
  return { format: 'barocss-xy-circular-numerical-sketch', version: 0, profile: 'bounded-radius-interior-tangent-v0', id, lengthUnit: 'mm', angleUnit: 'rad', points, segments, circles, constraints, branchGuards };
}
