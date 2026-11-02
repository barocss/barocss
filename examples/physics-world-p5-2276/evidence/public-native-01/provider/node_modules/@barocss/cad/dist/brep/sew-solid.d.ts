import { type Brep } from './brep-core.js';
import type { Surface } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
/** This module's refusal (R7.3a batch 2: the SewError class folded, D279): a BarocssError, `details.source` 'sew'. */
export declare const sewError: (message: string) => KernelError & {
    readonly code: "SEW";
};
/** Whether something thrown is this module's refusal. */
export declare const isSewError: (e: unknown) => e is KernelError & {
    readonly code: "SEW";
};
export interface SewSolidRequest {
    /** The body's id (also the faces' names' prefix). */
    readonly id?: string;
    readonly surfaces: readonly Surface[];
    /** Edges and corners closer than this (mm) are one; default 1e-3 of the surfaces' size, at least 1e-6. */
    readonly tolerance?: number;
}
export declare function sewSolid(req: SewSolidRequest): Brep;
