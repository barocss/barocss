import { validateSourceSurfaceKnotInsertion } from '@barocss/cad';
import type { SourceSurfaceKnotInsertionResult, SourceSurfaceKnotInsertionReport } from '@barocss/cad';
import {
  SOURCE_SURFACE_KNOT_LIMITS,
  BaroCadSourceSurfaceKnotInsertionReadError,
  parseSourceSurfaceKnotJson,
  copySourceSurfaceKnotOwnData,
} from './source-surface-knot-insertion-json.js';

// Public errors are the measured dedicated codec class and its merged code union.
export {
  BaroCadSourceSurfaceKnotInsertionReadError,
  BaroCadSourceSurfaceKnotInsertionDiagnosticCode,
} from './source-surface-knot-insertion-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-source-surface-knot-insertion-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-surface-knot-insertion-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-surface-uv',
  ownership: 'independent-copied-cpu-data-gc',
  limits: SOURCE_SURFACE_KNOT_LIMITS,
  capabilities: Object.freeze({
    nativeSourceInsertion: true,
    copiedWholeReceipt: true,
    renderer: false,
    url: false,
    byteInput: false,
    publicSerializer: false,
    dispose: false,
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
export interface BaroCadSourceSurfaceKnotInsertionRead {
  native: SourceSurfaceKnotInsertionResult;
  validationReport: SourceSurfaceKnotInsertionReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the actual report discriminator only after descriptor-safe copying. */
function requireNativeSchema(value: unknown): asserts value is SourceSurfaceKnotInsertionResult {
  const fields = ['request', 'source', 'originalModel', 'model', 'originalSurface', 'surface', 'provenance', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceSurfaceKnotInsertionReadError(
      'SCHEMA', 'A complete source Surface knot insertion record with the exact eight fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceSurfaceKnotInsertionReadError(
      'SCHEMA', 'The native source Surface knot insertion report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceSurfaceKnotInsertionRead {
  // The same-family codec errors propagate unchanged, including their actual causes.
  const native = copySourceSurfaceKnotOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: SourceSurfaceKnotInsertionReport;
  try {
    actualReport = validateSourceSurfaceKnotInsertion(native);
  } catch (cause) {
    throw new BaroCadSourceSurfaceKnotInsertionReadError(
      'NATIVE', 'Whole native source Surface knot insertion validation refused the copied data', cause);
  }
  const validationReport = copySourceSurfaceKnotOwnData(actualReport).value as SourceSurfaceKnotInsertionReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read the complete saved original/refined Surface receipt without extra native sampling. */
export function parseBaroCadSourceSurfaceKnotInsertion(text: string): BaroCadSourceSurfaceKnotInsertionRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceSurfaceKnotInsertionReadError('INPUT', 'Source Surface knot insertion text must be a string');
  }
  return admit(parseSourceSurfaceKnotJson(text).value, text);
}

/** Independently copy and whole-validate the complete owned receipt on every call. */
export function readBaroCadSourceSurfaceKnotInsertion(input: unknown): BaroCadSourceSurfaceKnotInsertionRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceSurfaceKnotInsertionReadError('INPUT', 'Source Surface knot insertion owned data must be a record');
  }
  return admit(input, null);
}
