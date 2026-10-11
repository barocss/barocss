import {validatePairedSurfaceUVFaceClassification} from '@barocss/cad';
import type {PairedSurfaceUVFaceResult, PairedSurfaceUVFaceReport} from '@barocss/cad';
import {
  PAIRED_SURFACE_UV_FACE_CLASSIFICATION_LIMITS,
  BaroCadPairedSurfaceUVFaceClassificationReadError,
  parsePairedSurfaceUVFaceClassificationJson,
  copyPairedSurfaceUVFaceClassificationOwnData,
} from './paired-surface-uv-face-classification-result-json.js';

// Preserve the measured codec Error and merged runtime/type DiagnosticCode.
export {
  BaroCadPairedSurfaceUVFaceClassificationReadError,
  BaroCadPairedSurfaceUVFaceClassificationDiagnosticCode,
} from './paired-surface-uv-face-classification-result-json.js';

const PROFILE = Object.freeze({
  schema: "barocss-paired-surface-uv-face-classification-result-ingestion",
  version: 0,
  nativeSchema: "barocss-paired-surface-uv-face-classification",
  nativeVersion: 0,
  sourceFrame: "authored-xyz-no-axis-conversion",
  worldLengthUnit: "mm",
  uvLengthUnit: "dimensionless",
  parameterFrame: "original-a-u-v-and-original-b-u-v",
  sourceQualification: "original-a-and-b-source-id-model-object-index-with-full-complementary-parents-retained",
  ownership: "independent-copied-cpu-data-gc",
  membershipScope: "original-complementary-a-and-b-face-windows",
  d1Representation: "parent-face-tagged-intersection-direct-no-new-d1",
  nativeRequestBytes: 8388608,
  limits: PAIRED_SURFACE_UV_FACE_CLASSIFICATION_LIMITS,
  capabilities: Object.freeze({
    nativeWholeValidation: true,
    copiedWholeReceipt: true,
    renderer: false,
    url: false,
    byteInput: false,
    publicSerializer: false,
    dispose: false,
    sourceEdit: false,
    sampling: false,
    intersectionConstruction: false,
    isoCurveConstruction: false,
    intervalExtraction: false,
    faceConstruction: false,
    worldPointMembership: false,
    topologyConstruction: false,
    body: false,
    solid: false,
    globalError: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
  } as const),
} as const);

/** Complete original-UV receipt and a separate actual whole-validation Report. */
export interface BaroCadPairedSurfaceUVFaceClassificationResultRead {
  native: PairedSurfaceUVFaceResult;
  validationReport: PairedSurfaceUVFaceReport;
  /** Frozen metadata only; native data and Report remain independently mutable. */
  profile: typeof PROFILE;
  /** Entire admitted text, unchanged; null for own-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Narrow the complete native packet after the descriptor-safe whole copy. */
function requireNativeSchema(value: unknown): asserts value is PairedSurfaceUVFaceResult {
  const fields = ['request', 'classifications', 'proof', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadPairedSurfaceUVFaceClassificationReadError(
      'SCHEMA', 'A complete paired Surface UV Face classification result record with the exact four fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || !Object.hasOwn(report, 'schema') || !Object.hasOwn(report, 'version') ||
      report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadPairedSurfaceUVFaceClassificationReadError(
      'SCHEMA', 'The native paired Surface UV Face classification report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadPairedSurfaceUVFaceClassificationResultRead {
  const native = copyPairedSurfaceUVFaceClassificationOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: PairedSurfaceUVFaceReport;
  try {
    actualReport = validatePairedSurfaceUVFaceClassification(native);
  } catch (cause) {
    throw new BaroCadPairedSurfaceUVFaceClassificationReadError(
      'NATIVE', 'Whole native paired Surface UV Face classification validation refused the copied data', cause);
  }
  // Keep report copying outside the native catch: direct codec codes and causes propagate.
  const validationReport = copyPairedSurfaceUVFaceClassificationOwnData(actualReport).value as PairedSurfaceUVFaceReport;
  return {native, validationReport, profile: PROFILE, sourceText};
}

/** Read the full saved receipt without an additional direct classifier or sampler call. */
export function parseBaroCadPairedSurfaceUVFaceClassificationResult(text: string): BaroCadPairedSurfaceUVFaceClassificationResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadPairedSurfaceUVFaceClassificationReadError(
      'INPUT', 'Paired Surface UV Face classification result text must be a string');
  }
  return admit(parsePairedSurfaceUVFaceClassificationJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied result on each call. */
export function readBaroCadPairedSurfaceUVFaceClassificationResult(input: unknown): BaroCadPairedSurfaceUVFaceClassificationResultRead {
  if (!isRecord(input)) {
    throw new BaroCadPairedSurfaceUVFaceClassificationReadError(
      'INPUT', 'Paired Surface UV Face classification result owned data must be a record');
  }
  return admit(input, null);
}
