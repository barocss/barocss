import type { Point } from '../types.js';
export interface AxisBoxSolidValidationReport {
    valid: true;
    geometryFamily: 'exact-axis-box-solid-v0';
    closed: true;
    solid: true;
    volumeMM3: number;
    areaMM2: number;
    boundsMM: {
        min: Point;
        max: Point;
    };
}
/** One caller snapshot, actual shell validation, then calculation from that same copy. */
export declare function validateAxisBoxSolid(input: unknown): AxisBoxSolidValidationReport;
