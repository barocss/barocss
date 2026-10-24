// R7 (gpu's facade): a refusal as one typed error, in the conventions' shape (api-conventions.md §6) — the same shape as
// cad's and cad-model's facades. gpu imports neither of them; the class is gpu's own, core/barocss-error.ts (R7.3a), the
// one every refusal of the package is.
import { BarocssError } from '../core/barocss-error.js';
export { BarocssError };

export type RefusalWhere = 'facade' | 'show';

/** gpu's facade's own codes. */
export type SceneCode = 'MESH_INVALID' | 'LIGHT_INVALID' | 'MATERIAL_UNKNOWN' | 'MATERIAL_INVALID' | 'CAMERA_INVALID';

/** A facade refusal: its message bracketed with its code, as the conventions write it. */
export const refuse = (code: SceneCode, message: string, where: RefusalWhere = 'facade') => new BarocssError(code, `[${code}] ${message.replace(`[${code}] `, '')}`, { where });
