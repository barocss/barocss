// CG6 (DA-1): the version model's refusals — one union, part of engine/refusal.ts's CadModelCode — and the "[CODE] …"
// builder over it (the refusal table reads calls named `refusal`).
import { BarocssError } from '@barocss/cad/api';

export type VersionCode =
  | 'VERSION_INPUT' | 'VERSION_UNKNOWN' | 'VERSION_NAME' | 'VERSION_NO_CHANGE' | 'VERSION_KEY_COLLISION' | 'VERSION_LOG' | 'VERSION_NOT_LOADED'
  | 'BRANCH_UNKNOWN' | 'BRANCH_NAME' | 'BRANCH_EXISTS' | 'BRANCH_UNSAVED'
  | 'MERGE_SAME' | 'MERGE_UP_TO_DATE' | 'MERGE_NO_BASE' | 'MERGE_ORDER'
  // merge conflicts (returned as data, not thrown)
  | 'FEATURE_EDITED_BOTH' | 'FEATURE_DELETED_EDITED' | 'MERGE_DANGLING' | 'PARAMETER_BOTH' | 'ITEM_EDITED_BOTH' | 'ITEM_DELETED_EDITED'
  | 'ID_CLASH' | 'FIELD_BOTH';

/** A refusal to throw: "[CODE] message". */
export const refusal = (code: VersionCode, message: string, details?: Record<string, unknown>): BarocssError => new BarocssError(code, `[${code}] ${message}`, undefined, details);

/** A validator's finding (engine/refusal.ts's Problem, over these codes). */
export interface VersionProblem { code: VersionCode; message: string; where?: string }
export const problem = (code: VersionCode, message: string, where?: string): VersionProblem => ({ code, message: `[${code}] ${message}`, ...(where !== undefined ? { where } : {}) });
