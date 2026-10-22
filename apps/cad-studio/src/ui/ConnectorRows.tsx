// The connector rows (R12c.7, D162): the person's own connectors — an opening, a mating body, a keep-out; none is built
// in — loaded from a file, listed with their sizes and sources, removed (a row an opening uses stays).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editConnectorRows } from '@barocss/cad-model/engine/connectors';
import { Icon } from './atoms';

export function ConnectorRows({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.connectors?.rows ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editConnectorRows(doc, add, remove); if ('error' in r) { onError('Connector row refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the connector rows', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="Connector rows">
    <div className="card-title" style={{ marginTop: 8 }}>CONNECTORS</div>
    {!rows.length && <div className="empty">No connector rows: load your own (JSON: the opening, the mating body, a keep-out; each citing its source or marked an estimate). None is built in.</div>}
    {rows.map(r => <div key={r.id} className="param-row" aria-label={`Connector row ${r.id}`}>
      <span title={r.source ?? 'an estimate'}><b>{r.name ?? r.id}</b> <span className="muted small">{r.opening.shape} {r.opening.widthMM} × {r.opening.heightMM}, {r.opening.depthMM} deep · {r.source ?? 'estimate'}</span></span>
      <button className="ghost small" aria-label={`Remove connector row ${r.id}`} title="Remove the row" onClick={() => apply([], [r.id])}><Icon name="delete" small /></button>
    </div>)}
    <div className="row-actions">
      <label className="ghost small file-button">Add a connector rows file…<input type="file" accept="application/json,.json" aria-label="Connector rows file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label>
    </div>
  </section>;
}
