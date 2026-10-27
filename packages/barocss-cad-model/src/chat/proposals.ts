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
import type { Risk, HistoryEntry } from '../engine/schema/proposals';


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

/**
 * What a change from `a` to `b` does that always needs a person (D40, D41): the assembly's parts (added, removed,
 * built or moved — mates moving them too), its mates, the drawing, a locked part. An agent makes these only
 * through a proposal, which the user accepts at every autonomy level. (No part is marked locked yet: a part
 * placed from a file counts as one, its own source elsewhere.)
 */
export function approvalOf(a: StudioDoc, b: StudioDoc): string[] {
  const out: string[] = [], same = (x: unknown, y: unknown) => x === y || JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  if (!same(a.instances, b.instances)) out.push('assembly');
  if (!same(a.mates, b.mates)) out.push('mates');
  if (!same(a.drawing, b.drawing)) out.push('drawing');
  if (!same(a.robot, b.robot)) out.push('robot');
  const was = new Map((a.instances ?? []).map(i => [i.id, i]));
  if ([...(b.instances ?? []), ...(a.instances ?? [])].some(i => (i.part?.source || was.get(i.id)?.part?.source) && !same(was.get(i.id), (b.instances ?? []).find(x => x.id === i.id)))) out.push('locked part');
  return out;
}
/** The risk of a change from `a` to `b` (its diff, the references it breaks, the hard requirements it changes). */
export function riskOf(a: StudioDoc, b: StudioDoc, diff: TreeDiff, broken: number, hard: string[]): Risk {
  const touched = diff.added.length + diff.changed.length + diff.deleted.length + diff.moved.length, approval = approvalOf(a, b);
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
