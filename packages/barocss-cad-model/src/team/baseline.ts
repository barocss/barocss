// Approval baselines (A8.4b, O32's addendum, O39). A baseline pins what the user approves by content: the BOM and the
// interfaces it was made with, each by the SHA-256 of its canonical JSON, and every part's revision by the same digest
// of what it is (its document's revision fields and its placement). Its own record is digested too, its parent's digest
// in it, so neither it nor what it descends from can change unseen. It moves draft → review → approved | rejected, and
// only by the user's minted token (A8.3's channel); decided, it is never written again: a later change is a new draft
// whose parent is the old one, and the old still verifies as what was approved then.
import type { StudioDoc } from '../engine/doc';
import { checkBom, type Bom, type BomView } from './assembly';
import { digestOf, partDigests } from '../util/digest';
import { isUserToken, type UserToken } from './ecr';
import { readInterfaces, type Interfaces } from './interfaces';
import { freshnessOf, type Result } from './freshness';
import type { Evaluate } from '../chat/tools';
import { incompleteBeadReason } from '../frames/beadAccounting';

export type BaselineState = 'draft' | 'review' | 'approved' | 'rejected';
export interface Pins { interfaces: string; bom: string; parts: Record<string, string> }
export interface Baseline {
  id: string; kind: 'bom'; parent: string | null; parentDigest: string | null; state: BaselineState;
  content: { bom: Bom; interfaces: Interfaces }; pins: Pins;
  /** The analysis results it cites (A8.5b), as they were: each must be ok and current for the baseline to be approved. */
  cites?: Result[];
  /** Each move, by the user, and when. */
  moves: { to: BaselineState; at: string }[];
  /** The record's own digest (everything above). */
  digest: string;
}
export interface BaselineLog { version: 1; baselines: Baseline[] }
export type BaselineCode = 'APPROVAL_IS_THE_USERS' | 'BAD_TRANSITION' | 'BASELINE_FROZEN' | 'STALE_BASELINE' | 'STALE_RESULT' | 'RESULT_NOT_OK' | 'NO_BASELINE' | 'BOM_INVALID';
export class BaselineError extends Error { constructor(public code: BaselineCode, message: string) { super(`[${code}] ${message}`); this.name = 'BaselineError'; } }
export const readBaselines = (raw: unknown): BaselineLog => { const r = raw as BaselineLog | undefined; return r && r.version === 1 && Array.isArray(r.baselines) ? r : { version: 1, baselines: [] }; };

const recordDigest = (b: Omit<Baseline, 'digest'> | Baseline) => { const { digest: _d, ...rest } = b as Baseline; void _d; return digestOf(rest); };
const sealed = (b: Omit<Baseline, 'digest'>): Baseline => ({ ...b, digest: recordDigest(b) });
const withLog = (doc: StudioDoc, baselines: Baseline[]): StudioDoc => ({ ...doc, baselines: { version: 1, baselines } });

/**
 * A draft baseline of the BOM, checked against a built view of the assembly first (BOM_INVALID with its problems), with
 * the interfaces and parts as they are. `parent`: the decided baseline it follows (a later change); a draft is never one.
 */
export function draftBaseline(doc: StudioDoc, bom: Bom, view: BomView, o: { parent?: string; cites?: readonly Result[] } = {}): { doc: StudioDoc; baseline: Baseline } {
  const problems = checkBom(view, bom);
  if (problems.length) throw new BaselineError('BOM_INVALID', problems.join('; '));
  const log = readBaselines(doc.baselines), parent = o.parent ? log.baselines.find(b => b.id === o.parent) : undefined;
  if (o.parent && !parent) throw new BaselineError('NO_BASELINE', `no baseline ${o.parent}`);
  if (parent && (parent.state === 'draft' || parent.state === 'review')) throw new BaselineError('BAD_TRANSITION', `${parent.id} is still ${parent.state}: a baseline follows a decided one`);
  const interfaces = readInterfaces(doc.interfaces), content = JSON.parse(JSON.stringify({ bom, interfaces })) as Baseline['content'];
  const baseline = sealed({ id: `BL${log.baselines.length + 1}`, kind: 'bom', parent: parent?.id ?? null, parentDigest: parent?.digest ?? null, state: 'draft', content, pins: { interfaces: digestOf(content.interfaces), bom: digestOf(content.bom), parts: partDigests(doc) }, ...(o.cites?.length ? { cites: JSON.parse(JSON.stringify(o.cites)) as Result[] } : {}), moves: [] });
  return { doc: withLog(doc, [...log.baselines, baseline]), baseline };
}

