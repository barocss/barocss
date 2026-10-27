// The user's drive rows (R12c.6b, D161): chains, belts (timing, V, flat) and couplings, each citing its source or flagged
// an estimate — none built in. A row a sprocket, pulley, belt or coupling uses stays (remove that feature first).
import { driveRowProblem, type DriveRow } from '@barocss/cad';
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editDriveRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<DriveRow>(doc.drives?.rows ?? [], add, remove, { problem: driveRowProblem, noun: 'drive row',
    used: { by: id => doc.nodes.some(n => (n.kind === 'sprocket' || n.kind === 'pulley' || n.kind === 'belt' || n.kind === 'coupling') && n.row === id), text: 'is used by a feature: remove it first' } });
  return 'error' in r ? r : { doc: { ...doc, drives: { version: 1, rows: r.rows } } };
}
