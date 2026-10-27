// gpu's refusals in the conventions' one shape (api-conventions.md §6, R7.3a): a BarocssError with a stable upper-snake
// `code`, the person-readable `message` written `[CODE] …`, and optionally `where` and `details`. gpu imports neither cad
// nor cad-model, so this is its own class of the same name and shape; each of gpu's error classes is one of these,
// `instanceof BarocssError` catching any refusal of the package. Validators return `Problem[]` and never throw.

export interface Problem { code: string; message: string; where?: string }

export interface BarocssErrorOptions {
  where?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
  /** The whole message's length at most, its `[CODE] ` included (the classes that cap their refusals at 1024). */
  maxLength?: number;
}

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, options?: BarocssErrorOptions) {
    // (A cause given as undefined is kept as one: some classes record a thrown undefined; leave the key out for none.)
    // (A message that already carries its code keeps its words once, as cad's facade writes it: the prefix is the code's place.)
    const text = `[${code}] ${message.replace(`[${code}] `, '')}`;
    super(options?.maxLength === undefined ? text : text.slice(0, options.maxLength),
      options && 'cause' in options ? { cause: options.cause } : undefined);
    this.name = 'BarocssError'; this.code = code;
    if (options?.where) this.where = options.where;
    if (options?.details) this.details = options.details;
  }
}

/** A refusal's words without its own `[CODE] `: for a diagnostic that carries the code as its own field, or for another
 *  refusal that quotes it under its own code. */
export function refusalText(error: Error): string {
  const code = error instanceof BarocssError ? error.code : undefined;
  return code !== undefined && error.message.startsWith(`[${code}] `) ? error.message.slice(code.length + 3) : error.message;
}
