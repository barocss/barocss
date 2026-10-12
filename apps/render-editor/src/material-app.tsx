import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Plus, Trash2, Copy, Box, FolderOpen, Save, FilePlus2, Undo2, Redo2} from 'lucide-react';
import {createRenderMaterialSession, createRenderMaterialController, parseRenderMaterialDocument, serializeRenderMaterialDocument, parseRenderNativeSceneDocument, serializeRenderNativeSceneDocument, normalizeRenderEditorError, RenderEditorError, RENDER_MATERIAL_LIMITS, RENDER_NATIVE_SCENE_LIMITS} from '@barocss/render-editor';
import type {RenderMaterialDocument, RenderNativeSceneDocument} from '@barocss/render-editor';
import {MaterialEditor} from '@barocss/render-editor/react';
import {MaterialPreview, type MaterialPreviewBridge} from './material-preview';
import {createNativeSceneHost, type NativeSceneHost} from './native-scene-host';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {NativeSceneControls} from './native-scene-controls';
import {NativeMaterialPreviewControls} from './native-material-preview-controls';
import {NativeSceneOutliner} from './native-scene-outliner';
import {NativeSurfaceAddDialog} from './native-surface-add-dialog';
import {Button} from './components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';
import {Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger} from './components/ui/menubar';

export const initialMaterialDocument: RenderMaterialDocument = {
  format: 'barocss-render-editor-material', version: 0, profile: 'mesh-opaque-fragment-v0', documentId: 'blend-study', title: 'Blend study', revision: 0,
  shaderSource: '// Original blend study. Red and blue are authored colors.\r\n@shader #blend_study {\r\n  @uniform amount: float(0, 1, .25);\r\n  @fragment { color: mix(#ff0000, #0000ff, amount); }\r\n}\r\n', uniforms: {amount: .25},
};
type FileAction = {label: string; execute: () => void};
const subscribeEmpty = () => () => {}, emptySnapshot = () => null;
function requireEditableScene(document: RenderNativeSceneDocument) {
  const visible = new Set(document.display.visibleBodyIds);
  if (!document.surfaceMaterials.some(binding => visible.has(binding.target.bodyId))) throw new RenderEditorError('DOCUMENT_INPUT', 'This editor requires a visible Surface material.');
}

