// A7's revisions (moved here from team/team.ts unchanged, FRf2 O125): the canonical JSON of a document's revision
// fields and its 64-bit FNV-1a, for staleness — free of imports so the model (frames/, a frame following a placed
// part's sketch) pins a part's revision without the team's runner.
import type { StudioDoc } from '../engine/doc';

/** The canonical JSON of a value: object keys sorted, so equal documents give equal text. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}
/** What a revision covers: the model and the contracts a patch may depend on. */
const REVISION_FIELDS = ['nodes', 'parameters', 'bodies', 'requirements', 'brief', 'references', 'process', 'printer', 'drafts', 'interfaces', 'instances'] as const;
/** The canonical JSON of what a revision covers: equal exactly when the states a patch depends on are equal. */
/** The fields a revision reads, as a value. */
export const revisionContent = (doc: StudioDoc) => Object.fromEntries(REVISION_FIELDS.map(k => [k, (doc as unknown as Record<string, unknown>)[k]]));
export const canonicalOf = (doc: StudioDoc) => canonical(revisionContent(doc));
/**
 * The document's revision: a 64-bit FNV-1a (two 32-bit lanes) of its canonical JSON, 16 hex digits — **for staleness,
 * not integrity**: equal hashes are confirmed by comparing the canonical JSON before a patch is applied (`integrate`'s
 * `bases`), so a collision cannot apply a patch to another state.
 */
export function revisionOf(doc: StudioDoc): string {
  const s = canonicalOf(doc);
  let h1 = 0x811c9dc5, h2 = 0x050c5d1f;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0; h2 ^= c; h2 = Math.imul(h2, 0x01000193) >>> 0; h2 = (h2 ^ (h1 >>> 7)) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
