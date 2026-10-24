// The mesh repair gate (M3, D47): what is wrong with a mesh, the repair steps to take (on by default, each one
// turned off as wanted; holes by name, the fill's coarseness), the repair checked in the worker before it is applied
// (its numbers: fill triangles, area added, what is still open), then applied as a recorded step on the mesh node —
// or the mesh opened as it is when it is closed. O16: its ticks and actions on shadcn (TICK, Button); the box is the
// studio's.
import type { MeshDiagnosis, MeshRepairReport, MeshRepairSteps } from '@barocss/cad';
import { Icon } from './atoms';
import { TICK } from './panelStyles';
import { Button } from '@/components/ui/button';

export interface MeshRepairPanelProps {
  title: string;
  diagnosis: MeshDiagnosis;
  steps: MeshRepairSteps;
  onSteps(steps: MeshRepairSteps): void;
  /** The checked repair's report (null until checked; stale once the steps change). */
  report: MeshRepairReport | null;
  busy: boolean;
  onCheck(): void;
  onApply(): void;
  /** Opening (or keeping) the mesh as it is; absent when it is not closed (it would not build). */
  onAsIs?: () => void;
  asIsLabel: string;
  onCancel(): void;
}

const fmt = (x: number) => x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1);
/** The holes listed by name (largest first), at most this many with ticks; the rest follow the "all holes" tick. */
const LISTED = 8;

