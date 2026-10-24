// The part's named parameters (H1 = 20 …) and their sets (configurations): each value editable, renamed
// everywhere it is used, deleted with its uses keeping its value; a configuration is a saved set of
// values, applied in one step. Feature values are bound to a parameter in the feature editor (ƒ). O16: its contents on
// shadcn's Input and Button.
import { useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { addParameters, parameterUses, removeParameter, renameParameter as renamedDoc, withParameters } from '@barocss/cad-model/engine/parameters';
import { Icon } from './atoms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
const without = <T,>(o: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

/** (The parameters' functions are cad-model's core, engine/parameters.ts, O21: the agent's features.parameters calls them too.) */
export { parameterUses, referencesRenamed as renameParameter } from '@barocss/cad-model/engine/parameters';

export function ParametersPanel({ doc, onChange, onError, onClose }: {
  doc: StudioDoc; onChange(next: Pick<StudioDoc, 'parameters' | 'nodes' | 'configurations'>): void; onError(message: string): void; onClose(): void;
}) {
  const params = doc.parameters, configs = doc.configurations ?? {};
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState({ name: '', value: '10' });
  const [configName, setConfigName] = useState('');
  const set = (patch: Partial<Pick<StudioDoc, 'parameters' | 'nodes' | 'configurations'>>) => onChange({ parameters: params, nodes: doc.nodes, configurations: doc.configurations, ...patch });
  const setValue = (name: string, text: string) => {
    const v = Number(text); if (text.trim() === '' || !Number.isFinite(v)) { onError(`${name} takes a number.`); return; }
    if (v !== params[name]) set({ parameters: withParameters(doc, { [name]: v }).parameters });
  };
  const rename = (from: string, to: string) => {
    to = to.trim(); if (to === from) return;
    if (!NAME.test(to)) { onError('A parameter name starts with a letter and has letters, digits and _ (up to 32).'); return; }
    if (to in params) { onError(`There is a parameter ${to} already.`); return; }
    const next = renamedDoc(doc, from, to);
    set({ parameters: next.parameters, nodes: next.nodes, configurations: next.configurations });
  };
  const remove = (name: string) => {
    const next = removeParameter(doc, name);
    set({ parameters: next.parameters, nodes: next.nodes });
  };
  const add = () => {
    const name = adding.name.trim(), v = Number(adding.value);
    if (!NAME.test(name)) { onError('A parameter name starts with a letter and has letters, digits and _ (up to 32).'); return; }
    if (name in params) { onError(`There is a parameter ${name} already.`); return; }
    if (!Number.isFinite(v)) { onError('Give the parameter a number.'); return; }
    set({ parameters: addParameters(doc, { [name]: v }).parameters }); setAdding({ name: '', value: adding.value });
  };
  // The configuration the values match now, if any.
  const current = Object.entries(configs).find(([, vs]) => Object.keys(params).every(k => vs[k] === params[k]) && Object.keys(vs).every(k => k in params))?.[0];
  const row = 'flex items-center gap-1 py-0.5';
  return <aside className="card props" aria-label="Parameters panel">
    <div className="card-title">PARAMETERS <button className="tool tiny" aria-label="Close parameters" onClick={onClose}><Icon name="close" small /></button></div>
    {!Object.keys(params).length && <div className="empty">Name the sizes the part depends on (H1, Width …): bind a feature’s value to one in its editor (ƒ), then change it here.</div>}
    {Object.entries(params).map(([name, value]) => <div key={name} className={row}>
      <Input className="min-w-0 flex-1 mono" aria-label={`Name of ${name}`} defaultValue={name} key={'n' + name} onBlur={e => rename(name, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }} />
      <Input type="number" step="any" className="w-20 text-right" aria-label={`Value of ${name}`} value={draft[name] ?? String(value)} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))}
        onBlur={() => { if (draft[name] !== undefined) { setValue(name, draft[name]); setDraft(d => without(d, name)); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }} />
      <span className="muted small w-6 shrink-0 text-right" title="Features using it">{parameterUses(doc.nodes, name)}×</span>
      <Button variant="ghost" size="xs" aria-label={`Delete ${name}`} data-tip="Delete" data-tip-desc="Its uses keep its value as a number" onClick={() => remove(name)}><Icon name="close" small /></Button>
    </div>)}
    <div className={row}>
      <Input className="min-w-0 flex-1" aria-label="New parameter name" placeholder="Name" value={adding.name} onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); e.stopPropagation(); }} />
      <Input type="number" step="any" className="w-20 text-right" aria-label="New parameter value" value={adding.value} onChange={e => setAdding(a => ({ ...a, value: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); e.stopPropagation(); }} />
      <Button aria-label="Add parameter" onClick={add}>Add</Button>
    </div>
    {Object.keys(params).length > 0 && <>
      <div className="card-title" style={{ marginTop: 10 }}>CONFIGURATIONS</div>
      {Object.keys(configs).map(c => <div key={c} className={row}>
        <span className={'min-w-0 flex-1 truncate' + (c === current ? ' accent' : '')} title={c}>{c}{c === current ? ' · now' : ''}</span>
        <Button variant="ghost" aria-label={`Apply ${c}`} onClick={() => set({ parameters: { ...params, ...Object.fromEntries(Object.entries(configs[c]).filter(([k]) => k in params)) } })}>Apply</Button>
        <Button variant="ghost" size="xs" aria-label={`Delete configuration ${c}`} onClick={() => { set({ configurations: without(configs, c) }); }}><Icon name="close" small /></Button>
      </div>)}
      <div className={row}>
        <Input className="min-w-0 flex-1" aria-label="Configuration name" placeholder="Save these values as…" value={configName} onChange={e => setConfigName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <Button aria-label="Save configuration" disabled={!configName.trim()} onClick={() => { set({ configurations: { ...configs, [configName.trim()]: { ...params } } }); setConfigName(''); }}>Save</Button>
      </div>
    </>}
  </aside>;
}
