import { compileCadModel } from './model-compiler.js';
import { copyCadData } from './data-copy.js';
import type { Model } from './types.js';

export const CadDocumentDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', PROFILE: 'PROFILE', IDENTITY: 'IDENTITY', REFERENCE: 'REFERENCE',
  SOURCE: 'SOURCE', FRAME: 'FRAME', BUDGET: 'BUDGET', JSON: 'JSON', OWNED: 'OWNED',
} as const);
export type CadDocumentDiagnosticCode = typeof CadDocumentDiagnosticCode[keyof typeof CadDocumentDiagnosticCode];
export class CadDocumentError extends Error {
  readonly code: CadDocumentDiagnosticCode;
  constructor(code: CadDocumentDiagnosticCode, detail: string, cause?: unknown) {
    super(('CAD document: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadDocumentError';
    this.code = code;
  }
}
export interface CadDocumentUnits { length: 'mm'; angle: 'rad' }
export interface CadDocumentSourceAsset {
  id: string; revision: number; role: 'authored-native-source'; sourceVersion: 0;
  sourceFrame: 'authored-xyz-no-axis-conversion'; source: string;
}
export interface CadDocumentBody {
  id: string; name: string; kind: 'direct-geometry-object'; assetId: string; geometryId: string;
}
export interface CadDocumentV1 {
  schema: 'barocss-cad-document'; version: 1; profile: 'direct-geometry'; documentId: string; revision: number;
  units: CadDocumentUnits; nativeFrame: 'authored-xyz-no-axis-conversion';
  assets: CadDocumentSourceAsset[]; bodies: CadDocumentBody[];
  features: []; parameters: []; constraints: []; placements: []; derivedCaches: [];
}
export interface CadDocumentCompiledAsset { assetId: string; sourceVersion: 0; source: string; model: Model }
export interface CadDocumentBodyBinding { bodyId: string; assetId: string; geometryId: string; geometryKind: 'curve' | 'surface' }
export interface CadDocumentReport {
  schema: 'barocss-cad-document-report'; version: 0; fileVersion: 1; profile: 'direct-geometry'; sourceVersion: 0;
  units: CadDocumentUnits; nativeFrame: 'authored-xyz-no-axis-conversion'; documentId: string; revision: number;
  assetCount: number; bodyCount: number; nativeObjectCount: number; aggregateSourceBytes: number;
  supportedDomains: ['document-identity-revision', 'authored-native-source0-assets', 'qualified-direct-geometry-object-bodies'];
  unsupportedDomains: ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'brep-topology'];
  geometryAuthority: 'authored-native-source-text'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { sourceTextPreserved: true; sourceNumericBitsRemainInText: true; nativeModels: 'actual-source0-compiler-derived-only';
    referenceSemantics: 'geometry-id-qualified-by-asset-id'; bodySemantics: 'native-object-reference-not-solid-certificate';
    frameSemantics: 'authored-xyz-no-axis-conversion'; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  limits: { maximumAssets: 4; maximumBodies: 16; maximumRevision: 2147483647;
    maximumSourceBytes: 262144; maximumSourceCodeUnits: 262144; maximumAggregateSourceBytes: 1048576;
    maximumFileBytes: 2097152; maximumFileCodeUnits: 2097152;
    inputValues: 65536; inputDepth: 12; inputArrayElements: 64; inputRecordFields: 16;
    snapshotValues: 262144; snapshotDepth: 24; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144;
    authoredIdCharacters: 48; geometryIdCharacters: 128; nameBytes: 128 };
}
export interface CadDocumentResult {
  document: CadDocumentV1; compiledAssets: CadDocumentCompiledAsset[];
  bodyBindings: CadDocumentBodyBinding[]; report: CadDocumentReport;
}

const CODE = CadDocumentDiagnosticCode;
const SOURCE_LIMIT = 262144, AGGREGATE_SOURCE_LIMIT = 1048576, FILE_LIMIT = 2097152;
function check(condition: boolean, code: CadDocumentDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CadDocumentError(code, detail);
}
function operation<T>(action: () => T, code: CadDocumentDiagnosticCode, detail: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadDocumentError) throw cause;
    throw new CadDocumentError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'operation refused'), cause);
  }
}
/** Count UTF-8 bytes without replacing an unpaired UTF-16 surrogate. */
function utf8Bytes(text: string, code: CadDocumentDiagnosticCode): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 0x80) bytes++;
    else if (value < 0x800) bytes += 2;
    else if (value >= 0xd800 && value <= 0xdbff) {
      const next = text.charCodeAt(++i);
      check(next >= 0xdc00 && next <= 0xdfff, code, 'unpaired Unicode surrogate refused');
      bytes += 4;
    } else {
      check(value < 0xdc00 || value > 0xdfff, code, 'unpaired Unicode surrogate refused');
      bytes += 3;
    }
  }
  return bytes;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 262144 : 65536;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 24 : 12), code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= SOURCE_LIMIT, code, 'own string code-unit budget exceeded'); return value; }
    check(typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? (owned ? 4097 : 65) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 64)
        && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return operation(() => copy(input, 0), code, 'own data snapshot');
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII ID1..' + maximum + ' required');
  return value;
}
function revision(value: unknown): number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647 && !Object.is(value, -0),
    CODE.IDENTITY, 'unsigned revision0..2147483647 required; signed zero refused');
  return value;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
  }
  return Object.is(a, b);
}

