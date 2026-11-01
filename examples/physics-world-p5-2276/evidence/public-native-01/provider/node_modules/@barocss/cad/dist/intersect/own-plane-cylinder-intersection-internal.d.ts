import type { XYCirclePrismShellBundle } from '../xy-circle-prism-shell.js';
import type { Curve, Surface, Model } from '../types.js';
import type { XYCirclePrismPlaneIntersectionOptions, XYCirclePrismPlaneBindings, PlaneCylinderHomogeneousSpan, PlaneCylinderIntersectionObservation } from './own-plane-cylinder-intersection.js';
import { same } from '../core/structural-equality.js';
export interface OwnPlaneCylinderCandidate {
    shell: XYCirclePrismShellBundle;
    options: XYCirclePrismPlaneIntersectionOptions;
    sourceCircle: Curve;
    section: Curve;
    plane: Surface;
    wallSurface: Surface;
    axialControlHullMM: [number, number];
    planeSupportMM: {
        minXY: [number, number];
        maxXY: [number, number];
        representedSpansMM: [number, number];
    };
}
export declare function check(condition: boolean, detail: string): asserts condition;
export declare function snapshot(input: unknown): unknown;
export { same };
export declare function adopt(model: Model): {
    source: string;
    model: Model;
};
export declare function observe(curve: Curve, plane: Surface, wall: Surface, bindings: XYCirclePrismPlaneBindings): PlaneCylinderIntersectionObservation[];
/** Unrestricted derived support section, not admitted finite-wall intersection. */
export declare function constructPlaneCylinderCandidate(input: XYCirclePrismShellBundle, inputOptions: XYCirclePrismPlaneIntersectionOptions): OwnPlaneCylinderCandidate;
export declare function constructPlaneCylinderBindings(candidate: OwnPlaneCylinderCandidate): {
    bindings: XYCirclePrismPlaneBindings;
    homogeneousSpans: PlaneCylinderHomogeneousSpan[];
};
