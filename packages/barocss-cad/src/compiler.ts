import type { Model, Point } from './types.js';
import { CadSyntaxError, type SourceSpan } from './parser.js';
import { compileCadStages } from './model-compiler.js';
import { legacyCadFailure } from './legacy-diagnostics.js';

export interface ExtrusionConstruction {
  outputId: string;
  inputId: string;
  operation: 'extrude';
  vector: Point;
  span: SourceSpan;
  referenceSpan: SourceSpan;
}
export interface ConstructionResult {
  sourceVersion: 1;
  model: Model;
  constructions: ExtrusionConstruction[];
}
export class ConstructionSyntaxError extends CadSyntaxError {
  readonly span: SourceSpan;
  constructor(code: string, message: string, source: string, start: number, end: number) {
    super(code, message, source, start);
    this.name = 'ConstructionSyntaxError';
    this.span = { start, end, line: this.line, column: this.column };
  }
}
/** Original source-v1 result and exceptions over the shared compiler pipeline. */
export function compileConstruction(source: string): ConstructionResult {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  const result = compileCadStages(source, 1);
  if (!result.ok) { const failure = legacyCadFailure(result.error, source, 1); throw new ConstructionSyntaxError(failure.code, failure.detail, source, failure.start, failure.end); }
  return { sourceVersion: 1, model: result.model, constructions: result.constructions };
}
