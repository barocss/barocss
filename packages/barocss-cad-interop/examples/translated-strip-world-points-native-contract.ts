import {
  parseBaroCadTranslatedSurfaceStripWorldPointClassification,
  readBaroCadTranslatedSurfaceStripWorldPointClassification,
  BaroCadTranslatedStripWorldPointReadError,
  BaroCadTranslatedStripWorldPointDiagnosticCode,
} from '@barocss/cad-interop/translated-strip-world-points';
import type {
  BaroCadTranslatedStripWorldPointRead,
} from '@barocss/cad-interop/translated-strip-world-points';
import type {
  TranslatedSurfaceStripWorldPointResult,
  TranslatedSurfaceStripWorldPointReport,
} from '@barocss/cad';

/** Selected public declaration consumer. No function is called by this file. */
export type WorldPointIngestionProfile = BaroCadTranslatedStripWorldPointRead['profile'];

export const readers: {
  parse: (text: string) => BaroCadTranslatedStripWorldPointRead;
  read: (input: unknown) => BaroCadTranslatedStripWorldPointRead;
} = {
  parse: parseBaroCadTranslatedSurfaceStripWorldPointClassification,
  read: readBaroCadTranslatedSurfaceStripWorldPointClassification,
};

export function consumeWorldPointDeclarations(
  text: string, owned: TranslatedSurfaceStripWorldPointResult,
): BaroCadTranslatedStripWorldPointRead {
  const parsed: BaroCadTranslatedStripWorldPointRead = readers.parse(text);
  const copied: BaroCadTranslatedStripWorldPointRead = readers.read(owned);
  const native: TranslatedSurfaceStripWorldPointResult = parsed.native;
  const validationReport: TranslatedSurfaceStripWorldPointReport = parsed.validationReport;
  const profile: WorldPointIngestionProfile = parsed.profile;
  const schema: 'barocss-translated-strip-world-point-ingestion' = profile.schema;
  const version: 0 = profile.version;
  const nativeSchema: 'barocss-translated-surface-strip-world-points' = profile.nativeSchema;
  const nativeVersion: 0 = profile.nativeVersion;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const lengthUnit: 'mm' = profile.lengthUnit;
  const uvLengthUnit: 'dimensionless' = profile.uvLengthUnit;
  const ownership: 'independent-copied-cpu-data-gc' = profile.ownership;
  const sourceRegion: true = profile.capabilities.sourceRegion;
  const worldPoints: true = profile.capabilities.worldPoints;
  const body: false = profile.capabilities.body;
  const brep: false = profile.capabilities.brep;
  const solid: false = profile.capabilities.solid;
  const renderer: false = profile.capabilities.renderer;
  const picking: false = profile.capabilities.picking;
  const url: false = profile.capabilities.url;
  const byteInput: false = profile.capabilities.byteInput;
  const manufacturing: false = profile.capabilities.manufacturing;
  const utf8Bytes: 1048576 = profile.limits.utf8Bytes;
  const utf16Units: 1048576 = profile.limits.utf16Units;
  const values: 1048576 = profile.limits.values;
  const depth: 64 = profile.limits.depth;
  const recordFields: 64 = profile.limits.recordFields;
  const arrayElements: 8192 = profile.limits.arrayElements;
  const stringUnits: 262144 = profile.limits.stringUnits;
  const keyUnits: 128 = profile.limits.keyUnits;
  const sourceText: string | null = parsed.sourceText;
  const ownedSourceText: string | null = copied.sourceText;
  const volume: TranslatedSurfaceStripWorldPointResult['volume'] = native.volume;
  const queries: TranslatedSurfaceStripWorldPointResult['queries'] = native.queries;
  const options: TranslatedSurfaceStripWorldPointResult['options'] = native.options;
  const classifications: TranslatedSurfaceStripWorldPointResult['classifications'] = native.classifications;
  const proof: TranslatedSurfaceStripWorldPointResult['proof'] = native.proof;
  const report: TranslatedSurfaceStripWorldPointReport = native.report;
  const nativeSourceRegion: true = report.quality.sourceDefinedRegionAuthority;
  const nativeBody: false = report.quality.nativeBodyTopologyCertified;
  const nativeSolid: false = report.quality.solid;
  void [validationReport, schema, version, nativeSchema, nativeVersion, sourceFrame,
    lengthUnit, uvLengthUnit, ownership, sourceRegion, worldPoints, body, brep,
    solid, renderer, picking, url, byteInput, manufacturing, utf8Bytes, utf16Units,
    values, depth, recordFields, arrayElements, stringUnits, keyUnits, sourceText,
    ownedSourceText, volume, queries, options, classifications, proof, report,
    nativeSourceRegion, nativeBody, nativeSolid];
  return parsed;
}

export function consumeErrorDeclarations(
  error: unknown,
): BaroCadTranslatedStripWorldPointDiagnosticCode | null {
  if (!(error instanceof BaroCadTranslatedStripWorldPointReadError)) return null;
  const code: BaroCadTranslatedStripWorldPointDiagnosticCode = error.code;
  const cause: unknown = error.cause;
  const codes: readonly BaroCadTranslatedStripWorldPointDiagnosticCode[] = [
    BaroCadTranslatedStripWorldPointDiagnosticCode.INPUT,
    BaroCadTranslatedStripWorldPointDiagnosticCode.JSON,
    BaroCadTranslatedStripWorldPointDiagnosticCode.OWNED,
    BaroCadTranslatedStripWorldPointDiagnosticCode.BUDGET,
    BaroCadTranslatedStripWorldPointDiagnosticCode.SCHEMA,
    BaroCadTranslatedStripWorldPointDiagnosticCode.NATIVE,
  ];
  void [cause, codes];
  return code;
}

/** Compiler-only checks for deeply readonly fixed metadata. */
export function consumeReadonlyProfileDeclarations(profile: WorldPointIngestionProfile): void {
  if (false) {
    // @ts-expect-error Fixed profile metadata is readonly, even for same-value assignment.
    profile.version = profile.version;
    // @ts-expect-error Nested family limits are readonly.
    profile.limits.utf8Bytes = profile.limits.utf8Bytes;
    // @ts-expect-error Nested capability metadata is readonly.
    profile.capabilities.body = profile.capabilities.body;
  }
}
