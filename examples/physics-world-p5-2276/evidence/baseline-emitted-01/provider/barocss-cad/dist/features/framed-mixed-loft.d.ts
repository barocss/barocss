import { type LoftLegacyBuilder } from './loft-guide.js';
import { type LoftFrameBasis } from './loft-common-frame.js';
import type { LoftInput } from './loft.js';
export declare function framedMixedLoftSolid(input: LoftInput, frames: readonly LoftFrameBasis[], legacy: LoftLegacyBuilder): {
    brep: import("../brep/brep-core.js").Brep;
    mass: (density: number) => import("../index.js").MassProperties;
};
