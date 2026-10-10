import {
  parseBaroCadQualifiedBodyBoundaryMesh,
  readBaroCadQualifiedBodyBoundaryMesh,
  BaroCadQualifiedBodyBoundaryMeshReadError,
  BaroCadQualifiedBodyBoundaryMeshDiagnosticCode,
  BaroCadQualifiedBodyBoundaryMeshProjectionError,
} from '@barocss/cad-interop/qualified-body-boundary-mesh';
import type {
  BaroCadQualifiedBodyBoundaryMeshOptions,
  BaroCadQualifiedBodyBoundaryMeshRead,
} from '@barocss/cad-interop/qualified-body-boundary-mesh';
import type {
  QualifiedTranslatedStripBodyMeshResult,
  QualifiedTranslatedStripBodyMeshReport,
} from '@barocss/cad';

/** Selected declarations only. Importing this file performs no admission. */
export type BoundaryMeshProfile = BaroCadQualifiedBodyBoundaryMeshRead['profile'];
export type BoundaryMeshProjection = BaroCadQualifiedBodyBoundaryMeshRead['projection'];
export type BoundaryMeshChunk = BoundaryMeshProjection['chunks'][number];
export const options: BaroCadQualifiedBodyBoundaryMeshOptions = { unitsPerMillimeter: 0.001 };
export const readers: {
  parse: (text: string, options: BaroCadQualifiedBodyBoundaryMeshOptions) => BaroCadQualifiedBodyBoundaryMeshRead;
  read: (input: unknown, options: BaroCadQualifiedBodyBoundaryMeshOptions) => BaroCadQualifiedBodyBoundaryMeshRead;
} = { parse: parseBaroCadQualifiedBodyBoundaryMesh, read: readBaroCadQualifiedBodyBoundaryMesh };

export function consumeBoundaryMeshDeclarations(text: string, owned: QualifiedTranslatedStripBodyMeshResult): BaroCadQualifiedBodyBoundaryMeshRead {
  const parsed = readers.parse(text, options), copied = readers.read(owned, options);
  const native: QualifiedTranslatedStripBodyMeshResult = parsed.native;
  const report: QualifiedTranslatedStripBodyMeshReport = parsed.validationReport;
  const profile: BoundaryMeshProfile = parsed.profile;
  const projection: BoundaryMeshProjection = parsed.projection;
  const sourceText: string | null = parsed.sourceText;
  const copiedText: string | null = copied.sourceText;
  const scale: 0.001 = profile.unitsPerMillimeter;
  const schema: 'barocss-qualified-body-boundary-mesh-ingestion' = profile.schema;
  const nativePacketSchema: 'barocss-qualified-translated-strip-body-mesh' = profile.nativePacketSchema;
  const nativeReportSchema: 'barocss-qualified-translated-strip-body-mesh-report' = profile.nativeReportSchema;
  const renderer: false = profile.capabilities.renderer;
  const nativeQualifiedMesh: true = profile.capabilities.nativeQualifiedMesh;
  const rendererNeutralProjection: true = profile.capabilities.rendererNeutralProjection;
  const rawLimit: 4194304 = profile.limits.utf8Bytes;
  const chunk: BoundaryMeshChunk = projection.chunks[0];
  const positions: Float32Array = chunk.positions;
  const normals: Float32Array = chunk.normals;
  const nativeUV: Float64Array = chunk.nativeUV;
  const indices: Uint32Array = chunk.indices;
  const authorityIndices: Uint32Array = chunk.authorityIndices;
  const faceSampleIndices: Uint32Array = chunk.faceSampleIndices;
  const triangleIndices: Uint32Array = chunk.triangleIndices;
  const nativeGaps: Float64Array = chunk.nativeQuantizationGapsMM;
  const sourcePacket: QualifiedTranslatedStripBodyMeshResult['packet'] = native.packet;
  const samples: QualifiedTranslatedStripBodyMeshResult['faceSamples'] = native.faceSamples;
  void [native, report, scale, schema, nativePacketSchema, nativeReportSchema,
    renderer, nativeQualifiedMesh, rendererNeutralProjection, rawLimit, sourceText,
    copiedText, positions, normals, nativeUV, indices, authorityIndices,
    faceSampleIndices, triangleIndices, nativeGaps, sourcePacket, samples,
    native.body.models, native.renderChunks, native.edgePaths, native.proof,
    projection.measurements, chunk.conversionMeasurements, chunk.supportRef, chunk.metadata];
  return parsed;
}

export function consumeBoundaryMeshErrors(error: unknown): BaroCadQualifiedBodyBoundaryMeshDiagnosticCode | null {
  if (error instanceof BaroCadQualifiedBodyBoundaryMeshReadError) {
    const code: BaroCadQualifiedBodyBoundaryMeshDiagnosticCode = error.code;
    const cause: unknown = error.cause;
    const nativeCode: BaroCadQualifiedBodyBoundaryMeshDiagnosticCode = BaroCadQualifiedBodyBoundaryMeshDiagnosticCode.NATIVE;
    void [cause, nativeCode]; return code;
  }
  if (error instanceof BaroCadQualifiedBodyBoundaryMeshProjectionError) {
    const code: 'SCALE' | 'FLOAT32' | 'ASSOCIATION' | 'TRIANGLE' = error.code;
    const path: string = error.path;
    void [code, path];
  }
  return null;
}

/** Compiler canaries run against the actual selected published declarations. */
export function consumeBoundaryMeshCanaries(profile: BoundaryMeshProfile): void {
  if (false) {
    // @ts-expect-error Explicit scale is the literal 0.001, not any positive number.
    readers.parse('{}', { unitsPerMillimeter: 1 });
    // @ts-expect-error Fixed profile metadata is readonly even for same-value assignment.
    profile.version = profile.version;
    // @ts-expect-error Nested fixed limits are readonly.
    profile.limits.utf8Bytes = profile.limits.utf8Bytes;
    // @ts-expect-error Nested capabilities are readonly.
    profile.capabilities.renderer = profile.capabilities.renderer;
  }
}
