import type { ClearancePair } from '@barocss/cad-model/team/clearanceMap';
import { clearancePairState } from './clearanceAnalysis';
import type { ClearanceDisplay } from './clearanceDisplay';

const numeric = (value: number) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—';
const pairName = (key: string, labels: ReadonlyMap<string, string>) => {
  if (labels.has(key)) return labels.get(key);
  const owner = [...labels.keys()].filter(id => id.endsWith('/') && key.startsWith(id)).sort((a, b) => b.length - a.length)[0];
  return owner ? labels.get(owner) + ' · ' + key.slice(owner.length) : key;
};
export function clearancePairLabel(pair: ClearancePair): string {
  const state = clearancePairState(pair);
  if (state === 'pending') return `${pair.state === 'designed' ? 'Designed contact' : 'Contact'} · overlap unclassified`;
  if (state === 'refused') return 'Refused · overlap unclassified';
  return state[0].toUpperCase() + state.slice(1);
}
export function ClearancePanel({ enabled, onEnabled, nearMM, onNear, display, reason, labels }: {
  enabled: boolean; onEnabled(value: boolean): void; nearMM: number; onNear(value: number): void;
  display: ClearanceDisplay | null; reason?: string; labels: ReadonlyMap<string, string>;
}) {
  return <div className="card" style={{ padding: '6px 10px', maxWidth: 440 }} aria-label="Assembly clearance">
    <label><input type="checkbox" aria-label="Assembly clearance" checked={enabled} onChange={event => onEnabled(event.target.checked)} /> Assembly clearance</label>
    {enabled && <>
      <label style={{ marginLeft: 10 }}>Near <input aria-label="Near clearance (mm)" type="number" min="0.001" step="0.1" value={nearMM} style={{ width: 64 }} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n) && n > 0) onNear(n); }} /> mm</label>
      <div role="status" aria-live="polite">{reason ?? display?.error ?? (!display || display.stage === 'evaluating' ? 'Pending · current pose not classified' : display.stage !== 'ready' ? 'Updating current pose…' : display.pairs.length ? `${display.pairs.length} candidate pair${display.pairs.length === 1 ? '' : 's'}` : `No candidate pairs within the ${numeric(nearMM)} mm band`)}</div>
      {!!display?.pairs.length && <ul style={{ maxHeight: 190, overflowY: 'auto', paddingLeft: 16, margin: '4px 0' }}>{display.pairs.map(pair => <li key={pair.a + '|' + pair.b} data-clearance-state={clearancePairState(pair)} style={{ padding: '3px 0' }}>
        <span>{pairName(pair.a, labels)} / {pairName(pair.b, labels)}</span><br />
        <strong>{clearancePairLabel(pair)}</strong> · mesh gap {numeric(pair.minGapMM)} mm
        {pair.overlap && 'volumeMM3' in pair.overlap && <> · overlap {numeric(pair.overlap.volumeMM3)} mm³</>}
        {pair.designed && <div>Source: {pair.designed}</div>}
        {pair.overlap && 'refused' in pair.overlap && <div>{pair.overlap.refused}</div>}
      </li>)}</ul>}
      {/* (G12c: compact — the states' colours as chips; what the results are behind Details.) */}
      <div className="legend-chips"><span className="legend-chip"><i style={{ background: '#fa8a1f' }} />near or pending</span><span className="legend-chip"><i style={{ background: '#f02120' }} />overlap</span><span className="legend-chip"><i style={{ background: '#42a8f0' }} />touching</span><span className="legend-chip"><i style={{ background: '#21b88a' }} />designed</span><span className="legend-chip"><i style={{ background: 'repeating-linear-gradient(45deg, #ff2020 0 2px, transparent 2px 4px)' }} />refused</span></div>
      <details className="panel-details"><summary>Details</summary>Model geometry results · display analysis. Orange: near or pending · red: overlap · blue: touching · teal: designed · red hatch: refused.</details>
    </>}
  </div>;
}
