// Proposals and design history (A4.2). An agent proposes a change instead of making it: its ops (the same calls
// apply_ops takes), on the model it saw (`base`, a model hash), with what it would do — the feature-tree diff,
// the checks before and after, references it would break — summed up as a risk badge. The proposal keeps its
// ops, not a copy of the part: its result is the ops replayed. The user accepts or rejects it in the studio;
// rejected ones stay.
//
// The design history is a compact record in the document: who did what (prompt, plan, change, proposal,
// accept, reject), with which agent and model, the prompt capped, the model hash it produced. No transcripts or
// images. It is held under a budget (a tenth of the file limit): the oldest entries are folded into a summary
// when it is exceeded, and that is recorded. It is saved with the part — the studio says so and can strip it.
import type { StudioDoc } from '../engine/doc';
import type { TreeDiff } from './transactions';

export interface Op { tool: string; args?: Record<string, unknown>; opId?: string }
/**
 * What a change puts at risk: features it adds, changes, deletes or moves; references it breaks; hard
 * requirements whose outcome or definition it changes. `approval`: why it always needs a person's approval,
 * whatever the autonomy (an assembly, mates, a drawing, a part from a file).
 */
export interface Risk { level: 'low' | 'medium' | 'high'; features_touched: number; references_broken: number; hard_requirements_changed: string[]; approval: string[] }
export interface ChecksDelta { before: Counts; after: Counts; newly_failing: string[]; newly_passing: string[] }
interface Counts { pass: number; fail: number; unknown: number }
export interface Proposal {
  id: string; title: string; status: 'open' | 'accepted' | 'rejected';
  by: { agent: string; model?: string }; at: string;
  /** The user's message it was made for (capped), the agent's plan, the requirements it serves. */
  prompt?: string; plan?: string; requirements?: string[];
  /** The model it was made on, and the calls that make it. */
  base: string; ops: Op[];
  risk: Risk; checks?: ChecksDelta;
  /** One line: what it does (features added, changed, deleted; the checks' counts before → after). */
  summary: string;
  decided?: { by: string; at: string; note?: string; model_hash?: string; left_out?: string[] };
  /**
   * Made again on a changed part (D41): the base it was first made on, the one before this rebase, when, and
   * the risk it had first (an agent may accept a rebase only when its risk is no higher and no hard requirement changes).
   */
  rebased?: { original: string; from: string; at: string; risk_was: Risk };
}
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

export const PROMPT_CHARS = 2000, PLAN_CHARS = 500, SUMMARY_CHARS = 240;
/** The history's share of the file limit (4 MiB, CadPartLimits.fileBytes): about 400 kB. */
export const HISTORY_BYTES = Math.floor(4 * 1024 * 1024 / 10);
const cap = (s: string | undefined, n: number) => s === undefined ? undefined : s.length > n ? s.slice(0, n - 1) + '…' : s;

/** The document with an entry added to its history (capped, and the oldest folded when over the budget). */
export function withHistory(doc: StudioDoc, entry: Omit<HistoryEntry, 'id' | 'at'> & { at?: string }, budget = HISTORY_BYTES): StudioDoc {
  const list = [...(doc.history ?? [])], n = list.reduce((m, e) => Math.max(m, Number(/^h(\d+)$/.exec(e.id)?.[1] ?? 0)), 0) + 1;
  list.push({ ...entry, id: `h${n}`, at: entry.at ?? new Date().toISOString(),
    ...(entry.prompt !== undefined ? { prompt: cap(entry.prompt, PROMPT_CHARS) } : {}), ...(entry.plan !== undefined ? { plan: cap(entry.plan, PLAN_CHARS) } : {}), ...(entry.summary !== undefined ? { summary: cap(entry.summary, SUMMARY_CHARS) } : {}) });
  return { ...doc, history: compactHistory(list, budget) };
}
/** The oldest half folded into one summary entry while the history is over its budget. */
export function compactHistory(list: HistoryEntry[], budget = HISTORY_BYTES): HistoryEntry[] {
  let out = list;
  while (out.length > 2 && JSON.stringify(out).length > budget) {
    const k = Math.max(2, Math.floor(out.length / 2)), old = out.slice(0, k), kinds: Record<string, number> = {};
    let entries = 0;
    for (const e of old) {
      if (e.compacted) { entries += e.compacted.entries; for (const [kk, v] of Object.entries(e.compacted.kinds)) kinds[kk] = (kinds[kk] ?? 0) + v; }
      else { entries++; kinds[e.kind] = (kinds[e.kind] ?? 0) + 1; }
    }
    const first = old[0].compacted?.from ?? old[0].at;
    out = [{ id: old[0].id, at: old[old.length - 1].at, kind: 'compacted', by: { agent: 'studio' }, summary: `${entries} older entries folded to stay under the history budget`, compacted: { entries, kinds, from: first, to: old[old.length - 1].at } }, ...out.slice(k)];
  }
  return out;
}
/** The document without its design history, and its proposals without the prompts and plans (to share it). */
export function stripHistory(doc: StudioDoc): StudioDoc {
  const out: StudioDoc = { ...doc };
  delete out.history;
  if (doc.proposals) out.proposals = doc.proposals.map(({ plan: _, prompt: __, ...p }) => p);
  return out;
}

