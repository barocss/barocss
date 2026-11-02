import { SectionRationalContext } from '../../section-rational-internal.js';
import type { SectionRational, SectionFraction } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
type Q = SectionRational;
type V = [Q, Q, Q];
export interface SplitAffineFrame {
    origin: V;
    u: V;
    v: V;
    normal: V;
    domainU: [Q, Q];
    domainV: [Q, Q];
    scaleU: Q;
    scaleV: Q;
}
export interface SplitChildBindingProof {
    used: true;
    regularityCertified: true;
    projection: 'original-u-v-dot-products';
    jacobianDegree: readonly [2, 2];
    jacobianBernstein: SectionFraction[];
    minimumJacobianBernstein: SectionFraction;
    projectedCornerTurns: SectionFraction[];
    coefficientPositionBound: SectionFraction;
    maximumWorldPositionBound: number;
    wholeModel: 'positive-weight-rational-bilinear';
    globalBinary64EvaluatorErrorCertified: false;
}
export declare function splitRational(): SectionRationalContext;
export declare function splitAffineFrame(surface: Surface, q: SectionRationalContext): SplitAffineFrame;
/** A fixed rational-bilinear proof. It does not replace or normalize native child geometry. */
export declare function splitChildBinding(child: Surface, frame: SplitAffineFrame, q: SectionRationalContext): {
    proof: SplitChildBindingProof;
    bound: Q;
};
export {};
