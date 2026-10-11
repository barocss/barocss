import type { QualifiedTranslatedStripBodyResult, TranslatedStripPlaneSplitResult } from '@barocss/cad';

export interface CadEditorSplitSessionOptions { initialPresentation: 'original' | 'split' }
export type CadEditorSplitPresentation = { kind: 'original'; body: QualifiedTranslatedStripBodyResult }
  | { kind: 'split'; result: TranslatedStripPlaneSplitResult };
export interface CadEditorSplitPending { cutY?: string }
export interface CadEditorSplitCandidate {
  token: string;
  kind: 'apply' | 'open' | 'undo' | 'redo';
  baseGeneration: number;
  baseDisplayGeneration: number;
  result: TranslatedStripPlaneSplitResult;
  presentation: CadEditorSplitPresentation;
}
export interface CadEditorSplitSnapshot {
  accepted: TranslatedStripPlaneSplitResult;
  presentation: CadEditorSplitPresentation;
  generation: number;
  displayGeneration: number;
  pending: CadEditorSplitPending;
  candidate: CadEditorSplitCandidate | null;
  history: { index: number; count: number; bytesUTF8: number; bytesUTF16: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
}
export interface CadEditorSplitDownload { token: string; text: string; suggestedFilename: string }
export interface CadEditorSplitSession {
  getSnapshot(): CadEditorSplitSnapshot;
  subscribe(listener: () => void): () => void;
  stageCutYField(rawText: string): CadEditorSplitSnapshot;
  discardPending(): CadEditorSplitSnapshot;
  prepareApply(): CadEditorSplitCandidate | null;
  prepareOpen(authoredText: string): CadEditorSplitCandidate;
  prepareUndo(): CadEditorSplitCandidate;
  prepareRedo(): CadEditorSplitCandidate;
  /** CPU session commit only; a future display consumer must admit the whole real display first. */
  acceptCandidate(token: string): CadEditorSplitSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorSplitDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
