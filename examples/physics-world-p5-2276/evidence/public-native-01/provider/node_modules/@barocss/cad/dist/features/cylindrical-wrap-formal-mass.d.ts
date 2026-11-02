import { type KernelError } from '../core/barocss-error.js';
import { type MassProperties } from '../brep/solid-mass.js';
import { type SectionFraction } from '../section-rational-internal.js';
import type { Part } from '../part/part-model.js';
import { type CylindricalWrapUVSource } from './cylindrical-wrap-source.js';
export interface FormalPadRectangle {
    readonly u: readonly [number, number];
    readonly v: readonly [number, number];
}
export interface FormalPadBudgets {
    readonly volume: number;
    readonly mass: number;
    readonly centroid: readonly [number, number, number];
    /** Diagonal xx, yy, zz, then off-diagonal xy, xz, yz. */
    readonly inertia: readonly [number, number, number, number, number, number];
}
export interface FormalPadMassOptions {
    readonly id: string;
    readonly density: number;
    readonly budgets: FormalPadBudgets;
    readonly maxOperations?: number;
}
export interface FormalMassInterval {
    readonly lower: SectionFraction;
    readonly upper: SectionFraction;
}
export interface FormalMassScalar extends FormalMassInterval {
    readonly estimate: number;
    readonly error: SectionFraction;
}
export interface CylindricalWrapFormalPadMass {
    readonly source: CylindricalWrapUVSource;
    readonly rectangle: FormalPadRectangle;
    readonly options: FormalPadMassOptions;
    readonly authority: 'formal-native-cylinder-union-ideal-scale2-annular-sector';
    readonly method: 'closed-reference-angle-intervals-and-returned-number-audit';
    readonly order: readonly ['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'];
    readonly frame: {
        readonly zCenter: SectionFraction;
        readonly coordinates: 'x-y-z-minus-source-midheight';
    };
    readonly angles: {
        readonly alpha: FormalMassInterval;
        readonly beta: FormalMassInterval;
        readonly width: FormalMassInterval;
        readonly pi: FormalMassInterval;
    };
    readonly sourceMoments: readonly FormalMassInterval[];
    readonly padMoments: readonly FormalMassInterval[];
    readonly moments: readonly FormalMassScalar[];
    readonly positiveAddedVolume: true;
    readonly properties: MassProperties;
    readonly audit: {
        readonly volume: FormalMassScalar;
        readonly mass: FormalMassScalar;
        readonly centroid: readonly FormalMassScalar[];
        readonly inertia: readonly FormalMassScalar[];
    };
    /** D297 radial defects for the selected original quarter and its exact factor2 copy, not all source spans. */
    readonly representation: {
        readonly selectedQuarterRadial: SectionFraction;
        readonly selectedQuarterOuterRadial: SectionFraction;
        readonly includedInMassError: false;
    };
    readonly counts: {
        readonly sourceOperations: number;
        readonly rationalOperations: number;
        readonly directOperations: number;
        readonly totalOperations: number;
        readonly gcdSteps: number;
        readonly maximumBits: number;
        readonly work: number;
    };
    readonly limits: {
        readonly operations: 200000;
        readonly integerBits: 8192;
        readonly work: 1048576;
        readonly fractionBits: 128;
        readonly atanTerms: 24;
        readonly ratioReductions: 3;
    };
    readonly meaning: {
        readonly actualEndpointRays: true;
        readonly originalSourceUnchanged: true;
        readonly literalStoredBrepMass: false;
        readonly wrappedSolid: false;
        readonly nativeBinding: false;
        readonly surfaceArea: false;
        readonly partMassProvider: false;
        readonly nativeSIAccuracy: false;
    };
    readonly solidQualified: false;
}
export type FormalPadMassCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type FormalPadMassError = KernelError & {
    readonly code: FormalPadMassCode;
};
export declare function isFormalPadMassError(error: unknown): error is FormalPadMassError;
/** Formal reference mathematics only. This function does not construct or qualify a wrapped physical solid. */
export declare function certifyCylindricalWrapFormalPadMass(part: Part, rectangleInput: FormalPadRectangle, optionsInput: FormalPadMassOptions): CylindricalWrapFormalPadMass;
/** Private continuation: its caller has just constructed and counted this owned native source. */
export declare function continueCylindricalWrapFormalPadMass(source: CylindricalWrapUVSource, rectangleInput: FormalPadRectangle, optionsInput: FormalPadMassOptions): CylindricalWrapFormalPadMass;
