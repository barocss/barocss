import type { CSSProperties } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { markedReferences, referencesOf, type Problem as RefProblem } from '@barocss/cad-model/engine/references';
import type { DrawingReferenceLabel } from './DrawingWorkspace';

interface ReferenceDecisionsProps {
  doc: StudioDoc;
  referenceLabels: readonly DrawingReferenceLabel[];
  refMarks: ReturnType<typeof markedReferences>;
  refProblems: RefProblem[];
  refChoices: { index: number; names: string[] } | null;
  previewReference(where: string, edge?: string, inModel?: boolean): void;
  settleRef(index: number, to?: string): Promise<void>;
  showRefChoices(index: number): Promise<void>;
}

  const referenceRowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, paddingBlock: 8, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' };
  const referenceActionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' };
  const referenceButtonStyle: CSSProperties = { minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' };

export function ReferenceDecisions({ doc, referenceLabels, refMarks, refProblems, refChoices, previewReference, settleRef, showRefChoices }: ReferenceDecisionsProps) {
  const referenceDimension = (where: string) => doc.drawing?.dimensions.find(d => where === `dimension ${d.id}`);
  const referenceCaption = (where: string) => {
    const dimension = referenceDimension(where);
    if (!dimension) return where.startsWith('feature ') ? 'Feature reference' : where.startsWith('mate ') ? 'Mate reference' : 'Model reference';
    const label = referenceLabels.find(x => x.dimensionId === dimension.id);
    const kind = dimension.kind === 'pcd' ? 'Pitch circle' : dimension.kind === 'angle' ? 'Angle' : dimension.kind === 'diameter' ? 'Diameter' : dimension.kind === 'radius' ? 'Radius' : 'Linear';
    const view = dimension.view === 'front' ? 'Front' : dimension.view === 'top' ? 'Top' : dimension.view === 'right' ? 'Right' : dimension.view.startsWith('section:') ? `Section ${dimension.view.slice(8)}` : dimension.view.startsWith('detail:') ? `Detail ${dimension.view.slice(7)}` : 'Isometric';
    return `${label?.text ?? kind + ' dimension'} · ${view} view`;
  };
  const affectedDimensions = (name: string) => new Set(referencesOf(doc, true).refs.filter(r => r.name === name || r.was === name).map(r => referenceDimension(r.where)?.id).filter(Boolean)).size;
  return <section aria-label="References" style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    <div className="ol-head">References</div>
    <div className="muted">{refMarks.length} matched again · {refProblems.length} need a choice</div>
    {refMarks.map(m => <div key={'m' + m.index} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{referenceCaption(m.where)}<br /><span className="muted">{affectedDimensions(m.now)} affected dimension(s) · Matched again</span></p>
      <div style={referenceActionsStyle}>
      {referenceDimension(m.where) && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where)}>Show dimension</button>}
      {m.edge && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where, m.now, true)}>Preview in model</button>}
      <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(m.index)}>Confirm reference</button>
      <button className="ghost small" style={referenceButtonStyle} onClick={() => void showRefChoices(m.index)}>Show alternatives</button>
      </div>
      {refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(m.where, n)}>Preview candidate {i + 1}</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(m.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{m.where}: {m.was} → {m.now}{refChoices?.index === m.index && refChoices.names.filter(n => n !== m.now).map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>)}
    {refProblems.map(p => <div key={'p' + p.index} style={referenceRowStyle}>
      <p style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{referenceCaption(p.where)}<br /><span className="muted">{affectedDimensions(p.name)} affected dimension(s) · {p.candidates.length ? 'Choose a reference' : 'Reference missing'}{p.node !== null ? ' · Feature held' : ''}</span></p>
      <div style={referenceActionsStyle}>
      {referenceDimension(p.where) && <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where)}>Show dimension</button>}
      </div>
      {p.candidates.map((n, i) => <div key={n} style={referenceActionsStyle}>
        <span>Candidate {i + 1} </span>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where, n)}>Preview candidate {i + 1}</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => previewReference(p.where, n, true)}>Preview in model</button>
        <button className="ghost small" style={referenceButtonStyle} onClick={() => void settleRef(p.index, n)}>Use candidate {i + 1}</button>
      </div>)}
      <details style={{ minWidth: 0, maxWidth: '100%' }}><summary>Technical details</summary><div className="muted" style={{ overflowWrap: 'anywhere' }}>{p.where}: {p.name}{p.candidates.map((n, i) => <div key={n}>Candidate {i + 1}: {n}</div>)}</div></details>
    </div>)}
  </section>;
}
