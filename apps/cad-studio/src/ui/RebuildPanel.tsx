// The Rebuild panel (O10 step C): what the last evaluation of the part cost — each feature built again, reused or an
// input (a sketch), its own wall time and kernel calls, the slowest marked; the mates that cannot be met and their
// loops; and each body's draws in the frames now shown, by its key (the GPU lane's tally, this renderer's only).
// Read only: it changes neither geometry nor history. O16: its contents on shadcn's Table and Button, the columns fixed
// at the dock's width (cells truncate, their full text in the title).
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
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
      <Table className="bom-table" aria-label="Rebuild features">
        <colgroup><col /><col className="w-14" /><col className="w-10" /><col className="w-[38%]" /></colgroup>
        <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead>State</TableHead><TableHead>ms</TableHead><TableHead>Kernel calls</TableHead></TableRow></TableHeader>
        <TableBody>{report.features.map(f => <TableRow key={f.id} aria-label={`Rebuild ${f.id}`} data-rebuild-state={f.state} data-slowest={f.id === report.slowest || undefined}>
          <TableCell title={f.id}>{f.label}{f.id === report.slowest ? <span className="warn small"> · slowest</span> : null}</TableCell>
          <TableCell>{f.state}</TableCell><TableCell className="mono">{ms(f.ms)}</TableCell><TableCell title={callsText(f.calls)}>{callsText(f.calls)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <div className="card-title" style={{ marginTop: 8 }}>MATES</div>
      {!report.mates.length && <div className="muted small" aria-label="Rebuild mates">{doc?.mates?.length ? 'Every mate is met.' : 'No mates.'}</div>}
      {!!report.mates.length && <ul className="small" aria-label="Rebuild mates">{report.mates.map(p => <li key={p.mate}><span className="mono">{p.mate}</span>: {p.reason}</li>)}</ul>}
      {report.loops.map((l, k) => <div key={k} className="warn small" aria-label={`Rebuild loop ${k + 1}`}>Loop: {l.parts.join(' → ')} ({l.mates.join(', ')})</div>)}
      <div className="card-title" style={{ marginTop: 8 }}>FRAME COSTS <Button variant="ghost" size="xs" aria-label="Refresh frame costs" onClick={() => setCost(viewport.current?.frameCosts()[mode] ?? null)}><Icon name="refresh" small /></Button></div>
      {!cost && <div className="muted small" role="status">No frame counted yet in {mode}.</div>}
      {cost && <>
        <div className="muted small" aria-label="Frame cost totals">{cost.renderer}, {cost.mode}: frame {cost.frame}, {ms(cost.cpuMs)} ms CPU to record and submit{cost.mode === 'wireframe' ? '; surface triangles are drawn for depth only' : ''}</div>
        <Table className="bom-table" aria-label="Frame costs">
          <colgroup><col /><col className="w-11" /><col className="w-16" /><col className="w-12" /><col className="w-14" /></colgroup>
          <TableHeader><TableRow><TableHead>Body</TableHead><TableHead>Draws</TableHead><TableHead>Triangles</TableHead><TableHead>Lines</TableHead><TableHead>Share</TableHead></TableRow></TableHeader>
          <TableBody>{cost.bodies.map(b => <TableRow key={b.key} aria-label={`Frame cost ${b.key}`}>
            <TableCell className="mono" title={b.key}>{b.key}</TableCell><TableCell className="mono">{b.draws}</TableCell><TableCell className="mono">{b.triangles}</TableCell><TableCell className="mono">{b.lines}</TableCell><TableCell className="mono">{(100 * b.share).toFixed(1)} %</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </>}
      <div className="muted small" aria-label="Rebuild limits">{report.limits} Frame costs are work counts on this renderer, not GPU time; they are not compared across renderers.</div>
    </>}
  </aside>;
}
