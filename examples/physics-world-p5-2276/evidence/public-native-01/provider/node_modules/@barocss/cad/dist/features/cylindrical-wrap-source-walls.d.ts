import type { Part } from '../part/part-model.js';
import type { CylindricalWrapAssemblyComponent } from './cylindrical-wrap-assembly.js';
import { type CylindricalWrapBoundReferenceOptions, type CylindricalWrapAnyReferenceResult } from './cylindrical-wrap-bound-reference.js';
import { type WallCycleProof } from './cylindrical-wrap-wall-cycle.js';
interface WallBoundary {
    readonly coedge: string;
    readonly edge: string;
    readonly vertices: readonly [string, string];
    readonly sense: 'forward' | 'reversed';
}
export interface SourceWallProof {
    readonly face: string;
    readonly faceSlot: number;
    readonly sense: 'forward' | 'reversed';
    readonly bottom: WallBoundary;
    readonly top: WallBoundary;
}
export interface CylindricalWrapWallReferenceResult {
    readonly reference: CylindricalWrapAnyReferenceResult;
    readonly sourceWalls: {
        readonly walls: readonly SourceWallProof[];
        readonly cycle: WallCycleProof;
        readonly z: readonly [number, number];
    };
    readonly counts: {
        readonly exactOperations: number;
        readonly referenceOperations: number;
        readonly rationalOperations: number;
        readonly directOperations: number;
        readonly work: number;
        readonly localWork: number;
        readonly maximumBits: number;
        readonly localGcdSteps: number;
    };
    readonly limits: CylindricalWrapAnyReferenceResult['limits'];
    readonly meaning: typeof MEANING;
    readonly solidQualified: false;
}
declare const MEANING: Readonly<{
    source: "actual-fresh-formal-source-with-complete-reference-cost";
    originalWallCycleCertified: true;
    originalWallEmbeddingCertified: true;
    originalWallOutwardOrientationCertified: true;
    originalHorizontalBoundaryOwnershipCertified: true;
    coefficientRadialBoundCoversAllSourceWalls: true;
    capTrimEmbeddingCertified: false;
    sourceShellCertified: false;
    closedReferenceCertified: false;
    retainedFaceClosureCertified: false;
    physicalBrepCertified: false;
    representedVolumeCertified: false;
    radialErrorIncludedInMass: false;
    partMassProvider: false;
    productFeature: false;
}>;
/** Original-wall theorem plus both fresh native/formal children, under the same accepted total cap. */
export declare function buildCylindricalWrapWallReference(part: Part, components: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapBoundReferenceOptions): CylindricalWrapWallReferenceResult;
/** Private continuation over the caller's freshly constructed immutable reference. */
export declare function continueCylindricalWrapReferenceWalls(reference: CylindricalWrapAnyReferenceResult): CylindricalWrapWallReferenceResult;
export {};
