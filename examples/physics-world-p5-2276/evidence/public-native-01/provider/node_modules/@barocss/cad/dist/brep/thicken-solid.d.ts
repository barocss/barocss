import type { Brep } from './brep-core.js';
import type { Surface } from '../types.js';
export interface ThickenSolidRequest {
    readonly id?: string;
    readonly surface: Surface;
    /** The wall, mm. */
    readonly thickness: number;
    /** Which way: along the normal (default), against it, or half each way. */
    readonly side?: 'normal' | 'reverse' | 'both';
    /** Samples each way (default 40). */
    readonly grid?: number;
}
export declare function thickenSolid(req: ThickenSolidRequest): Brep;
