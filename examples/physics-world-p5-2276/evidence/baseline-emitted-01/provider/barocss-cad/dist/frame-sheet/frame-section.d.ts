import type { ProfileSegmentInput, XY } from '../features/extruded-profile-solid.js';
import { type KernelError } from '../core/barocss-error.js';
/** A section kind's numbers, resolved (millimetres). */
export type FrameSectionSpec = {
    readonly kind: 'rect-tube';
    readonly width: number;
    readonly height: number;
    readonly wall: number;
    readonly outerRadius: number;
    readonly innerRadius?: number;
} | {
    readonly kind: 'round-tube';
    readonly diameter: number;
    readonly wall: number;
} | {
    readonly kind: 'angle';
    readonly legX: number;
    readonly legY: number;
    readonly thickness: number;
    readonly rootRadius: number;
    readonly toeRadius: number;
} | {
    readonly kind: 'channel';
    readonly height: number;
    readonly width: number;
    readonly web: number;
    readonly flange: number;
    readonly rootRadius: number;
    readonly toeRadius?: number;
    readonly flangeSlope?: number;
} | {
    readonly kind: 'i-beam';
    readonly height: number;
    readonly width: number;
    readonly web: number;
    readonly flange: number;
    readonly rootRadius: number;
    readonly toeRadius: number;
    readonly flangeSlope: number;
} | {
    readonly kind: 'tslot';
    readonly size: number;
    readonly cells: 1 | 2;
    readonly openSlots: number;
    readonly opening: number;
    readonly lip: number;
    readonly undercut: number;
    readonly depth: number;
    readonly bore: number;
};
/** A built section: loops in its own XY, the name of each segment (each loop's in order), area, centroid and box. */
export interface FrameSection {
    readonly outer: readonly ProfileSegmentInput[];
    readonly outerNames: readonly string[];
    readonly holes: readonly (readonly ProfileSegmentInput[])[];
    readonly holeNames: readonly (readonly string[])[];
    readonly area: number;
    readonly centroid: XY;
    readonly box: {
        readonly min: XY;
        readonly max: XY;
    };
    /** A short description, `rect-tube 40 × 40 × 3, ro 6, ri 3 (concentric)`. */
    readonly label: string;
    /**
     * Dimensions not given but derived by a geometric rule (never a material or catalogue value), and how: a rectangular
     * tube's bore radius left out is concentric with its outer corners, `{ innerRadius: 'concentric: ro − t' }`.
     */
    readonly derived?: Readonly<Record<string, string>>;
}
/** A section's dimensions refused: the part model's PARAMETER code, the message starting `[SECTION_DIMENSIONS]`. */
export declare const frameSectionError: (detail: string) => KernelError & {
    readonly code: "SECTION_DIMENSIONS";
};
/** Whether something thrown is this module's refusal. */
export declare const isFrameSectionError: (e: unknown) => e is KernelError & {
    readonly code: "SECTION_DIMENSIONS";
};
/** A section kind built from its numbers; refused `[SECTION_DIMENSIONS]` where they do not make one. */
export declare function frameSection(spec: FrameSectionSpec): FrameSection;
/** The places in a section a member's line can run through: its centroid, its own origin, and its box's nine points. */
export declare const FRAME_ANCHORS: readonly ["centroid", "origin", "bottom-left", "bottom", "bottom-right", "left", "center", "right", "top-left", "top", "top-right"];
export type FrameAnchor = typeof FRAME_ANCHORS[number];
/** An anchor's point in the section's XY, given its centroid and box. */
export declare function anchorPoint(anchor: FrameAnchor, centroid: XY, box: {
    readonly min: XY;
    readonly max: XY;
}): XY;
/** A loop's box exactly: its segments' starts and each arc's extreme points on the axes it sweeps past. */
export declare function loopBox(segments: readonly ProfileSegmentInput[]): {
    min: XY;
    max: XY;
};
/** A member as built (FR1, D123): its section, where its line runs and the section's frame in the part. */
export interface FrameMemberReport {
    /** Circular spine or tangent bend: dimensions in evaluated part coordinates; developed length follows the section centroid. */
    readonly curve?: {
        readonly kind: 'arc' | 'bend';
        readonly center: readonly [number, number, number];
        readonly axis: readonly [number, number, number];
        readonly radius: number;
        readonly centroidRadius: number;
        readonly angle: number;
        readonly startTangent: readonly [number, number, number];
        readonly endTangent: readonly [number, number, number];
        readonly developedLength: number;
        readonly straightLengths: readonly [number, number];
        readonly segmentIndices: readonly number[];
    };
    /** The section kind and its description (`rect-tube 40 × 40 × 3, ro 6`; a sketch section: `sketch <id>`). */
    readonly sectionKind: string;
    readonly section: string;
    /** Its area and centroid in the section's own XY (closed forms; a sketch section's by its prism's exact mass). */
    readonly area: number;
    readonly centroid: XY;
    /** The section's dimensions derived by a geometric rule, and how (`FrameSection.derived`). */
    readonly derived?: Readonly<Record<string, string>>;
    /** The section's point on the member's line (`anchor`), and how far the section is moved from it (`offset`, in its XY). */
    readonly anchor: FrameAnchor;
    readonly offset: XY;
    readonly roll: number;
    /** The section turned over across its own y axis (FR2, D124). */
    readonly mirrored?: true;
    /** Its section symmetric about its own x or y through its centroid, so a reversed piece is the same piece (FR4a, D127). */
    readonly reversible?: boolean;
    /** A frame's member (FR2, D124): its index and the skeleton points it runs from and to. */
    readonly frame?: {
        readonly member: number;
        readonly from: number;
        readonly to: number;
    };
    /** The member's line, its length, its direction (the extrusion's) and the section's x and y in the part. */
    readonly start: readonly [number, number, number];
    readonly end: readonly [number, number, number];
    readonly length: number;
    readonly axis: readonly [number, number, number];
    readonly xAxis: readonly [number, number, number];
    readonly yAxis: readonly [number, number, number];
    /** The up reference was along the member, so the section's y came from this one instead. */
    readonly upFallback?: readonly [number, number, number];
    /** How its ends are finished at the frame's corners (FR3a, D125): square, mitre, butt, or running through. */
    readonly ends?: readonly FrameEndReport[];
    /** The centroidal axis in the part: the line A·L is measured on. */
    readonly centroidLine: {
        readonly start: readonly [number, number, number];
        readonly end: readonly [number, number, number];
    };
}
/**
 * One end of a frame's member at a corner (FR3a, D125): `square` (no corner, or one left as it is), `mitre` (cut on the
 * plane halfway between the two members), `butt` (ended on the face of the member that runs through), `through` (run on
 * past the corner to cover the other member); FR3b (D126): `cope` (ended on the other member's envelope), `trim` (an
 * ordered trim's later member, or trimmed to a plane or a body). `point` the skeleton point; `with` the other member; `angle` the
 * cut from square; `plane` the cut's (its normal pointing away from the member); `extended` how far a through member
 * runs past the point.
 */
export type FrameNotchReport = {
    readonly kind: 'holesaw';
    readonly diameter: number;
    readonly offset: number;
} | {
    readonly kind: 'v';
    readonly depth: number;
    readonly angle: number;
};
export interface FrameEndReport {
    /** Complete authored clearance g (each mitre plane is moved g/2). */
    readonly gap?: number;
    readonly notch?: FrameNotchReport;
    readonly end: 'start' | 'end';
    readonly point: number;
    readonly kind: 'square' | 'mitre' | 'butt' | 'through' | 'cope' | 'trim' | 'notch';
    readonly with?: number;
    readonly angle?: number;
    readonly extended?: number;
    /** An ordered trim (FR3b): this member's place in the order (1 for the second) and the members it is trimmed to. */
    readonly rank?: number;
    readonly against?: readonly number[];
    readonly plane?: {
        readonly origin: readonly [number, number, number];
        readonly normal: readonly [number, number, number];
    };
}
