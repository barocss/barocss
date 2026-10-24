// Standards data with provenance (A6.5, O29): every value a table derived from a standard holds has a source, and every
// source a licence. What the studio uses: the standards' nominal values as facts (a number is not the standard's text;
// no table's layout, prose or notes are copied), values written for BaroCSS, values derived by a stated rule, and
// estimates said so. A GPL, share-alike, non-commercial or unknown licence is refused for a table: such data is not
// mixed in. Prompts and tool descriptions name standards only by their numbers (a test holds them to an allowlist).
// A legal review before release is the owner's step (README §0), not done here.
import { FASTENER_KINDS } from '../app/fasteners';
import type { StudioDoc } from '../engine/doc';
import { GENERAL_TOLERANCE, POSITION_ESTIMATE_MM } from '../drawing/tolerance';
import { MATERIALS_DATA } from '../library/materials';
import { refusal } from '../engine/refusal';

export type Licence = 'facts' | 'own' | 'CC0-1.0' | 'CC-BY-4.0' | 'public-domain' | 'MIT' | (string & {});
/** The licences a table's data may carry: facts (values as read), our own, and permissive ones. */
export const ALLOWED_LICENCES: readonly string[] = ['facts', 'own', 'CC0-1.0', 'CC-BY-4.0', 'public-domain', 'MIT'];
export interface StdSource {
  id: string;
  /** page: a page read (where, when); standard: a standard's nominal value; derived: by a rule; estimate: said so; own: written for BaroCSS;
   *  row: a person's loaded row, its source as the row gives it (O7). */
  kind: 'page' | 'standard' | 'derived' | 'estimate' | 'own' | 'row';
  where: string; read?: string; licence: Licence;
  /** Not cross-checked against a second source, or no address recorded: to verify before manufacture. */
  unverified?: true; note?: string;
}
export interface StdTable {
  id: string; title: string; unit: string;
  /** The standards it follows, by number only. */
  standards: string[];
  rows: Record<string, Record<string, number | readonly number[]>>;
  /** Each field's source, and where a row's differs. */
  fieldSources: Record<string, string>; rowSources?: Record<string, Record<string, string>>;
}
export type StandardsCode = 'NO_SOURCE' | 'LICENCE' | 'NO_TABLE' | 'NO_ROW';

export const STANDARD_SOURCES: readonly StdSource[] = [
  { id: 'FAST-NOM', kind: 'standard', where: 'the standards\' nominal values (ISO 261/262 coarse pitches; ISO 4017 s, k; ISO 4032 m; ISO 4762 dk, k, s; ISO 7089 d1, d2, h), cross-checked against fasten.it\'s DIN EN ISO 4017 / 4762 tables (no address recorded)', read: '2026-10-17', licence: 'facts', unverified: true },
  { id: 'FAST-4762-L', kind: 'page', where: 'https://engineersedge.com/iso_socket_head_screw.htm (ISO 4762 lengths)', read: '2026-10-17', licence: 'facts' },
  { id: 'FAST-4017-L', kind: 'page', where: 'https://engineersedge.com/iso_hex_head_screw.htm (ISO 4017 lengths, M3–M12)', read: '2026-10-17', licence: 'facts' },
  { id: 'FAST-4017-RULE', kind: 'derived', where: 'the standard\'s 2d … 10d length range on the R10 series, not cross-checked', licence: 'own', unverified: true },
  { id: 'FAST-10642', kind: 'derived', where: 'the standard\'s nominal relations (dk 2.24 d, k 0.62 d), not yet cross-checked against a table', licence: 'own', unverified: true },
  { id: 'FAST-273', kind: 'standard', where: 'ISO 273 clearance holes (fine H12, medium H13, coarse H14) as suppliers give them (no single source recorded)', licence: 'facts', unverified: true },
  { id: 'FAST-TAP', kind: 'derived', where: 'd − P, the usual drill for a 6H internal thread', licence: 'own' },
  { id: 'FAST-SIZE', kind: 'own', where: 'the size\'s designation (M6: 6 mm)', licence: 'own' },
  { id: 'TOL-GENERAL', kind: 'estimate', where: GENERAL_TOLERANCE.basis, licence: 'own' },
  { id: 'TOL-POSITION', kind: 'estimate', where: 'a hole\'s position tolerance where no fastener data places it: an estimate', licence: 'own' },
  // (The material library's own sources: written for BaroCSS, its licence the file's.)
  ...Object.entries(MATERIALS_DATA.sources as unknown as Record<string, string>).map(([id, text]): StdSource => ({ id: `MAT-${id}`, kind: 'estimate', where: text, licence: (MATERIALS_DATA as unknown as { license: string }).license.startsWith('CC0-1.0') ? 'CC0-1.0' : 'unknown' })),
];

