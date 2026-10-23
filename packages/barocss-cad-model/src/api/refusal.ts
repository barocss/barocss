// R7 (the facade): a refusal as one typed error — its code, its message and where it came from. The facade never makes
// up its own geometry rules: a core refusal is passed through with its code and words; the facade's own codes cover
// only how it was called (a part with no body yet, a selection that picks nothing, a material it does not know).
// (R7.3 moves the core to one shape { code, message, where }; this class takes that shape now and follows it.)
import type { FriendlyError } from '../engine/errors';

export type RefusalWhere = 'facade' | 'evaluate' | 'export';

export class ApiRefusal extends Error {
  readonly code: string;
  readonly where: RefusalWhere;
  /** The core's own words for a refusal it made (title, hint and detail), as the studio shows them. */
  readonly friendly?: FriendlyError;
  constructor(code: string, message: string, where: RefusalWhere, friendly?: FriendlyError) {
    super(`[${code}] ${message}`);
    this.name = 'ApiRefusal'; this.code = code; this.where = where;
    if (friendly) this.friendly = friendly;
  }
}

// (The first bracketed code in a core message, as the core writes its typed refusals: `[RADIUS_EXCEEDS_FACE] …`.)
const CODE = /\[([A-Z][A-Z0-9_]+)\]/;

/** A core refusal from an evaluation, its code taken from the kernel's words (or EVALUATION where it names none). */
export function fromEvaluation(error: FriendlyError): ApiRefusal {
  const code = CODE.exec(error.detail)?.[1] ?? CODE.exec(error.title)?.[1] ?? 'EVALUATION';
  return new ApiRefusal(code, error.detail || error.title, 'evaluate', error);
}

/** A core refusal from an export, written as a sentence (stepFor's `{ error }`). */
export function fromExport(message: string): ApiRefusal {
  return new ApiRefusal(CODE.exec(message)?.[1] ?? 'EXPORT', message, 'export');
}
