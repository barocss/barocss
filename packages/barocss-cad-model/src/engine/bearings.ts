// The user's bearing rows (R12c.4, D158): catalogue rows of envelopes and abutment values, each citing its source or
// flagged an estimate — none built in. A row a bearing uses stays (remove the bearing first).
import { bearingRowProblem, type BearingRow } from '@barocss/cad';
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editBearingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<BearingRow>(doc.bearings?.rows ?? [], add, remove, { problem: bearingRowProblem, noun: 'bearing row',
    used: { by: id => doc.nodes.some(n => n.kind === 'bearing' && n.row === id), text: 'is used by a bearing: remove the bearing first' } });
  return 'error' in r ? r : { doc: { ...doc, bearings: { version: 1, rows: r.rows } } };
}
