// The person's casting rules (O7c): die and sand casting's limits — a family's least wall and draft, its tolerance, the
// section-change ratio — and sand casting's pattern allowances (shrinkage by the pattern's size, machining by the
// dimension's), one row per limit or table, from a file the person supplied (rows rule b), none built in.
// samples/rows/casting-rules.json is an example, taken from the pages each row names, to check against your foundry.
// A process with no rows judges nothing it would read from them: each such rule unknown, and the report says why
// ([CASTING_RULE_ROW]).
import type { StudioDoc } from './doc';
import { CAST_FAMILIES, MATERIALS_DATA, processProfile, type CastFamily, type CastingAllowances, type MachiningClass, type ProcessProfile, type ProcessThreshold, type WebSource } from '../library/materials';
import { isObj } from '../util/guards';

type CastingProcess = 'die-casting' | 'sand-casting';
const CASTING_PROCESSES: readonly CastingProcess[] = ['die-casting', 'sand-casting'];

export type StudioCastingRuleRow =
  | { id: string; process: CastingProcess; key: string; value: number; unit: string; description: string; source: string; page?: WebSource }
  | { id: string; process: CastingProcess; allowance: 'shrink'; family: CastFamily; label: string; bands: { upToFt: number | null; inPerFt: number }[]; page: WebSource }
  | { id: string; process: CastingProcess; allowance: 'machining'; class: MachiningClass; label: string; bands: { upToIn: number; in: number }[]; page: WebSource };

/** Whether the document has rows for a casting process. */
export const hasCastingRules = (doc: Pick<StudioDoc, 'castingRules'>, process: string) => !!doc.castingRules?.rows.some(r => r.process === process);
/** Where rules are needed and the process has none loaded. */
export const noCastingRules = (process: string) => `[CASTING_RULE_ROW] no ${process} rules loaded — load your casting rules (samples/rows/casting-rules.json is an example)`;

const pageOk = (w: unknown): w is WebSource => isObj(w) && typeof w.url === 'string' && /^https:\/\/[^\s]+$/.test(w.url) && typeof w.read === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.read) && typeof w.label === 'string' && w.label.trim().length > 0 && (w.note === undefined || typeof w.note === 'string');
const MACHINING: readonly string[] = ['iron', 'steel', 'nonferrous'];
const FIELDS = {
  limit: new Set(['id', 'process', 'key', 'value', 'unit', 'description', 'source', 'page']),
  shrink: new Set(['id', 'process', 'allowance', 'family', 'label', 'bands', 'page']),
  machining: new Set(['id', 'process', 'allowance', 'class', 'label', 'bands', 'page']),
};

