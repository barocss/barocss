import {validatePairedSurfaceMaterialBodyWorldPointClassification} from '@barocss/cad';
import type {PairedSurfaceMaterialBodyWorldPointResult, PairedSurfaceMaterialBodyWorldPointReport} from '@barocss/cad';
import {
  PAIRED_SURFACE_MATERIAL_BODY_WORLD_POINTS_LIMITS,
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError,
  parsePairedSurfaceMaterialBodyWorldPointsJson,
  copyPairedSurfaceMaterialBodyWorldPointsOwnData,
} from './paired-surface-material-body-world-points-result-json.js';

export {
  BaroCadPairedSurfaceMaterialBodyWorldPointsReadError,
  BaroCadPairedSurfaceMaterialBodyWorldPointsDiagnosticCode,
} from './paired-surface-material-body-world-points-result-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-paired-surface-material-body-world-points-result-ingestion',
  version: 0,
  nativeSchema: 'barocss-paired-surface-material-body-world-points',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  worldLengthUnit: 'mm',
  uvLengthUnit: 'dimensionless',
  parameterFrame: 'exact-world-xyz-and-original-ua-va-ub-polynomials',
  sourceQualification: 'complete-parent-body-six-qualified-face-images-and-world-query-references',
  ownership: 'independent-copied-cpu-data-gc',
  d1Representation: 'inherited-tagged-and-direct-parent-no-new-body-d1',
  nativeRequestBytes: 8388608,
  limits: PAIRED_SURFACE_MATERIAL_BODY_WORLD_POINTS_LIMITS,
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
    topologyConstruction: false,
    directMaterialBodyConstruction: false,
    directSolidCertification: false,
    globalError: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
    directWorldPointClassification: false,
  } as const),
  geometryScope: 'one-source-defined-unit-axis-paired-material-body-original-world-xyz-membership',
  volumeUnit: 'mm3',
  nativeRestrictedMaterialCertificate: 'retained-native-true',
  nativeWorldRegionMembershipCertificate: 'retained-native-true',
} as const);

export interface BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead {
  native: PairedSurfaceMaterialBodyWorldPointResult;
  validationReport: PairedSurfaceMaterialBodyWorldPointReport;
  profile: typeof PROFILE;
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNativeSchema(value: unknown): asserts value is PairedSurfaceMaterialBodyWorldPointResult {
  const fields = ['request', 'classifications', 'proof', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(
      'SCHEMA', 'A complete paired material Body World points result record with the exact four fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(
      'SCHEMA', 'The native paired material Body World points report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead {
  const native = copyPairedSurfaceMaterialBodyWorldPointsOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: PairedSurfaceMaterialBodyWorldPointReport;
  try {
    actualReport = validatePairedSurfaceMaterialBodyWorldPointClassification(native);
  } catch (cause) {
    throw new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(
      'NATIVE', 'Whole native paired material Body World points validation refused the copied data', cause);
  }
  const validationReport = copyPairedSurfaceMaterialBodyWorldPointsOwnData(actualReport).value as PairedSurfaceMaterialBodyWorldPointReport;
  return {native, validationReport, profile: PROFILE, sourceText};
}

export function parseBaroCadPairedSurfaceMaterialBodyWorldPointsResult(text: string): BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(
      'INPUT', 'Paired material Body World points result text must be a string');
  }
  return admit(parsePairedSurfaceMaterialBodyWorldPointsJson(text).value, text);
}

export function readBaroCadPairedSurfaceMaterialBodyWorldPointsResult(input: unknown): BaroCadPairedSurfaceMaterialBodyWorldPointsResultRead {
  if (!isRecord(input)) {
    throw new BaroCadPairedSurfaceMaterialBodyWorldPointsReadError(
      'INPUT', 'Paired material Body World points result owned data must be a record');
  }
  return admit(input, null);
}
