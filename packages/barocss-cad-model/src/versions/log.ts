// CG6 (DA-1): named versions of a document and their branches — plain data and pure functions.
//   - A version is a whole document (its snapshot, by a content key of its canonical JSON) with its parents: one, or two
//     for a merge. Its id is made from what it is (parents, snapshot, branch, author, time; not its name or note, which may change), so versions
//     made in two copies of a project, or by two people, never take each other's ids.
//   - A branch is a name and its head. The only state that moves: versions never change once made.
//   - Nothing reads the clock or the person: `at` and `by` are the caller's.
//   - Reading a version gives its document as the working one; history is never rewound (saving it again is a new
//     version on the head), so nothing made is lost.
import type { StudioDoc } from '../engine/doc';
import { canonical, fnv64, revisionOf } from '../util/revision';
import { problem, refusal, type VersionProblem } from './codes';
import { withoutSigs } from './idForm';

export interface Version {
  id: string;
  /** The versions it was made from: none for the first, two for a merge (the branch's head first). */
  parents: string[];
  /** Its document's content key (`snapshots`). */
  snapshot: string;
  /** Its document's A7 revision (util/revision.ts): what results made from it name (O9). */
  revision: string;
  /** The branch it was made on. */
  branch: string;
  name?: string; note?: string;
  /** Who made it (a person or an agent), and when (ISO 8601): the caller's. */
  by?: string; at: string;
}
export interface Branch { name: string; head: string; /** The version it was made from. */ from: string }
export interface VersionLog {
  format: 'barocss-versions'; schema: 1;
  /** In the order they were made. */
  versions: Version[];
  branches: Branch[];
  /** The branch being worked on. */
  current: string;
  /** Each version's document by its content key; equal documents share one. */
  snapshots: Record<string, StudioDoc>;
}

export const MAIN = 'main';
const NAME_MAX = 80;
const BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,62}$/;

/** A text's content key: util/revision.ts's hash. */
export const keyOf = fnv64;
/** A document's content key: of its whole canonical JSON (every field, not only a revision's). */
export const snapshotKeyOf = (doc: StudioDoc) => keyOf(canonical(doc));

export function checkAt(at: unknown): string {
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) throw refusal('VERSION_INPUT', `the time a version is made is an ISO 8601 text (got ${JSON.stringify(at)})`);
  return at;
}
export function checkName(log: VersionLog | null, name: unknown): string | undefined {
  if (name === undefined) return undefined;
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n || n.length > NAME_MAX) throw refusal('VERSION_NAME', `a version's name is 1 to ${NAME_MAX} characters`);
  if (log?.versions.some(v => v.name === n)) throw refusal('VERSION_NAME', `a version is already named “${n}”`);
  return n;
}
export function checkBy(by: unknown): string | undefined {
  if (by === undefined) return undefined;
  if (typeof by !== 'string' || !by.trim()) throw refusal('VERSION_INPUT', 'who made a version is a non-empty text');
  return by.trim();
}
/** The snapshots with `doc` kept under its key: a key already holding another document is refused, never written over. */
export function keep(snapshots: Record<string, StudioDoc>, doc: StudioDoc): { snapshots: Record<string, StudioDoc>; key: string } {
  const text = canonical(doc), key = keyOf(text), had = snapshots[key];
  if (had) {
    if (canonical(had) !== text) throw refusal('VERSION_KEY_COLLISION', `two different documents have the content key ${key}: the version is not kept`);
    return { snapshots, key };
  }
  return { snapshots: { ...snapshots, [key]: doc }, key };
}
/** A version with its id, made from what it is. */
export const versionOf = (o: Omit<Version, 'id'>): Version => ({ id: idOf(o), ...o });
/** A version's id: from its parents, snapshot, branch, author and time. */
export const idOf = (o: Pick<Version, 'parents' | 'snapshot' | 'branch' | 'by' | 'at'>): string => 'v' + keyOf(canonical({ parents: o.parents, snapshot: o.snapshot, branch: o.branch, by: o.by ?? null, at: o.at }));

/** A version log started with the document as its first version, on the branch `main` (or the one named). */
export function makeVersions(doc: StudioDoc, o: { at: string; by?: string; name?: string; note?: string; branch?: string }): VersionLog {
  const at = checkAt(o.at), by = checkBy(o.by), name = checkName(null, o.name), branch = checkBranchName(o.branch ?? MAIN);
  const { snapshots, key } = keep({}, doc);
  const v = versionOf({ parents: [], snapshot: key, revision: revisionOf(doc), branch, ...(name ? { name } : {}), ...(o.note ? { note: String(o.note) } : {}), ...(by ? { by } : {}), at });
  return { format: 'barocss-versions', schema: 1, versions: [v], branches: [{ name: branch, head: v.id, from: v.id }], current: branch, snapshots };
}

