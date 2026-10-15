import { createCadDocument, parseCadDocument, serializeCadDocument, validateCadDocumentResult, CadDocumentError } from './cad-document.js';
import type { CadDocumentResult } from './cad-document.js';
import { compileCadModel } from './model-compiler.js';
import { copyCadData } from './data-copy.js';
import type { Model } from './types.js';
import { same } from './structural-equality.js';

export const CadDocumentCompatibilityDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', FORMAT: 'FORMAT', VERSION: 'VERSION', PROFILE: 'PROFILE', IDENTITY: 'IDENTITY',
  REFERENCE: 'REFERENCE', FRAME: 'FRAME', SOURCE: 'SOURCE', BUDGET: 'BUDGET', OWNED: 'OWNED',
} as const);
export type CadDocumentCompatibilityDiagnosticCode =
  typeof CadDocumentCompatibilityDiagnosticCode[keyof typeof CadDocumentCompatibilityDiagnosticCode];
export class CadDocumentCompatibilityError extends Error {
  readonly code: CadDocumentCompatibilityDiagnosticCode;
  constructor(code: CadDocumentCompatibilityDiagnosticCode, detail: string, cause?: unknown) {
    super(('CAD document compatibility: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadDocumentCompatibilityError'; this.code = code;
  }
}
export interface CadDocumentCompatibilityInput { format: string; text: string }
export type CadDocumentMigrationOptions = { mode: 'identity' } | {
  mode: 'source0-wrap'; documentId: string; revision: number; assetId: string; assetRevision: number;
  sourceFrame: 'authored-xyz-no-axis-conversion'; bodies: { id: string; name: string; geometryId: string }[];
};
export interface CadDocumentCompatibilityEntry {
  format: string; inputFileVersion: number | null; inputSourceVersion: 0 | 1 | 2 | null; inputProfile: string;
  support: 'supported' | 'unsupported-retain-own-reader'; operation: 'identity' | 'source0-wrap' | null;
  targetFormat: 'canonical-document-v1' | null; targetFileVersion: 1 | null; targetProfile: 'direct-geometry' | null;
  reason: string;
}
export interface CadDocumentCompatibilityReport {
  schema: 'barocss-cad-document-compatibility-report'; version: 0; operation: 'inspect' | 'identity' | 'source0-wrap'; supported: true;
  input: { format: 'canonical-document-v1' | 'native-source0'; fileVersion: 1 | null; sourceVersion: 0;
    profile: 'direct-geometry' | 'native-geometry'; role: 'authored-canonical-document' | 'authored-native-source'; bytes: number; codeUnits: number };
  target: { format: 'canonical-document-v1'; fileVersion: 1; sourceVersion: 0; profile: 'direct-geometry'; role: 'authored-document-candidate' };
  lengthUnit: 'mm'; angleUnit: 'rad'; sourceFrame: 'authored-xyz-no-axis-conversion';
  sourceAssetCount: number; nativeObjectCount: number; preserved: string[]; transformed: string[]; unsupported: string[];
  compatibilityMatrix: CadDocumentCompatibilityEntry[]; geometryAuthority: 'original-authored-source-text';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { originalInputTextRetained: true; sourceTextPreserved: true; nativeGeometryBitsPreserved: true;
    nativeGeometryIdsUnchanged: true; frameUnitsUnchanged: true; canonicalReader: 'actual-strict-document-v1-codec';
    nativeCompiler: 'actual-source0-compiler'; candidateReplacement: 'caller-owned-not-applied';
    olderReadersAdopted: false; manufacturingToleranceCertified: false; globalBinary64ErrorCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-original-input-and-prior-candidate-retained';
  limits: { maximumSourceBytes: 262144; maximumSourceCodeUnits: 262144; maximumFileBytes: 2097152;
    maximumFileCodeUnits: 2097152; maximumAssets: 4; maximumBodies: 16;
    inputValues: 524288; inputDepth: 32; inputArrayElements: 4096; inputRecordFields: 64;
    snapshotValues: 524288; snapshotDepth: 32; arrayElements: 4096; recordFields: 64; stringCharacters: 2097152;
    authoredIdCharacters: 48; geometryIdCharacters: 128; nameBytes: 128; maximumRevision: 2147483647 };
}
export interface CadDocumentMigrationMapping {
  bodyId: string; assetId: string; inputGeometryId: string; outputGeometryId: string; geometryKind: 'curve' | 'surface';
}
export interface CadDocumentMigrationResult {
  input: CadDocumentCompatibilityInput; options: CadDocumentMigrationOptions; candidate: CadDocumentResult;
  serializedCandidate: string; report: CadDocumentCompatibilityReport; mappings: CadDocumentMigrationMapping[];
}

const CODE = CadDocumentCompatibilityDiagnosticCode;
const SOURCE_LIMIT = 262144, FILE_LIMIT = 2097152;
function check(condition: boolean, code: CadDocumentCompatibilityDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CadDocumentCompatibilityError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CadDocumentCompatibilityDiagnosticCode = CODE.SOURCE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadDocumentCompatibilityError) throw cause;
    const actualCode = cause instanceof CadDocumentError ? cause.code === 'JSON' ? CODE.INPUT : cause.code : code;
    throw new CadDocumentCompatibilityError(actualCode, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 0x80) bytes++;
    else if (value < 0x800) bytes += 2;
    else if (value >= 0xd800 && value <= 0xdbff) {
      const next = text.charCodeAt(++i);
      check(next >= 0xdc00 && next <= 0xdfff, CODE.INPUT, 'unpaired Unicode surrogate refused'); bytes += 4;
    } else { check(value < 0xdc00 || value > 0xdfff, CODE.INPUT, 'unpaired Unicode surrogate refused'); bytes += 3; }
  }
  return bytes;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = 524288;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= FILE_LIMIT, code, 'own string budget exceeded'); return value; }
    check(typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? 4097 : 64), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 4096 && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: CadDocumentCompatibilityDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function matrix(): CadDocumentCompatibilityEntry[] {
  const supported: CadDocumentCompatibilityEntry[] = [
    { format: 'canonical-document-v1', inputFileVersion: 1, inputSourceVersion: 0, inputProfile: 'direct-geometry',
      support: 'supported', operation: 'identity', targetFormat: 'canonical-document-v1', targetFileVersion: 1,
      targetProfile: 'direct-geometry', reason: 'actual current strict document codec; authored identity only' },
    { format: 'native-source0', inputFileVersion: null, inputSourceVersion: 0, inputProfile: 'native-geometry',
      support: 'supported', operation: 'source0-wrap', targetFormat: 'canonical-document-v1', targetFileVersion: 1,
      targetProfile: 'direct-geometry', reason: 'actual original source0 compiler; explicit caller-owned wrapper metadata' },
  ];
  const unsupported: [string, number | null, 0 | 1 | 2 | null, string][] = [
    ['editor-project-v1', 1, null, 'editor-project'], ['editor-scene-v1', 1, null, 'editor-scene'],
    ['native-feature-document', null, null, 'native-feature-document'], ['native-source1', null, 1, 'native-source'],
    ['native-source2', null, 2, 'native-source'],
  ];
  return [...supported, ...unsupported.map(([format, inputFileVersion, inputSourceVersion, inputProfile]): CadDocumentCompatibilityEntry =>
    ({ format, inputFileVersion, inputSourceVersion, inputProfile, support: 'unsupported-retain-own-reader',
      operation: null, targetFormat: null, targetFileVersion: null, targetProfile: null,
      reason: 'not converted by this direct-geometry candidate API; retain original file and its own reader' }))];
}
function load(input: CadDocumentCompatibilityInput): {
  input: CadDocumentCompatibilityInput; bytes: number; document: CadDocumentResult | null; model: Model | null;
} {
  const i = record(snapshot(input), ['format', 'text']);
  check(i.format === 'canonical-document-v1' || i.format === 'native-source0', CODE.FORMAT,
    'explicit canonical-document-v1 or native-source0 required; other formats retain their own readers');
  check(typeof i.text === 'string', CODE.INPUT, 'original file text required');
  const limit = i.format === 'native-source0' ? SOURCE_LIMIT : FILE_LIMIT;
  check(i.text.length <= limit, CODE.BUDGET, 'input file code-unit budget exceeded');
  const bytes = utf8Bytes(i.text);
  check(bytes <= limit, CODE.BUDGET, 'input file UTF-8 byte budget exceeded');
  const original: CadDocumentCompatibilityInput = { format: i.format, text: i.text };
  if (i.format === 'canonical-document-v1') return { input: original, bytes,
    document: native(() => parseCadDocument(i.text as string), 'actual strict canonical document reader'), model: null };
  const compiled = native(() => compileCadModel(i.text as string, { sourceVersion: 0 }), 'actual original source0 compiler');
  if (!compiled.ok) throw new CadDocumentCompatibilityError(CODE.SOURCE, 'original native source0 compilation refused', compiled);
  return { input: original, bytes, document: null, model: compiled.model };
}
function report(loaded: ReturnType<typeof load>, action: CadDocumentCompatibilityReport['operation']): CadDocumentCompatibilityReport {
  const canonical = loaded.input.format === 'canonical-document-v1';
  const sourceAssetCount = loaded.document?.document.assets.length ?? 1;
  const nativeObjectCount = loaded.document
    ? loaded.document.compiledAssets.reduce((sum, asset) => sum + asset.model.objects.length, 0) : loaded.model!.objects.length;
  return { schema: 'barocss-cad-document-compatibility-report', version: 0, operation: action, supported: true,
    input: { format: canonical ? 'canonical-document-v1' : 'native-source0', fileVersion: canonical ? 1 : null, sourceVersion: 0,
      profile: canonical ? 'direct-geometry' : 'native-geometry', role: canonical ? 'authored-canonical-document' : 'authored-native-source',
      bytes: loaded.bytes, codeUnits: loaded.input.text.length },
    target: { format: 'canonical-document-v1', fileVersion: 1, sourceVersion: 0, profile: 'direct-geometry', role: 'authored-document-candidate' },
    lengthUnit: 'mm', angleUnit: 'rad', sourceFrame: 'authored-xyz-no-axis-conversion', sourceAssetCount, nativeObjectCount,
    preserved: canonical ? ['original-input-file-text', 'all-authored-document-fields-and-identities', 'exact-source0-text',
      'native-geometry-ids-order-coefficients-knots-weights-and-signed-zero', 'authored-frame-and-units']
      : ['original-input-file-text', 'exact-source0-text', 'native-geometry-ids-order-coefficients-knots-weights-and-signed-zero', 'authored-frame-and-mm'],
    transformed: action === 'inspect' ? [] : action === 'identity' ? ['canonical-document-wire-formatting-only']
      : ['new-explicit-document-asset-body-metadata', 'canonical-document-wire-serialization'],
    unsupported: ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'brep-topology',
      'editor-project-or-scene-conversion', 'native-source1-or-source2-conversion'], compatibilityMatrix: matrix(),
    geometryAuthority: 'original-authored-source-text', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { originalInputTextRetained: true, sourceTextPreserved: true, nativeGeometryBitsPreserved: true,
      nativeGeometryIdsUnchanged: true, frameUnitsUnchanged: true, canonicalReader: 'actual-strict-document-v1-codec',
      nativeCompiler: 'actual-source0-compiler', candidateReplacement: 'caller-owned-not-applied', olderReadersAdopted: false,
      manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-original-input-and-prior-candidate-retained',
    limits: { maximumSourceBytes: 262144, maximumSourceCodeUnits: 262144, maximumFileBytes: 2097152,
      maximumFileCodeUnits: 2097152, maximumAssets: 4, maximumBodies: 16,
      inputValues: 524288, inputDepth: 32, inputArrayElements: 4096, inputRecordFields: 64,
      snapshotValues: 524288, snapshotDepth: 32, arrayElements: 4096, recordFields: 64, stringCharacters: 2097152,
      authoredIdCharacters: 48, geometryIdCharacters: 128, nameBytes: 128, maximumRevision: 2147483647 } };
}

