import type { Curve, Point } from '../types.js';
export declare function preflightExtrusion(curve: Curve, options: {
    id: string;
    vector: Point;
}): {
    id: string;
    vector: Point;
};
