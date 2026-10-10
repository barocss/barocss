import { validateSourceKnotAlignedLoft } from '@barocss/cad';
import type { SourceKnotAlignedLoftResult, SourceKnotAlignedLoftReport } from '@barocss/cad';
import {
  SOURCE_KNOT_ALIGNED_LOFT_LIMITS,
  BaroCadSourceKnotAlignedLoftReadError,
  parseSourceKnotAlignedLoftJson,
  copySourceKnotAlignedLoftOwnData,
} from './source-knot-aligned-loft-json.js';

// Public errors are the unchanged measured codec class and its merged code union.
export {
  BaroCadSourceKnotAlignedLoftReadError,
  BaroCadSourceKnotAlignedLoftDiagnosticCode,
} from './source-knot-aligned-loft-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-source-knot-aligned-loft-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-knot-aligned-loft-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-curve-u-and-authored-loft-v',
  ownership: 'independent-copied-cpu-data-gc',
  limits: SOURCE_KNOT_ALIGNED_LOFT_LIMITS,
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
    genericLoft: false,
    genericRefinement: false,
    globalShape: false,
    globalBinary64: false,
    g1g2: false,
    topology: false,
    solid: false,
    manufacturing: false,
    editorDisplay: false,
    persistentTopology: false,
    publication: false,
  } as const),
} as const);

/** Complete supplied native receipt with a separate actual whole-validation report. */
export interface BaroCadSourceKnotAlignedLoftRead {
  native: SourceKnotAlignedLoftResult;
  validationReport: SourceKnotAlignedLoftReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the actual report discriminator only after descriptor-safe copying. */
function requireNativeSchema(value: unknown): asserts value is SourceKnotAlignedLoftResult {
  const fields = ['request', 'originalSources', 'alignedSections', 'insertions', 'plan', 'loft', 'bindings', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceKnotAlignedLoftReadError(
      'SCHEMA', 'A complete source knot-aligned Loft record with the exact eight fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceKnotAlignedLoftReadError(
      'SCHEMA', 'The native source knot-aligned Loft report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceKnotAlignedLoftRead {
  // Same-family codec failures propagate directly, with their actual code and cause.
  const native = copySourceKnotAlignedLoftOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: SourceKnotAlignedLoftReport;
  try {
    actualReport = validateSourceKnotAlignedLoft(native);
  } catch (cause) {
    throw new BaroCadSourceKnotAlignedLoftReadError(
      'NATIVE', 'Whole native source knot-aligned Loft validation refused the copied data', cause);
  }
  const validationReport = copySourceKnotAlignedLoftOwnData(actualReport).value as SourceKnotAlignedLoftReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved alignment and Loft receipt without additional child validation. */
export function parseBaroCadSourceKnotAlignedLoft(text: string): BaroCadSourceKnotAlignedLoftRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceKnotAlignedLoftReadError('INPUT', 'Source knot-aligned Loft text must be a string');
  }
  return admit(parseSourceKnotAlignedLoftJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied receipt on every call. */
export function readBaroCadSourceKnotAlignedLoft(input: unknown): BaroCadSourceKnotAlignedLoftRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceKnotAlignedLoftReadError('INPUT', 'Source knot-aligned Loft owned data must be a record');
  }
  return admit(input, null);
}