function checkBranchName(name: unknown): string {
  if (typeof name !== 'string' || !BRANCH_NAME.test(name)) throw refusal('BRANCH_NAME', `a branch's name is 1 to 63 letters, digits, spaces and . _ / - (starting with a letter or digit), got ${JSON.stringify(name)}`);
  return name;
}
export function branchOf(log: VersionLog, name: string = log.current): Branch {
  const b = log.branches.find(x => x.name === name);
  if (!b) throw refusal('BRANCH_UNKNOWN', `there is no branch “${name}” (branches: ${log.branches.map(x => x.name).join(', ')})`);
  return b;
}
export function versionNamed(log: VersionLog, id: string): Version {
  const v = log.versions.find(x => x.id === id || x.name === id);
  if (!v) throw refusal('VERSION_UNKNOWN', `there is no version “${id}”`);
  return v;
}
/** The head of a branch (the current one when not named). */
export const headOf = (log: VersionLog, branch?: string): Version => versionNamed(log, branchOf(log, branch).head);
/**
 * A version's document (by id or name): the working document when it is restored. Refused, VERSION_NOT_LOADED, when the
 * log is a turn's (`turnLog`) and does not hold that version's document; `details.ids` names it.
 */
export function readVersion(log: VersionLog, id: string): StudioDoc {
  const v = versionNamed(log, id), doc = log.snapshots[v.snapshot];
  if (!doc) throw refusal('VERSION_NOT_LOADED', `the document of version ${v.name ?? v.id} is not with this turn: it comes with the next one`, { ids: [v.id] });
  // Check stored canonical identities before returning the original snapshot; do not normalize its fields.
  if (snapshotKeyOf(doc) !== v.snapshot) throw refusal('VERSION_LOG', `the snapshot ${v.snapshot} does not match its content`);
  if (revisionOf(doc) !== v.revision) throw refusal('VERSION_LOG', `the revision ${v.revision} is not its document's`);
  if (idOf(v) !== v.id) throw refusal('VERSION_LOG', `the id ${v.id} is not made from the version's content`);
  return doc;
}
/**
 * A document's content as versions compare it: its nodes' stored face signatures left out — they follow the geometry of
 * the faces a node names, and the studio and the agent write them on every change they evaluate.
 */
export const contentOf = (doc: StudioDoc) => canonical({ ...doc, nodes: doc.nodes.map(withoutSigs) });
/** Whether the working document differs from the current branch's head. */
export const isUnsaved = (log: VersionLog, working: StudioDoc): boolean => contentOf(working) !== contentOf(readVersion(log, headOf(log).id));

/** The document as a new version on the current branch, its head moved to it. Refused when nothing changed since the head. */
export function makeVersion(log: VersionLog, doc: StudioDoc, o: { at: string; by?: string; name?: string; note?: string }): { log: VersionLog; version: Version } {
  const at = checkAt(o.at), by = checkBy(o.by), name = checkName(log, o.name), head = headOf(log);
  const { snapshots, key } = keep(log.snapshots, doc);
  if (key === head.snapshot || contentOf(doc) === contentOf(readVersion(log, head.id))) throw refusal('VERSION_NO_CHANGE', `the document is the same as the branch's last version${head.name ? ` (“${head.name}”)` : ''}`);
  const v = versionOf({ parents: [head.id], snapshot: key, revision: revisionOf(doc), branch: log.current, ...(name ? { name } : {}), ...(o.note ? { note: String(o.note) } : {}), ...(by ? { by } : {}), at });
  return { log: { ...log, versions: [...log.versions, v], branches: log.branches.map(b => b.name === log.current ? { ...b, head: v.id } : b), snapshots }, version: v };
}

/** A version's name (or note) set or cleared. Names stay unique. */
export function nameVersion(log: VersionLog, id: string, o: { name?: string | null; note?: string | null }): VersionLog {
  const v = versionNamed(log, id);
  const name = o.name === null ? undefined : o.name === undefined ? v.name : checkName({ ...log, versions: log.versions.filter(x => x.id !== v.id) }, o.name);
  const note = o.note === null ? undefined : o.note === undefined ? v.note : String(o.note);
  // (The id stays: it names the version made, and other versions and branches point at it.)
  const next: Version = { ...v }; delete next.name; delete next.note;
  if (name) next.name = name; if (note) next.note = note;
  return { ...log, versions: log.versions.map(x => x.id === v.id ? next : x) };
}

