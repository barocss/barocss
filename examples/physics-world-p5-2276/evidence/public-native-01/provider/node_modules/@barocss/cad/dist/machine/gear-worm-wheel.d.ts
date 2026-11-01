import { type Brep } from '../brep/brep-core.js';
import { type GearDiagnostic } from './gear.js';
import { type WormSpec, type WormDimensions, type PlacedWorm } from './gear-worm.js';
export interface ThroatedWheelSpec {
    /** The worm it is cut for (a ZA worm; its length is not read). */
    readonly worm: WormSpec;
    readonly teeth: number;
    /** Along the wheel's axis, centred on the mid-plane (below 1.6 R_t). */
    readonly faceWidth: number;
    readonly boreDiameter?: number;
    /** The hob's thread thickened by this much along its axis (the wheel's spaces wider: backlash). */
    readonly toothThicknessReduction?: number;
    /** The flanks' and fillets' fit within this of the generated surface, in every plane; 1e-4 m_n by default. */
    readonly profileTolerance?: number;
}
export interface ThroatedWheelReport {
    readonly generator: 'worm-wheel@0';
    readonly kind: 'throated';
    readonly dimensions: {
        readonly referenceDiameter: number;
        readonly throatDiameter: number;
        readonly rootDiameter: number;
        readonly throatRadius: number;
        readonly rootTorusRadius: number;
        readonly centerDistance: number;
        readonly faceWidth: number;
        readonly tipDiameterAtFaces: number;
        readonly rootDiameterAtFaces: number;
    };
    /** The fits: bicubic pieces across the profile and along the face, the faces they take, and the largest distance from the generated section found in any plane. */
    readonly flank: {
        readonly piecesAcross: number;
        readonly piecesAlong: number;
        readonly faces: number;
        readonly deviation: number;
    };
    readonly fillet: {
        readonly piecesAcross: number;
        readonly piecesAlong: number;
        readonly faces: number;
        readonly deviation: number;
    };
    readonly profileTolerance: number;
    readonly manufacturingValidated: false;
    readonly diagnostics: readonly GearDiagnostic[];
}
/** The hob and the wheel's values for the section generator. */
export interface WheelGeom {
    readonly w: WormDimensions;
    readonly z2: number;
    readonly r2: number;
    readonly a: number;
    readonly Rt: number;
    readonly Rh: number;
    readonly b: number;
    /** The hob's section half-thickness angle at radius ρ (ZA, the wheel's backlash added along the axis). */
    readonly psiH: (rho: number) => number;
    readonly bore: number;
    readonly step: number;
}
export declare function throatedWheelGeom(spec: ThroatedWheelSpec): WheelGeom;
/** The flank's generated point from the hob's (ρ, σ) at plane c (pair frame, at θ 0), into o. */
export declare function flankPoint(G: WheelGeom, sigma: number, c: number, rho: number, o: number[]): void;
/** The trochoid of side σ's crest corner at plane c, its parameter t ∈ [0, 1] from the root (d = −x_K) to where it meets the flank (d at the corner's contact), into o. */
export declare function filletPoint(G: WheelGeom, sigma: number, c: number, t: number, o: number[]): void;
/** The wheel's tip and root radii at plane c: the throat torus and the hob crest's. */
export declare const tipRadius: (G: WheelGeom, c: number) => number;
export declare const rootRadius: (G: WheelGeom, c: number) => number;
/** The hob radius ρ whose flank point reaches the wheel's tip at plane c (bisection: the radius falls as ρ grows). */
export declare function rhoAtTip(G: WheelGeom, sigma: number, c: number): number;
/**
 * The throated wheel (R12b.6, D137) as a solid in its own frame: the axis +Z, the faces at z 0 and b (its mid-plane at
 * b/2), tooth 1 centred on +X in the mid-plane. Faces `<id>.filletL#k`, `.flankL#k` (more pieces across on `.flankL2#k`
 * …), `.tip#k` (the throat torus), `.flankR#k`, `.filletR#k`, `.root#k` (the root torus, the space after tooth k),
 * `.face0`, `.face1`, `.bore#1/2`; along the axis in segments `.2` ….
 */
export declare function throatedWormWheel(spec: ThroatedWheelSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: ThroatedWheelReport;
};
/** A throated wheel's worm (R12b.6): the wheel's own, its length and thinning the worm's. */
export declare function throatedWheelWorm(wheel: ThroatedWheelSpec, worm: {
    readonly length: number;
    readonly boreDiameter?: number;
    readonly toothThicknessReduction?: number;
}): WormSpec;
export interface ThroatedPairCheck {
    readonly centerDistance: number;
    readonly speedRatio: number;
    readonly backlash: number;
    /** Sections square to the wheel's axis (the mid-plane, ±b/4, ±b/2.2), each swept over an axial pitch of the worm. */
    readonly planes: readonly {
        readonly offset: number;
        readonly minimumClearance: number;
        readonly interference: boolean;
    }[];
    readonly interference: boolean;
    /** How close two sections may come and be in contact (the throated wheel touches its worm along lines): the fits and the sections' chords. */
    readonly touch: number;
    readonly diagnostics: readonly GearDiagnostic[];
}
/**
 * A ZA worm and the throated wheel cut for it (R12b.6, D137): the worm the wheel's (else MATE_INCOMPATIBLE); sections
 * square to the wheel's axis — the mid-plane, ±b/4 and ±b/2.2 — each swept through one axial pitch of the worm (the worm
 * turned θ, the wheel −h θ z1/z2 from its cutting pose, plus the phase: the worm's own extra turn). In contact the two
 * touch along lines: sections nearer than the touch bound (the faces' fits and the chords) are in contact, not crossing.
 */
export declare function checkThroatedWormPair(worm: WormSpec, wheel: ThroatedWheelSpec, options?: {
    readonly relativePhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}): ThroatedPairCheck;
/** A throated wheel as placed: its spec, its axis +Z through `center` from `from` (its mid-plane at from + b/2), turned `rotation` (tooth 1 on +X in the mid-plane at 0). */
export interface PlacedThroatedWheel {
    readonly spec: ThroatedWheelSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}
/**
 * Where its worm stands (R12b.6): as D136's — square to the wheel's axis at a toward φ in its mid-plane, its length centred
 * there, local X toward the wheel — turned so a thread meets a space in the mid-plane as the hob did (plus `phase`).
 */
export declare function throatedWormPlacement(wheel: PlacedThroatedWheel, worm: WormSpec, phi: number, phase: number): PlacedWorm;
/** The pair checks for a throated wheel and its worm as placed: square, at a, in the mid-plane (else MATE_INCOMPATIBLE); the relative phase from the worm's turn; then `checkThroatedWormPair`. */
export declare function checkPlacedThroatedPair(wheel: PlacedThroatedWheel, wp: PlacedWorm, options?: {
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}): ThroatedPairCheck & {
    readonly relativePhase: number;
};
