import type { Curve, Model } from './types.js';
import type { XYPoint } from './sketch/xy-profile.js';
export type XYArcRequest = {
    kind: 'quarter-arc';
    id: string;
    center: XYPoint;
    radius: number;
    quadrant: 0 | 1 | 2 | 3;
} | {
    kind: 'circle';
    id: string;
    center: XYPoint;
    radius: number;
};
export interface XYArcReport {
    kind: XYArcRequest['kind'];
    plane: 'xy';
    lengthUnit: 'mm';
    centerMM: XYPoint;
    radiusMM: number;
    startQuadrant: 0 | 1 | 2 | 3;
    spanCount: number;
    controlPointCount: number;
    parameterDomain: {
        min: number;
        max: number;
    };
    endpointClosed: boolean;
    periodic: false;
    regionCertified: false;
    solid: false;
}
export interface XYArcResult {
    source: string;
    sourceVersion: 0;
    model: Model;
    curve: Curve;
    report: XYArcReport;
}
/** Original rational quadratic coefficients, actual source0, no topology proof. */
export declare function buildXYArc(request: XYArcRequest): XYArcResult;
