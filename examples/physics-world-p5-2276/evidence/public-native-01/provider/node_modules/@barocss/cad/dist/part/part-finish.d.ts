import { type FilletReport } from '../blend/rolling-ball.js';
import type { CadPartFeature, Result, Tools, PartHelpers, Part, Solid } from './part-model.js';
/** A fillet or chamfer feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function finishOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result;
type Point = [number, number, number];
export declare function finishEdges(part: Part, names: string[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail'], reports?: FilletReport[], radii?: readonly {
    at: Point;
    radius: number;
}[], shape?: {
    kind: 'conic';
    rho: number;
} | {
    kind: 'g2';
    tension: number;
}): Solid;
export {};
