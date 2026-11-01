import type { CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';
/** An import or mesh feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function meshOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
