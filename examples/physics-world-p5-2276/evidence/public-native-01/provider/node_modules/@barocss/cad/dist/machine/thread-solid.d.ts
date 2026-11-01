import type { Brep } from '../brep/brep-core.js';
export interface ThreadSolidRequest {
    readonly id?: string;
    /** Nominal (major) diameter and pitch, mm. */
    readonly diameter: number;
    readonly pitch: number;
    /** The axis (parallel to Z) through [x, y]; `seat` the Z where a head or nut stands (default 0). */
    readonly center?: readonly [number, number];
    readonly seat?: number;
    /** A rod or a bolt's shank: its length below the seat. */
    readonly length?: number;
    /** A hex head above the seat (bolt), or a hex nut above the seat with the thread through it (internal). */
    readonly hex?: {
        readonly across: number;
        readonly height: number;
        readonly internal?: boolean;
    };
    /**
     * The profile pushed out by this many mm (radially, every phase): the clearance a nut or a tapped hole leaves
     * on a bolt's thread. Default 0.04 for a nut, 0 for a rod or bolt.
     */
    readonly clearance?: number;
    /** Steps round a turn (a multiple of 12, default 48) and along a pitch (default 12). */
    readonly around?: number;
    readonly along?: number;
    /**
     * How the thread is built: `helical` (the default) as half-turn B-spline faces between helices, named
     * `${id}.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`, `.top`, `.bottom`; or `faceted`, one closed mesh of
     * flat facets named `${id}.facet${k}` (the form documents written before 2026-10-18 keep).
     */
    readonly form?: 'faceted' | 'helical';
}
/** The basic profile's radius at a phase along one pitch (0: the middle of a crest). */
export declare function isoThreadRadius(d: number, pitch: number, phase: number): number;
/** The radial clearance a thread's profile is pushed out by (a nut's 0.04 mm by default). */
export declare function clearanceOf(req: ThreadSolidRequest, nut: boolean): number;
export declare function threadSolid(req: ThreadSolidRequest): Brep;
