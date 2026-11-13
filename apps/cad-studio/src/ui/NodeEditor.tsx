import { nodeFilletType } from '../app/filletFamily';
import { FilletTypeFields } from './FilletTypeFields';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';
import { detachFaceEndExtrude } from '@barocss/cad-model/engine/faceEndExtrude';
import type { FaceEndDistanceReply } from '../engine/client';
import { convertLinearPatternDistance, type LinearPatternDistanceMode } from '@barocss/cad-model/engine/linearSpanPattern';
import type { BearingAssemblyInput } from '@barocss/cad-model/engine/bearingContext';
import { editFields, type BindableField } from '@barocss/cad-model/app/editFields';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { FillPatternHints } from './FillPatternHints';
import { FeatureFailureNotice } from './FeatureFailureNotice';
import { LinearSpanSpacing } from './LinearSpanSpacing';
import type { FeatureFailure } from '../app/failedFeature';
export function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onRelinkInset, onDetachInset, insetSourceWidth, onDelete, readFaceEndDistance, onPickEndFace, parameters, onRefuse, bearingAssembly, doc, pending = false, pendingLabel = 'Checking the current bearing and housing…' }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[], ownsDraft: () => boolean, sourceWidth?: number): void | Promise<FeatureFailure | undefined>; onClose(): void; onEditSketch?(): void; onRelinkInset?: { start(): void; cancel(): void; reviewing: boolean }; onDetachInset?(): void; insetSourceWidth?: number; onDelete?(): void; readFaceEndDistance?(): Promise<FaceEndDistanceReply>; onPickEndFace?(): void; parameters: Record<string, number>; onRefuse(message: string): void; bearingAssembly?: BearingAssemblyInput; doc?: Pick<StudioDoc, 'direct' | 'parameters'>; pending?: boolean; pendingLabel?: string }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [modeProblem, setModeProblem] = useState<string | null>(null);
  const [readingEnd, setReadingEnd] = useState(false);
  const request = useRef<object | null>(null);
  const [evaluation, setEvaluation] = useState<{ nodes: ModelNode[]; index: number; error?: FeatureFailure } | null>(null);
  useLayoutEffect(() => () => { request.current = null; }, [nodes, index]);
  useEffect(() => { setDraft(nodes); setTyped({}); setEvaluation(null); setModeProblem(null); setReadingEnd(false); }, [nodes, index]);
  const current = evaluation?.nodes === nodes && evaluation.index === index ? evaluation : null;
  const retireEvaluation = () => {
    onRelinkInset?.cancel();
    request.current = null;
    setReadingEnd(false);
    setEvaluation(null);
    setModeProblem(null);
  };
  const fields = editFields(draft, index, parameters, bearingAssembly, { doc }).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const node = draft[index];
  const linearPattern = node?.kind === 'linear-pattern' || node?.kind === 'linear-span-pattern' ? node : null;
  const changeDistanceMode = (mode: LinearPatternDistanceMode) => {
    if (!linearPattern) return;
    retireEvaluation();
    const conversion = convertLinearPatternDistance(linearPattern, mode, index);
    if ('message' in conversion) { setModeProblem(conversion.message); return; }
    if (conversion.node === linearPattern) return;
    setDraft(draft.map((node, i) => i === index ? conversion.node : node));
    setTyped(values => {
      const next = { ...values };
      delete next.spacing;
      delete next.span;
      return next;
    });
  };
  const detach = async () => {
    if (node?.kind !== 'face-end-extrude' || !readFaceEndDistance || pending || request.current) return;
    retireEvaluation();
    const ticket = {};
    request.current = ticket;
    setReadingEnd(true);
    try {
      const reply = await readFaceEndDistance();
      if (request.current !== ticket) return;
      if ('error' in reply) { setModeProblem(reply.error); return; }
      const replacement = detachFaceEndExtrude(node, reply.distance);
      setDraft(draft.map((item, i) => i === index ? replacement : item));
    } catch (error) {
      if (request.current === ticket) setModeProblem(error instanceof Error ? error.message : String(error));
    } finally {
      if (request.current === ticket) { request.current = null; setReadingEnd(false); }
    }
  };
  const names = Object.keys(parameters), filletType = nodeFilletType(draft[index]);
  const sourceWidth = typed.sourceWidth === undefined ? insetSourceWidth : Number(typed.sourceWidth);
  const changed = draft !== nodes || sourceWidth !== insetSourceWidth;
  const hasInsetDraft = !!onRelinkInset && Object.keys(typed).length > 0;
  const incompleteInset = typed.insetMM === '' || typed.sourceWidth === '';
  const apply = () => {
    if (!changed || pending || incompleteInset || request.current) return;
    setModeProblem(null);
    const ticket = {};
    request.current = ticket;
    const ownsDraft = () => request.current === ticket;
    const result = onApply(draft, ownsDraft, sourceWidth);
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
      {onRelinkInset && <button className="ghost" type="button" disabled={pending || changed || hasInsetDraft || onRelinkInset.reviewing}
        onClick={() => { retireEvaluation(); onRelinkInset.start(); }}>Replace inset source</button>}
      {onDetachInset && <button className="ghost" type="button" disabled={pending || changed || incompleteInset}
        onClick={() => { retireEvaluation(); onDetachInset(); }}>Detach inset</button>}
      {insetSourceWidth !== undefined && <div className="field"><span>Source width</span><span className="num">
        <input type="number" step="any" aria-label="Source width" value={typed.sourceWidth ?? insetSourceWidth} disabled={pending}
          onChange={event => { retireEvaluation(); setTyped(values => ({ ...values, sourceWidth: event.target.value })); }} /><em>mm</em>
      </span></div>}
      {linearPattern && <div className="field"><span>Distance mode</span>
        <select aria-label="Distance mode" value={linearPattern.kind === 'linear-pattern' ? 'spacing' : 'span'} disabled={pending}
          onChange={event => changeDistanceMode(event.target.value as LinearPatternDistanceMode)}>
          <option value="spacing">Spacing</option>
          <option value="span">Total span</option>
        </select>
      </div>}
      {node?.kind === 'face-end-extrude' && <div className="field">
        <span>End face</span><span>{node.target.face}</span>
      </div>}
      {node?.kind === 'face-end-extrude' && readFaceEndDistance && <button className="ghost" type="button" disabled={pending || readingEnd || !!node.suppressed}
        onClick={() => void detach()}>Detach to Distance</button>}
      {onPickEndFace && <button className="ghost" type="button" disabled={pending || changed}
        onClick={() => { retireEvaluation(); onPickEndFace(); }}>{nodes[index]?.kind === 'face-end-extrude' ? 'Change end face' : 'Set end face'}</button>}
      {readingEnd && <div className="empty" role="status">Reading exact distance…</div>}
      {modeProblem && <div className="hud-error" role="status">{modeProblem}</div>}
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
      )) : node?.kind !== 'face-end-extrude' && <div className="empty">This feature has no editable dimensions.</div>}
      {node?.kind === 'linear-span-pattern' && <LinearSpanSpacing span={node.span} count={node.count} />}
      {draft[index]?.kind === 'fill-feature-pattern' && <FillPatternHints />}
      {onDelete && <button className="ghost danger" disabled={pending} aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={remove}><Icon name="delete" small /> Delete feature</button>}
      {pending && <div className="empty" role="status">{pendingLabel}</div>}
      {current?.error && <FeatureFailureNotice error={current.error} />}
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed || pending || incompleteInset || (current !== null && !current.error)} onClick={apply}>Apply</button><button className="ghost" disabled={(!changed && !hasInsetDraft && !incompleteInset) || pending} onClick={() => { retireEvaluation(); setDraft(nodes); setTyped({}); }}>Reset</button></div>}
    </div>
  );
}
