import { type Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import { type GearDiagnostic } from './gear.js';
/** Version 0 of the straight bevel gear's inputs (lengths in mm, at the heel). */
export interface BevelGearSpec {
    /** The module at the heel (the outer end): the reference diameter there is m × teeth. */
    readonly module: number;
    readonly teeth: number;
    /** The mating gear's teeth: with the shaft angle they fix the pitch cone, tan δ = sin Σ / (z_mate / z + cos Σ). */
    readonly mateTeeth: number;
    /** The angle between the two axes, above 0 and below 180°; 90° by default. */
    readonly shaftAngle?: number;
    /** Along the cone (heel to toe); below the cone distance (b over R/3 is warned of). */
    readonly faceWidth: number;
    /** 20° only. */
    readonly pressureAngle?: number;
    /** 0 only: the Gleason uniform-clearance system's shifts are not built (`UNSUPPORTED_GEAR_KIND`). */
    readonly profileShiftCoefficient?: number;
    /** 'standard' only (addendum m, dedendum 1.25 m, the cones through the apex); 'gleason' refused. */
    readonly system?: 'standard' | 'gleason';
    /** A cylindrical bore on the axis; 0 or left out: none. */
    readonly boreDiameter?: number;
    /** The least wall between the bore and the root cone at the toe; the module by default. */
    readonly minimumRim?: number;
    /** Thinned at the heel's pitch circle by this much (backlash; scaled along the cone with it). */
    readonly toothThicknessReduction?: number;
    /** The flank fit's largest distance from the spherical involute at the heel; 1e-4 m by default. */
    readonly profileTolerance?: number;
    /**
     * A spiral bevel gear (R12b.4, D135), the ideal conjugate: its mean spiral angle (above 0, at most 45°), its hand
     * (right: seen from its apex along its axis, the tooth turns clockwise from the toe to the heel) and the radius of
     * the circular tooth trace (the face-mill cutter's). The module is then transverse, at the heel; the pressure angle
     * normal at the mean point. 'epicycloidal' (face-hobbed) traces are refused.
     */
    readonly spiral?: {
        readonly angle: number;
        readonly hand: 'right' | 'left';
        readonly cutterRadius: number;
        readonly trace?: 'circular' | 'epicycloidal';
    };
    /** A hypoid offset: 0 only. */
    readonly offset?: number;
}
export interface BevelGearReport {
    readonly generator: 'bevel-gear@0';
    readonly kind: 'straight' | 'spiral';
    readonly system: 'standard';
    readonly profile: 'spherical-involute';
    readonly ends: 'spherical';
    readonly dimensions: {
        readonly referenceDiameter: number;
        readonly shaftAngle: number;
        readonly pitchAngle: number;
        readonly baseConeAngle: number;
        readonly addendumAngle: number;
        readonly dedendumAngle: number;
        readonly tipAngle: number;
        readonly rootAngle: number;
        readonly coneDistance: number;
        readonly innerConeDistance: number;
        readonly faceWidth: number;
        /** On the heel sphere (not a back cone's): 2 Re sin(δ + θa), 2 Re sin(δ − θf). */
        readonly tipDiameterAtHeel: number;
        readonly rootDiameterAtHeel: number;
        readonly circularPitch: number;
        readonly toothThickness: number;
        /** Along the axis from the apex: the nearest point (the toe's tip edge) and the farthest (the heel at the axis or the bore). */
        readonly axialExtent: readonly [number, number];
    };
    /** Tredgold's back-cone approximation, an estimate only: the virtual spur gear's teeth z / cos δ. */
    readonly virtualTeeth: number;
    readonly flankPieces: number;
    readonly flankFaces: number;
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    readonly rootPolicy: 'schematic-meridian';
    readonly manufacturingValidated: false;
    /** True for a spiral bevel gear (R12b.4): the ideal conjugate, line contact, not a cut tooth (the IDEAL_MODEL warning says so). */
    readonly idealModel: boolean;
    /** A spiral bevel gear's trace and twist. */
    readonly spiral?: {
        readonly meanSpiralAngle: number;
        readonly hand: 'right' | 'left';
        readonly cutterRadius: number;
        readonly trace: 'circular';
        readonly meanConeDistance: number;
        readonly spiralAngleAtToe: number;
        readonly spiralAngleAtHeel: number;
        /** The section's (on every sphere) and the normal one it gives at the toe and the heel (tan α_n = tan α_t cos β). */
        readonly transversePressureAngle: number;
        readonly normalPressureAngleAtToe: number;
        readonly normalPressureAngleAtHeel: number;
        /** The section's turn from the toe to the heel, φ(Re) − φ(Ri); its fit (cubic pieces along the cone, in axial segments) and the fit's largest distance. */
        readonly twist: number;
        readonly twistPieces: number;
        readonly axialSegments: number;
        readonly twistDeviation: number;
    };
    readonly diagnostics: readonly GearDiagnostic[];
}
/** The gear's dimensions and the values the solid and the pair checks need; refusals as typed errors. */
export declare function bevelGearDimensions(spec: BevelGearSpec): {
    m: number;
    z: number;
    zm: number;
    b: number;
    Sigma: number;
    delta: number;
    deltaB: number;
    sb: number;
    cb: number;
    Re: number;
    Ri: number;
    thA: number;
    thF: number;
    tipPolar: number;
    rootPolar: number;
    startPolar: number;
    psiB: number;
    tipHalf: number;
    rootHalf: number;
    step: number;
    red: number;
    s: number;
    zv: number;
    bore: number;
    toBase: number;
    alpha: number;
    trace: SpiralTrace | null;
};
/**
 * A circular tooth trace on the crown plane (R12b.4): the apex at the origin, the mean point M at (Rm, 0), the trace
 * through it at the spiral angle β_m to the cone element (its tangent (cos β_m, sin β_m)), its centre C = M + r_c (−sin
 * β_m, cos β_m), the side the trace turns toward — q = |C| from the apex, q² = Rm² + r_c² − 2 Rm r_c sin β_m — so
 * sin β(R) = (R² + r_c² − q²) / (2 R r_c) = (R² − Rm²) / (2 R r_c) + (Rm / R) sin β_m (growing toward the heel on a small
 * cutter, falling on a large one). ψ(R) is the trace's crown angle at the cone distance R (0 at Rm), the branch
 * through M; the gear's section turns by φ(R) = h ψ(R) / sin δ (h +1 right-hand).
 */
export interface SpiralTrace {
    readonly Rm: number;
    readonly rc: number;
    readonly q: number;
    readonly omegaC: number;
    readonly branch: number;
    readonly h: number;
    readonly sinDelta: number;
    readonly betaM: number;
}
export type BevelGearDimensions = ReturnType<typeof bevelGearDimensions>;
/**
 * A straight bevel gear (R12b.3, D134) as a solid in its own frame (apex at the origin, axis +Z, tooth 1 on +X). Faces
 * `<id>.flankL#k`, `.flankR#k` (a flank of more than three pieces on more faces, root outward: `.flankL2#k` …), `.tip#k`,
 * `.root#k` (the space after tooth k), `.rootL#k`/`.rootR#k` (the schematic meridian joins, when the root is under the
 * base cone), `.heel` and `.toe` (spheres about the apex), `.bore#1`/`#2`.
 */
export declare function bevelGear(spec: BevelGearSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: BevelGearReport;
};
export interface BevelGearPairOptions {
    readonly relativePhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}
export interface BevelGearPairCheck {
    readonly shaftAngle: number;
    readonly pitchAngles: readonly [number, number];
    readonly coneDistance: number;
    /** z2 / z1: gear 2 turns this many times slower. */
    readonly speedRatio: number;
    /** Circumferential at the heel's pitch circle: the two thickness reductions. */
    readonly backlash: number;
    /** At the heel, along the sphere: Re (θf2 − θa1) and Re (θf1 − θa2). */
    readonly tipClearances: readonly [number, number];
    /**
     * The exact spherical contact ratio (the arc of the great circle of action between the tip cones over the base pitch
     * 2π sin δb / z), the usable one (from where each flank starts), and Tredgold's virtual spur pair's (an estimate).
     */
    readonly idealContactRatio: number;
    readonly usableContactRatio: number;
    readonly tredgoldContactRatio: number;
    /**
     * One tooth period of gear 1 swept on the heel sphere, at `samples` and twice as many, the least clearance refined (mm
     * at the heel). The outlines are chords of the involutes, inside each convex tooth: the least can come out larger than
     * the true one by up to `chordSag`, the two outlines' largest chord sag at the heel — never smaller.
     */
    readonly sweep: {
        readonly samples: number;
        readonly minimumClearance: number;
        readonly at: number;
        readonly interference: boolean;
        readonly converged: boolean;
        readonly coarseMinimum: number;
        readonly chordSag: number;
    };
    /**
     * A spiral pair (R12b.4): the same sweep on five spheres from the toe to the heel, each section turned by its gear's
     * φ(R) (an ideal pair: the same on every sphere, its clearance scaled by R; the heel's refined, the others the least of
     * `samples`); the face contact ratio |ψ(Re) − ψ(Ri)|
     * over the crown pitch 2π sin δ1 / z1, and the total with the transverse one.
     */
    readonly spheres?: readonly {
        readonly coneDistance: number;
        readonly minimumClearance: number;
        readonly interference: boolean;
    }[];
    readonly faceContactRatio?: number;
    readonly totalContactRatio?: number;
    /** Which way each gear is pushed along its axis, gear 1 driving either way (a direction, no load). */
    readonly axialThrust: string;
    readonly diagnostics: readonly GearDiagnostic[];
}
/**
 * The pair checks (R12b.3, D134): the same module and shaft angle, each the other's mate (else MATE_INCOMPATIBLE);
 * the ratio, the heel's backlash and tip clearances; the contact ratios; and the two exact outlines (the spherical
 * involute, densely) swept through one tooth period of gear 1 on the heel sphere — a straight bevel pair is the same on
 * every sphere about the apex — gear 2 turning −θ z1/z2, the least clearance found and refined, interference where they
 * cross. Gear 1's axis +Z, gear 2's at Σ from it in the XZ plane, the pitch line at gear 1's azimuth 0; gear 2 turned so
 * a space faces gear 1's tooth there, plus the phase.
 */
export declare function checkBevelGearPair(g1: BevelGearSpec, g2: BevelGearSpec, options?: BevelGearPairOptions): BevelGearPairCheck;
/** A bevel gear as it stands: its apex, its axis (toward its teeth: the frame's Z), the frame's X, turned by `rotation` (radians) about the axis from X. */
export interface PlacedBevelGear {
    readonly spec: BevelGearSpec;
    readonly apex: Point;
    readonly axis: Point;
    readonly xAxis: Point;
    readonly rotation: number;
}
export interface PlacedBevelGearPairCheck extends BevelGearPairCheck {
    readonly relativePhase: number;
}
/** The placed gear's map from its own frame (apex origin, axis +Z, tooth 1 on +X) into the part: row-major 3 × 3 and the offset. */
export declare function bevelGearMatrix(p: PlacedBevelGear): {
    matrix: [number, number, number, number, number, number, number, number, number];
    offset: Point;
};
/**
 * Where a gear meshing with `driver` stands (R12b.3): the same apex; its axis at the shaft angle from the driver's, in
 * the plane through the driver's axis and the direction `direction` (radians from the driver's X about its axis); its X
 * toward the pitch line; turned so a space faces the driver's tooth on the pitch line (plus `phase`), following the
 * driver's turn by −z1/z2.
 */
export declare function bevelMatePlacement(driver: PlacedBevelGear, mate: BevelGearSpec, direction: number, phase: number): PlacedBevelGear;
/**
 * The pair checks for two gears as placed: the apexes together and the axes at the shaft angle (else
 * MATE_INCOMPATIBLE), the relative phase from their turns (each against the pitch line, gear 1's carried through the
 * ratio, modulo gear 2's pitch angle), then `checkBevelGearPair`.
 */
export declare function checkPlacedBevelGears(g1: PlacedBevelGear, g2: PlacedBevelGear, options?: Omit<BevelGearPairOptions, 'relativePhase'>): PlacedBevelGearPairCheck;
