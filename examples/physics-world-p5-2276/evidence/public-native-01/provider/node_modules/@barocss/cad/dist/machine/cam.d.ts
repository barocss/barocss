import type { Brep } from '../brep/brep-core.js';
import type { Curve } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type CamLaw = 'uniform' | 'harmonic' | 'cycloidal' | 'polynomial-345' | 'modified-trapezoid';
export declare const CAM_LAWS: readonly CamLaw[];
export type CamCode = 'INVALID_INPUT' | 'CAM_UNDERCUT' | 'PROFILE_BUDGET_EXCEEDED';
export type CamWarningCode = 'PRESSURE_ANGLE' | 'ACCELERATION_STEP' | 'FACE_WIDTH';
/** This module's refusal (R7.3a batch 2: the CamError class folded, D279): a BarocssError, `details.source` 'cam'. */
export declare const camError: (code: CamCode, detail: string) => KernelError & {
    readonly code: CamCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isCamError: (e: unknown) => e is KernelError & {
    readonly code: CamCode;
};
export interface CamSegment {
    /** The cam's turn over the segment. */
    readonly angle: number;
    /** The follower's position at the segment's end (mm, or the arm's degrees when oscillating); omitted: a dwell. */
    readonly to?: number;
    readonly law?: CamLaw;
}
export interface CamSpec {
    /** The cam's base circle (its profile's least radius). */
    readonly baseRadius: number;
    readonly follower: 'roller' | 'flat';
    readonly motion?: 'translating' | 'oscillating';
    readonly rollerRadius?: number;
    /** Translating: the follower's line off the cam's centre (along +x). */
    readonly offset?: number;
    /** Oscillating: the arm's pivot at (a, 0). */
    readonly pivotDistance?: number;
    /** Oscillating roller: pivot to roller centre. */
    readonly armLength?: number;
    /** Oscillating flat face: the face's distance from the pivot toward the cam (default 0). */
    readonly faceOffset?: number;
    /** Flat face: its width about the follower's line (translating) or its length from the pivot (oscillating), checked. */
    readonly faceWidth?: number;
    /** Starting at 0; the last segment ends at 0; their angles sum to 360°. */
    readonly segments: readonly CamSegment[];
    readonly thickness: number;
    readonly boreDiameter?: number;
    /** The least rim round a bore, below the base circle; default 1 mm (geometry only: not a strength check). */
    readonly minimumRim?: number;
    /** Default 30° translating, 35° oscillating: a rule-of-thumb estimate, attributed to no source (the user sets their own). */
    readonly pressureAngleLimit?: number;
    /** Default 1e-4 of the base radius. */
    readonly profileTolerance?: number;
}
export interface CamSegmentReport {
    readonly index: number;
    readonly motion: 'rise' | 'return' | 'dwell';
    readonly law?: CamLaw;
    readonly start: number;
    readonly end: number;
    readonly from: number;
    readonly to: number;
    /** Per radian of the cam's turn, in the program's units (|Δ| Cv/β, |Δ| Ca/β²). */
    readonly peakVelocity: number;
    readonly peakAcceleration: number;
}
export interface CamReport {
    readonly generator: 'cam@0';
    readonly motion: 'translating' | 'oscillating';
    readonly follower: 'roller' | 'flat';
    readonly baseRadius: number;
    readonly rollerRadius?: number;
    readonly primeRadius?: number;
    readonly offset?: number;
    readonly pivotDistance?: number;
    readonly armLength?: number;
    readonly faceOffset?: number;
    /** Oscillating: the arm's angle at rest, ψ0. */
    readonly restAngle?: number;
    readonly units: 'mm' | 'deg';
    readonly stroke: number;
    readonly segments: readonly CamSegmentReport[];
    readonly pressureAngle: {
        readonly max: number;
        readonly at: number;
        readonly limit: number;
        readonly limitEstimate: boolean;
        readonly limitSource?: string;
    };
    /** Roller: the pitch curve's least convex radius; both: the profile's least convex radius (flat: ρ = h + h_ββ). */
    readonly curvature: {
        readonly leastPitchRadius?: number;
        readonly leastProfileRadius: number;
        readonly at: number;
    };
    /** Flat face: where it touches, along the face from the follower's line (translating) or from the pivot (oscillating). */
    readonly faceContact?: readonly [number, number];
    readonly profilePieces: number;
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    /** The follower's position found on the built profile against the law, every half degree. */
    readonly sweep: {
        readonly samples: number;
        readonly deviation: number;
        readonly at: number;
    };
    readonly warnings: readonly {
        readonly code: CamWarningCode;
        readonly message: string;
    }[];
    readonly manufacturingValidated: false;
}
/** The law's f, f', f'' at u ∈ [0, 1]. */
export declare function camLaw(law: CamLaw, u: number): [number, number, number];
/**
 * The law's peak velocity and acceleration coefficients (Cv = max f', Ca = max |f''|), from the forms above: harmonic π/2
 * and π²/2 (at u = 0); cycloidal 2 and 2π (u = 1/4); 3-4-5 15/8 and 10/√3 (f''' = 0 at u = (3 − √3)/6); the modified
 * trapezoid 2 and 8π/(π + 2); uniform 1 and ∞ (its ends).
 */
export declare function camLawPeaks(law: CamLaw): {
    cv: number;
    ca: number;
};
/** The profile's pieces (counter-clockwise round the cam), the bore's, and the report. */
export declare function camProfile(spec: CamSpec): {
    pieces: {
        name: string;
        curve: Curve;
    }[];
    bore: {
        name: string;
        curve: Curve;
    }[];
    report: CamReport;
    segments: readonly {
        motion: string;
        index: number;
    }[];
};
/**
 * The cam as a solid: its profile pulled from z 0 through its thickness, the bore through it. Side faces `<id>.rise1#k`,
 * `.dwell1#k`, `.return1#k` (the program's motions counted by kind, pieces in θ), `.bore#1`/`#2`, the ends `.face0`/`.face1`.
 */
export declare function discCam(spec: CamSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: CamReport;
};
/** The follower's position under the law at θ (degrees of the cam's turn): s in the program's units, s' and s'' per radian. */
export declare function camMotion(spec: CamSpec, thetaDeg: number): {
    s: number;
    v: number;
    a: number;
};
