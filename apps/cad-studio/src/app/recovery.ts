// A recovery copy of unsaved work in this browser: written a moment after each change while the
// document is unsaved, cleared when it is saved or replaced, offered back when the studio opens.
import type { StudioDoc } from '../engine/doc';

const KEY = 'studio.recovery';
export interface Recovery { fileName: string; savedAt: number; doc: StudioDoc }

export function readRecovery(): Recovery | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Recovery;
    return r && typeof r.fileName === 'string' && typeof r.savedAt === 'number' && r.doc?.format === 'barocss-cad-model' && Array.isArray(r.doc.nodes) ? r : null;
  } catch { return null; }
}
/** False when the browser keeps nothing (private mode, or too large a document). */
export function writeRecovery(fileName: string, doc: StudioDoc): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ fileName, savedAt: Date.now(), doc })); return true; } catch { return false; }
}
export function clearRecovery(): void { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }
