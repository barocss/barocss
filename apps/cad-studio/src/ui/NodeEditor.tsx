import { nodeFilletType } from '../app/filletFamily';
import { FilletTypeFields } from './FilletTypeFields';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';
import { detachFaceEndExtrude } from '@barocss/cad-model/engine/faceEndExtrude';
import type { FaceEndDistanceReply } from '../engine/client';
import { convertLinearPatternDistance, type LinearPatternDistanceMode } from '@barocss/cad-model/engine/linearSpanPattern';
import type { BearingAssemblyInput } from '@barocss/cad-model/engine/bearingContext';
import { editFields, isSketchAnchoredCut, type BindableField } from '@barocss/cad-model/app/editFields';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { FillPatternHints } from './FillPatternHints';
import { FeatureFailureNotice } from './FeatureFailureNotice';
import { LinearSpanSpacing } from './LinearSpanSpacing';
import { editExtrudeTriangleLength } from '../sketch/fixedTriangleEditor';
import type { FeatureFailure } from '../app/failedFeature';
import { featureNumberInvalid, featureNumberRange, historyNumberRule } from '../app/featureNumberInput';
function invalidInteger(value: number, range: { min: number; max: number }): boolean {
  return !Number.isInteger(value) || value < range.min || value > range.max;
}

