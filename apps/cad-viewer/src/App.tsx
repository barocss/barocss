import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { Viewer, ViewerGeometryRef, ViewerState } from '@barocss/viewer';
import { createViewerController } from '../controller.js';
import { Button } from './components/ui/button';
import { ViewerIcon as Icon } from './components/ViewerIcon';
import { Input } from './components/ui/input';
import { NativeSelect } from './components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog';
import { DistancePanel, MeasurementOverlay } from './DistancePanel';
import type { DistanceMeasurement, ProjectedMeasurementPoint } from './DistancePanel';
import { LightingPanel } from './LightingPanel';
import { AssemblyTree } from './AssemblyTree';
import { AssemblyInspector, AssemblyPoints } from './AssemblyInspector';
import type { AssemblyInspection, AssemblyPoint } from './AssemblyInspector';
import { NamedViewsPanel } from './NamedViewsPanel';
import { DocumentInspector } from './DocumentInspector';
import type { DocumentInspection } from './DocumentInspector';
import type { GeometryInspection } from './GeometryMetrics';

type Body = {
  id: string;
  name: string;
  kind: string;
  geometryId: string;
  assetId: string;
  assetRevision: number | null;
  supported: boolean;
  reason?: string;
  parentId?: string | null;
  ancestors?: string[];
};
type DocumentSummary = { kind: 'document' | 'assembly'; label: string; id: string; revision: number; catalog: Body[] };
type ViewPreset = 'iso' | 'front' | 'top' | 'right';
type CompactPanel = 'document' | 'inspector';
const compactQuery = '(max-width: 900px), (max-width: 1000px) and (max-height: 500px)';
type ViewModel = {
  ready: boolean;
  startupState: 'starting' | 'available' | 'failed';
  startupFailure: string;
  deviceStatus: string;
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
  pickFilter: 'all' | 'surface' | 'curve';
  appearanceTarget: string;
  appearancePreset: string;
  appearanceNote: string;
  lightingCapabilities: ReturnType<Viewer['getLightingCapabilities']> | null;
  lightingError: string;
  measurement: DistanceMeasurement;
  measurementOverlay: { width: number; height: number; points: ProjectedMeasurementPoint[] };
  assemblyInspection: AssemblyInspection | null;
  assemblyPoints: (AssemblyPoint | null)[];
  assemblyDistance: number | null;
  assemblyDistanceError: string;
  documentInspection: DocumentInspection | null;
  pointMeasurementActions: { canSetA: boolean; canSetB: boolean; secondReason: string };
  geometryInspection: GeometryInspection | null;
  namedViews: string[];
  namedBusy: boolean;
  namedViewError: string;
};

