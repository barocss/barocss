import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Box, FolderOpen, Save, FilePlus2, Undo2, Redo2} from 'lucide-react';
import {createRenderMaterialSession, createRenderMaterialController, parseRenderMaterialDocument, serializeRenderMaterialDocument, normalizeRenderEditorError, RENDER_MATERIAL_LIMITS} from '@barocss/render-editor';
import type {RenderEditorError, RenderMaterialDocument} from '@barocss/render-editor';
import {MaterialEditor} from '@barocss/render-editor/react';
import {MaterialPreview} from './material-preview';
import {Button} from './components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';
import {Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger} from './components/ui/menubar';

export const initialMaterialDocument: RenderMaterialDocument = {
  format: 'barocss-render-editor-material', version: 0, profile: 'mesh-opaque-fragment-v0', documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25},
};
type FileAction = {label: string; execute: () => void};

/** Material-only documents rendered on the fixed native reference Surface. */
export function MaterialApp() {
  const [{cpu, controller}, setHost] = useState(() => {const cpu = createRenderMaterialSession(initialMaterialDocument); return {cpu, controller: createRenderMaterialController(cpu)};});
  const session = controller.editorSession;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [notice, setNotice] = useState('Material document · native Surface preview'), [error, setError] = useState<RenderEditorError | null>(null);
  const [pending, setPending] = useState<FileAction | null>(null), [busy, setBusy] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null), helpButton = useRef<HTMLButtonElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false), epoch = useRef(0), pendingRef = useRef(pending), helpRef = useRef(helpOpen), mounted = useRef(true);
  pendingRef.current = pending; helpRef.current = helpOpen;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; epoch.current++; controller.dispose(); cpu.dispose();};}, [session]);
  // A commit or Discard resolves an earlier authoring refusal, without hiding a current invalid draft.
  useEffect(() => {
    if (!snapshot.dirty && (error?.code === 'SOURCE_REFUSED' || error?.code === 'PRESENTATION_REFUSED' && controller.getSnapshot().displayed === snapshot.accepted)) {setError(null); setNotice('Material ready.');}
  }, [snapshot.accepted, snapshot.dirty]);
  const report = (cause: unknown) => {setError(normalizeRenderEditorError(cause)); setNotice('Correct the material draft, then try again.');};
  const guard = (action: FileAction) => {
    if (busyRef.current || pendingRef.current || helpRef.current) return;
    if (session.getSnapshot().dirty) {setPending(action); return;}
    action.execute();
  };
  const saveAccepted = () => {
    try {
      const document = session.getSnapshot().accepted, text = serializeRenderMaterialDocument(document);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json;charset=utf-8'}));
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.documentId + '.material.json'; anchor.hidden = true;
      window.document.body.append(anchor);
      try {anchor.click();} finally {anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);}
      session.markSaved(document.revision); setError(null); setNotice('Download started. Check the material file.');
    } catch (cause) {report(cause);}
  };
  const openChooser = () => fileInput.current?.click();
  const newAccepted = () => {
    try {
      const document = {...initialMaterialDocument, documentId: 'material-' + crypto.randomUUID(), title: 'Untitled material'};
      const nextCpu = createRenderMaterialSession(document);
      setHost({cpu: nextCpu, controller: createRenderMaterialController(nextCpu)});
      setError(null); setNotice('New material document.');
    } catch (cause) {report(cause);}
  };
  const save = () => guard({label: 'save material', execute: saveAccepted});
  const open = () => guard({label: 'open material', execute: openChooser});
  const createNew = () => guard({label: 'create a new material', execute: newAccepted});
  const finishPending = (apply: boolean) => {
    const action = pendingRef.current; if (!action || busyRef.current) return;
    try {
      if (apply) session.commitPrepared(session.prepareDraft()); else session.discardDraft();
      pendingRef.current = null; setPending(null); setError(null); action.execute();
    } catch (cause) {report(cause);}
  };
  const readFile = async (file: File | undefined) => {
    if (!file || busyRef.current) return;
    const generation = ++epoch.current, before = session.getSnapshot();
    busyRef.current = true; setBusy(true);
    try {
      if (file.size > RENDER_MATERIAL_LIMITS.fileBytes) throw new Error('Material file exceeds 262144 UTF-8 bytes.');
      const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
      if (!mounted.current || generation !== epoch.current || session.getSnapshot() !== before) throw new Error('The material changed while the file was opening.');
      const document = parseRenderMaterialDocument(text);
      session.commitPrepared(session.prepareOpen(serializeRenderMaterialDocument(document)));
      session.markSaved(document.revision); setError(null); setNotice('Opened ' + document.title + '.');
    } catch (cause) {if (mounted.current && generation === epoch.current) report(cause);}
    finally {if (mounted.current && generation === epoch.current) {busyRef.current = false; setBusy(false);}}
  };
  const history = (direction: 'undo' | 'redo') => {
    if (busyRef.current || pendingRef.current || helpRef.current) return;
    if (session.getSnapshot().dirty) {setNotice('Apply or Discard the material draft before history.'); return;}
    try {
      const candidate = direction === 'undo' ? session.prepareUndo() : session.prepareRedo();
      if (candidate) {session.commitPrepared(candidate); setError(null); setNotice(direction === 'undo' ? 'Material change undone.' : 'Material change restored.');}
    } catch (cause) {report(cause);}
  };
  const showHelp = () => {returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : helpButton.current; setHelpOpen(true);};
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey) || busyRef.current || pendingRef.current || helpRef.current) return;
      const name = event.key.toLowerCase();
      if (name === 's') {event.preventDefault(); save();}
      else if (name === 'o') {event.preventDefault(); open();}
      else if (name === 'z' && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]'))) {event.preventDefault(); history(event.shiftKey ? 'redo' : 'undo');}
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [session]);
  const disabled = busy || pending !== null || helpOpen;
  return <main className="app-shell app-shell--scene re-material-host" data-testid="material-editor-app">
    <header className="app-topbar"><div className="app-brand"><Box size={18}/><strong>BaroCSS</strong><small>Material Editor</small></div>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
        <MenubarItem disabled={disabled} onSelect={createNew}><FilePlus2/>New material</MenubarItem><MenubarSeparator/>
        <MenubarItem disabled={disabled} onSelect={open}><FolderOpen/>Open material<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
        <MenubarItem disabled={disabled} onSelect={save}><Save/>Save material<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
      </MenubarContent></MenubarMenu><MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
        <MenubarItem disabled={disabled || snapshot.dirty || !snapshot.canUndo} onSelect={() => history('undo')}><Undo2/>Undo<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
        <MenubarItem disabled={disabled || snapshot.dirty || !snapshot.canRedo} onSelect={() => history('redo')}><Redo2/>Redo<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
        <MenubarSeparator/><MenubarItem disabled={disabled || !snapshot.dirty} onSelect={() => session.discardDraft()}>Discard draft</MenubarItem>
      </MenubarContent></MenubarMenu></Menubar>
      <div className="app-topbar-spacer"/><Button variant="ghost" size="sm" onClick={showHelp} ref={helpButton} data-testid="material-help">Help</Button>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={open} data-testid="material-open"><FolderOpen/>Open</Button>
      <Button size="sm" disabled={disabled} onClick={save} data-testid="material-save"><Save/>Save</Button>
    </header>
    <div className="app-document-bar"><strong data-testid="material-title">{snapshot.accepted.title}</strong><span className="app-status-spacer"/><span>{snapshot.dirty ? 'Draft changes' : snapshot.savedRevision === snapshot.accepted.revision ? 'File loaded / download requested' : 'Unsaved material'}</span>
      <Button variant="ghost" size="icon-xs" aria-label="Undo material change" data-testid="material-undo" disabled={disabled || snapshot.dirty || !snapshot.canUndo} onClick={() => history('undo')}><Undo2/></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Redo material change" data-testid="material-redo" disabled={disabled || snapshot.dirty || !snapshot.canRedo} onClick={() => history('redo')}><Redo2/></Button>
    </div>
    <MaterialEditor session={session} disabled={disabled} onError={report} preview={<MaterialPreview controller={controller} disabled={disabled} onError={report}/>}/>
    <footer className="app-status"><span role="status" data-testid="material-app-status">{error ? error.code + ': ' + error.message : notice}</span><span className="app-status-spacer"/><span data-testid="material-accepted-revision" data-revision={snapshot.accepted.revision}>Applied {snapshot.accepted.revision}</span><span>CPU · linear RGB</span></footer>
    <input ref={fileInput} type="file" accept=".material.json,application/json" hidden data-testid="material-file-input" onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readFile(file);}}/>
    <Dialog open={pending !== null} onOpenChange={value => {if (!value) {pendingRef.current = null; setPending(null);}}}><DialogContent><DialogHeader><DialogTitle>Keep material changes?</DialogTitle><DialogDescription>Apply or Discard the draft before you {pending?.label}. Cancel keeps the current text.</DialogDescription></DialogHeader>
      {error && <p role="alert">{error.message}</p>}<DialogFooter><Button variant="ghost" onClick={() => {pendingRef.current = null; setPending(null);}}>Cancel</Button><Button variant="secondary" onClick={() => finishPending(false)}>Discard</Button><Button onClick={() => finishPending(true)}>Apply</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent onCloseAutoFocus={event => {event.preventDefault(); returnFocus.current?.focus();}}><DialogHeader><DialogTitle>Material editing</DialogTitle><DialogDescription>Shader source and supplied uniform values form one material document.</DialogDescription></DialogHeader>
      <div className="app-help-copy"><p>Edit the original shader and declared uniforms, then Apply. The last applied CPU sample stays visible if a draft is invalid. Uniform ranges and defaults come from the shader. Use defaults removes supplied overrides.</p><p>The center Canvas renders the authored material on a fixed native reference Surface with fixed lighting. Drag to orbit, Shift + drag to pan, or use the wheel to zoom. The CPU swatch shows linear RGB separately; rendered pixels include lighting and gamma. Show the Surface before Apply. Graphics failure may make the preview unavailable.</p><p>Incomplete values and shader text stay drafts. Discard restores the applied material. Apply or Discard before Undo/Redo or a file transition; Cancel retains text. Source editing preserves supplied uniform drafts. Removed uniforms need Use defaults or Remove override.</p><p>Save stores the exact shader source and supplied numbers. Open accepts material version 0 files up to 256 KiB, recompiles the shader and calculates a fresh sample. Generated IR, sample and local field text are not stored. Geometry, camera and lighting are supplied by this preview host and are not saved in a material file. Fresh Open uses the same reference asset. Source1 scene and CAD files use their own editors.</p></div>
    </DialogContent></Dialog>
  </main>;
}