export function NodeEditor({ nodes, index, onApply, onClose, onEditSketch, onRelinkInset, onDetachInset, insetSourceWidth, onDelete, readFaceEndDistance, onPickEndFace, onReplaceAxis, edgeReplacement, parameters, onRefuse, bearingAssembly, doc, onDraft, pending = false, pendingLabel = 'Checking the current bearing and housing…' }: { nodes: ModelNode[]; index: number; onApply(nodes: ModelNode[], ownsDraft: () => boolean, sourceWidth?: number): void | Promise<FeatureFailure | undefined>; onClose(): void; onEditSketch?(): void; onRelinkInset?: { start(): void; cancel(): void; reviewing: boolean }; onDetachInset?(): void; insetSourceWidth?: number; onDelete?(opener: HTMLElement): void; readFaceEndDistance?(): Promise<FaceEndDistanceReply>; onPickEndFace?(): void; onReplaceAxis?(): void; edgeReplacement?: { start(): void; cancel(): void; apply(): void; draft: { name: string | null; pending?: boolean } | null }; parameters: Record<string, number>; onRefuse(message: string): void; bearingAssembly?: BearingAssemblyInput; doc?: Pick<StudioDoc, 'direct' | 'parameters'>; onDraft?(owner: object | null): void; pending?: boolean; pendingLabel?: string }) {
  // The draft is the whole node list: a sketch dimension changes the sketch the feature is made from.
  const [draft, setDraft] = useState<ModelNode[]>(nodes);
  // What is typed in a number box until it reads as a number (so a box can be cleared and retyped).
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [lengthProblem, setLengthProblem] = useState<string | null>(null);
  const recoveredLengths = useRef(new WeakSet<Extract<ModelNode, { kind: 'sketch' }>>());
  const [modeProblem, setModeProblem] = useState<string | null>(null);
  const [readingEnd, setReadingEnd] = useState(false);
  const ordinaryLocked = pending || !!edgeReplacement?.draft;
  const request = useRef<object | null>(null);
  const [evaluation, setEvaluation] = useState<{ nodes: ModelNode[]; index: number; error?: FeatureFailure } | null>(null);
  useLayoutEffect(() => {
    recoveredLengths.current = new WeakSet();
    return () => { request.current = null; };
  }, [nodes, index]);
  useEffect(() => { setDraft(nodes); setTyped({}); setEvaluation(null); setModeProblem(null); setLengthProblem(null); setReadingEnd(false); }, [nodes, index]);
  const current = evaluation?.nodes === nodes && evaluation.index === index ? evaluation : null;
  const retireEvaluation = () => {
    onRelinkInset?.cancel();
    request.current = null;
    setReadingEnd(false);
    setEvaluation(null);
    setModeProblem(null);
  };
  const fields = editFields(draft, index, parameters, bearingAssembly, { doc }).filter(f => f.kind !== 'number' || !Number.isNaN(f.get(draft)));
  const changeNumber = (field: Extract<(typeof fields)[number], { kind: 'number' }>, text: string) => {
    retireEvaluation();
    setTyped(values => ({ ...values, [field.key]: text }));
    const value = text.trim() ? Number(text) : NaN;
    if (field.key === 'olen2') {
      const edit = editExtrudeTriangleLength(nodes, draft, index, value, parameters, recoveredLengths.current);
      if (edit) {
        if ('reason' in edit) setLengthProblem(edit.reason);
        else { setLengthProblem(null); setDraft(edit.nodes); }
        return;
      }
    }
    const rule = historyNumberRule(draft, index, field.key);
    if (Number.isFinite(value) && (!rule || !featureNumberInvalid(value, rule)) && (!field.integerRange || !invalidInteger(value, field.integerRange))) {
      const anchored = isSketchAnchoredCut(draft, index);
      const clear = anchored && (field.key === 'h' || field.key === 'draft') ? 'from'
        : field.key === 'from' && anchored !== isSketchAnchoredCut(field.set(draft, value), index) ? 'h' : null;
      if (clear) setTyped(values => {
        const next = { ...values };
        delete next[clear];
        return next;
      });
      setDraft(current => field.set(current, value));
    }
  };
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
  const missingNumbers = fields.flatMap(field => field.kind === 'number' && typed[field.key]?.trim() === '' ? [field] : []);
  const hasMissingNumber = missingNumbers.length > 0;
  const invalidCounts = fields.flatMap(field => field.kind === 'number' && field.integerRange && typed[field.key]?.trim()
    && invalidInteger(Number(typed[field.key]), field.integerRange) ? [field] : []);
  const invalidDimensions = fields.flatMap(field => {
    const value = typed[field.key], rule = historyNumberRule(draft, index, field.key);
    return field.kind === 'number' && value?.trim() && rule && featureNumberInvalid(value, rule) ? [{ field, rule }] : [];
  });
  const hasInvalidNumber = hasMissingNumber || invalidCounts.length > 0 || invalidDimensions.length > 0;
  useLayoutEffect(() => {
    if (!onDraft || (!changed && !Object.keys(typed).length)) return;
    onDraft({});
    return () => onDraft(null);
  }, [onDraft, changed, draft, typed, nodes, index]);
  const apply = () => {
    if (!changed || pending || edgeReplacement?.draft || incompleteInset || hasInvalidNumber || lengthProblem || request.current) return;
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
  const remove = (opener: HTMLElement) => { retireEvaluation(); onDelete?.(opener); };
  return (
    <div className="node-editor" onKeyDown={event => {
      if (event.key === 'Enter') apply();
      else if (event.key === 'Escape') close();
      else if (event.key === 'Delete' && onDelete && !ordinaryLocked && event.target instanceof HTMLElement
        && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
        event.preventDefault();
        event.stopPropagation();
        remove(event.target);
      }
    }}>
      <div className="card-title" style={{ marginTop: 10 }}>EDIT FEATURE <ToolIconButton size="tiny" aria-label="Close editor" onClick={close}><Icon name="close" small /></ToolIconButton></div>
      {node?.kind === 'revolve' && <div className="field"><span>Axis</span><span>{node.axisRef
        ? `Linked edge ${node.axisRef.edge}` : node.dir ? 'Fixed edge' : `Sketch ${node.axis.toUpperCase()}`}</span></div>}
      {node?.kind === 'extrude' && node.cutDepth === 'through' && <div className="field"><span>Depth</span><span>Through all</span></div>}
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
      {onReplaceAxis && <button className="ghost" type="button" disabled={pending || changed}
        onClick={() => { retireEvaluation(); onReplaceAxis(); }}>Replace axis</button>}
      {onPickEndFace && <button className="ghost" type="button" disabled={pending || changed}
        onClick={() => { retireEvaluation(); onPickEndFace(); }}>{nodes[index]?.kind === 'face-end-extrude' ? 'Change end face' : 'Set end face'}</button>}
      {edgeReplacement && (edgeReplacement.draft ? <>
        <span className="small break-all" role="status">{edgeReplacement.draft.name ?? 'Select an edge on the feature body.'}</span>
        <div className="row-actions">
          <button className="primary" type="button" aria-label="Apply edge replacement"
            disabled={changed || !edgeReplacement.draft.name || edgeReplacement.draft.pending} onClick={edgeReplacement.apply}>Apply edge</button>
          <button className="ghost" type="button" aria-label="Cancel edge replacement" onClick={edgeReplacement.cancel}>Cancel</button>
        </div>
      </> : <button className="ghost" type="button" disabled={pending || changed} onClick={() => { retireEvaluation(); edgeReplacement.start(); }}>Replace edge</button>)}
      {readingEnd && <div className="empty" role="status">Reading exact distance…</div>}
      {hasMissingNumber && <div className="hud-error" role="status">Enter a number for {missingNumbers.map(field => field.label).join(', ')}.</div>}
      {invalidCounts.map(field => <div key={field.key} className="hud-error" role="status">{field.label} must be a whole number from {field.integerRange!.min} to {field.integerRange!.max}.</div>)}
      {invalidDimensions.map(({ field, rule }) => <div key={field.key} className="hud-error" role="status">{field.label} · {featureNumberRange(rule)}.</div>)}
      {lengthProblem && <div className="hud-error" role="status">{lengthProblem}</div>}
      {modeProblem && <div className="hud-error" role="status">{modeProblem}</div>}
      {fields.length ? fields.map(f => {
        const rule = f.kind === 'number' ? historyNumberRule(draft, index, f.key) : undefined;
        const range = f.kind === 'number' && f.integerRange && !invalidCounts.includes(f) ? `Whole number from ${f.integerRange.min} to ${f.integerRange.max}` : rule ? featureNumberRange(rule) : null;
        const rangeId = range ? `history-range-${f.key}` : undefined;
        return (
        <div key={f.key} className="field"><span>{f.label}</span>
          {f.kind === 'number' ? <span className="num"><input type="number" step={f.integerRange ? 1 : "any"} min={f.integerRange?.min ?? (rule === 'positive' ? 0 : undefined)} max={f.integerRange?.max} aria-label={f.label} aria-describedby={rangeId} aria-invalid={typed[f.key]?.trim() === '' || invalidCounts.includes(f) || invalidDimensions.some(item => item.field === f) || (f.key === 'olen2' && !!lengthProblem) || undefined} value={typed[f.key] ?? f.get(draft)} disabled={ordinaryLocked || !!(f as BindableField).param?.(draft)} onChange={e => changeNumber(f, e.target.value)} />{f.unit && <em>{f.unit}</em>}
            {names.length > 0 && 'bind' in f && <select className="param-bind" disabled={ordinaryLocked} aria-label={`${f.label} parameter`} data-tip="Parameter" data-tip-desc="Bind this value to a named parameter (Parameters panel)" value={(f as BindableField).param(draft) ?? ''}
              onChange={e => {
                retireEvaluation();
                const b = f as BindableField, name = e.target.value;
                try {
                  const next = name ? b.bind(draft, name) : b.set(draft, b.get(draft));
                  if (next) {
                    setDraft(next);
                    setTyped(m => Object.fromEntries(Object.entries(m).filter(([k]) => k !== f.key)));
                    if (f.key === 'olen2') setLengthProblem(null);
                  }
                  else onRefuse(`${f.label} is not stored as it is shown, so it cannot take a parameter.`);
                } catch (error) { onRefuse(error instanceof Error ? error.message.replace(/^\[\w+\] /, '') : String(error)); }
              }}>
              <option value="">ƒ</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}</span>
            : f.kind === 'choice' ? <select disabled={ordinaryLocked} aria-label={f.label} value={f.get(draft)} onChange={e => { retireEvaluation(); setDraft(d => f.set(d, e.target.value)); }}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="checkbox" className="check" disabled={ordinaryLocked} aria-label={f.label} checked={f.get(draft)} onChange={e => { retireEvaluation(); setDraft(d => f.set(d, e.target.checked)); }} />}
          {range && <span id={rangeId} className="muted small col-span-2">{range}</span>}
        </div>
      ); }) : node?.kind !== 'face-end-extrude' && <div className="empty">This feature has no editable dimensions.</div>}
      {node?.kind === 'linear-span-pattern' && <LinearSpanSpacing span={node.span} count={node.count} />}
      {draft[index]?.kind === 'fill-feature-pattern' && <FillPatternHints />}
      {onDelete && <button className="ghost danger" disabled={ordinaryLocked} aria-label="Delete feature" title="Delete this feature (and the sketch only it uses) · Undo restores it" onClick={event => remove(event.currentTarget)}><Icon name="delete" small /> Delete feature</button>}
      {pending && <div className="empty" role="status">{pendingLabel}</div>}
      {current?.error && <FeatureFailureNotice error={current.error} />}
      {fields.length > 0 && <div className="row-actions"><button className="primary" disabled={!changed || pending || !!edgeReplacement?.draft || incompleteInset || hasInvalidNumber || !!lengthProblem || (current !== null && !current.error)} onClick={apply}>Apply</button><button className="ghost" disabled={(!changed && !hasInsetDraft && !incompleteInset && !hasInvalidNumber && !lengthProblem) || pending} onClick={() => { retireEvaluation(); setDraft(nodes); setTyped({}); setLengthProblem(null); }}>Reset</button></div>}
    </div>
  );
}
