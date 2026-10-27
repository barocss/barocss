import type { PrintLayer, PrintLayers } from '@barocss/cad-model/print/layers';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

/** Ephemeral result of the actual Model print-layers-v1 API; all display coordinates are bed mm. */
export type PrintSummary = Omit<PrintLayers, 'layer'>;
export interface PrintDisplay {
  request: number;
  summaryKey: number;
  summary: PrintSummary;
  layer: PrintLayer;
  /** Full summary columns extruded once, shared between lazy layer updates. Never a native CAD body. */
  supportMesh: DisplayMesh;
  top: number;
  supports: boolean;
  printed: boolean;
}
