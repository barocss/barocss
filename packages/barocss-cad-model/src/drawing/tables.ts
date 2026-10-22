// Table sources (O49): a named source fills a drawing table from the part at each build, so it stays current. `bends`
// is R12's bend table: one row per bend of every sheet body with a flat pattern — its name, which way it folds in the
// flat, angle, inner radius, K, and BA and BD by the kernel's own formulas (bendAllowance, bendDeduction) on its T —
// and the bend-table rows its K came from. The kernel lane's FR4b cut list is one more entry ('cut-list').
import { bendAllowance, bendDeduction } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import type { DrawingTable } from './types';
import type { TableContent } from './table';
import { cutListSource } from '../app/cutList';
import { weldListSource } from '../frames/welds';
import { elementsSource, glandsSource, springsSource } from './elementTables';
import type { Bom } from '../team/bomCore';

/** `bom` (O147 B2): the BOM, worked out by the caller (the studio through its engine worker), for the 'bom' source. */
export interface TableSourceContext { doc: StudioDoc; bodies?: readonly BodyResult[]; bom?: Bom }
export type TableSource = (ctx: TableSourceContext) => TableContent | { error: string };

const label = (name: string, short: boolean) => (short ? name.slice(name.lastIndexOf('.') + 1) : name);
/** R12's bend table: every sheet body's bends, from its flat pattern. */
export function bendTable(ctx: TableSourceContext): TableContent | { error: string } {
  const e = ctx.bodies ? null : evaluatePart(ctx.doc, 0), bodies = ctx.bodies ?? (e?.ok ? e.bodies : []);
  const sheets = bodies.filter(b => b.flat && b.flat.bends.length);
  if (!sheets.length) return { error: 'no sheet-metal body with a flat pattern' + (bodies.some(b => b.flatRefused) ? ` (${bodies.find(b => b.flatRefused)!.flatRefused})` : '') };
  const rows: TableContent['rows'] = [], notes: string[] = [], many = sheets.length > 1;
  for (const b of sheets) {
    const f = b.flat!, T = f.thicknessMM, feature = (n: string) => n.slice(0, Math.max(0, n.lastIndexOf('.'))), short = !many && f.bends.every(x => feature(x.name) === feature(f.bends[0].name));
    for (const x of f.bends) {
      const th = x.angleDegrees * Math.PI / 180, ba = bendAllowance(th, x.radiusMM, T, x.kFactor), bd = bendDeduction(th, x.radiusMM, T, x.kFactor);
      rows.push([`${many ? `${b.key} ` : ''}${label(x.name, short)}`, x.direction === 'up' ? 'UP' : 'DOWN', x.angleDegrees, x.radiusMM, x.kFactor, ba, bd, x.table ? `${x.table.table} ${x.table.how === 'exact' ? 'row' : 'rows'} ${x.table.rows.join(', ')}${x.table.how === 'interpolated' ? ', interpolated' : ''}${x.table.estimate ? ' (estimate)' : ''}` : null]);
    }
    notes.push(`${many ? `${b.key}: ` : ''}T ${+T.toFixed(3)} mm; K ${f.kFactor !== undefined ? `${f.kFactor} for every bend${f.kFactor === 0.5 ? ' (an estimate: use your shop’s value)' : ''}` : 'from the bend table, by bend'}`);
  }
  return {
    title: 'BEND TABLE',
    columns: [{ key: 'bend', label: 'BEND' }, { key: 'dir', label: 'DIR' }, { key: 'angle', label: 'ANGLE', unit: '°', digits: 1 }, { key: 'r', label: 'R', unit: 'mm', digits: 2 },
      { key: 'k', label: 'K', digits: 3 }, { key: 'ba', label: 'BA', unit: 'mm', digits: 3 }, { key: 'bd', label: 'BD', unit: 'mm', digits: 3 }, { key: 'table', label: 'TABLE ROWS' }],
    rows, notes,
  };
}

/**
 * O147 B2: the BOM table — a row a BOM line, numbered as the BOM panel, the purchase list and the balloons number them:
 * the placed parts (merged by their parts), then the bought elements (merged by kind, size and row over copies).
 */
export function bomSource(ctx: TableSourceContext): TableContent | { error: string } {
  if (!ctx.bom) return { error: 'the BOM was not worked out for this sheet' };
  if (!ctx.bom.lines.length) return { error: 'the BOM has no lines' };
  const lines = ctx.bom.lines;
  return {
    title: 'BILL OF MATERIALS',
    columns: [{ key: 'no', label: 'NO.', digits: 0 }, { key: 'item', label: 'ITEM' }, { key: 'qty', label: 'QTY', digits: 0 }, { key: 'material', label: 'MATERIAL' }, { key: 'row', label: 'ROW' },
      { key: 'source', label: 'SOURCE' }, { key: 'bought', label: 'BOUGHT' }, { key: 'mass', label: 'MASS', unit: 'g', digits: 1 }],
    rows: lines.map((l, k) => [k + 1, l.item, l.qty, l.material, [l.row, l.catalogue].filter(Boolean).join(' · ') || null, l.estimate ? 'estimate' : l.source,
      l.kind !== undefined ? `bought${l.override ? ' (set)' : ''}` : l.source !== null ? 'bought (library part)' : 'made', l.massG]),
    notes: [`${ctx.bom.totalQty} part${ctx.bom.totalQty === 1 ? '' : 's'}${ctx.bom.elementQty ? `, ${ctx.bom.elementQty} bought element${ctx.bom.elementQty === 1 ? '' : 's'}` : ''}; the mass is each line's whole (an element's is in its part's)`, 'Rows and sources are yours (none built in); not validated for manufacturing'],
  };
}

/** The sources by name. A cut list (FR4b, the kernel lane's) is registered here as 'cut-list'; the weld list (FRd1) as 'weld-list'. */
export const TABLE_SOURCES: Record<string, TableSource> = { bends: bendTable, 'cut-list': cutListSource, 'weld-list': weldListSource, elements: elementsSource, springs: springsSource, glands: glandsSource, bom: bomSource };

/** A table's content: given, or its source's; an unknown or refusing source as its error. */
export function tableContent(t: DrawingTable, ctx: TableSourceContext): TableContent | { error: string } {
  if (!t.from) return { ...(t.title ? { title: t.title } : {}), columns: t.columns ?? [], rows: t.rows ?? [] };
  const s = TABLE_SOURCES[t.from];
  if (!s) return { error: `no table source "${t.from}" (sources: ${Object.keys(TABLE_SOURCES).join(', ')})` };
  const c = s(ctx);
  return 'error' in c ? c : t.title ? { ...c, title: t.title } : c;
}
