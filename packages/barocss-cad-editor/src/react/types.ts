import type { BaroCadDocumentPrimitiveOptionsV2 } from '@barocss/cad-interop/document';
import type { ViewerOptions, ViewerState } from '@barocss/viewer';
import type { CadGeometryReferenceV0 } from '@barocss/cad';
import type { SelectedUniformCurvePreview } from '@barocss/gpu';
import type { CadEditorCandidate, CadEditorError, CadEditorSession, CadEditorSnapshot, CadEditorGeometryAnalysisResult, CadEditorCurveLength } from '../types.js';

export interface CadEditorDisplayOptions {
  viewer: ViewerOptions;
  document: BaroCadDocumentPrimitiveOptionsV2;
}

/** Copied CPU data from the actual Viewer and its rendered RGBA pixels. */
export interface CadEditorDisplayReceipt {
  state: ViewerState;
  pixelHash: string;
  /** Increases after each complete actual RGBA read in the current mount. */
  readIndex: number;
  nonBackgroundPixels: number;
  pixelCount: number;
  width: number;
  height: number;
  backgroundRGB: [number, number, number];
  lifecycle: { mounts: number; disposals: number };
}

/** Actual focused presentation data, without measured pixel diagnostics. */
export interface CadEditorCurvePresentationReceipt {
  state: ViewerState;
  width: number;
  height: number;
  lifecycle: { mounts: number; disposals: number };
  reference: CadGeometryReferenceV0;
  bodyName: string;
  sourceModelName: string;
  curveId: string;
  preview: SelectedUniformCurvePreview;
  generation: number;
  displayGeneration: number;
}
/** Measured focused pixels retain the existing public callback contract. */
export interface CadEditorCurveFocusReceipt extends CadEditorDisplayReceipt, CadEditorCurvePresentationReceipt {}

export interface CadEditorViewportProps {
  session: CadEditorSession;
  displayOptions: CadEditorDisplayOptions;
  fitRequest?: number;
  /** Fit the selected body using its actual native bounds; hidden bodies are refused. */
  fitSelectedRequest?: number;
  /** Read the current frame without changing Viewer input, camera or selection. */
  readRequest?: number;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorSnapshot, candidate: CadEditorCandidate) => void;
  onDisplay?: (receipt: CadEditorDisplayReceipt) => void;
  curvePresentationPolicy?: 'legacy-pixel' | 'native-state';
  curveReadRequest?: number;
  onCurvePresentation?: (receipt: CadEditorCurvePresentationReceipt | null) => void;
  onDisplayInvalidated?: () => void;
  onCurveDisplay?: (receipt: CadEditorCurveFocusReceipt | null) => void;
  className?: string;
}

export interface CadEditorInspectorProps {
  session: CadEditorSession;
  onError?: (error: CadEditorError) => void;
  onAnalysis?: (result: CadEditorGeometryAnalysisResult | null) => void;
  onLength?: (result: CadEditorCurveLength | null) => void;
  className?: string;
}

export interface CadEditorProps extends CadEditorViewportProps {
  onAnalysis?: (result: CadEditorGeometryAnalysisResult | null) => void;
  onLength?: (result: CadEditorCurveLength | null) => void;
}