/** The risk of a change from `a` to `b` (its diff, the references it breaks, the hard requirements it changes). */
export function riskOf(a: StudioDoc, b: StudioDoc, diff: TreeDiff, broken: number, hard: string[]): Risk {
  const touched = diff.added.length + diff.changed.length + diff.deleted.length + diff.moved.length, approval: string[] = [];
  if (a.instances?.length || b.instances?.length) approval.push('assembly');
  if (a.mates?.length || b.mates?.length) approval.push('mates');
  if (a.drawing || b.drawing) approval.push('drawing');
  // (No part is marked locked yet: a part placed from a file counts as one, its own source elsewhere.)
  if ([...(a.instances ?? []), ...(b.instances ?? [])].some(i => i.part?.source)) approval.push('locked part');
  const level = hard.length || broken || diff.deleted.length ? 'high' : touched > 3 || diff.moved.length || diff.parameters ? 'medium' : 'low';
  return { level, features_touched: touched, references_broken: broken, hard_requirements_changed: hard, approval };
}

/** The next proposal id (`P1`, `P2`, …: never reused, rejected ones staying). */
export const nextProposalId = (doc: StudioDoc) => `P${(doc.proposals ?? []).reduce((m, p) => Math.max(m, Number(/^P(\d+)$/.exec(p.id)?.[1] ?? 0)), 0) + 1}`;

/** A proposal rejected by a person: kept, marked, with the reason, and the decision in the history. */
export function rejectProposal(doc: StudioDoc, id: string, note?: string, by = 'user'): StudioDoc | { error: string } {
  const p = doc.proposals?.find(q => q.id === id);
  if (!p || p.status !== 'open') return { error: p ? `${id} is ${p.status} already.` : `No proposal ${id}.` };
  const decided = { by, at: new Date().toISOString(), ...(note ? { note: note.slice(0, 240) } : {}) };
  const next = { ...doc, proposals: doc.proposals!.map(q => q.id === id ? { ...q, status: 'rejected' as const, decided } : q) };
  return withHistory(next, { kind: 'reject', by: { agent: by }, proposal: id, summary: `${id} ${p.title}${note ? `: ${note}` : ''}` });
}
/** A diff in a few words: "1 added, 2 changed, parameters w" ('' when nothing changed). */
export function diffLine(diff: TreeDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.changed.length) parts.push(`${diff.changed.length} changed`);
  if (diff.deleted.length) parts.push(`${diff.deleted.length} deleted`);
  if (diff.moved.length) parts.push(`${diff.moved.length} moved`);
  if (diff.parameters) parts.push(`parameters ${Object.keys(diff.parameters).join(', ')}`);
  if (diff.requirements) parts.push('requirements');
  return parts.join(', ');
}

/** Risk levels in order. */
export const riskRank = (level: Risk['level']) => level === 'high' ? 2 : level === 'medium' ? 1 : 0;
