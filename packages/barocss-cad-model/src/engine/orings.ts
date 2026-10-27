// The user's O-ring rows (R12c.5, D159): each an ID and a cross-section citing its source or flagged an estimate — none
// built in. A row a gland uses stays (remove the gland first).
import { oringRowProblem, type ORingRow } from '@barocss/cad';
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editORingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<ORingRow>(doc.orings?.rows ?? [], add, remove, { problem: oringRowProblem, noun: 'O-ring row',
    used: { by: id => doc.nodes.some(n => n.kind === 'oring-gland' && n.ring === id), text: 'is used by a gland: remove the gland first' } });
  return 'error' in r ? r : { doc: { ...doc, orings: { version: 1, rows: r.rows } } };
}
