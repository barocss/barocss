// The drawing's detail views (CG5, DR-1): each with its letter and parent, its scale (Auto: the smallest standard scale at
// least twice the sheet's) and a remove button. A detail is added with the Detail view tool (E) on the sheet; dragged by
// its drawing to move it.
import type { SheetLayout } from '@barocss/cad-model/drawing/views';
import { SCALES, scaleLabel } from '@barocss/cad-model/drawing/views';
import type { Sheet } from '@barocss/cad-model/drawing/sheet';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import { detailScale } from '@barocss/cad-model/drawing/detail';
import { Icon } from '../atoms';
import { CONTROL, FIELD } from './sheetShared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

const parentName = (view: string) => view.startsWith('section:') ? `section ${view.slice(8)}–${view.slice(8)}` : `${view} view`;

export function DetailsList({ settings, sheet, layout, onChange }: { settings: DrawingSettings; sheet: Sheet | null; layout: SheetLayout | null; onChange(next: DrawingSettings): void }) {
  const list = settings.details ?? [];
  if (!list.length) return null;
  const set = (next: DrawingSettings['details']) => { const rest = { ...settings }; delete rest.details; onChange(next?.length ? { ...rest, details: next } : rest); };
  return <>
    <div className="card-title">DETAILS</div>
    {list.map(d => {
      const shown = sheet?.details?.find(x => x.id === d.id), missing = sheet?.detailsMissing?.find(x => x.id === d.id), dims = settings.dimensions.filter(x => x.view === `detail:${d.id}`).length;
      return <div key={d.id} className={FIELD} aria-label={`Detail ${d.id}`}>
        <span>Detail {d.id} · {parentName(d.view)}</span>
        <NativeSelect className={CONTROL} aria-label={`Detail ${d.id} scale`} value={d.scale ?? 'auto'} onChange={e => { const v = e.target.value; set(list.map(x => { if (x.id !== d.id) return x; const rest = { ...x }; delete rest.scale; return v === 'auto' ? rest : { ...rest, scale: Number(v) }; })); }}>
          <option value="auto">Auto{layout && d.scale === undefined ? ` (${scaleLabel(detailScale(d, layout.scale))})` : ''}</option>
          {SCALES.map(s => <option key={s} value={s}>{scaleLabel(s)}</option>)}
        </NativeSelect>
        <Button variant="ghost" size="xs" aria-label={`Remove detail ${d.id}`} title={dims ? `Remove detail ${d.id} (its ${dims} dimension${dims > 1 ? 's are' : ' is'} lost)` : `Remove detail ${d.id}`} onClick={() => set(list.filter(x => x.id !== d.id))}><Icon name="close" small /></Button>
        {!shown && missing && <div className="empty" style={{ color: 'var(--warn)' }}>{missing.why === 'parent' ? `Its ${parentName(d.view)} is not on the sheet.` : missing.why === 'room' ? 'No free room on the sheet for it.' : 'Its circle holds no line of the part.'}</div>}
      </div>;
    })}
  </>;
}
