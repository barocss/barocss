import { CadEditorError, type CadEditorSession, type CadEditorFeatureSession } from '@barocss/cad-editor';

export const MAXIMUM_FILE_BYTES = 2097152;
export async function readCadEditorFile(file: File): Promise<string> {
  if (file.size > MAXIMUM_FILE_BYTES) throw new CadEditorError('BUDGET', 'File exceeds 2097152 bytes.');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (text.length > MAXIMUM_FILE_BYTES || new TextEncoder().encode(text).length > MAXIMUM_FILE_BYTES) throw new CadEditorError('BUDGET', 'File exceeds the text limit.');
    return text;
  } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    throw new CadEditorError('FILE', 'Cannot read this UTF-8 file.', {}, cause);
  }
}
export function downloadAccepted(session: CadEditorSession | CadEditorFeatureSession): void {
  const captured = session.serializeAccepted();
  const url = URL.createObjectURL(new Blob([captured.text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = captured.suggestedFilename;
  document.body.append(anchor);
  try { anchor.click(); session.markDownloaded(captured.token); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
