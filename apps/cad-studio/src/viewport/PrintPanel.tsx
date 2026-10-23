import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { PrintOptions, PrintState } from './usePrintLayers';
import type { PrintPreviewPatch } from './printSettings';

const directions: { label: string; value: Vec3 }[] = [
  { label: '+Z', value: [0, 0, 1] }, { label: '+X', value: [1, 0, 0] }, { label: '+Y', value: [0, 1, 0] },
  { label: '−Z', value: [0, 0, -1] }, { label: '−X', value: [-1, 0, 0] }, { label: '−Y', value: [0, -1, 0] },
];
export function PrintPanel({ enabled, onEnabled, options, onOptions, onDirection, state, reason }: {
  enabled: boolean; onEnabled(value: boolean): void; options: PrintOptions;
  onOptions(value: PrintPreviewPatch): void; onDirection(value: Vec3 | undefined): void; state: PrintState; reason?: string;
}) {
  const d = state.display, max = Math.max(0, (state.count ?? d?.summary.count ?? 1) - 1), shown = Math.min(options.layer, max);
  const direction = options.direction ? directions.findIndex(x => x.value.every((v, i) => v === options.direction![i])) : -1;
  return <div className="card" aria-label="Print layers" style={{ padding: '6px 10px', maxWidth: 420 }}>
    <label><input type="checkbox" checked={enabled} aria-label="Print layers" onChange={e => onEnabled(e.target.checked)} /> Print layers</label>
    {enabled && <>
      <div role="status">{reason ?? state.error ?? (state.stage !== 'ready' ? 'Pending · current source layers are not ready' : `Layer ${d!.layer.k + 1} of ${d!.summary.count} · bed Z ${d!.layer.z.toFixed(3)} mm`)}</div>
      <label>Direction <select aria-label="Print direction" value={!options.direction ? 'default' : direction >= 0 ? String(direction) : 'custom'} onChange={e => onDirection(e.target.value === 'default' ? undefined : directions[Number(e.target.value)].value)}>
        <option value="default">Default +Z</option>{directions.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}{direction < 0 && options.direction && <option value="custom" disabled>Given [{options.direction.join(', ')}]</option>}
      </select></label>
      <label style={{ marginLeft: 8 }}><input type="checkbox" aria-label="Set layer height" checked={options.layerMM !== undefined} onChange={e => onOptions({ layerMM: e.target.checked ? 0.2 : undefined })} /> Set height</label>
      <input aria-label="Print layer height (mm)" type="number" min="0.001" step="0.05" disabled={options.layerMM === undefined} value={options.layerMM ?? 0.2} style={{ width: 64 }} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n > 0) onOptions({ layerMM: n }); }} /> mm
      <div><label>Layer <input aria-label="Print layer" type="range" min={0} max={max} step={1} value={shown} disabled={!state.count || !!reason} onChange={e => onOptions({ layer: e.target.valueAsNumber })} /></label> {shown + 1}</div>
      <label><input type="checkbox" aria-label="Printed up to layer" checked={options.printed} onChange={e => onOptions({ printed: e.target.checked })} /> Printed up to layer</label>
      <label style={{ marginLeft: 8 }}><input type="checkbox" aria-label="Print supports" checked={options.supports} onChange={e => onOptions({ supports: e.target.checked })} /> Supports</label>
      {d && <div>Top {d.topMM.toFixed(3)} mm · {d.summary.supportColumns.length} support columns · {d.summary.supportVolumeMM3.toFixed(3)} mm³
        <details><summary>Model → bed (mm)</summary><code>{[0, 1, 2, 3].map(row => [0, 1, 2, 3].map(col => d.summary.modelToBed[col * 4 + row].toFixed(3)).join(' ')).join('\n')}</code></details>
      </div>}
      {/* (G12c: compact — the colours as chips, NOT FOR PRODUCTION shown; the estimate's terms and notes behind Details.) */}
      <div className="legend-chips"><span className="legend-chip"><i style={{ background: '#3cc8e0' }} />contours</span><span className="legend-chip"><i style={{ background: '#f0a030' }} />overhang</span><span className="legend-chip"><i style={{ background: '#4caf7d' }} />support</span><span className="nfp-chip">NOT FOR PRODUCTION</span></div>
      <details className="panel-details"><summary>Details</summary>Display mesh estimate · {options.layerMM === undefined ? '0.2 mm layer height is estimated' : 'Layer height set'} · Not production-ready. Preview caps select bodies, not original faces. Layer settings are included when you save the document.</details>
    </>}
  </div>;
}
