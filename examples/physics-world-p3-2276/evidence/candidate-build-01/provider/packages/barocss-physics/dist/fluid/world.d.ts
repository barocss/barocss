import type { FluidStaticBox } from './static-box.js';
import type { FluidWorld } from './types.js';
export declare function createFluidWorld(scene: unknown): FluidWorld;
export declare function createFluidWorldWithObstacle(scene: unknown, box: FluidStaticBox): FluidWorld & {
    getObstacleHits(): number;
};
