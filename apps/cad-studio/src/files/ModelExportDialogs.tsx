import { Icon } from '../ui/atoms';
import type { ModelExportController } from './useModelExports';

/** Export options presented by the model export controller. */
export function ModelExportDialogs({ controller }: { controller: ModelExportController }) {
  const { stlAsk, stlQuality, stlBusy, stlLossHint, stlCancelButton, changeStlQuality, cancelStlExport, exportStl } = controller;
  return <>
      {stlAsk && <div className="toast card recovery" role="dialog" aria-label="STL export" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); cancelStlExport(); } }}>
        <Icon name="download" className="accent" />
        <div><div className="toast-title">STL export</div>
          <label className="kv"><span>Quality</span><select autoFocus aria-label="STL export quality" value={stlQuality} disabled={stlBusy} onChange={e => changeStlQuality(e.target.value)}>
            <option value="automatic">Automatic</option><option value="8">Draft 8</option><option value="16">Standard 16</option><option value="32">Fine 32</option>
          </select></label>
          <div className="toast-hint">{stlLossHint} Automatic allows the on-screen mesh as a fallback. Draft, Standard and Fine require BRep bodies.</div>
          <div className="row-actions"><button className="primary" disabled={stlBusy} onClick={() => void exportStl()}>{stlBusy ? 'Preparing…' : 'Export'}</button><button ref={stlCancelButton} className="ghost" onClick={cancelStlExport}>Cancel</button></div>
        </div>
      </div>}
  </>;
}
