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
  // Serialize mutations of the same path in this adapter.
  const mutations = new Map<string, Promise<void>>();
  const mutate = async <T>(path: string, operation: () => Promise<T>): Promise<T> => {
    const previous = mutations.get(path);
    let release!: () => void;
    const done = new Promise<void>(resolve => { release = resolve; });
    mutations.set(path, done);
    if (previous) await previous;
    try { return await operation(); }
    finally {
      if (mutations.get(path) === done) mutations.delete(path);
      release();
    }
  };
  const checkTag = async (path: string, expect: string | null | undefined) => {
    if (expect === undefined) return;
    const file = await fileOf(root, path);
    if ((file ? tagOf(await file.getFile()) : null) !== expect) throw refusal('STORAGE_CHANGED', `${path} changed since it was read`);
  };
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
      return mutate(path, async () => {
        await checkTag(path, o.expect);
        const dir = (await folderOf(root, parts, true))!;
        const name = parts[parts.length - 1];
        let h: FileHandle;
        try { h = await dir.getFileHandle(name, { create: true }); } catch (e) { return denied(e, `writing ${path}`); }
        // A refused first write can leave the empty file created by getFileHandle.
        const placeholder = o.expect === null ? await h.getFile() : null;
        try {
          if (!h.createWritable) throw refusal('STORAGE_UNAVAILABLE', 'this browser cannot write files here: export the project instead');
          const w = await h.createWritable();
          try { await w.write(bytes); await w.close(); } catch (e) { await w.abort?.().catch(() => {}); throw e; }
        } catch (e) {
          if (placeholder?.size === 0) {
            try {
              const current = await (await dir.getFileHandle(name)).getFile();
              if (tagOf(current) === tagOf(placeholder)) await dir.removeEntry(name);
            } catch { /* Report the original write failure. */ }
          }
          return denied(e, `writing ${path}`);
        }
        // Read our commit's tag before allowing any later same-path writer to change it.
        return { tag: tagOf(await h.getFile()) };
      });
    },
    async remove(path, { expect } = {}) {
      const parts = checkPath(path);
      await mutate(path, async () => {
        await checkTag(path, expect);
        const dir = await folderOf(root, parts, false);
        if (!dir) return;
        try { await dir.removeEntry(parts[parts.length - 1]); } catch (e) { if (!missing(e)) denied(e, `removing ${path}`); }
      });
    },
  };
}
