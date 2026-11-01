import type { HomogeneousBernsteinEquation, HomogeneousBernsteinRoot } from './own-homogeneous-bernstein-roots.js';
import { KernelError } from '../core/barocss-error.js';
export interface CubicBernsteinRootEvidence {
    originalCoefficients: [number, number, number, number];
    normalizedCoefficients: [number, number, number, number];
    normalizationScale: number;
    maximumOriginalMagnitude: number;
    derivativeCoefficients: [number, number, number];
    derivativeEquation: HomogeneousBernsteinEquation;
    derivativeRoots: HomogeneousBernsteinRoot[];
    derivativeSearchStatus: 'not-required-coincident' | 'not-required-strict-cubic-sign-exclusion' | 'executed';
    controlHullExclusion: {
        sign: 'positive' | 'negative';
        minimumMagnitude: number;
        arithmeticGuard: number;
        policy: 'strict-normalized-cubic-bernstein-control-hull-beyond64-epsilon-guard';
    } | null;
    criticalBrackets: {
        derivativeRootIndex: number;
        bracket: [number, number];
        center: number;
        centerValue: number;
        leftValue: number;
        rightValue: number;
        lipschitzBound: number;
        lipschitzMargin: number;
        arithmeticGuard: number;
        totalMargin: number;
        sign: -1 | 1;
    }[];
    monotoneIntervals: {
        domain: [number, number];
        leftValue: number;
        rightValue: number;
        status: 'support-disjoint' | 'endpoint-only' | 'crossing';
        rootIndex: number | null;
        iterations: number;
        nearZeroQuarterSteps: number;
    }[];
    roots: HomogeneousBernsteinRoot[];
    scalarEvaluations: {
        parameter: number;
        value: number;
        arithmeticGuard: number;
    }[];
    scalarEvaluationCount: number;
    derivativeRootSteps: number[];
    cubicRootSteps: number[];
    coincident: boolean;
    parameterWidthTarget: number;
    arithmeticGuard: number;
}
export declare class CubicBernsteinRootError extends KernelError {
    readonly code: 'INPUT' | 'REPRESENTABILITY' | 'BUDGET';
    constructor(code: CubicBernsteinRootError['code'], detail: string, cause?: unknown);
}
/** Own cubic scalar isolation; the actual existing quadratic solver supplies derivative brackets. */
export declare function solveCubicBernsteinRoots(originalInput: number[], parameterWidthTarget: number): {
    roots: HomogeneousBernsteinRoot[];
    evidence: CubicBernsteinRootEvidence;
};
