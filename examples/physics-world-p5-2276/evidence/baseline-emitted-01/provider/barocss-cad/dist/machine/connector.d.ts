import type { Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type ConnectorCode = 'INVALID_INPUT' | 'CONNECTOR_PLACEMENT' | 'CONNECTOR_FIT';
/** This module's refusal (R7.3a batch 2: the ConnectorError class folded, D279): a BarocssError, `details.source` 'connector'. */
export declare const connectorError: (code: ConnectorCode, detail: string) => KernelError & {
    readonly code: ConnectorCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isConnectorError: (e: unknown) => e is KernelError & {
    readonly code: ConnectorCode;
};
export interface ConnectorSection {
    readonly shape: 'stadium' | 'rect' | 'round';
    readonly width: number;
    readonly height: number;
    readonly cornerRadius?: number;
}
export interface ConnectorRow {
    readonly id: string;
    readonly name?: string;
    /** The opening: its section and how deep it is cut into the face. */
    readonly opening: ConnectorSection & {
        readonly depth: number;
    };
    /** The mating body (a plug's envelope): its section and its length from the opening's bottom. */
    readonly body?: ConnectorSection & {
        readonly length: number;
    };
    /** The space in front of the opening the plug and its cable need: grown by a margin round the body (or the opening), this deep. */
    readonly keepOut?: {
        readonly margin: number;
        readonly depth: number;
    };
    readonly source?: string;
    readonly estimate?: boolean;
}
/** Why a connector row is not one, or null. */
export declare function connectorRowProblem(r: unknown): string | null;
/** A section's area in closed form: a stadium (w − h)h + πh²/4, a rounded rectangle wh − (4 − π)r², a circle πw²/4. */
export declare function connectorSectionArea(s: ConnectorSection): number;
/** The opening's frame on a face of outward normal n at `origin`: x the face's width direction turned `rotation` about n. */
export declare function connectorFrame(origin: readonly number[], normal: readonly number[], rotation?: number): {
    readonly origin: Point;
    readonly x: Point;
    readonly y: Point;
    readonly z: Point;
};
/**
 * The keep-out in front of an opening (A6.3's form: a box from its frame's origin along x, normal × x and normal): the
 * body's section (or the opening's) grown by the row's margin, the row's depth out from the seated body's front (or the
 * face, with no body); none without a keepOut.
 */
export declare function connectorKeepOut(row: ConnectorRow, center: readonly number[], normal: readonly number[], rotation?: number): ConnectorReport['keepOut'];
export interface ConnectorReport {
    readonly generator: 'connector@0';
    readonly row: string;
    readonly name?: string;
    readonly estimate: boolean;
    readonly source?: string;
    readonly opening: ConnectorSection & {
        readonly depth: number;
        readonly area: number;
    };
    readonly frame: {
        readonly origin: Point;
        readonly x: Point;
        readonly y: Point;
        readonly z: Point;
    };
    /** The body seated in the opening: its gaps across (each side), how far it stands out of the face, its overlap with the panel. */
    readonly body?: ConnectorSection & {
        readonly length: number;
        readonly area: number;
        readonly gapWidth: number;
        readonly gapHeight: number;
        readonly standsOut: number;
        readonly overlap?: number;
    };
    /** In A6.3's form: a box from its frame's origin along x, normal × x and normal. */
    readonly keepOut?: {
        readonly frame: {
            readonly origin: Point;
            readonly normal: Point;
            readonly xAxis: Point;
        };
        readonly size: readonly [number, number, number];
        readonly clearance: 0;
    };
    readonly envelopeOnly: true;
}
export interface ConnectorSpec {
    readonly row: ConnectorRow;
    readonly face: string;
    readonly center: readonly number[];
    readonly rotation?: number;
}
/** The opening cut into `target` at its flat face, centred at `center`, and the report (with the keep-out). */
export declare function connectorOpening(target: Brep, spec: ConnectorSpec, id: string): {
    readonly brep: Brep;
    readonly report: ConnectorReport;
};
/** The body's envelope seated in its opening (from the opening's bottom, `length` out along its axis), and its overlap with the panel (the declared fit). */
export declare function connectorBody(panel: Brep, report: ConnectorReport, id: string): {
    readonly brep: Brep;
    readonly overlap: number;
};
