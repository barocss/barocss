import type { Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import { type GearDiagnostic, type SpurGearSpec } from './gear.js';
/** Version 0 of a cylindrical worm's inputs (lengths in mm). */
export interface WormSpec {
    /** The axial module m_x (the wheel's transverse module). */
    readonly axialModule: number;
    /** Threads (starts), 1–4. */
    readonly starts: number;
    /** The reference diameter d1 (q = d1 / m_x). */
    readonly diameter: number;
    readonly hand: 'right' | 'left';
    /** Along the axis. */
    readonly length: number;
    /** 'ZI' (the default) or 'ZA'; 'ZN', 'ZK' and 'ZC' are refused (named). */
    readonly form?: 'ZI' | 'ZA' | 'ZN' | 'ZK' | 'ZC';
    /** 'cylindrical' only: double-enveloping (globoid) worms are refused. */
    readonly envelope?: 'cylindrical' | 'double';
    /** The normal pressure angle at the reference cylinder: 20° only. */
    readonly pressureAngle?: number;
    readonly boreDiameter?: number;
    /** Thinned along the axis at the reference cylinder (backlash). */
    readonly toothThicknessReduction?: number;
    /** The flank fit plus the twist's, at most this; 1e-4 m_n by default. */
    readonly profileTolerance?: number;
}
export interface WormReport {
    readonly generator: 'worm@0';
    readonly form: 'ZI' | 'ZA';
    readonly envelope: 'cylindrical';
    readonly dimensions: {
        readonly referenceDiameter: number;
        readonly tipDiameter: number;
        readonly rootDiameter: number;
        readonly diameterQuotient: number;
        readonly leadAngle: number;
        readonly lead: number;
        readonly axialPitch: number;
        readonly normalModule: number;
        readonly length: number;
        /** ZI: the section's transverse pressure angle and base diameter; ZA: the axial pressure angle of its straight sides. */
        readonly transversePressureAngle?: number;
        readonly baseDiameter?: number;
        readonly axialPressureAngle?: number;
        readonly axialThickness: number;
    };
    readonly flankPieces: number;
    readonly flankFaces: number;
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    readonly twist: {
        readonly turns: number;
        readonly pieces: number;
        readonly axialSegments: number;
        readonly deviation: number;
    };
    readonly manufacturingValidated: false;
    readonly diagnostics: readonly GearDiagnostic[];
}
/** The worm's dimensions and the values the solid and the pair need; refusals typed. */
export declare function wormDimensions(spec: WormSpec): {
    m: number;
    z1: number;
    d1: number;
    r1: number;
    ra: number;
    rf: number;
    rb: number;
    r0: number;
    gamma: number;
    p: number;
    h: number;
    mn: number;
    L: number;
    form: "ZI" | "ZA";
    red: number;
    sx: number;
    psiRef: number;
    alphaT: number;
    alphaX: number;
    psiAt: (r: number) => number;
    bore: number;
};
export type WormDimensions = ReturnType<typeof wormDimensions>;
/**
 * A cylindrical worm (R12b.5, D136) as a solid in its own frame (axis +Z from z 0; thread 1 centred on +X at z 0). Faces
 * `<id>.flankL#k`, `.flankR#k` (thread k's sides; more than five pieces on more faces, root outward: `.flankL2#k` …),
 * `.tip#k`, `.root#k`, `.rootL#k`/`.rootR#k` (a ZI section's radial joins below its base circle), `.face0`, `.face1`,
 * `.bore#1/2`; along the axis in segments `.2` … as a helical gear's.
 */
export declare function worm(spec: WormSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: WormReport;
};
/** The cylindrical worm wheel's spec (R12b.5): a helical gear at β = γ of the worm's hand, its normal module m_x cos γ. */
export declare function wormWheelSpec(w: WormSpec, wheel: {
    readonly teeth: number;
    readonly faceWidth: number;
} & Omit<SpurGearSpec, 'teeth' | 'faceWidth' | 'module' | 'normalModule' | 'helixAngle' | 'hand'>): SpurGearSpec;
/** `relativePhase`: the worm turned that much past meshing. */
export interface WormPairOptions {
    readonly relativePhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}
export interface WormPairCheck {
    /** Crossed at 90°: (d1 + d2)/2 + x m_n. */
    readonly centerDistance: number;
    /** z2 / z1. */
    readonly speedRatio: number;
    /** Along the worm's axis at the reference: the worm's axial reduction and the wheel's transverse one. */
    readonly backlash: number;
    /** a − ra1 − rf2 and a − ra2 − rf1. */
    readonly tipClearances: readonly [number, number];
    /** In the mid-plane, the worm's axial section as a rack of addendum m_x (exact for ZA; an estimate for ZI, a crossed helical pair in point contact). */
    readonly midPlaneContactRatio: number;
    /** Where the worm's thread must reach along its axis for the wheel's tips (from the mid-plane point): the mesh zone's half-length. */
    readonly meshZoneHalfLength: number;
    /**
     * Sections square to the wheel's axis — the mid-plane and ±b/3 — each swept through one axial pitch of the worm, the
     * least clearance (refined in the mid-plane; a clearance of a module or more comes back as m_x), crossings; the
     * outlines are chords, their sag reported.
     */
    readonly planes: readonly {
        readonly offset: number;
        readonly minimumClearance: number;
        readonly interference: boolean;
    }[];
    readonly interference: boolean;
    readonly chordSag: number;
    readonly diagnostics: readonly GearDiagnostic[];
}
/**
 * The worm's exact transverse outline, all its threads (thread 1 centred on angle 0), from the first space's middle
 * round to it again: (ρ, φ) pairs, φ unwrapped (rising by 2π over the loop).
 */
export declare function wormOutline(g: WormDimensions): Float64Array;
/**
 * The pair's frame: the wheel's axis +Z through the origin, its mid-plane z 0; the worm's axis along +X through (0, −a, 0),
 * its section's angle 0 toward the wheel (+Y) and π/2 toward +Z. The worm turned θ has a thread's middle, in the
 * mid-plane, at x = −θ p / h; the wheel's tooth k in the mid-plane at −π/2 − π/z2 − h θ z1/z2 + 2πk/z2 + phase (a space
 * facing the thread), each turning so their pitch points travel together.
 */
/** What the worm's section in a plane needs (R12b.6 cuts a throated wheel's by it too): its dimensions and outline, the centre distance, the mesh band. */
export interface WormSectionWork {
    readonly w: WormDimensions;
    readonly W: Float64Array;
    readonly a: number;
    readonly reach: number;
    readonly yLo: number;
    readonly yHi: number;
}
/** The worm's section by the plane z = c, turned θ: each outline point (ρ, φ0) where its helix crosses the plane on the wheel's side, the copies a lead apart within ±reach of x 0 (segments x0 y0 x1 y1). */
export declare function wormSection(P: WormSectionWork, c: number, theta: number): Float64Array;
/**
 * The least distance between the two sections (by a grid of a module's cells: past a module it comes back as one),
 * negative (−1) when they cross. Touching is not crossing:
 * two segments that cross by no more than `touch` (an end within it of the other) are in contact, at 0 — at no
 * backlash a ZA worm's mid-plane section and the wheel's touch along the line of action, and rounding makes them cross
 * by 1e-15 mm.
 */
export declare function planeClearance(A: Float64Array, B: Float64Array, touch: number, h: number): number;
/**
 * The worm pair's checks (R12b.5, D136): the wheel at the worm's lead angle and hand and normal module (else
 * MATE_INCOMPATIBLE, saying which); the centre distance, ratio, backlash and tip clearances; the mid-plane contact ratio;
 * and sections square to the wheel's axis at the mid-plane and ±b/3, each swept through one axial pitch of the worm.
 */
export declare function checkWormPair(w: WormSpec, wheel: SpurGearSpec, options?: WormPairOptions): WormPairCheck;
/** A worm as it stands: its frame's origin (the axis at z 0), its axis (local Z) and local X in the part, its turn about the axis (radians). */
export interface PlacedWorm {
    readonly spec: WormSpec;
    readonly origin: Point;
    readonly axis: Point;
    readonly xAxis: Point;
    readonly rotation: number;
}
/** A wheel as placed (a helical spur gear's GearPlacement's own terms): its spec, centre, face plane and turn. */
export interface PlacedWormWheel {
    readonly spec: SpurGearSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}
export interface PlacedWormPairCheck extends WormPairCheck {
    readonly relativePhase: number;
}
/**
 * Where a worm meshing with `wheel` stands (R12b.5): its axis square to the wheel's, at the centre distance along the
 * direction φ (radians from +X about the wheel's axis), in the wheel's mid-plane, its length centred on the line of
 * centres; its local X toward the wheel; turned so a thread meets a space of the wheel in the mid-plane (plus `phase`,
 * radians of the worm's turn).
 */
export declare function wormPlacement(wheel: PlacedWormWheel, w: WormSpec, phi: number, phase: number): PlacedWorm;
/** The placed worm's map from its own frame into the part: row-major 3 × 3 and the offset. */
export declare function wormMatrix(p: PlacedWorm): {
    matrix: [number, number, number, number, number, number, number, number, number];
    offset: Point;
};
/**
 * The pair checks for a worm and wheel as placed: the axes square, the worm's axis in the wheel's mid-plane, at the
 * centre distance (else MATE_INCOMPATIBLE); the relative phase from the worm's turn against the one meshing with the
 * wheel as it stands (modulo a worm pitch's turn), then `checkWormPair`.
 */
export declare function checkPlacedWormPair(wheel: PlacedWormWheel, wp: PlacedWorm, options?: Omit<WormPairOptions, 'relativePhase'>): PlacedWormPairCheck;
