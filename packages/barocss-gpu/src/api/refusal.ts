// R7 (gpu's facade): a refusal as one typed error, in the conventions' shape (api-conventions.md §6) — the same shape as
// cad's and cad-model's facades. gpu imports neither of them, so this is its own class of that shape.
// (R7.3 settles the one home of BarocssError for all three packages.)
export type RefusalWhere = 'facade' | 'show';

/** gpu's facade's own codes. */
export type SceneCode = 'MESH_INVALID' | 'LIGHT_INVALID';

export class BarocssError extends Error {
  readonly code: string;
  readonly where?: string;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, where?: RefusalWhere, details?: Record<string, unknown>) {
    super(`[${code}] ${message.replace(`[${code}] `, '')}`);
    this.name = 'BarocssError'; this.code = code;
    if (where) this.where = where;
    if (details) this.details = details;
  }
}

export const refuse = (code: SceneCode, message: string, where: RefusalWhere = 'facade') => new BarocssError(code, message, where);
