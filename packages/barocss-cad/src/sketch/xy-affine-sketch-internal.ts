import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionRational } from '../section-rational-internal.js';
import type { XYPoint } from './xy-profile.js';
import type { XYAffineSketchConstraint, XYAffineSketchCoordinate, XYAffineSketchDiagnostic, XYAffineSketchDocumentV0, XYAffineSketchPoint, XYAffineSketchReport } from '../xy-affine-sketch.js';

export const XYAffineSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: 'INVALID_DOCUMENT', UNSUPPORTED: 'UNSUPPORTED', LIMIT: 'LIMIT',
  REFERENCE: 'REFERENCE', CONFLICT: 'CONFLICT', BUDGET: 'BUDGET', REPRESENTABILITY: 'REPRESENTABILITY', DEGENERATE_GEOMETRY: 'DEGENERATE_GEOMETRY', COMPILATION: 'COMPILATION', OWNED: 'OWNED' } as const);
export type XYAffineSketchDiagnosticCode = typeof XYAffineSketchDiagnosticCode[keyof typeof XYAffineSketchDiagnosticCode];
export class XYAffineSketchError extends Error {
  constructor(readonly code: XYAffineSketchDiagnosticCode, detail: string, readonly path = '$', readonly constraintIds: string[] = [],
    readonly coordinate: XYAffineSketchCoordinate | null = null, readonly exactFraction: XYAffineSketchDiagnostic['exactFraction'] = null, cause?: unknown) {
    super(('XY affine sketch: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYAffineSketchError';
  }
}
export function isAffineError(value: unknown): value is XYAffineSketchError {
  try { return value instanceof XYAffineSketchError; } catch { return false; }
}
export function check(condition: boolean, code: XYAffineSketchDiagnosticCode, detail: string, path = '$'): asserts condition {
  if (!condition) throw new XYAffineSketchError(code, detail, path);
}
export function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? 'OWNED' : 'INVALID_DOCUMENT', ancestors = new Set<object>(); let remaining = owned ? 131072 : 4096;
  // Reflection can execute Proxy traps: never inspect a value they throw.
  const reflect = <T>(read: () => T, path: string): T => {
    try { return read(); } catch { throw new XYAffineSketchError(code, 'Own-data reflection refused', path); }
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
export function admit(input: unknown): XYAffineSketchDocumentV0 {
  const data = record(snapshot(input), ['format', 'version', 'profile', 'id', 'lengthUnit', 'points', 'segments', 'referenceLines', 'constraints'], '$');
  check(data.format === 'barocss-xy-affine-sketch' && data.version === 0 && data.profile === 'exact-affine-binary64' && data.lengthUnit === 'mm', 'UNSUPPORTED', 'Affine sketch v0 exact-affine-binary64/mm required', '$');
  const id = identifier(data.id, '$.id'), ids = new Set([id]);
  const unique = (value: unknown, path: string): string => { const name = identifier(value, path); check(!ids.has(name), 'INVALID_DOCUMENT', 'Duplicate global ID #' + name, path); ids.add(name); return name; };
  const reference = (value: unknown, targets: Set<string>, path: string): string => { const name = identifier(value, path); check(targets.has(name), 'REFERENCE', 'Unresolved reference #' + name, path); return name; };
  const points = list(data.points, 2, 16, '$.points').map((value, i) => { const path = '$.points[' + i + ']', p = record(value, ['id', 'position'], path); return { id: unique(p.id, path + '.id'), position: xy(p.position, path + '.position') }; });
  const pointIds = new Set(points.map(p => p.id));
  const segments = list(data.segments, 1, 8, '$.segments').map((value, i) => {
    const path = '$.segments[' + i + ']', s = record(value, ['id', 'startPointId', 'endPointId'], path), name = unique(s.id, path + '.id');
    const startPointId = reference(s.startPointId, pointIds, path + '.startPointId'), endPointId = reference(s.endPointId, pointIds, path + '.endPointId');
    check(startPointId !== endPointId, 'REFERENCE', 'Distinct segment endpoint IDs required', path); return { id: name, startPointId, endPointId };
  });
  const segmentIds = new Set(segments.map(s => s.id));
  const referenceLines = list(data.referenceLines, 0, 8, '$.referenceLines').map((value, i) => {
    const path = '$.referenceLines[' + i + ']', line = record(value, ['id', 'anchor', 'direction'], path), direction = xy(line.direction, path + '.direction');
    check(direction[0] !== 0 || direction[1] !== 0, 'INVALID_DOCUMENT', 'Reference direction must be nonzero', path + '.direction');
    return { id: unique(line.id, path + '.id'), anchor: xy(line.anchor, path + '.anchor'), direction };
  });
  const lineIds = new Set(referenceLines.map(line => line.id));
  const constraints = list(data.constraints, 0, 32, '$.constraints').map((value, i): XYAffineSketchConstraint => {
    const path = '$.constraints[' + i + ']';
    check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DOCUMENT', 'Constraint record required', path);
    const kind = (value as Record<string, unknown>).kind;
    const fields = kind === 'fixed' ? ['pointId', 'target'] : kind === 'coincident' ? ['pointA', 'pointB']
      : kind === 'horizontal' || kind === 'vertical' ? ['segmentId'] : kind === 'midpoint' ? ['midpointId', 'pointA', 'pointB']
        : kind === 'point-on-authored-line' ? ['pointId', 'referenceLineId'] : kind === 'segment-parallel-to-fixed-direction' ? ['segmentId', 'referenceLineId'] : null;
    check(fields !== null, 'UNSUPPORTED', 'Unsupported affine constraint kind', path + '.kind');
    const c = record(value, ['id', 'kind', ...fields], path), name = unique(c.id, path + '.id');
    const point = (field: string) => reference(c[field], pointIds, path + '.' + field), segment = () => reference(c.segmentId, segmentIds, path + '.segmentId'), line = () => reference(c.referenceLineId, lineIds, path + '.referenceLineId');
    if (kind === 'fixed') return { id: name, kind, pointId: point('pointId'), target: xy(c.target, path + '.target') };
    if (kind === 'coincident') return { id: name, kind, pointA: point('pointA'), pointB: point('pointB') };
    if (kind === 'midpoint') return { id: name, kind, midpointId: point('midpointId'), pointA: point('pointA'), pointB: point('pointB') };
    if (kind === 'horizontal' || kind === 'vertical') return { id: name, kind, segmentId: segment() };
    if (kind === 'point-on-authored-line') return { id: name, kind, pointId: point('pointId'), referenceLineId: line() };
    return { id: name, kind: 'segment-parallel-to-fixed-direction', segmentId: segment(), referenceLineId: line() };
  });
  return { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id, lengthUnit: 'mm', points, segments, referenceLines, constraints };
}

interface Row { coefficients: SectionRational[]; rhs: SectionRational; provenance: Set<string>; path: string }
interface Pivot { column: number; row: Row }
export function solve(document: XYAffineSketchDocumentV0): { points: XYAffineSketchPoint[]; report: XYAffineSketchReport } {
  let activePath = '$.constraints', conversion: { coordinate: XYAffineSketchCoordinate; fraction: XYAffineSketchDiagnostic['exactFraction'] } | null = null;
  const q = new SectionRationalContext((kind, detail) => {
    if (kind === 'REPRESENTABILITY' && conversion) throw new XYAffineSketchError(kind, 'Point #' + conversion.coordinate.pointId + ' axis ' + conversion.coordinate.axis
      + ' exact ' + conversion.fraction!.numerator + '/' + conversion.fraction!.denominator + ' is not exactly representable in binary64', activePath, [], conversion.coordinate, conversion.fraction);
    throw new XYAffineSketchError(kind, detail, activePath);
  });
  const n = document.points.length * 2, indices = new Map(document.points.map((p, i) => [p.id, i * 2])), zero = q.integer(0), one = q.integer(1), two = q.integer(2);
  const coordinate = (column: number): XYAffineSketchCoordinate => ({ pointId: document.points[Math.floor(column / 2)].id, axis: column % 2 === 0 ? 'x' : 'y' });
  const rows: Row[] = [], pivots: Pivot[] = [], redundantConstraintIds: string[] = [];
  const ordered = (ids: Set<string>): string[] => document.constraints.filter(c => ids.has(c.id)).map(c => c.id);
  const make = (id: string, terms: [number, SectionRational][], rhs = zero): Row => {
    const coefficients = Array.from({ length: n }, () => zero);
    for (const [column, value] of terms) coefficients[column] = q.add(coefficients[column], value);
    return { coefficients, rhs, provenance: new Set([id]), path: activePath };
  };
  for (const [index, c] of document.constraints.entries()) {
    activePath = '$.constraints[' + index + ']'; const before = pivots.length, emitted: Row[] = [];
    const point = (id: string) => indices.get(id)!;
    if (c.kind === 'fixed') for (let axis = 0; axis < 2; axis++) emitted.push(make(c.id, [[point(c.pointId) + axis, one]], q.from(c.target[axis])));
    else if (c.kind === 'coincident') for (let axis = 0; axis < 2; axis++) emitted.push(make(c.id, [[point(c.pointA) + axis, one], [point(c.pointB) + axis, q.neg(one)]]));
    else if (c.kind === 'midpoint') for (let axis = 0; axis < 2; axis++) emitted.push(make(c.id, [[point(c.midpointId) + axis, two], [point(c.pointA) + axis, q.neg(one)], [point(c.pointB) + axis, q.neg(one)]]));
    else if (c.kind === 'point-on-authored-line') {
      const line = document.referenceLines.find(line => line.id === c.referenceLineId)!, dx = q.from(line.direction[0]), dy = q.from(line.direction[1]);
      emitted.push(make(c.id, [[point(c.pointId), q.neg(dy)], [point(c.pointId) + 1, dx]], q.sub(q.mul(dx, q.from(line.anchor[1])), q.mul(dy, q.from(line.anchor[0])))));
    } else {
      const segment = document.segments.find(segment => segment.id === c.segmentId)!, a = point(segment.startPointId), b = point(segment.endPointId);
      if (c.kind === 'horizontal' || c.kind === 'vertical') { const axis = c.kind === 'horizontal' ? 1 : 0; emitted.push(make(c.id, [[b + axis, one], [a + axis, q.neg(one)]])); }
      else if (c.kind === 'segment-parallel-to-fixed-direction') {
        const line = document.referenceLines.find(line => line.id === c.referenceLineId)!, dx = q.from(line.direction[0]), dy = q.from(line.direction[1]);
        emitted.push(make(c.id, [[b, q.neg(dy)], [b + 1, dx], [a, dy], [a + 1, q.neg(dx)]]));
      }
    }
    for (const original of emitted) {
      rows.push(original); check(rows.length <= 64, 'LIMIT', 'At most 64 scalar equations supported', activePath);
      const row: Row = { ...original, coefficients: [...original.coefficients], provenance: new Set(original.provenance) };
      for (const pivot of pivots) {
        const factor = row.coefficients[pivot.column]; if (factor.n === 0n) continue;
        for (let j = pivot.column; j < n; j++) if (pivot.row.coefficients[j].n !== 0n) row.coefficients[j] = q.sub(row.coefficients[j], q.mul(factor, pivot.row.coefficients[j]));
        row.rhs = q.sub(row.rhs, q.mul(factor, pivot.row.rhs));
        for (const id of pivot.row.provenance) row.provenance.add(id);
      }
      const column = row.coefficients.findIndex(value => value.n !== 0n);
      if (column < 0) {
        if (row.rhs.n !== 0n) throw new XYAffineSketchError('CONFLICT', 'Inconsistent exact equation at #' + c.id + '; provenance is nonminimal', activePath, ordered(row.provenance));
        continue;
      }
      const divisor = row.coefficients[column];
      for (let j = column; j < n; j++) if (row.coefficients[j].n !== 0n) row.coefficients[j] = q.div(row.coefficients[j], divisor);
      row.rhs = q.div(row.rhs, divisor); pivots.push({ column, row }); pivots.sort((a, b) => a.column - b.column);
    }
    if (pivots.length === before) redundantConstraintIds.push(c.id);
  }
  const seeds = document.points.flatMap(p => p.position), values = seeds.map(value => q.from(value)), pivotColumns = new Set(pivots.map(p => p.column));
  for (const pivot of [...pivots].reverse()) {
    activePath = pivot.row.path; let rhs = pivot.row.rhs;
    for (let j = pivot.column + 1; j < n; j++) if (pivot.row.coefficients[j].n !== 0n) rhs = q.sub(rhs, q.mul(pivot.row.coefficients[j], values[j]));
    values[pivot.column] = rhs;
  }
  // Check every coordinate (including construction-only points) before native construction.
  const numeric = values.map((value, column) => {
    activePath = '$.points[' + Math.floor(column / 2) + '].position[' + column % 2 + ']';
    conversion = { coordinate: coordinate(column), fraction: q.text(value) };
    const represented = q.exactFloat(value);
    check(Math.abs(represented) <= 10000, 'UNSUPPORTED', 'Solved coordinate exceeds +/-10000 mm', activePath);
    conversion = null;
    return !pivotColumns.has(column) ? seeds[column] : represented;
  });
  const represented = numeric.map(value => q.from(value));
  for (const row of rows) {
    activePath = row.path; let lhs = zero;
    for (let j = 0; j < n; j++) if (row.coefficients[j].n !== 0n) lhs = q.add(lhs, q.mul(row.coefficients[j], represented[j]));
    check(q.compare(lhs, row.rhs) === 0, 'COMPILATION', 'Exact represented coordinate equation binding failed', activePath);
  }
  return { points: document.points.map((p, i) => ({ id: p.id, position: [numeric[i * 2], numeric[i * 2 + 1]] })), report: {
    rank: pivots.length, degreesOfFreedom: n - pivots.length, fullyConstrained: pivots.length === n, equationCount: rows.length, unknownCount: n,
    redundantConstraintIds, pivotCoordinates: pivots.map(p => coordinate(p.column)), freeCoordinates: Array.from({ length: n }, (_, i) => i).filter(i => !pivotColumns.has(i)).map(coordinate), rationalWork: q.counts(),
    quality: { arithmetic: 'exact-represented-binary64-rationals', coordinateConversion: 'exact-or-refuse', freeVariables: 'authored-seeds-in-point-xy-order',
      pivotOrder: 'leftmost-in-authored-equation-order', redundancy: 'chronological-zero-rank-increase', conflictProvenance: 'chronological-nonminimal-contributing-union',
      referenceLines: 'immutable-authored-constants', sourceFrame: 'authored-xy-z-zero', directionUnit: 'dimensionless', ownership: 'copied-cpu-data-gc-no-renderer-resources', topologyCertified: false, solid: false, manufacturingToleranceCertified: false },
    limits: { points: 16, segments: 8, referenceLines: 8, constraints: 32, scalarEquations: 64, unknowns: 32, coordinateAbsMM: 10000, directionAbs: 10000,
      minimumSegmentMM: .001, rationalOperations: 200000, gcdSteps: 200000, integerBits: 8192, floatSearchIterations: 64 }
  } };
}
