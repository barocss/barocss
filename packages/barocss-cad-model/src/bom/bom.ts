import { resolveShopTree, provenanceOfTree, type ShopRowProvenance } from '../engine/shopRows';
// The BOM made visible (O147, B1): what the studio's BOM panel and its purchase list show — S1's BOM (team/assembly.ts:
// the placed parts' lines and the bought elements' lines, merged by kind, size and row over copies), a part with no
// placed parts as its own line, and the made elements too (so a person can mark one bought). The bought/made override is
// written on every node a line merges (each copy's), one change; the purchase list is the bought lines as CSV.
import type { ModelNode, PartInstance, StudioDoc } from '../engine/doc';
import type { Evaluate } from '../chat/tools';
import { elementLines } from '../engine/elements';
import { massProperties } from '../analysis/analysis';
import { bomViewOf, deriveBom, lumpsField, massBoundField, type Bom, type BomLine, type BomView } from './core';
import type { EvalResult } from '../engine/evaluate';
import { bearingHousingRef } from '../engine/bearingContext';
import { r6 } from '../util/round';
import { evaluateTree } from '../assembly/instances';
import { refusal } from '../engine/refusal';

/** A made element's line (merged as the bought ones are): what the panel offers to mark bought. */
export interface MadeLine { item: string; parts: string[]; qty: number; kind: string; size: string; row: string | null; override: boolean }
export interface BomPanelData { view: BomView; bom: Bom; made: MadeLine[]; /** A part with no placed parts: its own line. */ single: boolean; shopRows?: readonly { part: string; rows: readonly ShopRowProvenance[] }[] }


/** The panel's data: the BOM, and the made elements by line (each document evaluated once, then `bomPanelDataOf`). */
export async function bomPanelData(doc: StudioDoc, evaluate: Evaluate, name = 'this part'): Promise<BomPanelData> {
  doc = resolveShopTree(doc);
  const results = await evaluateTree(doc, evaluate);
  return bomPanelDataOf(doc, d => results.get(d) ?? null, name);
}
/** The panel's data from evaluations given at once (the chat's drawings: synchronous). */
export function bomPanelDataOf(doc: StudioDoc, evaluate: (doc: StudioDoc) => EvalResult | null, name = 'this part'): BomPanelData {
  const check = (d: StudioDoc): void => {
    if (d.nodes.some(n => !n.suppressed && bearingHousingRef(n))) { const result = evaluate(d); if (!result?.ok) throw refusal('BEARING_HOUSING_EVALUATION', `${result ? JSON.stringify(result.error) : 'no evaluation result'}`); }
    for (const i of d.instances ?? []) check(i.doc);
  };
  const shopRows = provenanceOfTree(doc);
  doc = resolveShopTree(doc);
  check(doc);
  const view = bomViewOf(doc, evaluate), single = !(doc.instances ?? []).length;
  // (D387: the shown parts nested in a sub-assembly too, by occurrence path.)
  const nestedDocs = (insts: readonly PartInstance[] | undefined, under: string): [string, StudioDoc][] => (insts ?? []).flatMap(i => i.hidden && under ? [] : [[`${under}${i.id}`, i.doc] as [string, StudioDoc], ...nestedDocs(i.doc.instances, `${under}${i.id}/`)]);
  const docs: [string, StudioDoc][] = [['base', doc], ...nestedDocs(doc.instances, '')];
  const made: MadeLine[] = [];
  let baseMass = 0, baseBound: ReturnType<typeof massBoundField> = {}, baseLumps: ReturnType<typeof lumpsField> = {};
  for (const [part, d] of docs) {
    const e = evaluate(d); if (!e?.ok) continue;
    // (O169: by the document's materials, as a placed part's mass is — a body's own massG is the default material's.)
    if (part === 'base') { baseMass = (massProperties(d, e.bodies) as { mass: number }[]).reduce((s, x) => s + x.mass, 0); baseBound = massBoundField(d, e.bodies); baseLumps = lumpsField(e.bodies); }
    for (const l of elementLines(d, e.bodies)) {
      if (l.bought || l.kind === 'gusset' || l.kind === 'end-cap') continue; // (plates: their own BOM lines, FRk1)
      const id = `${part}:${l.item}`, row = l.row?.id ?? null, m = made.find(x => x.kind === l.kind && x.size === l.size && x.row === row);
      if (m) { m.parts.push(id); m.qty++; m.override = m.override || l.boughtBy === 'override'; }
      else made.push({ item: `${l.kind} ${l.size}`, parts: [id], qty: 1, kind: l.kind, size: l.size, row, override: l.boughtBy === 'override' });
    }
  }
  // (A part with no placed parts: itself, one, as a line.)
  if (single) view.parts.unshift({ id: 'base', name, material: null, mass: r6(baseMass), ...baseBound, ...baseLumps, library: null, shape: '' });
  return { view, bom: deriveBom(view), made, single, ...(shopRows.some(p => p.rows.length) ? { shopRows } : {}) };
}

