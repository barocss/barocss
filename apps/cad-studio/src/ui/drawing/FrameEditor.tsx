// Edit one dimension-attached or explicitly selected standalone geometric control.
import { useState } from 'react';
import { CHARACTERISTICS, checkDrawingFrames, type DrawingFrame, type MaterialModifier } from '@barocss/cad-model/drawing/controls';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import { CONTROL, FIELD, TICK } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function FrameEditor({ dim, frameId, settings, onChange, onRefused }: { dim?: string; frameId?: string; settings: DrawingSettings; onChange(next: DrawingSettings): void; onRefused(message: string): void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!dim && !frameId) return null;
  const frames = settings.frames ?? [], frame = frames.find(f => frameId ? f.dim === undefined && f.id === frameId : f.dim !== undefined && f.dim === dim);
  if (frameId && !frame) return null;
  const set = (next: DrawingFrame, committedDrafts: readonly string[] = []) => {
    const list = frameId ? frames.map(f => f === frame ? next : f) : [...frames.filter(f => f.dim === undefined || f.dim !== dim), next], why = checkDrawingFrames({ frames: list })[0];
    if (why) { onRefused(committedDrafts.some(key => Object.hasOwn(draft, key)) ? `${why.message} This value was not applied; saving keeps the last accepted value.` : why.message); return; }
    onChange({ ...settings, frames: list });
    if (committedDrafts.length) setDraft(current => {
      const nextDraft = { ...current };
      for (const key of committedDrafts) delete nextDraft[key];
      return nextDraft;
    });
  };
  const material = (label: string, value: MaterialModifier | undefined, apply: (value: MaterialModifier | undefined) => void) => <label className={FIELD}><span>{label}</span><NativeSelect className={CONTROL} aria-label={label} value={value ?? 'none'} onChange={e => apply(e.target.value === 'none' ? undefined : e.target.value as MaterialModifier)}>
    <option value="none">None</option><option value="maximum">Maximum (M)</option><option value="least">Least (L)</option>
  </NativeSelect></label>;
  return <section aria-label="Geometric control editor" style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    <div className="card-title" style={{ marginTop: 8 }}>GEOMETRIC CONTROL</div>
    {!frame && dim ? <Button variant="ghost" aria-label="Add geometric control" disabled={frames.length >= 200} onClick={() => {
      let id = `control-${dim}`, n = 2; while (frames.some(f => f.id === id)) id = `control-${dim}-${n++}`;
      set({ id, dim, characteristic: 'position', value: 0.1, datums: [] });
    }}>Add geometric control</Button> : frame && <>
      <label className={FIELD}><span>Characteristic</span><NativeSelect className={CONTROL} aria-label="Geometric characteristic" value={frame.characteristic} onChange={e => {
        const characteristic = e.target.value as DrawingFrame['characteristic'];
        if (frame.composite && characteristic !== 'position') { onRefused('Remove the second segment before changing the characteristic.'); return; }
        set({ ...frame, characteristic });
      }}>
        {CHARACTERISTICS.map(k => <option key={k} value={k}>{k.replaceAll('-', ' ')}</option>)}
      </NativeSelect></label>
      <label className={FIELD}><span>Tolerance</span><Input className={CONTROL} type="number" step="any" aria-label={frame.composite ? "First segment tolerance" : "Geometric tolerance"} value={draft.value ?? frame.value} onChange={e => setDraft({ ...draft, value: e.target.value })}
        onBlur={() => { if (draft.value !== undefined) set({ ...frame, value: draft.value.trim() ? Number(draft.value) : NaN }, ['value']); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
      <label className={FIELD}><span>Diameter zone</span><input className={TICK} type="checkbox" aria-label={frame.composite ? "First segment cylindrical tolerance zone" : "Cylindrical tolerance zone"} checked={frame.diameter ?? frame.characteristic === 'position'} onChange={e => set({ ...frame, diameter: e.target.checked })} /></label>
      {material(frame.composite ? 'First segment material modifier' : 'Material modifier', frame.material, value => { const next = { ...frame }; delete next.material; set(value ? { ...next, material: value } : next); })}
      <label className={FIELD}><span>Datums in order</span><Input className={CONTROL} aria-label={frame.composite ? "First segment datums in order" : "Geometric datums"} placeholder="A, B, C" value={draft.datums ?? frame.datums.join(', ')} onChange={e => setDraft({ ...draft, datums: e.target.value })}
        onBlur={() => { if (draft.datums !== undefined) { const datums = draft.datums.split(',').map(d => d.trim().toUpperCase()).filter(Boolean), next = { ...frame, datums }; delete next.datumModifiers;
          const modifiers = Object.fromEntries(Object.entries(frame.datumModifiers ?? {}).filter(([d]) => datums.includes(d))); set(Object.keys(modifiers).length ? { ...next, datumModifiers: modifiers } : next, ['datums']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
      {frame.datums.map(d => <div key={d}>{material(frame.composite ? `First segment datum ${d} modifier` : `Datum ${d} modifier`, frame.datumModifiers?.[d], value => { const next = { ...frame }, mods = { ...frame.datumModifiers }; delete mods[d]; if (value) mods[d] = value; delete next.datumModifiers; set(Object.keys(mods).length ? { ...next, datumModifiers: mods } : next); })}</div>)}
      <label className={FIELD}><span>{frame.composite ? "First segment projected height" : "Projected height"}</span><Input className={CONTROL} type="number" step="any" aria-label={frame.composite ? "First segment projected zone height" : "Projected zone height"} placeholder="None" value={draft.projected ?? frame.projected ?? ''} onChange={e => setDraft({ ...draft, projected: e.target.value })}
        onBlur={() => { if (draft.projected !== undefined) { const next = { ...frame }; delete next.projected; set(draft.projected.trim() ? { ...next, projected: Number(draft.projected) } : next, ['projected']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
      {(['freeState', 'tangentPlane'] as const).map(flag => <label className={FIELD} key={flag}><span>{frame.composite ? (flag === 'freeState' ? 'First segment free state' : 'First segment tangent plane') : (flag === 'freeState' ? 'Free state' : 'Tangent plane')}</span><input className={TICK} type="checkbox" aria-label={frame.composite ? (flag === 'freeState' ? 'First segment free state modifier' : 'First segment tangent plane modifier') : (flag === 'freeState' ? 'Free state modifier' : 'Tangent plane modifier')} checked={!!frame[flag]} onChange={e => { const next = { ...frame }; delete next[flag]; set(e.target.checked ? { ...next, [flag]: true } : next); }} /></label>)}
      {frame.characteristic === 'position' && (!frame.composite ? <Button variant="ghost" aria-label="Add second segment" title="Copy the first segment values to a second segment" onClick={() => set({ ...frame, composite: {
        value: frame.value, datums: [...frame.datums], ...(frame.diameter !== undefined ? { diameter: frame.diameter } : {}),
        ...(frame.material ? { material: frame.material } : {}), ...(frame.datumModifiers ? { datumModifiers: { ...frame.datumModifiers } } : {}),
      } })}>Add second segment</Button> : <fieldset style={{ minWidth: 0 }}>
        <legend>Second segment</legend>
        <label className={FIELD}><span>Tolerance</span><Input className={CONTROL} type="number" step="any" aria-label="Second segment tolerance" value={draft.compositeValue ?? frame.composite.value} onChange={e => setDraft({ ...draft, compositeValue: e.target.value })}
          onBlur={() => { if (draft.compositeValue !== undefined && frame.composite) set({ ...frame, composite: { ...frame.composite, value: draft.compositeValue.trim() ? Number(draft.compositeValue) : NaN } }, ['compositeValue']); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        <label className={FIELD}><span>Diameter zone</span><input className={TICK} type="checkbox" aria-label="Second segment cylindrical tolerance zone" checked={frame.composite.diameter ?? true} onChange={e => { if (frame.composite) set({ ...frame, composite: { ...frame.composite, diameter: e.target.checked } }); }} /></label>
        {material('Second segment material modifier', frame.composite.material, value => { if (!frame.composite) return; const next = { ...frame.composite }; delete next.material; set({ ...frame, composite: value ? { ...next, material: value } : next }); })}
        <label className={FIELD}><span>Datums in order</span><Input className={CONTROL} aria-label="Second segment datums in order" placeholder="A, B, C" value={draft.compositeDatums ?? frame.composite.datums.join(', ')} onChange={e => setDraft({ ...draft, compositeDatums: e.target.value })}
          onBlur={() => { if (draft.compositeDatums !== undefined && frame.composite) { const datums = draft.compositeDatums.split(',').map(d => d.trim().toUpperCase()).filter(Boolean), next = { ...frame.composite, datums }; delete next.datumModifiers;
            const modifiers = Object.fromEntries(Object.entries(frame.composite.datumModifiers ?? {}).filter(([d]) => datums.includes(d))); set({ ...frame, composite: Object.keys(modifiers).length ? { ...next, datumModifiers: modifiers } : next }, ['compositeDatums']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        {frame.composite.datums.map(d => <div key={d}>{material(`Second segment datum ${d} modifier`, frame.composite?.datumModifiers?.[d], value => { if (!frame.composite) return; const next = { ...frame.composite }, mods = { ...frame.composite.datumModifiers }; delete mods[d]; if (value) mods[d] = value; delete next.datumModifiers; set({ ...frame, composite: Object.keys(mods).length ? { ...next, datumModifiers: mods } : next }); })}</div>)}
        <Button variant="ghost" aria-label="Remove second segment" onClick={() => { const next = { ...frame }; delete next.composite; set(next, ['compositeValue', 'compositeDatums']); }}>Remove second segment</Button>
      </fieldset>)}
      <Button variant="ghost" aria-label="Remove geometric control" onClick={() => { const next = { ...settings }; delete next.frames; const keep = frames.filter(f => frameId ? f !== frame : f.dim === undefined || f.dim !== dim); onChange(keep.length ? { ...next, frames: keep } : next); }}>Remove geometric control</Button>
    </>}
  </section>;
}
