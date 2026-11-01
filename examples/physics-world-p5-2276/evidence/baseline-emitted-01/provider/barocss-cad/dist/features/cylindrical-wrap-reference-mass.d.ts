import type { SectionFraction } from '../section-rational-internal.js';
import type { CylindricalWrapWallReferenceResult } from './cylindrical-wrap-source-walls.js';
import { ReferenceProofContext } from './cylindrical-wrap-reference-context.js';
/** Private mass continuation, after the caller proves the closed radial-reference decomposition. */
export declare function certifyClosedReferenceMass(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext): {
    authority: "closed-original-radial-reference";
    frame: {
        readonly zCenter: SectionFraction;
        readonly coordinates: "x-y-z-minus-source-midheight";
    };
    order: readonly ["V", "X", "Y", "Z", "XX", "YY", "ZZ", "XY", "XZ", "YZ"];
    properties: import("../index.js").MassProperties;
    radial: SectionFraction;
    rawMomentGeometryErrors: SectionFraction[];
    moments: {
        lower: SectionFraction;
        upper: SectionFraction;
    }[];
    audit: {
        volume: {
            error: SectionFraction;
            lower: SectionFraction;
            upper: SectionFraction;
            estimate: number;
        };
        mass: {
            error: SectionFraction;
            lower: SectionFraction;
            upper: SectionFraction;
            estimate: number;
        };
        centroid: {
            error: SectionFraction;
            lower: SectionFraction;
            upper: SectionFraction;
            estimate: number;
        }[];
        inertia: {
            error: SectionFraction;
            lower: SectionFraction;
            upper: SectionFraction;
            estimate: number;
        }[];
    };
    includesFullRadialGeometryError: true;
    actualReturnedNumbersCertified: true;
    literalStoredBrepMass: false;
    nativeSIAccuracy: false;
    partMassProvider: false;
};