const NEXT: Record<BaselineState, readonly BaselineState[]> = { draft: ['review'], review: ['approved', 'rejected'], approved: [], rejected: [] };
/** What in the document differs from a baseline's pins: the interfaces and each part changed, added or gone. */
export function changedSince(doc: StudioDoc, b: Baseline): string[] {
  const out: string[] = [], now = partDigests(doc);
  if (digestOf(readInterfaces(doc.interfaces)) !== b.pins.interfaces) out.push('interfaces');
  for (const [id, d] of Object.entries(b.pins.parts)) if (now[id] === undefined) out.push(`part ${id} (gone)`); else if (now[id] !== d) out.push(`part ${id}`);
  for (const id of Object.keys(now)) if (b.pins.parts[id] === undefined) out.push(`part ${id} (added)`);
  return out;
}
/**
 * A baseline moved by the user: draft → review → approved | rejected. Refused, typed: anyone but the user's channel
 * (APPROVAL_IS_THE_USERS); a decided one (BASELINE_FROZEN); out of order (BAD_TRANSITION); approved when the document
 * no longer matches its pins (STALE_BASELINE, the changes named); approved citing a result that is not ok (RESULT_NOT_OK)
 * or not current (STALE_RESULT, its changed inputs or unresolved faces named) — `evaluate` reads them again.
 */
export async function moveBaseline(doc: StudioDoc, id: string, to: BaselineState, who: UserToken | { by: string; at: string }, evaluate?: Evaluate): Promise<{ doc: StudioDoc; baseline: Baseline }> {
  if (!isUserToken(who)) throw new BaselineError('APPROVAL_IS_THE_USERS', `${who.by === 'user' ? 'a decision claiming to be the user\'s, not from the user\'s channel' : who.by}: only the user moves a baseline`);
  const log = readBaselines(doc.baselines), b = log.baselines.find(x => x.id === id);
  if (!b) throw new BaselineError('NO_BASELINE', `no baseline ${id}; baselines: ${log.baselines.map(x => `${x.id} (${x.state})`).join(', ') || 'none'}`);
  if (b.state === 'approved' || b.state === 'rejected') throw new BaselineError('BASELINE_FROZEN', `${id} is ${b.state}: it is never changed; draft a new baseline with ${id} as its parent`);
  if (!NEXT[b.state].includes(to)) throw new BaselineError('BAD_TRANSITION', `${id} is ${b.state}: it moves to ${NEXT[b.state].join(' or ')}, not ${to}`);
  if (to === 'approved') {
    const incomplete = incompleteBeadReason(b.content.bom.beadAccounting);
    if (incomplete) throw new BaselineError('RESULT_NOT_OK', `${id}: ${incomplete}`);
    const changed = changedSince(doc, b); if (changed.length) throw new BaselineError('STALE_BASELINE', `${id} was drafted on another state: ${changed.join(', ')} changed since; draft it again`);
    for (const r of b.cites ?? []) {
      if (r.status !== 'ok') throw new BaselineError('RESULT_NOT_OK', `${id} cites ${r.id}, which is ${r.status}${r.why ? ` (${r.why})` : ''}: not a result to approve on`);
      if (!evaluate) throw new BaselineError('STALE_RESULT', `${id} cites ${r.id}: its freshness cannot be read without evaluating the part`);
      const f = await freshnessOf(r, doc, evaluate);
      if (f.state !== 'current') throw new BaselineError('STALE_RESULT', `${id} cites ${r.id}, ${f.state}: ${f.state === 'stale' ? `${f.changed.join(', ')} changed since` : f.unresolved.map(u => u.message).join('; ')}; run it again and draft a new baseline`);
    }
  }
  const { digest: _d, ...rest } = b; void _d;
  const next = sealed({ ...rest, state: to, moves: [...b.moves, { to, at: who.at }] });
  return { doc: withLog(doc, log.baselines.map(x => (x.id === id ? next : x))), baseline: next };
}

export interface BaselineCheck { intact: boolean; mismatches: string[]; current: boolean; changed: string[] }
/**
 * A baseline read back: intact — its content's digests are its pins, its record's digest is its own, its parent's digest
 * is the parent's, up to the root (each mismatch named: `content.bom`, `pins`, `record`, the parent …); current — the
 * document's interfaces and parts are still the pinned ones (the changes named).
 */
export function verifyBaseline(doc: StudioDoc, id: string): BaselineCheck {
  const log = readBaselines(doc.baselines), mismatches: string[] = [];
  const top = log.baselines.find(x => x.id === id);
  if (!top) return { intact: false, mismatches: [`${id}: no such baseline`], current: false, changed: [] };
  for (let b: Baseline | undefined = top, guard = 0; b && guard < 4096; guard++) {
    if (digestOf(b.content.bom) !== b.pins.bom) mismatches.push(`${b.id}: content.bom`);
    if (digestOf(b.content.interfaces) !== b.pins.interfaces) mismatches.push(`${b.id}: content.interfaces`);
    if (recordDigest(b) !== b.digest) mismatches.push(`${b.id}: record`);
    if (!b.parent) break;
    const parent: Baseline | undefined = log.baselines.find(x => x.id === b!.parent);
    if (!parent) { mismatches.push(`${b.id}: parent ${b.parent} missing`); break; }
    if (parent.digest !== b.parentDigest) mismatches.push(`${b.id}: parent ${parent.id}`);
    b = parent;
  }
  const changed = changedSince(doc, top);
  return { intact: !mismatches.length, mismatches, current: !changed.length, changed };
}
