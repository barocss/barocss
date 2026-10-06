import type { Model } from './types.js';
import { compileCadStages } from './model-compiler.js';
import { legacyCadFailure } from './legacy-diagnostics.js';

export interface SourceSpan { start: number; end: number; line: number; column: number }
export interface ParsedModel extends Model { spans: Record<string, SourceSpan> }
export class CadSyntaxError extends Error {
  readonly code: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  constructor(code: string, message: string, source: string, offset: number) {
    const lines = source.slice(0, offset).split('\n');
    super(`${code} at ${lines.length}:${lines.at(-1)!.length + 1}: ${message}`);
    this.name = 'CadSyntaxError'; this.code = code; this.offset = offset;
    this.line = lines.length; this.column = lines.at(-1)!.length + 1;
  }
}
/** Original source-v0 result and exceptions over the shared compiler pipeline. */
export function parseModel(source: string): ParsedModel {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  const result = compileCadStages(source, 0);
  if (!result.ok) { const failure = legacyCadFailure(result.error, source, 0); throw new CadSyntaxError(failure.code, failure.detail, source, failure.start); }
  const spans: Record<string, SourceSpan> = Object.create(null);
  for (const node of result.ir.nodes) { const { start, end, line, column } = node.span; spans[node.id] = { start, end, line, column }; }
  return { ...result.model, spans };
}
