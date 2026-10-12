import { ConvexPlanarSolidError, SolidProof, same } from './convex-planar-solid-proof-internal.js';
import { ConvexPlanarSolidSplitError } from './convex-planar-solid-split-internal.js';
export { SolidProof, same };
export type ChamferCode = 'INPUT' | 'IDENTITY' | 'BUDGET' | 'NATIVE' | 'OWNED' | 'BINDING' | 'INCIDENCE' | 'DEGENERATE' | 'REPRESENTABILITY' | 'SELECTION' | 'METRIC' | 'LOCALITY';
export class ConvexPlanarSolidChamferError extends Error {
  constructor(readonly code: ChamferCode, readonly stage: string, readonly entity: string, detail: string, cause?: unknown) {
    super(('Convex planar solid chamfer: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ConvexPlanarSolidChamferError';
  }
}
export function demand(condition: boolean, code: ChamferCode, detail: string): asserts condition {
  if (!condition) throw new ConvexPlanarSolidChamferError(code, 'admission', 'request', detail);
}
export function at<T>(stage: string, entity: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof ConvexPlanarSolidChamferError) { if (cause.stage !== 'admission') throw cause; throw new ConvexPlanarSolidChamferError(cause.code, stage, entity, cause.message, cause); }
    const code = (cause instanceof ConvexPlanarSolidError || cause instanceof ConvexPlanarSolidSplitError) && ['BUDGET', 'REPRESENTABILITY', 'BINDING', 'OWNED', 'IDENTITY', 'INCIDENCE', 'DEGENERATE', 'INPUT'].includes(cause.code) ? cause.code as ChamferCode : 'NATIVE';
    throw new ConvexPlanarSolidChamferError(code, stage, entity, cause instanceof Error ? cause.message : 'Native construction refused', cause);
  }
}
export function fields(value: unknown, keys: string[]): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Own record required');
  const object = value as Record<string, unknown>;
  demand(Object.keys(object).length === keys.length && keys.every(k => Object.hasOwn(object, k)), 'INPUT', 'Exact fields required: ' + keys.join(',')); return object;
}
export function identity(value: unknown, maximum = 48): string {
  demand(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'IDENTITY', 'Bounded ASCII identity required'); return value;
}
export const CHAMFER_LIMITS = Object.freeze({ inputBytes: 16777216, resultBytes: 67108864, cumulativeSnapshotBytes: 234881024, retainedSnapshotBytes: 234881024, inputValues: 1048576, resultValues: 4194304, inputDepth: 40, resultDepth: 64, inputStringCharacters: 8388608, resultStringCharacters: 33554432, arrayElements: 4096, recordFields: 64, keyCharacters: 128, stringCharacters: 262144, parentFaces: 11, parentVertices: 30, parentUses: 58, parentFanTriangles: 36, endFaceEdges: 7, crossings: 4, capSegments: 4, faceCompilations: 45, sourceCompilations: 46, bindingObservations: 666, totalD1: 1998, rationalContexts: 5, rationalOperationsPerContext: 200000, aggregateRationalOperations: 1000000, aggregateGcdSteps: 1000000, integerBits: 8192, spanDoublings: 1024, aggregateSnapshotBytesIncludingSplitAndQualifiers: 587202560 });
/** Serialized signed-JSON occurrence accounting, not heap telemetry. Child ledgers remain unchanged. */
export class ChamferLedger {
  cumulativeBytes = 0; retainedBytes = 0;
  copy<T>(input: T, result = false, inspectOnly = false, retained = !inspectOnly): T {
    let bytes = 0, values = 0, characters = 0;
    const ancestors = new Set<object>(), encoder = new TextEncoder(), limits = CHAMFER_LIMITS;
    const charge = (n: number) => { bytes += n; this.cumulativeBytes += n; demand(bytes <= (result ? limits.resultBytes : limits.inputBytes) && this.cumulativeBytes <= limits.cumulativeSnapshotBytes, 'BUDGET', 'Root snapshot/cumulative byte ceiling exceeded'); };
    const string = (v: string, key = false) => { demand(v.length <= (key ? limits.keyCharacters : limits.stringCharacters), 'BUDGET', 'String/key ceiling exceeded'); characters += v.length; demand(characters <= (result ? limits.resultStringCharacters : limits.inputStringCharacters), 'BUDGET', 'Aggregate string ceiling exceeded'); charge(encoder.encode(JSON.stringify(v)).length); };
    const visit = (v: unknown, depth: number): unknown => {
      demand(++values <= (result ? limits.resultValues : limits.inputValues) && depth <= (result ? limits.resultDepth : limits.inputDepth), 'BUDGET', 'Root value/depth ceiling exceeded');
      if (v === null || typeof v === 'boolean') { charge(v === null ? 4 : v ? 4 : 5); return v; }
      if (typeof v === 'number') { demand(Number.isFinite(v), 'INPUT', 'Finite own number required'); charge(Object.is(v, -0) ? 2 : JSON.stringify(v).length); return v; }
      if (typeof v === 'string') { string(v); return v; }
      demand(typeof v === 'object' && !ancestors.has(v), 'INPUT', 'Acyclic own plain data required');
      const array = Array.isArray(v), prototype = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v);
      demand(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'INPUT', 'Foreign prototype refused');
      demand(keys.length <= (array ? limits.arrayElements + 1 : limits.recordFields), 'BUDGET', 'Container ceiling exceeded');
      const descriptors = Object.getOwnPropertyDescriptors(v);
      demand(keys.every(k => typeof k === 'string' && k.length <= limits.keyCharacters && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable)), 'INPUT', 'Getter/symbol/hidden property refused');
      ancestors.add(v); charge(2); let output: unknown;
      if (array) {
        const length = descriptors.length.value as number;
        demand(Number.isInteger(length) && length >= 0 && length <= limits.arrayElements && keys.length === length + 1, 'INPUT', 'Dense bounded array required');
        const entries: unknown[] = [];
        for (let i = 0; i < length; i++) { demand(Object.hasOwn(descriptors, String(i)), 'INPUT', 'Sparse array refused'); if (i) charge(1); const entry = visit(descriptors[String(i)].value, depth + 1); if (!inspectOnly) entries.push(entry); }
        output = inspectOnly ? v : entries;
      } else {
        const entries: [string, unknown][] = [];
        for (const [i, k] of (keys as string[]).entries()) { if (i) charge(1); string(k, true); charge(1); const entry = visit(descriptors[k].value, depth + 1); if (!inspectOnly) entries.push([k, entry]); }
        output = inspectOnly ? v : Object.fromEntries(entries);
      }
      ancestors.delete(v); return output;
    };
    const output = visit(input, 0) as T;
    if (retained) { this.retainedBytes += bytes; demand(this.retainedBytes <= limits.retainedSnapshotBytes, 'BUDGET', 'Root retained snapshot ceiling exceeded'); }
    return output;
  }
}