/** Inspect only an explicitly named, actually validated supported input format. */
export function inspectCadDocumentCompatibility(input: CadDocumentCompatibilityInput): CadDocumentCompatibilityReport {
  return snapshot(report(load(input), 'inspect'), true) as CadDocumentCompatibilityReport;
}
function options(input: CadDocumentMigrationOptions, format: string): CadDocumentMigrationOptions {
  const copied = snapshot(input);
  check(copied !== null && typeof copied === 'object' && !Array.isArray(copied), CODE.INPUT, 'migration options record required');
  const mode = (copied as Record<string, unknown>).mode;
  if (mode === 'identity') {
    record(copied, ['mode']); check(format === 'canonical-document-v1', CODE.FORMAT, 'identity mode requires current canonical document input');
    return { mode: 'identity' };
  }
  check(mode === 'source0-wrap' && format === 'native-source0', CODE.FORMAT, 'source0-wrap mode requires original native-source0 input');
  const o = record(copied, ['mode', 'documentId', 'revision', 'assetId', 'assetRevision', 'sourceFrame', 'bodies']);
  check(Array.isArray(o.bodies) && o.bodies.length >= 1 && o.bodies.length <= 16, CODE.BUDGET, '1..16 explicit caller-owned bodies required');
  for (const body of o.bodies) record(body, ['id', 'name', 'geometryId']);
  return o as unknown as CadDocumentMigrationOptions;
}
/** Return a fully recompiled candidate; the caller retains its original file and replacement decision. */
export function migrateCadDocument(input: CadDocumentCompatibilityInput, optionInput: CadDocumentMigrationOptions): CadDocumentMigrationResult {
  const loaded = load(input), migrationOptions = options(optionInput, loaded.input.format);
  let candidate: CadDocumentResult;
  if (migrationOptions.mode === 'identity') candidate = loaded.document!;
  else {
    const o = migrationOptions;
    candidate = native(() => createCadDocument({ schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
      documentId: o.documentId, revision: o.revision, units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion',
      assets: [{ id: o.assetId, revision: o.assetRevision, role: 'authored-native-source', sourceVersion: 0,
        sourceFrame: o.sourceFrame, source: loaded.input.text }],
      bodies: o.bodies.map(body => ({ id: body.id, name: body.name, kind: 'direct-geometry-object', assetId: o.assetId, geometryId: body.geometryId })),
      features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] }), 'actual caller-owned source0 document wrapper');
    check(same(candidate.compiledAssets[0].model, loaded.model) && candidate.compiledAssets[0].source === loaded.input.text,
      CODE.SOURCE, 'source0 wrapper changed original text/native Model/geometry coefficient bits');
  }
  native(() => validateCadDocumentResult(candidate), 'actual complete candidate source-backed validation');
  const serializedCandidate = native(() => serializeCadDocument(candidate.document), 'actual authored fourteen-field candidate serializer');
  const fresh = native(() => parseCadDocument(serializedCandidate), 'fresh strict candidate reader and native recompilation');
  check(same(fresh, candidate), CODE.SOURCE, 'serialized/reopened candidate authored/native/report bits mismatch');
  const mappings: CadDocumentMigrationMapping[] = candidate.bodyBindings.map(binding => ({ bodyId: binding.bodyId, assetId: binding.assetId,
    inputGeometryId: binding.geometryId, outputGeometryId: binding.geometryId, geometryKind: binding.geometryKind }));
  return snapshot({ input: loaded.input, options: migrationOptions, candidate, serializedCandidate,
    report: report(loaded, migrationOptions.mode), mappings }, true) as CadDocumentMigrationResult;
}
/** Rebuild the entire original-input/options/candidate/file/native-mapping/report result. */
export function validateCadDocumentMigration(input: CadDocumentMigrationResult): CadDocumentCompatibilityReport {
  const owned = snapshot(input, true) as CadDocumentMigrationResult;
  record(owned, ['input', 'options', 'candidate', 'serializedCandidate', 'report', 'mappings'], CODE.OWNED);
  let expected: CadDocumentMigrationResult;
  try { expected = migrateCadDocument(owned.input, owned.options); } catch (cause) {
    throw new CadDocumentCompatibilityError(CODE.OWNED, 'owned input/options complete candidate rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original input/options/candidate/source/native mappings/serialized document/report mismatch');
  return copyCadData(expected.report);
}
