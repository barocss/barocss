import { useEffect, useRef, useState } from 'react';
import { Box, ChevronRight, CircleHelp, Download, FolderOpen, Layers3, Maximize, Redo2, Undo2 } from 'lucide-react';
import { parseCadDocument } from '@barocss/cad';
import { CadEditorError, createCadEditorSession } from '@barocss/cad-editor';
import { CadEditor, useCadEditorSnapshot, type CadEditorDisplayOptions, type CadEditorDisplayReceipt } from '@barocss/cad-editor/react';
import fixtureText from '../fixtures/canonical-surface-and-curve.cad-document.json?raw';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted, readCadEditorFile } from './file-actions';
import { FeatureApp } from './feature-app';

function actionError(error: CadEditorError): string {
  const cause = error.cause instanceof Error ? error.cause.message : '';
  if (cause.includes('Weights must')) return 'Enter a weight from 0.000001 to 1000000.';
  if (error.message.includes('two assets and two bodies')) return 'Open a document with one Surface and one Curve.';
  if (error.message.includes('Native document Open')) return 'Cannot open this file. Select a valid CAD document.';
  if (error.context.field === 'fit-selection') return 'Show the selected object before fitting it.';
  if (cause.includes('native degree1..3 Curve')) return 'This object cannot be displayed. Choose another object.';
  if (error.context.field === 'display-body-set') return 'Display one to four objects. Hide an object before showing another.';
  if (error.context.field === 'edit-capability') return 'This Surface is read-only. Select an editable Surface.';
  if (error.context.field === 'history') return 'Apply or discard the pending values before using history.';
  if (error.context.field === 'selection-transition') return 'Apply or discard the pending values before this action.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current document is retained.';
  if (error.code === 'BUDGET') return 'This input exceeds the supported size. Open a smaller document.';
  if (error.code === 'REVISION') return 'This document reached its edit limit. Open a new document.';
  if (error.code === 'STALE') return 'The document changed. Select the control point and try again.';
  if (error.code === 'NATIVE') return 'Cannot apply these values. Check the coordinates and weight.';
  return error.message;
}

const defaultDisplay: CadEditorDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: { basis: 'authored-xyz-matches-rhyup', native: { sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1, curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 }, nativeCapacity: { version: 1, maximumObjects: 16 } } },
};

