import type { LinearProblem } from './types.js';
export declare const ERRORS: {
    readonly pose: "hinge pose state is invalid";
    readonly result: "hinge projection result is invalid";
    readonly linear: "hinge velocity problem is invalid";
    readonly system: "hinge velocity system is singular or unsafe";
    readonly certificate: "hinge velocity certificate is invalid";
};
export declare const GATE = 1e-10;
export declare function fail(kind: 'pose' | 'linear' | 'system' | 'certificate' | 'result'): never;
export declare function exactFields(value: unknown, keys: readonly string[]): value is Record<string, unknown>;
export declare function dense(value: unknown, size: number): value is number[];
export declare function matrix(value: unknown, rows: number, columns: number): value is number[][];
export declare function finiteData(value: unknown): boolean;
export declare function readProblem(value: unknown): LinearProblem;
