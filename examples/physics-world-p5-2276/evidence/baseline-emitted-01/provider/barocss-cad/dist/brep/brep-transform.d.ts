import { type Brep } from './brep-core.js';
/** x' = M·x + t with M row-major 3×3. */
export interface BrepAffine {
    readonly matrix: readonly [number, number, number, number, number, number, number, number, number];
    readonly offset?: readonly [number, number, number];
}
/** A string rename appends a suffix; a function maps each persistent name. */
export declare function transformBrep(brep: Brep, map: BrepAffine, rename?: ((name: string) => string) | string): Brep;
/** Rotation by a multiple of 90° about a coordinate axis: exact entries 0 and ±1. */
export declare function quarterTurn(axis: 'x' | 'y' | 'z', degrees: number): BrepAffine['matrix'];
