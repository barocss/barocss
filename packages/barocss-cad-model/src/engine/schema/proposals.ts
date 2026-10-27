// The document's proposals schema (R4 D4: the types engine/doc.ts stores, out of chat/proposals.ts unchanged).

export interface Op { tool: string; args?: Record<string, unknown>; opId?: string }
/**
 * What a change puts at risk: features it adds, changes, deletes or moves; references it breaks; hard
 * requirements whose outcome or definition it changes. `approval`: why it always needs a person's approval,
 * whatever the autonomy (an assembly, mates, a drawing, a part from a file).
 */
export interface Risk { level: 'low' | 'medium' | 'high'; features_touched: number; references_broken: number; hard_requirements_changed: string[]; approval: string[] }
export interface ChecksDelta { before: Counts; after: Counts; newly_failing: string[]; newly_passing: string[] }
export interface Counts { pass: number; fail: number; unknown: number }
export interface Proposal {
  id: string; title: string; status: 'open' | 'accepted' | 'rejected';
  by: { agent: string; model?: string }; at: string;
  /** The user's message it was made for (capped), the agent's plan, the requirements it serves. */
  prompt?: string; plan?: string; requirements?: string[];
  /** The model it was made on, and the calls that make it. */
  base: string; ops: Op[];
  /** The feature ids in order before each op (O133): what an op's indices name, so a rebase moves them to the part as it is. */
  orders?: string[][];
  risk: Risk; checks?: ChecksDelta;
  /** One line: what it does (features added, changed, deleted; the checks' counts before → after). */
  summary: string;
  decided?: { by: string; at: string; note?: string; model_hash?: string; left_out?: string[] };
  /**
   * Made again on a changed part (D41): the base it was first made on, the one before this rebase, when, and
   * the risk it had first (an agent may accept a rebase only when its risk is no higher and no hard requirement changes).
   */
  rebased?: { original: string; from: string; at: string; risk_was: Risk };
  /** The part of a chat turn not applied (O133): the turn, and each op's typed reason. */
  merge?: { turn: string; conflicts: TurnConflict[] };
}
/** Why an op of a chat turn was not applied over the person's edits made during it (O133). */
export type TurnCode = 'TURN_SAME_NODE' | 'TURN_NODE_GONE' | 'TURN_PARAMETER_CHANGED' | 'TURN_FIELD_CHANGED' | 'TURN_NOT_REPLAYABLE' | 'TURN_BUILDS_ON_DEFERRED' | 'TURN_SHAPE_DIFFERS' | 'TURN_STILL_EDITING';
export interface TurnConflict { op: number; tool: string; code: TurnCode; reason: string }
export interface HistoryEntry {
  id: string; at: string;
  kind: 'prompt' | 'change' | 'proposal' | 'rebase' | 'accept' | 'reject' | 'compacted';
  by: { agent: string; model?: string };
  prompt?: string; plan?: string; summary?: string; requirements?: string[];
  /** The model hash the step produced (a change, an accept). */
  model_hash?: string; proposal?: string; risk?: Risk;
  /** An accept: who proposed it (its prompt, plan and requirements ride along); a rebase or accept: the base before. */
  proposed_by?: { agent: string; model?: string }; base_was?: string;
  /** For a compacted entry: how many it stands for, by kind, and their span. */
  compacted?: { entries: number; kinds: Record<string, number>; from: string; to: string };
}
