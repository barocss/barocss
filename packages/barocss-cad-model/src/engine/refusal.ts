// R7.3a (api-conventions.md §6): cad-model's refusals in one shape — @barocss/cad/api's BarocssError, thrown by operations,
// its message the person-readable "[CODE] …" text the agent and the docs' refusal table read; and validators' Problems,
// returned, never thrown. The codes are one union (CadModelCode), so the table can be made from the type.
import { BarocssError } from '@barocss/cad/api';

export { BarocssError };

/** Every code cad-model refuses with, as it is written in the message's brackets. */
export type CadModelCode =
  // robot
  | 'NO_LINK' | 'NO_JOINTS' | 'NO_FRAME' | 'NOT_PLANAR' | 'NOT_ONE_LOOP' | 'NO_CLOSURE' | 'BRANCH_FLIP' | 'NO_PIN' | 'NO_RANGE' | 'BAD_VALUES'
  // print
  | 'NOT_NEEDED' | 'ONE_BODY' | 'NO_PRINTER' | 'DIRECTION_NOT_AXIS' | 'TOO_BIG_TWO_WAYS' | 'NO_ROOM' | 'BAD_CONNECTOR'
  | 'NOT_HOLLOW' | 'GRID_TOO_FINE' | 'NO_LATTICE' | 'UNDRAINED'
  | 'CURVED_BODY' | 'NOTHING_TO_HOLLOW' | 'DRAIN_NO_ROOM' | 'BOOLEAN_REFUSED'
  // team
  | 'NO_CHANGE' | 'STALE_ECR' | 'NO_ECR' | 'DECIDED' | 'APPROVAL_IS_THE_USERS'
  | 'BAD_TRANSITION' | 'BASELINE_FROZEN' | 'STALE_BASELINE' | 'STALE_RESULT' | 'RESULT_NOT_OK' | 'NO_BASELINE' | 'BOM_INVALID'
  // chat
  | 'NO_DRAFT' | 'BAD_VALUE' | 'BOUND' | 'GONE'
  | 'REFERENCE_LOCKED' | 'BAD_REFERENCE' | 'NO_REFERENCE' | 'DATUM_FIT' | 'BAD_KEEPOUT' | 'NOT_READ'
  | 'SYNTAX' | 'UNKNOWN_NAME' | 'TYPE' | 'LIMIT' | 'REFUSED'
  // sketch
  | 'DXF_MALFORMED' | 'DXF_UNSUPPORTED' | 'DXF_OPEN' | 'DXF_NESTED' | 'DXF_EMPTY' | 'DWG_NOT_READ';

/** A validator's finding: its code, the "[CODE] …" sentence, and where in the input (a field or a path), when it says. */
export interface Problem { code: CadModelCode; message: string; where?: string }

/** A refusal to throw: its message "[CODE] message" — the text written before R7.3a, byte for byte. */
export const refusal = (code: CadModelCode, message: string, details?: Record<string, unknown>): BarocssError => new BarocssError(code, message, undefined, details);

/** A validator's problem, its message "[CODE] message". */
export const problem = (code: CadModelCode, message: string, where?: string): Problem => ({ code, message: `[${code}] ${message}`, ...(where !== undefined ? { where } : {}) });

/** Whether something thrown is one of cad-model's refusals (with this code, when given). */
export const isRefusal = (e: unknown, ...codes: CadModelCode[]): e is BarocssError & { code: CadModelCode } =>
  e instanceof BarocssError && (!codes.length || (codes as string[]).includes(e.code));

/** The first problem's message, or null: for a caller that refuses with the first. */
export const firstProblem = (problems: readonly Problem[]): string | null => problems[0]?.message ?? null;
