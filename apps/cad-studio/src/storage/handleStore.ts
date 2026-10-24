// CG6 S1 (DA-4): a project in a directory handle of the File System Access API — a folder the person picked
// (showDirectoryPicker, Chromium) or, where that is missing, the browser's own private file system
// (navigator.storage.getDirectory(), every current browser). One code for both: they hand out the same kind of handle.
// A file's tag is its size and time; a write goes through createWritable, which the browser commits whole on close.
import { checkPath, isUnder, refusal, type ProjectStore, type StoreEntry } from './store';

/** The parts of FileSystemDirectoryHandle this store uses (so a test can hand it a stand-in). */
export interface DirHandle {
  readonly kind: 'directory'; readonly name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterable<[string, DirHandle | FileHandle]>;
}
export interface FileHandle {
  readonly kind: 'file'; readonly name: string;
  getFile(): Promise<{ size: number; lastModified: number; arrayBuffer(): Promise<ArrayBuffer> }>;
  createWritable?(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}

const tagOf = (f: { size: number; lastModified: number }) => `${f.size}-${f.lastModified}`;
const nameOf = (e: unknown) => (e as { name?: string })?.name;
/** A browser's failure as the store's refusal: not found → null; not allowed → STORAGE_DENIED. */
function denied(e: unknown, what: string): never {
  if (nameOf(e) === 'NotAllowedError' || nameOf(e) === 'SecurityError') throw refusal('STORAGE_DENIED', `the browser does not allow ${what}: open the folder again to grant access`);
  throw e;
}
const missing = (e: unknown) => nameOf(e) === 'NotFoundError' || nameOf(e) === 'TypeMismatchError';

/** The folder holding a path's file, made when `create`; null when a folder on the way is missing. */
async function folderOf(root: DirHandle, parts: readonly string[], create: boolean): Promise<DirHandle | null> {
  let dir = root;
  for (const p of parts.slice(0, -1)) {
    try { dir = await dir.getDirectoryHandle(p, { create }); } catch (e) { if (missing(e)) return null; denied(e, `opening ${p}`); }
  }
  return dir;
}
async function fileOf(root: DirHandle, path: string): Promise<FileHandle | null> {
  const parts = checkPath(path), dir = await folderOf(root, parts, false);
  if (!dir) return null;
  try { return await dir.getFileHandle(parts[parts.length - 1]); } catch (e) { if (missing(e)) return null; return denied(e, `reading ${path}`); }
}
async function walk(dir: DirHandle, prefix: string, out: StoreEntry[]): Promise<void> {
  for await (const [name, h] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (h.kind === 'directory') await walk(h, path, out);
    // (A file the browser is still writing — its swap file, `name.crswap` — is not one of the project's.)
    else if (!name.endsWith('.crswap')) { const f = await h.getFile(); out.push({ path, size: f.size, tag: tagOf(f) }); }
  }
}

export function handleStore(root: DirHandle, kind: 'folder' | 'browser'): ProjectStore {
  return {
    kind, name: root.name || 'Project',
    async list(dir) {
      const out: StoreEntry[] = [];
      try { await walk(root, '', out); } catch (e) { denied(e, 'reading the project'); }
      return out.filter(e => isUnder(e.path, dir)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    },
    async read(path) {
      const h = await fileOf(root, path); if (!h) return null;
      try { const f = await h.getFile(); return { bytes: new Uint8Array(await f.arrayBuffer()), tag: tagOf(f) }; }
      catch (e) { if (missing(e)) return null; return denied(e, `reading ${path}`); }
    },
    async write(path, bytes, o = {}) {
      const parts = checkPath(path);
      if (o.expect !== undefined) {
        const h = await fileOf(root, path), had = h ? tagOf(await h.getFile()) : null;
        if (had !== o.expect) throw refusal('STORAGE_CHANGED', `${path} changed since it was read`);
      }
      const dir = await folderOf(root, parts, true);
      let h: FileHandle;
      try { h = await dir!.getFileHandle(parts[parts.length - 1], { create: true }); } catch (e) { return denied(e, `writing ${path}`); }
      if (!h.createWritable) throw refusal('STORAGE_UNAVAILABLE', 'this browser cannot write files here: export the project instead');
      try {
        const w = await h.createWritable();
        try { await w.write(bytes); await w.close(); } catch (e) { await w.abort?.().catch(() => {}); throw e; }
      } catch (e) { return denied(e, `writing ${path}`); }
      return { tag: tagOf(await h.getFile()) };
    },
    async remove(path) {
      const parts = checkPath(path), dir = await folderOf(root, parts, false);
      if (!dir) return;
      try { await dir.removeEntry(parts[parts.length - 1]); } catch (e) { if (!missing(e)) denied(e, `removing ${path}`); }
    },
  };
}
