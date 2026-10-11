import {validatePairedSurfaceMaterialBody} from '@barocss/cad';
import type {PairedSurfaceMaterialBodyResult, PairedSurfaceMaterialBodyReport} from '@barocss/cad';
import {
  PAIRED_SURFACE_MATERIAL_BODY_LIMITS,
  BaroCadPairedSurfaceMaterialBodyReadError,
  parsePairedSurfaceMaterialBodyJson,
  copyPairedSurfaceMaterialBodyOwnData,
} from './paired-surface-material-body-result-json.js';

// Preserve the measured codec Error and merged runtime/type DiagnosticCode.
export {
  BaroCadPairedSurfaceMaterialBodyReadError,
  BaroCadPairedSurfaceMaterialBodyDiagnosticCode,
} from './paired-surface-material-body-result-json.js';

const PROFILE = Object.freeze({
  schema: "barocss-paired-surface-material-body-result-ingestion",
  version: 0,
  nativeSchema: "barocss-paired-surface-material-body",
  nativeVersion: 0,
  sourceFrame: "authored-xyz-no-axis-conversion",
  worldLengthUnit: "mm",
  uvLengthUnit: "dimensionless",
  parameterFrame: "original-a-u-v-b-u-v-and-material-u-s-t",
  sourceQualification: "six-separate-qualified-face-images-model-8-3-5-with-full-parents-and-closures",
  ownership: "independent-copied-cpu-data-gc",
  d1Representation: "inherited-tagged-and-direct-parent-no-new-body-d1",
  nativeRequestBytes: 8388608,
  limits: PAIRED_SURFACE_MATERIAL_BODY_LIMITS,
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
    directMaterialBodyConstruction: false,
    directSolidCertification: false,
    globalError: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
  } as const),
  geometryScope: "one-paired-curved-material-body-six-exact-qualified-boundary-images",
  volumeUnit: "mm3",
  nativeRestrictedMaterialCertificate: "retained-native-true",
} as const);

/** Complete supplied material Body receipt and a separate whole-validation Report. */
export interface BaroCadPairedSurfaceMaterialBodyResultRead {
  native: PairedSurfaceMaterialBodyResult;
  validationReport: PairedSurfaceMaterialBodyReport;
  /** Frozen metadata only; native data and Report remain independently mutable. */
  profile: typeof PROFILE;
  /** Entire admitted text, unchanged; null for own-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Narrow the whole native packet after the descriptor-safe independent copy. */
function requireNativeSchema(value: unknown): asserts value is PairedSurfaceMaterialBodyResult {
  const fields = ['request', 'closures', 'vertices', 'edges', 'faces', 'shell', 'body', 'proof', 'observations', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadPairedSurfaceMaterialBodyReadError(
      'SCHEMA', 'A complete paired Surface material Body result record with the exact ten fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || !Object.hasOwn(report, 'schema') || !Object.hasOwn(report, 'version') ||
      report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadPairedSurfaceMaterialBodyReadError(
      'SCHEMA', 'The native paired Surface material Body report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadPairedSurfaceMaterialBodyResultRead {
  const native = copyPairedSurfaceMaterialBodyOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: PairedSurfaceMaterialBodyReport;
  try {
    actualReport = validatePairedSurfaceMaterialBody(native);
  } catch (cause) {
    throw new BaroCadPairedSurfaceMaterialBodyReadError(
      'NATIVE', 'Whole native paired Surface material Body validation refused the copied data', cause);
  }
  // Report copying remains outside the native catch: direct codec codes and causes propagate.
  const validationReport = copyPairedSurfaceMaterialBodyOwnData(actualReport).value as PairedSurfaceMaterialBodyReport;
  return {native, validationReport, profile: PROFILE, sourceText};
}

/** Retain the full existing material proof without an additional direct construction call. */
export function parseBaroCadPairedSurfaceMaterialBodyResult(text: string): BaroCadPairedSurfaceMaterialBodyResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadPairedSurfaceMaterialBodyReadError(
      'INPUT', 'Paired Surface material Body result text must be a string');
  }
  return admit(parsePairedSurfaceMaterialBodyJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied result on each call. */
export function readBaroCadPairedSurfaceMaterialBodyResult(input: unknown): BaroCadPairedSurfaceMaterialBodyResultRead {
  if (!isRecord(input)) {
    throw new BaroCadPairedSurfaceMaterialBodyReadError(
      'INPUT', 'Paired Surface material Body result owned data must be a record');
  }
  return admit(input, null);
}
