// The user's connector rows (R12c.7, D162): an opening, a mating body and a keep-out, each row citing its source or
// flagged an estimate — none built in. A row an opening uses stays (remove the opening first).
import { connectorRowProblem, type ConnectorRow } from '@barocss/cad';
import type { StudioDoc } from './doc';

/** Rows added (each checked; one with an id held already replaces it) and removed by id. */
export function editConnectorRows(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  for (const r of add) { const p = connectorRowProblem(r); if (p) return { error: p }; }
  const was = doc.connectors?.rows ?? [], gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `no connector row ${gone.join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'})` };
  const used = remove.filter(id => doc.nodes.some(n => n.kind === 'connector-opening' && n.row === id));
  if (used.length) return { error: `connector row ${used.join(', ')} is used by an opening: remove it first` };
  const incoming = add as ConnectorRow[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { doc: { ...doc, connectors: { version: 1, rows: [...was.filter(r => !ids.has(r.id)), ...incoming] } } };
}
