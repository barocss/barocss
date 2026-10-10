import { validateNurbsSourceLoftFeatureGraph, validateNurbsSourceLoftFeatureGraphUpdate } from '@barocss/cad';
import type {
  NurbsSourceLoftFeatureGraphResult,
  NurbsSourceLoftFeatureGraphReport,
  NurbsSourceLoftFeatureGraphUpdateResult,
  NurbsSourceLoftFeatureGraphTransactionReport,
} from '@barocss/cad';
import {
  BaroCadQualifiedBodyReadError,
  QUALIFIED_BODY_LIMITS,
  copyQualifiedBodyOwnData,
  parseQualifiedBodyJson,
} from './qualified-body-json.js';

export const BaroCadNurbsSourceLoftDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', JSON: 'JSON', OWNED: 'OWNED', BUDGET: 'BUDGET', SCHEMA: 'SCHEMA', NATIVE: 'NATIVE',
} as const);
export type BaroCadNurbsSourceLoftDiagnosticCode = typeof BaroCadNurbsSourceLoftDiagnosticCode[keyof typeof BaroCadNurbsSourceLoftDiagnosticCode];

export class BaroCadNurbsSourceLoftReadError extends Error {
  readonly code: BaroCadNurbsSourceLoftDiagnosticCode;
  constructor(code: BaroCadNurbsSourceLoftDiagnosticCode, message: string, cause?: unknown) {
    super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'BaroCadNurbsSourceLoftReadError';
    this.code = code;
  }
}

const GRAPH_SCHEMA = 'barocss-nurbs-source-loft-feature-graph';
const UPDATE_SCHEMA = 'barocss-nurbs-source-loft-feature-graph-transaction';
const COMMON_PROFILE = {
  sourceFrame: 'authored-xyz-no-axis-conversion',
  lengthUnit: 'mm',
  ownership: 'independent-copied-cpu-data-gc',
  limits: QUALIFIED_BODY_LIMITS,
} as const;
const COMMON_CAPABILITIES = {
  renderer: false,
  url: false,
  byteInput: false,
  smoothLoft: false,
  topology: false,
  solid: false,
  boolean: false,
  manufacturing: false,
  publication: false,
} as const;
const GRAPH_PROFILE = Object.freeze({
  schema: 'barocss-nurbs-source-loft-feature-graph-ingestion',
  version: 0,
  packetRole: 'graph',
  nativeSchema: GRAPH_SCHEMA,
  nativeVersion: 0,
  ...COMMON_PROFILE,
  capabilities: Object.freeze({ graph: true, updateReceipt: false, ...COMMON_CAPABILITIES } as const),
} as const);
const UPDATE_PROFILE = Object.freeze({
  schema: 'barocss-nurbs-source-loft-feature-graph-ingestion',
  version: 0,
  packetRole: 'update',
  nativeSchema: UPDATE_SCHEMA,
  nativeVersion: 0,
  ...COMMON_PROFILE,
  capabilities: Object.freeze({ graph: true, updateReceipt: true, ...COMMON_CAPABILITIES } as const),
} as const);

/** Complete mutable Graph and an independent report from its whole validator. */
export interface BaroCadNurbsSourceLoftFeatureGraphRead {
  native: NurbsSourceLoftFeatureGraphResult;
  validationReport: NurbsSourceLoftFeatureGraphReport;
  profile: typeof GRAPH_PROFILE;
  /** Exact admitted JSON text, or null for owned-data admission. */
  sourceText: string | null;
}

/** Complete next Graph and transaction, including the previous authored intent. */
export interface BaroCadNurbsSourceLoftFeatureGraphUpdateRead {
  native: NurbsSourceLoftFeatureGraphUpdateResult;
  validationReport: NurbsSourceLoftFeatureGraphTransactionReport;
  profile: typeof UPDATE_PROFILE;
  /** Exact admitted JSON text, or null for owned-data admission. */
  sourceText: string | null;
}

function codec<T>(action: () => T): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof BaroCadQualifiedBodyReadError) {
      throw new BaroCadNurbsSourceLoftReadError(cause.code, cause.message, cause);
    }
    throw cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Shape dispatch reads only descriptor-checked copied records. */
