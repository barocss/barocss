// The selected dimension's TOLERANCE (O16, split from DrawingWorkspace): none, ±, upper / lower, or a fit.
import type { Dispatch, SetStateAction } from 'react';
import type { DrawingDimension, DrawingSettings, Tolerance } from '@barocss/cad-model/drawing/types';

export function ToleranceEditor({ selDim, settings, tolDraft, setTolDraft, commitDims, setMessage }: {
  selDim: DrawingDimension | undefined; settings: DrawingSettings; tolDraft: Record<string, string>; setTolDraft: Dispatch<SetStateAction<Record<string, string>>>;
  commitDims(dimensions: DrawingDimension[]): void; setMessage(message: string | null): void;
}) {
  return <>
        {selDim && <>
          <div className="card-title" style={{ marginTop: 8 }}>TOLERANCE</div>
          <label className="field"><span>Kind</span><select aria-label="Tolerance" value={selDim.tol?.kind ?? 'none'} onChange={e => {
            const k = e.target.value, rest = { ...selDim }; delete rest.tol;
            const tol: Tolerance | null = k === 'symmetric' ? { kind: 'symmetric', value: 0.1 } : k === 'deviation' ? { kind: 'deviation', upper: 0.1, lower: 0 } : k === 'fit' ? { kind: 'fit', code: selDim.kind === 'diameter' ? 'H7' : 'h7' } : null;
            setTolDraft({}); commitDims(settings.dimensions.map(d => d.id === selDim.id ? (tol ? { ...rest, tol } : rest) as DrawingDimension : d));
          }}><option value="none">None</option><option value="symmetric">± symmetric</option><option value="deviation">Upper / lower</option><option value="fit">Fit (H7, h6 …)</option></select></label>
          {selDim.tol && (selDim.tol.kind === 'symmetric' ? [['value', '±']] : selDim.tol.kind === 'deviation' ? [['upper', 'Upper'], ['lower', 'Lower']] : [['code', 'Fit']]).map(([key, label]) => {
            const t = selDim.tol as Record<string, unknown>, shown = tolDraft[key] ?? String(t[key]);
            const apply = () => {
              const raw = tolDraft[key]; if (raw === undefined) return;
              const next = { ...t, [key]: key === 'code' ? raw.trim() : Number(raw) } as Tolerance;
              const ok = next.kind === 'fit' ? /^[A-Za-z]{1,2}\d{1,2}$/.test(next.code) : next.kind === 'symmetric' ? Number.isFinite(next.value) && next.value > 0 : Number.isFinite(next.upper) && Number.isFinite(next.lower) && next.upper >= next.lower;
              if (ok) commitDims(settings.dimensions.map(d => d.id === selDim.id ? { ...d, tol: next } as DrawingDimension : d));
              else setMessage(next.kind === 'fit' ? 'A fit is a letter or two and a grade, as H7 or js6.' : next.kind === 'symmetric' ? 'A ± tolerance is a number above 0.' : 'The upper deviation must not be below the lower.');
              setTolDraft(m => { const rest = { ...m }; delete rest[key]; return rest; });
            };
            return <label key={key} className="field"><span>{label}</span><input aria-label={`Tolerance ${label}`} type={key === 'code' ? 'text' : 'number'} step="any" value={shown}
              onChange={e => setTolDraft(m => ({ ...m, [key]: e.target.value }))} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>;
          })}
        </>}
  </>;
}
