import { validateTranslatedSurfaceStripWorldPointClassification } from '@barocss/cad';
import type { TranslatedSurfaceStripWorldPointResult, TranslatedSurfaceStripWorldPointReport } from '@barocss/cad';
import {
  BaroCadQualifiedBodyReadError,
  QUALIFIED_BODY_LIMITS,
  scalarUtf8Bytes,
  parseQualifiedBodyJson,
  copyQualifiedBodyOwnData,
} from './qualified-body-json.js';

export const BaroCadTranslatedStripWorldPointDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', JSON: 'JSON', OWNED: 'OWNED', BUDGET: 'BUDGET', SCHEMA: 'SCHEMA', NATIVE: 'NATIVE',
} as const);
export type BaroCadTranslatedStripWorldPointDiagnosticCode = typeof BaroCadTranslatedStripWorldPointDiagnosticCode[keyof typeof BaroCadTranslatedStripWorldPointDiagnosticCode];

export class BaroCadTranslatedStripWorldPointReadError extends Error {
  readonly code: BaroCadTranslatedStripWorldPointDiagnosticCode;
  constructor(code: BaroCadTranslatedStripWorldPointDiagnosticCode, message: string, cause?: unknown) {
    super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'BaroCadTranslatedStripWorldPointReadError';
    this.code = code;
  }
}

const FAMILY_LIMITS = Object.freeze({
  ...QUALIFIED_BODY_LIMITS,
  utf8Bytes: 1048576,
  utf16Units: 1048576,
} as const);
const PROFILE = Object.freeze({
  schema: 'barocss-translated-strip-world-point-ingestion',
  version: 0,
  nativeSchema: 'barocss-translated-surface-strip-world-points',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  uvLengthUnit: 'dimensionless',
  ownership: 'independent-copied-cpu-data-gc',
  limits: FAMILY_LIMITS,
  capabilities: Object.freeze({
    sourceRegion: true,
    worldPoints: true,
    body: false,
    brep: false,
    solid: false,
    renderer: false,
    picking: false,
    url: false,
    byteInput: false,
    boolean: false,
    manufacturing: false,
    exchange: false,
    publication: false,
  } as const),
} as const);

/** Complete native source-region classifications with a separate whole-validation report. */
export interface BaroCadTranslatedStripWorldPointRead {
  native: TranslatedSurfaceStripWorldPointResult;
  validationReport: TranslatedSurfaceStripWorldPointReport;
  profile: typeof PROFILE;
  /** Exact admitted JSON text, or null for owned data. */
  sourceText: string | null;
}

function codec<T>(action: () => T): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof BaroCadQualifiedBodyReadError) {
      throw new BaroCadTranslatedStripWorldPointReadError(cause.code, cause.message, cause);
    }
    throw cause;
  }
}

/** Check the family's raw text bounds before invoking the shared decoder. */
function parseFamilyText(text: string): unknown {
  if (typeof text !== 'string') {
    throw new BaroCadTranslatedStripWorldPointReadError('INPUT', 'World point classification text must be a string');
  }
  if (text.length > FAMILY_LIMITS.utf16Units) {
    throw new BaroCadTranslatedStripWorldPointReadError('BUDGET', 'Raw World point JSON exceeds the family UTF16 budget');
  }
  const bytes = codec(() => scalarUtf8Bytes(text));
  if (bytes > FAMILY_LIMITS.utf8Bytes) {
    throw new BaroCadTranslatedStripWorldPointReadError('BUDGET', 'Raw World point JSON exceeds the family UTF8 budget');
  }
  return codec(() => parseQualifiedBodyJson(text)).value;
}

/** The shared bounded copy can be larger than the family's admitted packet. */
function copyFamilyData(input: unknown): unknown {
  const copied = codec(() => copyQualifiedBodyOwnData(input));
  if (copied.metrics.canonicalUtf8Bytes > FAMILY_LIMITS.utf8Bytes ||
      copied.metrics.canonicalUtf16Units > FAMILY_LIMITS.utf16Units) {
    throw new BaroCadTranslatedStripWorldPointReadError('BUDGET', 'Copied World point canonical JSON plus newline exceeds the family budget');
  }
  return copied.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect only safe copied data after the family canonical budget check. */
function requireNativeSchema(value: unknown): asserts value is TranslatedSurfaceStripWorldPointResult {
  const fields = ['volume', 'queries', 'options', 'classifications', 'proof', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadTranslatedStripWorldPointReadError('SCHEMA', 'A complete World point classification record with the exact six fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadTranslatedStripWorldPointReadError('SCHEMA', 'The native World point report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadTranslatedStripWorldPointRead {
  const native = copyFamilyData(value);
  requireNativeSchema(native);
  let actualReport: TranslatedSurfaceStripWorldPointReport;
  try { actualReport = validateTranslatedSurfaceStripWorldPointClassification(native); }
  catch (cause) {
    throw new BaroCadTranslatedStripWorldPointReadError('NATIVE', 'Whole native World point classification validation refused the copied data', cause);
  }
  const validationReport = copyFamilyData(actualReport) as TranslatedSurfaceStripWorldPointReport;
  return { native, validationReport, profile: PROFILE, sourceText };
}

/** Admit complete strict JSON with original represented coordinates and source text. */
export function parseBaroCadTranslatedSurfaceStripWorldPointClassification(text: string): BaroCadTranslatedStripWorldPointRead {
  return admit(parseFamilyText(text), text);
}

/** Independently copy and validate complete native source-region point data. */
export function readBaroCadTranslatedSurfaceStripWorldPointClassification(input: unknown): BaroCadTranslatedStripWorldPointRead {
  if (!isRecord(input)) {
    throw new BaroCadTranslatedStripWorldPointReadError('INPUT', 'World point classification owned data must be a record');
  }
  return admit(input, null);
}
