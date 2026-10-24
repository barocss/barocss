// CG6 S1 (DA-4): opening a project in the browser. A folder on disk where the browser offers the folder picker
// (showDirectoryPicker); otherwise a project in the browser's own private file system, which every current browser has.
// The last folder's handle is kept in IndexedDB, so Reopen finds it after a reload; the browser asks the person again
// for access (on a click) before it is read.
import { handleStore, type DirHandle } from './handleStore';
import type { ProjectStore } from './store';

type Permission = 'granted' | 'denied' | 'prompt';
interface PermissionHandle { queryPermission?(o: { mode: 'readwrite' }): Promise<Permission>; requestPermission?(o: { mode: 'readwrite' }): Promise<Permission> }
type PickerWindow = { showDirectoryPicker?(o?: { mode?: 'readwrite'; id?: string }): Promise<DirHandle> };
type StorageWithDir = { getDirectory?(): Promise<DirHandle>; persist?(): Promise<boolean> };

/** Whether the browser lets the person pick a folder on disk. */
export const canPickFolder = () => typeof window !== 'undefined' && typeof (window as unknown as PickerWindow).showDirectoryPicker === 'function';
/** Whether the browser keeps project files of its own (the origin-private file system). */
export const canKeepInBrowser = () => typeof navigator !== 'undefined' && typeof (navigator.storage as unknown as StorageWithDir | undefined)?.getDirectory === 'function';

/** A folder the person picks (null when they cancel); kept as the one Reopen offers. */
export async function pickFolder(): Promise<ProjectStore | null> {
  let dir: DirHandle;
  try { dir = await (window as unknown as PickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'barocss-project' }); }
  catch (e) { if ((e as { name?: string })?.name === 'AbortError') return null; throw e; }
  await remember(dir);
  return handleStore(dir, 'folder');
}

const PROJECTS = 'projects';
async function browserRoot(): Promise<DirHandle> {
  const storage = navigator.storage as unknown as StorageWithDir;
  // (Asked once, best effort: kept data is then not dropped when the browser runs short of space.)
  void storage.persist?.().catch(() => false);
  return (await storage.getDirectory!()).getDirectoryHandle(PROJECTS, { create: true });
}
/** A project kept in this browser, by name (made when new). */
export async function browserProject(name: string): Promise<ProjectStore> {
  const dir = await (await browserRoot()).getDirectoryHandle(name, { create: true });
  return handleStore(dir, 'browser');
}
/** The projects kept in this browser, by name. */
export async function browserProjects(): Promise<string[]> {
  const out: string[] = [];
  for await (const [name, h] of (await browserRoot()).entries()) if (h.kind === 'directory') out.push(name);
  return out.sort();
}

// ——— the last folder, for Reopen
const DB = 'studio.projects', STORE = 'handles', RECENT = 'recent';
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
async function remember(dir: DirHandle): Promise<void> {
  const db = await openDb(); if (!db) return;
  try { await new Promise<void>(resolve => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(dir, RECENT); t.oncomplete = t.onerror = t.onabort = () => resolve(); }); }
  catch { /* a handle the browser cannot keep: Reopen then not offered */ } finally { db.close(); }
}
/** The last folder picked, when the browser kept its handle (its name, to offer Reopen). */
export async function recentFolder(): Promise<DirHandle | null> {
  const db = await openDb(); if (!db) return null;
  try { return await new Promise<DirHandle | null>(resolve => { const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECENT); r.onsuccess = () => resolve((r.result as DirHandle) ?? null); r.onerror = () => resolve(null); }); }
  catch { return null; } finally { db.close(); }
}
/** The last folder reopened (call on a click: the browser may ask the person for access again); null when refused. */
export async function reopenFolder(dir: DirHandle): Promise<ProjectStore | null> {
  const h = dir as unknown as PermissionHandle, mode = { mode: 'readwrite' as const };
  let state = await h.queryPermission?.(mode) ?? 'granted';
  if (state === 'prompt') state = await h.requestPermission?.(mode) ?? 'denied';
  return state === 'granted' ? handleStore(dir, 'folder') : null;
}