/** Material and native scene authoring use one persistent preview Canvas. */
export function MaterialApp() {
  const [{cpu, controller}] = useState(() => {const cpu = createRenderMaterialSession(initialMaterialDocument); return {cpu, controller: createRenderMaterialController(cpu)};});
  const [native, setNative] = useState<NativeSceneHost | null>(null);
  const session = native?.materialSession ?? controller.editorSession;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const nativeSnapshot = useSyncExternalStore(native?.subscribe ?? subscribeEmpty, native?.getSnapshot ?? emptySnapshot, native?.getSnapshot ?? emptySnapshot);
  const [notice, setNotice] = useState('Material document · native Surface preview'), [error, setError] = useState<RenderEditorError | null>(null);
  const [pending, setPending] = useState<FileAction | null>(null), [busy, setBusy] = useState(false), [helpOpen, setHelpOpen] = useState(false), [bridgeReady, setBridgeReady] = useState(false), [filename, setFilename] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceButton = useRef<HTMLButtonElement>(null);
  const [surfaceAddOpen, setSurfaceAddOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null), objectButton = useRef<HTMLButtonElement>(null), surfaceAddRef = useRef(false);
  const addContext = useRef<{host: NativeSceneHost; snapshot: ReturnType<NativeSceneHost['getSnapshot']>; fileEpoch: number; bridge: MaterialPreviewBridge; previewEpoch: number} | null>(null);
  surfaceAddRef.current = surfaceAddOpen;
  const materialFileInput = useRef<HTMLInputElement>(null), fileButton = useRef<HTMLButtonElement>(null);
  const materialImport = useRef<{host: NativeSceneHost; snapshot: ReturnType<NativeSceneHost['getSnapshot']>; fileEpoch: number; bridge: MaterialPreviewBridge; previewEpoch: number} | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), helpButton = useRef<HTMLButtonElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const bridge = useRef<MaterialPreviewBridge | null>(null), busyRef = useRef(false), epoch = useRef(0), pendingRef = useRef(pending), helpRef = useRef(helpOpen), mounted = useRef(true);
  const current = useRef({native, session}); current.current = {native, session}; pendingRef.current = pending; helpRef.current = helpOpen;
  const onBridgeChange = useCallback((value: MaterialPreviewBridge | null) => {bridge.current = value; setBridgeReady(value !== null);}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; epoch.current++;};}, []);
  useEffect(() => () => {controller.dispose(); cpu.dispose();}, [controller, cpu]);
  useEffect(() => () => {native?.dispose();}, [native]);
  const report = (cause: unknown) => {setError(normalizeRenderEditorError(cause)); setNotice('Correct the draft, then try again.');};
  const dirty = nativeSnapshot?.dirty ?? snapshot.dirty;
  const poseBusy = !!nativeSnapshot && (nativeSnapshot.poseGestureActive || nativeSnapshot.surfacePoleGestureActive || !!nativeSnapshot.surfacePolePreview || !!nativeSnapshot.posePreview);
  const materialPreviewBusy = !!nativeSnapshot?.materialPreview;
  const accepted = nativeSnapshot?.accepted ?? snapshot.accepted, canUndo = nativeSnapshot?.canUndo ?? snapshot.canUndo, canRedo = nativeSnapshot?.canRedo ?? snapshot.canRedo;
  const savedRevision = nativeSnapshot?.savedRevision ?? (native ? null : snapshot.savedRevision);
  useEffect(() => {if (!dirty && error) {setError(null); setNotice(native ? 'Scene ready.' : 'Material ready.');}}, [accepted, dirty]);
  const stopHeld = () => {const live = bridge.current; if (live) {live.beginTransition(); live.endTransition();}};
  const blocked = () => {const host = current.current.native?.getSnapshot(); return busyRef.current || pendingRef.current !== null || helpRef.current || surfaceAddRef.current || !!host && (host.poseGestureActive || host.surfacePoleGestureActive || !!host.surfacePolePreview || !!host.posePreview || !!host.materialPreview);};
  const guard = (action: FileAction) => {
    if (blocked()) return;
    const host = current.current.native;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stopHeld();
    if (host ? host.getSnapshot().dirty : current.current.session.getSnapshot().dirty) {pendingRef.current = action; setPending(action); return;}
    action.execute();
  };
  const saveAccepted = () => {
    epoch.current++;
    try {
      const host = current.current.native, document = host?.getSnapshot().accepted ?? current.current.session.getSnapshot().accepted;
      const text = host ? serializeRenderNativeSceneDocument(document as RenderNativeSceneDocument) : serializeRenderMaterialDocument(document as RenderMaterialDocument);
      const name = filename ?? document.documentId + (host ? '.native-scene.json' : '.material.json');
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json;charset=utf-8'}));
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = name; anchor.hidden = true; window.document.body.append(anchor);
      try {anchor.click();} finally {anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);}
      if (host) host.markSaved(document.revision); else current.current.session.markSaved(document.revision);
      setFilename(name); setError(null); setNotice('Download requested. Check the saved file.');
    } catch (cause) {report(cause);}
  };
  const openChooser = () => {epoch.current++; stopHeld(); fileInput.current?.click();};
  const transferEligible = (host: NativeSceneHost) => {
    const state = host.getSnapshot();
    if (state.dirty) throw new RenderEditorError('DOCUMENT_INPUT', 'Apply or Discard drafts before importing or exporting a material.');
    if (state.disposed || !state.available || state.poseGestureActive || state.surfacePoleGestureActive
      || state.posePreview || state.surfacePolePreview || state.materialPreview
      || !state.accepted.display.visibleBodyIds.includes(state.selectedBodyId)
      || !state.targets.some(target => target.bodyId === state.selectedBodyId)) {
      throw new RenderEditorError('PRESENTATION_REFUSED', 'Select an available visible Surface before transferring a material.');
    }
    return state;
  };
  const transferFocus = () => {
    if (!mounted.current) return;
    const active = document.activeElement;
    if (!active || active === document.body || active === materialFileInput.current || active === fileButton.current
      || active instanceof HTMLElement && !active.isConnected) fileButton.current?.focus();
  };
  const assertMaterialImport = (value: NonNullable<typeof materialImport.current>) => {
    if (!mounted.current || materialImport.current !== value || current.current.native !== value.host
      || value.host.getSnapshot() !== value.snapshot || epoch.current !== value.fileEpoch
      || bridge.current !== value.bridge || value.bridge.getEpoch() !== value.previewEpoch
      || pendingRef.current !== null || helpRef.current || surfaceAddRef.current) {
      throw new RenderEditorError('STALE_CANDIDATE', 'The selected Surface, scene or preview changed. Choose the material again.');
    }
    transferEligible(value.host);
  };
  const importMaterial = () => {
    if (blocked()) return;
    try {
      const host = current.current.native, live = bridge.current;
      if (!host || !live) throw new RenderEditorError('PRESENTATION_REFUSED', 'The Surface preview is unavailable.');
      transferEligible(host); stopHeld();
      const value = {host, snapshot: transferEligible(host), fileEpoch: ++epoch.current, bridge: live, previewEpoch: live.getEpoch()};
      materialImport.current = value; assertMaterialImport(value);
      if (materialFileInput.current) {materialFileInput.current.value = ''; materialFileInput.current.click();}
    } catch (cause) {materialImport.current = null; report(cause); transferFocus();}
  };
  const cancelMaterialImport = () => {
    if (busyRef.current) return;
    materialImport.current = null;
    if (materialFileInput.current) materialFileInput.current.value = '';
    transferFocus();
  };
  useEffect(() => {
    const input = materialFileInput.current;
    input?.addEventListener('cancel', cancelMaterialImport);
    return () => input?.removeEventListener('cancel', cancelMaterialImport);
  });
  const readMaterialFile = async (file: File | undefined) => {
    const value = materialImport.current;
    if (!file) {cancelMaterialImport(); return;}
    if (!value || busyRef.current) return;
    let transition = false, ownsBusy = false;
    try {
      assertMaterialImport(value);
      if (file.size > RENDER_MATERIAL_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Material file exceeds 262144 UTF-8 bytes.');
      value.bridge.beginTransition(); transition = true;
      assertMaterialImport(value);
      busyRef.current = true; ownsBusy = true; setBusy(true);
      const buffer = await file.arrayBuffer();
      assertMaterialImport(value);
      if (buffer.byteLength > RENDER_MATERIAL_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Material file exceeds 262144 UTF-8 bytes.');
      const portable = parseRenderMaterialDocument(new TextDecoder('utf-8', {fatal: true}).decode(buffer));
      assertMaterialImport(value);
      value.host.stageMaterialAssignment(portable, value.snapshot);
      setError(null); setNotice(value.host.getSnapshot().dirty ? 'Material imported as a draft. Preview, Apply or Discard it.' : 'The selected Surface already has this material.');
    } catch (cause) {
      if (mounted.current && materialImport.current === value && epoch.current === value.fileEpoch) report(cause);
    } finally {
      if (transition) {try {value.bridge.endTransition();} catch { /* A retired preview cannot keep an app file operation busy. */ }}
      if (materialImport.current === value) {
        materialImport.current = null;
        if (ownsBusy) {busyRef.current = false; if (mounted.current) setBusy(false);}
        transferFocus();
      }
    }
  };
  const exportMaterial = () => {
    if (blocked()) return;
    try {
      const host = current.current.native, live = bridge.current;
      if (!host || !live) throw new RenderEditorError('PRESENTATION_REFUSED', 'The Surface preview is unavailable.');
      transferEligible(host); stopHeld(); epoch.current++;
      const state = transferEligible(host), binding = state.accepted.surfaceMaterials.find(item => item.target.bodyId === state.selectedBodyId);
      if (!binding) throw new RenderEditorError('DOCUMENT_INPUT', 'Select a visible Surface material.');
      const text = serializeRenderMaterialDocument(binding.material);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json;charset=utf-8'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = binding.material.documentId + '.material.json'; anchor.hidden = true; document.body.append(anchor);
      try {anchor.click();} finally {anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);}
      setError(null); setNotice('Selected material download requested. Check the saved file.');
    } catch (cause) {report(cause);} finally {transferFocus();}
  };
  const newNative = () => {
    const live = bridge.current; if (!live) {report(new Error('The Surface preview is unavailable.')); return;}
    let next: NativeSceneHost | null = null;
    live.beginTransition();
    try {
      const state = live.getState();
      if (!state.camera || !state.lighting) throw new RenderEditorError('PRESENTATION_REFUSED', 'The preview camera or lighting is unavailable.');
      const base = createNativeSceneBase(live.source, current.current.session.getSnapshot().accepted, state.camera, state.lighting, {documentId: 'native-' + crypto.randomUUID(), title: 'Native Surface scene'});
      next = createNativeSceneHost(base); next.setPresenter((prepared, camera) => live.present(prepared, camera), () => live.getAppearanceToken(), () => live.getState().camera); next.setAvailable(true);
      next.stageSceneDocument(createNativeSceneSeed(base)); next.commitPrepared(next.prepareDraft());
      live.retireLegacy(); epoch.current++; setNative(next); setFilename(null); setError(null); setNotice('Native scene created.'); next = null;
    } catch (cause) {next?.dispose(); report(cause);} finally {live.endTransition();}
  };
  const newAccepted = () => {
    if (current.current.native) {newNative(); return;}
    try {
      stopHeld(); const document = {...initialMaterialDocument, documentId: 'material-' + crypto.randomUUID(), title: 'Untitled material'};
      const active = current.current.session; active.commitPrepared(active.prepareOpen(serializeRenderMaterialDocument(document)));
      epoch.current++; setFilename(null); setError(null); setNotice('New material document.');
    } catch (cause) {report(cause);}
  };
  const save = () => guard({label: 'save the file', execute: saveAccepted});
  const open = () => guard({label: 'open a file', execute: openChooser});
  const createNew = () => guard({label: 'create a new document', execute: newAccepted});
  const createScene = () => guard({label: 'create a native scene', execute: newNative});
  const target = (bodyId: string) => {
    if (blocked()) return;
    const host = current.current.native; if (!host) return;
    try {host.selectTarget(bodyId); setError(null); const title = host.getSnapshot().targets.find(target => target.bodyId === bodyId)?.title; setNotice(title ? title + ' selected.' : 'Body selected.');} catch (cause) {report(cause);}
  };
  const toggleSource = () => {
    if (blocked()) return;
    const focusedSource = document.activeElement instanceof Element && !!document.activeElement.closest('.re-material-source');
    if (sourceOpen && focusedSource) sourceButton.current?.focus();
    setSourceOpen(value => !value);
  };
  const openSurfaceAdd = () => {
    if (blocked()) return;
    const host = current.current.native, live = bridge.current;
    if (!host || !live || host.getSnapshot().dirty || !host.getSnapshot().available) return;
    stopHeld();
    epoch.current++; // A separate source-file workflow invalidates an earlier material chooser.
    addContext.current = {host, snapshot: host.getSnapshot(), fileEpoch: epoch.current, bridge: live, previewEpoch: live.getEpoch()};
    surfaceAddRef.current = true; setSurfaceAddOpen(true);
  };
  const closeSurfaceAdd = () => {surfaceAddRef.current = false; setSurfaceAddOpen(false); addContext.current = null;};
  const addSurface = (source: string, surfaceId: string) => {
    const value = addContext.current;
    if (!mounted.current || !surfaceAddRef.current || !value || busyRef.current || pendingRef.current !== null || helpRef.current
      || current.current.native !== value.host || value.host.getSnapshot() !== value.snapshot || epoch.current !== value.fileEpoch
      || bridge.current !== value.bridge || value.bridge.getEpoch() !== value.previewEpoch) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed before Add. Close the dialog and try again.');
    value.host.addSurface(source, surfaceId); setError(null); setNotice('Surface added. Its source and material are independent.');
  };
  const duplicateBody = () => {if (blocked()) return; const host = current.current.native; if (!host) return; stopHeld(); try {host.duplicateSelectedBody(); setError(null); setNotice('Body duplicated. Move the selected copy to separate it.');} catch (cause) {report(cause);}};
  const removeBody = () => {if (blocked()) return; const host = current.current.native; if (!host) return; stopHeld(); try {host.removeSelectedBody(); setError(null); setNotice('Body removed. Undo restores it.');} catch (cause) {report(cause);}};
  const discard = () => {if (blocked()) return; try {if (native) native.discardDraft(); else session.discardDraft(); setError(null);} catch (cause) {report(cause);}};
  const finishPending = (apply: boolean) => {
    const action = pendingRef.current; if (!action || busyRef.current) return;
    try {
      const host = current.current.native, active = current.current.session;
      if (host) {if (apply) host.commitPrepared(host.prepareDraft()); else host.discardDraft();}
      else if (apply) active.commitPrepared(active.prepareDraft()); else active.discardDraft();
      pendingRef.current = null; setPending(null); setError(null); action.execute();
    } catch (cause) {report(cause);}
  };
  const readFile = async (file: File | undefined) => {
    if (!file || blocked()) return;
    const host = current.current.native, active = current.current.session, live = bridge.current;
    if (host && (host.getSnapshot().dirty || !host.getSnapshot().available || !live)) {setNotice('Apply or Discard drafts before Open.'); return;}
    if (!host && active.getSnapshot().dirty) {setNotice('Apply or Discard the material before Open.'); return;}
    live?.beginTransition();
    const generation = ++epoch.current, before = host?.getSnapshot() ?? active.getSnapshot(), previewEpoch = live?.getEpoch();
    busyRef.current = true; setBusy(true);
    try {
      const limit = host ? RENDER_NATIVE_SCENE_LIMITS.fileBytes : RENDER_MATERIAL_LIMITS.fileBytes;
      if (file.size > limit) throw new RenderEditorError('DOCUMENT_BYTES', 'The file exceeds ' + limit + ' UTF-8 bytes.');
      const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
      if (!mounted.current || generation !== epoch.current || current.current.native !== host || current.current.session !== active || (host?.getSnapshot() ?? active.getSnapshot()) !== before || bridge.current !== live || live?.getEpoch() !== previewEpoch) throw new RenderEditorError('STALE_CANDIDATE', 'The document or preview changed while the file was opening.');
      if (host) {
        const document = parseRenderNativeSceneDocument(text); requireEditableScene(document);
        host.commitPrepared(host.prepareOpen(serializeRenderNativeSceneDocument(document))); host.markSaved(document.revision);
        setNotice('Opened ' + document.title + '.');
      } else {
        const document = parseRenderMaterialDocument(text); active.commitPrepared(active.prepareOpen(serializeRenderMaterialDocument(document))); active.markSaved(document.revision); setNotice('Opened ' + document.title + '.');
      }
      setFilename(file.name); setError(null);
    } catch (cause) {if (mounted.current && generation === epoch.current) report(cause);}
    finally {live?.endTransition(); if (mounted.current && generation === epoch.current) {busyRef.current = false; setBusy(false);}}
  };
  const history = (direction: 'undo' | 'redo') => {
    if (blocked()) return;
    const host = current.current.native, active = current.current.session;
    if (host ? host.getSnapshot().dirty : active.getSnapshot().dirty) {setNotice('Apply or Discard drafts before history.'); return;}
    stopHeld();
    try {
      if (host) {const candidate = direction === 'undo' ? host.prepareUndo() : host.prepareRedo(); if (candidate) host.commitPrepared(candidate);}
      else {const candidate = direction === 'undo' ? active.prepareUndo() : active.prepareRedo(); if (candidate) active.commitPrepared(candidate);}
      setError(null); setNotice(direction === 'undo' ? 'Change undone.' : 'Change restored.');
    } catch (cause) {report(cause);}
  };
  const showHelp = () => {if (blocked()) return; stopHeld(); returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : helpButton.current; setHelpOpen(true);};
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const name = event.key.toLowerCase();
      if (name === 's' || name === 'o') {event.preventDefault(); if (!blocked()) {if (name === 's') save(); else open();}}
      else if (name === 'z' && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]'))) {event.preventDefault(); if (!blocked()) history(event.shiftKey ? 'redo' : 'undo');}
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const operationDisabled = busy || pending !== null || helpOpen || poseBusy || surfaceAddOpen;
  const disabled = operationDisabled || materialPreviewBusy;
  const editingDisabled = disabled || !!nativeSnapshot && !nativeSnapshot.available;
  const transferDisabled = disabled || dirty || !bridgeReady || !nativeSnapshot?.available || !!nativeSnapshot?.disposed
    || !nativeSnapshot?.accepted.display.visibleBodyIds.includes(nativeSnapshot.selectedBodyId)
    || !nativeSnapshot?.targets.some(target => target.bodyId === nativeSnapshot.selectedBodyId);
  const duplicateDisabled = disabled || dirty || !nativeSnapshot?.available || nativeSnapshot.accepted.nativeDocument.assets.length >= 4 || nativeSnapshot.accepted.nativeDocument.bodies.length >= 16 || nativeSnapshot.preparation.entries.length >= 4 || nativeSnapshot.accepted.surfaceMaterials.length >= 4 || nativeSnapshot.accepted.display.visibleBodyIds.length >= 4;
  const removeDisabled = disabled || dirty || !nativeSnapshot?.available || nativeSnapshot.accepted.surfaceMaterials.length <= 1;
  const cancelPending = () => {pendingRef.current = null; setPending(null);};
  return <main className="app-shell app-shell--scene re-material-host" data-testid="material-editor-app" data-mode={native ? 'native' : 'material'} data-native-source-open={native ? String(sourceOpen) : undefined} data-native-material-preview={native ? String(materialPreviewBusy) : undefined}>
    <header className="app-topbar"><div className="app-brand"><Box size={18}/><strong>BaroCSS</strong><small>{native ? 'Scene Editor' : 'Material Editor'}</small></div>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger ref={fileButton} data-testid="native-file-menu">File</MenubarTrigger><MenubarContent>
        <MenubarItem disabled={disabled} onSelect={createNew}><FilePlus2/>New {native ? 'scene' : 'material'}</MenubarItem><MenubarSeparator/>
        <MenubarItem disabled={disabled} onSelect={open}><FolderOpen/>Open {native ? 'scene' : 'material'}<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
        <MenubarItem disabled={disabled} onSelect={save}><Save/>Save {native ? 'scene' : 'material'}<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
        {native && <><MenubarSeparator/><MenubarItem disabled={transferDisabled} data-testid="native-material-import" title={dirty ? 'Apply or Discard drafts first.' : undefined} onSelect={importMaterial}>Import material to selected Surface…</MenubarItem><MenubarItem disabled={transferDisabled} data-testid="native-material-export" title={dirty ? 'Apply or Discard drafts first.' : undefined} onSelect={exportMaterial}>Export selected material…</MenubarItem></>}
      </MenubarContent></MenubarMenu><MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
        <MenubarItem disabled={disabled || dirty || !canUndo} onSelect={() => history('undo')}><Undo2/>Undo<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
        <MenubarItem disabled={disabled || dirty || !canRedo} onSelect={() => history('redo')}><Redo2/>Redo<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
        <MenubarSeparator/><MenubarItem disabled={disabled || !dirty} onSelect={discard}>Discard draft</MenubarItem>
      </MenubarContent></MenubarMenu>{native && <MenubarMenu><MenubarTrigger ref={objectButton}>Object</MenubarTrigger><MenubarContent><MenubarItem disabled={duplicateDisabled} onSelect={openSurfaceAdd}><Plus/>Add Surface…</MenubarItem><MenubarSeparator/><MenubarItem disabled={duplicateDisabled} onSelect={duplicateBody}><Copy/>Duplicate body</MenubarItem><MenubarItem disabled={removeDisabled} onSelect={removeBody}><Trash2/>Remove body</MenubarItem></MenubarContent></MenubarMenu>}{native && <MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarItem disabled={disabled} onSelect={toggleSource}>{sourceOpen ? 'Hide Material Source' : 'Show Material Source'}</MenubarItem></MenubarContent></MenubarMenu>}</Menubar>
      <div className="app-topbar-spacer"/>{native && <Button variant="ghost" size="sm" disabled={duplicateDisabled} ref={addButton} data-testid="native-add-surface" onClick={openSurfaceAdd}><Plus/>Add Surface</Button>}{native && <Button variant="ghost" size="sm" disabled={duplicateDisabled} data-testid="native-duplicate-body" onClick={duplicateBody}><Copy/>Duplicate</Button>}{native && <Button variant="ghost" size="sm" disabled={removeDisabled} data-testid="native-remove-body" onClick={removeBody}><Trash2/>Remove</Button>}{!native && <Button size="sm" disabled={disabled || !bridgeReady} data-testid="native-create-scene" onClick={createScene}>Create Scene</Button>}{native && <Button variant="ghost" size="sm" disabled={disabled} ref={sourceButton} data-testid="native-toggle-source" aria-pressed={sourceOpen} onClick={toggleSource}>Source</Button>}<Button variant="ghost" size="sm" disabled={disabled} onClick={showHelp} ref={helpButton} data-testid="material-help">Help</Button>
      <Button variant="ghost" size="sm" disabled={disabled} title="Open a separate required-WebGPU light study" onClick={() => guard({label: 'open the directional-light workbench', execute: () => {
        if (savedRevision !== accepted.revision && !window.confirm('Open a separate light study and leave this unsaved scene?')) return;
        window.location.assign('./material.html?workbench=directional-lights');
      }})}>Directional lights</Button>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={open} data-testid="material-open"><FolderOpen/>Open</Button><Button size="sm" disabled={disabled} onClick={save} data-testid="material-save"><Save/>Save</Button>
    </header>
    <div className="app-document-bar"><strong data-testid="material-title">{accepted.title}</strong>{filename && <span data-testid="material-filename">{filename}</span>}<span className="app-status-spacer"/><span>{dirty ? 'Draft changes' : savedRevision === accepted.revision ? 'File loaded / download requested' : 'Unsaved ' + (native ? 'scene' : 'material')}</span>
      <Button variant="ghost" size="icon-xs" aria-label="Undo change" data-testid="material-undo" disabled={disabled || dirty || !canUndo} onClick={() => history('undo')}><Undo2/></Button><Button variant="ghost" size="icon-xs" aria-label="Redo change" data-testid="material-redo" disabled={disabled || dirty || !canRedo} onClick={() => history('redo')}><Redo2/></Button>
    </div>
    <MaterialEditor session={session} disabled={editingDisabled} onError={report} preview={<MaterialPreview controller={controller} nativeHost={native} onBridgeChange={onBridgeChange} disabled={busy || pending !== null || helpOpen || surfaceAddOpen} onError={report} onTarget={target}/>}/>
    {native && <><NativeSceneOutliner host={native} disabled={disabled} onTarget={target}/><NativeSceneControls host={native} disabled={disabled} onError={report}/><NativeMaterialPreviewControls host={native} disabled={operationDisabled} onError={report}/></>}
    <footer className="app-status"><span role="status" data-testid="material-app-status">{error ? error.code + ': ' + error.message : notice}</span><span className="app-status-spacer"/><span data-testid="material-accepted-revision" data-revision={accepted.revision}>Applied {accepted.revision}</span><span>{nativeSnapshot ? nativeSnapshot.preparation.entries.length + ' bodies · mm' : 'CPU · linear RGB'}</span></footer>
    <input ref={fileInput} type="file" accept={native ? '.native-scene.json,application/json' : '.material.json,application/json'} hidden data-testid="material-file-input" onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readFile(file);}}/>
    <input ref={materialFileInput} type="file" accept=".material.json,application/json" hidden data-testid="native-material-file-input" onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readMaterialFile(file);}}/>
    {surfaceAddOpen && native && <NativeSurfaceAddDialog host={native} onAdd={addSurface} onClose={closeSurfaceAdd} onError={report} onCloseFocus={() => {if (addButton.current && !addButton.current.disabled) addButton.current.focus(); else objectButton.current?.focus();}}/>}
    <Dialog open={pending !== null} onOpenChange={value => {if (!value) cancelPending();}}><DialogContent onCloseAutoFocus={event => {event.preventDefault(); returnFocus.current?.focus();}}><DialogHeader><DialogTitle>Keep draft changes?</DialogTitle><DialogDescription>Apply or Discard the draft before you {pending?.label}. Cancel keeps the current text.</DialogDescription></DialogHeader>{error && <p role="alert">{error.message}</p>}<DialogFooter><Button variant="ghost" onClick={cancelPending}>Cancel</Button><Button variant="secondary" onClick={() => finishPending(false)}>Discard</Button><Button onClick={() => finishPending(true)}>Apply</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent onCloseAutoFocus={event => {event.preventDefault(); returnFocus.current?.focus();}}><DialogHeader><DialogTitle>{native ? 'Scene editing' : 'Material editing'}</DialogTitle><DialogDescription>Apply authored changes to the current Surface Canvas.</DialogDescription></DialogHeader><div className="app-help-copy"><p>Edit Source and uniform values, then Apply. Invalid values keep the applied scene and your corrective text. The CPU sample shows linear RGB; the Canvas includes lighting and gamma.</p><p>{native ? 'Click a visible Surface or choose its body in the right Outliner. View → Show Material Source opens the advanced shader editor. Hiding Source retains its text and validation guards. Edit only the selected material, then Preview draft in Uniforms to display it without accepting it. Cancel preview restores the applied material and keeps the exact draft text. Apply preview accepts one complete scene change. While a material preview is active, finish it before editing, navigating, switching bodies or using files/history. Source control point opens the original Surface grid. Choose its U row and V column, then edit XYZ in source mm or weight. These are original NURBS coefficients, not sampled mesh vertices. Shared source assets require explicit Duplicate first. Apply combines valid control-point, body, material and lighting drafts. Position in mm and local Scale XYZ stage body pose changes. Click the Canvas to focus it. W selects Move, E selects Rotate and R selects Scale. F frames the selected body; Shift+F frames all visible bodies. Pivot switches Bounds center and Object origin. Bounds center uses the original control-hull box center; it is not a mass center and need not lie on every curved Surface. Rotate and Scale keep the chosen pivot fixed by compensating origin translation. Original CAD Source stays unchanged. Use Canvas rings to rotate. Body, material and lighting drafts share one scene Apply and Undo/Redo history. Correct incomplete or refused Transform values before Apply or changing bodies. Discard restores applied values.' : 'Create Scene adds a second Surface and starts complete scene authoring. Until then, material files contain only shader source and supplied uniforms.'}</p><p>Drag to orbit, Shift + drag to pan, or use the wheel to zoom. Navigation changes only the local view. Select and edit bodies after Orbit. Scene camera resets the local view. Set scene camera stores it through one Apply when the scene has no drafts. Save keeps the authored camera.</p><p>{native && 'Object → Add Surface imports one actual Surface from a complete original CAD source file up to 64 KiB. Choose a Surface and press Add. Other objects in that source stay in the asset. The new object starts at its source origin and copies the current applied material into an independent document. Object → Duplicate body copies the complete source asset and material with new identities. The copy starts at the same pose. Move it with the Canvas handles or Position fields. Remove body deletes the selected body, its material and an unreferenced source asset through one scene change. Undo restores them. The last editable Surface is kept. This profile supports up to four displayed bodies and four source assets. '}Apply or Discard drafts before changing files or bodies. Cancel keeps text. Save requests a download of applied authorship. File → Import material to selected Surface stages only shader source and supplied uniforms, preserving the selected material’s identity. Use Preview, Apply or Discard afterward. Export selected material downloads its applied authorship and does not mark the scene saved. Native scene files have a 2 MiB limit; material files have a 256 KiB limit. Open validates the file and applies it to this Canvas. An incompatible display context is refused.</p></div></DialogContent></Dialog>
  </main>;
}
