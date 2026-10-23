// R7 (the facade): a refusal as one typed error, in the conventions' shape (api-conventions.md §6): a stable code, the
// person-readable `[CODE] …` message, where it came from, and details. The facade never makes up its own geometry
// rules: a core refusal is passed through with its code and words; the facade's own codes cover only how it was called
// (a part with no body yet, a selection that picks nothing, a material it does not know).
// (R7.3 gives the core this class; this one then becomes a re-export of it.)
import type { FriendlyError } from '../engine/errors';

export type RefusalWhere = 'facade' | 'evaluate' | 'export';

/** The facade's own codes; a core refusal keeps the core's code. */
export type FacadeCode = 'NO_BODY' | 'BODY_AMBIGUOUS' | 'BOX_NOT_FIRST' | 'SELECTION_EMPTY' | 'MATERIAL_UNKNOWN' | 'MASS_UNKNOWN';

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  /** The core's own words for a refusal it made (`friendly`: title, hint and detail, as the studio shows them). */
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, where?: RefusalWhere, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'BarocssError'; this.code = code;
    if (where) this.where = where;
    if (details) this.details = details;
  }
}

/** One of the facade's own refusals. */
export const refuse = (code: FacadeCode, message: string, where: RefusalWhere = 'facade') => new BarocssError(code, message, where);

// (The first bracketed code in a core message, as the core writes its typed refusals: `[RADIUS_EXCEEDS_FACE] …`.)
const CODE = /\[([A-Z][A-Z0-9_]+)\]/;

/** A core refusal from an evaluation, its code taken from the kernel's words (or EVALUATION where it names none). */
export function fromEvaluation(error: FriendlyError): BarocssError {
  const code = CODE.exec(error.detail)?.[1] ?? CODE.exec(error.title)?.[1] ?? 'EVALUATION';
  return new BarocssError(code, error.detail || error.title, 'evaluate', { friendly: error });
}

/** A core refusal from an export, written as a sentence (stepFor's `{ error }`). */
export function fromExport(message: string): BarocssError {
  return new BarocssError(CODE.exec(message)?.[1] ?? 'EXPORT', message, 'export');
}
