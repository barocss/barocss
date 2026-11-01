import type { OwnPlaneCylinderCandidate } from './own-plane-cylinder-intersection-internal.js';
import type { XYCirclePrismShellBundle } from '../xy-circle-prism-shell.js';
import type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderHomogeneousSpan, PlaneCylinderIntersectionObservation, PlaneCylinderCurveD1State, PlaneCylinderSurfaceD1State } from './own-plane-cylinder-intersection.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface FinitePlaneCylinderEquation {
    quarter: number;
    bernstein: number[];
    power: number[];
    degree: 'quadratic' | 'linear' | 'constant' | 'zero';
    discriminant: number | null;
    uncertainty: number;
    exclusionPolicy?: 'strict-Bernstein-sign-control-hull-exclusion';
}
export interface FinitePlaneCylinderBoundaryEvent {
    eventId: string;
    parameter: number;
    boundary: 'bottom' | 'top';
    levelMM: number;
    kind: 'crossing' | 'touch';
    quarters: number[];
    bracket: [number, number];
    iterations: number;
    residualMM: number;
    pointMM: Point;
    planeUV: Point;
    wallUV: Point;
    nativeDomainAdmitted: boolean;
    seamRepresentation: 'start' | 'end' | null;
    equations: FinitePlaneCylinderEquation[];
}
export interface FinitePlaneCylinderEndpointApproximation {
    side: 'lower' | 'upper';
    eventId: string;
    rootParameter: number;
    rootBracket: [number, number];
    usedParameter: number;
    parameterOffset: number;
    boundaryResidualMM: number;
    semantics: 'inward-represented-bracket-endpoint-not-exact-cap-topology';
}
export interface FinitePlaneCylinderPiece {
    pieceId: string;
    domain: [number, number];
    curve: Curve;
    bindings: XYCirclePrismPlaneBindings;
    source: string;
    sourceVersion: 0;
    model: Model;
    endpointApproximations: [FinitePlaneCylinderEndpointApproximation | null, FinitePlaneCylinderEndpointApproximation | null];
    observations: PlaneCylinderIntersectionObservation[];
}
export interface FinitePlaneCylinderOriginalDerivativeGuard {
    parameter: number;
    section: PlaneCylinderCurveD1State;
    planePcurve: PlaneCylinderCurveD1State;
    wallPcurve: PlaneCylinderCurveD1State;
    wallSurface: PlaneCylinderSurfaceD1State;
}
export interface FiniteXYCirclePrismPlaneIntersectionReport {
    family: 'own-finite-axial-plane-circle-cylinder';
    kind: FiniteXYCirclePrismPlaneIntersectionResult['kind'];
    evaluationId: string;
    originalDomain: [number, number];
    axialWallDomainMM: [number, number];
    pieceCount: number;
    eventCount: number;
    equations: FinitePlaneCylinderEquation[];
    coincidentBoundary: 'bottom' | 'top' | null;
    intervalClassifications: {
        domain: [number, number];
        sampleParameter: number;
        observedZMM: number;
        inside: boolean;
    }[];
    isolatedEventIds: string[];
    originalGuardedParameters: [1, 2, 3];
    originalDerivativeGuards: FinitePlaneCylinderOriginalDerivativeGuard[];
    numericPolicy: {
        method: 'homogeneous-Bernstein-quadratic-stable-power-roots-with-brackets';
        maximumRefinementSteps: 64;
        parameterWidthTarget: 1e-12;
        discriminantPolicy: '32-epsilon-scaled-ambiguity-refuses';
        rootExclusionPolicy: 'strict-Bernstein-sign-control-hull-exclusion';
        residualComparisonMM: 1e-7;
        exactParameterDedupOnly: true;
    };
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumPieces: 24;
        maximumEvents: 24;
        pieceModelObjects: 3;
        temporaryCurvePoles: 16;
    };
}
export interface FiniteXYCirclePrismPlaneIntersectionResult {
    kind: 'curve-segments' | 'disjoint' | 'isolated-touch' | 'coincident-boundary';
    shell: XYCirclePrismShellBundle;
    options: XYCirclePrismPlaneIntersectionOptions;
    plane: Surface;
    wallSurface: Surface;
    derivedSupport: {
        section: Curve;
        bindings: XYCirclePrismPlaneBindings;
        homogeneousSpans: PlaneCylinderHomogeneousSpan[];
        axialControlHullMM: [number, number];
        planeSupportMM: OwnPlaneCylinderCandidate['planeSupportMM'];
        semantics: 'derived-infinite-support-not-finite-intersection';
    };
    supportSource: {
        source: string;
        sourceVersion: 0;
        model: Model;
        semantics: 'geometry-only-plane-and-wall-not-contact-curve';
    };
    events: FinitePlaneCylinderBoundaryEvent[];
    pieces: FinitePlaneCylinderPiece[];
    report: FiniteXYCirclePrismPlaneIntersectionReport;
}
/** Bounded own homogeneous clipping; derived support is never a full-wall proof. */
export declare function intersectFiniteXYCirclePrismWallWithPlane(shell: XYCirclePrismShellBundle, options: XYCirclePrismPlaneIntersectionOptions): FiniteXYCirclePrismPlaneIntersectionResult;
/** Nullable result metadata is admitted separately; old637 snapshot semantics stay strict. */
export declare function validateFiniteXYCirclePrismPlaneIntersection(input: FiniteXYCirclePrismPlaneIntersectionResult): FiniteXYCirclePrismPlaneIntersectionReport;
