// CG6 S1 (DA-4): a project held in memory — for tests, and where neither a folder nor the browser's storage is offered
// (Save then downloads, as before).
import { checkPath, isUnder, refusal, type ProjectStore, type StoreEntry } from './store';

export function memoryStore(name = 'Project'): ProjectStore & { files: Map<string, { bytes: Uint8Array; tag: string }> } {
  const files = new Map<string, { bytes: Uint8Array; tag: string }>();
  let serial = 0;
  return {
    kind: 'memory', name, files,
    async list(dir) {
      const out: StoreEntry[] = [];
      for (const [path, f] of files) if (isUnder(path, dir)) out.push({ path, size: f.bytes.length, tag: f.tag });
      return out.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    },
    async read(path) { checkPath(path); const f = files.get(path); return f ? { bytes: f.bytes.slice(), tag: f.tag } : null; },
    async write(path, bytes, o = {}) {
      checkPath(path);
      const had = files.get(path)?.tag ?? null;
      if (o.expect !== undefined && o.expect !== had) throw refusal('STORAGE_CHANGED', `${path} changed since it was read`);
      const tag = `m${++serial}`;
      files.set(path, { bytes: bytes.slice(), tag });
      return { tag };
    },
    async remove(path) { checkPath(path); files.delete(path); },
  };
}
