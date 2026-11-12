import { nodeFilletType } from '../app/filletFamily';
import { FilletTypeFields } from './FilletTypeFields';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmt, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { linearSpanPatternInput } from '@barocss/cad-model/engine/linearSpanPattern';
import type { BearingAssemblyInput } from '@barocss/cad-model/engine/bearingContext';
import { editFields, type BindableField } from '@barocss/cad-model/app/editFields';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { FillPatternHints } from './FillPatternHints';
import { FeatureFailureNotice } from './FeatureFailureNotice';
import type { FeatureFailure } from '../app/failedFeature';
export function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onDelete, parameters, onRefuse, bearingAssembly, doc, pending = false, pendingLabel = 'Checking the current bearing and housing…' }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[], ownsDraft: () => boolean): void | Promise<FeatureFailure | undefined>; onClose(): void; onEditSketch?(): void; onDelete?(): void; parameters: Record<string, number>; onRefuse(message: string): void; bearingAssembly?: BearingAssemblyInput; doc?: Pick<StudioDoc, 'direct' | 'parameters'>; pending?: boolean; pendingLabel?: string }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  const request = useRef<object | null>(null);
  const [evaluation, setEvaluation] = useState<{ nodes: ModelNode[]; index: number; error?: FeatureFailure } | null>(null);
  useLayoutEffect(() => () => { request.current = null; }, [nodes, index]);
  useEffect(() => { setDraft(nodes); setTyped({}); setEvaluation(null); }, [nodes, index]);
  const current = evaluation?.nodes === nodes && evaluation.index === index ? evaluation : null;
  const retireEvaluation = () => {
    request.current = null;
    setEvaluation(null);
  };
  const fields = editFields(draft, index, parameters, bearingAssembly, { doc }).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const node = draft[index];
  const spanPattern = node?.kind === 'linear-span-pattern' ? linearSpanPatternInput(node, index) : null;
  const names = Object.keys(parameters), filletType = nodeFilletType(draft[index]);
  const changed = draft !== nodes;
  const apply = () => {
    if (!changed || pending || request.current) return;
    const ticket = {};
    request.current = ticket;
    const ownsDraft = () => request.current === ticket;
    const result = onApply(draft, ownsDraft);
    if (!result) { retireEvaluation(); return; }
    setEvaluation({ nodes, index });
    void result.then(error => {
      if (!ownsDraft()) return;
      request.current = null;
      setEvaluation(error ? { nodes, index, error } : null);
    });
  };
  const close = () => { retireEvaluation(); onClose(); };
  const remove = () => { retireEvaluation(); onDelete?.(); };
  return (
    <div className="node-editor" onKeyDown={event => {
      if (event.key === 'Enter') apply();
      else if (event.key === 'Escape') close();
      else if (event.key === 'Delete' && !pending && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) remove();
    }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <ToolIconButton size="tiny" aria-label="Close editor" onClick={close}><Icon name="close" small /></ToolIconButton></div>
      {filletType && <FilletTypeFields type={filletType} mode={draft[index]?.kind === 'fillet' && draft[index].radii ? 'varying' : 'constant'} fixed />}
      {onEditSketch && <button className="ghost" aria-label="Edit sketch" title="Reopen the sketch this feature is made from, with its constraints" onClick={() => { retireEvaluation(); onEditSketch(); }}><Icon name="draw" small /> Edit sketch</button>}
      {fields.length ? fields.map(f => (
        <div key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step="any" aria-label={f.label} value={typed[f.key] ?? f.get(draft)} disabled={pending || !!(f as BindableField).param?.(draft)} onChange={e => { retireEvaluation(); const t = e.target.value, v = Number(t); setTyped(m => ({ ...m, [f.key]: t })); if (t.trim() !== '' && Number.isFinite(v)) setDraft(d => f.set(d, v)); }} />{f.unit && <em>{f.unit}</em>}
            {names.length > 0 && 'bind' in f && <select className="param-bind" disabled={pending} aria-label={`${f.label} parameter`} data-tip="Parameter" data-tip-desc="Bind this value to a named parameter (Parameters panel)" value={(f as BindableField).param(draft) ?? ''}
              onChange={e => {
                retireEvaluation();
                const b = f as BindableField, name = e.target.value;
                try {
                  const next = name ? b.bind(draft, name) : b.set(draft, b.get(draft));
                  if (next) { setDraft(next); setTyped(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== f.key))); }
                  else onRefuse(`${f.label} is not stored as it is shown, so it cannot take a parameter.`);
                } catch (error) { onRefuse(error instanceof Error ? error.message.replace(/^\[\w+\] /, '') : String(error)); }
              }}>
              <option value="">ƒ</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}</span>
            : f.kind === 'choice' ? <select disabled={pending} aria-label={f.label} value={f.get(draft)} onChange={e => { retireEvaluation(); setDraft(d => f.set(d, e.target.value)); }}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" disabled={pending} aria-label={f.label} checked={f.get(draft)} onChange={e => { retireEvaluation(); setDraft(d => f.set(d, e.target.checked)); }} />}
        </div>
      )) : <div className="empty">This feature has no editable dimensions.</div>}
      {spanPattern && <div className="field"><span>Spacing</span><output aria-label="Spacing">
        {'spacing' in spanPattern ? `${fmt(spanPattern.spacing)} mm` : '—'}
      </output></div>}
      {draft[index]?.kind === 'fill-feature-pattern' && <FillPatternHints />}
      {onDelete && <button className="ghost danger" disabled={pending} aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={remove}><Icon name="delete" small /> Delete feature</button>}
      {pending && <div className="empty" role="status">{pendingLabel}</div>}
      {current?.error && <FeatureFailureNotice error={current.error} />}
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed || pending || (current !== null && !current.error)} onClick={apply}>Apply</button><button className="ghost" disabled={!changed || pending} onClick={() => { retireEvaluation(); setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
