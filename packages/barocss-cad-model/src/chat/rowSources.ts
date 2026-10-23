// File evidence is separate from strict domain rows. A receipt is valid only for the exact row digest.
import type { StudioDoc } from '../engine/doc';
import { canonical } from '../team/revision';
import { sha256Hex } from '../team/digest';
import { isPersonRowFiles, ROWS_NOT_FROM_PERSON, type PersonRowFiles, type RowFileSource } from './rowFiles';

import type { RowKind } from './rowDefinitions';
export { ROW_KINDS, type RowKind } from './rowDefinitions';
export interface RowSupply { kind: RowKind; id: string; row?: number; file: RowFileSource; fingerprint: string }
export type SuppliedRowDoc = StudioDoc & { rowSources?: { version: 1; rows: RowSupply[] } };
// Permission to use a value is conversation-scoped. Its file evidence is target-scoped below.
const authorized = new WeakMap<PersonRowFiles, Set<string>>();
const importedReceipts = new WeakMap<RowSupply, { context: PersonRowFiles; value: Row }>();
export const rowKey = (kind: RowKind, value: unknown) => `${kind}:${sha256Hex(new TextEncoder().encode(canonical(value)))}`;
type Row = { id: string; rows?: readonly unknown[] };
export function rowEntries(doc: StudioDoc): { kind: RowKind; value: Row }[] {
  const rows: { kind: RowKind; value: Row }[] = [];
  const add = (kind: RowKind, values: readonly { id: string }[] | undefined) => { for (const value of values ?? []) rows.push({ kind, value }); };
  add('fits', doc.fits?.tables); add('bearings', doc.bearings?.rows); add('orings', doc.orings?.rows);
  add('rings', doc.rings?.rows); add('drives', doc.drives?.rows); add('connectors', doc.connectors?.rows); add('fasteners', doc.fasteners?.rows); add('fastener-sizes', doc.fastenerSizes?.rows);
  add('sections', doc.frames?.sections); add('stock', doc.machining?.stock); add('frame-stock', doc.frames?.stock);
  for (const n of doc.nodes) if ((n.kind === 'sheet-base' || n.kind === 'sheet-contour') && n.bendTable) rows.push({ kind: 'bend', value: n.bendTable });
  return rows;
}
export function rowSupplies(kind: RowKind, value: Row, file: RowFileSource): RowSupply[] {
  const base = { kind, id: value.id, file, fingerprint: rowKey(kind, value) };
  return value.rows ? value.rows.map((_, row) => ({ ...base, row })) : [base];
}

export function authorizeRows(context: PersonRowFiles, kind: RowKind, value: Row, file: RowFileSource): RowSupply[] {
  if (!isPersonRowFiles(context)) throw new Error(ROWS_NOT_FROM_PERSON);
  let rows = authorized.get(context); if (!rows) { rows = new Set(); authorized.set(context, rows); }
  rows.add(rowKey(kind, value));
  const receipts = rowSupplies(kind, value, file);
  for (const receipt of receipts) importedReceipts.set(receipt, { context, value });
  return receipts;
}
export function validRowSupplies(doc: StudioDoc): RowSupply[] {
  const current = new Map(rowEntries(doc).map(e => [rowKey(e.kind, e.value), e]));
  return ((doc as SuppliedRowDoc).rowSources?.rows ?? []).filter(r => {
    const entry = current.get(r.fingerprint);
    return entry?.kind === r.kind && entry.value.id === r.id && (entry.value.rows ? Number.isInteger(r.row) && r.row! >= 0 && r.row! < entry.value.rows.length : r.row === undefined);
  });
}
export function inheritRowSources(doc: StudioDoc, local: StudioDoc, parent?: StudioDoc): StudioDoc {
  const localRows = new Map(rowEntries(local).map(e => [`${e.kind}:${e.value.id}`, rowKey(e.kind, e.value)]));
  const effective = new Set(rowEntries(doc).map(e => rowKey(e.kind, e.value)));
  const rows = [...validRowSupplies(local), ...(parent ? validRowSupplies(parent).filter(r => !localRows.has(`${r.kind}:${r.id}`)) : [])].filter(r => effective.has(r.fingerprint));
  if (!rows.length && !(doc as SuppliedRowDoc).rowSources) return doc;
  return { ...doc, rowSources: { version: 1, rows } } as SuppliedRowDoc;
}

/** Covers direct calls, scripts, batches, proposals and inserted part documents with one atomic gate. */
export function personRowsRefusal(before: StudioDoc, after: StudioDoc, context?: PersonRowFiles): string | null {
  const old = new Set<string>();
  const collect = (doc: StudioDoc) => { for (const e of rowEntries(doc)) old.add(rowKey(e.kind, e.value)); for (const i of doc.instances ?? []) collect(i.doc); };
  collect(before);
  const allowed = isPersonRowFiles(context) ? authorized.get(context) : undefined;
  const check = (doc: StudioDoc): boolean => rowEntries(doc).every(e => old.has(rowKey(e.kind, e.value)) || allowed?.has(rowKey(e.kind, e.value))) && (doc.instances ?? []).every(i => check(i.doc));
  return check(after) ? null : ROWS_NOT_FROM_PERSON;
}

/** Preserve each document's evidence; only explicit imports may replace that target's receipts. */
export function reconcileRowSources(before: StudioDoc, after: StudioDoc, context?: PersonRowFiles): StudioDoc {
  // A copied part may keep actual existing row/receipt objects. A matching digest alone is not evidence
  // that a different part received its data from the same file.
  const copies = new WeakMap<RowSupply, Row>();
  const collect = (doc: StudioDoc) => {
    const entries = new Map(rowEntries(doc).map(e => [rowKey(e.kind, e.value), e.value]));
    for (const receipt of validRowSupplies(doc)) copies.set(receipt, entries.get(receipt.fingerprint)!);
    for (const instance of doc.instances ?? []) collect(instance.doc);
  };
  collect(before);
  const walk = (previous: StudioDoc | undefined, doc: StudioDoc): StudioDoc => {
    const own = previous ? validRowSupplies(previous) : [], candidate = validRowSupplies(doc), rows: RowSupply[] = [];
    for (const entry of rowEntries(doc)) {
      const fingerprint = rowKey(entry.kind, entry.value), matching = candidate.filter(r => r.fingerprint === fingerprint);
      const imported = matching.filter(receipt => {
        const issued = importedReceipts.get(receipt);
        return isPersonRowFiles(context) && !!issued && issued.context === context && issued.value === entry.value;
      });
      const kept = own.filter(receipt => receipt.fingerprint === fingerprint);
      rows.push(...(imported.length ? imported : kept.length ? kept : matching.filter(receipt => copies.get(receipt) === entry.value)));
    }
    const previousParts = new Map((previous?.instances ?? []).map(instance => [instance.id, instance.doc]));
    const instances = doc.instances?.map(instance => {
      const child = walk(previousParts.get(instance.id), instance.doc);
      return child === instance.doc ? instance : { ...instance, doc: child };
    });
    const changedInstances = instances?.some((instance, index) => instance !== doc.instances![index]);
    if (canonical(rows) === canonical(doc.rowSources?.rows ?? []) && !changedInstances) return doc;
    return { ...doc, ...(rows.length || doc.rowSources ? { rowSources: { version: 1, rows } } : {}), ...(changedInstances ? { instances } : {}) };
  };
  return walk(before, after);
}
