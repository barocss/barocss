// R12c.7 (D162): section tables for FR's kinds — one kind's named sizes as the user's rows (none built in), each size
// citing its source or flagged an estimate (its own, or the table's), as the bend tables (D120). A member names a table
// and a size; the table is checked whole (`[SECTION_TABLE]`), a size it lacks refused with the sizes it has
// (`[SECTION_TABLE_MISS]`), and the size built by the section's own closed forms (FR1).
import { frameSection, FrameSectionError, type FrameSectionSpec } from './frame-section.js';

export type SectionTableKind = 'rect-tube' | 'round-tube' | 'angle' | 'channel' | 'tslot';
export interface SectionTableRow { readonly size: string; readonly source?: string; readonly estimate?: boolean; readonly [dimension: string]: unknown }
export interface SectionTable {
  readonly id: string; readonly kind: SectionTableKind; readonly label?: string;
  /** The table's source (a catalogue page: URL, date read), or `estimate` — a row's own takes its place. */
  readonly source?: string; readonly estimate?: boolean;
  readonly rows: readonly SectionTableRow[];
}
const DIMS: Record<SectionTableKind, { readonly req: readonly string[]; readonly opt: readonly string[] }> = {
  'rect-tube': { req: ['width', 'height', 'wall', 'outerRadius'], opt: ['innerRadius'] },
  'round-tube': { req: ['diameter', 'wall'], opt: [] },
  angle: { req: ['legX', 'legY', 'thickness', 'rootRadius', 'toeRadius'], opt: [] },
  channel: { req: ['height', 'width', 'web', 'flange', 'rootRadius'], opt: [] },
  tslot: { req: ['size', 'cells', 'opening', 'lip', 'undercut', 'depth', 'bore'], opt: ['openSlots'] },
};
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
/** A row as the section's spec (its dimensions; a T-slot's size is its `size` dimension, the row's name is `size` too: see `sizeMM`). */
function specOf(kind: SectionTableKind, r: SectionTableRow): FrameSectionSpec {
  const n = (k: string) => r[k] as number;
  switch (kind) {
    case 'rect-tube': return { kind, width: n('width'), height: n('height'), wall: n('wall'), outerRadius: n('outerRadius'), ...(r.innerRadius !== undefined ? { innerRadius: n('innerRadius') } : {}) };
    case 'round-tube': return { kind, diameter: n('diameter'), wall: n('wall') };
    case 'angle': return { kind, legX: n('legX'), legY: n('legY'), thickness: n('thickness'), rootRadius: n('rootRadius'), toeRadius: n('toeRadius') };
    case 'channel': return { kind, height: n('height'), width: n('width'), web: n('web'), flange: n('flange'), rootRadius: n('rootRadius') };
    case 'tslot': return { kind, size: n('sizeMM'), cells: n('cells') as 1 | 2, openSlots: n('cells') === 1 ? n('openSlots') : 6, opening: n('opening'), lip: n('lip'), undercut: n('undercut'), depth: n('depth'), bore: n('bore') };
  }
}
/** Why a section table is not one, or null. */
export function sectionTableProblem(t: unknown): string | null {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return 'a section table is an object { id, kind, source | estimate, rows: [{ size, …dimensions }] }';
  const o = t as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `section table ${o.id}` : '';
  if (!at) return 'a section table needs an id';
  for (const k of Object.keys(o)) if (!['id', 'kind', 'label', 'source', 'estimate', 'rows'].includes(k)) return `${at}: unknown field ${k}`;
  const kind = o.kind as SectionTableKind;
  if (!(kind in DIMS)) return `${at}: kind must be rect-tube, round-tube, angle, channel or tslot (not ${String(o.kind)})`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source must be text`;
  if (o.source !== undefined && o.estimate === true) return `${at}: cite its source or say estimate: true — not both`;
  if (!Array.isArray(o.rows) || !o.rows.length) return `${at}: rows must list at least one size`;
  // (A T-slot's dimension `size` would clash with the row's name: in a table it is `sizeMM`.)
  const d = DIMS[kind], req = kind === 'tslot' ? d.req.map(k => k === 'size' ? 'sizeMM' : k) : d.req, seen = new Set<string>();
  for (const [i, row] of (o.rows as unknown[]).entries()) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return `${at}: rows[${i}] must be { size, …dimensions }`;
    const r = row as Record<string, unknown>, rat = `${at} size ${String(r.size)}`;
    if (typeof r.size !== 'string' || !r.size.trim()) return `${at}: rows[${i}] needs a size (its name, e.g. "40x40x3")`;
    if (seen.has(r.size)) return `${at}: size ${r.size} is listed twice`;
    seen.add(r.size);
    for (const k of Object.keys(r)) if (!['size', 'source', 'estimate', ...req, ...d.opt].includes(k)) return `${rat}: unknown field ${k}`;
    for (const k of [...req, ...d.opt]) if (r[k] !== undefined && !(num(r[k]) && (r[k] as number) >= 0)) return `${rat}: ${k} must be a number, 0 or more`;
    for (const k of req) if (r[k] === undefined && !(kind === 'tslot' && k === 'openSlots')) return `${rat}: ${k} is missing`;
    if (kind === 'tslot' && r.cells === 1 && r.openSlots === undefined) return `${rat}: openSlots (0 to 4) must be given for one cell`;
    if (r.source !== undefined && typeof r.source !== 'string') return `${rat}: source must be text`;
    if (r.source !== undefined && r.estimate === true) return `${rat}: cite its source or say estimate: true — not both`;
    if (r.source === undefined && r.estimate !== true && o.source === undefined && o.estimate !== true) return `${rat}: cite its source or say estimate: true — never neither (here or on the table)`;
    try { frameSection(specOf(kind, r as SectionTableRow)); } catch (cause) { if (cause instanceof FrameSectionError) return `${rat}: ${cause.message}`; throw cause; }
  }
  return null;
}
/** A size from a table (checked first): its spec, and whether it is an estimate and where from; or the miss, naming the sizes held. */
export function lookupSection(t: SectionTable, size: string): { readonly spec: FrameSectionSpec; readonly estimate: boolean; readonly source?: string } | { readonly miss: string } {
  const r = t.rows.find(x => x.size === size);
  if (!r) return { miss: `the section table ${t.id} has no size ${String(size)} (sizes: ${t.rows.map(x => x.size).join(', ')})` };
  const src = r.source ?? (r.estimate ? undefined : t.source);
  return { spec: specOf(t.kind, r), estimate: r.estimate === true || (r.source === undefined && t.estimate === true), ...(src ? { source: src } : {}) };
}
