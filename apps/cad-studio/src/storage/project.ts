// CG6 S1 (DA-4): a project's files on a store (storage/store.ts). Plain files a person can read and copy:
//   <part>.bcad                        each document, exactly as Save writes it (engine/container.ts)
//   .barocss/versions/<part>.json      its version log without the documents (versions/log.ts)
//   .barocss/snapshots/<key>.bcad      each version's document by its content key: written once, never changed
//   .barocss/autosave/<part>.bcad      the work since the last save, a moment after each change
// A version log is written as recovery is (O9): its documents first, then the log naming them, so a log never names a
// document that was not kept.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { checkVersions, type VersionLog } from '@barocss/cad-model/versions/log';
import { refusal, type ProjectStore, type StoreEntry } from './store';

export const META = '.barocss';
export const versionsPath = (part: string) => `${META}/versions/${part}.json`;
export const snapshotPath = (key: string) => `${META}/snapshots/${key}.bcad`;
export const autosavePath = (part: string) => `${META}/autosave/${part}`;
const isPart = (path: string) => /\.bcad$/i.test(path) && !path.startsWith(`${META}/`);

/** The project's documents: every .bcad outside .barocss, in path order. */
export async function partsOf(store: ProjectStore): Promise<StoreEntry[]> {
  return (await store.list()).filter(e => isPart(e.path));
}

export type ReadPart = { doc: StudioDoc; notes: string[]; tag: string } | { error: string };
async function readDoc(store: ProjectStore, path: string): Promise<ReadPart | null> {
  const f = await store.read(path);
  if (!f) return null;
  const r = await readStudioFile(f.bytes);
  return 'error' in r ? r : { doc: r.doc, notes: r.notes, tag: f.tag };
}
/** A document of the project, checked as Open checks a file. Refused, STORAGE_MISSING, when there is none. */
export async function readPart(store: ProjectStore, path: string): Promise<ReadPart> {
  const r = await readDoc(store, path);
  if (!r) throw refusal('STORAGE_MISSING', `the project has no ${path}`);
  return r;
}
/** A document written as Save writes it; `expect`: the tag it was read with (null: a new file), else written over. */
export function writePart(store: ProjectStore, path: string, doc: StudioDoc, o: { expect?: string | null } = {}): Promise<{ tag: string }> {
  if (!isPart(path)) throw refusal('STORAGE_PATH', `a document's path ends in .bcad, outside ${META}/ (got ${path})`);
  return store.write(path, encodeStudioFile(doc), o);
}

/** The log's file: everything but the documents, which are files of their own. */
type LogFile = Omit<VersionLog, 'snapshots'>;
/** A document's version log, its documents written first (those not kept yet), then the log; `expect` as writePart's. */
export async function writeVersions(store: ProjectStore, part: string, log: VersionLog, o: { expect?: string | null } = {}): Promise<{ tag: string }> {
  const kept = new Set((await store.list(`${META}/snapshots`)).map(e => e.path));
  for (const [key, doc] of Object.entries(log.snapshots)) if (!kept.has(snapshotPath(key))) await store.write(snapshotPath(key), encodeStudioFile(doc));
  const file: LogFile = { format: log.format, schema: log.schema, versions: log.versions, branches: log.branches, current: log.current };
  return store.write(versionsPath(part), new TextEncoder().encode(JSON.stringify(file, null, 1)), o);
}
/** A document's version log with its documents, checked (versions/log.ts); null when it has none yet. */
export async function readVersions(store: ProjectStore, part: string): Promise<{ log: VersionLog; tag: string } | { error: string } | null> {
  const f = await store.read(versionsPath(part));
  if (!f) return null;
  let file: LogFile;
  try { file = JSON.parse(new TextDecoder().decode(f.bytes)) as LogFile; } catch { return { error: `${versionsPath(part)} is not JSON` }; }
  const snapshots: Record<string, StudioDoc> = {};
  for (const key of new Set((Array.isArray(file?.versions) ? file.versions : []).map(v => v?.snapshot).filter((k): k is string => typeof k === 'string'))) {
    const r = await readDoc(store, snapshotPath(key));
    if (r && 'doc' in r) snapshots[key] = r.doc;
    else if (r) return { error: `${snapshotPath(key)}: ${r.error}` };
  }
  const log = { ...file, snapshots } as VersionLog, problems = checkVersions(log);
  return problems.length ? { error: `${versionsPath(part)}: ${problems.slice(0, 3).map(p => `${p.message}${p.where ? ` (${p.where})` : ''}`).join('; ')}` } : { log, tag: f.tag };
}

/** The work since the last save, kept in the project. */
export const writeAutosave = (store: ProjectStore, part: string, doc: StudioDoc) => store.write(autosavePath(part), encodeStudioFile(doc));
/** The autosaved work, when there is some and it differs from the saved document. */
export async function readAutosave(store: ProjectStore, part: string): Promise<ReadPart | null> {
  const r = await readDoc(store, autosavePath(part));
  if (!r || 'error' in r) return r;
  const saved = await store.read(part);
  // (Saved since: the same bytes as the document are nothing to offer.)
  if (saved && sameBytes(saved.bytes, encodeStudioFile(r.doc))) return null;
  return r;
}
export const clearAutosave = (store: ProjectStore, part: string) => store.remove(autosavePath(part));
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
