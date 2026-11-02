import { type CadLibrary, type CadLibraryFit, type CadLibraryFitEnd, type CadLibraryInterface } from './library.js';
/** A rigid placement: p ↦ R p + t (R row-major 3 × 3). */
export interface LibraryPlacement {
    readonly rotation: readonly number[];
    readonly translation: readonly [number, number, number];
}
/**
 * Where b goes so that its interface meets a's: R takes b's frame (x, y, z) to (x_a, −y_a, −z_a) — facing — and t puts
 * b's origin at a's moved by `offset` (along a's x, y, z). Frames in their parts' own coordinates; the result in a's.
 */
export declare function placeByInterfaces(a: CadLibraryInterface, b: CadLibraryInterface, offset?: readonly number[]): LibraryPlacement;
/**
 * A fit's result: the overlap as placed; whether the parts touch — pushed `contactProbe` further into a (along −z of
 * a's interface) they overlap — so a fit is not passed by parts standing apart; ok when both hold.
 */
export interface LibraryFitReport {
    readonly id: string;
    readonly overlap: number;
    readonly maxOverlap: number;
    readonly contact: boolean;
    readonly contactProbe: number;
    readonly ok: boolean;
    readonly placement: LibraryPlacement;
    readonly warnings: readonly string[];
    /** The fit's own rules over both parts' values, each met or not (with its value). */
    readonly checks: readonly {
        readonly id: string;
        readonly pass: boolean;
        readonly value?: number;
        readonly message: string;
    }[];
}
/** A declared fit (or one given): both parts built, b placed onto a, their overlap by the exact Boolean intersection. */
export declare function checkLibraryFit(lib: CadLibrary, fit: string | {
    readonly a: CadLibraryFitEnd;
    readonly b: CadLibraryFitEnd;
    readonly offset?: readonly number[];
    readonly maxOverlap?: number;
    readonly id?: string;
    readonly checks?: CadLibraryFit['checks'];
}): LibraryFitReport;
