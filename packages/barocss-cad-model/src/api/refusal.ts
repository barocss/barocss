// R7 (cad-model's facade): the one typed error of the facades (@barocss/cad/api's BarocssError, the conventions' shape,
// api-conventions.md §6), and how cad-model's core refusals become it. A core refusal is passed through with its code and
// words; the facade's own codes cover only how it was called.
import { BarocssError, bracketedCode } from '@barocss/cad/api';
import type { FriendlyError } from '../engine/errors';

export { BarocssError, refuse, type FacadeCode, type RefusalWhere } from '@barocss/cad/api';

/**
 * A core refusal from an evaluation: its code the core's own (`FriendlyError.code`: the kernel's bracketed code, or its
 * error's kind), else a bracketed code in its words, else EVALUATION.
 */
export function fromEvaluation(error: FriendlyError): BarocssError {
  const code = error.code ?? bracketedCode(error.detail) ?? bracketedCode(error.title) ?? 'EVALUATION';
  return new BarocssError(code, error.detail || error.title, 'evaluate', { friendly: error });
}

/** A core refusal from an export, written as a sentence (stepFor's `{ error }`). */
export function fromExport(message: string): BarocssError {
  return new BarocssError(bracketedCode(message) ?? 'EXPORT', message, 'export');
}
