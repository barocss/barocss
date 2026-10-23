// The retaining-ring rows (O139): the person's own rows — a groove's shaft Ø, groove Ø and width, each citing its source
// or marked an estimate; none is built in — loaded from a file, listed, removed (a row a ring uses stays).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editRingRows } from '@barocss/cad-model/engine/rings';
import { Icon } from './atoms';
import { ROW } from './panelStyles';
import { Button } from '@/components/ui/button';
import { RowsEmpty } from './RowsEmpty';

export function RingRows({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.rings?.rows ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editRingRows(doc, add, remove); if ('error' in r) { onError('Ring row refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the ring rows', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="Ring rows">
    <div className="card-title" style={{ marginTop: 8 }}>RINGS</div>
    {!rows.length && <RowsEmpty none="No ring rows" holds="JSON: shaftDiameterMM, grooveDiameterMM, grooveWidthMM; each citing its source or marked an estimate." />}
    {rows.map(r => <div key={r.id} className={ROW} aria-label={`Ring row ${r.id}`}>
      <span title={r.source ?? 'an estimate'}><b>{r.designation ?? r.id}</b> <span className="muted small">Ø{r.shaftDiameterMM} shaft · groove Ø{r.grooveDiameterMM} × {r.grooveWidthMM} · {r.source ?? 'estimate'}</span></span>
      <Button variant="ghost" aria-label={`Remove ring row ${r.id}`} title="Remove the row" onClick={() => apply([], [r.id])}><Icon name="delete" small /></Button>
    </div>)}
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><label className="file-button">Add a ring rows file…<input type="file" accept="application/json,.json" aria-label="Ring rows file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label></Button>
    </div>
  </section>;
}
