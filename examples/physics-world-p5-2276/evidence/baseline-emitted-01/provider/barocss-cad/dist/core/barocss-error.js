export class BarocssError extends Error {
    code;
    where;
    /** What else the refusal carries: the core's own words, the feature it named. */
    details;
    constructor(code, message, where, details) {
        // (A core message that already carries its code, `n3: [TANGENT_FACES] edge …`, keeps its words once: the prefix is the code's place.)
        super(`[${code}] ${message.replace(`[${code}] `, '')}`);
        this.name = 'BarocssError';
        this.code = code;
        if (where)
            this.where = where;
        if (details)
            this.details = details;
    }
}
/**
 * The base of the kernel's own error classes (R7.3a, batch 1): a BarocssError with Error's constructor, so each class
 * keeps its name, its code and its message as written before (the fingerprint records them byte for byte). Each
 * class sets its `code` (and `name`), or passes it here with its details (the classes that had none take one named for the class); one
 * that sets no name stays an `Error` by name, as before. Batch 2 folds the classes into codes.
 */
export class KernelError extends BarocssError {
    constructor(message, options) {
        super(options?.code ?? '', '', undefined, options?.details);
        this.name = 'Error';
        this.message = message ?? '';
        // (No own `where`, nor `details` while unset: the class's own keys stay as they were.)
        Reflect.deleteProperty(this, 'where');
        if (!options?.details)
            Reflect.deleteProperty(this, 'details');
        if (options && 'cause' in options)
            Object.defineProperty(this, 'cause', { value: options.cause, writable: true, configurable: true, enumerable: false });
    }
}
/**
 * A refusal of one kernel module (R7.3a batch 2: the per-module classes folded, D279): a BarocssError by name, its code,
 * its message as the module writes it, and `details.source` naming the module, which `isFrom` tells apart where codes
 * of two modules share a name.
 */
export function kernelRefusal(source, code, message, cause) {
    const e = new KernelError(message, cause === undefined ? { code, details: { source } } : { code, details: { source }, cause });
    e.name = 'BarocssError';
    return e;
}
/** Whether something thrown is a refusal of the module named `source` (with its codes typed as `C`). */
export const isFrom = (e, source) => e instanceof KernelError && e.details?.source === source;