export function MeshRepairPanel(p: MeshRepairPanelProps) {
  const d = p.diagnosis, s = p.steps, fill = typeof s.fill === 'object' ? s.fill : s.fill === false ? null : {};
  const skip = new Set(fill?.skip ?? []), set = (patch: Partial<MeshRepairSteps>) => p.onSteps({ ...s, ...patch });
  const problems = [
    d.degenerate + d.duplicates ? `${d.degenerate + d.duplicates} degenerate or duplicate triangle${d.degenerate + d.duplicates > 1 ? 's' : ''}` : '',
    d.nonManifoldEdges ? `${d.nonManifoldEdges} edge${d.nonManifoldEdges > 1 ? 's' : ''} of more than two triangles` : '',
    d.inconsistentEdges ? `${d.inconsistentEdges} edge${d.inconsistentEdges > 1 ? 's' : ''} wound both ways` : '',
    d.holes.length ? `${d.holes.length} hole${d.holes.length > 1 ? 's' : ''}` : '',
    d.floaters ? `${d.floaters} tiny piece${d.floaters > 1 ? 's' : ''}` : '',
    d.selfIntersections ? `crosses itself in ${d.selfIntersections} place${d.selfIntersections > 1 ? 's' : ''} (not repaired: Booleans will refuse it)` : '',
  ].filter(Boolean);
  const holes = [...d.holes].sort((a, b) => b.perimeterMM - a.perimeterMM);
  const toggleHole = (i: number, on: boolean) => { const next = new Set(skip); if (on) next.delete(i); else next.add(i); set({ fill: { ...fill, skip: [...next].sort((a, b) => a - b) } }); };
  const r = p.report;
  return <div className="toast card recovery mesh-repair" role="dialog" aria-label="Mesh repair">
    <Icon name="healing" className="accent" />
    <div>
      <div className="toast-title">{p.title}</div>
      <div className="toast-hint">{d.triangles.toLocaleString('en-US')} triangles{d.pieces > 1 ? `, ${d.pieces} pieces` : ''}. {problems.length ? `Found: ${problems.join('; ')}.` : 'Closed and clean.'}</div>
      <div className="repair-steps" role="group" aria-label="Repair steps">
        <label><input type="checkbox" className={TICK} aria-label="Drop degenerate triangles" checked={s.degenerate !== false} onChange={e => set({ degenerate: e.currentTarget.checked })} /> Drop degenerate and duplicate triangles</label>
        <label><input type="checkbox" className={TICK} aria-label="Drop fins" checked={s.fins !== false} onChange={e => set({ fins: e.currentTarget.checked })} /> Drop fins at edges of more than two triangles</label>
        <label><input type="checkbox" className={TICK} aria-label="Orient" checked={s.orient !== false} onChange={e => set({ orient: e.currentTarget.checked })} /> Wind every triangle one way, outward</label>
        <label><input type="checkbox" className={TICK} aria-label="Fill holes" checked={!!fill} onChange={e => set({ fill: e.currentTarget.checked ? {} : false })} /> Fill holes{d.holes.length ? ` (${d.holes.length})` : ''} — a guess at the surface, shown after</label>
        {fill && d.holes.length > 0 && <div className="repair-holes">
          {holes.slice(0, LISTED).map(h => <label key={h.index}><input type="checkbox" className={TICK} aria-label={`Fill hole ${h.index + 1}`} checked={!skip.has(h.index)} onChange={e => toggleHole(h.index, e.currentTarget.checked)} />
            Hole {h.index + 1}: {h.edges} edges, {fmt(h.perimeterMM)} mm round</label>)}
          {holes.length > LISTED && <span className="muted">and {holes.length - LISTED} smaller</span>}
          <label><input type="checkbox" className={TICK} aria-label="Coarser fill" checked={(fill.coarseness ?? 1) > 1} onChange={e => set({ fill: { ...fill, coarseness: e.currentTarget.checked ? 2 : 1 } })} /> Coarser fill (half the rim's resolution)</label>
        </div>}
        <label><input type="checkbox" className={TICK} aria-label="Drop tiny pieces" checked={s.floaters !== false} onChange={e => set({ floaters: e.currentTarget.checked ? { minFraction: 0.01 } : false })} /> Drop pieces under 1% of the largest{d.floaters ? ` (${d.floaters})` : ''}</label>
      </div>
      {r && <div className="toast-hint repair-report" aria-label="Repair report">
        Repair: {[
          r.welded ? `${r.welded} corners welded` : '', r.degenerateRemoved + r.duplicatesRemoved ? `${r.degenerateRemoved + r.duplicatesRemoved} triangles dropped` : '',
          r.finsRemoved ? `${r.finsRemoved} fin${r.finsRemoved > 1 ? 's' : ''} (${r.finTriangles} triangles) dropped` : '', r.flipped ? `${r.flipped} triangles turned` : '',
          r.holesFilled ? `${r.holesFilled} hole${r.holesFilled > 1 ? 's' : ''} filled with ${r.fillTriangles.toLocaleString('en-US')} triangles (${fmt(r.filledAreaMM2)} mm² added, the largest ${fmt(r.largestFilledPerimeterMM)} mm round)` : '',
          r.floatersRemoved ? `${r.floatersRemoved} tiny piece${r.floatersRemoved > 1 ? 's' : ''} (${fmt(r.floaterVolumeMM3)} mm³) dropped` : '',
        ].filter(Boolean).join('; ') || 'nothing to change'}.{' '}
        {r.closed ? 'Closed: it opens as a solid.' : `Still open${r.holesLeft ? ` (${r.holesLeft} hole${r.holesLeft > 1 ? 's' : ''} left)` : ''}${r.nonManifoldEdgesLeft ? `, ${r.nonManifoldEdgesLeft} edges of more than two triangles left` : ''}: it opens as a sheet — no volume, no Booleans.`}
      </div>}
      <div className="flex flex-wrap gap-1">
        {r ? <Button variant="default" disabled={p.busy} onClick={p.onApply}>{r.closed || r.nonManifoldEdgesLeft === 0 ? 'Apply the repair' : 'Apply'}</Button>
          : <Button variant="default" disabled={p.busy} onClick={p.onCheck}>Check the repair</Button>}
        {r && <Button variant="ghost" disabled={p.busy} onClick={p.onCheck}>Check again</Button>}
        {p.onAsIs && <Button variant="ghost" disabled={p.busy} onClick={p.onAsIs}>{p.asIsLabel}</Button>}
        <Button variant="ghost" disabled={p.busy} onClick={p.onCancel}>Cancel</Button>
      </div>
    </div>
  </div>;
}
