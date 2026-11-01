import { NeighborGrid } from './neighbors.js';
export declare function densityKernel(distanceSquared: number): number;
export declare function gradientScale(distanceSquared: number): number;
export declare function densities(positions: Float64Array, grid: NeighborGrid, output: Float64Array): void;
export declare function initialRestDensity(positions: Float64Array): number;