/** A branch's versions, newest first: its head, then each first parent back to the first version. */
export function versionsOf(log: VersionLog, o: { branch?: string } = {}): Version[] {
  const byId = new Map(log.versions.map(v => [v.id, v])), out: Version[] = [];
  for (let v = byId.get(branchOf(log, o.branch).head); v; v = v.parents.length ? byId.get(v.parents[0]) : undefined) out.push(v);
  return out;
}
/** Every version a version was made from, itself included. */
export function ancestorsOf(log: VersionLog, id: string): Set<string> {
  const byId = new Map(log.versions.map(v => [v.id, v])), seen = new Set<string>(), todo = [id];
  while (todo.length) { const k = todo.pop()!; if (seen.has(k)) continue; seen.add(k); todo.push(...(byId.get(k)?.parents ?? [])); }
  return seen;
}
/**
 * The nearest version both were made from (a merge's base): of their common ancestors, the one no other common ancestor
 * was made from; with several (criss-cross merges), the latest made. Null when they share none.
 */
export function findBase(log: VersionLog, a: string, b: string): string | null {
  const A = ancestorsOf(log, a), B = ancestorsOf(log, b), common = [...A].filter(k => B.has(k));
  if (!common.length) return null;
  const notBest = new Set<string>();
  for (const k of common) for (const p of ancestorsOf(log, k)) if (p !== k) notBest.add(p);
  const best = common.filter(k => !notBest.has(k)), order = new Map(log.versions.map((v, i) => [v.id, i]));
  return best.sort((x, y) => order.get(y)! - order.get(x)!)[0];
}

/** A branch made at a version (the current head when not given). It is not switched to. */
export function makeBranch(log: VersionLog, name: string, o: { from?: string } = {}): VersionLog {
  checkBranchName(name);
  if (log.branches.some(b => b.name === name)) throw refusal('BRANCH_EXISTS', `a branch is already named “${name}”`);
  const from = o.from === undefined ? headOf(log).id : versionNamed(log, o.from).id;
  return { ...log, branches: [...log.branches, { name, head: from, from }] };
}
/**
 * Work switched to another branch: its head's document becomes the working one. Refused while the working document has
 * changes not made into a version (`discard: true` drops them).
 */
export function applyBranch(log: VersionLog, name: string, working: StudioDoc, o: { discard?: boolean } = {}): { log: VersionLog; doc: StudioDoc } {
  const b = branchOf(log, name);
  if (!o.discard && isUnsaved(log, working)) throw refusal('BRANCH_UNSAVED', `the document has changes since the last version of “${log.current}”: make a version first, or discard them`);
  return { log: { ...log, current: b.name }, doc: readVersion(log, b.head) };
}

/** What is wrong with a version log (read from a file, say): its shape, ids, parents, branches and snapshots. Never throws. */
export function checkVersions(value: unknown): VersionProblem[] {
  const out: VersionProblem[] = [];
  const log = value as VersionLog;
  if (!log || typeof log !== 'object' || log.format !== 'barocss-versions' || log.schema !== 1) return [problem('VERSION_LOG', 'not a version log (format barocss-versions, schema 1)')];
  if (!Array.isArray(log.versions) || !Array.isArray(log.branches) || !log.snapshots || typeof log.snapshots !== 'object') return [problem('VERSION_LOG', 'a version log has versions, branches and snapshots')];
  const ids = new Set<string>(), names = new Set<string>();
  log.versions.forEach((v, i) => {
    const where = `versions.${i}`;
    if (!v || typeof v.id !== 'string' || !Array.isArray(v.parents) || typeof v.snapshot !== 'string' || typeof v.branch !== 'string' || typeof v.at !== 'string') { out.push(problem('VERSION_LOG', 'a version has an id, parents, a snapshot, a branch and a time', where)); return; }
    if (ids.has(v.id)) out.push(problem('VERSION_LOG', `the id ${v.id} is used twice`, where));
    if (v.name !== undefined) { if (names.has(v.name)) out.push(problem('VERSION_NAME', `the name “${v.name}” is used twice`, where)); names.add(v.name); }
    // (Parents are made before their children: a log in the order versions were made has no cycle.)
    for (const p of v.parents) if (!ids.has(p)) out.push(problem('VERSION_LOG', `the parent ${p} is not an earlier version`, where));
    if (v.parents.length > 2 || (i === 0) !== (v.parents.length === 0)) out.push(problem('VERSION_LOG', 'the first version has no parents, every other one or two', where));
    const doc = log.snapshots[v.snapshot];
    if (!doc) out.push(problem('VERSION_LOG', `the snapshot ${v.snapshot} is missing`, where));
    else if (snapshotKeyOf(doc) !== v.snapshot) out.push(problem('VERSION_LOG', `the snapshot ${v.snapshot} does not match its content`, where));
    else if (revisionOf(doc) !== v.revision) out.push(problem('VERSION_LOG', `the revision ${v.revision} is not its document's`, where));
    if (idOf(v) !== v.id) out.push(problem('VERSION_LOG', `the id ${v.id} is not made from the version's content`, where));
    ids.add(v.id);
  });
  const branchNames = new Set<string>();
  log.branches.forEach((b, i) => {
    const where = `branches.${i}`;
    if (!b || typeof b.name !== 'string' || !BRANCH_NAME.test(b.name)) { out.push(problem('BRANCH_NAME', 'a branch has a valid name', where)); return; }
    if (branchNames.has(b.name)) out.push(problem('BRANCH_EXISTS', `the branch “${b.name}” is listed twice`, where));
    branchNames.add(b.name);
    if (!ids.has(b.head)) out.push(problem('VERSION_LOG', `the branch “${b.name}”'s head ${b.head} is not a version`, where));
    if (!ids.has(b.from)) out.push(problem('VERSION_LOG', `the branch “${b.name}” starts from ${b.from}, not a version`, where));
  });
  if (!branchNames.has(log.current)) out.push(problem('BRANCH_UNKNOWN', `the current branch “${log.current}” is not listed`, 'current'));
  return out;
}

