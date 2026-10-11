import { validateSourceCurveDegreeElevation } from '@barocss/cad';
import type { SourceCurveDegreeElevationResult, SourceCurveDegreeElevationReport } from '@barocss/cad';
import {
  SOURCE_CURVE_DEGREE_ELEVATION_LIMITS,
  BaroCadSourceCurveDegreeElevationReadError,
  parseSourceCurveDegreeElevationJson,
  copySourceCurveDegreeElevationOwnData,
} from './source-curve-degree-elevation-json.js';

// Public errors are the unchanged measured codec class and its merged code union.
export {
  BaroCadSourceCurveDegreeElevationReadError,
  BaroCadSourceCurveDegreeElevationDiagnosticCode,
} from './source-curve-degree-elevation-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-source-curve-degree-elevation-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-curve-degree-elevation-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-curve-parameter',
  ownership: 'independent-copied-cpu-data-gc',
  limits: SOURCE_CURVE_DEGREE_ELEVATION_LIMITS,
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
    genericDegreeElevation: false,
    degreeLowering: false,
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
export interface BaroCadSourceCurveDegreeElevationRead {
  native: SourceCurveDegreeElevationResult;
  validationReport: SourceCurveDegreeElevationReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the actual report discriminator only after descriptor-safe copying. */
function requireNativeSchema(value: unknown): asserts value is SourceCurveDegreeElevationResult {
  const fields = ['request', 'source', 'originalModel', 'model', 'originalCurve', 'curve', 'provenance', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceCurveDegreeElevationReadError(
      'SCHEMA', 'A complete source Curve degree elevation record with the exact eight fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceCurveDegreeElevationReadError(
      'SCHEMA', 'The native source Curve degree elevation report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceCurveDegreeElevationRead {
  // Same-family codec failures propagate directly, with their actual code and cause.
  const native = copySourceCurveDegreeElevationOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: SourceCurveDegreeElevationReport;
  try {
    actualReport = validateSourceCurveDegreeElevation(native);
  } catch (cause) {
    throw new BaroCadSourceCurveDegreeElevationReadError(
      'NATIVE', 'Whole native source Curve degree elevation validation refused the copied data', cause);
  }
  const validationReport = copySourceCurveDegreeElevationOwnData(actualReport).value as SourceCurveDegreeElevationReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved degree elevation receipt without additional native sampling. */
export function parseBaroCadSourceCurveDegreeElevation(text: string): BaroCadSourceCurveDegreeElevationRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceCurveDegreeElevationReadError('INPUT', 'Source Curve degree elevation text must be a string');
  }
  return admit(parseSourceCurveDegreeElevationJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied receipt on every call. */
export function readBaroCadSourceCurveDegreeElevation(input: unknown): BaroCadSourceCurveDegreeElevationRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceCurveDegreeElevationReadError('INPUT', 'Source Curve degree elevation owned data must be a record');
  }
  return admit(input, null);
}
