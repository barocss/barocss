import type { PrintPreviewSettings, StudioDoc } from '@barocss/cad-model/engine/doc';
import { checkDocumentPrintPreview, checkPrintPreview } from '@barocss/cad-model/engine/printPreview';
import { refused } from '@barocss/cad-model/engine/refusal';
import type { PrintOptions } from './usePrintLayers';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { madeBodies } from '@barocss/cad-model/engine/elements';
import { lookOf } from '@barocss/cad-model/app/bodies';

/** What print layers slice: the bodies the part's own process makes (O160: a bought element — an O-ring, a bearing — is not printed), less those hidden. */
export function printSourceMeshes(doc: StudioDoc, bodies: readonly BodyResult[]): DisplayMesh[] {
  return madeBodies(doc.nodes, bodies).filter(b => !lookOf(doc, b).hidden).map(b => b.mesh);
}

export type PrintPreviewPatch = Partial<Omit<PrintPreviewSettings, 'version'>>;

/** Display defaults do not author settings, the estimated layer height, or a build direction. */
export function printOptionsOf(doc: StudioDoc, limitDeg?: number): PrintOptions {
  const [problem] = checkDocumentPrintPreview(doc);
  if (problem) throw refused(problem);
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
  const [documentProblem] = checkDocumentPrintPreview(doc);
  if (documentProblem) throw refused(documentProblem);
  const saved: PrintPreviewSettings = { version: 1, ...doc.printPreview, ...patch };
  const [problem] = checkPrintPreview(saved);
  if (problem) throw refused(problem);
  if ('layer' in patch && patch.layer === undefined) delete saved.layer;
  if ('layerMM' in patch && patch.layerMM === undefined) delete saved.layerMM;
  if ('supports' in patch && patch.supports === undefined) delete saved.supports;
  if ('printed' in patch && patch.printed === undefined) delete saved.printed;
  return { ...doc, printPreview: saved };
}
