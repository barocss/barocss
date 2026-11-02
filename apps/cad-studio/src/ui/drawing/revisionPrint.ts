import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { modelPrint } from '@barocss/cad-model/drawing/types';

/** Keep legacy node-only stamps for parameter-free parts; include authored parameter values otherwise.
 * The existing JSON key-order policy remains. Drawing settings, including their reference caches, are not inputs.
 */
export function drawingRevisionPrint(doc: Pick<StudioDoc, 'nodes' | 'parameters'>): string {
  return modelPrint(Object.keys(doc.parameters).length ? { nodes: doc.nodes, parameters: doc.parameters } : doc.nodes);
}
