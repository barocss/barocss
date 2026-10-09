import { compileCadModel } from '@barocss/cad';
import { RENDER_MIXED_DOCUMENT_LIMITS, RenderMixedDocumentError } from './mixed-document.js';

export interface RenderNativeSourceImport {
  readonly sourceVersion: 0;
  readonly source: string;
  readonly modelId: string;
  readonly objects: readonly { readonly id: string; readonly kind: 'surface' | 'curve' }[];
  readonly surfaces: readonly { readonly id: string }[];
}

/** Inspect original source through CAD compilation. This is not mixed-frame admission. */
export function prepareRenderNativeSourceImport(source: string): RenderNativeSourceImport {
  if (typeof source !== 'string' || source.length === 0) {
    throw new RenderMixedDocumentError('INPUT', 'Import a nonempty original CAD source file.');
  }
  if (source.length > RENDER_MIXED_DOCUMENT_LIMITS.sourceCodeUnits
    || new TextEncoder().encode(source).length > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes) {
    throw new RenderMixedDocumentError('BYTES', 'CAD source exceeds 65536 UTF-8 bytes or code units.');
  }
  let compiled: ReturnType<typeof compileCadModel>;
  try { compiled = compileCadModel(source, { sourceVersion: 0 }); }
  catch (cause) { throw new RenderMixedDocumentError('SOURCE', 'Original CAD source could not compile.', cause); }
  if (!compiled.ok) {
    throw new RenderMixedDocumentError('SOURCE', 'Original CAD source could not compile.', compiled.diagnostics);
  }
  const objects = Object.freeze(compiled.model.objects.map((object) => Object.freeze({ id: object.id, kind: object.kind })));
  const surfaces = Object.freeze(compiled.model.objects.filter((object) => object.kind === 'surface')
    .map((object) => Object.freeze({ id: object.id })));
  if (surfaces.length === 0) throw new RenderMixedDocumentError('QUALIFICATION', 'Import a CAD source with at least one Surface.');
  return Object.freeze({ sourceVersion: 0, source, modelId: compiled.model.name, objects, surfaces });
}
