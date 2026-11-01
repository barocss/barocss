import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
export interface CurveJoinOptions {
    curveId: string;
    rightParameterEnd?: number;
}
export type CurveJoinD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface CurveJoinKnotMapping {
    index: number;
    original: number;
    mapped: number;
    origin: 'original-copy' | 'generated-affine' | 'left-join-clamp' | 'requested-end-clamp';
}
export interface CurveJoinProvenance {
    parents: {
        slot: 'left' | 'right';
        curveId: string;
        domain: [number, number];
        poleCount: number;
    }[];
    parameterMap: {
        originalRightDomain: [number, number];
        targetRightDomain: [number, number];
        scale: number;
        inverseD1Scale: number;
        identityBitCopy: boolean;
        mappedKnots: CurveJoinKnotMapping[];
    };
    weightScale: {
        factor: number;
        identityBitCopy: boolean;
        originalRightWeights: number[];
        scaledRightWeights: number[];
        computedSharedWeight: number;
        leftSharedWeight: number;
        sharedWeightResidual: number;
        arithmeticUncertainty: number;
    };
    shared: {
        leftPoleIndex: number;
        rightPoleIndex: 0;
        joinedPoleIndex: number;
        point: Point;
        weight: number;
        policy: 'left-authored-control-and-weight-bits';
    };
    coefficientMappings: {
        slot: 'left' | 'right';
        parentPoleIndex: number;
        joinedPoleIndex: number;
        pointOrigin: 'original-copy' | 'left-shared-copy';
        weightOrigin: 'original-copy' | 'constant-scaled' | 'left-shared-copy';
    }[];
    knotMappings: {
        slot: 'left' | 'right';
        parentKnotIndex: number;
        joinedKnotIndex: number;
    }[];
    removedKnots: {
        leftLastIndex: number;
        rightStartIndices: number[];
    };
}
export interface CurveJoinObservation {
    slot: 'left' | 'right';
    originalParameter: number;
    joinedParameter: number;
    originalPoint: Point;
    joinedPoint: Point;
    pointDifference: number;
    originalD1: CurveJoinD1State;
    joinedD1: CurveJoinD1State;
    expectedDerivative: Point | null;
    derivativeDifference: number | null;
    relativeDerivativeScale: number;
}
export interface JoinedCurveReport {
    family: 'own-native-same-degree-positive-rational-curve-join';
    dto: {
        schema: 'barocss-native-joined-curve';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-c0-curve-not-wire-topology';
    };
    curveId: string;
    degree: number;
    poleCounts: {
        left: number;
        right: number;
        joined: number;
    };
    domain: [number, number];
    joinParameter: number;
    joinMultiplicity: number;
    numericEndpointCoincidence: boolean;
    observations: CurveJoinObservation[];
    maximumPointDifference: number;
    maximumRelativeDerivativeDifference: number;
    nativeJoinD1: CurveJoinD1State;
    oneSided: {
        leftOriginal: CurveJoinD1State;
        rightOriginal: CurveJoinD1State;
        rightDerivativeInJoinedParameter: Point | null;
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        continuity: 'native-c0-guard-unchanged-no-g1-g2-claim';
    };
    limits: {
        maximumDegree: 3;
        maximumParentPoles: 16;
        maximumJoinedPoles: 31;
        nativeMathPoles: 64;
        nativeSourceKnots: 70;
        maximumObservations: 128;
        inputValues: 4096;
        inputDepth: 8;
        inputArrayElements: 64;
        inputRecordFields: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
    };
}
export interface JoinedCurveResult {
    left: Curve;
    right: Curve;
    options: CurveJoinOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    parentSources: {
        left: string;
        right: string;
    };
    parentModels: {
        left: Model;
        right: Model;
    };
    provenance: CurveJoinProvenance;
    report: JoinedCurveReport;
}
/** One shared authored pole/weight, explicit right-domain map and constant rational weight scale. */
export declare function joinCurves(leftInput: Curve, rightInput: Curve, inputOptions: CurveJoinOptions): JoinedCurveResult;
/** Rebuild qualified originals and every genuine native join/map/weight/source observation. */
export declare function validateJoinedCurveResult(input: JoinedCurveResult): JoinedCurveReport;
