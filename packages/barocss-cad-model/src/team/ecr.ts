// Engineering change requests (A8.3, O35). A change to the interfaces — the assembly's contract — is never an op: it is an
// ECR, `{id, by, base (the interfaces' revision), next (the interfaces proposed), changes, impact, status}`, kept in the
// document (`ecrs`, version 1). Its impact is computed, not declared: the parts whose patterns, envelopes or budgets
// change, the requirements whose subjects are a changed datum or keep-out, the open patches on those parts made against
// the old revision, the leases on them. Only the user decides one (APPROVAL_IS_THE_USERS): approved, the interfaces
// become its `next` (their revision moves), and every lease it touches expires — its holder's next patch is refused
// CONTRACT_MOVED until the Architect renews it; rejected, nothing changes.
import type { StudioDoc } from '../engine/doc';
import { interfacesRevision, readInterfaces, type Interfaces } from './interfaces';
import type { Lease, PartPatch } from './parts';
import { digestOf, partDigests } from '../util/digest';
import { refusal } from '../engine/refusal';

export interface EcrChange { item: string; kind: 'added' | 'removed' | 'changed'; parts: string[] }
export interface EcrImpact { parts: string[]; requirements: string[]; openPatches: string[]; leases: string[] }
/** An approved ECR's pin (A8.4b): the exact interfaces approved and the part revisions they were approved against, by
 * content digest, and the record's own digest (the ECR without `pin.record`). */
export interface EcrPin { interfaces: string; parts: Record<string, string>; record: string }
export interface Ecr { id: string; by: string; base: string; next: Interfaces; changes: EcrChange[]; impact: EcrImpact; status: 'open' | 'approved' | 'rejected'; decided?: { by: 'user'; at: string }; reason?: string; pin?: EcrPin }
export interface EcrLog { version: 1; ecrs: Ecr[] }
export type EcrCode = 'NO_CHANGE' | 'STALE_ECR' | 'NO_ECR' | 'DECIDED' | 'APPROVAL_IS_THE_USERS';

// ——— the user's channel: decisions no role can write
/** A user decision: minted only by the studio's UI and the CLI scenario runner (from its top-level user decisions), kept
 * in a module-private set — a role's output is data, and data (an object saying {by: "user"}, a JSON copy of a token)
 * is never one. */
export interface UserToken { readonly by: 'user'; readonly at: string }
const MINTED = new WeakSet<object>();
/** Mints a user decision (the studio UI, the CLI runner): never called on a role's output. */
export function userToken(at: string): UserToken { const t = Object.freeze({ by: 'user' as const, at }); MINTED.add(t); return t; }
export const isUserToken = (x: unknown): x is UserToken => !!x && typeof x === 'object' && MINTED.has(x as object);
export const readEcrs = (raw: unknown): EcrLog => { const r = raw as EcrLog | undefined; return r && r.version === 1 && Array.isArray(r.ecrs) ? r : { version: 1, ecrs: [] }; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uniq = (xs: readonly string[]) => [...new Set(xs)].sort();

/** What differs between two interfaces, item by item, with the parts each change touches. */
export function interfaceChanges(a: Interfaces, b: Interfaces): EcrChange[] {
  const out: EcrChange[] = [];
  const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map(x => [x.id, x]));
  const lists: [string, 'holePatterns' | 'envelopes', (x: Interfaces['holePatterns'][number] | Interfaces['envelopes'][number]) => string[]][] = [
    ['pattern', 'holePatterns', x => (x as Interfaces['holePatterns'][number]).parts], ['envelope', 'envelopes', x => [(x as Interfaces['envelopes'][number]).part]]];
  for (const [what, key, partsOf] of lists) {
    const A = byId(a[key] as { id: string }[]), B = byId(b[key] as { id: string }[]);
    for (const [id, x] of A) { const y = B.get(id); if (!y) out.push({ item: `${what} ${id}`, kind: 'removed', parts: uniq(partsOf(x as never)) }); else if (!same(x, y)) out.push({ item: `${what} ${id}`, kind: 'changed', parts: uniq([...partsOf(x as never), ...partsOf(y as never)]) }); }
    for (const [id, y] of B) if (!A.has(id)) out.push({ item: `${what} ${id}`, kind: 'added', parts: uniq(partsOf(y as never)) });
  }
  const pa = a.budgets.parts ?? {}, pb = b.budgets.parts ?? {};
  for (const p of uniq([...Object.keys(pa), ...Object.keys(pb)])) if (pa[p] !== pb[p]) out.push({ item: `budget ${p}`, kind: pa[p] === undefined ? 'added' : pb[p] === undefined ? 'removed' : 'changed', parts: [p] });
  if (a.budgets.mass !== b.budgets.mass) out.push({ item: 'budget total', kind: a.budgets.mass === undefined ? 'added' : b.budgets.mass === undefined ? 'removed' : 'changed', parts: ['*'] });
  for (const [what, key] of [['datum', 'datums'], ['keep-out', 'keepouts']] as const) {
    for (const id of a[key]) if (!b[key].includes(id)) out.push({ item: `${what} ${id}`, kind: 'removed', parts: [] });
    for (const id of b[key]) if (!a[key].includes(id)) out.push({ item: `${what} ${id}`, kind: 'added', parts: [] });
  }
  return out;
}

