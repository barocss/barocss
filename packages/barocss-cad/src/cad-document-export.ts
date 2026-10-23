import { createCadDocument, validateCadDocumentResult } from './cad-document.js';
import type { CadDocumentResult } from './cad-document.js';
import { resolveCadGeometryReference, CadReferenceError } from './cad-document-reference.js';
import type { CadGeometryReferenceV0 } from './cad-document-reference.js';
import { exportIGES } from './io/iges.js';
import type { IGESExportReport } from './io/iges.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model } from './types.js';
import { same } from './structural-equality.js';

export const CadDocumentExportDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', TARGET: 'TARGET', REFERENCE: 'REFERENCE', IDENTITY: 'IDENTITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CadDocumentExportDiagnosticCode = typeof CadDocumentExportDiagnosticCode[keyof typeof CadDocumentExportDiagnosticCode];
export class CadDocumentExportError extends Error {
  readonly code: CadDocumentExportDiagnosticCode;
  constructor(code: CadDocumentExportDiagnosticCode, detail: string, cause?: unknown) {
    super(('CAD document export: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadDocumentExportError'; this.code = code;
  }
}
export interface CadDocumentExportCapability {
  target: 'iges-5.3-ascii' | 'glb-derived-display' | 'step';
  status: 'supported-canonical-document-writer' | 'external-derived-bridge-only' | 'unsupported';
  ownerModule: '@barocss/cad' | '@barocss/cad-interop' | null; writerApis: string[];
  canonicalDocumentWriter: boolean; inputProfile: string; outputRole: string; entityProfile: string | null;
  outputLengthUnit: 'mm' | 'm' | null; frameContract: string; approximate: boolean | null;
  nativeSourceIncluded: false; topologyCertified: false; solidCertified: false; note: string;
}
export interface CadDocumentExportSelection { reference: CadGeometryReferenceV0; outputId: string }
export interface CadDocumentExportOptions {
  target: 'iges-5.3-ascii'; exportModelId: string; selections: CadDocumentExportSelection[];
}
export interface CadDocumentExportMapping {
  selectionIndex: number; reference: CadGeometryReferenceV0; outputId: string; geometryKind: 'curve' | 'surface';
  entity: 126 | 128; directoryPointer: number; parameterPointer: number; parameterRecords: number;
  domainU: [number, number]; domainV: [number, number] | null;
  directoryLabel: string; labelTruncated: boolean; labelCollisionOutputIds: string[];
  signedZeroOccurrences: number; signedZeroParameterOccurrences: number;
}
export interface CadDocumentExportReport {
  schema: 'barocss-cad-document-export-report'; version: 0; documentVersion: 1; sourceVersion: 0;
  documentId: string; documentRevision: number; documentProfile: 'direct-geometry'; target: 'iges-5.3-ascii';
  format: 'IGES 5.3 ASCII'; outputRole: 'native-geometry-exchange'; profile: '126-128'; exportModelId: string;
  lengthUnit: 'mm'; frame: 'raw-authored-xyz-no-axis-conversion'; sourceFrame: 'authored-xyz-no-axis-conversion'; modelScale: 1;
  selectedObjectCount: number; outputBytes: number; selectedReferences: CadGeometryReferenceV0[]; mappings: CadDocumentExportMapping[];
  signedZeroNormalization: { policy: 'negative-zero-to-positive-zero-in-iges-numeric-fields';
    nativeOccurrences: number; parameterOccurrences: number; originalNativeBitsPreserved: true };
  directoryLabels: { maximumCharacters: 8; truncatedCount: number;
    collisions: { directoryLabel: string; outputIds: string[] }[]; fullIdentity: 'qualified-reference-and-explicit-output-id-sidecar-required' };
  preserved: string[]; omitted: string[]; unselectedBodyIds: string[]; unsupported: string[];
  capabilities: CadDocumentExportCapability[]; geometryAuthority: 'original-authored-native-source-text';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { nativeSourceIncluded: false; nonzeroBinary64CoefficientsPreserved: true; nativeCoefficientOrderAndDomainsPreserved: true;
    surfaceSerializationOrder: 'iges-u-fastest-v-outer-native-grid-indices-preserved';
    axisConversion: 'none'; unitConversion: 'none'; meshing: 'none'; approximation: 'none';
    outputIdAssignment: 'explicit-derived-copy-only'; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false;
    originalDocumentRetained: true; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-original-document-and-prior-output-retained';
  limits: { maximumSelections: 16; maximumOutputBytes: 2097152; recordColumns: 80; recordTerminator: 'LF';
    documentValues: 524288; documentDepth: 32; documentArrayElements: 4096; documentRecordFields: 64; documentStringCharacters: 2097152;
    optionValues: 32768; optionDepth: 12; optionArrayElements: 64; optionRecordFields: 16; optionStringCharacters: 128;
    snapshotValues: 2097152; snapshotDepth: 40; arrayElements: 4096; recordFields: 64; stringCharacters: 2097152;
    sourceStringCharacters: 262144; nativeGeometryIdCharacters: 128; outputIdCharacters: 48 };
}
export interface CadDocumentExportResult {
  document: CadDocumentResult; options: CadDocumentExportOptions; iges: string;
  writerReport: IGESExportReport; report: CadDocumentExportReport;
}

const CODE = CadDocumentExportDiagnosticCode;
const OUTPUT_LIMIT = 2097152;
function check(condition: boolean, code: CadDocumentExportDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CadDocumentExportError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CadDocumentExportDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadDocumentExportError) throw cause;
    const actualCode = cause instanceof CadReferenceError ? cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE : code;
    throw new CadDocumentExportError(actualCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, mode: 'document' | 'options' | 'result'): unknown {
  const owned = mode === 'result', options = mode === 'options', code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = options ? 32768 : owned ? 2097152 : 524288;
  const depthLimit = options ? 12 : owned ? 40 : 32, arrayLimit = options ? 64 : 4096;
  const fieldLimit = options ? 16 : 64, stringLimit = options ? 128 : OUTPUT_LIMIT;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= depthLimit, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= stringLimit, code, 'own string budget exceeded'); return value; }
    check(typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? arrayLimit + 1 : fieldLimit), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= arrayLimit && keys.length === length + 1,
        code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: CadDocumentExportDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'explicit ASCII output ID1..48 required');
  return value;
}

