import {validatePairedSurfaceUVSplitFaces} from '@barocss/cad';
import type {PairedSurfaceUVSplitFacesResult, PairedSurfaceUVSplitFacesReport} from '@barocss/cad';
import {
  PAIRED_SURFACE_UV_SPLIT_FACES_LIMITS,
  BaroCadPairedSurfaceUVSplitFacesReadError,
  parsePairedSurfaceUVSplitFacesJson,
  copyPairedSurfaceUVSplitFacesOwnData,
} from './paired-surface-uv-split-faces-result-json.js';

// Preserve the measured codec class and its merged runtime/type diagnostic code.
export {
  BaroCadPairedSurfaceUVSplitFacesReadError,
  BaroCadPairedSurfaceUVSplitFacesDiagnosticCode,
} from './paired-surface-uv-split-faces-result-json.js';

const PROFILE = Object.freeze({
  schema: 'barocss-paired-surface-uv-split-faces-result-ingestion',
  version: 0,
  nativeSchema: 'barocss-paired-surface-uv-split-faces',
  nativeVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion',
  worldLengthUnit: 'mm',
  uvLengthUnit: 'dimensionless',
  parameterFrame: 'original-a-u-window-and-native-edge-parameters',
  sourceQualification: 'original-a-source-id-model-object-index-with-full-original-b-retained',
  ownership: 'independent-copied-cpu-data-gc',
  faceScope: 'original-a-proper-u-window-full-original-v',
  d1Representation: 'outer-tagged-parent-direct',
  nativeRequestBytes: 4194304,
  limits: PAIRED_SURFACE_UV_SPLIT_FACES_LIMITS,
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
    isoCurveConstruction: false,
    intervalExtraction: false,
    faceConstruction: false,
    bSurfaceSplit: false,
    topologyConstruction: false,
    body: false,
    solid: false,
    globalError: false,
    manufacturing: false,
    persistentNaming: false,
    editor: false,
    publication: false,
  } as const),
} as const);

/** Complete supplied Face receipt with a separate actual whole-validation report. */
export interface BaroCadPairedSurfaceUVSplitFacesResultRead {
  native: PairedSurfaceUVSplitFacesResult;
  validationReport: PairedSurfaceUVSplitFacesReport;
  /** Deeply frozen metadata only. Native data and Report remain independently mutable. */
  profile: typeof PROFILE;
  /** Entire admitted text, unchanged; null for own-data admission. */
  sourceText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Inspect the report discriminator after the descriptor-safe whole copy. */
function requireNativeSchema(value: unknown): asserts value is PairedSurfaceUVSplitFacesResult {
  const fields = ['request', 'isoCurves', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces', 'proof', 'observations', 'report'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length ||
      !fields.every(field => Object.hasOwn(value, field))) {
    throw new BaroCadPairedSurfaceUVSplitFacesReadError(
      'SCHEMA', 'A complete paired Surface UV split Faces result record with the exact eleven fields is required');
  }
  const report = value.report;
  if (!isRecord(report) || !Object.hasOwn(report, 'schema') || !Object.hasOwn(report, 'version') ||
      report.schema !== PROFILE.nativeSchema || report.version !== PROFILE.nativeVersion) {
    throw new BaroCadPairedSurfaceUVSplitFacesReadError(
      'SCHEMA', 'The native paired Surface UV split Faces report schema and version 0 are required');
  }
}

function admit(value: unknown, sourceText: string | null): BaroCadPairedSurfaceUVSplitFacesResultRead {
  const native = copyPairedSurfaceUVSplitFacesOwnData(value).value;
  requireNativeSchema(native);
  let actualReport: PairedSurfaceUVSplitFacesReport;
  try {
    actualReport = validatePairedSurfaceUVSplitFaces(native);
  } catch (cause) {
    throw new BaroCadPairedSurfaceUVSplitFacesReadError(
      'NATIVE', 'Whole native paired Surface UV split Faces validation refused the copied data', cause);
  }
  // Keep report copying outside the native catch; codec code/cause propagate directly.
  const validationReport = copyPairedSurfaceUVSplitFacesOwnData(actualReport).value as PairedSurfaceUVSplitFacesReport;
  return {native, validationReport, profile: PROFILE, sourceText};
}

/** Ingest the full saved result without an additional direct construction or sampler call. */
export function parseBaroCadPairedSurfaceUVSplitFacesResult(text: string): BaroCadPairedSurfaceUVSplitFacesResultRead {
  if (typeof text !== 'string') {
    throw new BaroCadPairedSurfaceUVSplitFacesReadError(
      'INPUT', 'Paired Surface UV split Faces result text must be a string');
  }
  return admit(parsePairedSurfaceUVSplitFacesJson(text).value, text);
}

/** Independently copy and whole-validate the complete supplied result on each call. */
export function readBaroCadPairedSurfaceUVSplitFacesResult(input: unknown): BaroCadPairedSurfaceUVSplitFacesResultRead {
  if (!isRecord(input)) {
    throw new BaroCadPairedSurfaceUVSplitFacesReadError(
      'INPUT', 'Paired Surface UV split Faces result owned data must be a record');
  }
  return admit(input, null);
}
