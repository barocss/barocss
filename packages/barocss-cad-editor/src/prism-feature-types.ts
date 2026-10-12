import type { XYAffinePrismFeatureDocumentV0, XYAffinePrismFeatureResult } from '@barocss/cad';

export interface CadEditorPrismFeatureSummary {
  document: XYAffinePrismFeatureDocumentV0;
  dependencies: XYAffinePrismFeatureResult['report']['dependencies'];
  components: XYAffinePrismFeatureResult['report']['componentRoles'];
  volumes: XYAffinePrismFeatureResult['subtraction']['report']['volumeMM3'];
  selectedWalls: XYAffinePrismFeatureResult['walls'][number]['reference'][];
}
export interface CadEditorPrismFeatureSnapshot {
  accepted: CadEditorPrismFeatureSummary | null;
  authoredText: string | null;
  drafts: Record<string, string>;
  selection: { documentId: string; revision: number; nodeId: string } | null;
  busy: boolean; disposed: boolean; error: string | null;
  history: { index: number; count: number; canUndo: boolean; canRedo: boolean };
}
/** Private worker transport: only authored data and a small native summary cross it. */
export type PrismFeatureCommand = { id: number } & (
  { kind: 'open'; text: string }
  | { kind: 'apply'; expectedRevision: number; edits: { parameterId: string; valueMM: number }[] }
);
export type PrismFeatureReply = { id: number } & (
  { ok: true; text: string; summary: CadEditorPrismFeatureSummary }
  | { ok: false; message: string }
);
