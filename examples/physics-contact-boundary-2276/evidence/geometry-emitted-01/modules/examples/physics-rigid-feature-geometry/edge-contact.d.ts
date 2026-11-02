import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { SATFeatureSelection } from './sat-feature.js';
import type { ContactGeometry } from './contact-types.js';
/** Enumerate four boundary minima plus the unconstrained interior stationary point. */
export declare function closestSegments(p: Vec3, p1: Vec3, q: Vec3, q1: Vec3): {
    a: Vec3;
    b: Vec3;
    parameterA: number;
    parameterB: number;
    crossSquared: number;
    distanceSquared: number;
    parallel: boolean;
    boundary: boolean;
};
export declare function edgeContact(a: Body, b: Body, selection: SATFeatureSelection): ContactGeometry;