/** What is wrong with a casting rule row, or null. */
export function castingRuleRowProblem(r: unknown): string | null {
  if (!isObj(r)) return 'a casting rule row is an object { id, process, key, value, unit, description, source } or a pattern allowance table { id, process, allowance: shrink | machining, … }';
  if (typeof r.id !== 'string' || !r.id.trim()) return 'a casting rule row needs an id';
  const at = `casting rule row ${r.id}`;
  if (!CASTING_PROCESSES.includes(r.process as CastingProcess)) return `${at}: process is one of ${CASTING_PROCESSES.join(', ')}`;
  const shape = r.allowance === undefined ? 'limit' : r.allowance === 'shrink' || r.allowance === 'machining' ? r.allowance : null;
  if (!shape) return `${at}: allowance is shrink or machining (or left out, for a limit)`;
  for (const k of Object.keys(r)) if (!FIELDS[shape].has(k)) return `${at}: unknown field ${k}`;
  if (shape === 'limit') {
    if (typeof r.key !== 'string' || !/^[A-Za-z]\w*$/.test(r.key)) return `${at}: key names the limit (as zincWallMinMM)`;
    if (typeof r.value !== 'number' || !Number.isFinite(r.value)) return `${at}: value is a number`;
    for (const k of ['unit', 'description', 'source'] as const) if (typeof r[k] !== 'string' || !(r[k] as string).trim()) return `${at}: ${k} is text`;
    if (r.page !== undefined && !pageOk(r.page)) return `${at}: page is { url (https), read (YYYY-MM-DD), label, note? }`;
    return null;
  }
  if (typeof r.label !== 'string' || !r.label.trim()) return `${at}: label is text`;
  if (!pageOk(r.page) || !(r.page.note ?? '').trim()) return `${at}: an allowance table names its page (url, read, label) and, in its note, how its units are read`;
  if (!Array.isArray(r.bands) || !r.bands.length || !r.bands.every(isObj)) return `${at}: bands is a list`;
  if (shape === 'shrink') {
    if (!CAST_FAMILIES.includes(r.family as CastFamily)) return `${at}: family is one of ${CAST_FAMILIES.join(', ')}`;
    const bands = r.bands as Record<string, unknown>[], ends = bands.map(b => b.upToFt);
    if (ends.at(-1) !== null || ends.slice(0, -1).some((e, k) => typeof e !== 'number' || !(e > 0) || (k > 0 && !(e > (ends[k - 1] as number)))) || bands.some(b => typeof b.inPerFt !== 'number' || !(b.inPerFt > 0) || Object.keys(b).some(x => x !== 'upToFt' && x !== 'inPerFt'))) return `${at}: shrink bands rise by upToFt (the last null: over it), each inPerFt above 0`;
    return null;
  }
  if (!MACHINING.includes(r.class as string)) return `${at}: class is one of ${MACHINING.join(', ')}`;
  const bands = r.bands as Record<string, unknown>[];
  if (bands.some((b, k) => typeof b.in !== 'number' || !(b.in > 0) || typeof b.upToIn !== 'number' || !(b.upToIn > (k ? bands[k - 1].upToIn as number : 0)) || Object.keys(b).some(x => x !== 'upToIn' && x !== 'in'))) return `${at}: machining bands rise by upToIn, each in above 0`;
  return null;
}
/** Rows added (each checked; one with an id held already replaces it). */
export function editCastingRuleRows(doc: StudioDoc, add: readonly unknown[]): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = castingRuleRowProblem(r); if (p) return { error: p }; }
  const was = doc.castingRules?.rows ?? [], incoming = add as StudioCastingRuleRow[], ids = new Set(incoming.map(r => r.id));
  return { doc: { ...doc, castingRules: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}

// (A limit's source is kept as the text it cites; the studio's reports name a source by its id, so a text that is one of the
// material data's sources is that id again — the sample's are.)
const SOURCE_ID = new Map(Object.entries(MATERIALS_DATA.sources).map(([id, text]) => [text, id]));
const memo = new WeakMap<object, Map<string, ProcessProfile>>();
/**
 * A casting process as the document's rows give it: its limits and its allowance tables (none loaded: none — each rule
 * reading them unknown). Any other process is the material data's, as it is.
 */
export function castingProfileOf(doc: Pick<StudioDoc, 'castingRules'>, id: string | undefined): ProcessProfile | undefined {
  const base = processProfile(id);
  if (!base || !CASTING_PROCESSES.includes(base.id as CastingProcess)) return base;
  const rows = doc.castingRules?.rows ?? [], key = rows as object;
  let byProcess = memo.get(key);
  if (!byProcess) { byProcess = new Map(); memo.set(key, byProcess); }
  const have = byProcess.get(base.id); if (have) return have;
  const mine = rows.filter(r => r.process === base.id), thresholds: Record<string, ProcessThreshold> = {};
  const shrink: CastingAllowances['shrink'][number][] = [], machining: CastingAllowances['machining'][number][] = [];
  for (const r of mine) {
    if (!('allowance' in r)) thresholds[r.key] = { value: r.value, unit: r.unit, source: SOURCE_ID.get(r.source) ?? r.source, description: r.description, ...(r.page ? { page: r.page } : {}) };
    else if (r.allowance === 'shrink') shrink.push({ family: r.family, label: r.label, bands: r.bands, page: r.page });
    else machining.push({ class: r.class, label: r.label, bands: r.bands, page: r.page });
  }
  const out: ProcessProfile = { ...base, thresholds, ...(shrink.length || machining.length ? { allowances: { shrink, machining } } : {}) };
  if (!shrink.length && !machining.length) delete (out as { allowances?: unknown }).allowances;
  byProcess.set(base.id, out);
  return out;
}
