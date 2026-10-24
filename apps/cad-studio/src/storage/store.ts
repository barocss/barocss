// CG6 S1 (DA-4): where the studio keeps a project's files — one interface for a folder on disk, a project in this
// browser and (later) a cloud backend. Paths are the project's own: relative, '/'-separated. Every file carries a tag
// (a version token: a folder's size and time, a cloud's ETag), and a write may say which tag it expects there, so a file
// changed meanwhile — by another tab, another program, later another person — is refused, never written over.
import { BarocssError } from '@barocss/cad/api';

export type StorageCode = 'STORAGE_PATH' | 'STORAGE_CHANGED' | 'STORAGE_DENIED' | 'STORAGE_MISSING' | 'STORAGE_UNAVAILABLE';
export const refusal = (code: StorageCode, message: string): BarocssError => new BarocssError(code, `[${code}] ${message}`);

export interface StoreEntry { path: string; size: number; tag: string }
export interface StoreFile { bytes: Uint8Array; tag: string }
export interface ProjectStore {
  /** Where it lives: a folder the person picked, the browser's own storage, memory (tests) or a cloud backend later. */
  readonly kind: 'folder' | 'browser' | 'memory' | 'cloud';
  /** The project's name as shown (the folder's). */
  readonly name: string;
  /** Every file under `dir` (all of the project when absent), in path order. */
  list(dir?: string): Promise<StoreEntry[]>;
  /** A file and its tag, or null when there is none. */
  read(path: string): Promise<StoreFile | null>;
  /**
   * Writes a file (its folders made). `expect`: the tag the caller read there, or null for "no file yet"; anything else
   * there is refused, STORAGE_CHANGED. Absent: written whatever is there.
   */
  write(path: string, bytes: Uint8Array, o?: { expect?: string | null }): Promise<{ tag: string }>;
  /** Removes a file; none there is not an error. */
  remove(path: string): Promise<void>;
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
/**
 * A project path checked: relative, '/'-separated, no empty, '.' or '..' part, no character a common file system
 * refuses, at most 512 characters. Refused, STORAGE_PATH.
 */
export function checkPath(path: string): string[] {
  const parts = typeof path === 'string' ? path.split('/') : [];
  const bad = typeof path !== 'string' || !path || path.length > 512 || path.startsWith('/')
    || parts.some(p => !p || p === '.' || p === '..' || /[\\:*?"<>|]/.test(p) || [...p].some(c => c.charCodeAt(0) < 32) || RESERVED.test(p) || /[. ]$/.test(p));
  if (bad) throw refusal('STORAGE_PATH', `“${String(path)}” is not a path in the project (relative, '/' between folders, no '..')`);
  return parts;
}
/** Whether a path lies under a folder (the folder itself excluded). */
export const isUnder = (path: string, dir?: string) => !dir || path.startsWith(`${dir.replace(/\/$/, '')}/`);
