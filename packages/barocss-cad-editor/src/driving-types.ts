import type { DrivenMixedSketchLinesDocumentV0, DrivenMixedSketchLinesResult, XYLinearSketchConstraintV1 } from '@barocss/cad';
import type { CadEditorDownload } from './types.js';

export type CadEditorDrivingSketchConstraintField = 'distanceMM' | 'xMM' | 'yMM';
export interface CadEditorDrivingSketchView { profileId: string }
export interface CadEditorDrivingSketchSessionOptions { initialProfileId: string }
export interface CadEditorDrivingSketchSelection {
  generation: number;
  native: DrivenMixedSketchLinesResult['target']['worldPointBindings'][number];
}
export interface CadEditorDrivingSketchPending {
  fields: Record<string, Partial<Record<CadEditorDrivingSketchConstraintField, string>>>;
}
export interface CadEditorDrivingSketchCandidate {
  token: string;
  baseGeneration: number;
  baseDisplayGeneration: number;
  kind: 'apply' | 'add' | 'remove' | 'open' | 'undo' | 'redo' | 'view';
  result: DrivenMixedSketchLinesResult;
  view: CadEditorDrivingSketchView;
  selectionTarget: { profileId: string; pointId: string } | null;
}
export interface CadEditorDrivingSketchSnapshot {
  mode: 'driven-mixed-sketch-lines';
  accepted: DrivenMixedSketchLinesResult;
  generation: number;
  displayGeneration: number;
  selectedScopeIds: DrivenMixedSketchLinesDocumentV0['selectedProfileIds'];
  view: CadEditorDrivingSketchView;
  selection: CadEditorDrivingSketchSelection | null;
  pending: CadEditorDrivingSketchPending;
  candidate: CadEditorDrivingSketchCandidate | null;
  history: { index: number; count: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
}
export interface CadEditorDrivingSketchSession {
  getSnapshot(): CadEditorDrivingSketchSnapshot;
  subscribe(listener: (snapshot: CadEditorDrivingSketchSnapshot) => void): () => void;
  selectPoint(profileId: string, pointId: string, binding?: CadEditorDrivingSketchSelection): CadEditorDrivingSketchSnapshot;
  stageConstraintField(constraintId: string, field: CadEditorDrivingSketchConstraintField, raw: string): CadEditorDrivingSketchSnapshot;
  discardPending(): CadEditorDrivingSketchSnapshot;
  prepareApply(): CadEditorDrivingSketchCandidate | null;
  prepareConstraintAddition(constraint: XYLinearSketchConstraintV1): CadEditorDrivingSketchCandidate;
  prepareConstraintRemoval(constraintId: string): CadEditorDrivingSketchCandidate;
  prepareView(profileId: string): CadEditorDrivingSketchCandidate | null;
  prepareOpen(text: string, options?: CadEditorDrivingSketchSessionOptions): CadEditorDrivingSketchCandidate;
  prepareUndo(): CadEditorDrivingSketchCandidate;
  prepareRedo(): CadEditorDrivingSketchCandidate;
  acceptCandidate(token: string): CadEditorDrivingSketchSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
