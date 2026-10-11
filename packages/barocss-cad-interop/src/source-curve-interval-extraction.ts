import { validateSourceCurveIntervalExtraction } from '@barocss/cad';
import type { SourceCurveIntervalExtractionResult, SourceCurveIntervalExtractionReport } from '@barocss/cad';
import {
  SOURCE_CURVE_INTERVAL_LIMITS,
  BaroCadSourceCurveIntervalExtractionReadError,
  parseSourceCurveIntervalJson,
  copySourceCurveIntervalOwnData,
} from './source-curve-interval-extraction-json.js';

// Public errors are the unchanged measured codec class and its merged code union.
export {
  BaroCadSourceCurveIntervalExtractionReadError,
  BaroCadSourceCurveIntervalExtractionDiagnosticCode,
} from './source-curve-interval-extraction-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-source-curve-interval-extraction-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-curve-interval-extraction-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-curve-parameter',
  ownership: 'independent-copied-cpu-data-gc',
  limits: SOURCE_CURVE_INTERVAL_LIMITS,
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
    genericInterval: false,
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
export interface BaroCadSourceCurveIntervalExtractionRead {
  native: SourceCurveIntervalExtractionResult;
  validationReport: SourceCurveIntervalExtractionReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the actual report discriminator only after descriptor-safe copying. */
function requireNativeSchema(value: unknown): asserts value is SourceCurveIntervalExtractionResult {
  const fields = ['request', 'source', 'originalModel', 'model', 'originalCurve', 'curve', 'provenance', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceCurveIntervalExtractionReadError(
      'SCHEMA', 'A complete source Curve interval extraction record with the exact eight fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceCurveIntervalExtractionReadError(
      'SCHEMA', 'The native source Curve interval extraction report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceCurveIntervalExtractionRead {
  // Same-family codec failures propagate directly, with their actual code and cause.
  const native = copySourceCurveIntervalOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: SourceCurveIntervalExtractionReport;
  try {
    actualReport = validateSourceCurveIntervalExtraction(native);
  } catch (cause) {
    throw new BaroCadSourceCurveIntervalExtractionReadError(
      'NATIVE', 'Whole native source Curve interval extraction validation refused the copied data', cause);
  }
  const validationReport = copySourceCurveIntervalOwnData(actualReport).value as SourceCurveIntervalExtractionReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved interval receipt without additional native sampling. */
export function parseBaroCadSourceCurveIntervalExtraction(text: string): BaroCadSourceCurveIntervalExtractionRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceCurveIntervalExtractionReadError('INPUT', 'Source Curve interval extraction text must be a string');
  }
  return admit(parseSourceCurveIntervalJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied receipt on every call. */
export function readBaroCadSourceCurveIntervalExtraction(input: unknown): BaroCadSourceCurveIntervalExtractionRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceCurveIntervalExtractionReadError('INPUT', 'Source Curve interval extraction owned data must be a record');
  }
  return admit(input, null);
}
