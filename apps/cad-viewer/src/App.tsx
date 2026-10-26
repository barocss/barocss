import { Fragment, useEffect, useRef, useState } from 'react';
import type { ViewerGeometryRef, ViewerState } from '@barocss/viewer';
import { createViewerController } from '../controller.js';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { NativeSelect } from './components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog';
import { DistancePanel, MeasurementOverlay } from './DistancePanel';
import type { DistanceMeasurement, ProjectedMeasurementPoint } from './DistancePanel';

type Body = {
  id: string;
  name: string;
  kind: string;
  geometryId: string;
  assetId: string;
  assetRevision: number | null;
  supported: boolean;
  reason?: string;
};
type DocumentSummary = { label: string; id: string; revision: number; catalog: Body[] };
type ViewPreset = 'iso' | 'front' | 'top' | 'right';
type ViewModel = {
  ready: boolean;
  starting: boolean;
  active: DocumentSummary | null;
  admitted: string[];
  state: ViewerState | null;
  search: string;
  candidate: DocumentSummary | null;
  admissionIds: string[];
  admissionError: string;
  status: string;
  statusError: boolean;
  exportStatus: string;
  exportBusy: boolean;
  reviewBusy: boolean;
  viewPreset: ViewPreset | null;
  appearanceTarget: string;
  appearancePreset: string;
  appearanceNote: string;
  measurement: DistanceMeasurement;
  measurementOverlay: { width: number; height: number; points: ProjectedMeasurementPoint[] };
};

const initialModel: ViewModel = {
  ready: false, starting: true, active: null, admitted: [], state: null, search: '',
  candidate: null, admissionIds: [], admissionError: '', status: 'Starting Viewer…',
  statusError: false, exportStatus: '', exportBusy: false, reviewBusy: false, viewPreset: null,
  appearanceTarget: '', appearancePreset: 'default', appearanceNote: 'Load a Surface to change its appearance.',
  measurement: { active: false, points: [], result: null, error: '' },
  measurementOverlay: { width: 0, height: 0, points: [] },
};

function sameRef(a: ViewerGeometryRef | null | undefined, b: ViewerGeometryRef | null | undefined) {
  return Boolean(a && b && a.kind === b.kind && a.modelId === b.modelId
    && (a.kind === 'surface' ? a.surfaceId : a.curveId) === (b.kind === 'surface' ? b.surfaceId : b.curveId));
}
function geometryId(ref: ViewerGeometryRef) { return ref.kind === 'surface' ? ref.surfaceId : ref.curveId; }
function surfaceKey(ref: { modelId: string; surfaceId: string }) { return JSON.stringify([ref.modelId, ref.surfaceId]); }
function bodyFor(ref: ViewerGeometryRef, state: ViewerState, active: DocumentSummary) {
  const binding = state.documentBodies.find(body => sameRef(body.ref, ref))?.binding;
  return { binding, body: active.catalog.find(body => body.id === binding?.bodyId) };
}
function materialFor(ref: ViewerGeometryRef, state: ViewerState) {
  return ref.kind === 'surface' && state.surfaceMaterials.find(entry =>
    entry.ref.modelId === ref.modelId && entry.ref.surfaceId === ref.surfaceId);
}

