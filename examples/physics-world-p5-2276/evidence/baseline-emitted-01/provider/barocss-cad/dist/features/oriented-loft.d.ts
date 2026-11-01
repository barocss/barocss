import type { LoftInput } from './loft.js';
import type { LoftLegacyBuilder } from './loft-guide.js';
export declare function orientedLoftSolid(input: LoftInput, legacy: LoftLegacyBuilder): {
    brep: import("../brep/brep-core.js").Brep;
    mass: (density: number) => import("../brep/solid-mass.js").MassProperties;
};
