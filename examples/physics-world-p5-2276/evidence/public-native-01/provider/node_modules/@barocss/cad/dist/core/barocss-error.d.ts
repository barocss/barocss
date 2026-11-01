export type RefusalWhere = 'facade' | 'evaluate' | 'export';
export declare class BarocssError extends Error {
    readonly code: string;
    readonly where?: string;
    /** What else the refusal carries: the core's own words, the feature it named. */
    readonly details?: Record<string, unknown>;
    constructor(code: string, message: string, where?: RefusalWhere, details?: Record<string, unknown>);
}
/** A validator's finding: its code, the "[CODE] …" sentence, and where in the input (a field or a path), when it says. */
export interface Problem {
    readonly code: string;
    readonly message: string;
    readonly where?: string;
}
/**
 * The base of the kernel's own error classes (R7.3a, batch 1): a BarocssError with Error's constructor, so each class
 * keeps its name, its code and its message as written before (the fingerprint records them byte for byte). Each
 * class sets its `code` (and `name`), or passes it here with its details (the classes that had none take one named for the class); one
 * that sets no name stays an `Error` by name, as before. Batch 2 folds the classes into codes.
 */
export declare class KernelError extends BarocssError {
    constructor(message?: string, options?: {
        readonly cause?: unknown;
        readonly code?: string;
        readonly details?: Record<string, unknown>;
    });
}
/**
 * A refusal of one kernel module (R7.3a batch 2: the per-module classes folded, D279): a BarocssError by name, its code,
 * its message as the module writes it, and `details.source` naming the module, which `isFrom` tells apart where codes
 * of two modules share a name.
 */
export declare function kernelRefusal(source: string, code: string, message: string, cause?: unknown): KernelError;
/** Whether something thrown is a refusal of the module named `source` (with its codes typed as `C`). */
export declare const isFrom: <C extends string>(e: unknown, source: string) => e is KernelError & {
    readonly code: C;
};