/** The metric coarse fasteners, each field's source; a row's lengths where they were not cross-checked. */
const FASTENER_FIELDS: Record<string, string> = {
  d: 'FAST-SIZE', pitch: 'FAST-NOM', s: 'FAST-NOM', k: 'FAST-NOM', m: 'FAST-NOM', dk: 'FAST-NOM', ks: 'FAST-NOM', socket: 'FAST-NOM', wd1: 'FAST-NOM', wd2: 'FAST-NOM', wh: 'FAST-NOM',
  lengths: 'FAST-4017-L', capLengths: 'FAST-4762-L', cdk: 'FAST-10642', ck: 'FAST-10642', csocket: 'FAST-10642', cskLengths: 'FAST-10642', clearance: 'FAST-273', tap: 'FAST-TAP',
};
/** What the fastener sizes follow, by number (the loaded rows' view below). */
const FASTENER_STANDARDS = [...FASTENER_KINDS.map(k => k.standard), 'ISO 261', 'ISO 262', 'ISO 273'];
/**
 * The fastener sizes a document's rows give (O7), as a table: none built in. A field whose source text is one of
 * STANDARD_SOURCES' (the sample file's are) is that source; any other is the row's own, said so (kind `row`).
 */
export function fastenerSizeTable(doc: Pick<StudioDoc, 'fastenerSizes'>): { table: StdTable; sources: StdSource[] } {
  const rows = doc.fastenerSizes?.rows ?? [], byText = new Map(STANDARD_SOURCES.map(x => [x.where, x.id])), own: StdSource[] = [];
  const fieldSources: Record<string, string> = {}, rowSources: Record<string, Record<string, string>> = {};
  const sourceOfField = (size: string, field: string, text: string, estimate: boolean) => {
    const known = byText.get(text); if (known) return known;
    const id = `ROW-${size}-${field}`; own.push({ id, kind: estimate ? 'estimate' : 'row', where: text, licence: 'facts' }); return id;
  };
  for (const r of rows) for (const field of Object.keys(FASTENER_FIELDS)) {
    if (field === 'checked4017') continue;
    rowSources[r.id] = { ...rowSources[r.id], [field]: sourceOfField(r.id, field, r.fieldSources?.[field as keyof typeof r.fieldSources] ?? r.source ?? 'an estimate (the row says so)', !!r.estimate) };
  }
  const table: StdTable = {
    id: 'fasteners-metric-coarse', title: 'Metric coarse fasteners: the sizes loaded (none built in)', unit: 'mm', standards: FASTENER_STANDARDS,
    rows: Object.fromEntries(rows.map(r => [r.id, Object.fromEntries(Object.keys(FASTENER_FIELDS).filter(k => k !== 'checked4017').map(k => [k, (r as unknown as Record<string, number | number[]>)[k]]))])),
    fieldSources, rowSources,
  };
  return { table, sources: [...STANDARD_SOURCES, ...own] };
}
/** The tables: the fastener sizes' with no rows (a document's are its loaded rows, fastenerSizeTable), then the studio's own
 *  (BaroCSS's values, estimates said so). */
export const STANDARD_TABLES: readonly StdTable[] = [
  { id: 'fasteners-metric-coarse', title: 'Metric coarse fasteners: the sizes loaded (none built in)', unit: 'mm', standards: FASTENER_STANDARDS, rows: {}, fieldSources: FASTENER_FIELDS },
  { id: 'tolerance-general', title: 'General tolerances suggested on drawings', unit: 'mm, degrees', standards: [], rows: { default: { linear: GENERAL_TOLERANCE.linear, angular: GENERAL_TOLERANCE.angular, position: POSITION_ESTIMATE_MM } }, fieldSources: { linear: 'TOL-GENERAL', angular: 'TOL-GENERAL', position: 'TOL-POSITION' } },
  {
    id: 'materials', title: 'Material families (typical values)', unit: 'g/cm³', standards: [],
    rows: Object.fromEntries(MATERIALS_DATA.materials.map(m => [m.id, { density: m.densityGPerCm3 }])),
    fieldSources: { density: 'MAT-S-DENS' },
    rowSources: Object.fromEntries(MATERIALS_DATA.materials.flatMap(m => { const s = (m as unknown as { sources?: Record<string, string> }).sources?.densityGPerCm3; return s ? [[m.id, { density: `MAT-${s}` }]] : []; })),
  },
];

