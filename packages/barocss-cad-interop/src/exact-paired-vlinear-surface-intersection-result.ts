import {validateExactPairedVLinearSurfaceIntersection} from '@barocss/cad';
import type {
  ExactPairedVLinearSurfaceIntersectionResult,
  ExactPairedVLinearSurfaceIntersectionReport,
} from '@barocss/cad';
import {
  EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS,
  BaroCadExactPairedVLinearSurfaceIntersectionReadError,
  parseExactPairedVLinearSurfaceIntersectionJson,
  copyExactPairedVLinearSurfaceIntersectionOwnData,
} from './exact-paired-vlinear-surface-intersection-result-json.js';

// Same-family codec errors retain their original code and actual cause.
export {
  BaroCadExactPairedVLinearSurfaceIntersectionReadError,
  BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode,
} from './exact-paired-vlinear-surface-intersection-result-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-exact-paired-vlinear-surface-intersection-result-ingestion',
  version: 0,
  nativeSchema: 'barocss-exact-paired-vlinear-surface-intersection-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  worldLengthUnit: 'mm',
  uvLengthUnit: 'dimensionless',
  parameterFrame: 'original-a-u',
  sourceQualification: 'original-source-id-asset-index-and-model-object-index',
  ownership: 'independent-copied-cpu-data-gc',
  limits: EXACT_PAIRED_VLINEAR_SURFACE_INTERSECTION_LIMITS,
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
    genericIntersection: false,
    allBranchesOutsideInterval: false,
    trimFace: false,
    topology: false,
    body: false,
    solid: false,
    globalError: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
  } as const),
} as const);

/** Complete supplied native receipt with an independent actual whole-validation report. */
export interface BaroCadExactPairedVLinearSurfaceIntersectionResultRead {
  native: ExactPairedVLinearSurfaceIntersectionResult;
  validationReport: ExactPairedVLinearSurfaceIntersectionReport;
  /** Deeply frozen ingestion metadata only; native and report remain mutable. */
  profile: typeof PROFILE;
  /** Exact admitted text, unchanged; null for own-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the native report discriminator only after the descriptor-safe copy. */
function requireNativeSchema(value: unknown): asserts value is ExactPairedVLinearSurfaceIntersectionResult {
  const fields = ['request', 'originalModels', 'world', 'pcurves', 'proof', 'observations', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
      'SCHEMA', 'A complete exact paired V-linear Surface intersection result record with the exact seven fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || !Object.hasOwn(report, 'schema') || !Object.hasOwn(report, 'version') ||
      report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
      'SCHEMA', 'The native exact paired V-linear Surface intersection report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadExactPairedVLinearSurfaceIntersectionResultRead {
  const native = copyExactPairedVLinearSurfaceIntersectionOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: ExactPairedVLinearSurfaceIntersectionReport;
  try {
    actualReport = validateExactPairedVLinearSurfaceIntersection(native);
  } catch (cause) {
    throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
      'NATIVE', 'Whole native exact paired V-linear Surface intersection validation refused the copied data', cause);
  }
  // Copy outside the native catch; any report-copy codec error propagates directly.
  const validationReport = copyExactPairedVLinearSurfaceIntersectionOwnData(actualReport).value as ExactPairedVLinearSurfaceIntersectionReport;
  return {native, validationReport, profile: PROFILE, sourceText};
}

/** Read the complete saved receipt without a direct construction or sampling operation. */
export function parseBaroCadExactPairedVLinearSurfaceIntersectionResult(
  text: string,
): BaroCadExactPairedVLinearSurfaceIntersectionResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
      'INPUT', 'Exact paired V-linear Surface intersection result text must be a string');
  }
  return admit(parseExactPairedVLinearSurfaceIntersectionJson(text).value, text);
}

/** Independently copy and whole-validate the supplied complete result on every admission. */
export function readBaroCadExactPairedVLinearSurfaceIntersectionResult(
  input: unknown,
): BaroCadExactPairedVLinearSurfaceIntersectionResultRead {
  if (!isRecord(input)) {
    throw new BaroCadExactPairedVLinearSurfaceIntersectionReadError(
      'INPUT', 'Exact paired V-linear Surface intersection result owned data must be a record');
  }
  return admit(input, null);
}
