import { useEffect, useState } from 'react';
import type { Connector } from '@barocss/cad-model/assembly/connectors';
import type { MateFace } from '@barocss/cad-model/assembly/mates';
import { CONTROL, FIELD, TICK } from './panelStyles';
import { NativeSelect } from '@/components/ui/native-select';

/** Options describe a geometry reference; the core remains the authority for their validity. */
export function ConnectorEditor({ label, face, value, onChange }: { label: string; face?: MateFace; value?: Connector; onChange(value: Connector | null): void }) {
  const points = face?.kind === 'line' ? ['start', 'mid', 'end'] : face?.kind === 'circle' && face.ends ? ['centre', 'start', 'mid', 'end'] : face?.kind === 'cone' ? ['centre', 'start', 'end', 'apex'] : face?.kind === 'cylinder' ? ['centre', 'start', 'end'] : ['centre'];
  return <fieldset aria-label={`${label} connector`} className="grid gap-1 border-0 p-0">
    <legend className="muted">{label} connector</legend>
    <label className={FIELD}><span>Connector</span><input className={TICK} type="checkbox" aria-label={`${label} use connector`} checked={value !== undefined} onChange={e => onChange(e.target.checked ? {} : null)} /></label>
    {value !== undefined && <>
      <label className={FIELD}><span>Point</span><NativeSelect className={CONTROL} aria-label={`${label} connector point`} value={value.point ?? ''} onChange={e => { const next = { ...value }; if (e.target.value) next.point = e.target.value as Connector['point']; else delete next.point; onChange(next); }}>
        <option value="">Default</option>{points.map(p => <option key={p} value={p}>{p}</option>)}
      </NativeSelect></label>
      {(['X', 'Y', 'Z'] as const).map((axis, k) => <ConnectorNumber key={axis} label={`${label} offset ${axis}`} title={`Offset ${axis}`} value={value.offset?.[k] ?? 0} unit="mm" onChange={n => { const offset: [number, number, number] = [...value.offset ?? [0, 0, 0]]; offset[k] = n; onChange({ ...value, offset }); }} />)}
      <ConnectorNumber label={`${label} connector turn`} title="Turn" value={value.turn ?? 0} unit="°" onChange={turn => onChange({ ...value, turn })} />
      <label className={FIELD}><span>Flip Z</span><input className={TICK} type="checkbox" aria-label={`${label} connector flip`} checked={value.flip ?? false} onChange={e => onChange({ ...value, flip: e.target.checked })} /></label>
    </>}
  </fieldset>;
}

function ConnectorNumber({ label, title, value, unit, onChange }: { label: string; title: string; value: number; unit: string; onChange(n: number): void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => { const n = Number(draft); if (draft.trim() && Number.isFinite(n) && n !== value) onChange(n); setDraft(String(value)); };
  return <label className={FIELD}><span>{title}</span><span className="num"><input type="number" step="any" aria-label={label} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} /><em>{unit}</em></span></label>;
}
