import {
  parseBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraph,
  parseBaroCadNurbsSourceLoftFeatureGraphUpdate,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
  BaroCadNurbsSourceLoftReadError,
  BaroCadNurbsSourceLoftDiagnosticCode,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
import type {
  BaroCadNurbsSourceLoftFeatureGraphRead,
  BaroCadNurbsSourceLoftFeatureGraphUpdateRead,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
import type {
  NurbsSourceLoftFeatureGraphResult,
  NurbsSourceLoftFeatureGraphUpdateResult,
  NurbsSourceLoftFeatureGraphReport,
  NurbsSourceLoftFeatureGraphTransactionReport,
} from '@barocss/cad';

/** Selected public declaration consumer. No function is called by this file. */
export type GraphIngestionProfile = BaroCadNurbsSourceLoftFeatureGraphRead['profile'];
export type UpdateIngestionProfile = BaroCadNurbsSourceLoftFeatureGraphUpdateRead['profile'];

export const readers: {
  parseGraph: (text: string) => BaroCadNurbsSourceLoftFeatureGraphRead;
  readGraph: (input: unknown) => BaroCadNurbsSourceLoftFeatureGraphRead;
  parseUpdate: (text: string) => BaroCadNurbsSourceLoftFeatureGraphUpdateRead;
  readUpdate: (input: unknown) => BaroCadNurbsSourceLoftFeatureGraphUpdateRead;
} = {
  parseGraph: parseBaroCadNurbsSourceLoftFeatureGraph,
  readGraph: readBaroCadNurbsSourceLoftFeatureGraph,
  parseUpdate: parseBaroCadNurbsSourceLoftFeatureGraphUpdate,
  readUpdate: readBaroCadNurbsSourceLoftFeatureGraphUpdate,
};

export function consumeGraphDeclarations(
  text: string, owned: NurbsSourceLoftFeatureGraphResult,
): BaroCadNurbsSourceLoftFeatureGraphRead {
  const parsed: BaroCadNurbsSourceLoftFeatureGraphRead = readers.parseGraph(text);
  const copied: BaroCadNurbsSourceLoftFeatureGraphRead = readers.readGraph(owned);
  const native: NurbsSourceLoftFeatureGraphResult = parsed.native;
  const validationReport: NurbsSourceLoftFeatureGraphReport = parsed.validationReport;
  const profile: GraphIngestionProfile = parsed.profile;
  const role: 'graph' = profile.packetRole;
  const nativeSchema: 'barocss-nurbs-source-loft-feature-graph' = profile.nativeSchema;
  const sourceFrame: 'authored-xyz-no-axis-conversion' = profile.sourceFrame;
  const lengthUnit: 'mm' = profile.lengthUnit;
  const updateReceipt: false = profile.capabilities.updateReceipt;
  const renderer: false = profile.capabilities.renderer;
  const sourceText: string | null = parsed.sourceText;
  const ownedSourceText: string | null = copied.sourceText;
  const loft: NurbsSourceLoftFeatureGraphResult['loft'] = native.loft;
  void [validationReport, role, nativeSchema, sourceFrame, lengthUnit,
    updateReceipt, renderer, sourceText, ownedSourceText, loft, native.document,
    native.originalSources, native.evaluatedNodes, native.bindings, native.report];
  return parsed;
}

export function consumeUpdateDeclarations(
  text: string, owned: NurbsSourceLoftFeatureGraphUpdateResult,
): BaroCadNurbsSourceLoftFeatureGraphUpdateRead {
  const parsed: BaroCadNurbsSourceLoftFeatureGraphUpdateRead = readers.parseUpdate(text);
  const copied: BaroCadNurbsSourceLoftFeatureGraphUpdateRead = readers.readUpdate(owned);
  const native: NurbsSourceLoftFeatureGraphUpdateResult = parsed.native;
  const graph: NurbsSourceLoftFeatureGraphResult = native.result;
  const validationReport: NurbsSourceLoftFeatureGraphTransactionReport = parsed.validationReport;
  const transactionReport: NurbsSourceLoftFeatureGraphTransactionReport = native.transaction.report;
  const profile: UpdateIngestionProfile = parsed.profile;
  const role: 'update' = profile.packetRole;
  const nativeSchema: 'barocss-nurbs-source-loft-feature-graph-transaction' = profile.nativeSchema;
  const updateReceipt: true = profile.capabilities.updateReceipt;
  const topology: false = profile.capabilities.topology;
  const sourceText: string | null = parsed.sourceText;
  void [graph, validationReport, transactionReport, role, nativeSchema,
    updateReceipt, topology, sourceText, copied.sourceText,
    native.transaction.request.previousDocument, native.transaction.request.options,
    native.transaction.request.edits, graph.loft];
  return parsed;
}

export function consumeErrorDeclarations(error: unknown): BaroCadNurbsSourceLoftDiagnosticCode | null {
  if (!(error instanceof BaroCadNurbsSourceLoftReadError)) return null;
  const code: BaroCadNurbsSourceLoftDiagnosticCode = error.code;
  const cause: unknown = error.cause;
  const nativeCode: BaroCadNurbsSourceLoftDiagnosticCode = BaroCadNurbsSourceLoftDiagnosticCode.NATIVE;
  void [cause, nativeCode];
  return code;
}

/** Compiler-only checks: fixed metadata is deeply readonly, native data remains CAD data. */
export function consumeReadonlyProfileDeclarations(profile: GraphIngestionProfile): void {
  if (false) {
    // @ts-expect-error Public ingestion metadata is readonly, even for same-value assignment.
    profile.version = profile.version;
    // @ts-expect-error Nested fixed limits are readonly.
    profile.limits.depth = profile.limits.depth;
    // @ts-expect-error Nested capabilities are readonly.
    profile.capabilities.renderer = profile.capabilities.renderer;
  }
}
