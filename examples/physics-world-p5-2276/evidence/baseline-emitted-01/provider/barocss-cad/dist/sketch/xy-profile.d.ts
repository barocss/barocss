import type { Curve, Model } from '../types.js';
export type XYPoint = [number, number];
export type XYProfileRequest = {
    kind: 'line';
    id: string;
    points: [XYPoint, XYPoint];
} | {
    kind: 'polyline';
    id: string;
    points: XYPoint[];
} | {
    kind: 'rectangle';
    id: string;
    origin: XYPoint;
    width: number;
    height: number;
};
export interface XYProfileReport {
    kind: XYProfileRequest['kind'];
    plane: 'xy';
    lengthUnit: 'mm';
    vertexCount: number;
    segmentCount: number;
    parameterDomain: {
        min: number;
        max: number;
    };
    endpointClosed: boolean;
    regionCertified: false;
    solid: false;
}
export interface XYProfileResult {
    source: string;
    sourceVersion: 0;
    model: Model;
    curve: Curve;
    report: XYProfileReport;
}
/** Bounded XY curves through actual source0 compilation; no region/solid proof. */
export declare function buildXYProfile(request: XYProfileRequest): XYProfileResult;
