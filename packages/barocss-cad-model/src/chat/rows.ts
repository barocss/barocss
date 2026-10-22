// One ingestion rule; the existing domain validators keep ownership of row semantics.
import { bendTableProblem, type BendTable } from '@barocss/cad';
import type { StudioDoc, StockRow, FrameStockRow } from '../engine/doc';
import { editFitTables } from '../engine/fits';
import { editBearingRows } from '../engine/bearings';
import { editORingRows } from '../engine/orings';
import { editRingRows } from '../engine/rings';
import { editDriveRows } from '../engine/drives';
import { editConnectorRows } from '../engine/connectors';
import { editSections } from '../frames/sections';
import { isSectionTable, sectionTableRows } from '../frames/sectionTables';
import { authorizeRows, ROW_KINDS, rowEntries, rowKey, validRowSupplies, type RowKind, type SuppliedRowDoc } from './rowSources';
import { personRowFile, ROWS_NOT_FROM_PERSON, type PersonRowFiles, type RowFileSource } from './rowFiles';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function loadPersonRows(doc: StudioDoc, kind: unknown, fileId: unknown, feature?: unknown, context?: PersonRowFiles): { doc: StudioDoc; source: RowFileSource; rows: number } | { error: string } {
  const file = personRowFile(context, fileId);
  if (!file) return { error: ROWS_NOT_FROM_PERSON };
  if (!ROW_KINDS.includes(kind as RowKind)) return { error: '[ROWS_KIND] Use a row kind from describe library.load_rows.' };
  if (feature !== undefined && kind !== 'bend') return { error: '[ROWS_INPUT] feature is only for a bend table.' };
  let parsed: unknown;
  try { parsed = JSON.parse(file.text); } catch { return { error: '[ROWS_INPUT] The supplied file is not JSON.' }; }
  const raw = Array.isArray(parsed) ? parsed : object(parsed) && Array.isArray(parsed.rows) && kind !== 'fits' && kind !== 'bend' ? parsed.rows : object(parsed) && Array.isArray(parsed.tables) && kind === 'fits' ? parsed.tables : [parsed];
  if (!raw.length || raw.length > 4096 || raw.some(r => !object(r))) return { error: '[ROWS_INPUT] The file must contain 1 to 4096 row objects.' };
  let result: { doc: StudioDoc } | { error: string };
  let selectedIds = new Set(raw.map(r => (r as { id?: string }).id));
  switch (kind) {
    case 'fits': result = editFitTables(doc, raw); break;
    case 'bearings': result = editBearingRows(doc, raw); break;
    case 'orings': result = editORingRows(doc, raw); break;
    case 'rings': result = editRingRows(doc, raw); break;
    case 'drives': result = editDriveRows(doc, raw); break;
    case 'connectors': result = editConnectorRows(doc, raw); break;
    case 'sections': {
      const converted = isSectionTable(parsed) ? sectionTableRows(parsed) : { rows: raw };
      if (!('error' in converted)) selectedIds = new Set(converted.rows.map(r => (r as { id: string }).id));
      result = 'error' in converted ? converted : editSections(doc, converted.rows); break;
    }
    case 'stock': {
      const good: StockRow[] = [];
      const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
      for (const value of raw) {
        const r = value as Record<string, unknown>, id = typeof r.id === 'string' ? r.id : '', source = typeof r.source === 'string' ? r.source.trim() : '';
        if (!id || !source) return { error: '[STOCK_ROW] Each stock row needs an id and source.' };
        if (r.kind === 'block' && Array.isArray(r.size) && r.size.length === 3 && r.size.every(positive)) good.push({ id, kind: 'block', size: [...r.size] as [number, number, number], source });
        else if (r.kind === 'bar' && positive(r.diameter) && (r.maxLength === undefined || positive(r.maxLength))) good.push({ id, kind: 'bar', diameter: r.diameter, ...(r.maxLength !== undefined ? { maxLength: r.maxLength as number } : {}), source });
        else return { error: `[STOCK_ROW] Invalid block or bar ${id}.` };
      }
      result = { doc: { ...doc, machining: { ...doc.machining, version: 1, stock: good } } }; break;
    }
    case 'frame-stock': {
      const good: FrameStockRow[] = [];
      for (const value of raw) {
        const r = value as Record<string, unknown>, id = typeof r.id === 'string' ? r.id : '', source = typeof r.source === 'string' ? r.source.trim() : '', length = r.lengthMM ?? r.length;
        if (!id || !source || typeof length !== 'number' || !Number.isFinite(length) || length <= 0 || (r.count !== undefined && (!Number.isInteger(r.count) || (r.count as number) <= 0)) || (r.section !== undefined && (typeof r.section !== 'string' || !r.section))) return { error: '[FRAME_STOCK_ROW] Invalid id, source, length, count or section.' };
        good.push({ id, lengthMM: length, ...(r.count !== undefined ? { count: r.count as number } : {}), ...(r.section !== undefined ? { section: r.section as string } : {}), source });
      }
      result = { doc: { ...doc, frames: { ...doc.frames, version: 1, stock: good } } }; break;
    }
    case 'bend': {
      if (!Number.isInteger(feature) || (feature as number) < 0) return { error: '[ROWS_INPUT] A bend table needs the index of an existing sheet feature.' };
      const n = doc.nodes[feature as number];
      if (!n || (n.kind !== 'sheet-base' && n.kind !== 'sheet-contour')) return { error: '[ROWS_INPUT] feature must name an existing sheet-base or sheet-contour.' };
      const problem = bendTableProblem(parsed); if (problem) return { error: `[BEND_TABLE] ${problem}` };
      const nodes = [...doc.nodes], { kFactor: _k, ...rest } = n; void _k;
      nodes[feature as number] = { ...rest, bendTable: parsed as BendTable };
      result = { doc: { ...doc, nodes } }; break;
    }
    default: return { error: '[ROWS_KIND] Unsupported row kind.' };
  }
  if ('error' in result) return result;
  const incoming = rowEntries(result.doc).filter(e => e.kind === kind);
  // Duplicate ids are refused by the same rule for every row loader, before any candidate is returned.
  const ids = incoming.map(e => e.value.id);
  if (new Set(ids).size !== ids.length && kind !== 'bend') return { error: '[ROWS_INPUT] Duplicate row ids.' };
  const imported = incoming.filter(e => kind === 'bend' ? rowKey(e.kind, e.value) === rowKey('bend', parsed) : selectedIds.has(e.value.id));
  const next = [...validRowSupplies(result.doc)];
  for (const e of imported) {
    const receipts = authorizeRows(context!, e.kind, e.value, file.source);
    for (let i = next.length - 1; i >= 0; i--) if (next[i].kind === e.kind && next[i].fingerprint === rowKey(e.kind, e.value)) next.splice(i, 1);
    next.push(...receipts);
  }
  const nextDoc: SuppliedRowDoc = { ...result.doc, rowSources: { version: 1, rows: next } };
  return { doc: nextDoc, source: file.source, rows: imported.reduce((n, e) => n + (e.value.rows?.length ?? 1), 0) };
}

