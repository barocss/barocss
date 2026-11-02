import type { CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';
/** A gear feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function gearOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