/** Adopt authored source text and derive native Models and asset-qualified body bindings. */
export function createCadDocument(documentInput: CadDocumentV1): CadDocumentResult {
  const d = record(snapshot(documentInput), ['schema', 'version', 'profile', 'documentId', 'revision', 'units', 'nativeFrame',
    'assets', 'bodies', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches']);
  check(d.schema === 'barocss-cad-document' && d.version === 1, CODE.VERSION, 'barocss-cad-document file version1 required');
  check(d.profile === 'direct-geometry', CODE.PROFILE, 'only direct-geometry profile is supported');
  const documentId = id(d.documentId), documentRevision = revision(d.revision);
  const u = record(d.units, ['length', 'angle']);
  check(u.length === 'mm' && u.angle === 'rad', CODE.FRAME, 'explicit length:mm and angle:rad required');
  check(d.nativeFrame === 'authored-xyz-no-axis-conversion', CODE.FRAME, 'only authored XYZ with no axis conversion is supported');
  for (const field of ['features', 'parameters', 'constraints', 'placements', 'derivedCaches'])
    check(Array.isArray(d[field]) && d[field].length === 0, CODE.PROFILE, field + ' must remain empty in direct-geometry profile');
  check(Array.isArray(d.assets) && d.assets.length >= 1 && d.assets.length <= 4, CODE.BUDGET, '1..4 authored source assets required');
  check(Array.isArray(d.bodies) && d.bodies.length >= 1 && d.bodies.length <= 16, CODE.BUDGET, '1..16 direct geometry bodies required');
  const assetIds = new Set<string>();
  let aggregateSourceBytes = 0;
  const assets: CadDocumentSourceAsset[] = d.assets.map(value => {
    const a = record(value, ['id', 'revision', 'role', 'sourceVersion', 'sourceFrame', 'source']);
    const assetId = id(a.id), assetRevision = revision(a.revision);
    check(!assetIds.has(assetId), CODE.IDENTITY, 'duplicate asset ID'); assetIds.add(assetId);
    check(a.role === 'authored-native-source', CODE.PROFILE, 'asset must be authored native source, not computed/display data');
    check(a.sourceVersion === 0, CODE.VERSION, 'asset sourceVersion0 required');
    check(a.sourceFrame === 'authored-xyz-no-axis-conversion', CODE.FRAME, 'asset source frame must be authored XYZ without conversion');
    check(typeof a.source === 'string', CODE.SOURCE, 'original source text required');
    check(a.source.length <= SOURCE_LIMIT, CODE.BUDGET, 'individual source code-unit budget exceeded');
    const bytes = utf8Bytes(a.source, CODE.SOURCE);
    check(bytes <= SOURCE_LIMIT, CODE.BUDGET, 'individual source UTF-8 byte budget exceeded');
    aggregateSourceBytes += bytes;
    check(aggregateSourceBytes <= AGGREGATE_SOURCE_LIMIT, CODE.BUDGET, 'aggregate source UTF-8 byte budget exceeded');
    return { id: assetId, revision: assetRevision, role: 'authored-native-source', sourceVersion: 0,
      sourceFrame: 'authored-xyz-no-axis-conversion', source: a.source };
  });
  const bodyIds = new Set<string>(), ownedGeometry = new Set<string>(), referencedAssets = new Set<string>();
  const bodies: CadDocumentBody[] = d.bodies.map(value => {
    const b = record(value, ['id', 'name', 'kind', 'assetId', 'geometryId']);
    const bodyId = id(b.id), assetId = id(b.assetId), geometryId = id(b.geometryId, 128);
    check(!bodyIds.has(bodyId), CODE.IDENTITY, 'duplicate body ID'); bodyIds.add(bodyId);
    check(typeof b.name === 'string' && b.name.length > 0 && utf8Bytes(b.name, CODE.INPUT) <= 128, CODE.INPUT, 'body name1..128 UTF-8 bytes required');
    check(b.kind === 'direct-geometry-object', CODE.PROFILE, 'body must reference one direct native object');
    check(assetIds.has(assetId), CODE.REFERENCE, 'body references missing asset');
    const ownership = assetId + '\0' + geometryId;
    check(!ownedGeometry.has(ownership), CODE.REFERENCE, 'duplicate asset-qualified geometry ownership');
    ownedGeometry.add(ownership); referencedAssets.add(assetId);
    return { id: bodyId, name: b.name, kind: 'direct-geometry-object', assetId, geometryId };
  });
  check(assets.every(asset => referencedAssets.has(asset.id)), CODE.REFERENCE, 'every source asset must have a body reference');
  const compiledAssets: CadDocumentCompiledAsset[] = assets.map(asset => {
    const compiled = operation(() => compileCadModel(asset.source, { sourceVersion: 0 }), CODE.SOURCE, 'actual source0 compilation');
    if (!compiled.ok) throw new CadDocumentError(CODE.SOURCE, 'authored source0 compilation refused for asset ' + asset.id, compiled);
    check(compiled.model.version === 0 && compiled.model.lengthUnit === 'mm', CODE.SOURCE, 'actual native Model0/mm required');
    return { assetId: asset.id, sourceVersion: 0, source: asset.source, model: compiled.model };
  });
  const bodyBindings: CadDocumentBodyBinding[] = bodies.map(body => {
    const asset = compiledAssets.find(value => value.assetId === body.assetId);
    const geometry = asset?.model.objects.find(value => value.id === body.geometryId);
    check(geometry !== undefined && (geometry.kind === 'curve' || geometry.kind === 'surface'), CODE.REFERENCE,
      'body references missing native Curve/Surface in qualified asset');
    return { bodyId: body.id, assetId: body.assetId, geometryId: body.geometryId, geometryKind: geometry.kind };
  });
  const document: CadDocumentV1 = { schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId,
    revision: documentRevision, units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion',
    assets, bodies, features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] };
  const report: CadDocumentReport = {
    schema: 'barocss-cad-document-report', version: 0, fileVersion: 1, profile: 'direct-geometry', sourceVersion: 0,
    units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion', documentId, revision: documentRevision,
    assetCount: assets.length, bodyCount: bodies.length, nativeObjectCount: compiledAssets.reduce((sum, asset) => sum + asset.model.objects.length, 0),
    aggregateSourceBytes, supportedDomains: ['document-identity-revision', 'authored-native-source0-assets', 'qualified-direct-geometry-object-bodies'],
    unsupportedDomains: ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'brep-topology'],
    geometryAuthority: 'authored-native-source-text', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { sourceTextPreserved: true, sourceNumericBitsRemainInText: true, nativeModels: 'actual-source0-compiler-derived-only',
      referenceSemantics: 'geometry-id-qualified-by-asset-id', bodySemantics: 'native-object-reference-not-solid-certificate',
      frameSemantics: 'authored-xyz-no-axis-conversion', globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    limits: { maximumAssets: 4, maximumBodies: 16, maximumRevision: 2147483647,
      maximumSourceBytes: 262144, maximumSourceCodeUnits: 262144, maximumAggregateSourceBytes: 1048576,
      maximumFileBytes: 2097152, maximumFileCodeUnits: 2097152,
      inputValues: 65536, inputDepth: 12, inputArrayElements: 64, inputRecordFields: 16,
      snapshotValues: 262144, snapshotDepth: 24, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144,
      authoredIdCharacters: 48, geometryIdCharacters: 128, nameBytes: 128 },
  };
  return snapshot({ document, compiledAssets, bodyBindings, report }, true) as CadDocumentResult;
}

/** Serialize only the fourteen authored wire fields in their declared order. */
export function serializeCadDocument(document: CadDocumentV1): string {
  const accepted = createCadDocument(document);
  const text = operation(() => JSON.stringify(accepted.document, null, 2) + '\n', CODE.JSON, 'canonical authored serialization');
  check(text.length <= FILE_LIMIT && utf8Bytes(text, CODE.JSON) <= FILE_LIMIT, CODE.BUDGET, 'serialized file byte/code-unit budget exceeded');
  return text;
}

/** Bounded JSON grammar. Object keys are checked after decoding, before assignment. */
function parseJson(text: string): unknown {
  let position = 0, remaining = 65536;
  const whitespace = () => { while (position < text.length && /[\t\n\r ]/.test(text[position])) position++; };
  const string = (): string => {
    check(text[position++] === '"', CODE.JSON, 'JSON string required');
    let value = '';
    while (position < text.length) {
      const character = text[position++];
      if (character === '"') { utf8Bytes(value, CODE.JSON); return value; }
      check(character.charCodeAt(0) >= 0x20, CODE.JSON, 'unescaped JSON control character');
      if (character !== '\\') value += character;
      else {
        check(position < text.length, CODE.JSON, 'incomplete JSON escape');
        const escape = text[position++];
        const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (escape === 'u') {
          const hex = text.slice(position, position + 4);
          check(/^[0-9a-fA-F]{4}$/.test(hex), CODE.JSON, 'malformed JSON Unicode escape');
          value += String.fromCharCode(Number.parseInt(hex, 16)); position += 4;
        } else { check(Object.hasOwn(escapes, escape), CODE.JSON, 'unknown JSON escape'); value += escapes[escape]; }
      }
      check(value.length <= SOURCE_LIMIT, CODE.BUDGET, 'decoded JSON string code-unit budget exceeded');
    }
    throw new CadDocumentError(CODE.JSON, 'unterminated JSON string');
  };
  const numberPattern = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const value = (depth: number): unknown => {
    check(--remaining >= 0 && depth <= 12, CODE.BUDGET, 'JSON own-value/depth budget exceeded');
    whitespace();
    const character = text[position];
    if (character === '"') return string();
    if (character === '{') {
      position++; whitespace();
      const entries: [string, unknown][] = [], keys = new Set<string>();
      if (text[position] === '}') { position++; return {}; }
      for (;;) {
        check(entries.length < 16, CODE.BUDGET, 'JSON record field budget exceeded');
        check(text[position] === '"', CODE.JSON, 'JSON object key required');
        const key = string();
        check(key.length <= 128, CODE.BUDGET, 'JSON key character budget exceeded');
        check(!keys.has(key), CODE.JSON, 'duplicate decoded JSON object key'); keys.add(key);
        whitespace(); check(text[position++] === ':', CODE.JSON, 'JSON object colon required');
        entries.push([key, value(depth + 1)]); whitespace();
        const separator = text[position++];
        if (separator === '}') return Object.fromEntries(entries);
        check(separator === ',', CODE.JSON, 'JSON object comma/end required'); whitespace();
      }
    }
    if (character === '[') {
      position++; whitespace();
      const array: unknown[] = [];
      if (text[position] === ']') { position++; return array; }
      for (;;) {
        check(array.length < 64, CODE.BUDGET, 'JSON array element budget exceeded');
        array.push(value(depth + 1)); whitespace();
        const separator = text[position++];
        if (separator === ']') return array;
        check(separator === ',', CODE.JSON, 'JSON array comma/end required');
      }
    }
    for (const [token, result] of [['true', true], ['false', false], ['null', null]] as const)
      if (text.startsWith(token, position)) { position += token.length; return result; }
    numberPattern.lastIndex = position;
    const match = numberPattern.exec(text);
    check(match !== null, CODE.JSON, 'JSON value required');
    position = numberPattern.lastIndex;
    const number = Number(match[0]); check(Number.isFinite(number), CODE.JSON, 'nonfinite JSON number refused');
    if (Number.isInteger(number)) {
      // A fractional literal must not round or underflow into a valid integer revision.
      const [coefficient, exponent = '0'] = match[0].replace(/^-/, '').split(/[eE]/);
      const [whole, fraction = ''] = coefficient.split('.'), digits = whole + fraction;
      const fractionalDigits = fraction.length - Number(exponent);
      check(fractionalDigits <= 0 || !/[1-9]/.test(digits.slice(Math.max(0, digits.length - fractionalDigits))),
        CODE.JSON, 'fractional JSON number rounded into an integer');
    }
    return number;
  };
  const parsed = value(0); whitespace();
  check(position === text.length, CODE.JSON, 'trailing JSON data refused');
  return parsed;
}

/** Parse a new document candidate without rewriting its input text or any prior accepted result. */
export function parseCadDocument(text: string): CadDocumentResult {
  check(typeof text === 'string', CODE.JSON, 'JSON text required');
  check(text.length <= FILE_LIMIT && utf8Bytes(text, CODE.JSON) <= FILE_LIMIT, CODE.BUDGET, 'input file byte/code-unit budget exceeded');
  const parsed = operation(() => parseJson(text), CODE.JSON, 'bounded strict JSON parsing');
  return createCadDocument(parsed as CadDocumentV1);
}

/** Recompile every authoritative asset source and reconstruct all native bindings and report fields. */
export function validateCadDocumentResult(input: CadDocumentResult): CadDocumentReport {
  const owned = snapshot(input, true) as CadDocumentResult;
  check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED, 'owned CAD document result required');
  let expected: CadDocumentResult;
  try { expected = createCadDocument(owned.document); } catch (cause) {
    throw new CadDocumentError(CODE.OWNED, 'owned authored document deterministic rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned authored source/native Models/body bindings/report mismatch');
  return copyCadData(expected.report);
}
