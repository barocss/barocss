import type { Brep } from './brep-core.js';
import type { Point } from '../types.js';
/** The smallest axis box holding the B-rep: exact on edges, planar faces and whole patches; trimmed curved faces by their mesh at 16 segments a quarter. */
export declare function brepBounds(brep: Brep): {
    min: Point;
    max: Point;
};
