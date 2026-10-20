// The Drafts list in the Browser (A6.4, O28): features made from an image or a drawing, each dimension they were made at
// with its basis; the user confirms one as it is, or at another value (Enter or Confirm), which re-drives the features.
// "Add drawing" reads a DXF file as a sketch draft.
import type { Draft } from '../chat/drafts';

export function DraftsPanel({ drafts, onAddDrawing, onConfirm }: { drafts: readonly Draft[]; onAddDrawing(file: File): void; onConfirm(key: string, value: number | undefined): void }) {
  const open = drafts.reduce((n, d) => n + d.dims.filter(x => !x.confirmed).length, 0);
  return <div className="references" role="region" aria-label="Drafts">
    <div className="ol-head specify-head">Drafts <span className="muted" aria-label="Drafts summary">{drafts.length ? `${open} to confirm` : 'none'}</span>
      <label className="tool tiny" data-tip="Add a drawing (DXF) as a sketch draft"><input type="file" aria-label="Add drawing" accept=".dxf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onAddDrawing(f); e.target.value = ''; }} />＋</label></div>
    {drafts.map(d => <div key={d.id} className="req" role="listitem" aria-label={`Draft ${d.id}`}>
      <span className="req-row" title={d.note ?? ''}><span className="req-mark">✎</span><b>{d.id}</b> {'image' in d.from ? d.from.image : d.from.drawing} <span className="muted">· {'image' in d.from ? 'from an image' : 'from a drawing'} · {d.nodes.length} feature{d.nodes.length === 1 ? '' : 's'}</span></span>
      {d.unitAssumed && d.dims.some(x => !x.confirmed) && <span className="req-edit" aria-label={`${d.id} unit assumed`}><span className="muted">⚠ units assumed mm: the drawing declares none</span></span>}
      {d.dims.map(x => { const key = `${d.id}.${x.name}`; return <span key={key} className="req-edit" aria-label={`Dimension ${key}`}>
        <span className="muted ref-at-label">{x.name}</span>
        <input aria-label={`${key} value`} type="number" step="any" defaultValue={x.value} key={`${key}:${x.value}`} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onConfirm(key, Number(e.currentTarget.value)); }} />
        {x.confirmed ? <span className="muted">✓ confirmed</span> : <button className="ghost small" aria-label={`Confirm ${key}`} onClick={e => onConfirm(key, Number((e.currentTarget.previousSibling as HTMLInputElement).value))}>Confirm</button>}
      </span>; })}
    </div>)}
  </div>;
}
