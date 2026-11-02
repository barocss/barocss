import type { Brep } from '../brep/brep-core.js';
import { spurGearDimensions, type Envelope, type GearDiagnostic, type SpurGearSpec, type SpurGearReport } from './gear.js';
/** Version 0 of the internal gear's inputs (lengths in mm). */
export interface InternalGearSpec {
    /** A straight ring's module; a helical one's `normalModule`, helix angle and hand (its pinion's hand: an internal pair is of one hand). */
    readonly module?: number;
    readonly normalModule?: number;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    readonly teeth: number;
    readonly faceWidth: number;
    /** The rim's outer diameter. */
    readonly rimDiameter: number;
    /** 20° only in this stage. */
    readonly pressureAngle?: number;
    /** x2: the tip at r − (1 − x2) m, the spaces 2 x2 m tan α wider; from −0.5 to 0.75. */
    readonly profileShiftCoefficient?: number;
    /** Taken off the ring's teeth at the reference circle (its spaces that much wider): its share of a pair's backlash. */
    readonly toothThicknessReduction?: number;
    /** The largest deviation of a fitted flank from the involute; default 1e-4 m. */
    readonly profileTolerance?: number;
    /** The least rim beyond the root circle; default 1 m (geometry only: not a strength check). */
    readonly minimumRim?: number;
    /**
     * The root (R12b.2b, D133): 'schematic-corner' (the default; internal-gear@0) or 'shaper-cut' (internal-gear@1): the
     * root a pinion-type `cutter` generates — its teeth z0, its shift x0 (default 0; its addendum 1.25 m + x0 m, its tooth
     * m(π/2 + 2 x0 tan α)), its tip radius (default 0.38 m, the basic rack's: an estimate for a cutter's). Straight rings only.
     */
    readonly rootPolicy?: 'schematic-corner' | 'shaper-cut';
    readonly cutter?: {
        readonly teeth: number;
        readonly profileShiftCoefficient?: number;
        readonly tipRadius?: number;
    };
}
export interface InternalGearReport {
    readonly generator: 'internal-gear@0' | 'internal-gear@1';
    readonly dimensions: {
        readonly referenceDiameter: number;
        readonly baseDiameter: number;
        /** The tip circle (inside) and the root circle (outside), the rim's outer diameter. */
        readonly tipDiameter: number;
        readonly rootDiameter: number;
        readonly rimDiameter: number;
        readonly circularPitch: number;
        readonly spaceWidth: number;
        readonly toothThickness: number;
    };
    readonly profileShift: number;
    readonly helix?: SpurGearReport['helix'];
    readonly flankPieces: number;
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    readonly rootPolicy: 'schematic-corner' | 'shaper-cut';
    readonly manufacturingValidated: false;
    /**
     * A shaper-cut root's (R12b.2b): the cutter (teeth, shift, tip radius), the cutting centre distance and pressure angle,
     * the diameter where the ring's involute ends at its root (the fillet's start) and whether the cutter's round crosses
     * the involute there, the fillet's pieces and measured deviation.
     */
    readonly shaperRoot?: {
        readonly cutterTeeth: number;
        readonly cutterShift: number;
        readonly cutterTipRadius: number;
        readonly cuttingCenterDistance: number;
        readonly cuttingPressureAngle: number;
        readonly formDiameter: number;
        readonly crossing: boolean;
        readonly filletPieces: number;
        readonly filletDeviation: number;
    };
    readonly diagnostics: readonly GearDiagnostic[];
}
/**
 * A pinion-type cutter's tip round as it cuts the ring (R12b.2b, D133), in the frame where the space it cuts is centred
 * on +Y: the cutter's centre at (0, a_c), its tooth on +Y from there; as the ring turns φ the cutter turns φ z2/z0, the
 * same way, about its centre. The round's centre at φ 0 is (qx, qy); the pitch point (0, rw2). The ring is touched at
 * the round's point on the line from its centre away from the pitch point (its normal through the instant centre, as
 * the rack's, D129), turned back by −φ. `phiRoot`: the turn at which the round's centre crosses the line of centres
 * (its point on the cutter's tip circle cuts the root circle); `phiEnd`: where the fillet meets the ring's involute.
 */
