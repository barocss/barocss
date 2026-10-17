// The part's named parameters (H1 = 20 …) and their sets (configurations): each value editable, renamed
// everywhere it is used, deleted with its uses keeping its value; a configuration is a saved set of
// values, applied in one step. Feature values are bound to a parameter in the feature editor (ƒ).
import { useState } from 'react';
import type { ModelNode, StudioDoc } from '../engine/doc';
import { Icon } from './atoms';

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
const without = <T,>(o: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

/** The nodes with every reference to `from` made `to` (a name, or a number: the reference dropped). */
export function renameParameter(nodes: readonly ModelNode[], from: string, to: string | number): ModelNode[] {
  return JSON.parse(JSON.stringify(nodes), (_k, v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && v.parameter === from ? (typeof to === 'number' ? to : { parameter: to }) : v) as ModelNode[];
}
/** How many features use a parameter. */
export const parameterUses = (nodes: readonly ModelNode[], name: string) => nodes.filter(n => JSON.stringify(n).includes(`{"parameter":${JSON.stringify(name)}}`)).length;

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
    if (v !== params[name]) set({ parameters: { ...params, [name]: v } });
  };
  const rename = (from: string, to: string) => {
    to = to.trim(); if (to === from) return;
    if (!NAME.test(to)) { onError('A parameter name starts with a letter and has letters, digits and _ (up to 32).'); return; }
    if (to in params) { onError(`There is a parameter ${to} already.`); return; }
    const next = Object.fromEntries(Object.entries(params).map(([k, v]) => [k === from ? to : k, v]));
    set({ parameters: next, nodes: renameParameter(doc.nodes, from, to), configurations: Object.fromEntries(Object.entries(configs).map(([c, vs]) => [c, Object.fromEntries(Object.entries(vs).map(([k, v]) => [k === from ? to : k, v]))])) });
  };
  const remove = (name: string) => {
    set({ parameters: without(params, name), nodes: renameParameter(doc.nodes, name, params[name]) });
  };
  const add = () => {
    const name = adding.name.trim(), v = Number(adding.value);
    if (!NAME.test(name)) { onError('A parameter name starts with a letter and has letters, digits and _ (up to 32).'); return; }
    if (name in params) { onError(`There is a parameter ${name} already.`); return; }
    if (!Number.isFinite(v)) { onError('Give the parameter a number.'); return; }
    set({ parameters: { ...params, [name]: v } }); setAdding({ name: '', value: adding.value });
  };
  // The configuration the values match now, if any.
  const current = Object.entries(configs).find(([, vs]) => Object.keys(params).every(k => vs[k] === params[k]) && Object.keys(vs).every(k => k in params))?.[0];
  return <aside className="card props" aria-label="Parameters">
    <div className="card-title">PARAMETERS <button className="tool tiny" aria-label="Close parameters" onClick={onClose}><Icon name="close" small /></button></div>
    {!Object.keys(params).length && <div className="empty">Name the sizes the part depends on (H1, Width …): bind a feature’s value to one in its editor (ƒ), then change it here.</div>}
    {Object.entries(params).map(([name, value]) => <div key={name} className="param-row">
      <input className="kv-input" aria-label={`Name of ${name}`} defaultValue={name} key={'n' + name} onBlur={e => rename(name, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }} />
      <span className="num"><input type="number" step="any" aria-label={`Value of ${name}`} value={draft[name] ?? String(value)} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))}
        onBlur={() => { if (draft[name] !== undefined) { setValue(name, draft[name]); setDraft(d => without(d, name)); } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }} /></span>
      <span className="muted small" title="Features using it">{parameterUses(doc.nodes, name)}×</span>
      <button className="tool tiny" aria-label={`Delete ${name}`} data-tip="Delete" data-tip-desc="Its uses keep its value as a number" onClick={() => remove(name)}><Icon name="close" small /></button>
    </div>)}
    <div className="param-row add">
      <input className="kv-input" aria-label="New parameter name" placeholder="Name" value={adding.name} onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); e.stopPropagation(); }} />
      <span className="num"><input type="number" step="any" aria-label="New parameter value" value={adding.value} onChange={e => setAdding(a => ({ ...a, value: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') add(); e.stopPropagation(); }} /></span>
      <button className="ghost small" aria-label="Add parameter" onClick={add}>Add</button>
    </div>
    {Object.keys(params).length > 0 && <>
      <div className="card-title" style={{ marginTop: 10 }}>CONFIGURATIONS</div>
      {Object.keys(configs).map(c => <div key={c} className="param-row">
        <span className={c === current ? 'accent' : ''}>{c}{c === current ? ' · now' : ''}</span>
        <button className="ghost small" aria-label={`Apply ${c}`} onClick={() => set({ parameters: { ...params, ...Object.fromEntries(Object.entries(configs[c]).filter(([k]) => k in params)) } })}>Apply</button>
        <button className="tool tiny" aria-label={`Delete configuration ${c}`} onClick={() => { set({ configurations: without(configs, c) }); }}><Icon name="close" small /></button>
      </div>)}
      <div className="param-row add">
        <input className="kv-input" aria-label="Configuration name" placeholder="Save these values as…" value={configName} onChange={e => setConfigName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
        <button className="ghost small" aria-label="Save configuration" disabled={!configName.trim()} onClick={() => { set({ configurations: { ...configs, [configName.trim()]: { ...params } } }); setConfigName(''); }}>Save</button>
      </div>
    </>}
  </aside>;
}
