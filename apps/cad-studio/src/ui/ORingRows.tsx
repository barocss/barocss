// The O-ring rows (R12c.5, D159): the person's own rings — none is built in — loaded from a file, listed with
// their sizes and sources, removed (a row a gland uses stays).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editORingRows } from '@barocss/cad-model/engine/orings';
import { Icon } from './atoms';
import { ROW } from './panelStyles';
import { Button } from '@/components/ui/button';
import { RowsEmpty } from './RowsEmpty';

export function ORingRows({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.orings?.rows ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editORingRows(doc, add, remove); if ('error' in r) { onError('O-ring row refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the O-ring rows', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="O-ring rows">
    <div className="card-title" style={{ marginTop: 8 }}>O-RINGS</div>
    {!rows.length && <RowsEmpty none="No O-ring rows" holds="JSON: dash, inside diameter, cross-section; each citing its source or marked an estimate." />}
    {rows.map(r => <div key={r.id} className={ROW} aria-label={`O-ring row ${r.id}`}>
      <span title={r.source ?? 'an estimate'}><b>{r.dash ?? r.id}</b> <span className="muted small">ID {r.insideDiameter} × CS {r.crossSection} · {r.source ?? 'estimate'}</span></span>
      <Button variant="ghost" aria-label={`Remove O-ring row ${r.id}`} title="Remove the row" onClick={() => apply([], [r.id])}><Icon name="delete" small /></Button>
    </div>)}
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><label className="file-button">Add an O-ring rows file…<input type="file" accept="application/json,.json" aria-label="O-ring rows file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label></Button>
    </div>
  </section>;
}
