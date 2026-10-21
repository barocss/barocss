// The recovery copy's blobs in this browser's IndexedDB (PKG-g2, O99): the model asks for a BlobStore and the app
// hands it this one — the only place IndexedDB is reached for them. Each call opens the database and closes it; storage
// that is missing or refused (private mode, a blocked origin, quota) keeps nothing and finds nothing.
import type { BlobArray, BlobStore, BlobType } from '@barocss/cad-model/engine/blobs';

const DB = 'studio.blobs', STORE = 'blobs';
function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
const done = (t: IDBTransaction) => new Promise<boolean>(resolve => { t.oncomplete = () => resolve(true); t.onerror = () => resolve(false); t.onabort = () => resolve(false); });
function keysOf(db: IDBDatabase): Promise<Set<string>> {
  return new Promise(resolve => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    r.onsuccess = () => resolve(new Set(r.result.map(String))); r.onerror = () => resolve(new Set());
  });
}
/** The recovery blobs' IndexedDB store. */
export const indexedDbBlobStore = (): BlobStore => ({
  async keys() { const db = await openDb(); if (!db) return new Set(); try { return await keysOf(db); } finally { db.close(); } },
  async get(hashes) {
    const out = new Map<string, { type: BlobType; data: BlobArray }>(), db = await openDb(); if (!db) return out;
    try {
      const s = db.transaction(STORE, 'readonly').objectStore(STORE);
      await Promise.all(hashes.map(h => new Promise<void>(resolve => {
        const r = s.get(h);
        r.onsuccess = () => { const v = r.result as { type: BlobType; data: BlobArray } | undefined; if (v) out.set(h, v); resolve(); };
        r.onerror = () => resolve();
      })));
      return out;
    } finally { db.close(); }
  },
  async put(entries) {
    const db = await openDb(); if (!db) return false;
    try { const t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE); for (const e of entries) s.put({ type: e.type, data: e.data }, e.hash); return await done(t); }
    catch { return false; } finally { db.close(); }
  },
  async delete(hashes) {
    const db = await openDb(); if (!db) return;
    try { const t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE); for (const h of hashes) s.delete(h); await done(t); }
    catch { /* storage unavailable */ } finally { db.close(); }
  },
});
