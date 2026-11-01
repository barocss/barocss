import type { Body, Vec3 as MutableVec3 } from '../../packages/barocss-physics/src/types.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { NormalProblem, NormalSolverResult } from './candidate.js';
export declare const ORIGINAL_GLOBAL_ISLAND_SHA256 = "670f5226576cb0a2c1963705b99704be71d4ebd3ad38c312adf9c16d43781d8d";
export interface GlobalIslandTransformReceipt {
    inputSha256: string;
    outputSha256: string;
    replacedBlockSha256: string;
    inputBytes: number;
    outputBytes: number;
    replacedBlockBytes: number;
    startAnchorCount: number;
    endAnchorCount: number;
    helperImport: string;
    changedRegion: 'entire velocity solve including warm start';
}
export declare function transformGlobalIslandSource(source: string, adapterModulePath: string): {
    contents: string;
    receipt: GlobalIslandTransformReceipt;
};
export interface NormalIslandPatch {
    aIndex: number;
    bIndex: number;
    aId: string;
    bId: string;
    pairKey: string;
    family: 'face' | 'edge';
    normal: MutableVec3;
    points: readonly {
        id: string;
        pointM: MutableVec3;
    }[];
}
export interface NormalIslandPointMapping {
    index: number;
    candidateId: string;
    pairKey: string;
    pointId: string;
    aId: string;
    bId: string;
    family: 'face' | 'edge';
}
/** Structural reporting DTO; no import of the old position solver type graph. */
export interface AdapterPointLedger {
    aId: string;
    bId: string;
    aIndex: number;
    bIndex: number;
    pairKey: string;
    pointId: string;
    family: 'face' | 'edge';
    pointM: MutableVec3;
    normal: MutableVec3;
    aPositionM: MutableVec3;
    bPositionM: MutableVec3;
    warm: PointImpulse;
    final: PointImpulse;
}
export interface NormalIslandEvent {
    attemptOrdinal: number;
    problem: NormalProblem | null;
    candidate: NormalSolverResult | null;
    assembledPointCount: number;
    assembledPatchCount: number;
    pointMapping: NormalIslandPointMapping[];
    velocitySolveAccepted: boolean;
    refusal: {
        code: string;
        message: string;
    } | null;
}
export declare function setNormalIslandObserver(callback: ((event: NormalIslandEvent) => void) | null): void;
/** One cold call. The caller owns the uncommitted World working-body array. */
export declare function solveFrozenNormalIsland(bodies: Body[], patches: readonly NormalIslandPatch[]): {
    pointsMap: Map<string, PointImpulse>;
    pointLedger: AdapterPointLedger[];
};
