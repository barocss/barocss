// The drive rows (R12c.6b, D161): the person's own chains, belts (timing, V, flat) and couplings — none is built in —
// loaded from a file, listed with their sizes and sources, removed (a row a feature uses stays).
import type { DriveRow } from '@barocss/cad';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { editDriveRows } from '@barocss/cad-model/engine/drives';
import { Icon } from './atoms';
import { ROW } from './panelStyles';
import { Button } from '@/components/ui/button';
import { RowsEmpty } from './RowsEmpty';

const sizes = (r: DriveRow) => r.kind === 'chain' ? `chain p ${r.pitch}, roller Ø${r.rollerDiameter}` : r.kind === 'timing-belt' ? `timing p ${r.pitch}, u ${r.pitchLineOffset}` : r.kind === 'v-belt' ? `V ${r.angle}°, datum width ${r.datumWidth}` : r.kind === 'flat-belt' ? `flat ${r.width} × ${r.thickness}` : `coupling Ø${r.outside} × ${r.length}, bores Ø${r.bore[0]}/Ø${r.bore[1]}`;

export function DriveRows({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const rows = doc.drives?.rows ?? [];
  const apply = (add: unknown[], remove: string[] = []) => { const r = editDriveRows(doc, add, remove); if ('error' in r) { onError('Drive row refused', r.error); return; } onCommit(r.doc); };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the drive rows', cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section aria-label="Drive rows">
    <div className="card-title" style={{ marginTop: 8 }}>DRIVES</div>
    {!rows.length && <RowsEmpty none="No drive rows" holds="Chains, belts and couplings (JSON), each with its kind; each citing its source or marked an estimate." />}
    {rows.map(r => <div key={r.id} className={ROW} aria-label={`Drive row ${r.id}`}>
      <span title={r.source ?? 'an estimate'}><b>{r.id}</b> <span className="muted small">{sizes(r)} · {r.source ?? 'estimate'}</span></span>
      <Button variant="ghost" aria-label={`Remove drive row ${r.id}`} title="Remove the row" onClick={() => apply([], [r.id])}><Icon name="delete" small /></Button>
    </div>)}
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" asChild><label className="file-button">Add a drive rows file…<input type="file" accept="application/json,.json" aria-label="Drive rows file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label></Button>
    </div>
  </section>;
}