/** The ECR's impact: the parts (every part for the total budget), the requirements on a changed datum or keep-out, the open patches and leases on those parts. */
export function impactOf(doc: StudioDoc, changes: readonly EcrChange[], open: readonly PartPatch[], leases: ReadonlyMap<string, Lease>): EcrImpact {
  const all = (doc.instances ?? []).map(i => i.id), parts = uniq(changes.flatMap(c => (c.parts.includes('*') ? all : c.parts)));
  const ids = new Set(changes.filter(c => c.item.startsWith('datum ') || c.item.startsWith('keep-out ')).map(c => c.item.split(' ').pop()!));
  const requirements = uniq((doc.requirements ?? []).filter(r => { const q = r.check.query as { fn: string; keepout?: string; datum?: string }; return (q.fn === 'keepout' && ids.has(q.keepout!)) || (q.fn === 'datum_distance' && ids.has(q.datum!)); }).map(r => r.id));
  const base = interfacesRevision(doc);
  return { parts, requirements, openPatches: uniq(open.filter(p => parts.includes(p.part) && p.contract === base).map(p => p.id)), leases: uniq([...leases.values()].filter(l => parts.includes(l.part)).map(l => `${l.part}:${l.holder}`)) };
}

/** An ECR opened by a role (the Architect, a Part agent): the interfaces it proposes, its changes and impact computed; nothing changed yet. */
export function openEcr(doc: StudioDoc, by: string, next: Interfaces, o: { open?: readonly PartPatch[]; leases?: ReadonlyMap<string, Lease>; reason?: string } = {}): { doc: StudioDoc; ecr: Ecr } {
  const cur = readInterfaces(doc.interfaces), changes = interfaceChanges(cur, next);
  if (!changes.length) throw refusal('NO_CHANGE', 'the interfaces proposed are the ones in force');
  const log = readEcrs(doc.ecrs), ecr: Ecr = { id: `ECR${log.ecrs.length + 1}`, by, base: interfacesRevision(doc), next, changes, impact: impactOf(doc, changes, o.open ?? [], o.leases ?? new Map()), status: 'open', ...(o.reason ? { reason: o.reason } : {}) };
  return { doc: { ...doc, ecrs: { version: 1, ecrs: [...log.ecrs, ecr] } }, ecr };
}

/** The user decides an ECR. Approved: the interfaces become its proposal and the leases it touches expire. Rejected: nothing changes. Anyone else: refused. */
export function decideEcr(doc: StudioDoc, id: string, approve: boolean, who: UserToken | { by: string; at: string }, leases: ReadonlyMap<string, Lease>): { doc: StudioDoc; leases: Map<string, Lease>; ecr: Ecr } {
  // (The user is who the channel says, not who a value claims: a role's {by: "user"} is refused.)
  if (!isUserToken(who)) throw refusal('APPROVAL_IS_THE_USERS', `${who.by === 'user' ? 'a decision claiming to be the user\'s, not from the user\'s channel (the studio, the CLI\'s user decisions)' : who.by}: only the user decides an ECR`);
  const log = readEcrs(doc.ecrs), ecr = log.ecrs.find(e => e.id === id);
  if (!ecr) throw refusal('NO_ECR', `no ECR ${id}; ECRs: ${log.ecrs.map(e => `${e.id} (${e.status})`).join(', ') || 'none'}`);
  if (ecr.status !== 'open') throw refusal('DECIDED', `${id} is already ${ecr.status}`);
  if (approve && ecr.base !== interfacesRevision(doc)) throw refusal('STALE_ECR', `${id} was opened on the interfaces at ${ecr.base}; they are at ${interfacesRevision(doc)}: open it again on them`);
  const was: Ecr = { ...ecr, status: approve ? 'approved' : 'rejected', decided: { by: 'user', at: who.at } };
  const decided: Ecr = approve ? pinned(was, partDigests(doc)) : was;
  const ecrs = { version: 1 as const, ecrs: log.ecrs.map(e => (e.id === id ? decided : e)) };
  if (!approve) return { doc: { ...doc, ecrs }, leases: new Map(leases), ecr: decided };
  // (Approved: the interfaces as proposed. A touched lease keeps the old contract — its holder's next patch is refused
  // CONTRACT_MOVED until the Architect renews it; an untouched one moves to the new revision, its part unaffected.)
  const out: StudioDoc = { ...doc, interfaces: ecr.next, ecrs }, rev = interfacesRevision(out);
  const next = new Map([...leases].map(([k, l]) => [k, ecr.impact.parts.includes(l.part) ? { ...l, expiredBy: ecr.id } : { ...l, contract: rev }]));
  return { doc: out, leases: next, ecr: decided };
}
/** The Architect renews leases on the interfaces as they stand. */
export const renewLeases = (doc: StudioDoc, leases: ReadonlyMap<string, Lease>, until: number, parts?: readonly string[]) => new Map([...leases].map(([k, l]) => { if (parts && !parts.includes(l.part)) return [k, l]; const { expiredBy: _e, ...rest } = l; void _e; return [k, { ...rest, contract: interfacesRevision(doc), until }]; }));
const ecrRecord = (e: Ecr) => digestOf({ ...e, pin: e.pin ? { interfaces: e.pin.interfaces, parts: e.pin.parts } : undefined });
function pinned(e: Ecr, parts: Record<string, string>): Ecr { const p: Ecr = { ...e, pin: { interfaces: digestOf(readInterfaces(e.next)), parts, record: '' } }; p.pin!.record = ecrRecord(p); return p; }
/** An approved ECR read back: its interfaces are the ones pinned and its record its own (each mismatch named). */
export function verifyEcrPin(e: Ecr): string[] {
  if (e.status !== 'approved') return [];
  if (!e.pin) return [`${e.id}: approved with no pin`];
  const out: string[] = [];
  if (digestOf(readInterfaces(e.next)) !== e.pin.interfaces) out.push(`${e.id}: next`);
  if (ecrRecord(e) !== e.pin.record) out.push(`${e.id}: record`);
  return out;
}
