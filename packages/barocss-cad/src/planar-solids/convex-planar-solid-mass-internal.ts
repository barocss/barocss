import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionRational } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
export { SectionRationalContext };
export { same } from '../convex-planar-solid-proof-internal.js';
export const ConvexPlanarSolidMassDiagnosticCode = Object.freeze({ INPUT: 'INPUT', BUDGET: 'BUDGET', PARENT: 'PARENT', BINDING: 'BINDING', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED' } as const);
export type ConvexPlanarSolidMassDiagnosticCode = typeof ConvexPlanarSolidMassDiagnosticCode[keyof typeof ConvexPlanarSolidMassDiagnosticCode];
export class ConvexPlanarSolidMassError extends KernelError {
  constructor(readonly code: ConvexPlanarSolidMassDiagnosticCode, detail: string, cause?: unknown) {
    super(('Convex planar Solid mass: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ConvexPlanarSolidMassError';
  }
}
export function demand(condition: boolean, code: ConvexPlanarSolidMassDiagnosticCode, detail: string): asserts condition { if (!condition) throw new ConvexPlanarSolidMassError(code, detail); }
export function fields(value: unknown, keys: string[]): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Own record required');
  const record = value as Record<string, unknown>;
  demand(Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key)), 'INPUT', 'Exact fields required: ' + keys.join(',')); return record;
}
export const MASS_LIMITS = Object.freeze({ snapshotBytes: 16777216, rootCumulativeSnapshotBytes: 67108864, rootRetainedSnapshotBytes: 67108864, parentSnapshotReserveBytes: 50331648, aggregateSnapshotBytes: 117440512, snapshotValues: 1048576, snapshotDepth: 40, aggregateStringCharacters: 8388608, arrayElements: 4096, recordFields: 64, keyCharacters: 128, stringCharacters: 262144, faces: 12, vertices: 32, edges: 32, directedUses: 64, fanTriangles: 40, faceReconstructions: 12, sourceCompilations: 12, bindingObservations: 192, nativeD1Calls: 576, rationalContexts: 2, rationalOperationsPerContext: 200000, aggregateRationalOperations: 400000, aggregateGcdSteps: 400000, integerBits: 8192, finalValueConversions: 17, errorBoundConversions: 17, floatSearchSteps: 2176, maximumDensityKgPerM3: 1000000 });
/** One ledger covers all wrapper snapshots, including owned validation. Child reserve is explicit, not heap telemetry. */
export class MassLedger {
  private bytes = 0;
  private retainedBytes = 0;
  copy<T>(input: T): T {
    let bytes = 0, values = 0, characters = 0;
    const ancestors = new Set<object>(), encoder = new TextEncoder(), limits = MASS_LIMITS;
    const charge = (n: number) => { bytes += n; this.bytes += n; demand(bytes <= limits.snapshotBytes && this.bytes + limits.parentSnapshotReserveBytes <= limits.aggregateSnapshotBytes, 'BUDGET', 'Snapshot or cumulative serialized-byte ceiling exceeded'); };
    const string = (value: string, key = false) => { demand(value.length <= (key ? limits.keyCharacters : limits.stringCharacters), 'BUDGET', 'String/key ceiling exceeded'); characters += value.length; demand(characters <= limits.aggregateStringCharacters, 'BUDGET', 'Aggregate string ceiling exceeded'); charge(encoder.encode(JSON.stringify(value)).length); };
    const visit = (value: unknown, depth: number): unknown => {
      demand(++values <= limits.snapshotValues && depth <= limits.snapshotDepth, 'BUDGET', 'Value occurrence/depth ceiling exceeded');
      if (value === null || typeof value === 'boolean') { charge(value === null ? 4 : value ? 4 : 5); return value; }
      if (typeof value === 'number') { demand(Number.isFinite(value), 'INPUT', 'Finite own number required'); charge(Object.is(value, -0) ? 2 : JSON.stringify(value).length); return value; }
      if (typeof value === 'string') { string(value); return value; }
      demand(typeof value === 'object' && !ancestors.has(value), 'INPUT', 'Acyclic own plain data required');
      const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
      demand(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'INPUT', 'Foreign prototype refused');
      demand(keys.length <= (array ? limits.arrayElements + 1 : limits.recordFields), 'BUDGET', 'Container ceiling exceeded');
      const descriptors = Object.getOwnPropertyDescriptors(value);
      demand(keys.every(key => typeof key === 'string' && key.length <= limits.keyCharacters && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), 'INPUT', 'Getter/symbol/hidden property refused');
      ancestors.add(value); charge(2); let output: unknown;
      if (array) {
        const length = descriptors.length.value as number;
        demand(Number.isInteger(length) && length >= 0 && length <= limits.arrayElements && keys.length === length + 1, 'INPUT', 'Dense bounded array required');
        output = Array.from({ length }, (_, i) => { demand(Object.hasOwn(descriptors, String(i)), 'INPUT', 'Sparse array refused'); if (i) charge(1); return visit(descriptors[String(i)].value, depth + 1); });
      } else output = Object.fromEntries((keys as string[]).map((key, i) => { if (i) charge(1); string(key, true); charge(1); return [key, visit(descriptors[key].value, depth + 1)]; }));
      ancestors.delete(value); return output;
    };
    try {
      const result = visit(input, 0) as T;
      this.retainedBytes += bytes; demand(this.retainedBytes <= limits.rootRetainedSnapshotBytes, 'BUDGET', 'Cumulative retained-copy ceiling exceeded'); return result;
    } catch (cause) {
      if (cause instanceof ConvexPlanarSolidMassError) throw cause;
      throw new ConvexPlanarSolidMassError('INPUT', 'Own snapshot inspection refused', cause);
    }
  }
}
export type RationalVector = [SectionRational, SectionRational, SectionRational];
export type RationalMatrix = [RationalVector, RationalVector, RationalVector];
export function matrix(entry: (row: number, column: number) => SectionRational): RationalMatrix {
  const result = [[], [], []] as unknown as RationalMatrix;
  for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) result[i][j] = result[j][i] = entry(i, j); return result;
}
export function minors(q: SectionRationalContext, t: RationalMatrix): RationalVector {
  const a = t[0][0], b = t[0][1], c = t[0][2], d = t[1][1], e = t[1][2], f = t[2][2];
  return [a, q.sub(q.mul(a, d), q.mul(b, b)), q.sum([q.mul(q.mul(a, d), f), q.mul(q.integer(2), q.mul(q.mul(b, c), e)), q.neg(q.mul(a, q.mul(e, e))), q.neg(q.mul(d, q.mul(c, c))), q.neg(q.mul(f, q.mul(b, b)))])];
}
