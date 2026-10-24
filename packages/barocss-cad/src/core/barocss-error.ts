// R7.3a (api-conventions.md §6): the kernel's one refusal shape — a stable code, the person-readable `[CODE] …`
// message, where it came from, and details. The facades (`@barocss/cad/api`, cad-model's) re-export this class;
// every error class of the kernel is one of these (KernelError below), so `instanceof BarocssError` catches any
// refusal of the package. Validators return `Problem[]` and never throw.
export type RefusalWhere = 'facade' | 'evaluate' | 'export';

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  /** What else the refusal carries: the core's own words, the feature it named. */
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, where?: RefusalWhere, details?: Record<string, unknown>) {
    // (A core message that already carries its code, `n3: [TANGENT_FACES] edge …`, keeps its words once: the prefix is the code's place.)
    super(`[${code}] ${message.replace(`[${code}] `, '')}`);
    this.name = 'BarocssError'; this.code = code;
    if (where) this.where = where;
    if (details) this.details = details;
  }
}

/** A validator's finding: its code, the "[CODE] …" sentence, and where in the input (a field or a path), when it says. */
export interface Problem { readonly code: string; readonly message: string; readonly where?: string }

/**
 * The base of the kernel's own error classes (R7.3a, batch 1): a BarocssError with Error's constructor, so each class
 * keeps its name, its code and its message as written before (the fingerprint records them byte for byte). Each
 * class sets its `code` (and `name`), or passes it here (the classes that had none take one named for the class); one
 * that sets no name stays an `Error` by name, as before. Batch 2 folds the classes into codes.
 */
export class KernelError extends BarocssError {
  constructor(message?: string, options?: { readonly cause?: unknown; readonly code?: string }) {
    super(options?.code ?? '', '');
    this.name = 'Error'; this.message = message ?? '';
    // (No own `where` or `details` while unset: the class's own keys stay as they were.)
    Reflect.deleteProperty(this, 'where'); Reflect.deleteProperty(this, 'details');
    if (options && 'cause' in options) Object.defineProperty(this, 'cause', { value: options.cause, writable: true, configurable: true, enumerable: false });
  }
}
