import type { BrepFace } from '../brep/brep-core.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { CylindricalWrapWallReferenceResult } from './cylindrical-wrap-source-walls.js';
import { ReferenceProofContext } from './cylindrical-wrap-reference-context.js';
/** Pure affine-net theorem. Source identity and fresh boundary residuals are proved by the caller. */
export declare function certifyAffineReferenceCap(face: BrepFace, z: number, top: boolean, ctx: ReferenceProofContext): {
    lower: [number, number];
    upper: [number, number];
    center: readonly [SectionFraction, SectionFraction];
    halfSpan: readonly [SectionFraction, SectionFraction];
    centerToSourceCenterL1: SectionFraction;
    normalizedCoordinates: "exact-(2u-1,2v-1)";
    worldCoordinates: "center-plus-positive-diagonal-half-spans";
};
export declare function certifyOriginalReferenceCaps(parent: CylindricalWrapWallReferenceResult, ctx: ReferenceProofContext): {
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
        center: readonly [SectionFraction, SectionFraction];
        halfSpan: readonly [SectionFraction, SectionFraction];
        centerToSourceCenterL1: SectionFraction;
        normalizedCoordinates: "exact-(2u-1,2v-1)";
        worldCoordinates: "center-plus-positive-diagonal-half-spans";
    };
    boundaryToSourceL1: SectionFraction;
    boundaryAndInteriorToSourceL1: SectionFraction;
    correspondence: "matched-boundary-parameter-and-affine-center-disk-extension";
    exactReferenceSourceClosed: true;
    literalStoredShellClosed: false;
};
export declare function certifyWrappedReferenceClosure(parent: CylindricalWrapWallReferenceResult, caps: ReturnType<typeof certifyOriginalReferenceCaps>, ctx: ReferenceProofContext): {
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
            center: readonly [SectionFraction, SectionFraction];
            halfSpan: readonly [SectionFraction, SectionFraction];
            centerToSourceCenterL1: SectionFraction;
            normalizedCoordinates: "exact-(2u-1,2v-1)";
            worldCoordinates: "center-plus-positive-diagonal-half-spans";
        };
        boundaryToSourceL1: SectionFraction;
        boundaryAndInteriorToSourceL1: SectionFraction;
        correspondence: "matched-boundary-parameter-and-affine-center-disk-extension";
        exactReferenceSourceClosed: true;
        literalStoredShellClosed: false;
    };
    sides: {
        face: string;
        boundary: string;
        baseToReferenceL1: SectionFraction;
    }[];
    faces: {
        face: string;
        kind: string;
        exactModelL1: SectionFraction;
        nativeToReferenceL1: SectionFraction;
    }[];
    maximumNativeToReferenceL1: SectionFraction;
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