/** The standards prompts and tool descriptions may name (by number only): the tables' and the thread formula's (ISO 68-1). */
export const NAMED_STANDARDS: readonly string[] = [...new Set([...FASTENER_STANDARDS, ...STANDARD_TABLES.flatMap(t => t.standards), 'ISO 68-1'])];
export const sourceOf = (id: string, sources: readonly StdSource[] = STANDARD_SOURCES) => sources.find(s => s.id === id);
const licenceOK = (l: string) => ALLOWED_LICENCES.includes(l);
/** Each value without a source, or with a source whose licence a table may not carry (typed). */
export function checkTables(tables: readonly StdTable[] = STANDARD_TABLES, sources: readonly StdSource[] = STANDARD_SOURCES): { code: StandardsCode; table: string; row?: string; field?: string; message: string }[] {
  const out: ReturnType<typeof checkTables> = [];
  for (const t of tables) for (const [row, fields] of Object.entries(t.rows)) for (const field of Object.keys(fields)) {
    const id = t.rowSources?.[row]?.[field] ?? t.fieldSources[field], s = id ? sourceOf(id, sources) : undefined;
    if (!s) { out.push({ code: 'NO_SOURCE', table: t.id, row, field, message: `${t.id} ${row}.${field} has no source${id ? ` (${id} is not registered)` : ''}` }); continue; }
    if (!licenceOK(s.licence)) out.push({ code: 'LICENCE', table: t.id, row, field, message: `${t.id} ${row}.${field}: its source ${s.id} is under "${s.licence}", which a table may not carry (allowed: ${ALLOWED_LICENCES.join(', ')})` });
  }
  return out;
}
/** A document's tables, with their sources: the fastener sizes its rows give (O7), the studio's own as they are. */
export function tablesOf(doc: Pick<StudioDoc, 'fastenerSizes'>): { tables: StdTable[]; sources: StdSource[] } {
  const f = fastenerSizeTable(doc);
  return { tables: STANDARD_TABLES.map(t => t.id === f.table.id ? f.table : t), sources: f.sources };
}
/** A value (or a row's values) with its sources. */
export function lookup(tableId: string, row: string, field: string | undefined, doc: Pick<StudioDoc, 'fastenerSizes'>): { table: string; row: string; unit: string; standards: string[]; values: Record<string, number | readonly number[]>; sources: Record<string, StdSource> } {
  const { tables, sources } = tablesOf(doc), t = tables.find(x => x.id === tableId);
  if (!t) throw refusal('NO_TABLE', `no table ${tableId}; tables: ${tables.map(x => x.id).join(', ')}`);
  const r = t.rows[row];
  if (!r) throw refusal('NO_ROW', `${tableId} has no ${row}; rows: ${Object.keys(t.rows).join(', ') || (t.id === 'fasteners-metric-coarse' ? 'none loaded (load your fastener sizes)' : 'none')}`);
  const fields = field ? [field] : Object.keys(r);
  if (field && !(field in r)) throw refusal('NO_ROW', `${tableId} ${row} has no field ${field}; fields: ${Object.keys(r).join(', ')}`);
  return { table: t.id, row, unit: t.unit, standards: t.standards, values: Object.fromEntries(fields.map(f => [f, r[f]])), sources: Object.fromEntries(fields.map(f => [f, sourceOf(t.rowSources?.[row]?.[f] ?? t.fieldSources[f], sources)!])) };
}

// ——— the tool
export const STANDARDS_TOOL_NAMES = new Set(['standards_lookup']);
export const STANDARDS_TOOLS = [{
  name: 'standards_lookup',
  description: `A value from the studio's standards-derived tables with its source (where, when read, its licence, whether verified or an estimate): tables ${STANDARD_TABLES.map(t => t.id).join(', ')}; "row" (M6, a material id, default), "field" (one value; absent: the row). Without "table": the tables and their rows. Standards are named by number only; their text is not held. Changes nothing.`,
  input_schema: { type: 'object', properties: { table: { type: 'string' }, row: { type: 'string' }, field: { type: 'string' } }, additionalProperties: false },
}];
export function runStandardsTool(args: Record<string, unknown>, doc: Pick<StudioDoc, 'fastenerSizes'>): { content: unknown; summary: string } | { error: string } {
  if (args.table === undefined) { const { tables } = tablesOf(doc); return { content: { tables: tables.map(t => ({ id: t.id, title: t.title, unit: t.unit, standards: t.standards, rows: Object.keys(t.rows) })) }, summary: `${tables.length} tables` }; }
  try { const r = lookup(String(args.table), String(args.row ?? ''), args.field === undefined ? undefined : String(args.field), doc); return { content: r, summary: `${r.table} ${r.row}` }; }
  catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}
