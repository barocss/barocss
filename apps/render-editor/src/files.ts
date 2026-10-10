import { RENDER_EDITOR_LIMITS, serializeRenderEditorDocument } from '@barocss/render-editor';
import type { RenderSceneDocument } from '@barocss/render-editor';

/** Check native File.size before allocating the file contents. */
export async function readSceneFile(file: File): Promise<string> {
  if (file.size > RENDER_EDITOR_LIMITS.fileBytes) {
    throw new Error(`File exceeds ${RENDER_EDITOR_LIMITS.fileBytes} bytes. The current scene is retained.`);
  }
  return file.text();
}

/** Save only authored document data. Renderer output is never serialized. */
export function downloadSceneFile(document: RenderSceneDocument): void {
  const text = serializeRenderEditorDocument(document);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${document.documentId}.render-scene.json`;
  link.hidden = true;
  window.document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
