import { useEffect, useRef, useState } from 'react';
import { Box, ChevronRight, CircleHelp, Download, FolderOpen, Layers3, Maximize, Redo2, Undo2 } from 'lucide-react';
import { parseCadDocument } from '@barocss/cad';
import { CadEditorError, createCadEditorSession } from '@barocss/cad-editor';
import { CadEditor, useCadEditorSnapshot, type CadEditorDisplayOptions, type CadEditorDisplayReceipt } from '@barocss/cad-editor/react';
import fixtureText from '../fixtures/canonical-surface-and-curve.cad-document.json?raw';
import { Button } from './components/ui/button';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted, readCadEditorFile } from './file-actions';

function actionError(error: CadEditorError): string {
  const cause = error.cause instanceof Error ? error.cause.message : '';
  if (cause.includes('Weights must')) return 'Enter a weight from 0.000001 to 1000000.';
  if (error.message.includes('two assets and two bodies')) return 'Open a document with one Surface and one Curve.';
  if (error.message.includes('Native document Open')) return 'Cannot open this file. Select a valid CAD document.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current document is retained.';
  if (error.code === 'BUDGET') return 'This input exceeds the supported size. Open a smaller document.';
  if (error.code === 'REVISION') return 'This document reached its edit limit. Open a new document.';
  if (error.code === 'STALE') return 'The document changed. Select the control point and try again.';
  if (error.code === 'NATIVE') return 'Cannot apply these values. Check the coordinates and weight.';
  return error.message;
}

const defaultDisplay: CadEditorDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: { basis: 'authored-xyz-matches-rhyup', native: { sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 } }, bodyIds: ['surface_body', 'curve_body'] },
};

export function App() {
  const [session] = useState(() => createCadEditorSession(parseCadDocument(fixtureText).document));
  const snapshot = useCadEditorSnapshot(session);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [filename, setFilename] = useState('Weighted surface');
  const [receipt, setReceipt] = useState<CadEditorDisplayReceipt | null>(null);
  const [displayOptions, setDisplayOptions] = useState(defaultDisplay);
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
      session.prepareOpen(text);
      pendingFilename.current = file.name;
    } catch (cause) { pendingFilename.current = null; setReadRequest(value => value + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', 'Cannot open this file.', {}, cause)); }
  };
  const newSample = () => run(() => { pendingFilename.current = 'Weighted surface'; session.prepareOpen(fixtureText); });
  const busy = snapshot.candidate !== null;
  const projectView = route === '#/projects';

  return <div className="cad-app">
    <header className="app-header">
      <a className="app-brand" href="#/projects"><Box size={20} strokeWidth={1.6} /><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar">
        <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
          <MenubarItem onSelect={newSample} disabled={busy}>New sample<MenubarShortcut>01</MenubarShortcut></MenubarItem>
          <MenubarItem onSelect={() => fileInput.current?.click()} disabled={busy}>Open native document…</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => run(() => downloadAccepted(session))}>Download accepted document</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => { location.hash = '/projects'; }}>Projects</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
          <MenubarItem disabled={!snapshot.history.canUndo || busy} onSelect={() => run(() => session.prepareUndo())}>Undo</MenubarItem>
          <MenubarItem disabled={!snapshot.history.canRedo || busy} onSelect={() => run(() => session.prepareRedo())}>Redo</MenubarItem>
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
      <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.history.canUndo || busy} onClick={() => run(() => session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.history.canRedo || busy} onClick={() => run(() => session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" onClick={() => setFitRequest(value => value + 1)}><Maximize/>Fit</Button>
    </div></div>
    {error && <div className="app-error" role="alert">{actionError(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace">
      <aside className="document-tree"><h2><Layers3 size={15}/>Document</h2><div className="tree-document"><Box size={16}/><span>{filename}</span></div>
        <div className="tree-section">BODIES <span>{snapshot.accepted.document.bodies.length}</span></div>
        {snapshot.accepted.document.bodies.map(body => {
          const binding = snapshot.accepted.bodyBindings.find(item => item.bodyId === body.id)!;
          const selected = snapshot.selection?.bodyId === body.id;
          return <button key={body.id} className={'tree-body' + (selected ? ' selected' : '')} onClick={() => binding.geometryKind === 'surface' && run(() => session.selectSurfacePole({ bodyId: body.id, uIndex: 1, vIndex: 1 }))} aria-pressed={selected}>
            <span className={'body-symbol ' + binding.geometryKind}>{binding.geometryKind === 'surface' ? '▱' : '╱'}</span><span>{body.name}<small>{binding.geometryKind === 'surface' ? 'Editable surface' : 'Read-only curve'}</small></span><span className="visible-mark" aria-label="Visible">●</span>
          </button>;
        })}
        <div className="tree-details"><span>Units</span><strong>mm</strong><span>Axes</span><strong>XYZ</strong>{snapshot.selection && <><span>Control grid</span><strong>{snapshot.selection.countU} × {snapshot.selection.countV}</strong></>}</div>
        <div className="tree-foot"><CircleHelp size={14}/><p>Select a surface to edit its control points. Reference curves are read-only.</p></div>
      </aside>
      <main className="main-workspace">
        {projectView ? <section className="projects-view"><span className="eyebrow">LOCAL DOCUMENTS</span><h1>Projects</h1><p>Start with the weighted surface, or open a native document.</p><button className="sample-project" onClick={() => { newSample(); location.hash = '/documents/cad_editor_fixture'; }}><span className="sample-symbol">▱</span><span><strong>Weighted surface</strong><small>Quadratic 3 × 3 surface · Reference line</small></span><ChevronRight size={20}/></button><Button variant="outline" onClick={() => fileInput.current?.click()}><FolderOpen/>Open document</Button></section> : mount && <CadEditor key={mountKey} session={session} displayOptions={displayOptions} fitRequest={fitRequest} readRequest={readRequest} onError={failure => { pendingFilename.current = null; setError(failure); }} onAccepted={accepted => { setError(null); if (pendingFilename.current) { setFilename(pendingFilename.current); pendingFilename.current = null; } location.hash = '/documents/' + accepted.accepted.document.documentId; }} onDisplay={setReceipt}/>}
      </main>
    </div>
    <footer className="app-status"><span className="status-led"/><span>{busy ? 'Preparing display' : Object.keys(snapshot.pending).length ? 'Pending fields' : 'Accepted document'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-spacer"/><span>History {snapshot.history.index + 1} / {snapshot.history.count}</span><span className="status-divider"/><span>XYZ · mm</span></footer>
  </div>;
}
