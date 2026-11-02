import { type LoftFrameBasis } from './loft-common-frame.js';
import type { LoftInput } from './loft.js';
import type { LoftLegacyBuilder } from './loft-guide.js';
export declare function framedNurbsLoftSolid(input: LoftInput, frames: readonly LoftFrameBasis[], legacy: LoftLegacyBuilder): {
    brep: import("../brep/brep-core.js").Brep;
    mass: (density: number) => import("../index.js").MassProperties;
};
