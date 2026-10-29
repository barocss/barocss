import { useEffect, useState } from 'react';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import type { BearingAssemblyInput } from '@barocss/cad-model/engine/bearingContext';
import { editFields, type BindableField } from '@barocss/cad-model/app/editFields';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
export function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onDelete, parameters, onRefuse, bearingAssembly, pending = false }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[]): void; onClose(): void; onEditSketch?(): void; onDelete?(): void; parameters: Record<string, number>; onRefuse(message: string): void; bearingAssembly?: BearingAssemblyInput; pending?: boolean }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(nodes); setTyped({}); }, [nodes, index]);
  const fields = editFields(draft, index, parameters, bearingAssembly).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const names = Object.keys(parameters);
  const changed = draft !== nodes;
  return (
    <div className="node-editor" onKeyDown={e => { if (e.key === 'Enter' && changed && !pending) onApply(draft); else if (e.key === 'Escape') onClose(); else if (e.key === 'Delete' && !pending && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) onDelete?.(); }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <ToolIconButton size="tiny" aria-label="Close editor" onClick={onClose}><Icon name="close" small /></ToolIconButton></div>
      {onEditSketch && <button className="ghost" aria-label="Edit sketch" title="Reopen the sketch this feature is made from, with its constraints" onClick={onEditSketch}><Icon name="draw" small /> Edit sketch</button>}
      {fields.length ? fields.map(f => (
        <label key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step="any" aria-label={f.label} value={typed[f.key] ?? f.get(draft)} disabled={pending || !!(f as BindableField).param?.(draft)} onChange={e => { const t = e.target.value, v = Number(t); setTyped(m => ({ ...m, [f.key]: t })); if (t.trim() !== '' && Number.isFinite(v)) setDraft(d => f.set(d, v)); }} />{f.unit && <em>{f.unit}</em>}
            {names.length > 0 && 'bind' in f && <select className="param-bind" disabled={pending} aria-label={`${f.label} parameter`} data-tip="Parameter" data-tip-desc="Bind this value to a named parameter (Parameters panel)" value={(f as BindableField).param(draft) ?? ''}
              onChange={e => { const b = f as BindableField, name = e.target.value; if (!name) { setDraft(d => b.set(d, b.get(d))); return; } const next = b.bind(draft, name); if (next) { setDraft(next); setTyped(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== f.key))); } else onRefuse(`${f.label} is not stored as it is shown, so it cannot take a parameter.`); }}>
              <option value="">ƒ</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}</span>
            : f.kind === 'choice' ? <select disabled={pending} aria-label={f.label} value={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.value))}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" disabled={pending} aria-label={f.label} checked={f.get(draft)} onChange={e => setDraft(d => f.set(d, e.target.checked))} />}
        </label>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      {onDelete && <button className="ghost danger" disabled={pending} aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={onDelete}><Icon name="delete" small /> Delete feature</button>}
      {pending && <div className="empty" role="status">Checking the current bearing and housing…</div>}
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed || pending} onClick={() => onApply(draft)}>Apply</button><button className="ghost" disabled={!changed || pending} onClick={() => { setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
