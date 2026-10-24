// An analysis map's legend (G6): one small element — its title and unit, the map's colours as a bar across its range with
// the thresholds marked, the colour past it, and the value under the pointer. Drawn by the DOM when the map or the value
// changes, not per frame.
import type { ScalarMap } from '../viewport/scalarMaps';
import { Button } from '@/components/ui/button';

/** The thresholds with room for a label: none within 28 % of the bar's ends or of a label before it (their marks stay, with a title). */
function labelled(map: ScalarMap, lo: number, span: number): ScalarMap['thresholds'] {
  const out: ScalarMap['thresholds'] = [];
  for (const t of [...map.thresholds].sort((a, b) => a.value - b.value)) {
    const f = (t.value - lo) / span;
    if (f < 0.28 || f > 0.72 || out.some(o => Math.abs((o.value - lo) / span - f) < 0.28)) continue;
    out.push(t);
  }
  return out;
}
const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

export function MapLegend({ map, hover }: { map: ScalarMap; hover: number | null }) {
  const [lo, hi] = map.range, span = Math.max(1e-12, hi - lo), at = (v: number) => `${(((v - lo) / span) * 100).toFixed(2)}%`;
  const gradient = `linear-gradient(to right, ${map.legend.stops.map(([v, c]) => `${c} ${at(v)}`).join(', ')})`;
  return (
    <div className="card map-legend" role="group" aria-label="Map legend">
      <div className="map-legend-head"><span>{map.legend.title}</span><span className="mono" aria-label="Map value">{hover === null ? '—' : `${fmt(hover)} ${map.unit}`}</span></div>
      <div className="map-legend-bar">
        <div className="map-legend-ramp" style={{ background: gradient }} />
        {map.above && <div className="map-legend-past" style={{ background: map.above }} title="past the range" />}
        {map.thresholds.map(t => <div key={t.label} className="map-legend-mark" style={{ left: at(t.value) }} title={`${t.label}: ${fmt(t.value)} ${map.unit}`} />)}
      </div>
      <div className="map-legend-scale mono"><span>{fmt(lo)}</span>{labelled(map, lo, span).map(t => <span key={t.label} style={{ left: at(t.value) }}>{fmt(t.value)}</span>)}<span>{fmt(hi)} {map.unit}</span></div>
    </div>
  );
}

type MouldResult = Awaited<ReturnType<import('../engine/client').EngineClient['mould']>> | 'working' | null;
const volume = (bs: readonly { volumeMM3?: number | null }[]) => bs.reduce((t, b) => t + (b.volumeMM3 ?? 0), 0);

/**
 * The mould's legend (G6): the parting line's loops, and for the halves their bodies and volumes (+ along the pull, − against
 * it) with a spread toggle, or why they cannot be built; one small element.
 */
export function MouldLegend({ kind, result, pull, spread, onSpread }: { kind: 'parting' | 'halves'; result: MouldResult; pull: boolean; spread: number; onSpread(mm: number): void }) {
  const r = result && result !== 'working' && !('error' in result) ? result : null, size = r ? Math.max(1, ...[...r.plus, ...r.minus].map(b => Math.hypot(b.mesh.bounds.max[0] - b.mesh.bounds.min[0], b.mesh.bounds.max[1] - b.mesh.bounds.min[1], b.mesh.bounds.max[2] - b.mesh.bounds.min[2]))) : 1;
  const flat = r ? r.loops.filter(l => l.flat).length : 0;
  return (
    <div className="card map-legend" role="group" aria-label="Mould legend">
      <div className="map-legend-head"><span>{kind === 'parting' ? 'Parting line' : 'Mould halves'}</span>
        {kind === 'halves' && r && (r.plus.length || r.minus.length) ? <Button variant="ghost" size="xs" aria-label="Spread the halves" onClick={() => onSpread(spread ? 0 : size * 0.4)}>{spread ? 'Close' : 'Spread'}</Button> : null}</div>
      {!pull ? <div className="muted">No pull: set the moulding's pull first.</div>
        : result === 'working' ? <div className="muted">Working…</div>
        : result === null ? <div className="muted">—</div>
        : 'error' in result ? <div className="muted">{result.error}</div>
        : <>
          <div className="mono" aria-label="Parting loops"><span className="map-legend-swatch" style={{ background: '#e8c25a' }} />{r!.loops.length} loop{r!.loops.length === 1 ? '' : 's'}{r!.loops.length ? ` (${flat} flat)` : ''}</div>
          {kind === 'halves' && (r!.why ? <div className="muted" aria-label="Halves refused">{r!.why}</div> : <>
            <div className="mono" aria-label="Plus half"><span className="map-legend-swatch" style={{ background: '#5b9bd5' }} />+ half: {r!.plus.length} bod{r!.plus.length === 1 ? 'y' : 'ies'}, {Math.round(volume(r!.plus)).toLocaleString('en-US')} mm³</div>
            <div className="mono" aria-label="Minus half"><span className="map-legend-swatch" style={{ background: '#e0a040' }} />− half: {r!.minus.length} bod{r!.minus.length === 1 ? 'y' : 'ies'}, {Math.round(volume(r!.minus)).toLocaleString('en-US')} mm³</div>
          </>)}
        </>}
    </div>
  );
}
