// Edit one dimension-attached or explicitly selected standalone geometric control.
import { useState } from 'react';
import { CHARACTERISTICS, checkDrawingFrames, frameProblem, frameRules, readFrames, type AroundModifier, type DrawingFrame, type MaterialModifier } from '@barocss/cad-model/drawing/controls';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import { CONTROL, FIELD, TICK } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

const SECOND_ROW: readonly string[] = ['position', 'profile-line', 'profile-surface'];
export function FrameEditor({ dim, frameId, settings, onChange, onRefused }: { dim?: string; frameId?: string; settings: DrawingSettings; onChange(next: DrawingSettings): void; onRefused(message: string): void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!dim && !frameId) return null;
  const frames = settings.frames ?? [], frame = frames.find(f => frameId ? f.dim === undefined && f.id === frameId : f.dim !== undefined && f.dim === dim);
  if (frameId && !frame) return null;
  const profile = frame?.characteristic === 'profile-line' || frame?.characteristic === 'profile-surface', problems = frame ? frameRules(frame) : [];
  const set = (next: DrawingFrame, committedDrafts: readonly string[] = []) => {
    const list = frameId ? frames.map(f => f === frame ? next : f) : [...frames.filter(f => f.dim === undefined || f.dim !== dim), next], why = checkDrawingFrames({ frames: list }, frames)[0];
    // (The editor names what is wrong with this frame; the list-wide contract message is for tools and agents.)
    if (why) { const reason = frameProblem(next) ?? frameRules(next)[0] ?? 'This change would make the frames invalid.'; onRefused(committedDrafts.some(key => Object.hasOwn(draft, key)) ? `${reason} Not applied; the frame keeps its last accepted value.` : reason); return; }
    onChange({ ...settings, frames: readFrames(list) });
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
        if ((frame.composite || frame.stacked) && !SECOND_ROW.includes(characteristic)) { onRefused('Remove the second segment or stacked frame before changing the characteristic.'); return; }
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
      {SECOND_ROW.includes(frame.characteristic) && !frame.stacked && (!frame.composite ? <Button variant="ghost" aria-label="Add second segment" title="Copy the first segment values to a second segment" onClick={() => set({ ...frame, composite: {
        value: frame.value, datums: [...frame.datums], ...(frame.diameter !== undefined ? { diameter: frame.diameter } : {}),
        ...(frame.material ? { material: frame.material } : {}), ...(frame.datumModifiers ? { datumModifiers: { ...frame.datumModifiers } } : {}),
      } })}>Add second segment</Button> : <fieldset style={{ minWidth: 0 }}>
        <legend>Second segment</legend>
        <label className={FIELD}><span>Tolerance</span><Input className={CONTROL} type="number" step="any" aria-label="Second segment tolerance" value={draft.compositeValue ?? frame.composite.value} onChange={e => setDraft({ ...draft, compositeValue: e.target.value })}
          onBlur={() => { if (draft.compositeValue !== undefined && frame.composite) set({ ...frame, composite: { ...frame.composite, value: draft.compositeValue.trim() ? Number(draft.compositeValue) : NaN } }, ['compositeValue']); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        <label className={FIELD}><span>Diameter zone</span><input className={TICK} type="checkbox" aria-label="Second segment cylindrical tolerance zone" checked={frame.composite.diameter ?? frame.characteristic === 'position'} onChange={e => { if (frame.composite) set({ ...frame, composite: { ...frame.composite, diameter: e.target.checked } }); }} /></label>
        {material('Second segment material modifier', frame.composite.material, value => { if (!frame.composite) return; const next = { ...frame.composite }; delete next.material; set({ ...frame, composite: value ? { ...next, material: value } : next }); })}
        <label className={FIELD}><span>Datums in order</span><Input className={CONTROL} aria-label="Second segment datums in order" placeholder="A, B, C" value={draft.compositeDatums ?? frame.composite.datums.join(', ')} onChange={e => setDraft({ ...draft, compositeDatums: e.target.value })}
          onBlur={() => { if (draft.compositeDatums !== undefined && frame.composite) { const datums = draft.compositeDatums.split(',').map(d => d.trim().toUpperCase()).filter(Boolean), next = { ...frame.composite, datums }; delete next.datumModifiers;
            const modifiers = Object.fromEntries(Object.entries(frame.composite.datumModifiers ?? {}).filter(([d]) => datums.includes(d))); set({ ...frame, composite: Object.keys(modifiers).length ? { ...next, datumModifiers: modifiers } : next }, ['compositeDatums']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        {frame.composite.datums.map(d => <div key={d}>{material(`Second segment datum ${d} modifier`, frame.composite?.datumModifiers?.[d], value => { if (!frame.composite) return; const next = { ...frame.composite }, mods = { ...frame.composite.datumModifiers }; delete mods[d]; if (value) mods[d] = value; delete next.datumModifiers; set({ ...frame, composite: Object.keys(mods).length ? { ...next, datumModifiers: mods } : next }); })}</div>)}
        <Button variant="ghost" aria-label="Remove second segment" onClick={() => { const next = { ...frame }; delete next.composite; set(next, ['compositeValue', 'compositeDatums']); }}>Remove second segment</Button>
      </fieldset>)}
      {frame.characteristic === 'position' && <label className={FIELD}><span>Spherical zone</span><input className={TICK} type="checkbox" aria-label="Spherical tolerance zone" checked={!!frame.sphere} onChange={e => { const next = { ...frame }; delete next.sphere; set(e.target.checked ? { ...next, sphere: true } : next); }} /></label>}
      {profile && <label className={FIELD}><span>All around / over</span><NativeSelect className={CONTROL} aria-label="Profile all around or all over" value={frame.around ?? 'none'} onChange={e => { const next = { ...frame }; delete next.around; set(e.target.value === 'none' ? next : { ...next, around: e.target.value as AroundModifier }); }}>
        <option value="none">None</option><option value="all-around">All around</option><option value="all-over">All over</option>
      </NativeSelect></label>}
      {SECOND_ROW.includes(frame.characteristic) && !frame.composite && (!frame.stacked ? <Button variant="ghost" aria-label="Add stacked frame" title="A second, independent frame below this one" onClick={() => set({ ...frame, stacked: { value: frame.value, datums: [...frame.datums], ...(frame.diameter !== undefined ? { diameter: frame.diameter } : {}) } })}>Add stacked frame</Button> : <fieldset style={{ minWidth: 0 }}>
        <legend>Stacked frame</legend>
        <label className={FIELD}><span>Tolerance</span><Input className={CONTROL} type="number" step="any" aria-label="Stacked frame tolerance" value={draft.stackedValue ?? frame.stacked.value} onChange={e => setDraft({ ...draft, stackedValue: e.target.value })}
          onBlur={() => { if (draft.stackedValue !== undefined && frame.stacked) set({ ...frame, stacked: { ...frame.stacked, value: draft.stackedValue.trim() ? Number(draft.stackedValue) : NaN } }, ['stackedValue']); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        <label className={FIELD}><span>Diameter zone</span><input className={TICK} type="checkbox" aria-label="Stacked frame cylindrical tolerance zone" checked={frame.stacked.diameter ?? frame.characteristic === 'position'} onChange={e => { if (frame.stacked) set({ ...frame, stacked: { ...frame.stacked, diameter: e.target.checked } }); }} /></label>
        <label className={FIELD}><span>Datums in order</span><Input className={CONTROL} aria-label="Stacked frame datums in order" placeholder="A, B, C" value={draft.stackedDatums ?? frame.stacked.datums.join(', ')} onChange={e => setDraft({ ...draft, stackedDatums: e.target.value })}
          onBlur={() => { if (draft.stackedDatums !== undefined && frame.stacked) { const datums = draft.stackedDatums.split(',').map(d => d.trim().toUpperCase()).filter(Boolean), next = { ...frame.stacked, datums }; delete next.datumModifiers; set({ ...frame, stacked: next }, ['stackedDatums']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        <Button variant="ghost" aria-label="Remove stacked frame" onClick={() => { const next = { ...frame }; delete next.stacked; set(next, ['stackedValue', 'stackedDatums']); }}>Remove stacked frame</Button>
      </fieldset>)}
      <details aria-label="Frame options details"><summary>Details</summary>
        {frame.datums.map(d => <div key={d}>{material(frame.composite ? `First segment datum ${d} modifier` : `Datum ${d} modifier`, frame.datumModifiers?.[d], value => { const next = { ...frame }, mods = { ...frame.datumModifiers }; delete mods[d]; if (value) mods[d] = value; delete next.datumModifiers; set(Object.keys(mods).length ? { ...next, datumModifiers: mods } : next); })}</div>)}
        <label className={FIELD}><span>{frame.composite ? "First segment projected height" : "Projected height"}</span><Input className={CONTROL} type="number" step="any" aria-label={frame.composite ? "First segment projected zone height" : "Projected zone height"} placeholder="None" value={draft.projected ?? frame.projected ?? ''} onChange={e => setDraft({ ...draft, projected: e.target.value })}
          onBlur={() => { if (draft.projected !== undefined) { const next = { ...frame }; delete next.projected; set(draft.projected.trim() ? { ...next, projected: Number(draft.projected) } : next, ['projected']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
        {(['freeState', 'tangentPlane'] as const).map(flag => <label className={FIELD} key={flag}><span>{frame.composite ? (flag === 'freeState' ? 'First segment free state' : 'First segment tangent plane') : (flag === 'freeState' ? 'Free state' : 'Tangent plane')}</span><input className={TICK} type="checkbox" aria-label={frame.composite ? (flag === 'freeState' ? 'First segment free state modifier' : 'First segment tangent plane modifier') : (flag === 'freeState' ? 'Free state modifier' : 'Tangent plane modifier')} checked={!!frame[flag]} onChange={e => { const next = { ...frame }; delete next[flag]; set(e.target.checked ? { ...next, [flag]: true } : next); }} /></label>)}
        <label className={FIELD}><span>Statistical tolerance</span><input className={TICK} type="checkbox" aria-label="Statistical tolerance (ST)" checked={!!frame.statistical} onChange={e => { const next = { ...frame }; delete next.statistical; set(e.target.checked ? { ...next, statistical: true } : next); }} /></label>
        {profile && <label className={FIELD}><span>Unequal amount</span><Input className={CONTROL} type="number" step="any" aria-label="Unequal profile amount" placeholder="None" value={draft.unequal ?? frame.unequal ?? ''} onChange={e => setDraft({ ...draft, unequal: e.target.value })}
          onBlur={() => { if (draft.unequal !== undefined) { const next = { ...frame }; delete next.unequal; set(draft.unequal.trim() ? { ...next, unequal: Number(draft.unequal) } : next, ['unequal']); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>}
      </details>
      {problems.length > 0 && <div role="alert" aria-label="Frame problems" className="text-[11px]">{problems.map(p => <div key={p}>{p}</div>)}</div>}
      <Button variant="ghost" aria-label="Remove geometric control" onClick={() => { const next = { ...settings }; delete next.frames; const keep = frames.filter(f => frameId ? f !== frame : f.dim === undefined || f.dim !== dim); onChange(keep.length ? { ...next, frames: keep } : next); }}>Remove geometric control</Button>
    </>}
  </section>;
}
