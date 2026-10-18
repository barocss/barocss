// A recovery copy of unsaved work in this browser: written a moment after each change while the
// document is unsaved, cleared when it is saved or replaced, offered back when the studio opens.
import type { ModelNode, StudioDoc } from '../engine/doc';

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

/**
 * What a browser's local storage holds for a site, about (5 MiB of UTF-16 code units in Chromium and Firefox):
 * a copy longer than this is not tried — it would only fail after being written out.
 */
export const RECOVERY_LIMIT = 5 * 2 ** 20;
/**
 * Each node's JSON, kept per node object (PERF3 B13): an edit writes out only the nodes it made, not again a
 * mesh's or an imported STEP file's megabytes. A node too long for the limit keeps only its length.
 */
const nodeJson = new WeakMap<ModelNode, string | number>();
const NODES = '\u0000nodes\u0000', NODES_JSON = JSON.stringify(NODES);
/** The recovery copy as text — the same text as JSON.stringify({ fileName, savedAt, doc }) — or null when longer than `limit`. */
export function recoveryText(fileName: string, savedAt: number, doc: StudioDoc, limit = RECOVERY_LIMIT): string | null {
  const parts: string[] = [];
  let length = 0;
  for (const n of doc.nodes) {
    let j = nodeJson.get(n);
    if (j === undefined) { const s = JSON.stringify(n) ?? 'null'; j = s.length > limit ? s.length : s; nodeJson.set(n, j); }
    if (typeof j === 'number') return null;
    length += j.length + 1; if (length > limit) return null;
    parts.push(j);
  }
  const shell = JSON.stringify({ fileName, savedAt, doc: { ...doc, nodes: NODES } }), at = shell.indexOf(NODES_JSON);
  if (at < 0 || length + shell.length > limit) return null;
  return `${shell.slice(0, at)}[${parts.join(',')}]${shell.slice(at + NODES_JSON.length)}`;
}
/** False when the browser keeps nothing (private mode, or too large a document: then not even tried). */
export function writeRecovery(fileName: string, doc: StudioDoc): boolean {
  const text = recoveryText(fileName, Date.now(), doc);
  // (As when the browser refuses it: the copy there, if any, is left as it was.)
  if (text === null) return false;
  try { localStorage.setItem(KEY, text); return true; } catch { return false; }
}
export function clearRecovery(): void { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }
