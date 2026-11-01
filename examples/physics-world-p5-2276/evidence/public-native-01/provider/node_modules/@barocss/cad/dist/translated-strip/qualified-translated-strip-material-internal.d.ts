import type { TranslatedSurfaceBaseFaceResult } from './translated-surface-base-face.js';
import type { TranslatedSurfaceEndFacesResult } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceStripVolumeResult } from './translated-surface-strip-volume.js';
import type { SectionRationalContext, SectionFraction } from '../section-rational-internal.js';
import type { Surface } from '../types.js';
type Role = 'lower' | 'upper' | 'cap' | 'base' | 'uMin' | 'uMax';
type Domains = {
    u: [number, number];
    v: [number, number];
};
type Bound = {
    exact: SectionFraction;
    upper: number;
};
export interface QualifiedTranslatedStripMaterialBindings {
    faceIds: {
        lower: string;
        upper: string;
        cap: string;
        base: string;
        uMin: string;
        uMax: string;
    };
    shellId: string;
    bodyId: string;
    sourceModelIds: [string, string];
}
type CapSpan = {
    degree: number;
    lowerCurveId: string;
    upperCurveId: string;
    lowerPlaneUVId: string;
    upperPlaneUVId: string;
    lowerPoleIndices: number[];
    upperPoleIndices: number[];
    lowerWorldPoleIndices: number[];
    upperWorldPoleIndices: number[];
    constantWorldWeights: {
        lower: SectionFraction;
        upper: SectionFraction;
    };
    lowerCartesian: SectionFraction[][];
    upperCartesian: SectionFraction[][];
    translationResiduals: SectionFraction[][];
    lowerPlaneUV: SectionFraction[][];
    upperPlaneUV: SectionFraction[][];
    mappedLower: SectionFraction[][];
    mappedUpper: SectionFraction[][];
    mappingResiduals: {
        lower: SectionFraction[][];
        upper: SectionFraction[][];
    };
    commonUCoefficients: SectionFraction[];
    commonUDerivative: SectionFraction[];
    minimumUDerivative: SectionFraction;
    separationCoefficients: SectionFraction[];
    separation: SectionFraction;
    interpolationDirection: SectionFraction[];
    interpolationResiduals: SectionFraction[];
};
type MaterialSpan = {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    roofPoleIndices: number[];
    originalX: SectionFraction[];
    xDerivative: SectionFraction[];
    roofV: SectionFraction[];
    roofHeight: SectionFraction[];
    roofDerivative: SectionFraction[];
    minimumXDerivative: SectionFraction;
    minimumRoofHeight: SectionFraction;
    jacobianDegree: number;
    jacobianAbsoluteCoefficients: SectionFraction[];
    jacobianSignedCoefficients: SectionFraction[];
    minimumJacobianAbsolute: SectionFraction;
    planeOnRoofCoefficients: SectionFraction[];
    surfaceRoofBinding: {
        degree: number;
        originalCartesian: SectionFraction[][][];
        betaCoefficients: SectionFraction[];
        composedCartesian: SectionFraction[][];
        lowerWorldElevated: SectionFraction[][];
        upperWorldElevated: SectionFraction[][];
        lowerResiduals: SectionFraction[][];
        upperTranslatedResiduals: SectionFraction[][];
    };
    roofConormal: {
        degree: number;
        coefficients: SectionFraction[][];
        planeRawNormal: SectionFraction[];
        crossResiduals: SectionFraction[][];
        positiveProportionality: SectionFraction[];
        minimumZCoefficient: SectionFraction;
    };
    cap: CapSpan;
    exactVolumeMM3: SectionFraction;
};
type WholeFaceImage = {
    role: Role;
    faceId: string;
    parentFaceId: string;
    surfaceId: string;
    supportRef: {
        sourceModelId: string;
        objectId: string;
    };
    orientation: 'forward' | 'reverse';
    parentLoopId: string;
    worldCurveRefs: {
        sourceModelId: string;
        objectId: string;
    }[];
    pcurveIds: string[];
    storedUses: {
        parentUseId: string;
        curveId: string;
        pcurveId: string;
        sense: 'forward' | 'reverse';
        interval: [number, number];
    }[];
    directionConvention: 'parent-stored-use-order-already-includes-face-orientation';
    cubeRestriction: 'w=0' | 'w=1' | 't=1' | 't=0' | 'u=uMin' | 'u=uMax';
    nativeDomains: Domains;
    entireImage: 'whole-lower-strip' | 'whole-native-rectangle' | 'whole-plane-strip';
    mapIdentity: string;
    surjectivity: string;
    actualSurface: Surface;
    actualCartesian: SectionFraction[][][];
    expectedCartesian: SectionFraction[][][];
    coefficientResiduals: SectionFraction[][][];
    mixedCoefficient: SectionFraction[] | null;
    chartBoundaryAuthority: {
        curveIds: string[];
        wholeClosedDomain: true;
        parentEmbeddingSchema: string;
    };
    outward: {
        axis: 'x' | 'y' | 'z' | 'plane';
        sign: -1 | 1;
        positiveMagnitudeLowerBound: SectionFraction;
        scope: 'per-smooth-patch-and-one-sided-endpoints';
    };
};
export interface QualifiedTranslatedStripMaterialProof {
    schema: 'barocss-qualified-translated-strip-material';
    version: 0;
    certificateId: string;
    bodyId: string;
    shellId: string;
    faceIds: QualifiedTranslatedStripMaterialBindings['faceIds'];
    sourceModelIds: [string, string];
    sources: {
        lowerSourceId: string;
        upperSourceId: string;
        planeSourceId: string;
        lowerSurfaceId: string;
        upperSurfaceId: string;
        planeId: string;
        originalModelNames: string[];
        lowerWorldCurveId: string;
        upperWorldCurveId: string;
        lowerRoofUVId: string;
        upperRoofUVId: string;
        volumeEvaluationId: string;
    };
    cubeMap: {
        formula: 'Phi(u,t,w)=S_lower(u,Vmin+t*(roofV(u)-Vmin))+[0,h*w,0]';
        nativeDomains: Domains;
        cubeDomains: {
            u: [number, number];
            t: [0, 1];
            w: [0, 1];
        };
        h: SectionFraction;
        uniformSurfaceWeight: SectionFraction;
        z0: SectionFraction;
        zDerivative: SectionFraction;
        minimumXDerivative: SectionFraction;
        minimumRoofHeight: SectionFraction;
        minimumJacobianAbsolute: SectionFraction;
        translationDifferences: SectionFraction[][][];
        translationResiduals: SectionFraction[][][];
        continuous: true;
        globallyInjective: true;
        inverse: {
            u: 'unique-inverse-of-strict-X';
            v: 'Vmin+(Z-z0)/Zv';
            t: '(v-Vmin)/(roofV(u)-Vmin)';
            w: '(Y-S_lower_Y(u,v))/h';
        };
        regularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1';
    };
    spans: MaterialSpan[];
    sixFaceImages: WholeFaceImage[];
    plane: {
        origin: SectionFraction[];
        uAxis: SectionFraction[];
        vAxis: SectionFraction[];
        nativeDomains: Domains;
        rawNormal: SectionFraction[];
        d: SectionFraction;
        gramDeterminant: SectionFraction;
        fourthCornerResiduals: SectionFraction[];
        inside: {
            formula: 'PlaneSigned(u,v,w)=NZ*Zv*(v-roofV(u))';
            factor: SectionFraction;
            nonpositiveOnClosedCube: true;
        };
        capMap: {
            formula: 'Plane(commonU(u),lowerPlaneV(u)+w*separation)=lowerWorldCut(u)+[0,h*w,0]';
            commonUStrictBijection: true;
            positiveSeparation: true;
            entireStripImage: true;
        };
    };
    volume: {
        exactVolumeMM3: SectionFraction;
        volumeMM3: number;
        conversionError: Bound;
        recomputedExactVolumeMM3: SectionFraction;
        unchangedInheritedConversion: true;
    };
    sourceDefinedOccupiedRegion: true;
    wholeBoundaryImage: true;
    outwardMaterial: true;
    embeddedClosedBoundary: true;
    restrictedSolidCertified: true;
    parentFlagsUnchanged: true;
    limits: {
        nativeOrParentCalls: 0;
        floatConversions: 0;
        maximumPolynomialDegree: 4;
        maximumSpans: 4;
    };
}
/** Private trusted proof. The main leaf first validates ownership, all parents, global graph and actual source bindings. */
export declare function proveQualifiedTranslatedStripMaterialTrusted(base: TranslatedSurfaceBaseFaceResult, ends: TranslatedSurfaceEndFacesResult, volume: TranslatedSurfaceStripVolumeResult, bindings: QualifiedTranslatedStripMaterialBindings, q: SectionRationalContext): QualifiedTranslatedStripMaterialProof;
export {};
