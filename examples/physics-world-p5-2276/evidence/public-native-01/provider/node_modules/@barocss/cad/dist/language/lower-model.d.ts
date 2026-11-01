import type { Model } from '../types.js';
import type { ExtrusionConstruction } from '../document/construction-types.js';
import type { CadModelIR } from './semantic-model.js';
/** Internal lowering consumes the resolved compiler-owned IR only. */
export declare function lowerCadIR(ir: CadModelIR): {
    model: Model;
    constructions: ExtrusionConstruction[];
};
