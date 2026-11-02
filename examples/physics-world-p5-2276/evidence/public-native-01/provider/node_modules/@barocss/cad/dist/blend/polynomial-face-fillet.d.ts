import { type Brep } from '../brep/brep-core.js';
import { type FilletReport } from './rolling-ball.js';
/** INTERNAL: a larger convex round replacing one complete disk strip between a plane and a polynomial extrusion. */
export declare function polynomialFaceFillet(body: Brep, names: readonly [string, string], radius: number, id: string): {
    readonly brep: Brep;
    readonly report: FilletReport;
} | null;
