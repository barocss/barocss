/** Non-authoritative local file staging for the modeling editor.
 * Decoding a file is never equivalent to authoring or accepting a CAD model:
 * only the existing controller's explicit Open may replace accepted authority.
 */
export const MAX_MODELING_FILE_BYTES = 262144;

export async function readModelingFileText(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<string> {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_MODELING_FILE_BYTES) {
    throw new Error(`Model file must be at most ${MAX_MODELING_FILE_BYTES} bytes.`);
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_MODELING_FILE_BYTES) {
    throw new Error(`Model file must be at most ${MAX_MODELING_FILE_BYTES} bytes.`);
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (text.length > MAX_MODELING_FILE_BYTES) {
    throw new Error('Model text exceeds the editor input limit.');
  }
  if (!text.trim()) {
    throw new Error('Model file is empty.');
  }
  return text;
}
