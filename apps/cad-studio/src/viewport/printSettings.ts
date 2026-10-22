import type { PrintPreviewSettings, StudioDoc } from '@barocss/cad-model/engine/doc';
import { documentPrintPreviewProblem, printPreviewProblem } from '@barocss/cad-model/engine/printPreview';
import type { PrintOptions } from './usePrintLayers';

export type PrintPreviewPatch = Partial<Omit<PrintPreviewSettings, 'version'>>;

/** Display defaults do not author settings, the estimated layer height, or a build direction. */
export function printOptionsOf(doc: StudioDoc, limitDeg?: number): PrintOptions {
  const problem = documentPrintPreviewProblem(doc);
  if (problem) throw new Error(problem);
  const saved = doc.printPreview;
  const direction: PrintOptions['direction'] = doc.print ? [...doc.print.direction] : undefined;
  return {
    layer: saved?.layer ?? 0,
    supports: saved?.supports ?? true,
    printed: saved?.printed ?? true,
    ...(saved?.layerMM !== undefined ? { layerMM: saved.layerMM } : {}),
    ...(direction ? { direction } : {}),
    ...(limitDeg !== undefined ? { limitDeg } : {}),
  };
}

/** Apply one immutable document edit. Explicit undefined removes a saved optional control. */
export function withPrintPreviewSettings(doc: StudioDoc, patch: PrintPreviewPatch): StudioDoc {
  const documentProblem = documentPrintPreviewProblem(doc);
  if (documentProblem) throw new Error(documentProblem);
  const saved: PrintPreviewSettings = { version: 1, ...doc.printPreview, ...patch };
  const problem = printPreviewProblem(saved);
  if (problem) throw new Error(problem);
  if ('layer' in patch && patch.layer === undefined) delete saved.layer;
  if ('layerMM' in patch && patch.layerMM === undefined) delete saved.layerMM;
  if ('supports' in patch && patch.supports === undefined) delete saved.supports;
  if ('printed' in patch && patch.printed === undefined) delete saved.printed;
  return { ...doc, printPreview: saved };
}
