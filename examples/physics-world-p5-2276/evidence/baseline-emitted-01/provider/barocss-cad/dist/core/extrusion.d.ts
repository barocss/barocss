import type { Curve, Point, Surface } from '../types.js';
export interface ExtrusionOptions {
    id: string;
    vector: Point;
}
/**
 * Construct an open rational surface S(u,v) = C(u) + vD, v in [0,1].
 * Output poles use binary64 addition. This operation supplies no caps, solid
 * topology or regularity certificate; a folded/singular surface can fail preview.
 */
export declare function extrudeCurve(curve: Curve, options: ExtrusionOptions): Surface;