const initialModel: ViewModel = {
  ready: false, startupState: 'starting', startupFailure: '', deviceStatus: '', active: null, admitted: [], state: null, search: '',
  candidate: null, admissionIds: [], admissionError: '', status: 'Starting Viewer…',
  statusError: false, exportStatus: '', exportBusy: false, reviewBusy: false, viewPreset: null, pickFilter: 'all',
  appearanceTarget: '', appearancePreset: 'default', appearanceNote: 'Load a Surface to change its appearance.',
  lightingCapabilities: null, lightingError: '',
  measurement: { active: false, points: [], result: null, error: '' },
  measurementOverlay: { width: 0, height: 0, points: [] },
  assemblyInspection: null,
  assemblyPoints: [null, null],
  assemblyDistance: null, assemblyDistanceError: '',
  documentInspection: null,
  pointMeasurementActions: { canSetA: false, canSetB: false, secondReason: 'Set point A first.' },
  geometryInspection: null,
  namedViews: [], namedBusy: false, namedViewError: '',
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const documentFileRef = useRef<HTMLInputElement>(null);
  const reviewFileRef = useRef<HTMLInputElement>(null);
  const measurementToolRef = useRef<HTMLButtonElement>(null);
  const documentPanelRef = useRef<HTMLElement>(null);
  const inspectorPanelRef = useRef<HTMLElement>(null);
  const documentToggleRef = useRef<HTMLButtonElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const pendingPanelFocus = useRef<CompactPanel | null>(null);
  const admissionTargetRef = useRef<HTMLLabelElement>(null);
  const replacementFirstRef = useRef<HTMLInputElement>(null);
  const admissionOriginRef = useRef<HTMLElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof createViewerController> | null>(null);
  const [model, setModel] = useState<ViewModel>(initialModel);
  const [admissionTarget, setAdmissionTarget] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [compactPanel, setCompactPanel] = useState<CompactPanel | null>(null);

  useEffect(() => {
    const query = window.matchMedia(compactQuery);
    const update = (event: MediaQueryListEvent) => {
      const active = document.activeElement;
      if (event.matches) {
        setCompactPanel(documentPanelRef.current?.contains(active) ? 'document'
          : inspectorPanelRef.current?.contains(active) ? 'inspector' : null);
      } else {
        if (active === documentToggleRef.current || active === inspectorToggleRef.current)
          canvasRef.current?.focus({ preventScroll: true });
        setCompactPanel(null);
      }
      pendingPanelFocus.current = null;
      setCompact(event.matches);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const requested = pendingPanelFocus.current;
    if (!compact || !requested || compactPanel !== requested) return;
    const panel = requested === 'document' ? documentPanelRef.current : inspectorPanelRef.current;
    const controls = panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
    const target = controls && Array.from(controls).find(element => element.getClientRects().length > 0);
    (target ?? panel)?.focus({ preventScroll: true });
    pendingPanelFocus.current = null;
  }, [compact, compactPanel]);

  useEffect(() => { if (!model.candidate) setAdmissionTarget(null); }, [model.candidate]);

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
  const toggleCompactPanel = (panel: CompactPanel, event: MouseEvent<HTMLButtonElement>) => {
    const openPanel = compactPanel === 'document' ? documentPanelRef.current : inspectorPanelRef.current;
    if (openPanel?.contains(document.activeElement)) event.currentTarget.focus({ preventScroll: true });
    if (compactPanel === panel) { pendingPanelFocus.current = null; setCompactPanel(null); return; }
    pendingPanelFocus.current = event.detail === 0 ? panel : null;
    setCompactPanel(panel);
  };
  const closeCompactPanel = (panel: CompactPanel, event: KeyboardEvent<HTMLElement>) => {
    if (!compact || event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    (panel === 'document' ? documentToggleRef : inspectorToggleRef).current?.focus({ preventScroll: true });
    setCompactPanel(null);
  };
  const chooseUnloaded = (id: string, origin: HTMLButtonElement) => {
    admissionOriginRef.current = origin; setAdmissionTarget(id); setReplacementId(null); api()?.openBodies();
  };
  const openDocumentPicker = () => {
    admissionOriginRef.current = null; setAdmissionTarget(null);
    api()?.beginDocumentPick();
    documentFileRef.current?.click();
  };
  const openReviewPicker = () => {
    api()?.beginReviewPick();
    reviewFileRef.current?.click();
  };
  const state = model.state;
  const isAssembly = model.active?.kind === 'assembly';
  const candidateIsAssembly = model.candidate?.kind === 'assembly';
  const replacementMode = Boolean(admissionTarget && model.active && model.candidate
    && model.active.kind === model.candidate.kind && model.active.id === model.candidate.id
    && model.active.revision === model.candidate.revision && model.admissionIds.length === 4
    && model.admitted.length === 4 && !model.admissionIds.includes(admissionTarget));
  const replacementTarget = model.candidate?.catalog.find(body => body.id === admissionTarget);
  const selected = state?.selectedGeometry;
  const canFitSelected = Boolean(model.ready && selected && state?.visibleGeometry.some(ref => sameRef(ref, selected)));
  const canOpen = model.startupState === 'available' && Boolean(state);
  const isolateBlocked = Boolean(selected && state?.surfaceMaterials.some(entry =>
    !sameRef({ kind: 'surface', ...entry.ref }, selected)));
  const filter = model.search.trim().toLowerCase();
  const catalog = model.active?.catalog ?? [];
  const filteredBodies = catalog.filter(body => !filter ||
    [body.name, body.id, body.geometryId, body.assetId].join(' ').toLowerCase().includes(filter));
  const assetIds = [...new Set(filteredBodies.map(body => body.assetId))];
  const selectedSource = selected && state && model.active ? bodyFor(selected, state, model.active) : null;
  const selectedInstance = selected && state?.assemblyInstances.find(row => sameRef(row.ref, selected));
  const selectionRows = selectedInstance ? [
    ['Instance', selectedInstance.instanceId], ['Type', selectedInstance.ref.kind === 'surface' ? 'Surface' : 'Curve'],
    ['Parent', selectedInstance.parentId ?? 'Root'], ['Path', [...selectedInstance.ancestors, selectedInstance.instanceId].join(' / ')],
    ['Assembly', selectedInstance.assemblyId], ['Revision', selectedInstance.assemblyRevision],
    ['Part document', selectedInstance.reference.documentId], ['Part revision', selectedInstance.reference.documentRevision],
    ['Body', selectedInstance.reference.bodyId], ['Geometry', selectedInstance.reference.geometryId],
    ['Asset', selectedInstance.reference.assetId], ['Asset revision', selectedInstance.reference.assetRevision],
    ['Local origin mm', [3, 7, 11].map(index => selectedInstance.localMatrix[index]).join(', ')],
    ['Assembly origin mm', [3, 7, 11].map(index => selectedInstance.worldMatrix[index]).join(', ')],
  ] : selected && model.active ? [
    ['Name', selectedSource?.body?.name || geometryId(selected)],
    ['Type', selected.kind === 'surface' ? 'Surface' : 'Curve'],
    ['Geometry', geometryId(selected)], ['Body', selectedSource?.binding?.bodyId],
    ['Asset', selectedSource?.binding?.assetId], ['Asset revision', selectedSource?.binding?.assetRevision],
    ['Document', model.active.id], ['Revision', model.active.revision], ['Units', 'mm'],
  ] : [];
  const appearanceSurface = !isAssembly && state?.surfaces.find(ref => surfaceKey(ref) === model.appearanceTarget);
  const appearanceRef: ViewerGeometryRef | null = appearanceSurface ? { kind: 'surface', ...appearanceSurface } : null;
  const canApplyAppearance = Boolean(appearanceRef && state &&
    state.visibleGeometry.some(ref => sameRef(ref, appearanceRef)) && !sameRef(selected, appearanceRef));

  return <>
    <div className="viewer-app" data-compact={compact}>
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
            <input ref={documentFileRef} id="document-file" type="file" accept=".json,.igs,.iges,application/json" hidden
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void api()?.openDocument(file); else api()?.cancelDocumentPick();
              }} />
            <Button id="open-document" className="button-primary toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="default" size="sm"
              aria-label="Open CAD file" title="Open CAD file" disabled={!canOpen} onClick={openDocumentPicker}>
              <Icon name="open" />
            </Button>
            <Button id="close-document" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm"
              aria-label="Close CAD file" title="Close CAD file" disabled={!model.ready}
              onClick={() => { if (api()?.closeDocument()) document.getElementById('open-document')?.focus(); }}>
              <Icon name="close" />
            </Button>
            <Button id="open-sample" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Document sample" title="Open document sample"
              disabled={!canOpen} onClick={() => { admissionOriginRef.current = null; setAdmissionTarget(null); void api()?.openSample(); }}>
              <Icon name="cube" />
            </Button>
            <Button id="open-assembly-sample" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Assembly sample" title="Open assembly sample"
              disabled={!canOpen} onClick={() => { admissionOriginRef.current = null; setAdmissionTarget(null); void api()?.openSample('assembly'); }}>
              <Icon name="assembly" />
            </Button>
          </div>
          <div className="toolbar-spacer" />
          <div className="toolbar-group review-actions" aria-label="Review file actions">
            <Button id="save-review" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Save review" aria-busy={model.reviewBusy}
              disabled={!model.ready || model.reviewBusy || model.namedBusy || model.measurement.active}
              title={model.measurement.active ? 'Finish or cancel point selection before saving.' : model.reviewBusy ? 'Saving review…' : 'Save review'}
              onClick={() => void api()?.downloadReview()}>
              <Icon name="save" />
            </Button>
            <input ref={reviewFileRef} id="review-file" type="file" accept=".json,application/json" hidden
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void api()?.openReview(file); else api()?.cancelReviewPick();
              }} />
            <Button id="open-review" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Open review" title="Open review"
              disabled={!model.ready || model.reviewBusy || model.namedBusy} onClick={openReviewPicker}>
              <Icon name="upload" />
            </Button>
          </div>
          <div className="toolbar-group export-actions">
            <Button id="export-png" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="outline" size="sm" aria-label="Export PNG"
              title={model.exportBusy ? 'Exporting PNG…' : 'Export PNG'} aria-busy={model.exportBusy} disabled={!model.ready || model.exportBusy}
              onClick={() => void api()?.exportImage()}><Icon name="camera" /></Button>
            <Button id="export-measured-png" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="outline" size="sm"
              aria-label="Export PNG with distance" aria-busy={model.exportBusy}
              title={model.exportBusy ? 'Exporting PNG…' : model.measurement.result ? 'Export PNG with distance' : 'Complete a distance measurement first.'}
              disabled={!model.ready || model.exportBusy || !model.measurement.result}
              onClick={() => void api()?.exportImage(true)}><Icon name="cameraMeasure" /></Button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside ref={documentPanelRef} id="compact-document-panel" className="document-panel" tabIndex={-1}
          data-compact-open={compact && compactPanel === 'document'} hidden={compact && compactPanel !== 'document'}
          onKeyDown={event => closeCompactPanel('document', event)} aria-label={isAssembly ? 'Assembly instances' : 'Document bodies'}>
          <div className="panel-heading document-heading">
            <span className="panel-label">{isAssembly ? 'Assembly' : 'Document'}</span>
            <h1 id="document-title">{model.active?.label || 'Untitled session'}</h1>
            <p id="document-subtitle">{model.active ? `${model.active.id} · revision ${model.active.revision}` : 'No document open'}</p>
          </div>
          <div className="body-toolbar">
            <label className="search-field" htmlFor="body-search"><Icon name="search" />
              <Input id="body-search" type="search" className="h-auto min-w-0 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label={isAssembly ? 'Find an instance' : 'Find a body'} placeholder={isAssembly ? 'Find an instance' : 'Find a body'} autoComplete="off" disabled={!model.ready}
                value={model.search} onChange={event => api()?.setSearch(event.target.value)} />
            </label>
            <div className="body-toolbar-meta">
              <span id="body-count">{model.ready ? `${model.admitted.length} / ${catalog.length} loaded` : 'No document'}</span>
              <Button id="rechoose-bodies" className="text-button h-auto" variant="ghost" size="sm" disabled={!model.ready}
                onClick={event => { admissionOriginRef.current = event.currentTarget; setAdmissionTarget(null); api()?.openBodies(); }}>{isAssembly ? 'Choose instances' : 'Choose bodies'}</Button>
            </div>
          </div>
          <div id="body-list" className="body-list" aria-label={isAssembly ? 'Assembly instances' : 'Loaded bodies'}>
            {isAssembly && state ? <AssemblyTree key={`${model.active?.id}:${model.active?.revision}`} catalog={catalog}
              state={state} search={model.search} onSelect={ref => api()?.select(ref)}
              onChooseUnloaded={chooseUnloaded} onVisibility={(ref, visible) => api()?.setVisibility(ref, visible)} /> : assetIds.map(assetId => {
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
                    {entry || body.supported ? <Button className="body-select block h-auto min-h-10 flex-1 justify-start whitespace-normal p-1 text-left"
                      variant="ghost" size="sm" disabled={!visible || bound} aria-label={`Select ${body.name}`} aria-pressed={isSelected}
                      title={bound ? 'Clear the Surface material before selecting it.' : body.geometryId}
                      onClick={() => ref && api()?.select(ref)}>
                      <span>{body.name}</span><small>{entry ? body.geometryId : 'Not loaded'}</small>
                    </Button> : <div className="body-select" role="group" tabIndex={0} title={body.reason || 'Unsupported'}
                      aria-label={`${body.name}: ${body.reason || 'Unsupported'}`}><span>{body.name}</span><small>{body.reason || 'Unsupported'}</small></div>}
                    {!entry && body.supported && <Button type="button" className="inspector-icon h-[28px] w-[28px] p-0 [&_svg]:size-[14px]"
                      variant="ghost" size="sm" aria-label={`Choose ${body.name} to load`} title={`Choose ${body.name} to load`}
                      onClick={event => chooseUnloaded(body.id, event.currentTarget)}><Icon name="plus" /></Button>}
                  </div>;
                })}</div>
              </section>;
            })}
            {!isAssembly && model.active && assetIds.length === 0 && <p className="list-empty">No matching bodies.</p>}
          </div>
        </aside>

        <section className="viewport-panel" aria-label="Model workspace">
          <div className="viewport-toolbar">
            <div className="viewport-actions" aria-label="View actions">
              {compact && <div className="viewport-action-group compact-panel-controls" role="group" aria-label="Panels"
                onKeyDown={event => { if (compactPanel) closeCompactPanel(compactPanel, event); }}>
                <Button ref={documentToggleRef} id="compact-document-toggle" type="button"
                  className="toolbar-icon compact-panel-toggle h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm"
                  aria-label="Document panel" aria-controls="compact-document-panel" aria-pressed={compactPanel === 'document'}
                  title="Document panel" onClick={event => toggleCompactPanel('document', event)}><Icon name="panelLeft" /></Button>
                <Button ref={inspectorToggleRef} id="compact-inspector-toggle" type="button"
                  className="toolbar-icon compact-panel-toggle h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm"
                  aria-label="Properties panel" aria-controls="compact-inspector-panel" aria-pressed={compactPanel === 'inspector'}
                  title="Properties panel" onClick={event => toggleCompactPanel('inspector', event)}><Icon name="panelRight" /></Button>
              </div>}
              <div className="viewport-action-group" role="group" aria-label="Frame and visibility">
                <Button id="fit-all" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Fit all" title="Fit all visible bodies (F)"
                  disabled={!model.ready || !state?.visibleGeometry.length} onClick={() => api()?.fit()}><Icon name="fit" /></Button>
                <Button id="fit-selected" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Fit selected" title="Fit selected in ISO (Shift+F)"
                  disabled={!canFitSelected} onClick={() => api()?.fitSelected()}><Icon name="focus" /></Button>
                <Button id="show-all" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Show all" title="Show all"
                  disabled={!model.ready} onClick={() => api()?.showAll()}><Icon name="eye" /></Button>
              </div>
              <div className="viewport-action-group" role="group" aria-label="Selection actions">
                <Button id="hide-selected" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Hide selected" title="Hide selected"
                  disabled={!selected} onClick={() => api()?.hideSelected()}><Icon name="hide" /></Button>
                <Button id="isolate-selected" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Isolate selected" disabled={!selected || isolateBlocked}
                  title={isolateBlocked ? 'Clear material overrides on other bodies before isolating.' : 'Show only the selected body'}
                  onClick={() => api()?.isolateSelected()}><Icon name="isolate" /></Button>
                <Button id="clear-selection" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Clear selection" title="Clear selection (Escape)" disabled={!selected}
                  onClick={() => api()?.select(null)}><Icon name="close" /></Button>
              </div>
              <div className="viewport-action-group" role="group" aria-label="Viewport picking">
                <Button ref={measurementToolRef} id="measure-tool" className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm" aria-label="Measure distance" aria-pressed={model.measurement.active}
                  disabled={!model.ready || !state?.visibleGeometry.length || isAssembly}
                  title={isAssembly ? 'Native distance measurement is unavailable in assembly mode.' : 'Measure two native points'}
                  onClick={() => { if (model.measurement.active) api()?.cancelMeasurement(); else api()?.startMeasurement(); }}>
                  <Icon name="ruler" />
                </Button>
                <label className="viewport-pick-filter" htmlFor="pick-filter"
                  title="Viewport pick filter">
                  <Icon name="filter" />
                  <NativeSelect id="pick-filter" className="h-[30px] w-[90px] px-2 text-xs" aria-label="Viewport pick filter" disabled={!model.ready} value={model.pickFilter}
                    title="Filters viewport clicks and measurement picks. Tree selection and visibility are unchanged."
                    onChange={event => api()?.setPickFilter(event.target.value as ViewModel['pickFilter'])}>
                    <option value="all">All</option><option value="surface">Surface</option><option value="curve">Curve</option>
                  </NativeSelect>
                </label>
              </div>
            </div>
            <div className="view-presets" aria-label="Standard views">
              {(['iso', 'front', 'top', 'right'] as const).map(name => <Button key={name} id={`view-${name}`} className="toolbar-icon h-[32px] w-[32px] p-0 [&_svg]:size-[18px]" variant="ghost" size="sm"
                aria-label={name === 'iso' ? 'Isometric view' : `${name[0].toUpperCase()}${name.slice(1)} view`}
                title={name === 'iso' ? 'Isometric view' : `${name[0].toUpperCase()}${name.slice(1)} view`}
                disabled={!model.ready} aria-pressed={model.viewPreset === name} onClick={() => api()?.standardView(name)}>
                <Icon name={name} />
              </Button>)}
            </div>
          </div>
          <div ref={stageRef} id="viewport-stage" className="viewport-stage">
            <canvas ref={canvasRef} id="viewport" tabIndex={model.ready ? 0 : -1} data-measuring={model.measurement.active}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight F Shift+F Escape"
              title="Arrow keys: orbit · Shift+arrows: pan · +/−: zoom"
              aria-label={model.measurement.active ? 'Distance tool. Click two points in the same asset. Press Escape to cancel.'
                : 'CAD model. Drag to orbit, Shift-drag to pan, and scroll to zoom.'} />
            {model.deviceStatus !== 'WebGPU device lost' && model.deviceStatus !== 'WebGPU recovery failed'
              && <MeasurementOverlay {...model.measurementOverlay} />}
            <div id="empty-state" className="empty-state" hidden={model.ready}>
              <div className="empty-content" role={model.startupState === 'failed' ? 'alert' : undefined}>
                <svg className="empty-document-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 4h10l5 5v19H9V4Z" /><path d="M19 4v6h5M13 16h7m-7 5h7" /></svg>
                <h2>{model.startupState === 'starting' ? 'Starting Viewer…' : model.startupState === 'failed'
                  ? model.startupFailure : 'No CAD file open'}</h2>
                {model.startupState === 'available' && <Button id="empty-open" className="button-primary" variant="default" size="sm" disabled={!canOpen} onClick={openDocumentPicker}>
                  Open CAD file<Icon name="arrow" />
                </Button>}
              </div>
            </div>
          </div>
        </section>

        <aside ref={inspectorPanelRef} id="compact-inspector-panel" className="inspector-panel" tabIndex={-1}
          data-compact-open={compact && compactPanel === 'inspector'} hidden={compact && compactPanel !== 'inspector'}
          onKeyDown={event => closeCompactPanel('inspector', event)} aria-label="Model inspector">
          <div className="inspector-heading"><h2>Properties</h2></div>
          <NamedViewsPanel key={`${model.active?.kind}:${model.active?.id}:${model.active?.revision}`} names={model.namedViews}
            disabled={!model.ready || model.reviewBusy || model.namedBusy} measurementActive={model.measurement.active}
            error={model.namedViewError} onSave={name => api()?.saveNamedView(name) ?? Promise.resolve(false)}
            onRestore={name => api()?.restoreNamedView(name)}
            onRename={(name, nextName) => api()?.renameNamedView(name, nextName) ?? Promise.resolve(false)}
            onDelete={name => api()?.deleteNamedView(name) ?? Promise.resolve(false)} />
          {!isAssembly && model.documentInspection && model.geometryInspection && <DocumentInspector inspection={model.documentInspection}
            metrics={model.geometryInspection} onCalculate={options => { void api()?.calculateDocumentGeometry(options); }}
            distanceActions={model.pointMeasurementActions} onSetDistancePoint={endpoint => api()?.setInspectedMeasurementPoint(endpoint)}
            onInspect={query => api()?.inspectDocumentPoint(query)} />}
          {isAssembly && model.assemblyInspection && <AssemblyInspector inspection={model.assemblyInspection}
            onInspect={query => api()?.inspectAssemblyPoint(query)} onSetPoint={endpoint => api()?.setAssemblyPoint(endpoint)} />}
          {isAssembly && <AssemblyPoints points={model.assemblyPoints} distance={model.assemblyDistance}
            error={model.assemblyDistanceError} onClear={() => api()?.clearAssemblyPoints()} />}
          {(model.measurement.active || model.measurement.points.length > 0) && <DistancePanel measurement={model.measurement}
            onStart={() => api()?.startMeasurement()}
            onCancel={() => { api()?.cancelMeasurement(); measurementToolRef.current?.focus(); }}
            onClear={() => { api()?.clearMeasurement(); measurementToolRef.current?.focus(); }} />}
          <section className="inspector-section selection-section">
            <div className="section-heading"><h3>Selection</h3></div>
            <p id="selection-empty" className="context-note" hidden={!model.ready || Boolean(selected)}>Select a body to inspect its properties.</p>
            <dl id="selection-details" className="selection-details" hidden={!selected}>
              {selectionRows.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{String(value ?? '—')}</dd></Fragment>)}
            </dl>
          </section>
          {model.lightingCapabilities && <LightingPanel lighting={model.lightingCapabilities.lighting}
            disabled={!model.ready || !model.lightingCapabilities.supported}
            error={model.lightingError} reason={model.ready ? model.lightingCapabilities.reason : 'Load a Surface to adjust lighting.'}
            onApply={input => api()?.applyLighting(input)} onReset={() => api()?.resetLighting()} />}
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
              title={model.appearanceNote} aria-describedby="appearance-note"
              onClick={() => api()?.applyAppearance()}>Apply appearance</Button>
            <span id="appearance-note" className="sr-only">{model.appearanceNote}</span>
          </section>
        </aside>
      </main>

      <footer className="statusbar">
        <div className="status-main"><span className="status-indicator" aria-hidden="true" />
          <span id="status" role="status" aria-live={model.startupState === 'failed' ? 'off' : 'polite'}
            data-level={model.statusError || model.deviceStatus === 'WebGPU device lost'
              || model.deviceStatus === 'WebGPU recovery failed' ? 'error' : 'info'}
            tabIndex={model.statusError || model.deviceStatus ? 0 : undefined}
            title={model.deviceStatus === 'WebGPU device recreated' ? `${model.deviceStatus} · ${model.status}` : model.deviceStatus || model.status}>
            {model.deviceStatus === 'WebGPU device recreated' ? `${model.deviceStatus} · ${model.status}` : model.deviceStatus || model.status}</span>
        </div>
        <span id="export-status" className="export-status" role="status" aria-live="polite">{model.exportStatus}</span>
        <span id="session-meta" className="session-meta">{model.ready
          ? `${state?.visibleGeometry.length ?? 0} visible · ${model.admitted.length} loaded · mm`
          : model.startupState === 'starting' ? 'Starting' : model.startupState === 'failed' ? 'Unavailable' : 'Ready'}</span>
      </footer>
    </div>

    <Dialog open={Boolean(model.candidate)} onOpenChange={open => { if (!open) { setAdmissionTarget(null); setReplacementId(null); api()?.cancelCandidate(); } }}>
      <DialogContent id="admission-dialog" className="admission-dialog gap-0 overflow-hidden border-[#46545e] bg-[#1d252c] p-0 text-[#dce2e6] sm:max-w-[570px]"
        overlayClassName="bg-[#080e14b8] backdrop-blur-[3px]"
        onOpenAutoFocus={event => {
          if (replacementMode && replacementFirstRef.current) {
            event.preventDefault(); replacementFirstRef.current.focus({ preventScroll: true });
            replacementFirstRef.current.scrollIntoView({ block: 'nearest' }); return;
          }
          const row = admissionTargetRef.current;
          if (!admissionTarget || !row) return;
          event.preventDefault();
          const input = row.querySelector('input');
          (input && !input.disabled ? input : row).focus({ preventScroll: true });
          row.scrollIntoView({ block: 'nearest' });
        }}
        onCloseAutoFocus={event => {
          const origin = admissionOriginRef.current;
          if (!origin) return;
          event.preventDefault();
          const fallback = compact && compactPanel !== 'document' ? documentToggleRef.current
            : document.querySelector<HTMLElement>('#rechoose-bodies');
          const target = origin.isConnected && origin.getClientRects().length > 0 && !origin.matches(':disabled') ? origin : fallback;
          target?.focus({ preventScroll: true });
          admissionOriginRef.current = null;
        }}
        aria-labelledby="admission-heading" aria-describedby="admission-description">
        <div className="dialog-heading">
          <span className="eyebrow">{candidateIsAssembly ? 'Open assembly' : 'Open document'}</span>
          <DialogTitle id="admission-heading">{replacementMode ? `Replace with ${replacementTarget?.name || admissionTarget}`
            : candidateIsAssembly ? 'Choose instances' : 'Choose bodies'}</DialogTitle>
          <DialogDescription id="admission-description" className="sr-only">{replacementMode
            ? `Select an existing ${candidateIsAssembly ? 'instance' : 'body'} to replace.`
            : `Select 1–4 supported ${candidateIsAssembly ? 'instances' : 'bodies'} to load.`}</DialogDescription>
        </div>
        <div className="candidate-summary"><h3 id="candidate-title">{model.candidate?.label}</h3>
          <p id="candidate-meta">{model.candidate ? `${model.candidate.id} · revision ${model.candidate.revision} · ${model.candidate.catalog.length} ${candidateIsAssembly ? 'instances' : 'bodies'}` : ''}</p>
        </div>
        <div id="admission-list" className="admission-list" role={replacementMode ? 'radiogroup' : undefined}
          aria-label={replacementMode ? `Replace ${candidateIsAssembly ? 'an instance' : 'a body'}`
            : candidateIsAssembly ? 'Available assembly instances' : 'Available document bodies'}>
          {replacementMode ? model.admissionIds.map((id, index) => {
            const body = model.candidate?.catalog.find(row => row.id === id);
            if (!body) return null;
            return <label key={body.id} className="admission-row">
              <input ref={index === 0 ? replacementFirstRef : undefined} type="radio" name="admission-replacement"
                value={body.id} checked={replacementId === body.id} aria-label={`Replace ${body.name}`}
                onChange={() => setReplacementId(body.id)} />
              <span><strong>{body.name}</strong><small>{body.kind} · {body.geometryId}</small>
                {candidateIsAssembly && <small className="assembly-admission-parent">{body.ancestors?.length ? body.ancestors.join(' / ') : 'Root occurrence'}</small>}
              </span>
            </label>;
          }) : model.candidate?.catalog.map(body => {
            const checked = model.admissionIds.includes(body.id);
            return <label key={body.id} className="admission-row" tabIndex={body.id === admissionTarget ? -1 : undefined}
              aria-describedby={body.id === admissionTarget && !checked && model.admissionIds.length >= 4 ? 'admission-target-limit' : undefined}
              ref={body.id === admissionTarget ? admissionTargetRef : undefined}>
              <input type="checkbox" value={body.id} checked={checked} disabled={!body.supported || (!checked && model.admissionIds.length >= 4)}
                aria-label={`Load ${body.name}`} onChange={event => api()?.toggleAdmission(body.id, event.target.checked)} />
              <span><strong>{body.name}</strong><small>{body.supported ? `${body.kind} · ${body.geometryId}` : body.reason}</small>
                {body.id === admissionTarget && !checked && model.admissionIds.length >= 4 && <small id="admission-target-limit">Remove one selection to load this item.</small>}
                {candidateIsAssembly && <small className="assembly-admission-parent">{body.ancestors?.length ? body.ancestors.join(' / ') : 'Root occurrence'}</small>}
              </span>
            </label>;
          })}
        </div>
        <div className="admission-feedback"><span id="admission-count">{model.admissionIds.length} of 4 {candidateIsAssembly ? 'instances' : 'bodies'} selected</span>
          <p id="admission-error" role="status" aria-live="polite">{model.admissionError}</p>
        </div>
        <div className="dialog-actions">
          <Button id="cancel-document" variant="outline" size="sm" onClick={() => { setAdmissionTarget(null); setReplacementId(null); api()?.cancelCandidate(); }}>Cancel</Button>
          <Button id="admit-document" className="button-primary" variant="default" size="sm"
            disabled={replacementMode ? !replacementId : model.admissionIds.length < 1 || model.admissionIds.length > 4 || Boolean(admissionTarget && !model.admissionIds.includes(admissionTarget))}
            title={replacementMode ? undefined : admissionTarget && !model.admissionIds.includes(admissionTarget) ? 'Select this item before loading.' : undefined}
            onClick={() => replacementMode && admissionTarget && replacementId
              ? api()?.admit({ targetId: admissionTarget, replacedId: replacementId }) : api()?.admit()}>{candidateIsAssembly ? 'Load instances' : 'Load bodies'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