function requireFields(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadNurbsSourceLoftReadError('SCHEMA', 'A complete Loft packet record with the exact fields is required');
  }
}

function requireReport(value: unknown, schema: string): void {
  if (!isRecord(value) || value.schema !== schema || value.version !== 0) {
    throw new BaroCadNurbsSourceLoftReadError('SCHEMA', 'The matching native Loft report schema and version 0 are required');
  }
}

function requireGraph(value: unknown): asserts value is NurbsSourceLoftFeatureGraphResult {
  requireFields(value, ['document', 'options', 'originalSources', 'evaluatedNodes', 'loft', 'bindings', 'report']);
  requireReport(value.report, GRAPH_SCHEMA);
}

function requireUpdate(value: unknown): asserts value is NurbsSourceLoftFeatureGraphUpdateResult {
  requireFields(value, ['result', 'transaction']);
  requireGraph(value.result);
  requireFields(value.transaction, ['request', 'report']);
  requireFields(value.transaction.request, ['previousDocument', 'options', 'edits']);
  requireReport(value.transaction.report, UPDATE_SCHEMA);
}

function admitGraph(value: unknown, sourceText: string | null): BaroCadNurbsSourceLoftFeatureGraphRead {
  const native = codec(() => copyQualifiedBodyOwnData(value)).value;
  requireGraph(native);
  let actualReport: NurbsSourceLoftFeatureGraphReport;
  try { actualReport = validateNurbsSourceLoftFeatureGraph(native); }
  catch (cause) {
    throw new BaroCadNurbsSourceLoftReadError('NATIVE', 'Whole native Loft Graph validation refused the copied data', cause);
  }
  const validationReport = codec(() => copyQualifiedBodyOwnData(actualReport)).value as NurbsSourceLoftFeatureGraphReport;
  return { native, validationReport, profile: GRAPH_PROFILE, sourceText };
}

function admitUpdate(value: unknown, sourceText: string | null): BaroCadNurbsSourceLoftFeatureGraphUpdateRead {
  const native = codec(() => copyQualifiedBodyOwnData(value)).value;
  requireUpdate(native);
  let actualReport: NurbsSourceLoftFeatureGraphTransactionReport;
  try { actualReport = validateNurbsSourceLoftFeatureGraphUpdate(native); }
  catch (cause) {
    throw new BaroCadNurbsSourceLoftReadError('NATIVE', 'Whole native Loft update validation refused the copied data', cause);
  }
  const validationReport = codec(() => copyQualifiedBodyOwnData(actualReport)).value as NurbsSourceLoftFeatureGraphTransactionReport;
  return { native, validationReport, profile: UPDATE_PROFILE, sourceText };
}

function requireText(text: string): void {
  if (typeof text !== 'string') throw new BaroCadNurbsSourceLoftReadError('INPUT', 'Loft packet text must be a string');
}

function requireOwned(input: unknown): void {
  if (!isRecord(input)) throw new BaroCadNurbsSourceLoftReadError('INPUT', 'Loft packet owned data must be a record');
}

/** Admit a complete saved Graph without evaluating an authored-only document. */
export function parseBaroCadNurbsSourceLoftFeatureGraph(text: string): BaroCadNurbsSourceLoftFeatureGraphRead {
  requireText(text);
  return admitGraph(codec(() => parseQualifiedBodyJson(text)).value, text);
}

/** Independently copy and validate the complete current Graph. */
export function readBaroCadNurbsSourceLoftFeatureGraph(input: unknown): BaroCadNurbsSourceLoftFeatureGraphRead {
  requireOwned(input);
  return admitGraph(input, null);
}

/** Admit both the complete next Graph and its selective update transaction. */
export function parseBaroCadNurbsSourceLoftFeatureGraphUpdate(text: string): BaroCadNurbsSourceLoftFeatureGraphUpdateRead {
  requireText(text);
  return admitUpdate(codec(() => parseQualifiedBodyJson(text)).value, text);
}

/** Independently copy and validate the whole next Graph and transaction together. */
export function readBaroCadNurbsSourceLoftFeatureGraphUpdate(input: unknown): BaroCadNurbsSourceLoftFeatureGraphUpdateRead {
  requireOwned(input);
  return admitUpdate(input, null);
}
