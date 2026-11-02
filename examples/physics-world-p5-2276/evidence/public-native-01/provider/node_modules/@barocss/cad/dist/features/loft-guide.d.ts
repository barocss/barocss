import type { loftSolid, LoftInput } from './loft.js';
import type { LoftNurbsGuideInput } from './loft-nurbs-guide.js';
import type { Point } from '../types.js';
export declare function admitLoftGuide(value: unknown, start: Point, end: Point, normal: Point, endpointDetail?: string): {
    degree: number;
    knots: number[];
    controls: (lo: Point, hi: Point) => Point[];
    offset: (t: number) => Point;
};
export type LoftGuide = ReturnType<typeof admitLoftGuide>;
export type LoftGuideFactory = (start: Point, end: Point) => LoftGuide;
export type LoftLegacyBuilder = (input: LoftInput, guide?: LoftGuideFactory, nurbsGuide?: LoftNurbsGuideInput) => ReturnType<typeof loftSolid>;
