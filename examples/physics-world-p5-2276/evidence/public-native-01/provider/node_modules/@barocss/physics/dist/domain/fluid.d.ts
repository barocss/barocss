import type { Fluid } from '../types.js';
import type { FluidCandidate, FluidDefinition, FluidOutput, Prepared, StaticDomainData } from './types.js';
export declare function initializeFluid(fluid: Fluid, staticData: StaticDomainData): {
    definition: FluidDefinition;
    initial: FluidCandidate;
};
export declare function prepareFluid(definition: FluidDefinition, accepted: FluidCandidate): Prepared<FluidCandidate, FluidOutput>;
