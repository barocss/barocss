export interface HomogeneousBernsteinEquation {
    bernstein: number[];
    power: number[];
    degree: 'quadratic' | 'linear' | 'constant' | 'zero';
    discriminant: number | null;
    uncertainty: number;
    exclusionPolicy?: 'strict-Bernstein-sign-control-hull-exclusion';
}
export interface HomogeneousBernsteinRoot {
    t: number;
    bracket: [number, number];
    iterations: number;
    touch: boolean;
}
export interface HomogeneousBernsteinRootOptions {
    parameterWidthTarget?: number;
    label?: string;
}
/** Original homogeneous coefficients, without changing native Curve coefficients. */
export declare function createHomogeneousBernsteinEquation(values: number[], label?: string): HomogeneousBernsteinEquation;
/** Bounded normalized-span roots; callers retain original-domain mapping evidence. */
export declare function solveHomogeneousBernsteinEquation(e: HomogeneousBernsteinEquation, options?: HomogeneousBernsteinRootOptions): HomogeneousBernsteinRoot[];
