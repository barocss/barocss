import type { CadDocumentResult, CadDocumentV1, CadGeometryReferenceV0, SurfacePoleEditProvenance } from '@barocss/cad';

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
  token: string; baseGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo';
  result: CadDocumentResult;
  provenance: SurfacePoleEditProvenance[];
}
export interface CadEditorSnapshot {
  accepted: CadDocumentResult;
  generation: number;
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
  subscribe(listener: () => void): () => void;
  requestSelection(target: CadEditorSelectionTarget): CadEditorSelectionTransition | null;
  resolveSelectionTransition(token: string, choice: 'apply' | 'discard' | 'cancel'): CadEditorCandidate | null;
  selectSurfacePole(selection: CadEditorSurfaceSelection): void;
  stageSurfacePoleField(field: CadEditorPoleField, rawText: string): void;
  discardPending(): void;
  prepareApply(): CadEditorCandidate | null;
  prepareOpen(text: string): CadEditorCandidate;
  prepareUndo(): CadEditorCandidate;
  prepareRedo(): CadEditorCandidate;
  acceptCandidate(token: string): CadEditorSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
export type { CadDocumentV1 };
