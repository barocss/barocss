import { CadEditorError } from '@barocss/cad-editor';

export const MAXIMUM_ASSEMBLY_FILE_BYTES = 16777216;

/** Whole native assemblies have their own envelope; embedded documents remain native data. */
export async function readCadAssemblyFile(file: File): Promise<string> {
  if (file.size > MAXIMUM_ASSEMBLY_FILE_BYTES) throw new CadEditorError('BUDGET', 'Assembly files are limited to 16 MiB.');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (text.length > MAXIMUM_ASSEMBLY_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAXIMUM_ASSEMBLY_FILE_BYTES)
      throw new CadEditorError('BUDGET', 'Assembly files are limited to 16 MiB.');
    return text;
  } catch (cause) {
    throw cause instanceof CadEditorError ? cause : new CadEditorError('FILE', 'Cannot read this UTF-8 assembly file.', {field:'assembly-file'}, cause);
  }
}
