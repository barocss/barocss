// The bearing rows (R12c.4, D158): the person's own catalogue rows — none is built in — loaded from a file, listed with
// their sizes and sources, removed (a row a bearing uses stays).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editBearingRows } from '@barocss/cad-model/engine/bearings';
import { Icon } from './atoms';
import { ROW } from './panelStyles';
import { Button } from '@/components/ui/button';
import { RowsEmpty } from './RowsEmpty';

export function BearingRows({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.bearings?.rows ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editBearingRows(doc, add, remove); if ('error' in r) { onError('Bearing row refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the bearing rows', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="Bearing rows">
    <div className="card-title" style={{ marginTop: 8 }}>BEARINGS</div>
    {!rows.length && <RowsEmpty none="No bearing rows" holds="JSON: bore, outside, width, corner r, the abutment values; each citing its source or marked an estimate." />}
    {rows.map(r => <div key={r.id} className={ROW} aria-label={`Bearing row ${r.id}`}>
      <span title={r.source ?? 'an estimate'}><b>{r.designation ?? r.id}</b> <span className="muted small">Ø{r.boreMM} × Ø{r.outsideMM} × {r.widthMM} · {r.source ?? 'estimate'}</span></span>
      <Button variant="ghost" aria-label={`Remove bearing row ${r.id}`} title="Remove the row" onClick={() => apply([], [r.id])}><Icon name="delete" small /></Button>
    </div>)}
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><label className="file-button">Add a bearing rows file…<input type="file" accept="application/json,.json" aria-label="Bearing rows file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label></Button>
    </div>
  </section>;
}
