import type { ModelExportController } from './useModelExports';

/** One preparation panel in the existing right dock; only Export downloads. */
export function StepExportPanel({ controller }: { controller: ModelExportController }) {
  const { stepPreview: step, clearStepAsk, exportStepFile, downloadStep } = controller;
  if (!step) return null;
  return <section className="card" aria-label="STEP export" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); clearStepAsk(); } }}>
    <div className="card-title">STEP EXPORT <button className="ghost small" aria-label="Close STEP export" onClick={clearStepAsk}>Close</button></div>
    <div className="kv"><span>File</span><b>{step.name}.step</b></div>
    <p className="muted">{step.profile}</p>
    {step.hasMeshes && <label className="kv"><span>Mesh bodies</span><select aria-label="STEP mesh representation" value={step.meshes} onChange={e => void exportStepFile(e.target.value as typeof step.meshes)}>
      <option value="auto">Auto</option><option value="tessellated">Tessellated</option><option value="planar">Planar faces</option>
    </select></label>}
    {step.hasMeshes && <p className="muted">Auto uses planar faces for small closed meshes and tessellation for larger or open meshes. Reader support varies.</p>}
    {step.stage === 'preparing' && <p role="status">Preparing geometry and loss report…</p>}
    {step.stage === 'error' && <p role="alert">{step.error}</p>}
    {step.stage === 'ready' && <>
      <div className="ol-head">What this file leaves out</div>
      {step.losses.length ? <ul aria-label="STEP loss report">{step.losses.map(loss => <li key={loss}>{loss}</li>)}</ul> : <p>No additional losses reported for this input.</p>}
      <p className="muted">Geometry profile: no native editing history, semantic PMI or named datum system transfer. The file/product name and generated face names are separate from user labels.</p>
    </>}
    <div className="row-actions"><button className="primary" disabled={step.stage !== 'ready'} onClick={downloadStep}>Export</button><button className="ghost" onClick={clearStepAsk}>Cancel</button></div>
  </section>;
}
