import { type Brep } from '../brep/brep-core.js';
import type { Curve, Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type GearDiagnosticCode = 'INVALID_INPUT' | 'UNSUPPORTED_PROFILE_SHIFT' | 'UNSUPPORTED_GEAR_KIND' | 'PROFILE_BUDGET_EXCEEDED' | 'SELF_INTERSECTION' | 'ROOT_TRANSITION_UNVALIDATED' | 'BORE_INTERSECTION' | 'MATE_INCOMPATIBLE' | 'UNDERCUT' | 'INVOLUTE_INTERFERENCE' | 'TROCHOID_INTERFERENCE' | 'TRIMMING_INTERFERENCE' | 'RIM_INTERSECTION' | 'IDEAL_MODEL';
export interface GearDiagnostic {
    readonly code: GearDiagnosticCode;
    readonly severity: 'error' | 'warning';
    readonly message: string;
}
/** This module's refusal (R7.3a batch 2: the GearError class folded, D279): a BarocssError, `details.source` 'gear'. */
export declare const gearError: (code: GearDiagnosticCode, detail: string) => KernelError & {
    readonly code: GearDiagnosticCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isGearError: (e: unknown) => e is KernelError & {
    readonly code: GearDiagnosticCode;
};
/** Version 0 of the spur gear's inputs (lengths in mm). */
export interface SpurGearSpec {
    /** A spur gear's module. (A helical gear's is `normalModule`; giving this with a helix angle is refused.) */
    readonly module?: number;
    /** A helical gear (R6a.5c, D59): its normal module m_n, helix angle β at the reference circle (0 < β ≤ 45°) and hand. */
    readonly normalModule?: number;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    readonly teeth: number;
    /** The reference pressure angle (a helical gear's normal one, α_n); 20° only in this stage. */
    readonly pressureAngle?: number;
    readonly faceWidth: number;
    /** x, the cutting rack moved out by x m (R6a.5, D57): from −0.5 to 1 (UNSUPPORTED_PROFILE_SHIFT otherwise). */
    readonly profileShiftCoefficient?: number;
    /** 0: no bore. */
    readonly boreDiameter?: number;
    /** This gear's circumferential tooth thickness taken off at the reference circle (its share of a pair's backlash). */
    readonly toothThicknessReduction?: number;
    /**
     * How the root joins the flanks: 'schematic-radial' (the default; generator spur-gear@0) or 'generated' (R12b.1a,
     * D130; spur-gear@1): the root the basic rack cuts, its tip rounded by `toolTipRadius` — spur and (R12b.1b, D131) helical.
     */
    readonly rootPolicy?: 'schematic-radial' | 'generated';
    /** The basic rack's tip radius ρ for a generated root (default 0.38 m); it must leave a flat between the two rounds. */
    readonly toolTipRadius?: number;
    /** The largest deviation of a fitted flank from the involute; default 1e-4 m. */
    readonly profileTolerance?: number;
    /** The least rim left round a bore, below the root circle; default 1 m (geometry only: not a strength check). */
    readonly minimumRim?: number;
}
export interface SpurGearDimensions {
    readonly referenceDiameter: number;
    readonly baseDiameter: number;
    readonly tipDiameter: number;
    readonly rootDiameter: number;
    readonly circularPitch: number;
    readonly toothThickness: number;
    readonly tipThickness: number;
}
export interface SpurGearReport {
    readonly generator: 'spur-gear@0' | 'spur-gear@1';
    readonly dimensions: SpurGearDimensions;
    /** The profile shift coefficient x it was cut with (0: none). */
    readonly profileShift: number;
    /**
     * A helical gear's (R6a.5c, D59): its normal and transverse module and pressure angle, helix angle and hand, lead,
     * the total twist over the face, and the fit of that twist — its largest deviation at the tip circle (the flank
     * surface lies within profileDeviation + twistDeviation of the involute helicoid), the axial segments and the
     * cubic pieces in each.
     */
    readonly helix?: {
        readonly normalModule: number;
        readonly transverseModule: number;
        readonly transversePressureAngle: number;
        readonly helixAngle: number;
        readonly hand: 'right' | 'left';
        readonly lead: number;
        readonly twist: number;
        readonly twistDeviation: number;
        readonly axialSegments: number;
        readonly piecesPerSegment: number;
    };
    /** Cubic pieces in each flank, and the largest measured deviation of a flank from the involute (mm). */
    readonly flankPieces: number;
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    readonly rootPolicy: 'schematic-radial' | 'generated';
    readonly manufacturingValidated: false;
    /**
     * A generated root's (R12b.1a): the tool's tip radius; the diameter where the involute begins — the form circle, or
     * where the tool cuts the involute when `undercut`; the fillet's cubic pieces and their largest measured deviation
     * from the envelope (a bound: at the same tool position).
     */
    readonly generatedRoot?: {
        readonly toolTipRadius: number;
        readonly formDiameter: number;
        readonly undercut: boolean;
        readonly filletPieces: number;
        readonly filletDeviation: number;
    };
    readonly diagnostics: readonly GearDiagnostic[];
}
/** A curve of the profile in the plane (z 0): its role, the tooth it belongs to (1-based) and its curve. */
interface Piece {
    readonly role: 'flankL' | 'flankR' | 'tip' | 'root' | 'rootL' | 'rootR' | 'filletL' | 'filletR' | 'bore';
    readonly tooth: number;
    readonly curve: Curve;
    readonly part?: number;
}
export declare const inv: (phi: number) => number;
/** The gear's dimensions and the checks of this stage's inputs (refusals thrown, as gearError). */
export declare function spurGearDimensions(spec: SpurGearSpec): SpurGearDimensions & {
    alpha: number;
    rb: number;
    ra: number;
    rf: number;
    r: number;
    psi: number;
    mn: number;
    mt: number;
    beta: number;
    alphaN: number;
    rs: number;
    root?: RackRoot;
};
/**
 * A generated root (R12b.1a, D130), in the frame where the tooth space it cuts is centred on +Y and the tooth it bounds
 * lies at π/2 − π/z: the basic rack as the tool — addendum 1.25 m into the gear, flanks at α, its tooth πm/2 + Δs wide on
 * its reference line (Δs the gear's thickness reduction), the line at r + x m — its tip round's centre (xc, yc) when the
 * gear stands at 0 (rounds ρ, tangent to the flank and to the flat tip between them). As the gear turns φ the rack moves
 * by −rφ. `phiRoot` (= xc / r) is the turn at which the round's lowest point touches the root circle, `phiEnd` the one at
 * which the fillet meets the involute, at radius `rStart`.
 *
 * A helical gear's (R12b.1b, D131) in its transverse plane: the normal rack's round, a cylinder along the tooth (at β to
 * the axis), cut by that plane is an ellipse — semi-axes a = ρ / cos β along the pitch line, b = ρ across it — tangent
 * to the transverse flank (at α_t) and the flat tip; the pitch π m_t, heights in m_n. A spur gear's: a = b = ρ.
 */
export interface RackRoot {
    readonly rho: number;
    readonly a: number;
    readonly b: number;
    readonly xc: number;
    readonly yc: number;
    readonly r: number;
    readonly rb: number;
    readonly psi: number;
    readonly z: number;
    readonly thetaEnd: number;
    readonly phiRoot: number;
    readonly phiEnd: number;
    readonly rStart: number;
    readonly undercut: boolean;
}
/**
 * The fillet's point at the gear's turn φ: the tip round's centre is (xc − rφ, yc), the pitch point (0, r); the gear is
 * touched at the round's point on the line through the two, on the far side from the pitch point (its normal passes
 * through the instant centre), that point turned back by −φ into the gear's frame (D129). A helical gear's ellipse: at
 * the angle θ the turn calls for (D131).
 */
export declare function filletPoint(R: RackRoot, phi: number): [number, number];
/**
 * A root fillet as any tool generates it (R12b.2b: a shaper cutter's tip round, D133): its point and derivative at the
 * tool's turn φ in its own frame, run from `phiRoot` (the root side) to `phiEnd` (where it meets the involute), the
 * tool's tip radius `rho`. The fit below is the rack's (D130), on this interface.
 */
export interface Envelope {
    point(phi: number): [number, number];
    derivative(phi: number): [number, number];
    readonly phiRoot: number;
    readonly phiEnd: number;
    readonly rho: number;
}
/** An envelope's breaks for N pieces, at equal tangent turning (as `filletBreaks`). */
export declare function envelopeBreaks(E: Envelope, N: number): number[];
/** An envelope's C¹ Hermite Bézier poles over the breaks phis[j0] → phis[j1], in its own frame (z 0). */
export declare function envelopePoles(E: Envelope, phis: readonly number[], j0: number, j1: number): Point[];
/** The largest distance of an envelope's fit over `phis` from the envelope at the same φ (a bound). */
export declare function envelopeDeviation(E: Envelope, phis: readonly number[]): number;
/**
 * One flank's Bézier control points (3N + 1, z 0) in the tooth's frame, over the roll t0 → t1, N C¹ Hermite pieces:
 * the involute turned by `turn`, mirrored in its x axis first when `mirror`.
 */
export declare function flankPoles(rb: number, t0: number, t1: number, N: number, turn: number, mirror: boolean): Point[];
/** The largest distance of a Hermite-fitted involute (N pieces, unturned) from the involute: along the circle at each radius (a bound). */
export declare function flankDeviation(rb: number, t0: number, t1: number, N: number): number;
export declare const bezierKnots: (N: number) => number[];
export declare const lineCurve: (id: string, a: Point, b: Point) => Curve;
/** A circular arc about the origin, radius r, from angle a0 counter-clockwise by sweep (> 0; spans of at most 90°), or clockwise when sweep < 0. */
export declare function arcCurve(id: string, r: number, a0: number, sweep: number): Curve;
export declare const reversed: (c: Curve) => Curve;
/** The gear's profile: its curves counter-clockwise round the gear (the bore's clockwise), and its report. */
export declare function spurGearProfile(spec: SpurGearSpec): {
    pieces: Piece[];
    bore: Piece[];
    report: SpurGearReport;
};
/**
 * The gear as a solid: its profile pulled from z 0 through the face width, the bore through it. Faces `<id>.flankL#k`
 * and `.flankR#k` (tooth k's flanks), `.tip#k`, `.root#k` (the root arc after tooth k), `.rootL#k`/`.rootR#k` (the
 * schematic radial joins) or `.filletL#k`/`.filletR#k` (a generated root's fillets, R12b.1a; a fillet of more than five
 * pieces on more faces, root outward, `.filletL2#k`, `.filletL3#k`), `.face0`/`.face1` (z 0 /
 * the far face), `.bore#1`/`#2`.
 */
export declare function spurGear(spec: SpurGearSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: SpurGearReport;
};
/**
 * A helical gear's twist (R6a.5c, D59): the transverse profile turned by z tan β / r as it rises (the lead 2πr / tan β).
 * As few cubic pieces of the twist as keep it within the tolerance at the outermost circle `g.ra`, at most four to an
 * axial segment (the faces split along the axis, exactly at the seams); past 64 segments refused, never a looser fit.
 * Null for a spur gear. (An internal gear's hole twists by its space gear's, R12b.2a.)
 */
export declare function helixTwist(spec: SpurGearSpec, g: ReturnType<typeof spurGearDimensions>, tol: number): {
    twist: ProfileTwist;
    helix: NonNullable<SpurGearReport['helix']>;
} | null;
/** A feature id made safe for B-rep entity ids. */
export declare const safeId: (id: string) => string;
/** A twist along the depth: the profile turned by `angle` (radians) from bottom to top, in `segments` faces along the axis, each `pieces` cubic pieces. */
export interface ProfileTwist {
    readonly angle: number;
    readonly segments: number;
    readonly pieces: number;
}
/**
 * A closed plane profile (z 0; its curves counter-clockwise, a hole's clockwise) pulled from z 0 through `depth`:
 * each curve a side face of its name, `<id>.face0`/`.face1` the end faces (their planes reaching `R` about the origin).
 * With a `twist` (helical gears, R6a.5c) the outer profile turns as it rises: each side face the curve turned by A(v),
 * a cubic Hermite fit of the rotation e^{iθ(v)} (exact at the piece ends, so the faces of neighbouring axial segments
 * meet on the exactly turned curve), its deviation measured by `twistDeviation`; segment j's faces are named `#k.j`
 * after the first. The holes do not turn — unless `twistHole`, when only the hole does (an internal gear's teeth). With a `shear` (helical racks) the profile slides along +X by shear × z as it
 * rises: planar faces still, exactly.
 */
export declare function extrudedProfile(id: string, family: string, outerPieces: readonly {
    name: string;
    curve: Curve;
}[], innerPieces: readonly {
    name: string;
    curve: Curve;
}[], depth: number, R: number, twist?: ProfileTwist, shear?: number, twistHole?: boolean): Brep;
/** The largest distance, per unit radius, of the Hermite rotation fit (one piece over `step` radians) from the rotation. */
export declare function twistDeviation(step: number): number;
/** The centre distance at which two gears mesh without backlash (shifted pairs: the working one). */
export declare function spurGearCenterDistance(g1: SpurGearSpec, g2: SpurGearSpec): number;
/**
 * A pair's nominal values from the formulas alone (issue #2167 §6): the same module and pressure angle (else
 * MATE_INCOMPATIBLE), centre distance a = m(z1 + z2)/2, the speed ratio −z1/z2, the ideal transverse contact ratio
 * εα = [√(ra1² − rb1²) + √(ra2² − rb2²) − a sin α] / (π m cos α), and the backlash at that centre distance, the sum of
 * the two gears' thickness reductions. Not the pair checks (R6a.4: phase, clearance over a rotation, the usable flank).
 */
export declare function spurGearPairNominal(g1: SpurGearSpec, g2: SpurGearSpec): {
    centerDistance: number;
    speedRatio: number;
    idealContactRatio: number;
    axialContactRatio: number;
    totalContactRatio: number;
    backlash: number;
};
/** The pair check's options: the centre distance (default nominal), gear 2 turned off its meshing phase, the sweep. */
/**
 * The pair check's options: the centre distance (default nominal), gear 2 turned off its meshing phase, the sweep's
 * samples, and `mode` — 'report' (default: the least clearance refined, the depth of a crossing, the convergence
 * check) or 'verdict' (pass or fail: the sweep stops at the first sample whose teeth cross, no depth, one scan).
 */
export interface SpurGearPairOptions {
    readonly centerDistance?: number;
    readonly relativePhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}
export interface SpurGearPairCheck {
    readonly centerDistance: number;
    readonly nominalCenterDistance: number;
    readonly workingPressureAngle: number;
    readonly workingPitchDiameters: readonly [number, number];
    /** Circumferential backlash at the working pitch circle, p_w − s_w1 − s_w2 (by the formula); negative: the teeth jam. */
    readonly backlash: number;
    /** a − ra1 − rf2 and a − ra2 − rf1. */
    readonly tipClearances: readonly [number, number];
    /** The formula's (ideal tips, flanks down to the base circle), and the path of contact the usable flanks allow. */
    readonly idealContactRatio: number;
    readonly usableContactRatio: number;
    /** Helical (R6a.5c): the overlap ratio εβ = b sin β / (π m_n) over the narrower face, and εγ = the usable εα + εβ (spur: 0 and εα). */
    readonly axialContactRatio: number;
    readonly totalContactRatio: number;
    /** Helical: which way the axial thrust goes, in words (a direction, no load). */
    readonly axialThrust?: string;
    /** One tooth period swept (the configuration repeats), at `samples` then twice as many, the least clearance refined. */
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
 * The pair checks (R6a.4, issue #2167 §6): the same module and pressure angle (else MATE_INCOMPATIBLE); at the centre
 * distance a′ the working pressure angle α_w = acos(a cos α / a′), the working pitch circles a′z/(z1 + z2), the
 * backlash p_w − s_w1 − s_w2 and the tip clearances; the contact ratio from the usable flanks (r ≥ max(rb, rf), r ≤ ra
 * on each gear along the line of action) beside the ideal formula; and the two gears' exact profiles (the analytic
 * involute, densely) swept through one tooth period, the least clearance found and refined — interference where they
 * cross. A few frames are not proof: twice the samples must find the same least clearance (converged).
 */
export declare function checkSpurGearPair(g1: SpurGearSpec, g2: SpurGearSpec, options?: SpurGearPairOptions): SpurGearPairCheck;
/**
 * A gear's exact outline for the sweep, as one tooth (from root to root, centred on angle 0): the analytic involute at
 * 150 points a flank (chords within about 1e-5 m of it), the arcs at 24.
 */
export declare function exactProfile(spec: SpurGearSpec, g: ReturnType<typeof spurGearDimensions>): {
    tooth: Float64Array;
    z: number;
};
/** The segments (x0, y0, x1, y1 each) of the tooth runs with an end within `reach` of (cx, cy). */
export declare function nearSegments(runs: Float64Array[], cx: number, cy: number, reach: number): Float64Array;
/** The teeth of a gear turned by θ about (cx, cy) whose middles lie within three pitches of the direction `toward`. */
export declare function teethNear(P: {
    tooth: Float64Array;
    z: number;
}, theta: number, cx: number, cy: number, toward: number): Float64Array[];
export declare const orient: (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => number;
export declare function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean;
export declare function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number;
export declare function segmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number;
/** A spur gear as it stands: axis along +Z through `center`, its faces from `from` to `from` + b, turned by `rotation` (radians). */
export interface PlacedSpurGear {
    readonly spec: SpurGearSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}
export interface PlacedSpurGearPairCheck extends SpurGearPairCheck {
    /** The relative phase the gears stand at (degrees, in [0, 360/z2)), and how far their faces overlap along the axis. */
    readonly relativePhase: number;
    readonly faceOverlap: number;
}
/**
 * The pair checks for two gears as placed (R6a.4b, D56): the centre distance from their centres, the relative phase
 * from their turns (gear 2's turn on the line of centres, less the half-pitch offset, plus gear 1's carried through
 * the ratio, modulo gear 2's pitch angle), and the axial overlap of their faces — none is MATE_INCOMPATIBLE.
 */
export declare function checkPlacedSpurGears(g1: PlacedSpurGear, g2: PlacedSpurGear, options?: Omit<SpurGearPairOptions, 'centerDistance' | 'relativePhase'>): PlacedSpurGearPairCheck;
export {};
