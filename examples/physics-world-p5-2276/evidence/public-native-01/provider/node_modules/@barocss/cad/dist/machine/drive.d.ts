import type { Brep } from '../brep/brep-core.js';
import type { Curve } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type DriveCode = 'INVALID_INPUT' | 'UNSUPPORTED_TOOTH_FORM' | 'TOOTH_FORM' | 'BELT_GEOMETRY';
/** This module's refusal (R7.3a batch 2: the DriveError class folded, D279): a BarocssError, `details.source` 'drive'. */
export declare const driveError: (code: DriveCode, detail: string) => KernelError & {
    readonly code: DriveCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isDriveError: (e: unknown) => e is KernelError & {
    readonly code: DriveCode;
};
export interface ChainRow {
    readonly kind: 'chain';
    readonly id: string;
    readonly pitch: number;
    readonly rollerDiameter: number;
    readonly innerWidth?: number;
    readonly plateHeight?: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface TimingBeltRow {
    readonly kind: 'timing-belt';
    readonly id: string;
    readonly pitch: number;
    readonly pitchLineOffset: number;
    readonly groove: readonly (readonly [number, number])[];
    readonly thickness?: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface VBeltRow {
    readonly kind: 'v-belt';
    readonly id: string;
    readonly angle: number;
    readonly datumWidth: number;
    readonly aboveDatum: number;
    readonly belowDatum: number;
    readonly spacing: number;
    readonly edge: number;
    readonly thickness?: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface FlatBeltRow {
    readonly kind: 'flat-belt';
    readonly id: string;
    readonly width: number;
    readonly thickness: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface CouplingRow {
    readonly kind: 'coupling';
    readonly id: string;
    readonly type?: string;
    readonly bore: readonly [number, number];
    readonly outside: number;
    readonly length: number;
    readonly boreStep?: number;
    readonly partNumber?: string;
    readonly supplier?: string;
    readonly source?: string;
    readonly estimate?: boolean;
}
export type DriveRow = ChainRow | TimingBeltRow | VBeltRow | FlatBeltRow | CouplingRow;
export type BeltRow = TimingBeltRow | VBeltRow | FlatBeltRow;
/** Why a drive row is not one, or null. */
export declare function driveRowProblem(r: unknown): string | null;
export declare const sprocketPitchDiameter: (pitch: number, teeth: number) => number;
/** The tip's limits for a chain, teeth and seat Ø: above the seats' edge, below the flanks' meeting point (both Ø). */
export declare function sprocketLimits(chain: ChainRow, teeth: number, seatDiameter?: number): {
    seatEdgeDiameter: number;
    pointedTipDiameter: number;
    pitchDiameter: number;
};
export interface SprocketSpec {
    readonly chain: ChainRow;
    readonly teeth: number;
    /** The tip circle's Ø (the user's). */
    readonly tipDiameter: number;
    /** The tooth's width across the chain (the user's). */
    readonly width: number;
    /** The seat's Ø, at least the roller's (default the roller's). */
    readonly seatDiameter?: number;
    readonly toothForm?: 'pivot-clearance';
    readonly boreDiameter?: number;
    readonly minimumRim?: number;
}
export interface SprocketReport {
    readonly generator: 'sprocket@0';
    readonly chain: string;
    readonly chainEstimate: boolean;
    readonly chainSource?: string;
    readonly pitch: number;
    readonly rollerDiameter: number;
    readonly teeth: number;
    readonly toothForm: 'pivot-clearance';
    readonly pitchDiameter: number;
    readonly seatDiameter: number;
    readonly rootDiameter: number;
    readonly flankRadius: number;
    readonly tipDiameter: number;
    readonly pointedTipDiameter: number;
    readonly width: number;
    /** The least gap between a roller turning out of its seat about its neighbour and the built teeth (measured): r_s − r_1. */
    readonly engagementClearance: number;
    readonly warnings: readonly string[];
    readonly manufacturingValidated: false;
}
export declare function sprocketProfile(spec: SprocketSpec): {
    pieces: {
        name: string;
        curve: Curve;
    }[];
    bore: {
        name: string;
        curve: Curve;
    }[];
    report: SprocketReport;
};
/** The sprocket as a solid, from z 0 through its width. Faces `<id>.seat<k>`, `.flank<j>`, `.tip<k>`, `.bore#1/#2`, `.face0/.face1`. */
export declare function sprocket(spec: SprocketSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: SprocketReport;
};
export declare const timingPitchDiameter: (pitch: number, teeth: number) => number;
export interface PulleySpec {
    readonly belt: BeltRow;
    /** Timing: its grooves. */
    readonly teeth?: number;
    /** V: the datum Ø; flat: the face's Ø (at its crown). */
    readonly diameter?: number;
    /** V: the grooves (default 1). */
    readonly grooves?: number;
    /** Timing and flat: the face's width (a flat one at least the belt's). */
    readonly width?: number;
    /** Flat: the crown's height (default 0). */
    readonly crown?: number;
    readonly boreDiameter?: number;
    readonly minimumRim?: number;
}
export interface PulleyReport {
    readonly generator: 'pulley@0';
    readonly type: 'timing' | 'v' | 'flat';
    readonly belt: string;
    readonly beltEstimate: boolean;
    readonly beltSource?: string;
    /** The belt's pitch line on it: timing pz/π, V the datum Ø, flat the face's Ø. */
    readonly pitchDiameter: number;
    readonly outsideDiameter: number;
    readonly width: number;
    readonly teeth?: number;
    readonly grooves?: number;
    readonly grooveBottomDiameter?: number;
    readonly crown?: number;
    readonly warnings: readonly string[];
    readonly manufacturingValidated: false;
}
/**
 * A pulley for the belt row: timing (its grooves the row's profile, extruded through `width`), V (the row's grooves
 * revolved round the datum Ø) or flat (a crowned face, revolved). Faces: timing `<id>.groove<k>.<j>` (the profile's
 * segments), `.land<k>`, `.bore#1/#2`, `.face0/.face1`; V `.rim0`, `.flankA<k>`, `.bottom<k>`, `.flankB<k>`, `.rim<k>`, flat
 * `.face`, both with `.bore`, `.face0/.face1` (the ends), each revolved face in two halves `#1/#2`.
 */
export declare function pulley(spec: PulleySpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: PulleyReport;
};
/** An open belt's length between pitch radii R1 and R2 at centre distance C, and the wraps (degrees). */
export declare function openBeltLength(R1: number, R2: number, C: number): {
    length: number;
    beta: number;
    wrap1: number;
    wrap2: number;
};
/** A chain on two sprockets' pitch circles: L/p pitches, rounded up to whole (or even) links, the centre distance for that count. */
export declare function chainLinks(pitch: number, R1: number, R2: number, C: number, rounding?: 'whole' | 'even'): {
    pitches: number;
    links: number;
    centerDistance: number;
};
export interface BeltSpec {
    readonly row: ChainRow | BeltRow;
    /** The two wheels' pitch radii; the first at the origin, the second at (C, 0). */
    readonly pitchRadii: readonly [number, number];
    readonly centerDistance: number;
    /** Chains: whole (default) or even links. */
    readonly rounding?: 'whole' | 'even';
    /** The band's width across (default the row's: a flat belt's width, a chain's inner width, else 5). */
    readonly width?: number;
}
export interface BeltReport {
    readonly generator: 'belt@0';
    readonly row: string;
    readonly kind: DriveRow['kind'];
    readonly rowEstimate: boolean;
    readonly rowSource?: string;
    readonly pitchRadii: readonly [number, number];
    readonly centerDistance: number;
    readonly length: number;
    readonly wrap: readonly [number, number];
    /** Chains: pitches at this distance, the links, the distance for them. */
    readonly chain?: {
        readonly pitches: number;
        readonly links: number;
        readonly centerDistance: number;
    };
    readonly bandThickness: number;
    readonly bandWidth: number;
    readonly bandEstimate: boolean;
    readonly warnings: readonly string[];
}
/**
 * The belt or chain as a band about its pitch path, the row's thickness (a chain's plate height) across it and `width`
 * wide, from z 0: faces `<id>.outer#k`, `.inner#k` (the arcs and lines), `.face0/.face1`. Wheel 1 at the origin, wheel 2
 * at (C, 0).
 */
export declare function beltBand(spec: BeltSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: BeltReport;
};
export interface CouplingReport {
    readonly generator: 'coupling@0';
    readonly row: string;
    readonly type?: string;
    readonly estimate: boolean;
    readonly source?: string;
    readonly bore: readonly [number, number];
    readonly outside: number;
    readonly length: number;
    readonly boreStep: number;
    /** A bought item: the BOM's defaults from the row. */
    readonly bought: {
        readonly bought: true;
        readonly partNumber?: string;
        readonly supplier?: string;
        readonly source?: string;
    };
    readonly envelopeOnly: true;
}
/** The coupling's envelope from its row, axis +Z from z 0: faces `<id>.outside`, `.bore1`, `.bore2`, `.step`, `.face0/.face1` (each in two halves `#1/#2`). */
export declare function couplingEnvelope(rowIn: CouplingRow, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: CouplingReport;
};