declare class ShaperRoot implements Envelope {
    readonly k: number;
    readonly ac: number;
    readonly rw2: number;
    readonly rho: number;
    readonly qx: number;
    readonly qy: number;
    readonly phiRoot: number;
    phiEnd: number;
    constructor(k: number, ac: number, rw2: number, rho: number, qx: number, qy: number, phiRoot: number, phiEnd: number);
    point(phi: number): [number, number];
    /** p′ = Rot(−φ)(w′ − J w); w′ = Q′ + ρ u′, Q′ = k J (Q − C0), u′ = (Q′ − u (u·Q′)) / L. */
    derivative(phi: number): [number, number];
}
/** A shaper-cut ring's cutting geometry (D133) — the cutter, its distance, the root, the fillet — and the checks the cutter makes. */
interface Shaper {
    readonly z0: number;
    readonly x0: number;
    readonly rho: number;
    readonly ac: number;
    readonly alphaC: number;
    readonly ra0: number;
    readonly rf: number;
    readonly S: ShaperRoot;
    readonly rStart: number;
    readonly crossing: boolean;
    readonly thetaJ: number;
}
/** The ring's dimensions and input checks (refusals thrown, as gearError, in the ring's own terms). */
export declare function internalGearDimensions(spec: InternalGearSpec): {
    r: number;
    rb: number;
    ra: number;
    rf: number;
    rim: number;
    mn: number;
    mt: number;
    alpha: number;
    alphaN: number;
    beta: number;
    x: number;
    space: SpurGearSpec;
    sd: ReturnType<typeof spurGearDimensions>;
    spaceWidth: number;
    pitch: number;
    shaper?: Shaper;
};
/**
 * The ring as a solid: its axis along +Z, tooth 1 centred on +X, pulled from z 0 through the face width. Faces
 * `<id>.flankL#k`, `.flankR#k` (tooth k's flanks, clockwise side first), `.tip#k` (the tip arc, inside), `.root#k` (the
 * root arc of the space before tooth k), `.rim#1`/`#2`, `.face0`/`.face1`; a helical ring's along the helix as a
 * helical gear's (`#k.2` …).
 */
export declare function internalGear(spec: InternalGearSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: InternalGearReport;
};
/**
 * The internal pair's centre distance without backlash: unshifted m_t(z2 − z1)/2; shifted from inv α_w = 2 tan α_n (x2 − x1)/(z2 − z1) + inv α_t
 * (K1's form, reproducing its Table 4.6), a = m_t(z2 − z1) cos α_t / (2 cos α_w), Newton on inv.
 */
export declare function internalGearCenterDistance(pinion: SpurGearSpec, ring: InternalGearSpec): number;
export interface InternalGearPairOptions {
    readonly centerDistance?: number;
    readonly relativePhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}
