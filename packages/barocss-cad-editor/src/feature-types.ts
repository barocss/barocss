import type {
  BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult, BooleanExtrusionFeatureTransaction,
  CoplanarFaceBooleanExtrusionMeshOptions,
} from '@barocss/cad';
import type {
  BaroCadBooleanExtrusionFeatureMesh, BaroCadBooleanExtrusionFeatureSelection,
} from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import type { CadEditorDownload } from './types.js';

export interface CadEditorFeatureSessionOptions {
  native: BooleanExtrusionFeatureGraphOptions;
  display: { featureId: string; outputSlotId: string };
  mesh: CoplanarFaceBooleanExtrusionMeshOptions;
}
export type CadEditorFeatureParameterDraft =
  | { kind: 'literal'; rawValueMM: string }
  | { kind: 'offset'; parameterId: string; rawOffsetMM: string };
export interface CadEditorFeaturePending {
  parameters: Record<string, CadEditorFeatureParameterDraft>;
  booleanOperations: Record<string, 'union' | 'intersection' | 'difference'>;
}
export interface CadEditorFeatureDisplay extends BaroCadBooleanExtrusionFeatureMesh {
  selection: BaroCadBooleanExtrusionFeatureSelection;
}
export interface CadEditorFeatureOutput {
  selection: BaroCadBooleanExtrusionFeatureSelection;
  mesh: CoplanarFaceBooleanExtrusionMeshOptions;
}
export interface CadEditorFeatureCandidate {
  token: string; baseGeneration: number; baseDisplayGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo' | 'display' | 'extrusion';
  result: BooleanExtrusionFeatureGraphResult;
  display: CadEditorFeatureDisplay;
  displays: CadEditorFeatureDisplay[];
}
export interface CadEditorFeatureSnapshot {
  mode: 'boolean-extrusion';
  accepted: BooleanExtrusionFeatureGraphResult;
  display: CadEditorFeatureDisplay;
  displays: CadEditorFeatureDisplay[];
  generation: number;
  displayGeneration: number;
  selectedFeatureId: string | null;
  pending: CadEditorFeaturePending;
  candidate: CadEditorFeatureCandidate | null;
  history: { index: number; count: number; bytes: number; canUndo: boolean; canRedo: boolean };
  dirty: boolean;
  downloadStatus: 'Not downloaded' | 'Download started';
  disposed: boolean;
}
export interface CadEditorFeatureSession {
  getSnapshot(): CadEditorFeatureSnapshot;
  subscribe(listener: () => void): () => void;
  selectFeature(featureId: string): void;
  stageLengthParameter(parameterId: string, draft: CadEditorFeatureParameterDraft): void;
  stageBooleanOperation(featureId: string, operation: 'union' | 'intersection' | 'difference'): void;
  discardPending(): void;
  prepareApply(): CadEditorFeatureCandidate | null;
  prepareOpen(text: string, options?: CadEditorFeatureSessionOptions): CadEditorFeatureCandidate;
  prepareDisplayOutputs(outputs: CadEditorFeatureOutput[]): CadEditorFeatureCandidate;
  prepareExtrusionTransaction(request: BooleanExtrusionFeatureTransaction, postDisplayOutputs?: CadEditorFeatureOutput[]): CadEditorFeatureCandidate;
  prepareUndo(): CadEditorFeatureCandidate;
  prepareRedo(): CadEditorFeatureCandidate;
  acceptCandidate(token: string): CadEditorFeatureSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
