import { SectionRationalContext } from './section-rational-internal.js';
import { chartRoundingBoundMM } from './numeric-policy.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import type { Point } from './types.js';
import { KernelError } from './core/barocss-error.js';

export const ConvexPlanarSolidDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE', OWNED: 'OWNED', COVERAGE: 'COVERAGE', BINDING: 'BINDING', INCIDENCE: 'INCIDENCE', CONVEXITY: 'CONVEXITY', DEGENERATE: 'DEGENERATE', REPRESENTABILITY: 'REPRESENTABILITY' } as const);
export type ConvexPlanarSolidDiagnosticCode = typeof ConvexPlanarSolidDiagnosticCode[keyof typeof ConvexPlanarSolidDiagnosticCode];
export class ConvexPlanarSolidError extends KernelError {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, detail: string, cause?: unknown) {
    super(('Convex planar solid: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ConvexPlanarSolidError';
  }
}
export function check(condition: boolean, code: ConvexPlanarSolidDiagnosticCode, detail: string): asserts condition { if (!condition) throw new ConvexPlanarSolidError(code, detail); }
export function record(value: unknown, fields: string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Own record required');
  const r = value as Record<string, unknown>;
  check(Object.keys(r).length === fields.length && fields.every(k => Object.hasOwn(r, k)), 'INPUT', 'Exact fields required: ' + fields.join(',')); return r;
}
export function id(value: unknown, maximum = 48): string { check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'IDENTITY', 'Bounded ASCII identity required'); return value; }
export function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k])); }
  return Object.is(a, b);
}
/** Every snapshot charges occurrences, including aliases. Bytes describe JSON data, never heap size. */
export class SolidSnapshotLedger {
  bytes = 0;
  retainedBytes = 0;
  copy<T>(input: T, retained = false, inspectOnly = false): T {
    let values = 0, bytes = 0, characters = 0;
    const maximumBytes = retained ? 16777216 : 8388608, maximumValues = retained ? 786432 : 524288;
    const ancestors = new Set<object>(), encoder = new TextEncoder();
    const charge = (n: number) => { bytes += n; this.bytes += n; check(bytes <= maximumBytes && this.bytes <= 50331648, 'BUDGET', 'Snapshot or cumulative serialized-byte ceiling exceeded'); };
    const string = (v: string, key = false) => { check(v.length <= (key ? 128 : 262144), 'BUDGET', 'String/key ceiling exceeded'); characters += v.length; check(characters <= (retained ? 8388608 : 4194304), 'BUDGET', 'Aggregate string ceiling exceeded'); charge(encoder.encode(JSON.stringify(v)).length); };
    const copy = (v: unknown, depth: number): unknown => {
      check(++values <= maximumValues && depth <= (retained ? 32 : 24), 'BUDGET', 'Value occurrence/depth ceiling exceeded');
      if (v === null || typeof v === 'boolean') { charge(v === null ? 4 : v ? 4 : 5); return v; }
      if (typeof v === 'number') { check(Number.isFinite(v), 'INPUT', 'Finite own number required'); charge(JSON.stringify(v).length); return v; }
      if (typeof v === 'string') { string(v); return v; }
      check(typeof v === 'object' && !ancestors.has(v), 'INPUT', 'Acyclic own plain data required');
      const array = Array.isArray(v), prototype = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v);
      check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'INPUT', 'Foreign prototype refused');
      check(keys.length <= (array ? 4097 : 64), 'BUDGET', 'Container ceiling exceeded');
      const descriptors = Object.getOwnPropertyDescriptors(v);
      check(keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable)), 'INPUT', 'Getter/symbol/hidden property refused');
      ancestors.add(v); charge(2);
      let output: unknown;
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= 4096 && keys.length === length + 1, 'INPUT', 'Dense bounded array required');
        const entries: unknown[] = [];
        for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), 'INPUT', 'Sparse array refused'); if (i) charge(1); const entry = copy(descriptors[String(i)].value, depth + 1); if (!inspectOnly) entries.push(entry); }
        output = inspectOnly ? v : entries;
      } else {
        const entries: [string, unknown][] = [];
        for (const [i, k] of (keys as string[]).entries()) { if (i) charge(1); string(k, true); charge(1); const entry = copy(descriptors[k].value, depth + 1); if (!inspectOnly) entries.push([k, entry]); }
        output = inspectOnly ? v : Object.fromEntries(entries);
      }
      ancestors.delete(v); return output;
    };
    const result = copy(input, 0) as T;
    if (!inspectOnly) { this.retainedBytes += bytes; check(this.retainedBytes <= 33554432, 'BUDGET', 'Retained input/result snapshot charge exceeded'); }
    return result;
  }
}
export type ExactPoint = [SectionRational, SectionRational, SectionRational];
export type ExactPointData = [SectionFraction, SectionFraction, SectionFraction];
export class SolidProof {
  readonly rational = new SectionRationalContext((kind, detail) => { throw new ConvexPlanarSolidError(kind, detail); });
  supportPredicates = 0; coefficientProofs = 0; fanTriangles = 0; queryPredicates = 0;
  /** Pcurve poles accepted under CadNumericPolicy.chartParameters (not exact, within one rounding). */
  certifiedLifts = 0; maximumLiftDeviationMM = 0;
  point(p: Point): ExactPoint { return p.map(v => this.rational.from(v)) as ExactPoint; }
  add(a: ExactPoint, b: ExactPoint): ExactPoint { return a.map((v, i) => this.rational.add(v, b[i])) as ExactPoint; }
  sub(a: ExactPoint, b: ExactPoint): ExactPoint { return a.map((v, i) => this.rational.sub(v, b[i])) as ExactPoint; }
  scale(a: ExactPoint, s: SectionRational): ExactPoint { return a.map(v => this.rational.mul(v, s)) as ExactPoint; }
  cross(a: ExactPoint, b: ExactPoint): ExactPoint { const r = this.rational; return [r.sub(r.mul(a[1], b[2]), r.mul(a[2], b[1])), r.sub(r.mul(a[2], b[0]), r.mul(a[0], b[2])), r.sub(r.mul(a[0], b[1]), r.mul(a[1], b[0]))]; }
  dot(a: ExactPoint, b: ExactPoint): SectionRational { const r = this.rational; return r.sum(a.map((v, i) => r.mul(v, b[i]))); }
  equal(a: ExactPoint, b: ExactPoint): boolean { return a.every((v, i) => this.rational.compare(v, b[i]) === 0); }
  text(a: ExactPoint): ExactPointData { return a.map(v => this.rational.text(v)) as ExactPointData; }
  plane(face: ConvexPlanarFaceResult): { origin: ExactPoint; normal: ExactPoint; vertices: ExactPoint[] } {
    const r = this.rational, p = face.plane, origin = this.point(p.controlPoints[0][0]);
    const u = this.sub(this.point(p.controlPoints[1][0]), origin), v = this.sub(this.point(p.controlPoints[0][1]), origin);
    check(this.equal(this.point(p.controlPoints[1][1]), this.add(this.add(origin, u), v)), 'BINDING', 'Stored support is not exactly affine');
    let normal = this.cross(u, v); check(normal.some(x => x.n !== 0n), 'DEGENERATE', 'Support rank is less than two');
    if (face.options.orientation === 'reverse') normal = this.scale(normal, r.integer(-1));
    const u0 = r.from(p.knotsU[1]), u1 = r.from(p.knotsU[2]), v0 = r.from(p.knotsV[1]), v1 = r.from(p.knotsV[2]);
    const vertices = face.topology.loop.uses.map(use => {
      const line = face.loop.edges.find(edge => edge.id === use.curveId)!, pc = face.pcurves.find(curve => curve.id === use.pcurveId)!;
      check(++this.coefficientProofs <= 64, 'BUDGET', 'Whole-edge coefficient proof ceiling exceeded');
      check(line.degree === 1 && pc.curve.degree === 1 && line.controlPoints.length === 2 && pc.curve.controlPoints.length === 2 && line.weights[0] === line.weights[1] && pc.curve.weights[0] === pc.curve.weights[1], 'BINDING', 'Affine native line and pcurve coefficients required');
      check(line.knots[1] === pc.curve.knots[1] && line.knots[2] === pc.curve.knots[2] && line.knots[1] === pc.domain[0] && line.knots[2] === pc.domain[1], 'BINDING', 'Original complete parameter domains must agree');
      for (let i = 0; i < 2; i++) {
        const uv = this.point(pc.curve.controlPoints[i]); check(uv[2].n === 0n, 'BINDING', 'Pcurve must be exactly UV');
        const a = r.div(r.sub(uv[0], u0), r.sub(u1, u0)), b = r.div(r.sub(uv[1], v0), r.sub(v1, v0));
        const lifted = this.add(this.add(origin, this.scale(u, a)), this.scale(v, b)), pole = this.point(line.controlPoints[i]);
        if (!this.equal(lifted, pole)) {
          // CadNumericPolicy.chartParameters: the 3D pole stays exact; its stored UV may carry one rounding.
          const bound = chartRoundingBoundMM(u.map(x => r.nearest(x)), [p.knotsU[1], p.knotsU[2]], v.map(x => r.nearest(x)), [p.knotsV[1], p.knotsV[2]]);
          const deviation = this.sub(lifted, pole).map(x => r.abs(x));
          check(deviation.every((x, k) => r.compare(x, r.from(bound[k])) <= 0), 'BINDING', 'Stored whole pcurve lift exceeds one chart rounding; parent tolerance cannot certify sewing');
          this.certifiedLifts++; this.maximumLiftDeviationMM = Math.max(this.maximumLiftDeviationMM, ...deviation.map(x => r.upward(x)));
        }
      }
      const start = use.sense === 'forward' ? 0 : 1, end = 1 - start;
      check(use.interval[0] === line.knots[start + 1] && use.interval[1] === line.knots[end + 1], 'BINDING', 'Directed actual native interval required');
      const vertex = face.topology.vertices.find(item => item.id === use.vertexIds[0])!;
      check(this.equal(this.point(vertex.point), this.point(line.controlPoints[start])), 'BINDING', 'Exact native vertex/use endpoint required');
      return this.point(vertex.point);
    });
    // Strict polygon convexity is independently proved, not inherited from float determinant flags.
    for (let i = 0; i < vertices.length; i++) for (let j = 0; j < vertices.length; j++) if (j !== i && j !== (i + 1) % vertices.length) {
      const inward = this.cross(this.sub(vertices[(i + 1) % vertices.length], vertices[i]), this.sub(vertices[j], vertices[i]));
      check(this.dot(inward, normal).n > 0n, 'CONVEXITY', 'Facet is not strictly convex with its outward winding');
    }
    return { origin, normal, vertices };
  }
}
