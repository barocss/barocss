import type {
  CadDocumentExportCapability, CadDocumentExportOptions, CadDocumentExportReport,
  CadDocumentExportResult, CadDocumentExportSelection,
  CadDocumentResult, CadDocumentV1, CadGeometryReferenceV0, SurfacePoleEditProvenance,
  CadCurveArcLengthOptions, CadCurveArcLengthResult,
  CurveCurvatureResult, CurveD2Result, CurvePoleEditProvenance, SurfaceCurvatureResult, SurfaceD2Result,
  AffineGeometryTransformReport, SourceCurveIntervalExtractionResult, SourceSurfaceKnotInsertionResult, SourceCurveKnotInsertionResult, SurfaceIsoCurveResult, JoinedCurveResult, SourceSurfaceDegreeElevationResult, ExtractedSurfaceRegionResult,
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
export type CadEditorBodyTranslationField = Exclude<CadEditorPoleField, 'weight'>;
export type CadEditorCurveIntervalField = 'min' | 'max';
export type CadEditorSurfaceIsoCurveAxis = 'u' | 'v';
export type CadEditorSurfaceDegreeElevationAxis = 'u' | 'v';
export type CadEditorSurfaceRegionField = 'uMin' | 'uMax' | 'vMin' | 'vMax';
export interface CadEditorSurfaceRegionCreation {
  sourceReference: CadGeometryReferenceV0;
  assetId: string;
  bodyId: string;
  result: ExtractedSurfaceRegionResult;
}
export interface CadEditorCurveJoinCreation {
  leftReference: CadGeometryReferenceV0;
  rightReference: CadGeometryReferenceV0;
  assetId: string;
  bodyId: string;
  result: JoinedCurveResult;
}
export interface CadEditorSurfaceIsoCurveCreation {
  sourceReference: CadGeometryReferenceV0;
  assetId: string;
  bodyId: string;
  result: SurfaceIsoCurveResult;
}
export type CadEditorDraftField = CadEditorPoleField | 'angleDegrees' | 'scaleFactor' | 'intervalMin' | 'intervalMax' | 'surfaceKnotU' | 'surfaceKnotV' | 'curveKnot' | 'surfaceIsoU' | 'surfaceIsoV'
  | 'surfaceRegionUMin' | 'surfaceRegionUMax' | 'surfaceRegionVMin' | 'surfaceRegionVMax';
export type CadEditorEditTarget = 'pole' | 'object' | 'rotation' | 'scale';
export type CadEditorRotationAxis = 'x' | 'y' | 'z';
export type CadEditorScaleAxis = 'uniform' | 'x' | 'y' | 'z';
export interface CadEditorBodyTranslation {
  reference: CadGeometryReferenceV0;
  resultReference: CadGeometryReferenceV0;
  offsetMM: [number, number, number];
  report: AffineGeometryTransformReport;
}
export interface CadEditorBodyRotation {
  reference: CadGeometryReferenceV0;
  resultReference: CadGeometryReferenceV0;
  axis: CadEditorRotationAxis;
  angleDegrees: number;
  pivotMM: [number, number, number];
  report: AffineGeometryTransformReport;
}
export interface CadEditorBodyScale {
  reference: CadGeometryReferenceV0;
  resultReference: CadGeometryReferenceV0;
  axis: CadEditorScaleAxis;
  factor: number;
  pivotMM: [number, number, number];
  report: AffineGeometryTransformReport;
}
export type CadEditorView = { kind: 'document' } | { kind: 'curve-focus'; bodyId: string; count: number };
export interface CadEditorSessionOptions { displayBodyIds?: string[]; view?: CadEditorView }
export interface CadEditorSurfaceSelection { bodyId: string; uIndex: number; vIndex: number }
export interface CadEditorCurveSelection { bodyId: string; index: number }
export interface CadEditorSelectedCurvePole extends CadEditorCurveSelection {
  reference: CadGeometryReferenceV0;
  count: number;
  accepted: Record<CadEditorPoleField, number>;
}
export interface CadEditorSelectionTarget {
  bodyId: string; uIndex?: number; vIndex?: number; index?: number; reference?: CadGeometryReferenceV0;
}
export interface CadEditorSelectionTransition {
  token: string; baseGeneration: number; target: CadEditorSelectionTarget;
}
export interface CadEditorDuplicateBodyOptions { name?: string }
export interface CadEditorSelectedPole extends CadEditorSurfaceSelection {
  reference: CadGeometryReferenceV0;
  accepted: Record<CadEditorPoleField, number>;
  countU: number; countV: number;
}
export interface CadEditorCandidate {
  token: string; baseGeneration: number; baseDisplayGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo' | 'display' | 'rename' | 'duplicate' | 'curve-interval' | 'surface-knot' | 'curve-knot' | 'surface-isocurve' | 'curve-join' | 'surface-degree-elevation' | 'surface-region';
  selectionTarget?: CadEditorSelectionTarget | null;
  presentation?: 'structural';
  curveInterval?: SourceCurveIntervalExtractionResult;
  curveKnot?: SourceCurveKnotInsertionResult;
  clearCurvePoleSelection?: true;
  surfaceIsoCurve?: CadEditorSurfaceIsoCurveCreation;
  surfaceRegion?: CadEditorSurfaceRegionCreation;
  curveJoin?: CadEditorCurveJoinCreation;
  surfaceKnot?: SourceSurfaceKnotInsertionResult;
  surfaceDegreeElevation?: SourceSurfaceDegreeElevationResult;
  clearSurfacePoleSelection?: true;
  displayBodyIds: string[];
  view: CadEditorView;
  result: CadDocumentResult;
  provenance: SurfacePoleEditProvenance[];
  curveProvenance: CurvePoleEditProvenance[];
  bodyTranslation: CadEditorBodyTranslation | null;
  bodyRotation: CadEditorBodyRotation | null;
  bodyScale: CadEditorBodyScale | null;
}
export interface CadEditorSnapshot {
  accepted: CadDocumentResult;
  generation: number;
  displayGeneration: number;
  displayBodyIds: string[];
  view: CadEditorView;
  editTarget: CadEditorEditTarget;
  rotationAxis: CadEditorRotationAxis;
  scaleAxis: CadEditorScaleAxis;
  bodyCapabilities: { bodyId: string; canEditSurfacePole: boolean; canEditCurvePole: boolean;
    canTranslateBody: boolean; translationReason: null | 'translation-profile';
    canRotateBody: boolean; rotationReason: null | 'rotation-profile';
    canScaleBody: boolean; scaleReason: null | 'scale-profile';
    reason: null | 'curve' | 'curve-profile' | 'surface-profile' | 'asset-has-siblings' }[];
  selectedBodyId: string | null;
  selection: CadEditorSelectedPole | null;
  curveSelection: CadEditorSelectedCurvePole | null;
  selectionTransition: CadEditorSelectionTransition | null;
  pending: Partial<Record<CadEditorDraftField, string>>;
  candidate: CadEditorCandidate | null;
  history: { index: number; count: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
  lastProvenance: SurfacePoleEditProvenance[];
  lastCurveProvenance: CurvePoleEditProvenance[];
  lastBodyTranslation: CadEditorBodyTranslation | null;
  lastBodyRotation: CadEditorBodyRotation | null;
  lastBodyScale: CadEditorBodyScale | null;
  lastCurveInterval: SourceCurveIntervalExtractionResult | null;
  lastSurfaceKnot: SourceSurfaceKnotInsertionResult | null;
  lastCurveKnot: SourceCurveKnotInsertionResult | null;
  lastSurfaceIsoCurve: CadEditorSurfaceIsoCurveCreation | null;
  lastSurfaceRegion: CadEditorSurfaceRegionCreation | null;
  lastCurveJoin: CadEditorCurveJoinCreation | null;
  lastSurfaceDegreeElevation: SourceSurfaceDegreeElevationResult | null;
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
  selectCurvePole(selection: CadEditorCurveSelection): void;
  setEditTarget(target: CadEditorEditTarget): void;
  setRotationAxis(axis: CadEditorRotationAxis): void;
  stageBodyRotation(rawAngleDegrees: string): void;
  setScaleAxis(axis: CadEditorScaleAxis): void;
  stageBodyScale(rawFactor: string): void;
  stageBodyTranslationField(field: CadEditorBodyTranslationField, rawText: string): void;
  stageSurfacePoleField(field: CadEditorPoleField, rawText: string): void;
  stageCurvePoleField(field: CadEditorPoleField, rawText: string): void;
  stageCurveIntervalField(field: CadEditorCurveIntervalField, rawText: string): void;
  stageSurfaceKnotField(axis: 'u' | 'v', rawText: string): void;
  stageSurfaceIsoCurveField(axis: CadEditorSurfaceIsoCurveAxis, rawText: string): void;
  stageSurfaceRegionField(field: CadEditorSurfaceRegionField, rawText: string): void;
  stageCurveKnotField(rawText: string): void;
  discardPending(): void;
  prepareApply(): CadEditorCandidate | null;
  prepareOpen(text: string, options?: CadEditorSessionOptions): CadEditorCandidate;
  prepareDisplayBodies(bodyIds: string[]): CadEditorCandidate;
  prepareCurveFocus(bodyId: string, count: number): CadEditorCandidate;
  prepareDocumentView(): CadEditorCandidate;
  prepareRenameBody(bodyId: string, name: string): CadEditorCandidate | null;
  prepareDuplicateBody(bodyId: string, options?: CadEditorDuplicateBodyOptions): CadEditorCandidate;
  prepareCurveJoin(rightBodyId: string): CadEditorCandidate;
  prepareSurfaceDegreeElevation(axis: CadEditorSurfaceDegreeElevationAxis): CadEditorCandidate;
  prepareUndo(): CadEditorCandidate;
  prepareRedo(): CadEditorCandidate;
  acceptCandidate(token: string): CadEditorSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
export type { CadDocumentV1 };
