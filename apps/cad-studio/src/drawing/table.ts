// A table on the sheet (O49): laid out from its content in sheet millimetres (y down) as marks — its rules as lines,
// its cells as text — so the SVG, PDF and DXF writers draw it as they draw anything. A bold title row spanning the
// columns, a header row (`label [unit]`), then the rows; each column as wide as its widest text plus a pad each side.
// Numbers are shown to their column's digits (absent: up to 2, trailing zeros dropped) and aligned right; text left.
import type { Mark } from './sheet';
import { textWidth } from '@barocss/cad-model/drawing/text';
import type { TableCell, TableColumn, TableCorner, XY } from './types';

export const TABLE_TEXT = 2.5;
export const TABLE_ROW = 5;
export const TABLE_PAD = 1.5;
/** What a table shows: given, or a source's. `notes`: lines under it (a source's basis, its estimates). */
export interface TableContent { title?: string; columns: TableColumn[]; rows: TableCell[][]; notes?: string[] }
export interface TableLayout { box: [number, number, number, number]; widths: number[]; rowHeight: number; marks: Mark[] }

/** A cell as shown: a number to its column's digits, null as '—'. */
export function cellText(v: TableCell, c: TableColumn): string {
  if (v === null) return '—';
  if (typeof v === 'string') return v;
  if (c.digits !== undefined) return (Math.abs(v) < 0.5 * 10 ** -c.digits ? 0 : v).toFixed(c.digits);
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
}
export const headerText = (c: TableColumn) => (c.unit ? `${c.label} [${c.unit}]` : c.label);
const alignOf = (c: TableColumn, rows: readonly TableCell[][], i: number): 'start' | 'middle' | 'end' => c.align ?? (rows.some(r => typeof r[i] === 'number') ? 'end' : 'start');

/** The table's size (mm): its column widths and its height, before it is placed. */
export function tableSize(t: TableContent): { widths: number[]; width: number; height: number } {
  const widths = t.columns.map((c, i) => Math.max(textWidth(headerText(c), TABLE_TEXT, true), ...t.rows.map(r => textWidth(cellText(r[i], c), TABLE_TEXT, false))) + 2 * TABLE_PAD);
  let width = widths.reduce((s, w) => s + w, 0);
  if (t.title) width = Math.max(width, textWidth(t.title, TABLE_TEXT, true) + 2 * TABLE_PAD);
  // (A title wider than the columns widens the last one.)
  const extra = width - widths.reduce((s, w) => s + w, 0); if (extra > 0) widths[widths.length - 1] += extra;
  const rows = (t.title ? 1 : 0) + 1 + t.rows.length, notes = t.notes?.length ?? 0;
  return { widths, width, height: rows * TABLE_ROW + notes * TABLE_ROW };
}

/** The table laid out with its `corner` on `at` (sheet mm, y down). */
export function tableLayout(t: TableContent, at: XY, corner: TableCorner = 'top-left'): TableLayout {
  const { widths, width, height } = tableSize(t), notesH = (t.notes?.length ?? 0) * TABLE_ROW, gridH = height - notesH;
  const x0 = corner.endsWith('right') ? at[0] - width : at[0], y0 = corner.startsWith('bottom') ? at[1] - height : at[1], x1 = x0 + width, y1 = y0 + gridH;
  const marks: Mark[] = [], base = TABLE_ROW / 2 + TABLE_TEXT * 0.35;
  // (The border with the visible pen, the inner rules thin.)
  marks.push({ kind: 'line', a: [x0, y0], b: [x1, y0], pen: 'visible' }, { kind: 'line', a: [x1, y0], b: [x1, y1], pen: 'visible' }, { kind: 'line', a: [x1, y1], b: [x0, y1], pen: 'visible' }, { kind: 'line', a: [x0, y1], b: [x0, y0], pen: 'visible' });
  let y = y0;
  if (t.title) { marks.push({ kind: 'text', at: [x0 + TABLE_PAD, y + base], text: t.title, size: TABLE_TEXT, anchor: 'start', bold: true }); y += TABLE_ROW; marks.push({ kind: 'line', a: [x0, y], b: [x1, y], pen: 'thin' }); }
  const lefts: number[] = []; let x = x0; for (const w of widths) { lefts.push(x); x += w; }
  const textAt = (i: number, align: 'start' | 'middle' | 'end', yy: number): XY => [align === 'start' ? lefts[i] + TABLE_PAD : align === 'end' ? lefts[i] + widths[i] - TABLE_PAD : lefts[i] + widths[i] / 2, yy + base];
  t.columns.forEach((c, i) => { const a = alignOf(c, t.rows, i); marks.push({ kind: 'text', at: textAt(i, a, y), text: headerText(c), size: TABLE_TEXT, anchor: a, bold: true }); });
  y += TABLE_ROW; marks.push({ kind: 'line', a: [x0, y], b: [x1, y], pen: 'visible' });
  for (const [k, r] of t.rows.entries()) {
    t.columns.forEach((c, i) => { const a = alignOf(c, t.rows, i); marks.push({ kind: 'text', at: textAt(i, a, y), text: cellText(r[i], c), size: TABLE_TEXT, anchor: a }); });
    y += TABLE_ROW; if (k < t.rows.length - 1) marks.push({ kind: 'line', a: [x0, y], b: [x1, y], pen: 'thin' });
  }
  // (Column rules from the header down.)
  const top = t.title ? y0 + TABLE_ROW : y0;
  for (let i = 1; i < lefts.length; i++) marks.push({ kind: 'line', a: [lefts[i], top], b: [lefts[i], y1], pen: 'thin' });
  for (const [k, n] of (t.notes ?? []).entries()) marks.push({ kind: 'text', at: [x0, y1 + k * TABLE_ROW + base], text: n, size: TABLE_TEXT, anchor: 'start' });
  // (The box takes in the notes, which may run wider than the columns.)
  const right = Math.max(x1, ...(t.notes ?? []).map(n => x0 + textWidth(n, TABLE_TEXT, false)));
  return { box: [x0, y0, right, y0 + height], widths, rowHeight: TABLE_ROW, marks };
}
