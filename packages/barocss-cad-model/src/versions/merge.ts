// CG6 (DA-3): merging one branch's work into another — a three-way merge from the nearest version both were made from.
//   - Features by stable id, in id form (versions/idForm.ts): changed on one side → that side's; on both, the same → it;
//     on both differently, or deleted on one and changed on the other → a conflict.
//   - Feature ids both sides handed out (each made its own `n7`): theirs are renamed to fresh serials (chat/remap's
//     renameIds: its face names `n7.top`, body keys `b7`, drawing references …), since an id is never used twice.
//   - The order: ours, with each of theirs' features placed after the feature before it in theirs. A feature kept that
//     names one deleted (by index or by persistent name) is a conflict: keep the deleted one, or drop what names it.
//   - Parameters, configurations, body looks and waiting part revisions by key; mates, placed parts, underlays,
//     proposals and the history by id; every other field whole.
//   - Conflicts are returned as data (code, where, each side's value). The caller merges again with a resolution per
//     `where` — 'ours' or 'theirs' — until none is left. Nothing is chosen for the person.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { prefixDoc } from '../engine/doc';
import { nextSerial, serialOf, withIds } from '../engine/ids';
import { BASE, type MateRef } from '../assembly/mates';
import { renameIds } from '../chat/remap';
import { canonical, revisionOf } from '../util/revision';
import { refusal, type VersionCode } from './codes';
import { idFormOf, indexForm, namedIdsOf, nodeKey, serialRefsOf } from './idForm';
import { ancestorsOf, branchOf, checkAt, checkBy, checkName, findBase, isUnsaved, keep, readVersion, versionNamed, versionOf, type Version, type VersionLog } from './log';

export type Side = 'ours' | 'theirs';
export interface Conflict {
  code: VersionCode;
  /** What it is about, and the key its resolution goes under: `feature:n7`, `parameter:width`, `mates:m2`, `field:drawing`. */
  where: string;
  message: string;
  base?: unknown; ours?: unknown; theirs?: unknown;
}
export type Resolutions = Readonly<Record<string, Side>>;
export type MergeDocsResult = { doc: StudioDoc; dropped: string[] } | { conflicts: Conflict[] };

/** Records merged key by key. */
const RECORDS = ['parameters', 'configurations', 'bodies', 'pendingParts'] as const;
/** Lists of items with ids, merged item by item. */
const LISTS = ['mates', 'instances', 'underlays', 'proposals', 'history'] as const;
/** Fields the merge makes itself. */
const MADE = new Set(['format', 'schema', 'units', 'nodes', 'outputs', 'nextId']);

const same = (a: unknown, b: unknown) => canonical(a ?? null) === canonical(b ?? null);
const nodeSame = (a: ModelNode | undefined, b: ModelNode | undefined) => a === undefined || b === undefined ? a === b : nodeKey(a) === nodeKey(b);

/** A mate's face reference renamed when it is on the base part (a placed part's names are its own). */
const renameRef = (r: MateRef, ids: ReadonlyMap<string, string>): MateRef => r.part === BASE ? renameIds(r, ids) : r;
/**
 * Their document with feature ids renamed: everything naming the base part's features, not the placed parts' own
 * documents (an instance's `doc`, a waiting revision) nor mates' faces on placed parts.
 */
function renameTheirs(doc: StudioDoc, ids: ReadonlyMap<string, string>): StudioDoc {
  if (!ids.size) return doc;
  const { instances, pendingParts, mates, ...rest } = doc;
  const out = renameIds(rest, ids) as StudioDoc;
  if (instances) out.instances = instances;
  if (pendingParts) out.pendingParts = pendingParts;
  if (mates) out.mates = mates.map(m => ({ ...m, a: renameRef(m.a, ids), b: renameRef(m.b, ids) }));
  return out;
}

/** One value merged three ways: the changed side's, or a conflict when both changed it differently. */
function three<T>(b: T, o: T, t: T, where: string, code: VersionCode, what: string, resolve: Resolutions, conflicts: Conflict[]): T {
  if (same(o, t) || same(b, t)) return o;
  if (same(b, o)) return t;
  const r = resolve[where];
  if (r) return r === 'ours' ? o : t;
  conflicts.push({ code, where, message: `[${code}] ${what} was changed on both branches`, base: b, ours: o, theirs: t });
  return o;
}

