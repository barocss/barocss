import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Box, ChevronDown, FileJson, FolderOpen, Info, Layers, Pencil, Redo2, Undo2, X } from 'lucide-react';
import type { CadEditorModelingSnapshot } from '../modeling-controller.js';

export type ModelingWorkspacePanel = 'add-arm' | 'union' | 'cut-slot' | 'new-part' | 'sketch' | 'dimensions' | 'extrusion' | 'examples' | 'outputs' | 'files' | 'inspect' | 'limits' | 'configuration';
export interface ModelingWorkspaceProps {
  snapshot: CadEditorModelingSnapshot | null;
  viewport: ReactNode;
  panels: Record<ModelingWorkspacePanel, ReactNode>;
  panel: ModelingWorkspacePanel | null;
  error: string | null;
  dimensionLabel: string;
  canEditDimensions: boolean;
  canEditSketch: boolean;
  canApplySketch: boolean;
  canEditExtrusion: boolean;
  canApplyExtrusion: boolean;
  canCreatePart: boolean;
  canAddArm: boolean; canUnion: boolean; canCutSlot: boolean; structureReason: string;
  canPreviewStructure: boolean; canApplyStructure: boolean;
  onPreviewStructure(): void; onApplyStructure(): void; onCancelStructure(): void;
  configurableFinishes: boolean;
  onPanel(panel: ModelingWorkspacePanel | null): void;
  onSelect(index: number): void;
  onApply(): void;
  onPreview(): void;
  previewContext: string;
  onCancelDimensions(): void;
  onCancelNewPart(): void;
  onCreatePart(): void;
  onCancelComputation(): void;
  onUndo(): void;
  onRedo(): void;
  onRetry(): void;
}
const panelTitles: Record<ModelingWorkspacePanel, string> = {
  'add-arm': 'Add rectangular arm', union: 'Union bodies', 'cut-slot': 'Cut rectangular through-slot',
  'new-part': 'New rectangular part', sketch: 'Edit sketch dimensions', dimensions: 'Edit dimensions', extrusion: 'Edit extrusion', examples: 'Modeling examples', outputs: 'Output bodies',
  files: 'Save or open a model', inspect: 'Inspect selection', limits: 'Capabilities & limits', configuration: 'Rail finishes',
};
/** Presentation only. All geometry, drafts, selection and history belong to the existing controller. */
export function ModelingWorkspace(props: ModelingWorkspaceProps) {
  const { snapshot, panel } = props, accepted = snapshot?.accepted;
  const workspaceRoot = useRef<HTMLElement | null>(null), optionsHeading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (panel === null) workspaceRoot.current?.focus();
    else optionsHeading.current?.focus();
  }, [panel]);
  const busy = snapshot?.busy ?? false, draft = Object.keys(snapshot?.drafts ?? {}).length > 0;
  const editingStructure = panel === 'add-arm' || panel === 'union' || panel === 'cut-slot';
  const editingDimensions = panel === 'dimensions' || panel === 'extrusion' || panel === 'sketch';
  const features = accepted?.features ?? [];
  const featureLabel = (index: number) => {
    const feature = features[index];
    if (!feature) return 'Model';
    const count = features.slice(0, index + 1).filter(item => item.kind === feature.kind).length;
    return `${feature.kind[0].toUpperCase()}${feature.kind.slice(1)} ${String(count).padStart(2, '0')}`;
  };
  const selected = snapshot?.selection === null || snapshot?.selection === undefined ? null : features[snapshot.selection];
  const select = (index: number) => { if (!busy) props.onSelect(index); };
  const closeMenus = (root: HTMLElement, restoreFocus = false) => {
    const menus = root.querySelectorAll<HTMLDetailsElement>('.modeling-command-menu[open]');
    menus.forEach(menu => { menu.open = false; });
    if (restoreFocus) menus[0]?.querySelector<HTMLElement>('summary')?.focus();
    return menus.length > 0;
  };
  const open = (next: ModelingWorkspacePanel, event: MouseEvent<HTMLButtonElement>) => {
    closeMenus(event.currentTarget.closest('.modeling-workspace') as HTMLElement); props.onPanel(next);
    if (panel === next) optionsHeading.current?.focus();
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229) return;
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation();
      if (closeMenus(event.currentTarget, true)) return;
      if (panel === 'new-part') { if (!busy) props.onCancelNewPart(); }
      else if (editingStructure) { if (!busy) props.onCancelStructure(); }
      else if (editingDimensions) { if (!busy) props.onCancelDimensions(); }
      else props.onPanel(null);
    } else if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z' && !busy && !draft) {
      if (event.shiftKey ? snapshot?.history.canRedo : snapshot?.history.canUndo) {
        event.preventDefault(); if (event.shiftKey) props.onRedo(); else props.onUndo();
      }
    }
  };
  const command = (next: ModelingWorkspacePanel, label: string, disabled = false) =>
    <button type="button" disabled={disabled} onClick={event => open(next, event)}>{label}</button>;
  return <section className="barocss-cad-editor modeling-workspace" data-testid="modeling-workspace" ref={workspaceRoot} tabIndex={-1} aria-label="CAD model editor" onKeyDown={keyboard}
    onClick={event => { if (!(event.target as Element).closest('.modeling-command-menu')) closeMenus(event.currentTarget); }}>
    <header className="modeling-document-bar">
      <span className="modeling-brand"><Box aria-hidden="true" />barocss</span>
      <div className="modeling-history-actions">
        <button type="button" aria-label="Undo" title="Undo · Ctrl/Cmd Z" disabled={busy || draft || !snapshot?.history.canUndo} onClick={props.onUndo}><Undo2 aria-hidden="true" /></button>
        <button type="button" aria-label="Redo" title="Redo · Ctrl/Cmd Shift Z" disabled={busy || draft || !snapshot?.history.canRedo} onClick={props.onRedo}><Redo2 aria-hidden="true" /></button>
      </div>
      <h1 className="modeling-document-tab"><Box aria-hidden="true" />Model a part{draft && <span title="Unapplied dimensions">●</span>}</h1>
      <span className="modeling-document-kind">{accepted?.source === 'legacy' ? 'Compatibility model' : 'CAD model'} · mm</span>
    </header>
    <nav className="modeling-ribbon" aria-label="Modeling commands">
      <div className="modeling-workspace-badge"><Box aria-hidden="true" /><strong>DESIGN</strong><small>Modeling</small></div>
      <div className="modeling-ribbon-content"><div className="modeling-workbench-label">MODEL</div><div className="modeling-command-groups">
        <details className="modeling-command-menu"><summary><FolderOpen aria-hidden="true" /><span>CREATE <ChevronDown aria-hidden="true" /></span></summary><div>{command('new-part', 'New rectangular part', busy)}{props.canAddArm && command('add-arm', 'Add rectangular arm', busy)}{command('examples', 'Modeling examples', busy)}<small>Author a rectangular part or load a supported example</small></div></details>
        <details className="modeling-command-menu"><summary><Pencil aria-hidden="true" /><span>MODIFY <ChevronDown aria-hidden="true" /></span></summary><div>{props.canEditSketch && command('sketch', 'Edit sketch dimensions', busy)}{props.canEditExtrusion && command('extrusion', 'Edit extrusion', busy)}{command('dimensions', props.dimensionLabel, busy || !props.canEditDimensions)}{props.canUnion && command('union', 'Union bodies', busy)}{props.canCutSlot && command('cut-slot', 'Cut rectangular through-slot', busy)}{props.configurableFinishes && command('configuration', 'Rail finishes', busy)}<small>{selected ? featureLabel(selected.index) : 'Model'} selected</small></div></details>
        <details className="modeling-command-menu"><summary><Info aria-hidden="true" /><span>INSPECT <ChevronDown aria-hidden="true" /></span></summary><div>{command('inspect', 'Inspect selection')}{command('outputs', 'Output bodies', !accepted)}{command('limits', 'Capabilities & limits')}</div></details>
        <details className="modeling-command-menu"><summary><FileJson aria-hidden="true" /><span>FILE <ChevronDown aria-hidden="true" /></span></summary><div>{command('files', 'Save or open a model')}{command('outputs', 'Export accepted STL', !accepted)}</div></details>
        <span className="modeling-command-context">{busy ? 'Native operation in progress' : selected ? `${featureLabel(selected.index)} selected` : 'Select a sketch or feature in the Browser'}</span>
      </div></div>
      {busy && <button type="button" className="modeling-stop" onClick={props.onCancelComputation}>Cancel computation</button>}
    </nav>
    <div className="modeling-work-area">
      <aside className="modeling-browser" data-testid="modeling-browser" aria-label="Model Browser"><h2>BROWSER</h2>
        <details open><summary><Box aria-hidden="true" />Model a part</summary>
          <details open><summary><Layers aria-hidden="true" />Features <small>{features.length}</small></summary>
            <ol>{features.map(feature => <li key={feature.index}><button type="button" data-feature-index={feature.index} disabled={busy}
              aria-pressed={snapshot?.selection === feature.index} onClick={() => select(feature.index)}>
              {feature.kind === 'sketch' ? <Pencil aria-hidden="true" /> : <Box aria-hidden="true" />}<span>{featureLabel(feature.index)}</span>
              {feature.suppressed && <small>off</small>}</button>
              {snapshot?.selection === feature.index && <span className="modeling-feature-dependencies">{feature.dependencies.length ? `Uses ${feature.dependencies.map(featureLabel).join(', ')}` : 'Original sketch intent'}{feature.name ? ` · ${feature.name}` : ''}</span>}
            </li>)}</ol>
          </details>
          <details open><summary><FolderOpen aria-hidden="true" />Outputs <small>{accepted?.outputs.length ?? 0}</small></summary>
            <ul>{accepted?.outputs.map(output => <li key={output.name}><button type="button" onClick={() => props.onPanel('outputs')}><Box aria-hidden="true" />{output.name}</button></li>)}</ul>
          </details>
        </details>
        {!accepted && <div className="modeling-empty"><p>{busy ? 'Building the initial model…' : 'No accepted model'}</p>{!busy && <button type="button" onClick={props.onRetry}>Retry model</button>}</div>}
      </aside>
      <main className="modeling-canvas-area" aria-label="Model viewport">
        {props.viewport}
        <div className="modeling-viewport-caption">{snapshot?.faceSelection ? `Selected ${snapshot.faceSelection.role} face` : 'Native model preview'} · approximate face selection</div>
        <aside className="modeling-options" data-testid="modeling-options" hidden={panel === null} aria-label={panel ? panelTitles[panel] : 'Command options'}>
          <header><h2 ref={optionsHeading} tabIndex={-1}>{panel === 'dimensions' ? props.dimensionLabel : panel ? panelTitles[panel] : ''}</h2>
            <button type="button" aria-label="Close options" disabled={(editingDimensions || editingStructure || panel === 'new-part') && busy} onClick={() => panel === 'new-part' ? props.onCancelNewPart() : editingStructure ? props.onCancelStructure() : editingDimensions ? props.onCancelDimensions() : props.onPanel(null)}><X aria-hidden="true" /></button></header>
          <div className="modeling-options-scroll">{(Object.keys(panelTitles) as ModelingWorkspacePanel[]).map(name =>
            <div key={name} data-testid={`modeling-panel-${name}`} hidden={panel !== name}>{props.panels[name]}</div>)}</div>
          {editingDimensions && accepted?.source === 'legacy' && <p>Legacy files support Apply; reversible preview currently requires a primary model.</p>}
          {editingDimensions && accepted?.source === 'model' && !snapshot?.workerReady && <p>Recovering before preview reconstructs the accepted model, then evaluates pending dimensions.</p>}
          {(editingDimensions || editingStructure) && snapshot?.preview && <div data-testid="modeling-preview-status" role="status">
            <p>{snapshot.preview.status === 'ready' ? 'Unapplied draft preview. Accepted source and history are retained. Apply or Cancel before selecting a face.' : snapshot.preview.status === 'unchanged' ? 'No geometric changes. Apply clears equivalent input without a history entry.' : snapshot.preview.status === 'computing' ? 'Preparing draft preview… Accepted model retained.' : 'Preview refused; accepted model retained.'}</p>
            {snapshot.preview.status === 'ready' && snapshot.preview.outputs?.map(output => <p key={output.name}>{output.name} preview volume: {output.volumeMM3 ? `${output.volumeMM3.numerator}/${output.volumeMM3.denominator} mm³` : 'not certified'}</p>)}
            {snapshot.preview.diagnostic && <div data-testid="modeling-preview-diagnostic">While editing {editingStructure && panel ? panelTitles[panel] : props.previewContext}: {snapshot.preview.diagnostic.stage}{snapshot.preview.diagnostic.code ? ` · ${snapshot.preview.diagnostic.code}` : ''}{snapshot.preview.diagnostic.operation ? ` · engine operation ${snapshot.preview.diagnostic.operation}` : ''}. {snapshot.preview.diagnostic.message}
              <p>Editing context is not an identified failing feature; shared dimensions may affect other features.</p>
              <button type="button" disabled={busy} onClick={() => optionsHeading.current?.focus()}>Review editing target</button>
            </div>}
          </div>}
          {editingStructure && <footer><span>Temporary structural options · accepted model retained</span><div>
            <button type="button" disabled={busy} onClick={props.onCancelStructure}>Cancel</button>
            <button type="button" disabled={busy || !props.canPreviewStructure} onClick={props.onPreviewStructure}>{snapshot?.workerReady ? 'Preview operation' : 'Recover accepted model and preview operation'}</button>
            <button type="button" className="modeling-apply" disabled={busy || !props.canApplyStructure} onClick={props.onApplyStructure}>Apply operation</button>
          </div></footer>}
          {editingStructure && !snapshot?.workerReady && <p>Recovery reconstructs the accepted source first, then evaluates this structural candidate.</p>}
          {panel === 'limits' && props.structureReason && <p>{props.structureReason}</p>}
          {(editingDimensions || panel === 'new-part') && <footer><span>{panel === 'new-part' ? 'Temporary creation settings · accepted model retained' : draft ? 'Unapplied dimensions · accepted model retained' : 'Edit the existing named dimensions'}</span><div>
            <button type="button" disabled={busy} onClick={panel === 'new-part' ? props.onCancelNewPart : props.onCancelDimensions}>Cancel</button>
            {editingDimensions && accepted?.source === 'model' && <button type="button" disabled={busy || !draft || (panel === 'extrusion' && !props.canApplyExtrusion) || (panel === 'sketch' && !props.canApplySketch)} onClick={props.onPreview}>{snapshot?.workerReady ? 'Preview dimensions' : 'Recover accepted model and preview'}</button>}
            <button type="button" className="modeling-apply" disabled={busy || (panel === 'new-part' ? !props.canCreatePart : !draft || (panel === 'extrusion' && !props.canApplyExtrusion) || (panel === 'sketch' && !props.canApplySketch))} onClick={panel === 'new-part' ? props.onCreatePart : props.onApply}>{panel === 'new-part' ? accepted ? 'Replace current model' : 'Create part' : panel === 'extrusion' ? 'Apply extrusion' : panel === 'sketch' ? 'Apply sketch dimensions' : 'Apply dimensions'}</button>
          </div></footer>}
        </aside>
        {(props.error || snapshot?.error) && <div className="modeling-workspace-error" role="alert">{props.error ?? snapshot?.error}</div>}
      </main>
    </div>
    <div className="modeling-command-status"><span>{panel === 'new-part' ? 'New rectangular part · Enter to create · Esc to cancel' : editingStructure && panel ? `${panelTitles[panel]} · Preview → Apply · Esc to cancel` : editingDimensions ? `${panel === 'extrusion' ? 'Edit extrusion' : panel === 'sketch' ? 'Edit sketch dimensions' : 'Edit dimensions'} · Enter to apply · Esc to cancel` : selected ? `${featureLabel(selected.index)} · choose Modify or Inspect` : 'Select a feature to choose its next command'}</span>{draft && !editingDimensions && <button type="button" onClick={() => props.onPanel('dimensions')}>Resume dimension edit</button>}</div>
    <nav className="modeling-feature-history" aria-label="Feature sequence">{features.map(feature => <button type="button" key={feature.index} data-feature-index={feature.index}
      aria-label={featureLabel(feature.index)} title={`${featureLabel(feature.index)}${feature.name ? ` · ${feature.name}` : ''}`} aria-pressed={snapshot?.selection === feature.index} disabled={busy}
      onClick={() => select(feature.index)}>{feature.kind === 'sketch' ? <Pencil aria-hidden="true" /> : <Box aria-hidden="true" />}</button>)}
      {features.length > 0 && <span className="modeling-history-end" />}<span>Feature order · read-only</span>
      <strong>History {(snapshot?.history.index ?? -1) + 1} / {snapshot?.history.count ?? 0}</strong>
    </nav>
    <footer className="modeling-workspace-status" role="status" aria-live="polite"><span>{busy ? 'Computing native geometry…' : accepted ? snapshot?.preview?.status === 'ready' ? 'Unapplied draft preview visible' : draft ? 'Dimension changes pending' : 'Accepted model' : 'No accepted model'}</span>
      <span>{selected ? featureLabel(selected.index) : 'Model'} · XYZ · mm</span></footer>
  </section>;
}
