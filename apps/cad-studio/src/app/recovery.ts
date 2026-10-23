// A recovery copy of unsaved work in this browser: written a moment after each change while the
// document is unsaved, cleared when it is saved or replaced, offered back when the studio opens.
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';

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
/**
 * Writes the recovery copy: 'ok'; 'too-large' when the document is past the limit (not even tried); 'refused' when the
 * browser keeps nothing (private mode, storage full). When it is not written, the copy there before is removed: an older
 * version of the work must not be offered back after a reload as if it were the latest.
 */
export function writeRecovery(fileName: string, doc: StudioDoc): 'ok' | 'too-large' | 'refused' {
  const text = recoveryText(fileName, Date.now(), doc);
  if (text === null) { clearRecovery(); return 'too-large'; }
  try { localStorage.setItem(KEY, text); return 'ok'; } catch { clearRecovery(); return 'refused'; }
}
/**
 * O9 (REVIEW-A1): the recovery copy kept as a whole — its mesh blobs stored first, then the copy that names them — so a
 * copy is never offered back whose meshes were not kept. Blobs refused: no copy, and the one there before removed, as
 * when the copy itself is refused. Only the newest call writes: one overtaken while its blobs were stored writes nothing,
 * so an older copy never lands over a newer one, nor does one whose caller stopped wanting it (`wanted`: the work saved
 * meanwhile). `saveBlobs`: engine/blobs' saveRecoveryBlobs (true when kept).
 */
let keeping = 0;
export async function keepRecovery(fileName: string, doc: StudioDoc, saveBlobs: (doc: StudioDoc) => Promise<boolean>, wanted: () => boolean = () => true): Promise<'ok' | 'too-large' | 'refused' | 'overtaken'> {
  const call = ++keeping, text = recoveryText(fileName, Date.now(), doc);
  if (text === null) { clearRecovery(); return 'too-large'; }
  const kept = await saveBlobs(doc).catch(() => false);
  if (call !== keeping || !wanted()) return 'overtaken';
  if (!kept) { clearRecovery(); return 'refused'; }
  try { localStorage.setItem(KEY, text); return 'ok'; } catch { clearRecovery(); return 'refused'; }
}
export function clearRecovery(): void { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }

/**
 * The copy offered when the studio starts, set aside under its own key until the person answers it: the session's own
 * copies (`writeRecovery`) then never write over it, and Discard removes it, not the copy of the work since. Of the last
 * session's copy and one offered before and never answered, the newer is offered and the other dropped.
 */
const OFFERED = 'studio.recovery.offered';
const parse = (raw: string | null): Recovery | null => {
  if (!raw) return null;
  try { const r = JSON.parse(raw) as Recovery; return r && typeof r.fileName === 'string' && typeof r.savedAt === 'number' && r.doc?.format === 'barocss-cad-model' && Array.isArray(r.doc.nodes) ? r : null; } catch { return null; }
};
export function offerRecovery(): Recovery | null {
  try {
    const now = localStorage.getItem(KEY), before = localStorage.getItem(OFFERED), a = parse(now), b = parse(before);
    const take = a && (!b || a.savedAt >= b.savedAt) ? now : b ? before : null;
    localStorage.removeItem(KEY);
    if (take) localStorage.setItem(OFFERED, take); else localStorage.removeItem(OFFERED);
    return parse(take);
  } catch { return readRecovery(); }
}
/** The offered copy answered (restored or discarded): no longer set aside. */
export function settleRecovery(): void { try { localStorage.removeItem(OFFERED); } catch { /* storage unavailable */ } }