/** Capabilities of the current document writer and explicitly separate existing bridge ownership. */
export function getCadDocumentExportCapabilities(): CadDocumentExportCapability[] {
  return [
    { target: 'iges-5.3-ascii', status: 'supported-canonical-document-writer', ownerModule: '@barocss/cad', writerApis: ['exportIGES'],
      canonicalDocumentWriter: true, inputProfile: 'canonical-document-v1/direct-geometry/source0', outputRole: 'native-geometry-exchange',
      entityProfile: '126-128', outputLengthUnit: 'mm', frameContract: 'raw-authored-xyz-no-axis-conversion', approximate: false,
      nativeSourceIncluded: false, topologyCertified: false, solidCertified: false,
      note: 'native Curve126/Surface128 only; retain authored source and qualified full-ID sidecar' },
    { target: 'glb-derived-display', status: 'external-derived-bridge-only', ownerModule: '@barocss/cad-interop',
      writerApis: ['encodeCadPreviewGlb', 'encodeOwnNativeFaceMeshGlb'], canonicalDocumentWriter: false,
      inputProfile: 'explicit-preview-packet0-or-own-native-face-mesh', outputRole: 'derived-display-mesh', entityProfile: null,
      outputLengthUnit: 'm', frameContract: 'explicit-existing-packet-and-native-face-frame-contract-no-implicit-retag', approximate: true,
      nativeSourceIncluded: false, topologyCertified: false, solidCertified: false,
      note: 'external bridge APIs require their own inputs and frames; this API does not write a canonical document to GLB' },
    { target: 'step', status: 'unsupported', ownerModule: null, writerApis: [], canonicalDocumentWriter: false,
      inputProfile: 'unsupported', outputRole: 'unsupported-exchange', entityProfile: null, outputLengthUnit: null,
      frameContract: 'unsupported', approximate: null, nativeSourceIncluded: false, topologyCertified: false, solidCertified: false,
      note: 'no general STEP document writer in this API; separate research is not exporter adoption' },
  ];
}
function zeroCount(values: number[]): number { return values.reduce((sum, value) => sum + (Object.is(value, -0) ? 1 : 0), 0); }
function geometryZeroCount(geometry: Curve | Surface): number {
  return geometry.kind === 'curve' ? zeroCount([...geometry.knots, ...geometry.weights, ...geometry.controlPoints.flat()])
    : zeroCount([...geometry.knotsU, ...geometry.knotsV, ...geometry.weights.flat(), ...geometry.controlPoints.flat(2)]);
}
function stage(documentInput: CadDocumentResult, optionInput: CadDocumentExportOptions): CadDocumentExportResult {
  const ownedDocument = snapshot(documentInput, 'document') as CadDocumentResult;
  const o = record(snapshot(optionInput, 'options'), ['target', 'exportModelId', 'selections']);
  check(o.target === 'iges-5.3-ascii', CODE.TARGET, 'only native IGES5.3 ASCII is a supported canonical-document target');
  const exportModelId = id(o.exportModelId);
  check(Array.isArray(o.selections) && o.selections.length >= 1 && o.selections.length <= 16,
    CODE.BUDGET, '1..16 explicit current geometry selections required');
  const selections: CadDocumentExportSelection[] = o.selections.map(value => {
    const s = record(value, ['reference', 'outputId']);
    return { reference: s.reference as CadGeometryReferenceV0, outputId: id(s.outputId) };
  });
  check(new Set([exportModelId, ...selections.map(selection => selection.outputId)]).size === selections.length + 1,
    CODE.IDENTITY, 'all derived model/geometry output IDs must be distinct');
  native(() => validateCadDocumentResult(ownedDocument), 'actual source-backed original document validation', CODE.OWNED);
  const document = native(() => createCadDocument(ownedDocument.document), 'actual original document source0 reconstruction');
  const selectedBodies = new Set<string>(), originals: (Curve | Surface)[] = [], objects: (Curve | Surface)[] = [];
  const actualSelections: CadDocumentExportSelection[] = selections.map(selection => {
    const resolved = native(() => resolveCadGeometryReference(document, selection.reference), 'exact current qualified geometry reference');
    check(!selectedBodies.has(resolved.reference.bodyId), CODE.REFERENCE, 'duplicate current body selection');
    selectedBodies.add(resolved.reference.bodyId); originals.push(resolved.geometry);
    const output = copyCadData(resolved.geometry); output.id = selection.outputId; objects.push(output);
    return { reference: resolved.reference, outputId: selection.outputId };
  });
  const options: CadDocumentExportOptions = { target: 'iges-5.3-ascii', exportModelId, selections: actualSelections };
  const exportModel: Model = { name: exportModelId, version: 0, lengthUnit: 'mm', objects };
  const written = native(() => exportIGES(exportModel, actualSelections.map(selection => selection.outputId)), 'actual existing native IGES writer');
  check(written.iges.length <= OUTPUT_LIMIT, CODE.BUDGET, 'ASCII output exceeds2MiB');
  check(written.iges.length % 81 === 0, CODE.BINDING, 'actual output must contain80-column records plusLF');
  for (let i = 0; i < written.iges.length; i++) {
    const character = written.iges.charCodeAt(i);
    check(i % 81 === 80 ? character === 10 : character >= 0x20 && character <= 0x7e,
      CODE.BINDING, 'actual output record width/ASCII/LF contract differs');
  }
  check(written.report.objects.length === actualSelections.length && written.report.model === exportModelId
    && written.report.lengthUnit === 'mm' && written.report.modelScale === 1, CODE.BINDING, 'actual writer selection/model/unit report differs');
  const mappings: CadDocumentExportMapping[] = written.report.objects.map((object, index) => {
    const selection = actualSelections[index], original = originals[index], signedZeroOccurrences = geometryZeroCount(original);
    const domainU: [number, number] = original.kind === 'curve'
      ? [original.knots[original.degree], original.knots[original.controlPoints.length]]
      : [original.knotsU[original.degreeU], original.knotsU[original.controlPoints.length]];
    const domainV: [number, number] | null = original.kind === 'curve' ? null
      : [original.knotsV[original.degreeV], original.knotsV[original.controlPoints[0].length]];
    check(object.id === selection.outputId && object.entity === (original.kind === 'curve' ? 126 : 128)
      && same(object.domainU, domainU) && same(object.domainV ?? null, domainV)
      && object.directoryLabel === selection.outputId.slice(0, 8), CODE.BINDING, 'actual writer ID/entity/domain/label mapping differs');
    return { selectionIndex: index, reference: selection.reference, outputId: object.id, geometryKind: original.kind,
      entity: object.entity, directoryPointer: object.directoryPointer, parameterPointer: object.parameterPointer,
      parameterRecords: object.parameterRecords, domainU, domainV, directoryLabel: object.directoryLabel,
      labelTruncated: object.id.length > 8,
      labelCollisionOutputIds: written.report.objects.filter((other, otherIndex) => otherIndex !== index
        && other.directoryLabel === object.directoryLabel).map(other => other.id),
      signedZeroOccurrences, signedZeroParameterOccurrences: signedZeroOccurrences + zeroCount(domainU) + zeroCount(domainV ?? []) };
  });
  const collisions: CadDocumentExportReport['directoryLabels']['collisions'] = [];
  for (const mapping of mappings) if (mapping.labelCollisionOutputIds.length > 0
    && !collisions.some(collision => collision.directoryLabel === mapping.directoryLabel))
    collisions.push({ directoryLabel: mapping.directoryLabel,
      outputIds: mappings.filter(other => other.directoryLabel === mapping.directoryLabel).map(other => other.outputId) });
  const report: CadDocumentExportReport = {
    schema: 'barocss-cad-document-export-report', version: 0, documentVersion: 1, sourceVersion: 0,
    documentId: document.document.documentId, documentRevision: document.document.revision, documentProfile: 'direct-geometry',
    target: 'iges-5.3-ascii', format: 'IGES 5.3 ASCII', outputRole: 'native-geometry-exchange', profile: '126-128', exportModelId,
    lengthUnit: 'mm', frame: 'raw-authored-xyz-no-axis-conversion', sourceFrame: 'authored-xyz-no-axis-conversion', modelScale: 1,
    selectedObjectCount: actualSelections.length, outputBytes: written.iges.length,
    selectedReferences: actualSelections.map(selection => selection.reference), mappings,
    signedZeroNormalization: { policy: 'negative-zero-to-positive-zero-in-iges-numeric-fields',
      nativeOccurrences: mappings.reduce((sum, mapping) => sum + mapping.signedZeroOccurrences, 0),
      parameterOccurrences: mappings.reduce((sum, mapping) => sum + mapping.signedZeroParameterOccurrences, 0), originalNativeBitsPreserved: true },
    directoryLabels: { maximumCharacters: 8, truncatedCount: mappings.filter(mapping => mapping.labelTruncated).length,
      collisions, fullIdentity: 'qualified-reference-and-explicit-output-id-sidecar-required' },
    preserved: ['selected-nonzero-native-coefficients', 'native-knot-order-curve-pole-order-surface-grid-indices-and-parameter-domains', 'raw-authored-xyz-and-mm',
      'caller-selection-order'],
    omitted: ['original-document-id-and-revision', 'original-body-ids-and-names', 'original-asset-ids-and-revisions',
      'original-native-source-text-and-source-dialect', 'original-authored-frame-label-and-angle-unit-declaration',
      'full-qualified-native-geometry-identities', 'unselected-bodies-and-objects'],
    unselectedBodyIds: document.document.bodies.filter(body => !selectedBodies.has(body.id)).map(body => body.id),
    unsupported: ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'topology', 'solid-models', 'authoring-history'],
    capabilities: getCadDocumentExportCapabilities(), geometryAuthority: 'original-authored-native-source-text',
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { nativeSourceIncluded: false, nonzeroBinary64CoefficientsPreserved: true, nativeCoefficientOrderAndDomainsPreserved: true,
      surfaceSerializationOrder: 'iges-u-fastest-v-outer-native-grid-indices-preserved',
      axisConversion: 'none', unitConversion: 'none', meshing: 'none', approximation: 'none', outputIdAssignment: 'explicit-derived-copy-only',
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, originalDocumentRetained: true,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-original-document-and-prior-output-retained',
    limits: { maximumSelections: 16, maximumOutputBytes: 2097152, recordColumns: 80, recordTerminator: 'LF',
      documentValues: 524288, documentDepth: 32, documentArrayElements: 4096, documentRecordFields: 64, documentStringCharacters: 2097152,
      optionValues: 32768, optionDepth: 12, optionArrayElements: 64, optionRecordFields: 16, optionStringCharacters: 128,
      snapshotValues: 2097152, snapshotDepth: 40, arrayElements: 4096, recordFields: 64, stringCharacters: 2097152,
      sourceStringCharacters: 262144, nativeGeometryIdCharacters: 128, outputIdCharacters: 48 },
  };
  return snapshot({ document, options, iges: written.iges, writerReport: written.report, report }, 'result') as CadDocumentExportResult;
}

/** Inspect the exact existing writer's staged report without filesystem writes or document replacement. */
export function inspectCadDocumentExport(document: CadDocumentResult, options: CadDocumentExportOptions): CadDocumentExportReport {
  return copyCadData(stage(document, options).report);
}
/** Export derived-ID copies through the actual existing native writer, retaining the original document. */
export function exportCadDocument(document: CadDocumentResult, options: CadDocumentExportOptions): CadDocumentExportResult {
  return stage(document, options);
}
/** Reconstruct the complete document, exact refs, copies, bytes, native writer report and loss sidecar. */
export function validateCadDocumentExport(input: CadDocumentExportResult): CadDocumentExportReport {
  const owned = snapshot(input, 'result') as CadDocumentExportResult;
  record(owned, ['document', 'options', 'iges', 'writerReport', 'report'], CODE.OWNED);
  let expected: CadDocumentExportResult;
  try { expected = stage(owned.document, owned.options); } catch (cause) {
    throw new CadDocumentExportError(CODE.OWNED, 'owned original document/options complete writer rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned document/reference/output IDs/IGES bytes/writer/mapping/loss report mismatch');
  return copyCadData(expected.report);
}
