import type { GpuDiagnostic } from '@barocss/gpu';

export type RenderEditorErrorCode =
  | 'DOCUMENT_INPUT' | 'DOCUMENT_VERSION' | 'DOCUMENT_BYTES' | 'SOURCE_REFUSED'
  | 'STALE_CANDIDATE' | 'PRESENTATION_REFUSED' | 'HISTORY_LIMIT' | 'DISPOSED';

/** Own bounded diagnostic copies; compiler objects never enter authoring history. */
export function copyRenderEditorDiagnostics(diagnostics: readonly GpuDiagnostic[]): readonly GpuDiagnostic[] {
  return Object.freeze(diagnostics.slice(0, 32).map((item) => Object.freeze({
    code: item.code.slice(0, 128), severity: 'error' as const, message: item.message.slice(0, 2048),
    range: item.range === null ? null : Object.freeze({
      start: item.range.start, end: item.range.end, line: item.range.line, column: item.range.column,
    }),
    ...(item.objectId === undefined ? {} : { objectId: item.objectId.slice(0, 128) }),
    ...(item.dataPath === undefined ? {} : { dataPath: item.dataPath.slice(0, 256) }),
  })));
}

export class RenderEditorError extends Error {
  readonly code: RenderEditorErrorCode;
  readonly diagnostics: readonly GpuDiagnostic[];
  constructor(code: RenderEditorErrorCode, message: string, diagnostics: readonly GpuDiagnostic[] = []) {
    super(message);
    this.name = 'RenderEditorError';
    this.code = code;
    this.diagnostics = copyRenderEditorDiagnostics(diagnostics);
  }
}

export function normalizeRenderEditorError(error: unknown, code: RenderEditorErrorCode = 'DOCUMENT_INPUT'): RenderEditorError {
  if (error instanceof RenderEditorError) return error;
  const descriptor = error !== null && typeof error === 'object'
    ? Object.getOwnPropertyDescriptor(error, 'message') : undefined;
  const message = descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
    ? descriptor.value.slice(0, 2048) : typeof error === 'string' ? error.slice(0, 2048) : 'Invalid render editor input';
  return new RenderEditorError(code, message);
}
