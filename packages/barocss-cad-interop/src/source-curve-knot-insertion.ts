import { validateSourceCurveKnotInsertion } from '@barocss/cad';
import type { SourceCurveKnotInsertionResult, SourceCurveKnotInsertionReport } from '@barocss/cad';
import {
  BaroCadQualifiedBodyReadError,
  QUALIFIED_BODY_LIMITS,
  parseQualifiedBodyJson,
  copyQualifiedBodyOwnData,
} from './qualified-body-json.js';

export const BaroCadSourceCurveKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', JSON: 'JSON', OWNED: 'OWNED', BUDGET: 'BUDGET', SCHEMA: 'SCHEMA', NATIVE: 'NATIVE',
} as const);
export type BaroCadSourceCurveKnotInsertionDiagnosticCode = typeof BaroCadSourceCurveKnotInsertionDiagnosticCode[keyof typeof BaroCadSourceCurveKnotInsertionDiagnosticCode];

export class BaroCadSourceCurveKnotInsertionReadError extends Error {
  readonly code: BaroCadSourceCurveKnotInsertionDiagnosticCode;
  constructor(code: BaroCadSourceCurveKnotInsertionDiagnosticCode, message: string, cause?: unknown) {
    super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'BaroCadSourceCurveKnotInsertionReadError';
    this.code = code;
  }
}

const PROFILE = Object.freeze({
  schema: 'barocss-source-curve-knot-insertion-ingestion',
  version: 0,
  nativeSchema: 'barocss-source-curve-knot-insertion-report',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  parameterFrame: 'original-native-curve-parameter',
  ownership: 'independent-copied-cpu-data-gc',
  limits: QUALIFIED_BODY_LIMITS,
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

/** Complete original/refined native receipt and a separate whole-validation report. */
export interface BaroCadSourceCurveKnotInsertionRead {
  native: SourceCurveKnotInsertionResult;
  validationReport: SourceCurveKnotInsertionReport;
  /** Deeply frozen metadata only; native and report remain independently mutable. */
  profile: typeof PROFILE;
  /** Exact admitted JSON text; null for owned-data admission. */
  sourceText: string | null;
}

function codec<T>(action: () => T): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof BaroCadQualifiedBodyReadError) {
      throw new BaroCadSourceCurveKnotInsertionReadError(cause.code, cause.message, cause);
    }
    throw cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Dispatch only after strict descriptor copying; there is no outer native format field. */
function requireNativeSchema(value: unknown): asserts value is SourceCurveKnotInsertionResult {
  const fields = ['request', 'source', 'originalModel', 'model', 'originalCurve', 'curve', 'provenance', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadSourceCurveKnotInsertionReadError('SCHEMA', 'A complete source Curve knot insertion record with the exact eight fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadSourceCurveKnotInsertionReadError('SCHEMA', 'The native source Curve knot insertion report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadSourceCurveKnotInsertionRead {
  const native = codec(() => copyQualifiedBodyOwnData(value)).value;
  requireNativeSchema(native);
  let actualReport: SourceCurveKnotInsertionReport;
  try {
    actualReport = validateSourceCurveKnotInsertion(native);
  } catch (cause) {
    throw new BaroCadSourceCurveKnotInsertionReadError('NATIVE', 'Whole native source Curve knot insertion validation refused the copied data', cause);
  }
  // Retain the supplied full receipt and the actual report without mutable aliases.
  const validationReport = codec(() => copyQualifiedBodyOwnData(actualReport)).value as SourceCurveKnotInsertionReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Read complete saved JSON without adding sampling, insertion or shape certification. */
export function parseBaroCadSourceCurveKnotInsertion(text: string): BaroCadSourceCurveKnotInsertionRead {
  if (typeof text !== 'string') {
    throw new BaroCadSourceCurveKnotInsertionReadError('INPUT', 'Source Curve knot insertion text must be a string');
  }
  return admit(codec(() => parseQualifiedBodyJson(text)).value, text);
}

/** Independently copy and validate the complete original/refined owned receipt. */
export function readBaroCadSourceCurveKnotInsertion(input: unknown): BaroCadSourceCurveKnotInsertionRead {
  if (!isRecord(input)) {
    throw new BaroCadSourceCurveKnotInsertionReadError('INPUT', 'Source Curve knot insertion owned data must be a record');
  }
  return admit(input, null);
}
