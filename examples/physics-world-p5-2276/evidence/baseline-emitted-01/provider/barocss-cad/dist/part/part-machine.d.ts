import type { Result, CadPartFeature, Tools, PartHelpers } from './part-model.js';
/** A machine-element feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function machineOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
