import type { ToolShape } from '@barocss/cad-model/machining/camPackage';
import type { CamOptions } from './camDisplay';
import type { CamState } from './camPreview';
import { CAM_TOOL_NOSE_RINGS, CAM_TOOL_SECTORS } from './camToolGeometry';

// G23 CNC (G-R3): the material-removal preview's controls. Session only: nothing here is saved; the program comes from
// the document's machining stock and geometry, so Save and Open give the same preview. NOT FOR PRODUCTION stays shown.

const KINDS: ToolShape['kind'][] = ['flat', 'ball', 'bull'];
const mm = (v: number, d = 3) => `${+v.toFixed(d)} mm`;

export function CamPanel({ options, onOptions, state, reason }: {
  options: CamOptions; onOptions(patch: Partial<CamOptions>): void; state: CamState; reason?: string;
}) {
  const pkg = state.package, d = state.display, count = state.count ?? 0, setups = pkg?.setups ?? [];
  const move = d && d.setup.moves[Math.min(Math.floor(d.progress), d.setup.moves.length - 1)];
  const tool = options.tool, setTool = (patch: Partial<NonNullable<CamOptions['tool']>> | null) => onOptions({ tool: patch ? { ...tool, ...patch } : undefined });
  return <div className="card" aria-label="CNC preview" style={{ padding: '6px 10px', maxWidth: 420 }}>
    {/* (G12d: the chip shown, the package's whole banner — what the preview is not — behind Details and as the chip's tip.) */}
    <div role="note"><span className="nfp-chip" title={pkg?.banner}>NOT FOR PRODUCTION</span> a display estimate, no G-code</div>
    <div role="status">{reason ?? state.error ?? (state.stage !== 'ready' ? 'Pending · the current program is not ready' : `Move ${Math.min(count, Math.floor(d!.progress) + 1)} of ${count} · ${move?.kind ?? ''}`)}</div>
    {setups.length > 0 && <label>Setup <select aria-label="CNC setup" value={Math.min(options.setup, setups.length - 1)} onChange={e => onOptions({ setup: Number(e.target.value), progress: 0 })}>
      {setups.map((s, i) => <option key={s.setup} value={i}>{s.setup} · {s.moves.length} moves</option>)}</select></label>}
    <div><label>Progress <input aria-label="CNC progress" type="range" min={0} max={count} step={0.05} value={Math.min(options.progress, count)} disabled={!count || !!reason}
      onChange={e => onOptions({ progress: e.target.valueAsNumber })} /></label>
      <button className="ghost small" aria-label="CNC progress to the end" disabled={!count || !!reason} onClick={() => onOptions({ progress: count })}>End</button></div>
    <label>Grid <input aria-label="CNC grid pitch (mm)" type="number" min="0.05" step="0.1" value={options.cellMM} style={{ width: 64 }}
      onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n > 0) onOptions({ cellMM: n }); }} /> mm asked</label>
    <div>
      <label><input type="checkbox" aria-label="Set the CNC tool" checked={!!tool} onChange={e => setTool(e.target.checked ? { kind: pkg?.tool.kind ?? 'flat', diameterMM: pkg?.tool.diameterMM ?? 6 } : null)} /> Set tool</label>
      {tool && <>
        <select aria-label="CNC tool shape" value={tool.kind ?? 'flat'} onChange={e => setTool({ kind: e.target.value as ToolShape['kind'], cornerMM: undefined })}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
        <input aria-label="CNC tool diameter (mm)" type="number" min="0.1" step="0.5" value={tool.diameterMM ?? pkg?.tool.diameterMM ?? 6} style={{ width: 56 }}
          onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n > 0) setTool({ diameterMM: n }); }} /> Ø mm
        {tool.kind === 'bull' && <><input aria-label="CNC tool corner radius (mm)" type="number" min="0.05" step="0.25" value={tool.cornerMM ?? (tool.diameterMM ?? 6) / 4} style={{ width: 56 }}
          onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n > 0) setTool({ cornerMM: n }); }} /> r mm</>}
      </>}
    </div>
    {d && <div role={d.removal.overcutCells ? 'alert' : undefined}>{d.removal.overcutCells
      ? `Overcut: ${d.removal.overcutCells} cells, ${d.removal.overcutMM3.toFixed(1)} mm³ cut from the part (red)`
      : 'No overcut: the tool stays out of the part (to the field\'s resolution)'}</div>}
    {/* (G12c: compact — the colours as chips; the tool, the removal's terms and the limits behind Details.) */}
    <div className="legend-chips"><span className="legend-chip"><i style={{ background: '#e0a030' }} />stock left</span><span className="legend-chip"><i style={{ background: '#f02120' }} />cut below the part</span><span className="legend-chip"><i style={{ background: '#9aa0a8' }} />the part</span></div>
    <details className="panel-details"><summary>Details</summary>
    {pkg?.banner && <div>{pkg.banner}</div>}
    {pkg && <div>Tool {pkg.tool.kind} Ø{+pkg.tool.diameterMM.toFixed(3)} · corner {+pkg.tool.cornerMM.toFixed(3)} · flute {+pkg.tool.fluteMM.toFixed(3)} · shank Ø{+pkg.tool.shankMM.toFixed(3)} ({pkg.tool.basis.shape === 'given' ? 'given' : 'estimated'}; the shank's length shown as one diameter, an estimate; no holder)</div>}
    {d && <div>Removed {d.removal.removedMM3.toFixed(1)} mm³ (a grid estimate) · grid {d.removal.nx} × {d.removal.ny} at {mm(d.removal.cellMM)} · samples every {mm(d.removal.sampleMM)} · ±{mm(d.removal.lateralUncertaintyMM)} across
      {'kind' in pkg!.stock && <> · stock {pkg!.stock.kind}</>} · safe Z {mm(d.setup.safeZ.mm, 2)} (an estimate)</div>}
    {pkg && pkg.skipped.length > 0 && <details><summary>{pkg.skipped.length} feature{pkg.skipped.length === 1 ? '' : 's'} not machined</summary>
      <ul>{pkg.skipped.map((s, i) => <li key={i}>{s.feature}: {s.why}</li>)}</ul></details>}
    <div className="muted" style={{ fontSize: 11 }}>Amber: stock left (cells cut only where the tool reaches them whole) · red: cut below the part's surface (more than 0.01 mm) · grey: the part · paths: rapid blue, feed green, plunge red, ramp yellow, retract violet; done paths bright.
      Tool mesh {CAM_TOOL_SECTORS} sectors, {CAM_TOOL_NOSE_RINGS} nose rings. One setup at a time from the whole stock; no undercuts, holder collision, speeds or feeds.</div>
    </details>
  </div>;
}