const iconPaths = {
  document: 'M5 2.5h6.5L15 6v11.5H5v-15Z M11 2.5V7h4',
  lock: 'M5 8h10v9H5V8Z M7 8V5a3 3 0 0 1 6 0v3',
  open: 'M2.5 6V4.5h5l2 2H17V9 M2.5 6v10h13l2.5-7H5l-2.5 7',
  cube: 'm10 2 7 4v8l-7 4-7-4V6l7-4Z M3 6l7 4 7-4 M10 10v8',
  save: 'M10 2.5v10m-3.5-3 3.5 3.5 3.5-3.5 M3 13v4h14v-4',
  upload: 'M10 13V3m-3.5 3.5L10 3l3.5 3.5 M3 13v4h14v-4',
  camera: 'M3 5h3l1.5-2h5L14 5h3v12H3V5Z',
  search: 'm12.5 12.5 4 4',
  fit: 'M7 3H3v4m10-4h4v4M3 13v4h4m6 0h4v-4M7 7h6v6H7V7Z',
  eye: 'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z',
  arrow: 'M3.5 10h13m-5-5 5 5-5 5',
  surface: 'M3 6 13 3 17 14 7 17Z M6 5 10 16 M10 4 14 15 M5 10 15 7 M6 14 16 11',
  curve: 'M3 15C4 2 14 18 17 5 M3 14v2 M16 5h2',
};
function Icon({ name, className }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d={iconPaths[name]} />
    {name === 'camera' && <circle cx="10" cy="10.5" r="3" />}
    {name === 'search' && <circle cx="8.5" cy="8.5" r="5" />}
    {name === 'eye' && <circle cx="10" cy="10" r="2" />}
  </svg>;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const documentFileRef = useRef<HTMLInputElement>(null);
  const reviewFileRef = useRef<HTMLInputElement>(null);
  const measurementToolRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef<ReturnType<typeof createViewerController> | null>(null);
  const [model, setModel] = useState<ViewModel>(initialModel);

  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    const api = createViewerController({ canvas, stage, onChange: setModel });
    controllerRef.current = api;
    const cancelDocumentPick = () => api.cancelDocumentPick();
    const cancelReviewPick = () => api.cancelReviewPick();
    const documentInput = documentFileRef.current, reviewInput = reviewFileRef.current;
    documentInput?.addEventListener('cancel', cancelDocumentPick);
    reviewInput?.addEventListener('cancel', cancelReviewPick);
    void api.start();
    return () => {
      documentInput?.removeEventListener('cancel', cancelDocumentPick);
      reviewInput?.removeEventListener('cancel', cancelReviewPick);
      api.dispose();
      if (controllerRef.current === api) controllerRef.current = null;
    };
  }, []);

  const api = () => controllerRef.current;
  const openDocumentPicker = () => {
    api()?.beginDocumentPick();
    documentFileRef.current?.click();
  };
  const openReviewPicker = () => {
    api()?.beginReviewPick();
    reviewFileRef.current?.click();
  };
  const state = model.state;
  const selected = state?.selectedGeometry;
  const canOpen = !model.starting && Boolean(state);
  const isolateBlocked = Boolean(selected && state?.surfaceMaterials.some(entry =>
    !sameRef({ kind: 'surface', ...entry.ref }, selected)));
  const filter = model.search.trim().toLowerCase();
  const catalog = model.active?.catalog ?? [];
  const filteredBodies = catalog.filter(body => !filter ||
    [body.name, body.id, body.geometryId, body.assetId].join(' ').toLowerCase().includes(filter));
  const assetIds = [...new Set(filteredBodies.map(body => body.assetId))];
  const selectedSource = selected && state && model.active ? bodyFor(selected, state, model.active) : null;
  const selectionRows = selected && model.active ? [
    ['Name', selectedSource?.body?.name || geometryId(selected)],
    ['Type', selected.kind === 'surface' ? 'Surface' : 'Curve'],
    ['Geometry', geometryId(selected)], ['Body', selectedSource?.binding?.bodyId],
    ['Asset', selectedSource?.binding?.assetId], ['Asset revision', selectedSource?.binding?.assetRevision],
    ['Document', model.active.id], ['Revision', model.active.revision], ['Units', 'mm'],
  ] : [];
  const appearanceSurface = state?.surfaces.find(ref => surfaceKey(ref) === model.appearanceTarget);
  const appearanceRef: ViewerGeometryRef | null = appearanceSurface ? { kind: 'surface', ...appearanceSurface } : null;
  const canApplyAppearance = Boolean(appearanceRef && state &&
    state.visibleGeometry.some(ref => sameRef(ref, appearanceRef)) && !sameRef(selected, appearanceRef));

  return <>
    <div className="viewer-app">
      <header className="app-header">
        <div className="app-titlebar">
          <a className="app-brand" href="/" aria-label="CAD Viewer home">
            <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m12 2 8.66 5v10L12 22l-8.66-5V7L12 2Z" />
              <path d="m3.34 7 8.66 5 8.66-5M12 12v10M7.7 9.5 16.3 4.5" />
            </svg><span>CAD Viewer</span>
          </a>
          <div className="document-tab"><Icon name="document" />
            <span id="document-tab-title" title={model.active?.label || 'No document'}>{model.active?.label || 'No document'}</span>
          </div>
          <span className="readonly-label"><Icon name="lock" />Read only</span>
        </div>
        <div className="app-toolbar">
          <div className="toolbar-group file-actions" aria-label="Document actions">
            <input ref={documentFileRef} id="document-file" type="file" accept=".json,application/json" hidden
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void api()?.openDocument(file); else api()?.cancelDocumentPick();
              }} />
            <Button id="open-document" className="button-primary" variant="default" size="sm" disabled={!canOpen} onClick={openDocumentPicker}>
              <Icon name="open" />Open document
            </Button>
            <Button id="open-sample" variant="ghost" size="sm" disabled={!canOpen} onClick={() => void api()?.openSample()}>
              <Icon name="cube" />Open sample
            </Button>
          </div>
          <div className="toolbar-spacer" />
          <div className="toolbar-group review-actions" aria-label="Review file actions">
            <Button id="save-review" variant="ghost" size="sm" disabled={!model.ready || model.reviewBusy || model.measurement.active}
              title={model.measurement.active ? 'Finish or cancel point selection before saving.' : 'Save the view and completed measurement'}
              onClick={() => void api()?.downloadReview()}>
              <Icon name="save" />{model.reviewBusy ? 'Saving…' : 'Save review'}
            </Button>
            <input ref={reviewFileRef} id="review-file" type="file" accept=".json,application/json" hidden
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void api()?.openReview(file); else api()?.cancelReviewPick();
              }} />
            <Button id="open-review" variant="ghost" size="sm" disabled={!model.ready || model.reviewBusy} onClick={openReviewPicker}>
              <Icon name="upload" />Open review
            </Button>
          </div>
          <div className="toolbar-group export-actions">
            <Button id="export-png" variant="outline" size="sm" disabled={!model.ready || model.exportBusy}
              onClick={() => void api()?.exportImage()}><Icon name="camera" />{model.exportBusy ? 'Exporting…' : 'Export PNG'}</Button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="document-panel" aria-label="Document bodies">
          <div className="panel-heading document-heading">
            <span className="panel-label">Document</span>
            <h1 id="document-title">{model.active?.label || 'Untitled session'}</h1>
            <p id="document-subtitle">{model.active ? `${model.active.id} · revision ${model.active.revision}` : 'No document open'}</p>
          </div>
          <div className="body-toolbar">
            <label className="search-field" htmlFor="body-search"><Icon name="search" />
              <Input id="body-search" type="search" className="h-auto min-w-0 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label="Find a body" placeholder="Find a body" autoComplete="off" disabled={!model.ready}
                value={model.search} onChange={event => api()?.setSearch(event.target.value)} />
            </label>
            <div className="body-toolbar-meta">
              <span id="body-count">{model.ready ? `${model.admitted.length} / ${catalog.length} loaded` : 'No document'}</span>
              <Button id="rechoose-bodies" className="text-button h-auto" variant="ghost" size="sm" disabled={!model.ready}
                onClick={() => api()?.openBodies()}>Choose bodies</Button>
            </div>
          </div>
          <div id="body-list" className="body-list" aria-label="Loaded bodies">
            {assetIds.map(assetId => {
              const assetBodies = catalog.filter(body => body.assetId === assetId);
              const loadedCount = assetBodies.filter(body => state?.documentBodies.some(entry => entry.binding.bodyId === body.id)).length;
              return <section key={assetId} className="asset-group">
                <div className="asset-heading"><span>{assetId}</span><small>{loadedCount} / {assetBodies.length}</small></div>
                <div className="asset-bodies">{filteredBodies.filter(body => body.assetId === assetId).map(body => {
                  const entry = state?.documentBodies.find(value => value.binding.bodyId === body.id);
                  const ref = entry?.ref;
                  const visible = Boolean(ref && state?.visibleGeometry.some(value => sameRef(value, ref)));
                  const bound = Boolean(ref && state && materialFor(ref, state));
                  const isSelected = Boolean(ref && sameRef(selected, ref));
                  return <div key={body.id} className={`body-row${entry && !visible ? ' is-hidden' : ''}`}
                    data-body-id={body.id} data-selected={isSelected} data-admitted={Boolean(entry)}>
                    <input type="checkbox" className="body-visibility" checked={visible} disabled={!entry || bound}
                      aria-label={`Show ${body.name}`} title={bound ? 'Clear the Surface material before hiding it.'
                        : !entry ? 'Choose this body in Choose bodies.' : 'Show body'}
                      onChange={event => ref && api()?.setVisibility(ref, event.target.checked)} />
                    <span className="body-kind" title={body.kind}><Icon name={body.kind === 'surface' ? 'surface' : 'curve'} /></span>
                    <Button className="body-select block h-auto min-h-10 flex-1 justify-start whitespace-normal p-1 text-left"
                      variant="ghost" size="sm" disabled={!visible || bound} aria-label={`Select ${body.name}`} aria-pressed={isSelected}
                      title={bound ? 'Clear the Surface material before selecting it.' : body.geometryId}
                      onClick={() => ref && api()?.select(ref)}>
                      <span>{body.name}</span><small>{entry ? body.geometryId : 'Not loaded'}</small>
                    </Button>
                  </div>;
                })}</div>
              </section>;
            })}
            {assetIds.length === 0 && <p className="list-empty">{model.active ? 'No matching bodies.' : 'Open a document to view its bodies.'}</p>}
          </div>
          <p className="panel-footnote">CAD document · Read only</p>
        </aside>

        <section className="viewport-panel" aria-label="Model workspace">
          <div className="viewport-toolbar">
            <div className="viewport-actions" aria-label="View actions">
              <Button id="fit-all" variant="ghost" size="sm" title="Fit all visible bodies (F)"
                disabled={!model.ready || !state?.visibleGeometry.length} onClick={() => api()?.fit()}><Icon name="fit" />Fit all <kbd>F</kbd></Button>
              <Button id="show-all" variant="ghost" size="sm" disabled={!model.ready} onClick={() => api()?.showAll()}><Icon name="eye" />Show all</Button>
              <span className="toolbar-divider" aria-hidden="true" />
              <Button id="hide-selected" variant="ghost" size="sm" disabled={!selected} onClick={() => api()?.hideSelected()}>Hide</Button>
              <Button id="isolate-selected" variant="ghost" size="sm" disabled={!selected || isolateBlocked}
                title={isolateBlocked ? 'Clear material overrides on other bodies before isolating.' : 'Show only the selected body'}
                onClick={() => api()?.isolateSelected()}>Isolate</Button>
              <Button id="clear-selection" variant="ghost" size="sm" title="Clear selection (Escape)" disabled={!selected}
                onClick={() => api()?.select(null)}>Clear</Button>
              <span className="toolbar-divider" aria-hidden="true" />
              <Button ref={measurementToolRef} id="measure-tool" variant="ghost" size="sm" aria-pressed={model.measurement.active}
                disabled={!model.ready || !state?.visibleGeometry.length}
                onClick={() => { if (model.measurement.active) api()?.cancelMeasurement(); else api()?.startMeasurement(); }}>
                Measure
              </Button>
            </div>
            <div className="view-presets" aria-label="Standard views">
              {(['iso', 'front', 'top', 'right'] as const).map(name => <Button key={name} id={`view-${name}`} variant="ghost" size="sm"
                title={name === 'iso' ? 'Isometric view' : `${name[0].toUpperCase()}${name.slice(1)} view`}
                disabled={!model.ready} aria-pressed={model.viewPreset === name} onClick={() => api()?.standardView(name)}>
                {name === 'iso' ? 'ISO' : `${name[0].toUpperCase()}${name.slice(1)}`}
              </Button>)}
            </div>
          </div>
          <div ref={stageRef} id="viewport-stage" className="viewport-stage">
            <canvas ref={canvasRef} id="viewport" tabIndex={0} data-measuring={model.measurement.active}
              aria-label={model.measurement.active ? 'Distance tool. Click two points in the same asset. Press Escape to cancel.'
                : 'CAD model. Drag to orbit, Shift-drag to pan, and scroll to zoom.'} />
            <MeasurementOverlay {...model.measurementOverlay} />
            <span className="viewport-mode" aria-hidden="true">Perspective</span>
            <div id="empty-state" className="empty-state" hidden={model.ready}>
              <div className="empty-content">
                <svg className="empty-document-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 4h10l5 5v19H9V4Z" /><path d="M19 4v6h5M13 16h7m-7 5h7" /></svg>
                <h2>No document open</h2><p>Open a CAD JSON file to inspect its bodies.</p>
                <Button id="empty-open" className="button-primary" variant="default" size="sm" disabled={!canOpen} onClick={openDocumentPicker}>
                  Open document<Icon name="arrow" />
                </Button>
              </div>
            </div>
          </div>
          <div id="viewport-help" className="viewport-help">
            <span><span className="help-key">Drag</span> Orbit</span><span><span className="help-key">Shift + drag</span> Pan</span>
            <span><span className="help-key">Scroll</span> Zoom</span><span><span className="help-key">Click</span> {model.measurement.active ? 'Set point' : 'Select'}</span>
          </div>
        </section>

        <aside className="inspector-panel" aria-label="Model inspector">
          <div className="inspector-heading"><h2>Properties</h2></div>
          {(model.measurement.active || model.measurement.points.length > 0) && <DistancePanel measurement={model.measurement}
            onStart={() => api()?.startMeasurement()}
            onCancel={() => { api()?.cancelMeasurement(); measurementToolRef.current?.focus(); }}
            onClear={() => { api()?.clearMeasurement(); measurementToolRef.current?.focus(); }} />}
          <section className="inspector-section selection-section">
            <div className="section-heading"><h3>Selection</h3></div>
            <p id="selection-empty" className="context-note" hidden={Boolean(selected)}>Select a body to inspect its properties.</p>
            <dl id="selection-details" className="selection-details" hidden={!selected}>
              {selectionRows.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{String(value ?? '—')}</dd></Fragment>)}
            </dl>
          </section>
          <section className="inspector-section appearance-section">
            <div className="section-heading"><h3>Appearance</h3></div>
            <label className="field-label" htmlFor="appearance-target">Surface</label>
            <NativeSelect id="appearance-target" className="h-8 w-full rounded px-2.5 text-xs" disabled={!appearanceSurface} value={model.appearanceTarget}
              onChange={event => api()?.setAppearanceTarget(event.target.value)}>
              {!state?.surfaces.length && <option value="">No Surface loaded</option>}
              {state?.surfaces.map(ref => <option key={surfaceKey(ref)} value={surfaceKey(ref)}>
                {model.active ? bodyFor({ kind: 'surface', ...ref }, state, model.active).body?.name || ref.surfaceId : ref.surfaceId}
              </option>)}
            </NativeSelect>
            <label className="field-label" htmlFor="appearance-preset">Material</label>
            <NativeSelect id="appearance-preset" className="h-8 w-full rounded px-2.5 text-xs" disabled={!appearanceSurface} value={model.appearancePreset}
              onChange={event => api()?.setAppearancePreset(event.target.value)}>
              <option value="default">Default</option><option value="blue">Blue</option><option value="copper">Copper</option>
            </NativeSelect>
            <Button id="apply-appearance" className="button-wide" variant="outline" size="sm" disabled={!canApplyAppearance}
              onClick={() => api()?.applyAppearance()}>Apply appearance</Button>
            <p id="appearance-note" className="context-note">{model.appearanceNote}</p>
            <p className="scope-note">Review files do not save material overrides.</p>
          </section>
        </aside>
      </main>

      <footer className="statusbar">
        <div className="status-main"><span className="status-indicator" aria-hidden="true" />
          <span id="status" role="status" aria-live="polite" data-level={model.statusError ? 'error' : 'info'}>{model.status}</span>
        </div>
        <span id="export-status" className="export-status" role="status" aria-live="polite">{model.exportStatus}</span>
        <span id="session-meta" className="session-meta">{model.ready
          ? `${state?.visibleGeometry.length ?? 0} visible · ${model.admitted.length} loaded · mm` : model.starting ? 'Starting' : 'Ready'}</span>
      </footer>
    </div>

    <Dialog open={Boolean(model.candidate)} onOpenChange={open => { if (!open) api()?.cancelCandidate(); }}>
      <DialogContent id="admission-dialog" className="admission-dialog gap-0 overflow-hidden border-[#46545e] bg-[#1d252c] p-0 text-[#dce2e6] sm:max-w-[570px]"
        overlayClassName="bg-[#080e14b8] backdrop-blur-[3px]"
        aria-labelledby="admission-heading" aria-describedby="admission-description">
        <div className="dialog-heading">
          <span className="eyebrow">Open document</span>
          <DialogTitle id="admission-heading">Choose bodies</DialogTitle>
          <DialogDescription id="admission-description">Select 1–4 supported bodies to load.</DialogDescription>
        </div>
        <div className="candidate-summary"><h3 id="candidate-title">{model.candidate?.label}</h3>
          <p id="candidate-meta">{model.candidate ? `${model.candidate.id} · revision ${model.candidate.revision} · ${model.candidate.catalog.length} bodies` : ''}</p>
        </div>
        <div id="admission-list" className="admission-list" aria-label="Available document bodies">
          {model.candidate?.catalog.map(body => {
            const checked = model.admissionIds.includes(body.id);
            return <label key={body.id} className="admission-row">
              <input type="checkbox" value={body.id} checked={checked} disabled={!body.supported || (!checked && model.admissionIds.length >= 4)}
                aria-label={`Load ${body.name}`} onChange={event => api()?.toggleAdmission(body.id, event.target.checked)} />
              <span><strong>{body.name}</strong><small>{body.supported ? `${body.kind} · ${body.geometryId}` : body.reason}</small></span>
            </label>;
          })}
        </div>
        <div className="admission-feedback"><span id="admission-count">{model.admissionIds.length} of 4 bodies selected</span>
          <p id="admission-error" role="status" aria-live="polite">{model.admissionError}</p>
        </div>
        <div className="dialog-actions">
          <Button id="cancel-document" variant="outline" size="sm" onClick={() => api()?.cancelCandidate()}>Cancel</Button>
          <Button id="admit-document" className="button-primary" variant="default" size="sm" disabled={model.admissionIds.length < 1 || model.admissionIds.length > 4}
            onClick={() => api()?.admit()}>Load bodies</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
