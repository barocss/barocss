import type { Surface } from '../types.js';
import { type PreviewPacket } from './packet.js';
export interface TessellationOptions {
    countU: number;
    countV: number;
    revision: number;
}
export interface ApproximationReport {
    grid: {
        countU: number;
        countV: number;
    };
    vertexCount: number;
    triangleCount: number;
    cellCount: number;
    probeCount: number;
    domain: {
        u: [number, number];
        v: [number, number];
    };
    normalMethod: 'area-weighted-incident-triangle';
    maxSampledDeviation: number;
    certified: false;
}
/** Uniform bounded preview mesh. The report is finite-sample evidence, not a bound. */
export declare function tessellateSurface(surface: Surface, options: TessellationOptions): {
    packet: PreviewPacket;
    report: ApproximationReport;
};
