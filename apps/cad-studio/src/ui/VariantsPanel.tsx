// O11: the Variants card — the assembly's named value sets (the master and its variants; part configurations stay in
// the Parameters card, K), its inputs with what each drives, the values being edited and what they leave unmet. Showing
// a variant regenerates it from the master (state/useVariants); nothing is written until the person saves, updates,
// deletes or switches — each through set_variants, the agent's own action, so both write one way.
import { useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Input, InputValue } from '@barocss/cad-model/engine/schema/variability';
import { runVariabilityTool, variabilityView } from '@barocss/cad-model/chat/variability';
import { MASTER, valueSets, type VariantsState } from '../state/useVariants';
import { Icon } from './atoms';
import { DockSection } from '../layout/DockSection';
import { CONTROL, FIELD, NUM, TICK } from './panelStyles';
import { Button } from '@/components/ui/button';
import { Input as TextInput } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

const SOURCE = { master: 'defaults', variant: 'variant' } as const;
const UNIT = { mm: 'mm', deg: '°' } as const;

export function VariantsPanel({ doc, variants, onCommit, onError, onClose }: {
  doc: StudioDoc; variants: VariantsState; onCommit(next: StudioDoc): void; onError(message: string): void; onClose(): void;
}) {
  const [saveAs, setSaveAs] = useState('');
  const v = doc.variability, view = variabilityView(v), sets = valueSets(doc), active = v?.active ?? MASTER;
  const { base, working, setWorking, problems, error, showing } = variants;
  const values = { ...base, ...working }, changed = Object.keys(working).filter(k => working[k] !== base[k]);
  /** One set_variants call, committed as one undoable edit (a refusal shown, nothing changed). */
  const write = (args: Record<string, unknown>) => {
    const r = runVariabilityTool(doc, 'set_variants', args);
    if (r.isError) { onError(r.summary); return false; }
    onCommit(r.doc); setWorking({}); return true;
  };
  const show = (name: string) => { if (name === active) { setWorking({}); return; } write({ active: name === MASTER ? null : name }); };
  const set = (input: Input, x: InputValue) => setWorking({ ...working, [input.name]: x });
  // (G12c: a dock section — its header folds it, its chip the set shown; closed from the toolbar or Close.)
  return <aside className="card props" aria-label="Variants panel"><DockSection id="variants" title="Variants" summary={showing ?? active}>
    {!v && <div className="empty" role="status">No inputs yet. An input names what it drives (a part's parameter, a feature, a placed part, a mate); the agent's assembly.inputs adds them.</div>}
    {v && <>
      {showing && <div className="mb-2 rounded-md border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-2 py-1.5 text-[11px]" role="status" aria-label="Variant shown">
        Showing <b>{showing}</b>, regenerated from the master. Modelling waits until the master is shown.{' '}
        <Button variant="ghost" size="xs" aria-label="Show the master" onClick={() => show(MASTER)}>Show the master</Button></div>}
      <div className="card-title" style={{ marginTop: 4 }}>VARIANTS · {sets.length}</div>
      <ul className="m-0 list-none p-0" aria-label="Value sets">{sets.map(s => {
        const on = s.name === active;
        return <li key={s.name} className="flex items-center gap-1.5 py-0.5 text-[11px]" aria-label={`Set ${s.name}`} data-active={on || undefined}>
          <span className={'inline-block size-2 shrink-0 rounded-full ' + (on ? 'bg-[var(--accent)]' : 'border border-muted-foreground')} />
          <span className={'min-w-0 flex-1 truncate' + (on ? ' font-semibold' : '')}>{s.name}</span>
          <span className={'shrink-0 rounded-full border px-1.5 text-[10px] leading-4 ' + (on ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-border text-muted-foreground')}>{on ? 'active' : SOURCE[s.source]}</span>
          {!on && <Button variant="ghost" size="xs" aria-label={`Show ${s.name}`} onClick={() => show(s.name)}>Show</Button>}
          {s.source === 'variant' && <Button variant="ghost" size="xs" aria-label={`Delete variant ${s.name}`} onClick={() => write({ variants: { [s.name]: null } })}><Icon name="close" small /></Button>}
        </li>;
      })}</ul>
      <div className="card-title" style={{ marginTop: 8 }}>INPUTS · {v.inputs.length}</div>
      {v.inputs.map((input, k) => {
        const x = values[input.name], edited = changed.includes(input.name), drives = view?.inputs[k]?.drives.join(' · ');
        return <div key={input.name} aria-label={`Input ${input.name}`}>
          <label className={FIELD}><span>{input.name}</span>
            {input.type === 'number' ? <span className={NUM}><TextInput type="number" step="any" min={input.min} max={input.max} aria-label={`Value of ${input.name}`} className={edited ? 'border-[var(--accent)]' : ''}
                value={String(x)} onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) set(input, n); }} onKeyDown={e => e.stopPropagation()} />{input.unit && <em>{UNIT[input.unit]}</em>}</span>
              : input.type === 'boolean' ? <input type="checkbox" className={TICK} aria-label={`Value of ${input.name}`} checked={x === true} onChange={e => set(input, e.target.checked)} />
              : <NativeSelect className={CONTROL + (edited ? ' border-[var(--accent)]' : '')} aria-label={`Value of ${input.name}`} value={String(x)} onChange={e => set(input, e.target.value)}>
                  {(input.choices ?? []).map(c => <option key={c.value} value={c.value}>{c.label ?? c.value}</option>)}</NativeSelect>}
          </label>
          {drives && <div className="-mt-0.5 mb-1 truncate pl-0.5 text-[10px] text-muted-foreground" title={drives}>drives {drives}</div>}
        </div>;
      })}
      {!!changed.length && <div className="py-0.5 text-[11px] text-muted-foreground" aria-label="Values edited">{changed.length} value{changed.length === 1 ? '' : 's'} differ{changed.length === 1 ? 's' : ''} from {active}</div>}
      <form className="flex items-center gap-1 py-0.5" onSubmit={e => { e.preventDefault(); const name = saveAs.trim(); if (name && write({ variants: { [name]: values }, active: name })) setSaveAs(''); }}>
        <TextInput className="min-w-0 flex-1" aria-label="Variant name" placeholder="Save these values as…" value={saveAs} onChange={e => setSaveAs(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <Button type="submit" variant="default" aria-label="Save variant" disabled={!saveAs.trim()}>Save</Button>
      </form>
      {!!changed.length && <div className="flex flex-wrap gap-1">
        {active !== MASTER && <Button variant="ghost" aria-label={`Update ${active}`} onClick={() => write({ variants: { [active]: values } })}>Update {active}</Button>}
        <Button variant="ghost" aria-label={`Reset to ${active}`} onClick={() => setWorking({})}>Reset to {active}</Button>
      </div>}
      {error && <div className="hud-error" role="alert">{error}</div>}
      {/* (One line a mate, its reason — often long — behind Details.) */}
      {problems.map(p => <details key={p.mate} className="text-[11px]" role="status" aria-label={`Unmet mate ${p.mate}`}>
        <summary className="warn cursor-pointer select-none">Mate {p.mate} unmet in this variant</summary><div className="text-muted-foreground">{p.reason}</div></details>)}
    </>}
    <div className="flex justify-end pt-1"><Button variant="ghost" size="xs" aria-label="Close Variants" onClick={onClose}>Close</Button></div>
  </DockSection></aside>;
}