export interface InternalGearPairCheck {
    readonly centerDistance: number;
    readonly nominalCenterDistance: number;
    readonly workingPressureAngle: number;
    /** The pinion's and the ring's working pitch diameters, 2a z/(z2 − z1). */
    readonly workingPitchDiameters: readonly [number, number];
    /** +z1/z2: the ring turns the same way as the pinion. */
    readonly speedRatio: number;
    /** The ring's space less the pinion's tooth on their working pitch circles; negative: the teeth jam. */
    readonly backlash: number;
    /** The pinion's tip from the ring's root (rf2 − a − ra1), the ring's tip from the pinion's root (ra2 − a − rf1). */
    readonly tipClearances: readonly [number, number];
    /** The formula's [√(ra1² − rb1²) − √(ra2² − rb2²) + a sin α_w]/(π m_t cos α_t), and the path the usable flanks allow. */
    readonly idealContactRatio: number;
    readonly usableContactRatio: number;
    readonly axialContactRatio: number;
    readonly totalContactRatio: number;
    /**
     * The interference conditions (derived, D129: K1's are equation images; checked against the sweep): the margins
     * z1/z2 − (1 − tan α_a2 / tan α_w) (involute) and θ1 z1/z2 + inv α_w − inv α_a2 − θ2 (trochoid), each ≥ 0 when clear
     * (Infinity: the tip circles never meet); `formMargin`, along the line of action, from where the pinion's involute starts
   * (its form circle, or max(rb, rf) under a schematic root) to where the ring's tip meets the line — negative when the
   * ring's tip runs below the pinion's involute, where the contact ends (the usable ratio) and the fillet passes it: not
   * a verdict, the sweep is (D132: mostly clear, 24 in 40 crossing); and trimming — the radial-insertion sweep (the
     * pinion moved from the ring's centre out to the working distance along the line of centres, in its meshing phase, its
     * least clearance on the way; `possible` false: its tip circle does not fit inside the ring's) and the trimming
     * condition θ1 + inv α_a1 − inv α_w ≥ (z2/z1)(θ2 + inv α_a2 − inv α_w) (`conditionMargin`: it reproduces K1's Table
     * 4.8, D133). `interference` when either says so (the straight path clears a few small pairs K1's condition does
     * not); `sweepInterference` the path's alone.
     */
    readonly interference: {
        readonly involuteMargin: number;
        readonly formMargin: number;
        readonly trochoidMargin: number;
        readonly trimming: {
            readonly possible: boolean;
            readonly interference: boolean;
            readonly leastClearance: number;
            readonly atOffset: number;
            readonly conditionMargin: number;
            readonly sweepInterference: boolean;
        };
    };
    readonly sweep: {
        readonly samples: number;
        readonly minimumClearance: number;
        readonly at: number;
        readonly interference: boolean;
        readonly converged: boolean;
        readonly coarseMinimum: number;
    };
    readonly diagnostics: readonly GearDiagnostic[];
}
/**
 * A pinion inside a ring (R12b.2a): compatibility; the working geometry at the centre distance; backlash, tip
 * clearances, the contact ratio by the formula and by the usable flanks; the interference conditions; the radial
 * insertion; and the two exact outlines swept through one pinion tooth period (the ring turning z1/z2 the same way),
 * the least clearance converged and refined, a crossing measured by its depth — as the external pairs (D55), cached.
 */
export declare function checkInternalGearPair(pinion: SpurGearSpec, ring: InternalGearSpec, options?: InternalGearPairOptions): InternalGearPairCheck;
/** A ring as it stands: its axis along +Z through `center`, faces from `from` through b, turned by `rotation` (radians; tooth 1 on +X at 0). */
export interface PlacedInternalGear {
    readonly spec: InternalGearSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}
export interface PlacedInternalGearPairCheck extends InternalGearPairCheck {
    readonly relativePhase: number;
    readonly faceOverlap: number;
}
/**
 * The pinion's turn inside a ring as placed (R12b.2a): at direction φ from the ring's centre, a pinion tooth on the
 * line of centres in the ring's space there, following the ring's turn by z2/z1 the same way, plus `phase`.
 */
export declare function pinionTurnInside(ring: PlacedInternalGear, pinionTeeth: number, phi: number, phase: number): number;
/** The pair checks for a pinion inside a ring as placed: the centre distance and the relative phase from where they stand and how they are turned. */
export declare function checkPlacedInternalGears(ring: PlacedInternalGear, pinion: {
    readonly spec: SpurGearSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}, options?: Omit<InternalGearPairOptions, 'centerDistance' | 'relativePhase'>): PlacedInternalGearPairCheck;
export {};
