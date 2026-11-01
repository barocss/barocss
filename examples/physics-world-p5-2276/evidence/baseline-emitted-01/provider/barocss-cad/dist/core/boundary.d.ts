import type { Curve, Surface } from '../types.js';
export type SurfaceBoundary = 'v-min' | 'u-max' | 'v-max' | 'u-min';
export interface SurfaceBoundaryOptions {
    boundary: SurfaceBoundary;
    id: string;
}
/** Four geometric parameter boundaries, with no trim/wire/topology claim. */
export declare function extractSurfaceBoundary(surface: Surface, options: SurfaceBoundaryOptions): Curve;
