// gpu's refusals in the conventions' one shape (api-conventions.md §6, R7.3a): a BarocssError with a stable `code`, the
// person-readable `message`, and optionally `where` and `details`. gpu imports neither cad nor cad-model, so this is its
// own class of the same name and shape; each of gpu's error classes is one of these, `instanceof BarocssError` catching
// any refusal of the package. Validators return `Problem[]` and never throw.

export interface Problem { code: string; message: string; where?: string }

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, options?: { where?: string; details?: Record<string, unknown>; cause?: unknown }) {
    super(message, options && 'cause' in options && options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'BarocssError'; this.code = code;
    if (options?.where) this.where = options.where;
    if (options?.details) this.details = options.details;
  }
}
