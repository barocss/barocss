import type {
  BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult, BooleanExtrusionFeatureTransaction, BooleanExtrusionParameterTransaction,
  CoplanarFaceBooleanExtrusionMeshOptions, CoplanarFaceBooleanExtrusionPropertiesOptions,
} from '@barocss/cad';
import type {
  BaroCadBooleanExtrusionFeatureMesh, BaroCadBooleanExtrusionFeatureSelection,
} from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import type { BaroCadBooleanExtrusionFeatureProperties } from '@barocss/cad-interop/boolean-extrusion-feature-properties';
import type { CadEditorDownload } from './types.js';

export type CadEditorFeatureProperties = BaroCadBooleanExtrusionFeatureProperties;
export type CadEditorFeaturePropertiesOptions = CoplanarFaceBooleanExtrusionPropertiesOptions;

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
export interface CadEditorFaceCornerBinding {
  graphId: string; revision: number; featureId: string; outputSlotId: string;
  cornerIndex: number; previousLineId: string; previousPoleIndex: 1;
  nextLineId: string; nextPoleIndex: 0;
}
export interface CadEditorFaceCorner {
  binding: CadEditorFaceCornerBinding;
  pointMM: [number, number, number];
}
export interface CadEditorFeatureCandidate {
  token: string; baseGeneration: number; baseDisplayGeneration: number;
  kind: 'apply' | 'open' | 'undo' | 'redo' | 'display' | 'extrusion' | 'parameter' | 'structure';
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
  inspectExtrusionProperties(selection: BaroCadBooleanExtrusionFeatureSelection, options: CadEditorFeaturePropertiesOptions): CadEditorFeatureProperties;
  getFaceCorners(featureId: string): CadEditorFaceCorner[];
  prepareFaceCornerEdit(binding: CadEditorFaceCornerBinding, pointMM: [number, number, number]): CadEditorFeatureCandidate;
  stageLengthParameter(parameterId: string, draft: CadEditorFeatureParameterDraft): void;
  stageBooleanOperation(featureId: string, operation: 'union' | 'intersection' | 'difference'): void;
  discardPending(): void;
  prepareApply(): CadEditorFeatureCandidate | null;
  prepareOpen(text: string, options?: CadEditorFeatureSessionOptions): CadEditorFeatureCandidate;
  prepareDisplayOutputs(outputs: CadEditorFeatureOutput[]): CadEditorFeatureCandidate;
  prepareExtrusionTransaction(request: BooleanExtrusionFeatureTransaction, postDisplayOutputs?: CadEditorFeatureOutput[]): CadEditorFeatureCandidate;
  prepareParameterTransaction(request: BooleanExtrusionParameterTransaction): CadEditorFeatureCandidate;
  prepareReferencedFeatureTransaction(request: BooleanExtrusionFeatureTransaction): CadEditorFeatureCandidate;
  prepareUndo(): CadEditorFeatureCandidate;
  prepareRedo(): CadEditorFeatureCandidate;
  acceptCandidate(token: string): CadEditorFeatureSnapshot;
  cancelCandidate(token: string): void;
  serializeAccepted(): CadEditorDownload;
  markDownloaded(token: string): void;
  dispose(): void;
}
