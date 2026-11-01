import type { Cloth } from '../types.js';
import type { ClothCandidate, ClothDefinition, ClothOutput, Prepared, StaticDomainData } from './types.js';
export declare function initializeCloth(cloth: Cloth, staticData: StaticDomainData): {
    definition: ClothDefinition;
    initial: ClothCandidate;
};
export declare function prepareCloth(definition: ClothDefinition, accepted: ClothCandidate): Prepared<ClothCandidate, ClothOutput>;