function mergeRecord(field: string, rb: Record<string, unknown> | undefined, ro: Record<string, unknown> | undefined, rt: Record<string, unknown> | undefined, resolve: Resolutions, conflicts: Conflict[]): Record<string, unknown> | undefined {
  // (A field either side has stays, empty or not: the kernel reads `parameters: {}`, not its absence.)
  const b = rb ?? {}, o = ro ?? {}, t = rt ?? {};
  const out: Record<string, unknown> = {}, code: VersionCode = field === 'parameters' ? 'PARAMETER_BOTH' : 'FIELD_BOTH', what = field === 'parameters' ? 'parameter' : field;
  // (Ours' keys in ours' order, then theirs' new ones.)
  for (const k of [...new Set([...Object.keys(o), ...Object.keys(t), ...Object.keys(b)])]) {
    const v = three(b[k], o[k], t[k], `${what}:${k}`, code, `${what} “${k}”`, resolve, conflicts);
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length || ro !== undefined || rt !== undefined ? out : undefined;
}

type Item = { id: string };
function mergeList(field: string, rb: readonly Item[] | undefined, ro: readonly Item[] | undefined, rt: readonly Item[] | undefined, resolve: Resolutions, conflicts: Conflict[]): Item[] | undefined {
  const b = rb ?? [], o = ro ?? [], t = rt ?? [];
  const B = new Map(b.map(x => [x.id, x])), O = new Map(o.map(x => [x.id, x])), T = new Map(t.map(x => [x.id, x]));
  const decide = (id: string): Item | undefined => {
    const bx = B.get(id), ox = O.get(id), tx = T.get(id), where = `${field}:${id}`, r = resolve[where];
    if (!bx && ox && tx && !same(ox, tx)) {
      if (r) return r === 'ours' ? ox : tx;
      conflicts.push({ code: 'ID_CLASH', where, message: `[ID_CLASH] both branches added a different ${field} item “${id}”`, ours: ox, theirs: tx });
      return ox;
    }
    if (bx && (!ox || !tx) && (ox || tx) && !same(bx, ox ?? tx)) {
      if (r) return r === 'ours' ? ox : tx;
      conflicts.push({ code: 'ITEM_DELETED_EDITED', where, message: `[ITEM_DELETED_EDITED] ${field} “${id}” was deleted on one branch and changed on the other`, base: bx, ours: ox, theirs: tx });
      return ox;
    }
    if (bx && (!ox || !tx)) return undefined;
    return three(bx, ox, tx, where, 'ITEM_EDITED_BOTH', `${field} “${id}”`, resolve, conflicts);
  };
  // (Ours' order, then theirs' new items; one deleted on both is gone.)
  const list: Item[] = [];
  for (const id of new Set([...o.map(x => x.id), ...t.map(x => x.id), ...b.map(x => x.id)])) { const v = decide(id); if (v) list.push(v); }
  return list.length || ro !== undefined || rt !== undefined ? list : undefined;
}

/**
 * Theirs' feature ids to rename. When any feature theirs added has an id ours also handed out — ours has it with other
 * content, or handed its serial out before (an id is never used twice) — every feature theirs added (except one ours
 * added identically) takes the next free serial, in theirs' order, so its new features read in order as ours' next.
 */
function clashes(B: ReturnType<typeof idFormOf>, O: ReturnType<typeof idFormOf>, T: ReturnType<typeof idFormOf>, ours: StudioDoc): Map<string, string> {
  const map = new Map<string, string>(), oursNext = nextSerial(ours);
  const added = T.order.filter(id => !B.nodes.has(id) && !(O.nodes.has(id) && nodeSame(O.nodes.get(id), T.nodes.get(id))));
  if (!added.some(id => O.nodes.has(id) || serialOf(id) < oursNext)) return map;
  const moving = new Set(added);
  let fresh = Math.max(oursNext, ...T.order.filter(id => !moving.has(id)).map(id => serialOf(id) + 1));
  for (const id of added) map.set(id, `n${fresh++}`);
  return map;
}

/** Ours' order, with each feature only theirs keeps placed after the one before it in theirs' order. */
function orderOf(oursOrder: readonly string[], theirsOrder: readonly string[], kept: ReadonlySet<string>): string[] {
  const out = oursOrder.filter(id => kept.has(id)), placed = new Set(out);
  let after: string | null = null;
  for (const id of theirsOrder) {
    if (!kept.has(id)) continue;
    if (!placed.has(id)) { const at = after === null ? 0 : out.indexOf(after) + 1; out.splice(at, 0, id); placed.add(id); }
    after = id;
  }
  return out;
}

/** The three documents merged, or the conflicts left (with `resolve`'s answers taken). */
export function mergeDocs(base: StudioDoc, ours: StudioDoc, theirs: StudioDoc, o: { resolve?: Resolutions } = {}): MergeDocsResult {
  const resolve = o.resolve ?? {};
  if (same(ours, theirs) || same(base, theirs)) return { doc: ours, dropped: [] };
  if (same(base, ours)) return { doc: theirs, dropped: [] };
  const B = idFormOf(base), Oi = idFormOf(ours), T0 = idFormOf(theirs), Ow = withIds(ours);
  const renames = clashes(B, Oi, T0, Ow);
  const Tw = renameTheirs(withIds(theirs), renames), Ti = renames.size ? idFormOf(Tw) : T0;
  const conflicts: Conflict[] = [];

  // Features, id by id.
  const kept = new Map<string, ModelNode>(), source = new Map<string, Side>();
  for (const id of new Set([...B.order, ...Oi.order, ...Ti.order])) {
    const b = B.nodes.get(id), on = Oi.nodes.get(id), tn = Ti.nodes.get(id), where = `feature:${id}`, r = resolve[where];
    const take = (side: Side) => { const n = side === 'ours' ? on : tn; if (n) { kept.set(id, n); source.set(id, side); } };
    if (!b) { take(on ? 'ours' : 'theirs'); continue; }
    if (on && tn) {
      if (nodeSame(b, tn) || nodeSame(on, tn)) take('ours');
      else if (nodeSame(b, on)) take('theirs');
      else if (r) take(r);
      else { conflicts.push({ code: 'FEATURE_EDITED_BOTH', where, message: `[FEATURE_EDITED_BOTH] the ${on.kind} ${id} was changed on both branches`, base: b, ours: on, theirs: tn }); take('ours'); }
      continue;
    }
    const left = on ?? tn;
    if (!left) continue;
    const side: Side = on ? 'ours' : 'theirs';
    // (Deleted on one side: deleted, unless the other changed it.)
    if (nodeSame(b, left)) continue;
    if (r) { if (r === side) take(side); continue; }
    conflicts.push({ code: 'FEATURE_DELETED_EDITED', where, message: `[FEATURE_DELETED_EDITED] the ${left.kind} ${id} was deleted on one branch and changed on the other`, base: b, ours: on, theirs: tn });
    take(side);
  }

  // A feature kept that names one not kept: keep that one (from the side that has it), or drop what names it.
  // (Keeping one keeps what it is built on, from the same side, without asking again.)
  const dropped: string[] = [], inherited = new Map<string, Side>();
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, node] of [...kept]) {
      if (!kept.has(id)) continue;
      const names = [...serialRefsOf(node).filter(s => s >= 0).map(s => `n${s}`), ...namedIdsOf(node)];
      for (const r of names) {
        if (kept.has(r) || r === id) continue;
        // (A text that only looks like a name: no feature of any side has that id.)
        if (!B.nodes.has(r) && !Oi.nodes.has(r) && !Ti.nodes.has(r)) continue;
        const on = Oi.nodes.get(r), tn = Ti.nodes.get(r), where = `feature:${r}`, has: Side | null = on ? 'ours' : tn ? 'theirs' : null, ans = resolve[where] ?? inherited.get(r);
        if (has && ans === has) {
          const n = (has === 'ours' ? on : tn)!;
          kept.set(r, n); source.set(r, has); changed = true;
          for (const s of [...serialRefsOf(n).filter(k => k >= 0).map(k => `n${k}`), ...namedIdsOf(n)]) if (!inherited.has(s)) inherited.set(s, has);
          continue;
        }
        if (has && ans === undefined) {
          if (!conflicts.some(c => c.where === where)) conflicts.push({ code: 'MERGE_DANGLING', where, message: `[MERGE_DANGLING] ${id} uses ${r}, which the other branch deleted: keep ${r}, or drop what uses it`, base: B.nodes.get(r), ours: on, theirs: tn });
          continue;
        }
        // (Dropped: answered for the side that deleted it, or neither side has it.)
        kept.delete(id); dropped.push(id); changed = true; break;
      }
    }
  }

  const doc: Record<string, unknown> = { ...Ow };
  for (const f of RECORDS) { const v = mergeRecord(f, base[f] as Record<string, unknown>, Ow[f] as Record<string, unknown>, Tw[f] as Record<string, unknown>, resolve, conflicts); if (v === undefined) delete doc[f]; else doc[f] = v; }
  for (const f of LISTS) { const v = mergeList(f, base[f] as Item[], Ow[f] as Item[], Tw[f] as Item[], resolve, conflicts); if (v === undefined) delete doc[f]; else doc[f] = v; }
  const rb = base as unknown as Record<string, unknown>, ro = Ow as unknown as Record<string, unknown>, rt = Tw as unknown as Record<string, unknown>;
  const handled = new Set<string>([...MADE, ...RECORDS, ...LISTS]);
  for (const k of [...new Set([...Object.keys(ro), ...Object.keys(rt), ...Object.keys(rb)])].filter(k => !handled.has(k))) {
    const v = three(rb[k], ro[k], rt[k], `field:${k}`, 'FIELD_BOTH', `the ${k}`, resolve, conflicts);
    if (v === undefined) delete doc[k]; else doc[k] = v;
  }
  if (conflicts.length) return { conflicts };

  const order = orderOf(Oi.order, Ti.order, new Set(kept.keys()));
  const position = new Map(order.map((id, i) => [serialOf(id), i]));
  order.forEach((id, i) => {
    for (const s of serialRefsOf(kept.get(id)!)) if (s >= 0 && (position.get(s) ?? Infinity) >= i) throw refusal('MERGE_ORDER', `${id} would use n${s}, which comes after it in the merged tree: merge these branches by hand`);
  });
  const { nodes } = indexForm(order, kept);
  const merged = { ...doc, nodes, nextId: Math.max(nextSerial(Ow), nextSerial(Tw), ...order.map(id => serialOf(id) + 1)) } as unknown as StudioDoc;
  return { doc: prefixDoc(merged, merged.nodes.length), dropped };
}

