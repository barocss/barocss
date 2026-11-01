import type { CadPartFeature, Result, Tools } from './part-model.js';
/** A band surface feature's evaluation (part-model.ts's operation() for this kind). */
export declare function bandOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result;
