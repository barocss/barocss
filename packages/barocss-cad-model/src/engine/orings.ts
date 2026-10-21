// The user's O-ring rows (R12c.5, D159): each an ID and a cross-section citing its source or flagged an estimate — none
// built in. A row a gland uses stays (remove the gland first).
import { oringRowProblem, type ORingRow } from '@barocss/cad';
import type { StudioDoc } from './doc';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editORingRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = oringRowProblem(r); if (p) return { error: p }; }
  const was = doc.orings?.rows ?? [], gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `no O-ring row ${gone.join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'})` };
  const used = remove.filter(id => doc.nodes.some(n => n.kind === 'oring-gland' && n.ring === id));
  if (used.length) return { error: `O-ring row ${used.join(', ')} is used by a gland: remove the gland first` };
  const incoming = add as ORingRow[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { doc: { ...doc, orings: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}
