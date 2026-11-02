import type { Part } from '../part/part-model.js';
import type { CylindricalWrapAssemblyComponent } from './cylindrical-wrap-assembly.js';
import { type CylindricalWrapBoundReferenceOptions } from './cylindrical-wrap-bound-reference.js';
/** Fresh one-pad construction. Reference closure/mass never imply literal rounded-face coincidence. */
export declare function buildCylindricalWrapClosedReference(part: Part, components: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapBoundReferenceOptions): Readonly<{
    counts: Readonly<{
        exactOperations: number;
        priorOperations: number;
        rationalOperations: number;
        directOperations: number;
        work: number;
        localWork: number;
        maximumBits: number;
        localGcdSteps: number;
    }>;
    walls: import("./cylindrical-wrap-source-walls.js").CylindricalWrapWallReferenceResult;
    closure: {
        authority: "original-wall-radial-graph-prism-union-scale2-uv-rectangle";
        sourceSurface: string;
        rectangle: import("./cylindrical-wrap-formal-mass.js").FormalPadRectangle;
        caps: {
            caps: [string, string];
            uses: {
                bottom: string;
                top: string;
                edge: string;
            }[];
            seams: readonly string[];
            normalizedCycle: import("./cylindrical-wrap-wall-cycle.js").WallCycleProof;
            affine: {
                lower: [number, number];
                upper: [number, number];
                center: readonly [import("../section-rational-internal.js").SectionFraction, import("../section-rational-internal.js").SectionFraction];
                halfSpan: readonly [import("../section-rational-internal.js").SectionFraction, import("../section-rational-internal.js").SectionFraction];
                centerToSourceCenterL1: import("../section-rational-internal.js").SectionFraction;
                normalizedCoordinates: "exact-(2u-1,2v-1)";
                worldCoordinates: "center-plus-positive-diagonal-half-spans";
            };
            boundaryToSourceL1: import("../section-rational-internal.js").SectionFraction;
            boundaryAndInteriorToSourceL1: import("../section-rational-internal.js").SectionFraction;
            correspondence: "matched-boundary-parameter-and-affine-center-disk-extension";
            exactReferenceSourceClosed: true;
            literalStoredShellClosed: false;
        };
        sides: {
            face: string;
            boundary: string;
            baseToReferenceL1: import("../section-rational-internal.js").SectionFraction;
        }[];
        faces: {
            face: string;
            kind: string;
            exactModelL1: import("../section-rational-internal.js").SectionFraction;
            nativeToReferenceL1: import("../section-rational-internal.js").SectionFraction;
        }[];
        maximumNativeToReferenceL1: import("../section-rational-internal.js").SectionFraction;
        tolerance: number;
        topology: {
            readonly vertices: 12;
            readonly edges: 18;
            readonly faces: 9;
            readonly coedges: 36;
            readonly genus: 0;
        };
        nativeFaceDomain: "admitted-exact-face-trim-domain";
        closedReferenceCertified: true;
        referenceFacesMeetOnlyOnPrescribedBoundaries: true;
        nativeFaceAssociationCertified: true;
        literalStoredBrepClosureCertified: false;
        partMassProvider: false;
        productFeature: false;
    };
    mass: {
        authority: "closed-original-radial-reference";
        frame: {
            readonly zCenter: import("../section-rational-internal.js").SectionFraction;
            readonly coordinates: "x-y-z-minus-source-midheight";
        };
        order: readonly ["V", "X", "Y", "Z", "XX", "YY", "ZZ", "XY", "XZ", "YZ"];
        properties: import("../index.js").MassProperties;
        radial: import("../section-rational-internal.js").SectionFraction;
        rawMomentGeometryErrors: import("../section-rational-internal.js").SectionFraction[];
        moments: {
            lower: import("../section-rational-internal.js").SectionFraction;
            upper: import("../section-rational-internal.js").SectionFraction;
        }[];
        audit: {
            volume: {
                error: import("../section-rational-internal.js").SectionFraction;
                lower: import("../section-rational-internal.js").SectionFraction;
                upper: import("../section-rational-internal.js").SectionFraction;
                estimate: number;
            };
            mass: {
                error: import("../section-rational-internal.js").SectionFraction;
                lower: import("../section-rational-internal.js").SectionFraction;
                upper: import("../section-rational-internal.js").SectionFraction;
                estimate: number;
            };
            centroid: {
                error: import("../section-rational-internal.js").SectionFraction;
                lower: import("../section-rational-internal.js").SectionFraction;
                upper: import("../section-rational-internal.js").SectionFraction;
                estimate: number;
            }[];
            inertia: {
                error: import("../section-rational-internal.js").SectionFraction;
                lower: import("../section-rational-internal.js").SectionFraction;
                upper: import("../section-rational-internal.js").SectionFraction;
                estimate: number;
            }[];
        };
        includesFullRadialGeometryError: true;
        actualReturnedNumbersCertified: true;
        literalStoredBrepMass: false;
        nativeSIAccuracy: false;
        partMassProvider: false;
    };
    limits: {
        readonly exactOperations: number;
        readonly hardExactOperations: 200000;
        readonly integerBits: 8192;
        readonly work: 1048576;
    };
    meaning: {
        closedReferenceCertified: true;
        nativeFaceAssociationCertified: true;
        referenceMassCertified: true;
        literalStoredBrepClosureCertified: false;
        literalStoredBrepMass: false;
        partMassProvider: false;
        productFeature: false;
    };
    solidQualified: false;
}>;
