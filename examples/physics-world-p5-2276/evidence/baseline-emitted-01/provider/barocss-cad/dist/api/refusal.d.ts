import { BarocssError, type RefusalWhere } from '../core/barocss-error.js';
export { BarocssError, type RefusalWhere };
/** The facades' own codes; a core refusal keeps the core's code. */
export type FacadeCode = 'NO_BODY' | 'BODY_AMBIGUOUS' | 'BODY_UNKNOWN' | 'PART_UNKNOWN' | 'NAME_TAKEN' | 'SELECTION_EMPTY' | 'SELECTION_ONE' | 'SELECTION_UNKNOWN' | 'FACE_NOT_FLAT' | 'VALUE' | 'UNAVAILABLE' | 'MATERIAL_UNKNOWN' | 'MASS_UNKNOWN' | 'DENSITY' | 'PARAMETER_NAME' | 'PARAMETER_UNKNOWN' | 'PARAMETER_UNBINDABLE' | 'CONFIGURATION_UNKNOWN' | 'FEATURE_UNKNOWN';
/** One of a facade's own refusals. */
export declare const refuse: (code: FacadeCode, message: string, where?: RefusalWhere) => BarocssError;
/** The first bracketed code in a message, if any. */
export declare const bracketedCode: (message: string) => string | undefined;
