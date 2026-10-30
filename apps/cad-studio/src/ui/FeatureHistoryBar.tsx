import type { Dispatch, SetStateAction, RefObject, MouseEventHandler } from 'react';
import { featureLabel, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Selection } from '@barocss/cad-model/app/commands';
import { iconFor } from './featureIcon';
import { Icon } from './atoms';
export type HistoryMenuTarget = { at: { x: number; y: number }; index: number };
interface FeatureHistoryBarProps {
  doc: StudioDoc;
  selection: Selection;
  editNode: number | null;
  marker: number | null;
  source: { innerSteps: ReadonlySet<number>; freeSketches: readonly number[] };
  layout: { historyBar: RefObject<HTMLDivElement | null>; historyRows: boolean; setHistoryRows: Dispatch<SetStateAction<boolean>>; historyLabels: boolean; setHistoryLabels: Dispatch<SetStateAction<boolean>>; historyHidden: number };
  actions: { pickProfile(index: number, additive: boolean): void; setEditNode(index: number): void; setMarker(marker: number | null): void; setHistoryMenu(target: HistoryMenuTarget): void; openHistoryFeature: MouseEventHandler<HTMLButtonElement> };
}
export function FeatureHistoryBar({ doc, selection, editNode, marker, source, layout, actions }: FeatureHistoryBarProps) {
  const { innerSteps, freeSketches } = source;
  const { historyBar, historyRows, setHistoryRows, historyLabels, setHistoryLabels, historyHidden } = layout;
  const { pickProfile, setEditNode, setMarker, setHistoryMenu, openHistoryFeature } = actions;
  const totalNodes = doc.nodes.length, markerAt = marker ?? totalNodes;
  return <div className={'history' + (historyRows ? ' expanded' : '') + (historyLabels ? ' show-labels' : '')} role="group" aria-label="History" ref={historyBar}>
        <button className="history-labels" aria-label="Show history step names" aria-pressed={historyLabels} title={historyLabels ? 'Hide step names' : 'Show step names'} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); }} onClick={() => setHistoryLabels(shown => !shown)}><Icon name="short_text" small /></button>
        {doc.nodes.map((n, i) => innerSteps.has(i) ? null : n.kind === 'sketch' ? (freeSketches.includes(i) ? (
          // A finished sketch no feature uses yet: click picks it as a profile (Shift adds) and opens its editor.
          <button key={i} aria-label={featureLabel(n, i, doc.nodes)} className={'hs sketch' + (i >= markerAt ? ' rolled' : '') + (selection.sketches?.includes(i) ? ' picked' : '') + (editNode === i ? ' edit' : '')} title={`${featureLabel(n, i, doc.nodes)} · click to pick it as a profile (Shift: add) · double-click to roll back here`}
            onClick={e => { pickProfile(i, e.shiftKey); setEditNode(i); }} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name="cad-sketch" small />{historyLabels && <span className="hs-label">{featureLabel(n, i, doc.nodes)}</span>}</button>) : null) : (
          <button key={i} data-node-index={i} aria-label={featureLabel(n, i, doc.nodes)} className={'hs' + (i >= markerAt ? ' rolled' : '') + (editNode === i ? ' edit' : '') + (n.suppressed ? ' suppressed' : '') + (n.rematched || n.held ? ' rematched' : '')} title={`${featureLabel(n, i, doc.nodes)}${n.held ? ` (held: ${n.held})` : n.suppressed ? ' (suppressed)' : ''}${n.rematched ? ` · matched again: ${Object.entries(n.rematched).map(([now, was]) => `${was} → ${now}`).join(', ')}` : ''} · click to edit · double-click to roll back here`}
            onClick={openHistoryFeature} onDoubleClick={() => setMarker(i + 1 >= totalNodes ? null : i + 1)}
            onContextMenu={e => { e.preventDefault(); setHistoryMenu({ at: { x: e.clientX, y: e.clientY }, index: i }); }}>
            <Icon name={iconFor(n)} small />{historyLabels && <span className="hs-label">{featureLabel(n, i, doc.nodes)}</span>}</button>))}
        {(historyHidden > 0 || historyRows) && <button className="hs-more" aria-label={historyRows ? 'Fewer history steps' : `${historyHidden} more history steps`} aria-expanded={historyRows}
          title={historyRows ? 'Show fewer steps' : 'Show every step'} onClick={() => setHistoryRows(o => !o)}>{historyRows ? 'Less' : '+' + historyHidden}</button>}
        <button className="marker" aria-label="Roll forward to the end" title="Rollback marker · click to roll forward" onClick={() => setMarker(null)} />
        {marker !== null && <span className="muted">rolled back · {totalNodes - markerAt} hidden</span>}
      </div>;
}
