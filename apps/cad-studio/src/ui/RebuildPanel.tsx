// The Rebuild panel (O10 step C): what the last evaluation of the part cost — each feature built again, reused or an
// input (a sketch), its own wall time and kernel calls, the slowest marked; the mates that cannot be met and their
// loops; and each body's draws in the frames now shown, by its key (the GPU lane's tally, this renderer's only).
// Read only: it changes neither geometry nor history.
import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import type { Problem } from '@barocss/cad-model/assembly/mates';
import { rebuildReport, type RebuildFeature } from '@barocss/cad-model/team/rebuild';
import type { DisplayMode } from '../viewport/renderer';
import type { FrameCost } from '../viewport/frameCost';
import type { ViewportHandle } from '../viewport/Viewport';
import { createValueStore, useStoreValue, type ValueStore } from '../state/valueStore';
import { Icon } from './atoms';

/** The last evaluation of the part, as App sets it (a store, so an evaluation renders only this panel). */
export type RebuildStore = ValueStore<{ doc: StudioDoc; result: EvalResult } | null>;
export const rebuildStoreOf = (): RebuildStore => createValueStore<{ doc: StudioDoc; result: EvalResult } | null>(null);
/** How often the frame costs are read while the panel is open (never per frame). */
const POLL_MS = 500;

const ms = (x: number) => x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2);
const CALLS: readonly [keyof RebuildFeature['calls'], string][] = [['booleans', 'Boolean'], ['planarBooleans', 'planar Boolean'], ['tessellations', 'tessellation'], ['sweeps', 'sweep'], ['shells', 'shell'], ['finishes', 'finish']];
function callsText(c: RebuildFeature['calls']): string {
  const parts: string[] = [];
  for (const [k, label] of CALLS) if (c[k]) parts.push(`${c[k]} ${label}${c[k] === 1 ? '' : 's'}`);
  return parts.join(', ') || '—';
}

/** What a frame cost shows, without its frame number and time (which change every frame): read again only when it differs. */
const costKey = (c: FrameCost | null) => c ? JSON.stringify([c.renderer, c.mode, c.bodies, c.scene]) : '';

export function RebuildPanel({ store, problems, mode, viewport, onClose }: {
  store: RebuildStore; problems: readonly Problem[]; mode: DisplayMode; viewport: RefObject<ViewportHandle | null>; onClose(): void;
}) {
  const last = useStoreValue(store), doc = last?.doc;
  const report = useMemo(() => last && rebuildReport(last.doc, last.result, { problems }), [last, problems]);
  // (The frames' tally runs while the panel is open, read every POLL_MS and shown again only when its counts change.)
  const [cost, setCost] = useState<FrameCost | null>(null);
  useEffect(() => {
    viewport.current?.trackFrameCost(true);
    const read = () => { const next = viewport.current?.frameCosts()[mode] ?? null; setCost(prev => costKey(prev) === costKey(next) ? prev : next); };
    const t = setInterval(read, POLL_MS);
    return () => { clearInterval(t); viewport.current?.trackFrameCost(false); };
  }, [viewport, mode]);
  return <aside className="card props bom-panel" aria-label="Rebuild panel">
    <div className="card-title">REBUILD <button className="tool tiny" aria-label="Close Rebuild" onClick={onClose}><Icon name="close" small /></button></div>
    {!report && <div className="empty" role="status">{last ? 'The part did not evaluate, so there is no rebuild to show.' : 'Not evaluated yet.'}</div>}
    {report && <>
      <div className="muted small" aria-label="Rebuild totals">
        Evaluation {report.evaluation} ({report.basis}), revision <span className="mono">{report.revision}</span> · {report.built} built in {ms(report.builtMs)} ms · {report.reused} reused · {ms(report.evaluationMs)} ms in all
      </div>
      <table className="bom-table" aria-label="Rebuild features">
        <thead><tr><th>Feature</th><th>State</th><th>ms</th><th>Kernel calls</th></tr></thead>
        <tbody>{report.features.map(f => <tr key={f.id} aria-label={`Rebuild ${f.id}`} data-rebuild-state={f.state} data-slowest={f.id === report.slowest || undefined}>
          <td title={f.id}>{f.label}{f.id === report.slowest ? <span className="warn small"> · slowest</span> : null}</td>
          <td>{f.state}</td><td className="mono">{ms(f.ms)}</td><td className="small">{callsText(f.calls)}</td>
        </tr>)}</tbody>
      </table>
      <div className="card-title" style={{ marginTop: 8 }}>MATES</div>
      {!report.mates.length && <div className="muted small" aria-label="Rebuild mates">{doc?.mates?.length ? 'Every mate is met.' : 'No mates.'}</div>}
      {!!report.mates.length && <ul className="small" aria-label="Rebuild mates">{report.mates.map(p => <li key={p.mate}><span className="mono">{p.mate}</span>: {p.reason}</li>)}</ul>}
      {report.loops.map((l, k) => <div key={k} className="warn small" aria-label={`Rebuild loop ${k + 1}`}>Loop: {l.parts.join(' → ')} ({l.mates.join(', ')})</div>)}
      <div className="card-title" style={{ marginTop: 8 }}>FRAME COSTS <button className="tool tiny" aria-label="Refresh frame costs" onClick={() => setCost(viewport.current?.frameCosts()[mode] ?? null)}><Icon name="refresh" small /></button></div>
      {!cost && <div className="muted small" role="status">No frame counted yet in {mode}.</div>}
      {cost && <>
        <div className="muted small" aria-label="Frame cost totals">{cost.renderer}, {cost.mode}: frame {cost.frame}, {ms(cost.cpuMs)} ms CPU to record and submit{cost.mode === 'wireframe' ? '; surface triangles are drawn for depth only' : ''}</div>
        <table className="bom-table" aria-label="Frame costs">
          <thead><tr><th>Body</th><th>Draws</th><th>Triangles</th><th>Lines</th><th>Share</th></tr></thead>
          <tbody>{cost.bodies.map(b => <tr key={b.key} aria-label={`Frame cost ${b.key}`}>
            <td className="mono">{b.key}</td><td className="mono">{b.draws}</td><td className="mono">{b.triangles}</td><td className="mono">{b.lines}</td><td className="mono">{(100 * b.share).toFixed(1)} %</td>
          </tr>)}</tbody>
        </table>
      </>}
      <div className="muted small" aria-label="Rebuild limits">{report.limits} Frame costs are work counts on this renderer, not GPU time; they are not compared across renderers.</div>
    </>}
  </aside>;
}
