// R7 (the facades): a refusal as one typed error, in the conventions' shape (api-conventions.md §6): a stable code, the
// person-readable `[CODE] …` message, where it came from, and details. A core refusal is passed through with its code
// and words; a facade's own codes cover only how it was called. cad-model's facade uses this class too.
import { BarocssError, type RefusalWhere } from '../core/barocss-error.js';

// (The class lives in the kernel's core since R7.3a; the facades re-export it.)
export { BarocssError, type RefusalWhere };

/** The facades' own codes; a core refusal keeps the core's code. */
export type FacadeCode = 'NO_BODY' | 'BODY_AMBIGUOUS' | 'BODY_UNKNOWN' | 'PART_UNKNOWN' | 'NAME_TAKEN' | 'SELECTION_EMPTY' | 'SELECTION_ONE' | 'SELECTION_UNKNOWN' | 'FACE_NOT_FLAT' | 'VALUE' | 'UNAVAILABLE' | 'MATERIAL_UNKNOWN' | 'MASS_UNKNOWN' | 'DENSITY';

/** One of a facade's own refusals. */
export const refuse = (code: FacadeCode, message: string, where: RefusalWhere = 'facade') => new BarocssError(code, message, where);

// (The first bracketed code in a core message, as the core writes its typed refusals: `[RADIUS_EXCEEDS_FACE] …`.)
const CODE = /\[([A-Z][A-Z0-9_]+)\]/;

/** The first bracketed code in a message, if any. */
export const bracketedCode = (message: string): string | undefined => CODE.exec(message)?.[1];
