import type { BaroCadDocumentPrimitiveOptionsV2 } from '@barocss/cad-interop/document';
import type { ViewerOptions, ViewerState } from '@barocss/viewer';
import type { CadEditorError, CadEditorSession, CadEditorSnapshot } from '../types.js';

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

export interface CadEditorViewportProps {
  session: CadEditorSession;
  displayOptions: CadEditorDisplayOptions;
  fitRequest?: number;
  /** Read the current frame without changing Viewer input, camera or selection. */
  readRequest?: number;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorSnapshot) => void;
  onDisplay?: (receipt: CadEditorDisplayReceipt) => void;
  className?: string;
}

export interface CadEditorInspectorProps {
  session: CadEditorSession;
  onError?: (error: CadEditorError) => void;
  className?: string;
}

export interface CadEditorProps extends CadEditorViewportProps {}
