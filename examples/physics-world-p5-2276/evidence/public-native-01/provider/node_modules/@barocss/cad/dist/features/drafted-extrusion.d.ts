import { type Brep } from '../brep/brep-core.js';
import { type ProfileSegmentInput } from './extruded-profile-solid.js';
export interface DraftedExtrusionInput {
    readonly profile: readonly ProfileSegmentInput[];
    readonly z0: number;
    readonly z1: number;
    /** Degrees, |θ| < 89: positive leans the walls into the material towards z1. */
    readonly draft: number;
    /** Face names: `${tag}.side{i}`, `${tag}.top`, `${tag}.bottom` (as an upright extrusion's). */
    readonly tag: string;
    /** The sketch's segment tags (R10a, D86): sides named `${tag}.side[t]` instead of by position. */
    readonly sideTags?: readonly string[];
    readonly id?: string;
}
export declare function draftedExtrusion(input: DraftedExtrusionInput): Brep;
