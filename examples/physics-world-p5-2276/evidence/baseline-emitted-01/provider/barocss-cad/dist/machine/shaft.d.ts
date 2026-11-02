import type { Brep } from '../brep/brep-core.js';
import { type KernelError } from '../core/barocss-error.js';
export type ShaftDiagnosticCode = 'INVALID_INPUT' | 'SHAFT_STEPS' | 'KEYSEAT_DIMENSIONS' | 'GROOVE_DIMENSIONS' | 'HOLE_DIMENSIONS';
/** This module's refusal (R7.3a batch 2: the ShaftError class folded, D279): a BarocssError, `details.source` 'shaft'. */
export declare const shaftError: (code: ShaftDiagnosticCode, detail: string) => KernelError & {
    readonly code: ShaftDiagnosticCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isShaftError: (e: unknown) => e is KernelError & {
    readonly code: ShaftDiagnosticCode;
};
export interface ShaftGroove {
    readonly diameter: number;
    readonly width: number;
    readonly at: number;
}
export interface ShaftKeyseat {
    readonly width: number;
    readonly depth: number;
    readonly length: number;
    readonly offset: number;
    readonly ends?: 'square' | 'end-mill' | 'disc';
    readonly cutterRadius?: number;
    readonly angle?: number;
}
export interface ShaftHole {
    readonly diameter: number;
    readonly at: number;
    readonly angle?: number;
}
export interface ShaftStep {
    readonly diameter: number;
    readonly length: number;
    /** The fillet at the shoulder after this step (its radius, in the smaller step's corner). */
    readonly fillet?: number;
    /** A relief in the smaller step against the shoulder after this step. */
    readonly undercut?: {
        readonly width: number;
        readonly depth: number;
    };
    readonly grooves?: readonly ShaftGroove[];
    readonly keyseats?: readonly ShaftKeyseat[];
}
export interface ShaftSpec {
    readonly steps: readonly ShaftStep[];
    /** 45° chamfers at the two ends (their legs, mm). */
    readonly chamfers?: readonly [number, number];
    readonly holes?: readonly ShaftHole[];
}
export interface ShaftKeyseatReport {
    readonly index: number;
    readonly step: number;
    readonly ends: 'square' | 'end-mill' | 'disc';
    readonly width: number;
    readonly depth: number;
    readonly length: number;
    readonly from: number;
    readonly floorRadius: number;
    readonly surfaceLength: number;
    readonly angle: number;
    readonly cutterRadius?: number;
}
export interface ShaftReport {
    readonly generator: 'shaft@0';
    readonly length: number;
    readonly steps: readonly {
        readonly index: number;
        readonly diameter: number;
        readonly from: number;
        readonly to: number;
    }[];
    readonly keyseats: readonly ShaftKeyseatReport[];
    readonly grooves: readonly {
        readonly index: number;
        readonly step: number;
        readonly diameter: number;
        readonly width: number;
        readonly from: number;
    }[];
    readonly holes: readonly {
        readonly index: number;
        readonly diameter: number;
        readonly at: number;
        readonly angle: number;
    }[];
    /** Each shoulder s (between steps s and s + 1): where it stands, the two diameters, its fillet and undercut (R12c.4's seats read them). */
    readonly shoulders: readonly {
        readonly index: number;
        readonly at: number;
        readonly before: number;
        readonly after: number;
        readonly fillet: number;
        readonly undercut?: {
            readonly width: number;
            readonly depth: number;
        };
    }[];
    readonly manufacturingValidated: false;
}
/** A shaft (shaft@0) in its own frame: axis +Z from z 0. */
export declare function shaftSolid(spec: ShaftSpec, options?: {
    readonly id?: string;
}): {
    readonly brep: Brep;
    readonly report: ShaftReport;
};
