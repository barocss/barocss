import type {
  CadDocumentExportCapability, CadDocumentExportOptions, CadDocumentExportReport,
  CadDocumentExportResult, CadDocumentExportSelection,
  CadDocumentResult, CadDocumentV1, CadGeometryReferenceV0, SurfacePoleEditProvenance,
  CadCurveArcLengthOptions, CadCurveArcLengthResult,
  CurveCurvatureResult, CurveD2Result, SurfaceCurvatureResult, SurfaceD2Result,
} from '@barocss/cad';

export type CadEditorExportCapability = CadDocumentExportCapability;
export type CadEditorExportSelection = CadDocumentExportSelection;
export type CadEditorExportOptions = CadDocumentExportOptions;
export type CadEditorExportReport = CadDocumentExportReport;
export type CadEditorExportResult = CadDocumentExportResult;
export type CadEditorCurveLengthOptions = CadCurveArcLengthOptions;
export type CadEditorCurveLength = CadCurveArcLengthResult;

export interface CadEditorCurveD2 {
  kind: 'curve'; query: 'derivatives'; reference: CadGeometryReferenceV0;
  parameter: number; result: CurveD2Result;
}
export interface CadEditorSurfaceD2 {
  kind: 'surface'; query: 'derivatives'; reference: CadGeometryReferenceV0;
  u: number; v: number; result: SurfaceD2Result;
}
export interface CadEditorCurveCurvature {
  kind: 'curve'; query: 'curvature'; reference: CadGeometryReferenceV0;
  parameter: number; result: CurveCurvatureResult;
}
export interface CadEditorSurfaceCurvature {
  kind: 'surface'; query: 'curvature'; reference: CadGeometryReferenceV0;
  u: number; v: number; result: SurfaceCurvatureResult;
}
export type CadEditorGeometryAnalysisResult = CadEditorCurveD2 | CadEditorSurfaceD2
  | CadEditorCurveCurvature | CadEditorSurfaceCurvature;

export type CadEditorDiagnosticCode = 'INPUT' | 'UNSUPPORTED' | 'BUDGET' | 'STALE' | 'NATIVE' | 'DISPLAY' | 'FILE' | 'REVISION' | 'LIFECYCLE';
export class CadEditorError extends Error {
  readonly code: CadEditorDiagnosticCode;
  readonly context: { documentId?: string; bodyId?: string; field?: string };
  constructor(code: CadEditorDiagnosticCode, message: string, context: CadEditorError['context'] = {}, cause?: unknown) {
    super(message.slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadEditorError'; this.code = code; this.context = { ...context };
  }
}
export type CadEditorPoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export interface CadEditorSessionOptions { displayBodyIds?: string[] }
export interface CadEditorSurfaceSelection { bodyId: string; uIndex: number; vIndex: number }
export interface CadEditorSelectionTarget {
  bodyId: string; uIndex?: number; vIndex?: number; reference?: CadGeometryReferenceV0;
}
export interface CadEditorSelectionTransition {
  token: string; baseGeneration: number; target: CadEditorSelectionTarget;
}
export interface CadEditorSelectedPole extends CadEditorSurfaceSelection {
  reference: CadGeometryReferenceV0;
  accepted: Record<CadEditorPoleField, number>;
  countU: number; countV: number;
}
export interface CadEditorCandidate {
  token: string; baseGeneration: number; baseDisplayGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo' | 'display' | 'rename';
  displayBodyIds: string[];
  result: CadDocumentResult;
  provenance: SurfacePoleEditProvenance[];
}
export interface CadEditorSnapshot {
  accepted: CadDocumentResult;
  generation: number;
  displayGeneration: number;
  displayBodyIds: string[];
  bodyCapabilities: { bodyId: string; canEditSurfacePole: boolean; reason: null | 'curve' | 'surface-profile' | 'asset-has-siblings' }[];
  selectedBodyId: string | null;
  selection: CadEditorSelectedPole | null;
  selectionTransition: CadEditorSelectionTransition | null;
  pending: Partial<Record<CadEditorPoleField, string>>;
  candidate: CadEditorCandidate | null;
  history: { index: number; count: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
  lastProvenance: SurfacePoleEditProvenance[];
}
export interface CadEditorDownload { token: string; text: string; suggestedFilename: string }
export interface CadEditorSession {
  getSnapshot(): CadEditorSnapshot;
  getExportCapabilities(): CadEditorExportCapability[];
  inspectExport(options: CadEditorExportOptions): CadEditorExportReport;
  exportAccepted(options: CadEditorExportOptions): CadEditorExportResult;
  inspectCurveLength(reference: CadGeometryReferenceV0, options: CadEditorCurveLengthOptions): CadEditorCurveLength;
  inspectCurveD2(reference: CadGeometryReferenceV0, parameter: number): CadEditorCurveD2;
  inspectSurfaceD2(reference: CadGeometryReferenceV0, u: number, v: number): CadEditorSurfaceD2;
  inspectCurveCurvature(reference: CadGeometryReferenceV0, parameter: number): CadEditorCurveCurvature;
  inspectSurfaceCurvature(reference: CadGeometryReferenceV0, u: number, v: number): CadEditorSurfaceCurvature;
  subscribe(listener: () => void): () => void;
  requestSelection(target: CadEditorSelectionTarget): CadEditorSelectionTransition | null;
  resolveSelectionTransition(token: string, choice: 'apply' | 'discard' | 'cancel'): CadEditorCandidate | null;
  selectSurfacePole(selection: CadEditorSurfaceSelection): void;
  stageSurfacePoleField(field: CadEditorPoleField, rawText: string): void;
  discardPending(): void;
  prepareApply(): CadEditorCandidate | null;
  prepareOpen(text: string, options?: CadEditorSessionOptions): CadEditorCandidate;
  prepareDisplayBodies(bodyIds: string[]): CadEditorCandidate;
  prepareRenameBody(bodyId: string, name: string): CadEditorCandidate | null;
  prepareUndo(): CadEditorCandidate;
  prepareRedo(): CadEditorCandidate;
  acceptCandidate(token: string): CadEditorSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
export type { CadDocumentV1 };
