// The fit tables (R12c.2, D155): the person's own rows of tolerance limits — none is built in (the owner: "끼워맞춤 표는
// 사용자가 불러오고") — loaded from a file, listed with their classes and sources, removed; and the faces given classes
// and the pairs declared (Fit class, Fit pair).
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editFitTables } from '@barocss/cad-model/engine/fits';
import { Icon } from './atoms';
import { ROW } from './panelStyles';
import { Button } from '@/components/ui/button';
import { RowsEmpty } from './RowsEmpty';

export function FitTables({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const tables = doc.fits?.tables ?? [], faces = doc.fits?.faces ?? [], pairs = doc.fits?.pairs ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editFitTables(doc, add, remove); if ('error' in r) { onError('Fit table refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the fit table', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="Fit tables">
    <div className="card-title" style={{ marginTop: 8 }}>FITS</div>
    {!tables.length && <RowsEmpty none="No fit tables" holds="JSON: rows of class, size range and limits, each citing a source or marked an estimate." after="None is built in, and limits are never computed." />}
    {tables.map(t => {
      const classes = [...new Set(t.rows.map(r => r.class))], estimates = t.rows.filter(r => r.estimate).length;
      return <div key={t.id} className={ROW} aria-label={`Fit table ${t.id}`}>
        <span title={(t.sources ?? []).map(s => `${s.label}${s.url ? ` (${s.url})` : ''}`).join('\n') || 'estimates'}><b>{t.id}</b> <span className="muted small">{t.rows.length} row{t.rows.length === 1 ? '' : 's'} · {classes.join(' ')}{estimates ? ` · ${estimates} estimate${estimates === 1 ? '' : 's'}` : ''}</span></span>
        <Button variant="ghost" aria-label={`Remove fit table ${t.id}`} title="Remove the table" onClick={() => apply([], [t.id])}><Icon name="delete" small /></Button>
      </div>;
    })}
    {!!faces.length && <div className="muted small" aria-label="Fit classes">{faces.map(f => `${f.face} ${f.class}`).join(' · ')}{pairs.length ? ` — ${pairs.length} pair${pairs.length === 1 ? '' : 's'}` : ''}</div>}
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><label className="file-button">Add a fit table file…<input type="file" accept="application/json,.json" aria-label="Fit table file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label></Button>
    </div>
  </section>;
}
