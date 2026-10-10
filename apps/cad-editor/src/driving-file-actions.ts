import { CadEditorError } from '@barocss/cad-editor';

export const MAXIMUM_DRIVING_FILE_BYTES = 262144;

/** Authored driving recipes use the native family's own UTF-8 and UTF-16 envelope. */
export async function readCadDrivingSketchFile(file: File): Promise<string> {
  if (file.size > MAXIMUM_DRIVING_FILE_BYTES)
    throw new CadEditorError('BUDGET', 'Driving Sketch files are limited to 262144 bytes.', { field: 'driving-file' });
  try {
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAXIMUM_DRIVING_FILE_BYTES)
      throw new CadEditorError('BUDGET', 'Driving Sketch files are limited to 262144 bytes.', { field: 'driving-file' });
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.length > MAXIMUM_DRIVING_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAXIMUM_DRIVING_FILE_BYTES)
      throw new CadEditorError('BUDGET', 'Driving Sketch files exceed the native text limit.', { field: 'driving-file' });
    return text;
  } catch (cause) {
    throw cause instanceof CadEditorError ? cause
      : new CadEditorError('FILE', 'Cannot read this UTF-8 driving Sketch file.', { field: 'driving-file' }, cause);
  }
}
