import { validateSourceLineWidthFace } from '@barocss/cad';
import type { SourceLineWidthFaceResult, SourceLineWidthFaceReport } from '@barocss/cad';
import {
  SOURCE_LINE_WIDTH_FACE_LIMITS,
  BaroCadSourceLineWidthFaceReadError,
  parseSourceLineWidthFaceJson,
  copySourceLineWidthFaceOwnData,
} from './source-line-width-face-json.js';

// Public errors are the unchanged measured codec class and its merged code union.
export {
  BaroCadSourceLineWidthFaceReadError,
  BaroCadSourceLineWidthFaceDiagnosticCode,
} from './source-line-width-face-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-source-line-width-face-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-line-width-face-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'retained-original-world-and-surface-parameters-with-dimensionless-uv',
  sourceQualification: 'retained-source-field-path-and-actual-model-name',
  ownership: 'independent-copied-cpu-data-gc',
  limits: SOURCE_LINE_WIDTH_FACE_LIMITS,
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
    widthOperation: false,
    generalCurveOffset: false,
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
export interface BaroCadSourceLineWidthFaceRead {
  native: SourceLineWidthFaceResult;
  validationReport: SourceLineWidthFaceReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the actual report discriminator only after descriptor-safe copying. */
function requireNativeSchema(value: unknown): asserts value is SourceLineWidthFaceResult {
  const fields = ['request', 'originalModel', 'originalCurve', 'ruled', 'face', 'bindings', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceLineWidthFaceReadError(
      'SCHEMA', 'A complete source Line width Face record with the exact seven fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceLineWidthFaceReadError(
      'SCHEMA', 'The native source Line width Face report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceLineWidthFaceRead {
  // Same-family codec failures propagate directly, with their actual code and cause.
  const native = copySourceLineWidthFaceOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: SourceLineWidthFaceReport;
  try {
    actualReport = validateSourceLineWidthFace(native);
  } catch (cause) {
    throw new BaroCadSourceLineWidthFaceReadError(
      'NATIVE', 'Whole native source Line width Face validation refused the copied data', cause);
  }
  const validationReport = copySourceLineWidthFaceOwnData(actualReport).value as SourceLineWidthFaceReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved Source Line width Face receipt without additional native sampling. */
export function parseBaroCadSourceLineWidthFace(text: string): BaroCadSourceLineWidthFaceRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceLineWidthFaceReadError('INPUT', 'Source Line width Face text must be a string');
  }
  return admit(parseSourceLineWidthFaceJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied receipt on every call. */
export function readBaroCadSourceLineWidthFace(input: unknown): BaroCadSourceLineWidthFaceRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceLineWidthFaceReadError('INPUT', 'Source Line width Face owned data must be a record');
  }
  return admit(input, null);
}