// ——— a turn's log (VA-2, DA-9): what an agent's turn carries, and what it brings back

/** At most this many characters of documents go with a turn (the index always goes whole). */
export const TURN_SNAPSHOTS = 4_000_000;
/**
 * The log as a turn carries it: every version and branch (the index), with only the documents the turn's actions need —
 * each branch's head (switch, merge), the version each other branch shares with the current one (merge), then the
 * versions asked for (`wanted`: restore or compare), in that order while they fit in `cap` characters; the current
 * branch's head always. Others are refused in the turn as VERSION_NOT_LOADED and asked for the next.
 */
export function turnLog(log: VersionLog, o: { wanted?: readonly string[]; cap?: number } = {}): { log: VersionLog; omitted: string[] } {
  const head = headOf(log), keys: string[] = [], add = (id: string | null) => { const v = id ? log.versions.find(x => x.id === id || x.name === id) : undefined; if (v && !keys.includes(v.snapshot)) keys.push(v.snapshot); };
  add(head.id);
  for (const b of log.branches) add(b.head);
  for (const b of log.branches) if (b.name !== log.current) add(findBase(log, head.id, b.head));
  for (const id of o.wanted ?? []) add(id);
  const cap = o.cap ?? TURN_SNAPSHOTS, snapshots: Record<string, StudioDoc> = {}, omitted: string[] = [];
  let size = 0;
  keys.forEach((k, i) => {
    const n = JSON.stringify(log.snapshots[k]).length;
    if (i > 0 && size + n > cap) { omitted.push(k); return; }
    size += n; snapshots[k] = log.snapshots[k];
  });
  return { log: { ...log, snapshots }, omitted };
}
/**
 * A turn's log brought back into the full one: the versions it made added (by id: the person's own made meanwhile
 * kept), each branch moved where the turn moved it unless the person moved it elsewhere meanwhile (then the person's
 * stays, and the branch is named in `kept`), the documents it made kept, the current branch the turn's.
 */
export function withTurnLog(full: VersionLog, turn: VersionLog): { log: VersionLog; kept: string[] } {
  const ids = new Set(full.versions.map(v => v.id)), versions = [...full.versions, ...turn.versions.filter(v => !ids.has(v.id))];
  const at = new Map(full.branches.map(b => [b.name, b])), kept: string[] = [], merged = { ...full, versions };
  const branches = [...full.branches.map(b => {
    const t = turn.branches.find(x => x.name === b.name);
    if (!t || t.head === b.head) return b;
    // (The turn's head must have been made from the person's: else both moved the branch.)
    if (ancestorsOf(merged, t.head).has(b.head)) return { ...b, head: t.head };
    kept.push(b.name); return b;
  }), ...turn.branches.filter(t => !at.has(t.name))];
  const snapshots = { ...full.snapshots };
  for (const [k, d] of Object.entries(turn.snapshots)) if (!snapshots[k]) snapshots[k] = d;
  const current = branches.some(b => b.name === turn.current) ? turn.current : full.current;
  return { log: { ...full, versions, branches, current, snapshots }, kept };
}
