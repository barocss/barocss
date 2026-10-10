import type {
  NurbsSourceLoftFeatureGraphOptions, NurbsSourceLoftFeatureGraphResult,
  NurbsSourceLoftFeatureGraphUpdateResult,
} from '@barocss/cad';
import type { CadEditorDownload } from './types.js';

export type CadEditorLoftPoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export type CadEditorLoftNodeBinding = NurbsSourceLoftFeatureGraphResult['bindings']['nodes'][number];
export type CadEditorLoftView = { kind: 'loft' } | { kind: 'section'; nodeId: string };
export interface CadEditorLoftSessionOptions {
  native: NurbsSourceLoftFeatureGraphOptions;
  initialView?: CadEditorLoftView;
}
export interface CadEditorLoftPoleSelection {
  nodeId: string;
  index: number;
  binding?: CadEditorLoftNodeBinding;
}
export interface CadEditorLoftSelectedPole {
  nodeId: string;
  index: number;
  binding: CadEditorLoftNodeBinding;
  poleCount: number;
  accepted: Record<CadEditorLoftPoleField, number>;
}
export interface CadEditorLoftPending {
  target: CadEditorLoftPoleSelection | null;
  fields: Partial<Record<CadEditorLoftPoleField, string>>;
}
export interface CadEditorLoftCandidate {
  token: string;
  baseGeneration: number;
  baseDisplayGeneration: number;
  kind: 'apply' | 'suppress' | 'open' | 'undo' | 'redo' | 'view';
  result: NurbsSourceLoftFeatureGraphResult;
  transaction: NurbsSourceLoftFeatureGraphUpdateResult['transaction'] | null;
  view: CadEditorLoftView;
  selectionTarget: { nodeId: string; index: number } | null;
}
export interface CadEditorLoftSnapshot {
  mode: 'nurbs-source-loft';
  accepted: NurbsSourceLoftFeatureGraphResult;
  generation: number;
  displayGeneration: number;
  view: CadEditorLoftView;
  selection: CadEditorLoftSelectedPole | null;
  pending: CadEditorLoftPending;
  candidate: CadEditorLoftCandidate | null;
  history: { count: number; index: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
  lastTransaction: CadEditorLoftCandidate['transaction'];
}
export interface CadEditorLoftSession {
  getSnapshot(): CadEditorLoftSnapshot;
  subscribe(listener: (snapshot: CadEditorLoftSnapshot) => void): () => void;
  selectPole(input: CadEditorLoftPoleSelection): CadEditorLoftSnapshot;
  stagePoleField(field: CadEditorLoftPoleField, raw: string): CadEditorLoftSnapshot;
  discardPending(): CadEditorLoftSnapshot;
  prepareApply(): CadEditorLoftCandidate | null;
  prepareSuppression(suppressed: boolean): CadEditorLoftCandidate | null;
  prepareView(view: CadEditorLoftView): CadEditorLoftCandidate | null;
  prepareOpen(authoredText: string): CadEditorLoftCandidate;
  prepareUndo(): CadEditorLoftCandidate;
  prepareRedo(): CadEditorLoftCandidate;
  acceptCandidate(token: string): CadEditorLoftSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
