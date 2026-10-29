import { MESH_PLANAR_TRIANGLES } from '@barocss/cad';
import { Icon } from '../ui/atoms';
import type { ModelExportController } from './useModelExports';

/** Export options presented by the model export controller. */
export function ModelExportDialogs({ controller }: { controller: ModelExportController }) {
  const { stlAsk, stlQuality, stlBusy, stlCancelButton, changeStlQuality, cancelStlExport, exportStl,
    stepAsk, exportStepFile, clearStepAsk } = controller;
  return <>
      {stlAsk && <div className="toast card recovery" role="dialog" aria-label="STL export" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); cancelStlExport(); } }}>
        <Icon name="download" className="accent" />
        <div><div className="toast-title">STL export</div>
          <label className="kv"><span>Quality</span><select autoFocus aria-label="STL export quality" value={stlQuality} disabled={stlBusy} onChange={e => changeStlQuality(e.target.value)}>
            <option value="automatic">Automatic</option><option value="8">Draft 8</option><option value="16">Standard 16</option><option value="32">Fine 32</option>
          </select></label>
          <div className="toast-hint">Automatic keeps the current mesh fallback. Draft, Standard and Fine export BRep bodies only. This does not change the on-screen mesh.</div>
          <div className="row-actions"><button className="primary" disabled={stlBusy} onClick={() => void exportStl()}>{stlBusy ? 'Preparing…' : 'Export'}</button><button ref={stlCancelButton} className="ghost" onClick={cancelStlExport}>Cancel</button></div>
        </div>
      </div>}
      {stepAsk && (() => {
        const last = (() => { try { return localStorage.getItem('studio.stepMeshes'); } catch { return null; } })() ?? 'auto';
        return <div className="toast card recovery" role="dialog" aria-label="STEP mesh bodies">
          <Icon name="deployed_code_update" className="accent" />
          <div><div className="toast-title">Mesh bodies in the STEP file as…</div>
            <div className="toast-hint">Tessellated (AP242) is compact, but older CAD, CAM and slicer readers may not take it. Planar faces are read by any reader, but large. Auto: planar up to {MESH_PLANAR_TRIANGLES.toLocaleString('en-US')} triangles a body, tessellated above.</div>
            <div className="row-actions">
              {(['auto', 'tessellated', 'planar'] as const).map(m => <button key={m} className={m === last ? 'primary' : 'ghost'} onClick={() => void exportStepFile(m)}>{m === 'auto' ? 'Auto' : m === 'tessellated' ? 'Tessellated (AP242, compact)' : 'Planar faces (compatible)'}</button>)}
              <button className="ghost" onClick={clearStepAsk}>Cancel</button>
            </div></div>
        </div>;
      })()}
  </>;
}
