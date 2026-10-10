import type { CadAssemblyResult, CadAssemblyEvaluatedInstance, CadAssemblyInstancePointQuery } from '@barocss/cad';
import type { CadEditorDownload } from './types.js';

export type CadEditorAssemblySelection = Pick<CadAssemblyInstancePointQuery,
  'assemblyId' | 'assemblyRevision' | 'instanceId' | 'reference'>;
export type CadEditorAssemblyPoseField = 'xMM' | 'yMM' | 'zMM' | 'rxDeg' | 'ryDeg' | 'rzDeg' | 'parentId';
export interface CadEditorAssemblyDisplay { instanceIds: string[] }
export interface CadEditorAssemblySessionOptions { displayInstanceIds: string[] }
export interface CadEditorAssemblyOpenOptions { displayInstanceIds: string[] }
export interface CadEditorAssemblySelectedInstance {
  binding: CadEditorAssemblySelection;
  instance: CadAssemblyEvaluatedInstance;
}
export interface CadEditorAssemblyPending {
  target: CadEditorAssemblySelection | null;
  fields: Partial<Record<CadEditorAssemblyPoseField, string>>;
}
export interface CadEditorAssemblyCandidate {
  token: string;
  baseGeneration: number;
  baseDisplayGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo' | 'display';
  result: CadAssemblyResult;
  display: CadEditorAssemblyDisplay;
  selectionTarget: CadEditorAssemblySelection | null;
}
export interface CadEditorAssemblySnapshot {
  mode: 'assembly';
  accepted: CadAssemblyResult;
  generation: number;
  displayGeneration: number;
  display: CadEditorAssemblyDisplay;
  selection: CadEditorAssemblySelectedInstance | null;
  pending: CadEditorAssemblyPending;
  candidate: CadEditorAssemblyCandidate | null;
  history: { index: number; count: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
}
export interface CadEditorAssemblySession {
  getSnapshot(): CadEditorAssemblySnapshot;
  subscribe(listener: (snapshot: CadEditorAssemblySnapshot) => void): () => void;
  selectInstance(instanceId: string, binding?: CadEditorAssemblySelection): CadEditorAssemblySnapshot;
  stagePoseField(field: CadEditorAssemblyPoseField, raw: string): CadEditorAssemblySnapshot;
  discardPending(): CadEditorAssemblySnapshot;
  prepareApply(): CadEditorAssemblyCandidate | null;
  prepareDisplayInstances(instanceIds: string[]): CadEditorAssemblyCandidate | null;
  prepareOpen(authoredText: string, options?: CadEditorAssemblyOpenOptions): CadEditorAssemblyCandidate;
  prepareUndo(): CadEditorAssemblyCandidate;
  prepareRedo(): CadEditorAssemblyCandidate;
  acceptCandidate(token: string): CadEditorAssemblySnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
