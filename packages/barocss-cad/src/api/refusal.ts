// R7 (the facades): a refusal as one typed error, in the conventions' shape (api-conventions.md §6): a stable code, the
// person-readable `[CODE] …` message, where it came from, and details. A core refusal is passed through with its code
// and words; a facade's own codes cover only how it was called. cad-model's facade uses this class too.
// (R7.3 gives the core this class; the facades then use the core's.)
export type RefusalWhere = 'facade' | 'evaluate' | 'export';

/** The facades' own codes; a core refusal keeps the core's code. */
export type FacadeCode = 'NO_BODY' | 'BODY_AMBIGUOUS' | 'SELECTION_EMPTY' | 'SELECTION_ONE' | 'SELECTION_UNKNOWN' | 'FACE_NOT_FLAT' | 'VALUE' | 'UNAVAILABLE' | 'MATERIAL_UNKNOWN' | 'MASS_UNKNOWN' | 'DENSITY';

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  /** What else the refusal carries: the core's own words, the feature it named. */
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, where?: RefusalWhere, details?: Record<string, unknown>) {
    // (A core message that already carries its code, `n3: [TANGENT_FACES] edge …`, keeps its words once: the prefix is the code's place.)
    super(`[${code}] ${message.replace(`[${code}] `, '')}`);
    this.name = 'BarocssError'; this.code = code;
    if (where) this.where = where;
    if (details) this.details = details;
  }
}

/** One of a facade's own refusals. */
export const refuse = (code: FacadeCode, message: string, where: RefusalWhere = 'facade') => new BarocssError(code, message, where);

// (The first bracketed code in a core message, as the core writes its typed refusals: `[RADIUS_EXCEEDS_FACE] …`.)
const CODE = /\[([A-Z][A-Z0-9_]+)\]/;

/** The first bracketed code in a message, if any. */
export const bracketedCode = (message: string): string | undefined => CODE.exec(message)?.[1];
