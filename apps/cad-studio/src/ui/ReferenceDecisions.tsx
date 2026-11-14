import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { featureLabel, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureId } from '@barocss/cad-model/engine/ids';
import { markedReferences, referencesOf, type Problem as RefProblem } from '@barocss/cad-model/engine/references';
import type { DrawingReferenceLabel } from './DrawingWorkspace';

export interface ReferencePreviewOptions { edge?: string; candidateNumber?: number; inModel?: boolean }

interface ReferenceDecisionsProps {
  doc: StudioDoc;
  referenceLabels: readonly DrawingReferenceLabel[];
  refMarks: ReturnType<typeof markedReferences>;
  refProblems: RefProblem[];
  refChoices: { index: number; names: string[] } | null;
  previewReference(where: string, options?: ReferencePreviewOptions): void;
  settleRef(index: number, to?: string): Promise<boolean>;
  showRefChoices(index: number): Promise<void>;
}

  const referenceRowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, paddingBlock: 8, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' };
  const referenceActionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' };
  const referenceButtonStyle: CSSProperties = { minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' };

export function ReferenceDecisions({ doc, referenceLabels, refMarks, refProblems, refChoices, previewReference, settleRef, showRefChoices }: ReferenceDecisionsProps) {
  const root = useRef<HTMLElement>(null);
  const pendingFocus = useRef<{ doc: StudioDoc; button: HTMLButtonElement } | null>(null);
  useLayoutEffect(() => {
    const focus = pendingFocus.current;
    if (!focus || focus.doc === doc) return;
    pendingFocus.current = null;
    if (document.activeElement !== document.body || focus.button.isConnected) return;
    const next = root.current?.querySelector<HTMLElement>('[data-reference-next]');
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [doc]);
  const choose = async (event: MouseEvent<HTMLButtonElement>, index: number, candidate?: string) => {
    const focus = event.detail === 0 ? { doc, button: event.currentTarget } : null;
    pendingFocus.current = focus;
    if (!(await settleRef(index, candidate)) && pendingFocus.current === focus) pendingFocus.current = null;
  };
  const referenceDimension = (where: string) => doc.drawing?.dimensions.find(d => where === `dimension ${d.id}`);
  const referenceCaption = (where: string, index: number | null) => {
    if (index !== null && doc.nodes[index]) return `${featureLabel(doc.nodes[index], index, doc.nodes)} (${featureId(doc.nodes, index)})`;
    const dimension = referenceDimension(where);
    if (!dimension) return where.startsWith('feature ') ? 'Feature reference' : where.startsWith('mate ') ? 'Mate reference' : 'Model reference';
    const label = referenceLabels.find(x => x.dimensionId === dimension.id);
    const kind = dimension.kind === 'pcd' ? 'Pitch circle' : dimension.kind === 'angle' ? 'Angle' : dimension.kind === 'diameter' ? 'Diameter' : dimension.kind === 'radius' ? 'Radius' : 'Linear';
    const view = dimension.view === 'front' ? 'Front' : dimension.view === 'top' ? 'Top' : dimension.view === 'right' ? 'Right' : dimension.view.startsWith('section:') ? `Section ${dimension.view.slice(8)}` : dimension.view.startsWith('detail:') ? `Detail ${dimension.view.slice(7)}` : 'Isometric';
    return `${label?.text ?? kind + ' dimension'} · ${view} view`;
  };
  const affectedDimensions = (name: string) => new Set(referencesOf(doc, true).refs.filter(r => r.name === name || r.was === name).map(r => referenceDimension(r.where)?.id).filter(Boolean)).size;
  return <section ref={root} aria-label="References" style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    <div className="ol-head">References</div>
    <div className="muted">{refMarks.length} matched again · {refProblems.length} need a choice</div>
    {refMarks.map(m => {
      const caption = referenceCaption(m.where, m.node), affected = affectedDimensions(m.now);
      return <div key={'m' + m.index} role="group" aria-label={caption} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{caption}<br /><span className="muted">{affected > 0 && `${affected} affected dimension(s) · `}Matched again</span></p>
      <div style={referenceActionsStyle}>
      {referenceDimension(m.where) && <button className="ghost small" style={referenceButtonStyle} data-reference-next onClick={() => previewReference(m.where)}>Show dimension</button>}
      {m.edge && <button className="ghost small" style={referenceButtonStyle} data-reference-next onClick={() => previewReference(m.where, { edge: m.now, inModel: true })}>Preview in model</button>}
      <button className="ghost small" style={referenceButtonStyle} data-reference-next aria-label={m.node === null ? undefined : `Confirm reference for ${caption}`} onClick={event => void choose(event, m.index)}>Confirm reference</button>
      <button className="ghost small" style={referenceButtonStyle} onClick={() => void showRefChoices(m.index)}>Show alternatives</button>
      </div>
      {refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where, { edge: n, candidateNumber: i + 1 })}>Preview candidate {i + 1}</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={event => void choose(event, m.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{m.where}: {m.was} → {m.now}{refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>;
    })}
    {refProblems.map(p => {
      const caption = referenceCaption(p.where, p.node), affected = affectedDimensions(p.name);
      const drawing = referenceDimension(p.where);
      return <div key={'p' + p.index} role="group" aria-label={caption} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{caption}<br /><span className="muted">{affected > 0 && `${affected} affected dimension(s) · `}{p.candidates.length ? 'Choose a reference' : p.reason === 'ambiguous-fillet-endpoints' ? 'Fillet endpoints cannot be matched' : p.reason === 'ambiguous-split-cap' ? 'Reference ambiguous' : 'Reference missing'}{p.node !== null ? ' · Feature held' : ''}</span></p>
      <div style={referenceActionsStyle}>
      {drawing && <button className="ghost small" style={referenceButtonStyle} data-reference-next onClick={() => previewReference(p.where)}>Show dimension</button>}
      </div>
      {p.candidates.map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} data-reference-next
          aria-label={p.node === null ? undefined : `Preview candidate ${i + 1} for ${caption} in model`}
          onClick={() => previewReference(p.where, { edge: n, candidateNumber: i + 1, inModel: !drawing })}>Preview candidate {i + 1}</button>
        {drawing && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where, { edge: n, inModel: true })}>Preview in model</button>}
        <button className="ghost small" style={referenceButtonStyle}
          aria-label={p.node === null ? undefined : `Use candidate ${i + 1} for ${caption}`}
          onClick={event => void choose(event, p.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{p.where}: {p.name}{p.candidates.map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>;
    })}
  </section>;
}
