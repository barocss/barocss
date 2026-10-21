// The user's bearing rows (R12c.4, D158): catalogue rows of envelopes and abutment values, each citing its source or
// flagged an estimate — none built in. A row a bearing uses stays (remove the bearing first).
import { bearingRowProblem, type BearingRow } from '@barocss/cad';
import type { StudioDoc } from './doc';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editBearingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = bearingRowProblem(r); if (p) return { error: p }; }
  const was = doc.bearings?.rows ?? [], gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `no bearing row ${gone.join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'})` };
  const used = remove.filter(id => doc.nodes.some(n => n.kind === 'bearing' && n.row === id));
  if (used.length) return { error: `bearing row ${used.join(', ')} is used by a bearing: remove the bearing first` };
  const incoming = add as BearingRow[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { doc: { ...doc, bearings: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}