export type MergeResult =
  | { log: VersionLog; doc: StudioDoc; version: Version | null; fastForward: boolean; dropped: string[] }
  | { conflicts: Conflict[] };

/**
 * Branch `from` merged into the current branch. The working document must be its last version. Fast-forward when the
 * current branch has nothing of its own since; otherwise a merge version with both heads as parents, or the conflicts.
 */
export function applyMerge(log: VersionLog, o: { from: string; working: StudioDoc; at: string; by?: string; name?: string; note?: string; resolve?: Resolutions }): MergeResult {
  const from = branchOf(log, o.from), into = branchOf(log);
  if (from.name === into.name) throw refusal('MERGE_SAME', `“${from.name}” is the branch being worked on`);
  if (isUnsaved(log, o.working)) throw refusal('BRANCH_UNSAVED', `the document has changes since the last version of “${into.name}”: make a version first, or discard them`);
  if (ancestorsOf(log, into.head).has(from.head)) throw refusal('MERGE_UP_TO_DATE', `“${into.name}” already has everything on “${from.name}”`);
  if (ancestorsOf(log, from.head).has(into.head)) {
    const head = versionNamed(log, from.head);
    return { log: { ...log, branches: log.branches.map(b => b.name === into.name ? { ...b, head: head.id } : b) }, doc: readVersion(log, head.id), version: null, fastForward: true, dropped: [] };
  }
  const baseId = findBase(log, into.head, from.head);
  if (!baseId) throw refusal('MERGE_NO_BASE', `“${into.name}” and “${from.name}” share no version`);
  const snap = (id: string) => readVersion(log, id);
  const r = mergeDocs(snap(baseId), snap(into.head), snap(from.head), { resolve: o.resolve });
  if ('conflicts' in r) return r;
  // (A merge version even when the document is ours as it was: theirs' head is then one of its parents, so it is merged.)
  const at = checkAt(o.at), by = checkBy(o.by), name = checkName(log, o.name), { snapshots, key } = keep(log.snapshots, r.doc);
  const v = versionOf({ parents: [into.head, from.head], snapshot: key, revision: revisionOf(r.doc), branch: into.name, ...(name ? { name } : {}), ...(o.note ? { note: String(o.note) } : {}), ...(by ? { by } : {}), at });
  return {
    log: { ...log, versions: [...log.versions, v], branches: log.branches.map(b => b.name === into.name ? { ...b, head: v.id } : b), snapshots },
    doc: r.doc, version: v, fastForward: false, dropped: r.dropped,
  };
}
