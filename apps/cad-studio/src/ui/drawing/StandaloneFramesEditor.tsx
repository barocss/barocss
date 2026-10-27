// Standalone frames are annotations in an explicitly selected view, not measured geometry.
import { useState, type CSSProperties } from 'react';
import type { DrawingFrame } from '@barocss/cad-model/drawing/controls';
import type { DimView, DrawingSettings } from '@barocss/cad-model/drawing/types';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

const WRAP: CSSProperties = { minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', boxSizing: 'border-box' };

export function StandaloneFramesEditor({ settings, availableViews, selected, ready, onSelect, onAdd, onMove, onRemove }: {
  settings: DrawingSettings; availableViews: readonly DimView[]; selected: string | null; ready: boolean;
  onSelect(id: string): void; onAdd(view: DimView): void; onMove(frame: DrawingFrame): void; onRemove(frame: DrawingFrame): void;
}) {
  const [view, setView] = useState<DimView>('front');
  const frames = (settings.frames ?? []).filter((f): f is Extract<DrawingFrame, { view: DimView }> => f.dim === undefined);
  return <details open aria-label="Standalone geometric controls" style={WRAP}>
    <summary>Standalone geometric controls ({frames.length})</summary>
    <p className="text-[11px] text-muted-foreground">Choose a visible view, then click where the frame goes. This annotation does not measure geometry.</p>
    <label style={{ ...WRAP, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>Frame view
      <NativeSelect aria-label="Standalone frame view" value={view} style={{ minWidth: 0, maxWidth: '100%' }} onChange={e => setView(e.target.value as DimView)}>
        {Array.from(new Set([view, ...availableViews])).map(id => <option key={id} value={id}>{id}{availableViews.includes(id) ? '' : ' (not shown)'}</option>)}
      </NativeSelect>
    </label>
    <Button variant="ghost" size="xs" style={{ ...WRAP, height: 'auto' }} disabled={!ready || !availableViews.includes(view) || (settings.frames?.length ?? 0) >= 200} onClick={() => onAdd(view)}>Add standalone frame</Button>
    {frames.map((frame, index) => <div key={frame.id} className={selected === frame.id ? 'dw-dim sel' : 'dw-dim'} style={{ ...WRAP, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', width: '100%', alignItems: 'stretch' }}>
      <Button variant="ghost" size="xs" style={{ ...WRAP, height: 'auto', justifyContent: 'flex-start', textAlign: 'left' }} aria-pressed={selected === frame.id} onClick={() => onSelect(frame.id)}>Frame {index + 1} · {frame.characteristic.replaceAll('-', ' ')} · {frame.view}</Button>
      {!availableViews.includes(frame.view) && <div role="status" className="text-[11px]">The frame view is not shown. Its saved position is kept.</div>}
      <details className="text-[11px]" style={WRAP}><summary>Frame details</summary><div>ID: {frame.id}</div><div>Position [{frame.place.join(', ')}] view mm</div></details>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
        <Button variant="ghost" size="xs" style={{ ...WRAP, height: 'auto' }} disabled={!ready || !availableViews.includes(frame.view)} aria-label={`Move standalone frame ${index + 1}`} onClick={() => onMove(frame)}>Move frame</Button>
        <Button variant="ghost" size="xs" style={{ ...WRAP, height: 'auto' }} aria-label={`Remove standalone frame ${index + 1}`} onClick={() => onRemove(frame)}>Remove frame</Button>
      </div>
    </div>)}
  </details>;
}
