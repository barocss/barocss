// The document's brief schema (R4 D4: the types engine/doc.ts stores, out of chat/brief.ts unchanged).

export const BRIEF_VERSION = 1;
/** The processes a brief may name: those with rules (R6b.7; machining since CNC1, O84), and sheet metal recorded as intent. */
export const PROCESSES = ['fdm', 'sla', 'sls', 'mjf', 'injection', 'cnc-milling', 'cnc-turning', 'die-casting', 'sand-casting', 'sheet-metal'] as const;
export const BRIEF_FIELDS = ['purpose', 'process', 'material', 'quantity', 'envelope', 'interfaces', 'loads', 'finish', 'notes'] as const;

export type Process = (typeof PROCESSES)[number];
export type Basis = 'stated' | 'assumed' | 'ambiguous';
export interface Field<T> {
  value: T; basis: Basis;
  /** The user's words it comes from, quoted (required when stated by the agent). */
  source?: string;
  /** Why it was assumed, or how it can be read (assumed, ambiguous). */
  why?: string;
  /** Set by the studio when the user confirms it: stated since. */
  confirmed?: { by: 'user'; at: string };
  /** A stated field's quote checked against what the user typed this conversation (verified), or with no conversation
   * to check it against (unverified: cad-cli, cad-mcp --doc, a plain script). */
  said?: 'verified' | 'unverified';
}
export interface Envelope { x: number; y: number; z: number }
export interface Brief {
  version: typeof BRIEF_VERSION;
  purpose?: Field<string>; process?: Field<Process>; material?: Field<string>;
  quantity?: Field<number>; envelope?: Field<Envelope>; interfaces?: Field<string[]>;
  loads?: Field<string>; finish?: Field<string>; notes?: Field<string>;
}
export type BriefKey = (typeof BRIEF_FIELDS)[number];
export interface Gap { field: BriefKey; why: 'missing' | 'assumed' | 'ambiguous'; value?: unknown; ask: string }
export type BriefCode = 'BAD_FIELD' | 'STATED_KEPT' | 'NO_SOURCE' | 'SOURCE_NOT_SAID' | 'CONFIRM_IS_THE_USERS';
export interface BriefError { code: BriefCode; message: string }
