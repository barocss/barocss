// The user's drive rows (R12c.6b, D161): chains, belts (timing, V, flat) and couplings, each citing its source or flagged
// an estimate — none built in. A row a sprocket, pulley, belt or coupling uses stays (remove that feature first).
import { driveRowProblem, type DriveRow } from '@barocss/cad';
import type { StudioDoc } from './doc';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editDriveRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = driveRowProblem(r); if (p) return { error: p }; }
  const was = doc.drives?.rows ?? [], gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `no drive row ${gone.join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'})` };
  const used = remove.filter(id => doc.nodes.some(n => (n.kind === 'sprocket' || n.kind === 'pulley' || n.kind === 'belt' || n.kind === 'coupling') && n.row === id));
  if (used.length) return { error: `drive row ${used.join(', ')} is used by a feature: remove it first` };
  const incoming = add as DriveRow[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { doc: { ...doc, drives: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}