function DirectApp() {
  const [session] = useState(() => createCadEditorSession(parseCadDocument(fixtureText).document));
  const snapshot = useCadEditorSnapshot(session);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [filename, setFilename] = useState('Weighted surface');
  const [receipt, setReceipt] = useState<CadEditorDisplayReceipt | null>(null);
  const [displayOptions, setDisplayOptions] = useState(defaultDisplay);
  const [fitSelectedRequest, setFitSelectedRequest] = useState(0);
  const [openChoice, setOpenChoice] = useState<{text:string;filename:string;bodies:{id:string;name:string}[];selected:string[]} | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [mount, setMount] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const [readRequest, setReadRequest] = useState(0);
  const [route, setRoute] = useState(location.hash);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingFilename = useRef<string | null>(null);
  const flowMode = new URLSearchParams(location.search).has('flow');
  const run = (action: () => unknown) => { try { setError(null); action(); } catch (cause) { setReadRequest(value => value + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', String(cause), {}, cause)); } };
  useEffect(() => {
    const updateRoute = () => setRoute(location.hash);
    window.addEventListener('hashchange', updateRoute);
    if (!location.hash) location.hash = '/documents/' + snapshot.accepted.document.documentId;
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  useEffect(() => { setError(null); }, [snapshot.selectedBodyId]);
  useEffect(() => () => session.dispose(), [session]);
  useEffect(() => {
    if (!flowMode) return;
    // This focused flow seam exposes copied data and declared host actions only.
    const api = {
      snapshot: () => session.getSnapshot(), display: () => structuredClone(receipt), error: () => error ? {code:error.code,message:error.message,context:{...error.context},cause:error.cause instanceof Error ? error.cause.message : null} : null,
      setDisplayRefusal: (refuse: boolean) => setDisplayOptions(refuse ? { ...defaultDisplay, document: { ...defaultDisplay.document, native: { ...defaultDisplay.document.native, countU: 1 } } } : defaultDisplay),
      setMounted: (mounted: boolean) => { setMount(mounted); if (mounted) setMountKey(key => key + 1); },
      session,
    };
    Object.assign(window, { __cadEditorFlow: api });
    return () => { delete (window as Window & { __cadEditorFlow?: unknown }).__cadEditorFlow; };
  }, [flowMode, session, receipt, error]);
  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError(null);
      const text = await readCadEditorFile(file);
      let document;
      try { document = parseCadDocument(text).document; } catch (cause) { throw new CadEditorError('NATIVE','Native document Open failed.',{},cause); }
      if (document.bodies.length > 4) { setOpenChoice({text,filename:file.name,bodies:document.bodies,selected:[]}); return; }
      pendingFilename.current = file.name;
      session.prepareOpen(text);
    } catch (cause) { pendingFilename.current = null; setReadRequest(value => value + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', 'Cannot open this file.', {}, cause)); }
  };
  const newSample = () => run(() => { pendingFilename.current = 'Weighted surface'; session.prepareOpen(fixtureText); });
  const busy = snapshot.candidate !== null;
  const hasDraft = Object.keys(snapshot.pending).length > 0 || snapshot.selectionTransition !== null;
  const projectView = route === '#/projects';

  return <div className="cad-app">
    <header className="app-header">
      <a className="app-brand" href="#/projects"><Box size={20} strokeWidth={1.6} /><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar">
        <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
          <MenubarItem onSelect={newSample} disabled={busy}>New sample<MenubarShortcut>01</MenubarShortcut></MenubarItem>
          <MenubarItem onSelect={() => fileInput.current?.click()} disabled={busy}>Open native document…</MenubarItem>
          <MenubarItem disabled={busy} onSelect={() => { location.hash = "/features/cad_boolean_extrusion"; }}>New Boolean extrusion</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => run(() => downloadAccepted(session))}>Download accepted document</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => { location.hash = '/projects'; }}>Projects</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
          <MenubarItem disabled={!snapshot.history.canUndo || busy || hasDraft} onSelect={() => run(() => session.prepareUndo())}>Undo</MenubarItem>
          <MenubarItem disabled={!snapshot.history.canRedo || busy || hasDraft} onSelect={() => run(() => session.prepareRedo())}>Redo</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => run(() => session.discardPending())}>Discard pending fields</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => setFitRequest(value => value + 1)}>Fit document</MenubarItem></MenubarContent></MenubarMenu>
      </Menubar>
      <span className="document-title">{filename}<span className="dirty-dot" aria-label={snapshot.dirty ? 'Changed since open or download' : 'Accepted content unchanged'}>{snapshot.dirty ? ' •' : ''}</span></span>

      <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}><FolderOpen/>Open</Button>
      <Button size="sm" onClick={() => run(() => downloadAccepted(session))}><Download/>Download</Button>
      <input ref={fileInput} type="file" accept=".json,.cad-document.json" aria-label="Open native document file" className="file-input" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }}/>
    </header>
    <div className="app-toolbar"><span className="breadcrumb"><a href="#/projects">Projects</a><ChevronRight size={12}/><span>{filename}</span></span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.history.canUndo || busy || hasDraft} onClick={() => run(() => session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.history.canRedo || busy || hasDraft} onClick={() => run(() => session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" onClick={() => setFitRequest(value => value + 1)}><Maximize/>Fit</Button><Button variant="ghost" size="sm" data-testid="fit-selected-body" disabled={!snapshot.selectedBodyId} onClick={() => setFitSelectedRequest(value => value + 1)}>Fit selected</Button>
    </div></div>
    {error && <div className="app-error" role="alert">{actionError(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace">
      <aside className="document-tree"><h2><Layers3 size={15}/>Document</h2><div className="tree-document"><Box size={16}/><span>{filename}</span></div>
        <div className="tree-section">BODIES <span>{snapshot.accepted.document.bodies.length}</span></div>
        {snapshot.accepted.document.bodies.map(body => {
          const binding = snapshot.accepted.bodyBindings.find(item => item.bodyId === body.id)!;
          const selected = snapshot.selectedBodyId === body.id;
          const shown = snapshot.displayBodyIds.includes(body.id);
          const editable = snapshot.bodyCapabilities.find(item => item.bodyId === body.id)?.canEditSurfacePole;
          return <div key={body.id} className="tree-body-row">
            <button className={'tree-body' + (selected ? ' selected' : '')} data-testid={'body-select-' + body.id}
              onClick={() => run(() => session.requestSelection(binding.geometryKind === 'surface' ? { bodyId: body.id, uIndex: 1, vIndex: 1 } : { bodyId: body.id }))} aria-pressed={selected}>
              <span className={'body-symbol ' + binding.geometryKind}>{binding.geometryKind === 'surface' ? '▱' : '╱'}</span><span>{body.name}<small>{editable ? 'Editable surface' : binding.geometryKind === 'surface' ? 'Read-only surface' : 'Read-only curve'}</small></span>
            </button>
            <input type="checkbox" data-testid={'body-visible-' + body.id} aria-label={(shown ? 'Hide ' : 'Show ') + body.name}
              checked={shown} disabled={busy} onChange={() => run(() => session.prepareDisplayBodies(shown ? snapshot.displayBodyIds.filter(id => id !== body.id) : [...snapshot.displayBodyIds, body.id]))} />
          </div>;
        })}
        <div className="tree-details"><span>Units</span><strong>mm</strong><span>Axes</span><strong>XYZ</strong>{snapshot.selection && <><span>Control grid</span><strong>{snapshot.selection.countU} × {snapshot.selection.countV}</strong></>}</div>
        <div className="tree-foot"><CircleHelp size={14}/><p>Select a surface to edit its control points. Use the checkboxes to show or hide objects.</p></div>
      </aside>
      <main className="main-workspace">
        {projectView ? <section className="projects-view"><span className="eyebrow">LOCAL DOCUMENTS</span><h1>Projects</h1><p>Start with the weighted surface, or open a native document.</p><button className="sample-project" onClick={() => { newSample(); location.hash = '/documents/cad_editor_fixture'; }}><span className="sample-symbol">▱</span><span><strong>Weighted surface</strong><small>Quadratic 3 × 3 surface · Reference line</small></span><ChevronRight size={20}/></button><Button variant="outline" onClick={() => fileInput.current?.click()}><FolderOpen/>Open document</Button></section> : mount && <CadEditor key={mountKey} session={session} displayOptions={displayOptions} fitRequest={fitRequest} fitSelectedRequest={fitSelectedRequest || undefined} readRequest={readRequest} onError={failure => { pendingFilename.current = null; setError(failure); }} onAccepted={accepted => { setError(null); if (pendingFilename.current) { setFilename(pendingFilename.current); pendingFilename.current = null; } location.hash = '/documents/' + accepted.accepted.document.documentId; }} onDisplay={setReceipt}/>}
      </main>
    </div>
    <Dialog open={openChoice !== null} onOpenChange={open => { if (!open) setOpenChoice(null); }}>
      <DialogContent className="cad-editor-help-dialog" data-testid="open-display-choice">
        <DialogHeader><DialogTitle>Choose visible objects</DialogTitle><DialogDescription>Select one to four objects to display. The complete document will be opened.</DialogDescription></DialogHeader>
        <div className="open-body-list">{openChoice?.bodies.map(body => <label key={body.id}>
          <input type="checkbox" data-testid={'open-body-' + body.id} checked={openChoice.selected.includes(body.id)}
            onChange={event => setOpenChoice(current => current && {...current,selected:event.target.checked ? [...current.selected,body.id] : current.selected.filter(id => id !== body.id)})} />{body.name}
        </label>)}</div>
        <p>{openChoice?.selected.length ?? 0} selected</p>
        <div className="cad-editor-transition-actions"><Button variant="outline" onClick={() => setOpenChoice(null)}>Cancel</Button>
          <Button data-testid="open-display-confirm" disabled={!openChoice || openChoice.selected.length < 1 || openChoice.selected.length > 4} onClick={() => run(() => {
            if (!openChoice) return;
            pendingFilename.current = openChoice.filename;
            session.prepareOpen(openChoice.text,{displayBodyIds:openChoice.selected});
            setOpenChoice(null);
          })}>Open</Button></div>
      </DialogContent>
    </Dialog>
    <footer className="app-status"><span className="status-led"/><span>{busy ? 'Preparing display' : Object.keys(snapshot.pending).length ? 'Pending fields' : 'Accepted document'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-spacer"/><span>History {snapshot.history.index + 1} / {snapshot.history.count}</span><span className="status-divider"/><span>XYZ · mm</span></footer>
  </div>;
}

export function App() {
  const [featureMode, setFeatureMode] = useState(() => location.hash.startsWith('#/features/'));
  const [visited, setVisited] = useState(() => ({direct:!location.hash.startsWith('#/features/'),feature:location.hash.startsWith('#/features/')}));
  useEffect(() => {
    const update = () => {
      const feature = location.hash.startsWith('#/features/');
      setFeatureMode(feature);
      setVisited(prior => ({direct:prior.direct || !feature,feature:prior.feature || feature}));
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  // Mode navigation keeps each host-owned native session and its pending fields.
  return <>{visited.direct && <div className="cad-mode" hidden={featureMode}><DirectApp /></div>}
    {visited.feature && <div className="cad-mode" hidden={!featureMode}><FeatureApp /></div>}</>;
}