/** The document with the bought override set on each `part:feature` (null: cleared, the default for its kind): one change. A part nested in a sub-assembly is named by its occurrence path (`sub1/p2:n3`). */
export function setBought(doc: StudioDoc, parts: readonly string[], value: boolean | null): StudioDoc {
  const by = new Map<string, Set<string>>();
  for (const p of parts) { const k = p.indexOf(':'), part = p.slice(0, k), item = p.slice(k + 1); (by.get(part) ?? by.set(part, new Set()).get(part)!).add(item); }
  const mark = (nodes: ModelNode[], items: Set<string> | undefined) => !items ? nodes : nodes.map(n => {
    if (!n.id || !items.has(n.id)) return n;
    if (value === null) { const rest = { ...n }; delete rest.bought; return rest; }
    return { ...n, bought: value };
  });
  // (Each instance of the tree: its own nodes by its path, its nested instances after it.)
  const inside = (insts: PartInstance[], under: string): PartInstance[] => insts.map(i => {
    const path = `${under}${i.id}`, items = by.get(path), nested = i.doc.instances && i.doc.instances.some(n => [...by.keys()].some(k => k.startsWith(`${path}/${n.id}`)));
    if (!items && !nested) return i;
    return { ...i, doc: { ...i.doc, nodes: mark(i.doc.nodes, items), ...(nested ? { instances: inside(i.doc.instances!, `${path}/`) } : {}) } };
  });
  return {
    ...doc, nodes: mark(doc.nodes, by.get('base')),
    ...(doc.instances ? { instances: inside(doc.instances, '') } : {}),
  };
}

const cell = (v: string | number | null | undefined) => v === null || v === undefined ? '' : typeof v === 'number' ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
/** Whether a BOM line is bought: an element marked so, or a library part (a catalogue part). */
export const isBoughtLine = (l: BomLine) => l.kind !== undefined || l.source !== null;
/** A line's size cell: its size, and (O8) the solids it comes as when several — the column as before when one. */
const sizeCell = (l: BomLine) => l.lumps ? `${l.size ? `${l.size}; ` : ''}${l.lumps} lumps` : l.size ?? '';
/**
 * The purchase list as CSV: item no., item, qty, kind, size, row, catalogue, source, estimate — the bought lines (the
 * bought elements, the library parts); with `withMade`, the made parts and the made elements after them.
 */
export function purchaseCsv(p: BomPanelData, withMade = false): string {
  const rows: (string | number | null)[][] = [['item no.', 'item', 'qty', 'kind', 'size', 'row', 'catalogue', 'source', 'estimate']];
  const lines = p.bom.lines.map((l, k) => ({ l, no: k + 1 }));
  // (D387: an equal bought item at another level — a screw nested in a sub-assembly, one beside it — is one purchase row, the quantities summed.)
  const bought = new Map<string, (string | number | null)[]>(), nestedKey = new Set<string>();
  for (const { l, no } of lines) if (isBoughtLine(l)) {
    const row = [no, l.item, l.qty, l.kind ?? 'part', sizeCell(l), l.row ?? '', l.catalogue ?? '', l.source ?? '', l.estimate ? 'estimate' : ''], key = JSON.stringify([row[1], ...row.slice(3)]), same = bought.get(key);
    if (same && (l.level || nestedKey.has(key))) same[2] = (same[2] as number) + l.qty;
    else { if (l.level) nestedKey.add(key); bought.set(same ? `${key}#${no}` : key, row); }
  }
  for (const row of bought.values()) rows.push(row);
  if (withMade) {
    for (const { l, no } of lines) if (!isBoughtLine(l)) rows.push(l.plate ? [no, l.item, l.qty, l.plate.kind, sizeCell(l), '', '', '', ''] : [no, l.item, l.qty, 'part', sizeCell(l), '', '', '', '']);
    p.made.forEach((m, k) => rows.push([lines.length + k + 1, m.item, m.qty, m.kind, m.size, m.row ?? '', '', '', '']));
  }
  return rows.map(r => r.map(cell).join(',')).join('\n') + '\n';
}
