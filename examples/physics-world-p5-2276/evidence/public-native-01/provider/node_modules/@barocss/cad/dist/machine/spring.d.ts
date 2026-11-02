import { type Brep } from '../brep/brep-core.js';
import { type KernelError } from '../core/barocss-error.js';
export type SpringDiagnosticCode = 'INVALID_INPUT' | 'SELF_INTERSECTION' | 'COILS_OVERLAP' | 'PROFILE_BUDGET_EXCEEDED' | 'UNSUPPORTED_SPRING_KIND' | 'LEG_OVERLAP';
export interface SpringDiagnostic {
    readonly code: SpringDiagnosticCode;
    readonly severity: 'error' | 'warning';
    readonly message: string;
}
/** This module's refusal (R7.3a batch 2: the SpringError class folded, D279): a BarocssError, `details.source` 'spring'. */
export declare const springError: (code: SpringDiagnosticCode, detail: string) => KernelError & {
    readonly code: SpringDiagnosticCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isSpringError: (e: unknown) => e is KernelError & {
    readonly code: SpringDiagnosticCode;
};
/** A run of the centreline: `turns` turns at `pitch`, or easing from it to `toPitch` (smoothstep in the angle). */
export interface HelicalRun {
    readonly turns: number;
    readonly pitch: number;
    readonly toPitch?: number;
}
/** Version 0 of the helical sweep: a circle swept square to a right-hand helix of radius `helixRadius` about +Z. */
export interface HelicalSweepSpec {
    readonly helixRadius: number;
    readonly runs: readonly HelicalRun[];
    /** The section, in the centreline's normal plane: a circle only in this stage (lines and arcs later, D139). */
    readonly section: {
        readonly kind: 'circle';
        readonly radius: number;
    };
    /** The centreline's height at φ 0 (default 0); the wire starts on +X. */
    readonly startZ?: number;
    /** The largest distance of the fitted surface from the exact pipe (default 1e-4 × the section's diameter). */
    readonly profileTolerance?: number;
    /** The most cubic pieces along the sweep (default 1024). */
    readonly maxPieces?: number;
}
export interface HelicalSweepResult {
    readonly brep: Brep;
    /** The centreline's length (constant runs exactly, easing runs by 24-point Gauss–Legendre). */
    readonly wireLength: number;
    /** The centreline's height at its end. */
    readonly endZ: number;
    readonly pieces: number;
    readonly segments: number;
    /** The measured bound on the surface's distance from the exact pipe, and the tolerance it was held to. */
    readonly profileDeviation: number;
    readonly profileTolerance: number;
    /** The centreline's least radius of curvature (sampled on easing runs; R(1 + (h/R)²) on constant ones). */
    readonly minCurvatureRadius: number;
}
/** Sweep a circle square to a helix: the wire of a coil (see the file's header). */
export declare function helicalSweep(id: string, spec: HelicalSweepSpec): HelicalSweepResult;
/** Version 0 of a compression spring's inputs (lengths in mm, G in MPa, loads in N). */
export interface SpringSpec {
    /** `compression` (compressionSpring); `extension` and `torsion` are hookedSpring's (R12c.1b). */
    readonly type?: 'compression' | 'extension' | 'torsion';
    /** Only `cylindrical` (conical, barrel and variable-pitch bodies are not in R12c). */
    readonly body?: 'cylindrical' | 'conical' | 'barrel' | 'variable-pitch';
    /** Only `round` wire. */
    readonly wire?: 'round' | 'rectangular';
    readonly wireDiameter: number;
    /** The mean coil diameter D — or the outer (D + d) or inner (D − d); exactly one. */
    readonly meanDiameter?: number;
    readonly outerDiameter?: number;
    readonly innerDiameter?: number;
    readonly activeCoils: number;
    /** The body's pitch, or the free length L0; exactly one. */
    readonly pitch?: number;
    readonly freeLength?: number;
    readonly hand?: 'right' | 'left';
    readonly ends?: 'open' | 'closed' | 'closed-ground';
    /** Dead coils at each closed end (default 1; above 0, at most 1 in this stage: more would touch each other). */
    readonly endCoils?: number;
    /** The pitch's transition from the dead coil to the body, degrees (default 90). */
    readonly transition?: number;
    /** The wire's shear modulus G for the rate; `shearModulusEstimate` flags a value that is an estimate (the studio's steel). */
    readonly shearModulus?: number;
    readonly shearModulusEstimate?: boolean;
    /** A working load: its deflection, length and corrected shear stress are reported. */
    readonly load?: number;
    readonly profileTolerance?: number;
}
export interface SpringDimensions {
    readonly wireDiameter: number;
    readonly meanDiameter: number;
    readonly outerDiameter: number;
    readonly innerDiameter: number;
    /** C = D/d, and Wahl's factor K_W = (4C − 1)/(4C − 4) + 0.615/C. */
    readonly springIndex: number;
    readonly wahlFactor: number;
    readonly activeCoils: number;
    readonly endCoils: number;
    readonly totalCoils: number;
    readonly pitch: number;
    readonly helixAngle: number;
    readonly freeLength: number;
    /** L0 / D. No buckling claim is made. */
    readonly slenderness: number;
    /** The least pitch keeping neighbouring turns of the centreline d apart (geometric), and the solid height at it. */
    readonly solidPitch: number;
    readonly solidHeight: number;
    /** The supplier's convention (the formula pages, S1 in D139): d·n_t with ground ends, d·(n_t + 1) otherwise. */
    readonly supplierSolidHeight: number;
    readonly supplierSolidHeightRule: 'd·n_t' | 'd·(n_t + 1)';
    /** L0 less the geometric solid height. */
    readonly travelToSolid: number;
    /** k = G d⁴ / (8 D³ n_a), when G is given; G and whether it is an estimate. */
    readonly rate?: number;
    readonly shearModulus?: number;
    readonly shearModulusEstimate?: boolean;
    /** At the working load: deflection F/k, the length then, τ = K_W 8FD/(πd³) and the uncorrected 8FD/(πd³). */
    readonly load?: {
        readonly force: number;
        readonly deflection?: number;
        readonly length?: number;
        readonly shearStress: number;
        readonly uncorrectedShearStress: number;
    };
}
export interface SpringReport {
    readonly generator: 'spring@0';
    readonly type: 'compression';
    readonly ends: 'open' | 'closed' | 'closed-ground';
    readonly hand: 'right' | 'left';
    readonly dimensions: SpringDimensions;
    readonly sweep: Omit<HelicalSweepResult, 'brep' | 'endZ'>;
    /** No fatigue, buckling, relaxation or manufacturing claim. */
    readonly manufacturingValidated: false;
    readonly diagnostics: readonly SpringDiagnostic[];
}
/** The geometric solid pitch: the least pitch keeping neighbouring turns of the centreline (mean diameter D) d apart. */
export declare function springSolidPitch(meanDiameter: number, wireDiameter: number): number;
/** A compression spring's dimensions, rate and stresses, without its geometry. */
export declare function springDimensions(spec: SpringSpec): SpringDimensions;
/** A compression spring (spring@0) in its own frame: axis +Z, from z 0 (its lowest point, or its ground plane), the wire starting on +X. */
export declare function compressionSpring(spec: SpringSpec, options?: {
    readonly id?: string;
}): {
    readonly brep: Brep;
    readonly report: SpringReport;
};
/** Version 0 of an extension or a torsion spring's own inputs (beside SpringSpec's wire, diameter and coils). */
export interface HookedSpringSpec extends SpringSpec {
    /** Extension: the hooks at both ends (default machine-loop). */
    readonly hooks?: 'machine-loop' | 'crossover';
    /** The bends' centreline radius (default d), the crossover's loop radius (default D/2), the loops' angle (degrees; 180 machine loop, 270 crossover). */
    readonly bendRadius?: number;
    readonly loopRadius?: number;
    readonly loopAngle?: number;
    /** Extension: the initial tension, the user's figure (no data behind it), taken off the load before the rate. */
    readonly initialTension?: number;
    /** Torsion: the legs' lengths along the coil's tangent at its start and end (default D each). */
    readonly legLengths?: readonly [number, number];
    /** Torsion: Young's modulus E for the rate (an input; `youngsModulusEstimate` flags an estimate), a working moment (N·mm). */
    readonly youngsModulus?: number;
    readonly youngsModulusEstimate?: boolean;
    readonly moment?: number;
}
export interface HookedSpringDimensions {
    readonly wireDiameter: number;
    readonly meanDiameter: number;
    readonly outerDiameter: number;
    readonly innerDiameter: number;
    readonly springIndex: number;
    readonly activeCoils: number;
    readonly pitch: number;
    readonly helixAngle: number;
    /** The coil's height (its centreline's rise plus the wire), and the wire's whole centreline length. */
    readonly bodyLength: number;
    readonly wireLength: number;
    /** Extension: the length inside the hooks (the loops' inner extremes along the axis). */
    readonly lengthInsideHooks?: number;
    /** Extension: k = Gd⁴/(8D³n), the initial tension as given, at a load: the extension (F − F_i)/k, τ = K_W 8FD/(πd³). */
    readonly rate?: number;
    readonly shearModulus?: number;
    readonly shearModulusEstimate?: boolean;
    readonly wahlFactor?: number;
    readonly initialTension?: number;
    readonly load?: {
        readonly force: number;
        readonly extension?: number;
        readonly shearStress: number;
    };
    /** Torsion: k = Ed⁴/(64Dn) per radian and per degree, the free angle between the legs, at a moment: the turn and σ = K_b 32M/(πd³). */
    /** Torsional stiffness in N·mm per degree. */
    readonly torsionalRate?: number;
    readonly youngsModulus?: number;
    readonly youngsModulusEstimate?: boolean;
    readonly legAngle?: number;
    readonly legLengths?: readonly [number, number];
    readonly bendingFactor?: number;
    readonly moment?: {
        readonly moment: number;
        readonly turn?: number;
        readonly bendingStress: number;
    };
    /** The least distance found between the centrelines of pieces that are not neighbours (sampled), against d. */
    readonly leastClearance: number;
}
export interface HookedSpringReport {
    readonly generator: 'spring@0';
    readonly type: 'extension' | 'torsion';
    readonly hooks?: 'machine-loop' | 'crossover';
    readonly hand: 'right' | 'left';
    readonly dimensions: HookedSpringDimensions;
    readonly sweep: Omit<HelicalSweepResult, 'brep' | 'endZ' | 'wireLength'>;
    readonly manufacturingValidated: false;
    readonly diagnostics: readonly SpringDiagnostic[];
}
/** An extension or a torsion spring (spring@0) in its own frame: the coil's axis +Z, from z 0 (its lowest point), its wire starting on +X. */
export declare function hookedSpring(spec: HookedSpringSpec, options?: {
    readonly id?: string;
}): {
    readonly brep: Brep;
    readonly report: HookedSpringReport;
};
