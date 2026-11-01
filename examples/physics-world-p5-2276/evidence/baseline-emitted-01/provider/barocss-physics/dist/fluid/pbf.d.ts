import type { FluidStaticBox } from './static-box.js';
export declare class PbfSolver {
    private readonly restDensity;
    private readonly visualViscosityCoefficient;
    private readonly staticBox;
    private readonly grid;
    private readonly predicted;
    private readonly combined;
    private readonly density;
    private readonly lambda;
    private readonly corrections;
    private readonly smoothedVelocities;
    private obstacleHits;
    constructor(restDensity: number, visualViscosityCoefficient: number, staticBox?: FluidStaticBox | null);
    private projectDensity;
    step(positions: Float64Array, velocities: Float64Array): {
        boundaryHits: number;
        obstacleHits: number;
    };
}
