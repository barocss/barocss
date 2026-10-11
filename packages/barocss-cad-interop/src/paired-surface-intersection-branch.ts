import { validatePairedSurfaceIntersectionBranch } from '@barocss/cad';
import type { PairedSurfaceIntersectionBranchResult, PairedSurfaceIntersectionBranchReport } from '@barocss/cad';
import {
  PAIRED_SURFACE_INTERSECTION_BRANCH_LIMITS,
  BaroCadPairedSurfaceIntersectionBranchReadError,
  parsePairedSurfaceIntersectionBranchJson,
  copyPairedSurfaceIntersectionBranchOwnData,
} from './paired-surface-intersection-branch-json.js';

// Same-family codec exceptions retain their actual code and cause.
export {
  BaroCadPairedSurfaceIntersectionBranchReadError,
  BaroCadPairedSurfaceIntersectionBranchDiagnosticCode,
} from './paired-surface-intersection-branch-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-paired-surface-intersection-branch-ingestion',
  version: 0,
  nativeSchema: 'barocss-seeded-paired-surface-intersection-branch',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-u-v-domains',
  sourceQualification: 'retained-asset-index-source-field-and-original-model-selection',
  ownership: 'independent-copied-cpu-data-gc',
  limits: PAIRED_SURFACE_INTERSECTION_BRANCH_LIMITS,
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
    branchTracing: false,
    exactTrimCurve: false,
    pairedPcurve: false,
    allBranches: false,
    branchIdentityBetweenStations: false,
    globalError: false,
    topology: false,
    body: false,
    solid: false,
    manufacturing: false,
    publication: false,
  } as const),
} as const);

/** Complete supplied branch with a separate actual whole-validation report. */
export interface BaroCadPairedSurfaceIntersectionBranchRead {
  native: PairedSurfaceIntersectionBranchResult;
  validationReport: PairedSurfaceIntersectionBranchReport;
  /** Deeply frozen metadata only; native data and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Entire admitted text, unchanged; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect only after descriptor-safe copying. The discriminator belongs to the report. */
function requireNativeSchema(value: unknown): asserts value is PairedSurfaceIntersectionBranchResult {
  const fields = ['request', 'originalModels', 'observations', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadPairedSurfaceIntersectionBranchReadError(
      'SCHEMA', 'A complete paired Surface intersection branch record with the exact four fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadPairedSurfaceIntersectionBranchReadError(
      'SCHEMA', 'The native paired Surface intersection branch report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadPairedSurfaceIntersectionBranchRead {
  const native = copyPairedSurfaceIntersectionBranchOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: PairedSurfaceIntersectionBranchReport;
  try {
    actualReport = validatePairedSurfaceIntersectionBranch(native);
  } catch (cause) {
    throw new BaroCadPairedSurfaceIntersectionBranchReadError(
      'NATIVE', 'Whole native paired Surface intersection branch validation refused the copied data', cause);
  }
  // Report copying stays outside the native catch; codec failures propagate directly.
  const validationReport = copyPairedSurfaceIntersectionBranchOwnData(actualReport).value as PairedSurfaceIntersectionBranchReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read complete saved receipts without an additional direct tracing or sampling operation. */
export function parseBaroCadPairedSurfaceIntersectionBranch(text: string): BaroCadPairedSurfaceIntersectionBranchRead {
  if (typeof text !== 'string') {
    throw new BaroCadPairedSurfaceIntersectionBranchReadError('INPUT', 'Paired Surface intersection branch text must be a string');
  }
  return admit(parsePairedSurfaceIntersectionBranchJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied receipt on every call. */
export function readBaroCadPairedSurfaceIntersectionBranch(input: unknown): BaroCadPairedSurfaceIntersectionBranchRead {
  if (!isRecord(input)) {
    throw new BaroCadPairedSurfaceIntersectionBranchReadError('INPUT', 'Paired Surface intersection branch owned data must be a record');
  }
  return admit(input, null);
}
