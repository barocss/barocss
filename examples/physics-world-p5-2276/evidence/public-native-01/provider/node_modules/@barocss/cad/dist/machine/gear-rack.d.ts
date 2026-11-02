import type { Brep } from '../brep/brep-core.js';
import { type GearDiagnostic, type SpurGearSpec } from './gear.js';
/** Version 0 of the rack's inputs (lengths in mm). */
export interface SpurRackSpec {
    /** A straight rack's module. (A helical rack's is `normalModule`.) */
    readonly module?: number;
    /**
     * A helical rack (R6a.5c, D60): the normal module, the teeth inclined at β to the gear axis and its hand — the label
     * of the z → ∞ external gear it is, so it meshes with gears of the opposite hand: a left-hand rack's teeth slide
     * +X by z tan β (teeth toward +Y), meshing with right-hand gears.
     */
    readonly normalModule?: number;
    readonly helixAngle?: number;
    readonly hand?: 'right' | 'left';
    /** Teeth along its length; the rack is teeth × πm long, a half gap at each end. */
    readonly teeth: number;
    readonly faceWidth: number;
    /** From the pitch line to the back of the bar (more than the dedendum 1.25 m plus a rim of m). */
    readonly height: number;
    /** 20° only in this stage. */
    readonly pressureAngle?: number;
    /** Circumferential thickness taken off each tooth on the pitch line (the rack's share of the backlash). */
    readonly toothThicknessReduction?: number;
    /** The root: 'schematic-corner' (the default; spur-rack@0) or 'filleted' (R12b.1b, D131; spur-rack@1), radius `rootFilletRadius` (default 0.38 m). */
    readonly rootPolicy?: 'schematic-corner' | 'filleted';
    readonly rootFilletRadius?: number;
}
export interface SpurRackReport {
    readonly generator: 'spur-rack@0' | 'spur-rack@1';
    readonly length: number;
    readonly pitch: number;
    readonly toothThickness: number;
    readonly tipWidth: number;
    readonly rootWidth: number;
    readonly addendum: number;
    readonly dedendum: number;
    /** A helical rack's: β, its hand label, the normal module, and how far its teeth slide along it per mm up the face. */
    readonly helix?: {
        readonly helixAngle: number;
        readonly hand: 'right' | 'left';
        readonly normalModule: number;
        readonly shear: number;
    };
    /** A filleted root's (R12b.1b): its radius, and how deep below the pitch line the straight flank ends (where the fillet starts). */
    readonly rootFillet?: {
        readonly radius: number;
        readonly flankEndDepth: number;
    };
    readonly diagnostics: readonly GearDiagnostic[];
}
/** The rack's dimensions and its input checks (refusals thrown, as gearError). */
export declare function spurRackDimensions(spec: SpurRackSpec): SpurRackReport & {
    alpha: number;
    alphaN: number;
    s: number;
    mn: number;
    beta: number;
    shear: number;
    fillet?: RackFillet;
};
/**
 * A filleted root's fillet on the gap side of a tooth's right flank (R12b.1b, D131), as offsets from the corner where
 * the flank would meet the root line: the ellipse (a = ρ / cos β along, b = ρ across; a circle when straight) tangent to
 * the root line `dx` along it from the corner, its centre `cx` from the corner and b above the root, and tangent to the
 * flank at the angle θ_T (π + atan((b/a) tan α), the third quadrant), `depth` below the pitch line. Two of them must
 * leave a flat on the root, else refused naming the largest ρ.
 */
export interface RackFillet {
    readonly rho: number;
    readonly a: number;
    readonly b: number;
    readonly dx: number;
    readonly thetaT: number;
    readonly depth: number;
}
/**
 * The rack as a solid: its pitch line along +X from x 0 (tooth k centred at (k − ½)πm), teeth toward +Y, the back at
 * y = −height, pulled from z 0 through the face width. Faces `<id>.flankL#k`, `.flankR#k`, `.tip#k`, `.root#k` (the gap
 * before tooth k; `#n+1` the end gap), `.back`, `.end0`/`.end1` (x 0 / the far end), `.face0`/`.face1`; a filleted
 * root's `.filletL#k`, `.filletR#k` (R12b.1b).
 */
export declare function spurRack(spec: SpurRackSpec, options?: {
    readonly id?: string;
}): {
    brep: Brep;
    report: SpurRackReport;
};
/** Options of the gear-and-rack check: the gear axis's distance from the rack's pitch line, the rack slid off its meshing place. */
export interface SpurRackPairOptions {
    readonly centerDistance?: number;
    readonly rackPhase?: number;
    readonly samples?: number;
    readonly mode?: 'report' | 'verdict';
}
export interface SpurRackPairCheck {
    /** The gear axis from the rack's pitch line, and where it meshes without backlash (r + x m). */
    readonly centerDistance: number;
    readonly nominalCenterDistance: number;
    readonly workingPressureAngle: number;
    /** Along the pitch line: the two reductions plus 2 d tan α (d: the distance beyond nominal); negative: the teeth jam. */
    readonly backlash: number;
    /** The gear's tip from the rack's root line, the rack's tip from the gear's root circle (0.25 m each, unshifted at nominal). */
    readonly tipClearances: readonly [number, number];
    readonly idealContactRatio: number;
    readonly usableContactRatio: number;
    /** Helical: εβ = b sin β / (π m_n) over the narrower face, and εγ = the usable εα + εβ (straight: 0 and εα). */
    readonly axialContactRatio: number;
    readonly totalContactRatio: number;
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
 * A spur gear with a rack (R6a.5b): the same module and pressure angle (else MATE_INCOMPATIBLE); backlash, tip
 * clearances, the contact ratio by the formula and by the usable flanks; and the gear's exact outline swept against the
 * rack's through one tooth period (the rack taken long enough), the least clearance converged and refined, a crossing
 * measured by its depth — as for gear pairs (D55), cached and with the same verdict mode.
 */
export declare function checkSpurGearRack(gear: SpurGearSpec, rack: SpurRackSpec, options?: SpurRackPairOptions): SpurRackPairCheck;
/** A rack as it stands: its pitch line from `origin` along `angle` (radians), teeth to its left, faces from `from` through b. */
export interface PlacedSpurRack {
    readonly spec: SpurRackSpec;
    readonly origin: readonly [number, number];
    readonly angle: number;
    readonly from: number;
}
export interface PlacedSpurRackCheck extends SpurRackPairCheck {
    readonly rackPhase: number;
    readonly faceOverlap: number;
}
/**
 * The gear-and-rack checks as placed (R6a.5b, D58): the gear axis's distance from the pitch line, and the phase — where
 * the rack's gaps stand against the gear's teeth, modulo the pitch — from the gear's turn; parallel (both along +Z)
 * and the faces overlapping, else MATE_INCOMPATIBLE, as is a rack whose teeth face away from the gear.
 */
export declare function checkPlacedSpurRack(gear: {
    readonly spec: SpurGearSpec;
    readonly center: readonly [number, number];
    readonly from: number;
    readonly rotation: number;
}, rack: PlacedSpurRack, options?: Omit<SpurRackPairOptions, 'centerDistance' | 'rackPhase'>): PlacedSpurRackCheck;
