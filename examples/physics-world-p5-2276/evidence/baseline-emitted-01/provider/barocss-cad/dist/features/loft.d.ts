import { type Brep } from '../brep/brep-core.js';
import { type ProfileSegmentInput } from './extruded-profile-solid.js';
import { type MassProperties } from '../brep/solid-mass.js';
import { type LoftNurbsGuideInput } from './loft-nurbs-guide.js';
/** Explicit world-space section frame. Coordinates are mm; the perpendicular unit axes include twist. */
export interface LoftSectionFrame {
    readonly origin: readonly [number, number, number];
    readonly xAxis: readonly [number, number, number];
    readonly yAxis: readonly [number, number, number];
}
/** Polygon/arc loops keep their existing z path. Two to eight conic sections can use explicit identical-axis parallel frames. */
export type LoftSectionInput = ({
    readonly profile: readonly ProfileSegmentInput[];
} & ({
    readonly z: number;
    readonly frame?: never;
} | {
    readonly frame: LoftSectionFrame;
    readonly z?: never;
})) | {
    /** Loft-only conic on identical-axis parallel frames; +X seam, clockwise normalized to ccw. */
    readonly profile: {
        readonly kind: 'ellipse';
        readonly center: readonly [number, number];
        readonly radii: readonly [number, number];
        readonly direction?: 'ccw' | 'cw';
    };
    readonly frame: LoftSectionFrame;
    readonly z?: never;
};
export interface LoftInput {
    readonly id: string;
    readonly sections: readonly LoftSectionInput[];
    /** Names faces `${name}.bottom`, `.top` and `.side${i}` (two sections, or smooth) or `.s${k}.side${i}`. */
    readonly name: string;
    /** Through three or more sections: one smooth (C1) side per edge instead of a ruled side per span. */
    readonly smooth?: boolean;
    /** One seam guide: polynomial NURBS on 2–8 height or identical-axis rigid frames; Bezier on its existing two-frame path. */
    readonly guide?: {
        readonly kind: 'quadratic-bezier';
        readonly controlPoints: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
    } | {
        readonly kind: 'cubic-bezier';
        readonly controlPoints: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
    } | LoftNurbsGuideInput;
    /**
     * The first section's segment tags (R10a, D86): each side named `side[t]` by the segment of the first section it
     * runs from (several from one segment numbered `#k`), instead of by position.
     */
    readonly sideTags?: readonly string[];
}
export declare function loftSolid(input: LoftInput): {
    brep: Brep;
    mass: (density: number) => MassProperties;
};
