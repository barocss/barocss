import type { Point } from './types.js';

export interface SourceSpan { start: number; end: number; line: number; column: number }
export interface ExtrusionConstruction {
  outputId: string;
  inputId: string;
  operation: 'extrude';
  vector: Point;
  span: SourceSpan;
  referenceSpan: SourceSpan;
}
