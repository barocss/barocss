import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, ChevronRight, FilePlus2, FolderOpen, Grid2X2, RotateCcw, Save, Undo2, Redo2 } from 'lucide-react';
import {
  createRenderMixedController, createRenderMixedSession, parseRenderMixedDocument,
  serializeRenderMixedDocument,
  RENDER_MIXED_DOCUMENT_LIMITS,
  RenderMixedDocumentError,
  prepareRenderNativeSourceImport,
} from '@barocss/render-editor';
import type { RenderMixedDocumentV1, RenderMixedSessionSnapshot } from '@barocss/render-editor';
import { RenderMixedEditor } from '@barocss/render-editor/react';
import { Button } from './components/ui/button';
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem,
  MenubarSeparator, MenubarShortcut,
} from './components/ui/menubar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { createNewMixedDocument, mixedFixtureDocuments } from './mixed-fixtures';

type PendingAction = { label: string; execute: () => void };
type ErrorOperation = 'open' | 'save' | 'edit' | 'history' | 'restore' | 'project' | 'importNative';
type AppErrorNotice = { error: Error; operation: ErrorOperation; copy: string; previewFailure: boolean };
type NativeImportCandidate = ReturnType<typeof prepareRenderNativeSourceImport>;
interface NativeImportState {
  token: number;
  baseline: RenderMixedSessionSnapshot;
  projectKey: string;
  fileName: string;
  reading: boolean;
  candidate: NativeImportCandidate | null;
}
interface WorkspaceProject {
  key: string;
  document: RenderMixedDocumentV1;
  origin: 'example' | 'local' | 'file';
  savedRevision: number | null;
}

function createWorkspace(): WorkspaceProject[] {
  return mixedFixtureDocuments.map(document => ({ key: document.documentId, document, origin: 'example', savedRevision: document.revision }));
}

function readProjectRoute(): string | null {
  const match = /^#\/mixed\/([^/]+)$/.exec(window.location.hash);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function replaceProjectRoute(key: string): void {
  window.history.replaceState(null, '', `#/mixed/${encodeURIComponent(key)}`);
}

async function readMixedFile(file: File): Promise<string> {
  if (file.size > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes) throw new RenderMixedDocumentError('BYTES', 'Mixed document exceeds 524288 native file bytes.');
  return file.text();
}

function downloadMixedFile(document: RenderMixedDocumentV1): void {
  const blob = new Blob([serializeRenderMixedDocument(document)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${document.documentId}.render-mixed.json`;
  link.hidden = true;
  window.document.body.append(link);
  try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function errorCode(error: Error): string | null {
  return 'code' in error && typeof error.code === 'string' ? error.code : null;
}

function errorCopy(error: Error, operation: ErrorOperation, presentedRevision: number | null, previewFailure: boolean): string {
  const code = errorCode(error);
  if (operation === 'importNative') {
    if (code === 'BYTES') return 'The CAD source file is too large. Choose a file of 64 KiB or less. Your scene and drafts are unchanged.';
    if (code === 'QUALIFICATION') return 'No usable Surface was selected. Choose a source file with a Surface and select it. Your scene and drafts are unchanged.';
    return 'The CAD source could not be imported. Correct the original source or choose another file. Your scene and drafts are unchanged.';
  }
  if (operation === 'open') {
    if (code === 'BYTES') return 'File could not open. Use a mixed scene file of 512 KiB or less with each source no larger than 64 KiB. The current scene is unchanged.';
    if (code === 'VERSION') return 'This file format is not supported here. Choose a version 1 mixed scene file. Use Source editor for version 0 scenes. The current scene is unchanged.';
    if (code === 'SOURCE' || code === 'QUALIFICATION') return 'The file source or selected Surface is invalid. Correct it or choose another mixed scene file. The current scene is unchanged.';
    if (previewFailure && presentedRevision === null) return 'File could not open. The current scene is unchanged. Restore the preview, then open the file again.';
    if (previewFailure) return 'File could not open. The previous scene is still shown. The current scene is unchanged. Try Open again.';
    return 'File could not open. Check the mixed scene profile, source, camera, and display values. The current scene is unchanged.';
  }
  if (operation === 'save') return 'File could not save. Your scene is still in this tab. Try Save again.';
  if (operation === 'project') {
    if (previewFailure && presentedRevision === null) return 'Project could not open. The current scene is unchanged. Restore the preview, then select the project again.';
    return 'Project could not open. The current scene is unchanged. Select a project from Workspace and try again.';
  }
  if (code === 'SOURCE') return 'Source could not apply. Correct the draft source errors and try Apply again. Your draft is kept.';
  if (code === 'QUALIFICATION') return 'The selected model or Surface does not match the native source. Check the references and try Apply again. Your draft is kept.';
  if (previewFailure) {
    if (presentedRevision === null) return 'The preview is unavailable. Your scene and draft are kept. Restore the preview, then try again.';
    return 'Update failed. The previous scene is still shown. Your draft is kept. Try the action again.';
  }
  if (operation === 'history') return 'Undo or Redo could not apply. The current scene is unchanged. Check the preview and try again.';
  if (operation === 'restore') return 'The preview could not be restored. Your scene is kept. Try Restore preview again.';
  return 'Changes could not apply. Check the profile, sources, camera, and display values. Your draft is kept.';
}

function errorDetails(error: unknown, depth = 0): string {
  if (depth > 4) return 'Additional cause retained by the error object.';
  if (error instanceof Error) return `${errorCode(error) ? `${errorCode(error)}: ` : ''}${error.message}${error.cause === undefined ? '' : `\n${errorDetails(error.cause, depth + 1)}`}`;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error, null, 2) ?? String(error); } catch { return String(error); }
}

function AppErrorDetails({ notice }: { notice: AppErrorNotice }) {
  return <details className="app-error-details"><summary>Details</summary><pre data-testid="app-error-details">{errorDetails(notice.error)}</pre></details>;
}

function NativeImportHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Choose an original CAD source text file with a Surface. The source uses version 0 and millimeters. The file must be valid UTF-8 and no larger than 64 KiB.</p><p>Inspect the complete object list, then select a Surface. Curves and unselected Surfaces stay in the original source. This mixed profile displays one Sphere and one selected Surface.</p><p>Use Surface changes the native draft only. Apply checks and updates the complete preview. Scene, camera, and display drafts stay in place. If a native draft already exists, select Replace native draft to replace it.</p><p>Cancel keeps your current scene and drafts. Save keeps the complete original source and the selected model and Surface.</p></div>;
}

function SurfacePositionHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Position X, Y, and Z place the displayed native Surface in scene units. Each displayed point uses its original millimeter coordinates multiplied by the current conversion ratio, then adds Position.</p><p>Enter a complete finite number from -1000 to 1000 for each axis. A minus sign, an empty field, or an invalid value stays as typed. Correct all three fields before Apply.</p><p>The displayed Surface points must also stay within -1000 to 1000 on each axis. A position inside the input range can still be refused. Check the conversion ratio, original Surface, and position if Apply fails.</p><p>Position remains a draft until Apply succeeds. Cancel in a file action keeps the typed values. Discard restores the applied position. Closing Help keeps all typed values.</p><p>Save keeps the applied X, Y, and Z values. Open restores them from the mixed scene file. Position does not change original CAD coordinates, control points, weights, or object IDs.</p></div>;
}

function createAppState() {
  const projects = createWorkspace();
  const initial = projects.find((project) => project.key === readProjectRoute()) ?? projects[0];
  const session = createRenderMixedSession(initial.document);
  return { projects, initial, controller: createRenderMixedController(session) };
}

export function MixedApp() {
  const [initial] = useState(createAppState);
  const controller = initial.controller;
  const session = controller.session;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [projects, setProjects] = useState(initial.projects);
  const projectsRef = useRef(projects);
  const [activeKey, setActiveKey] = useState(initial.initial.key);
  const activeKeyRef = useRef(activeKey);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<'mixed' | 'native' | 'position'>('mixed');
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState('Select an object or edit the source. Apply changes to render.');
  const [error, setError] = useState<AppErrorNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileReadToken = useRef(0);
  const nativeInput = useRef<HTMLInputElement>(null);
  const nativeImportTrigger = useRef<HTMLButtonElement>(null);
  const nativeReadToken = useRef(0);
  const nativePickerBaseline = useRef<Omit<NativeImportState, 'fileName' | 'reading' | 'candidate'> | null>(null);
  const [nativeImport, setNativeImport] = useState<NativeImportState | null>(null);
  const nativeImportRef = useRef<NativeImportState | null>(null);
  const [importSurface, setImportSurface] = useState('');
  const [replaceNativeDraft, setReplaceNativeDraft] = useState(false);

  function setImportState(state: NativeImportState | null) {
    nativeImportRef.current = state;
    setNativeImport(state);
  }

  function cancelNativeImport() {
    nativeReadToken.current += 1;
    nativePickerBaseline.current = null;
    setImportState(null);
    setImportSurface('');
    setReplaceNativeDraft(false);
    setError(notice => notice?.operation === 'importNative' ? null : notice);
  }

  function startNativeImport() {
    if (busy || pending || nativeImportRef.current) return;
    const token = ++nativeReadToken.current;
    nativePickerBaseline.current = { token, baseline: session.getSnapshot(), projectKey: activeKeyRef.current };
    if (nativeInput.current) { nativeInput.current.value = ''; nativeInput.current.click(); }
  }

  function nativeBaselineCurrent(state: Pick<NativeImportState, 'token' | 'baseline' | 'projectKey'>): boolean {
    return nativeReadToken.current === state.token && session.getSnapshot() === state.baseline && activeKeyRef.current === state.projectKey
      && !controller.getSnapshot().disposed && !session.getSnapshot().disposed;
  }

  function reportStaleNative(cause: unknown) {
    report(cause, 'importNative', 'The scene or draft changed during import. Cancel and import the file again. Your current scene and drafts are unchanged.');
  }

  async function acceptNativeFile(file: File) {
    fileReadToken.current += 1;
    setBusy(false);
    const selected = nativePickerBaseline.current ?? { token: ++nativeReadToken.current, baseline: session.getSnapshot(), projectKey: activeKeyRef.current };
    nativePickerBaseline.current = null;
    const state: NativeImportState = { ...selected, fileName: file.name, reading: true, candidate: null };
    setImportSurface('');
    setReplaceNativeDraft(false);
    setError(null);
    setImportState(state);
    try {
      if (file.size > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes) throw new RenderMixedDocumentError('BYTES', 'Native File.size exceeds 65536 bytes.');
      const buffer = await file.arrayBuffer();
      if (nativeReadToken.current !== state.token) return;
      if (!nativeBaselineCurrent(state)) { reportStaleNative(new Error('The import snapshot or project is stale.')); return; }
      let source: string;
      try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); }
      catch (cause) { throw new RenderMixedDocumentError('INPUT', 'The native source is not valid UTF-8.', cause); }
      const candidate = prepareRenderNativeSourceImport(source);
      if (!nativeBaselineCurrent(state)) { reportStaleNative(new Error('The import snapshot or project is stale.')); return; }
      setImportState({ ...state, reading: false, candidate });
    } catch (cause) {
      if (nativeReadToken.current !== state.token) return;
      if (!nativeBaselineCurrent(state)) reportStaleNative(cause);
      else report(cause, 'importNative', cause instanceof RenderMixedDocumentError && cause.code === 'INPUT' && cause.message === 'The native source is not valid UTF-8.'
        ? 'The file is not valid UTF-8. Choose a UTF-8 CAD source file. Your scene and drafts are unchanged.' : undefined);
    } finally {
      if (nativeReadToken.current === state.token && nativeImportRef.current?.reading) setImportState({ ...nativeImportRef.current, reading: false });
    }
  }

  function useImportedSurface() {
    const state = nativeImportRef.current;
    if (!state?.candidate || state.reading || !importSurface) return;
    if (!nativeBaselineCurrent(state)) { reportStaleNative(new Error('The selected import snapshot or project is stale.')); return; }
    const draft = state.baseline.draft.asset, accepted = state.baseline.accepted.asset;
    const replacementRequired = draft.source !== accepted.source || draft.modelId !== accepted.modelId || draft.surfaceId !== accepted.surfaceId;
    if (replacementRequired && !replaceNativeDraft) return;
    try {
      session.setDraftNativeAsset(state.candidate.source, state.candidate.modelId, importSurface);
      cancelNativeImport();
      setNotice('CAD source staged. Apply to update the preview.');
    } catch (cause) { report(cause, 'importNative'); }
  }

  function updateProjects(next: WorkspaceProject[]) {
    projectsRef.current = next;
    setProjects(next);
  }

  function rememberAccepted() {
    const accepted = session.getSnapshot().accepted;
    updateProjects(projectsRef.current.map((project) => project.key === activeKeyRef.current ? { ...project, document: accepted } : project));
  }

  function report(input: unknown, operation: ErrorOperation, copy?: string) {
    const cause = input instanceof Error ? input : new Error(typeof input === 'string' ? input : 'The action failed.');
    const previewFailure = controller.getSnapshot().presentationError === cause;
    if (previewFailure && !pending && ['edit', 'history', 'restore'].includes(operation)) return;
    setError({ error: cause, operation, previewFailure, copy: copy ?? errorCopy(cause, operation, controller.getSnapshot().presentedRevision, previewFailure) });
  }

  function runGuarded(action: PendingAction) {
    if (busy || pending || nativeImportRef.current) return;
    const current = session.getSnapshot();
    if (current.dirty) { setError(null); setPending(action); }
    else action.execute();
  }

  function activate(key: string) {
    const project = projectsRef.current.find((item) => item.key === key);
    if (!project || key === activeKeyRef.current) return;
    const result = controller.open(serializeRenderMixedDocument(project.document));
    if (!result.ok) { report(result.error, 'project'); return; }
    activeKeyRef.current = key;
    setActiveKey(key);
    replaceProjectRoute(key);
    setError(null);
    setNotice(`Opened ${project.document.title}.`);
  }

  function switchProject(key: string) {
    if (key === activeKeyRef.current) return;
    runGuarded({ label: 'switch project', execute: () => { rememberAccepted(); activate(key); } });
  }

  function adopt(document: RenderMixedDocumentV1, origin: WorkspaceProject['origin']) {
    const result = controller.open(serializeRenderMixedDocument(document));
    if (!result.ok) { report(result.error, origin === 'file' ? 'open' : 'project'); return; }
    const key = `${document.documentId}-${crypto.randomUUID().slice(0, 8)}`;
    updateProjects([...projectsRef.current, { key, document, origin, savedRevision: origin === 'file' ? document.revision : null }]);
    activeKeyRef.current = key;
    setActiveKey(key);
    replaceProjectRoute(key);
    setError(null);
    setNotice(origin === 'file' ? `Opened ${document.title} from file.` : 'Created a mixed scene from the Sphere and Surface profile.');
  }

  function newDocument() {
    runGuarded({ label: 'create a scene', execute: () => {
      rememberAccepted();
      adopt(createNewMixedDocument(`scene_${crypto.randomUUID().slice(0, 8)}`), 'local');
    } });
  }

  function openFile() {
    runGuarded({ label: 'open a file', execute: () => fileInput.current?.click() });
  }

  async function acceptFile(file: File) {
    nativeReadToken.current += 1;
    if (nativeImportRef.current?.reading) {
      setImportState({ ...nativeImportRef.current, reading: false });
      reportStaleNative(new Error('Opening a mixed document invalidated the native import.'));
    }
    const token = ++fileReadToken.current;
    const readSnapshot = session.getSnapshot();
    const readProjectKey = activeKeyRef.current;
    setBusy(true);
    try {
      const text = await readMixedFile(file);
      if (token !== fileReadToken.current) return;
      if (session.getSnapshot() !== readSnapshot || activeKeyRef.current !== readProjectKey) {
        report(new Error('The scene changed while the file was being read. Open the file again. The current scene and draft are retained.'), 'open', 'The scene changed while the file was read. The current scene and draft are unchanged. Open the file again.');
        return;
      }
      const document = parseRenderMixedDocument(text);
      rememberAccepted();
      adopt(document, 'file');
    } catch (error) { if (token === fileReadToken.current) report(error, 'open', file.size > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes ? 'The file is too large. Choose a scene file of 512 KiB or less. The current scene is unchanged.' : undefined); }
    finally { if (token === fileReadToken.current) setBusy(false); }
  }

  function saveAccepted() {
    try {
      const accepted = session.getSnapshot().accepted;
      downloadMixedFile(accepted);
      session.markSaved(accepted.revision);
      updateProjects(projectsRef.current.map((project) => project.key === activeKeyRef.current ? { ...project, document: accepted, savedRevision: accepted.revision } : project));
      setError(null);
      setNotice('Download started.');
    } catch (error) { report(error, 'save'); }
  }

  function saveFile() { runGuarded({ label: 'save the file', execute: saveAccepted }); }

  function history(direction: 'undo' | 'redo') {
    const result = controller[direction]();
    if (!result.ok) report(result.error, 'history');
    else { setError(null); setNotice(direction === 'undo' ? 'Undo applied to the viewport.' : 'Redo applied to the viewport.'); }
  }

  function applyPending() {
    if (!pending) return;
    const result = controller.apply();
    if (!result.ok) { report(result.error, 'edit'); return; }
    const action = pending;
    setPending(null);
    action.execute();
  }

  function discardPending() {
    if (!pending) return;
    session.discardDraft();
    const action = pending;
    setPending(null);
    action.execute();
  }

  useEffect(() => {
    if (presentation.presentationError === null) {
      setError((notice) => notice?.previewFailure ? null : notice);
    }
  }, [presentation.presentationError]);

  useEffect(() => {
    setError((notice) => notice && ['edit', 'history'].includes(notice.operation) ? null : notice);
  }, [snapshot.accepted]);

  useEffect(() => {
    replaceProjectRoute(activeKeyRef.current);
    const release = () => { fileReadToken.current += 1; nativeReadToken.current += 1; nativePickerBaseline.current = null; controller.dispose(); session.dispose(); };
    window.addEventListener('pagehide', release, { once: true });
    return () => { window.removeEventListener('pagehide', release); release(); };
  }, [controller]);

  useEffect(() => {
    const input = nativeInput.current;
    const canceled = () => cancelNativeImport();
    input?.addEventListener('cancel', canceled);
    return () => input?.removeEventListener('cancel', canceled);
  }, [controller]);

  useEffect(() => {
    const routeChanged = () => {
      fileReadToken.current += 1;
      nativeReadToken.current += 1;
      if (nativeImportRef.current) {
        setImportState({ ...nativeImportRef.current, reading: false });
        reportStaleNative(new Error('Project navigation invalidated the native import.'));
      }
      if (busy) report(new Error('Project navigation canceled the file read. The current scene and draft are retained.'), 'open', 'Project navigation canceled the file read. The current scene and draft are unchanged. Open the file again.');
      setBusy(false);
      const key = readProjectRoute();
      replaceProjectRoute(activeKeyRef.current);
      if (key && projectsRef.current.some((project) => project.key === key)) switchProject(key);
      else report(new Error('Project route is unavailable. The current scene is retained.'), 'project');
    };
    const keyPressed = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.isComposing || event.defaultPrevented || pending || busy || nativeImportRef.current || !(event.metaKey || event.ctrlKey)) return;
      if (target instanceof HTMLElement && (target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))) return;
      const key = event.key.toLowerCase();
      if (!['n', 'o', 's', 'z'].includes(key) || event.altKey) return;
      event.preventDefault();
      if (key === 'n') newDocument();
      else if (key === 'o') openFile();
      else if (key === 's') saveFile();
      else history(event.shiftKey ? 'redo' : 'undo');
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = session.getSnapshot();
      const unsaved = projectsRef.current.some((project) => project.savedRevision !== (project.key === activeKeyRef.current ? current.accepted.revision : project.document.revision));
      if (current.dirty || unsaved) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('hashchange', routeChanged);
    window.addEventListener('keydown', keyPressed);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('hashchange', routeChanged);
      window.removeEventListener('keydown', keyPressed);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  });

  const activeProject = projects.find((project) => project.key === activeKey);
  const dirty = snapshot.dirty;
  const downloaded = activeProject?.savedRevision === snapshot.accepted.revision;
  const actionDisabled = busy || pending !== null || nativeImport !== null;
  const nativeReplacementRequired = nativeImport !== null && (
    nativeImport.baseline.draft.asset.source !== nativeImport.baseline.accepted.asset.source
    || nativeImport.baseline.draft.asset.modelId !== nativeImport.baseline.accepted.asset.modelId
    || nativeImport.baseline.draft.asset.surfaceId !== nativeImport.baseline.accepted.asset.surfaceId
  );
  const previewUnavailable = presentation.presentedRevision === null;
  const previewRefused = presentation.presentationError !== null;
  const canRestorePreview = previewUnavailable && previewRefused && !presentation.disposed;
  const previewStatus = presentation.disposed ? 'Preview closed' : previewUnavailable ? previewRefused ? 'Preview unavailable' : 'Opening preview…' : previewRefused ? 'Preview unchanged' : 'Preview ready';

  return (
    <main className="app-shell" data-testid="render-mixed-editor-app">
      <header className="app-topbar">
        <div className="app-brand"><Box size={20} strokeWidth={1.5} /><strong>BaroCSS</strong><span>Mixed Editor</span></div>
        <Menubar className="app-menubar" aria-label="Application menu">
          <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
            <MenubarItem data-testid="menu-new" disabled={actionDisabled} onSelect={newDocument}><FilePlus2 />New mixed scene<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
            <MenubarItem data-testid="menu-open" disabled={actionDisabled} onSelect={openFile}><FolderOpen />Open file…<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={actionDisabled} onSelect={startNativeImport}>Import CAD source</MenubarItem>
            <MenubarSeparator />
            <MenubarItem data-testid="menu-save" disabled={actionDisabled} onSelect={saveFile}><Save />Save file<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
            <MenubarItem disabled={!snapshot.canUndo || actionDisabled} onSelect={() => history('undo')}><Undo2 />Undo<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={!snapshot.canRedo || actionDisabled} onSelect={() => history('redo')}><Redo2 />Redo<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
            <MenubarSeparator /><MenubarItem disabled={!dirty || actionDisabled} onSelect={() => { session.discardDraft(); setError(notice => notice?.operation === 'edit' ? null : notice); }}>Discard draft</MenubarItem>
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger>Workspace</MenubarTrigger><MenubarContent>
            {projects.map((project) => <MenubarItem key={project.key} disabled={actionDisabled} onSelect={() => switchProject(project.key)}>{project.document.title}</MenubarItem>)}
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger ref={helpTrigger}>Help</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => { setHelpTopic('mixed'); setHelpOpen(true); }}>Mixed scene editing</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('native'); setHelpOpen(true); }}>Native source import</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('position'); setHelpOpen(true); }}>Surface position</MenubarItem></MenubarContent></MenubarMenu>
        </Menubar>
        <div className="app-topbar-spacer" />
        <Button size="sm" variant="ghost" asChild><a href="/index.html" onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          runGuarded({ label: 'open Source editor', execute: () => window.location.assign('/index.html') });
        }}>Source editor</a></Button>
        <Button ref={nativeImportTrigger} size="sm" variant="ghost" disabled={busy || pending !== null} onClick={startNativeImport} data-testid="import-native-source">Import CAD source</Button>
        <Button size="sm" variant="ghost" disabled={actionDisabled} onClick={openFile} data-testid="open-file"><FolderOpen />Open</Button>
        <Button size="sm" variant="secondary" disabled={actionDisabled} onClick={saveFile} data-testid="save-file"><Save />Save</Button>
      </header>

      <div className="app-body">
        <aside className="app-projects" aria-label="Workspace projects">
          <div className="app-sidebar-heading"><Grid2X2 size={14} /><span>Workspace</span><Button variant="ghost" size="icon-xs" aria-label="New mixed scene" disabled={actionDisabled} onClick={newDocument}><FilePlus2 /></Button></div>
          <nav aria-label="Projects">
            {projects.map((project) => <button className={`app-project ${project.key === activeKey ? 'is-active' : ''}`} key={project.key} data-testid={`project-${project.document.documentId}`} disabled={actionDisabled} aria-current={project.key === activeKey ? 'page' : undefined} onClick={() => switchProject(project.key)}>
              <Box size={15} /><span>{project.document.title}</span><ChevronRight size={12} />
            </button>)}
          </nav>
          <div className="app-sidebar-note"><span>Local workspace</span><p>Projects stay in this tab. Save files to keep them after closing.</p></div>
        </aside>

        <section className="app-workspace" aria-label="Mixed scene editor" aria-busy={busy}>
          <div className="app-document-bar"><div><span className="app-eyebrow">Mixed scene</span><h1 data-testid="document-title">{snapshot.accepted.title}</h1></div><span className="app-document-state">{dirty ? 'Draft changes' : activeProject?.origin === 'example' && downloaded ? 'Example' : downloaded ? 'File opened / downloaded' : 'Not downloaded'}</span>
            <div className="app-history"><Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.canUndo || actionDisabled} onClick={() => history('undo')}><Undo2 /></Button><Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.canRedo || actionDisabled} onClick={() => history('redo')}><Redo2 /></Button></div>
          </div>
          {error && !pending && !nativeImport ? <div className="app-error" role="alert" data-testid="app-error"><div><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div><button aria-label="Dismiss error" onClick={() => setError(null)}>×</button></div> : null}
          <RenderMixedEditor controller={controller} onError={(error: RenderMixedDocumentError) => {
            if (controller.getSnapshot().presentationError === error || session.getSnapshot().diagnostics === error) { setError(notice => notice && ['edit', 'history', 'restore'].includes(notice.operation) ? null : notice); return; }
            report(error, 'edit');
          }} />
        </section>
      </div>

      <footer className="app-status" aria-live="polite">
        <span className={`app-status-dot ${previewRefused ? previewUnavailable ? 'has-error' : 'has-warning' : ''}`} />
        <span data-testid="app-status">{busy ? 'Reading file…' : previewRefused || previewUnavailable || presentation.disposed ? previewStatus : notice}</span>
        <span className="app-status-spacer" />
        {canRestorePreview ? <Button variant="ghost" size="xs" onClick={() => { const result = controller.recover(); if (!result.ok) report(result.error, 'restore'); }}><RotateCcw />Restore preview</Button> : null}
        <span data-testid="accepted-revision" data-revision={snapshot.accepted.revision}>{dirty ? 'Draft changes' : 'Applied'}</span>
        <span data-testid="presented-revision" data-revision={presentation.presentedRevision ?? 'none'}>{previewStatus}</span>
        <span>{snapshot.prepared.metadata.nativeObjects.length} native objects</span>
      </footer>

      <input ref={fileInput} type="file" accept=".json,.render-mixed.json,application/json" hidden data-testid="scene-file-input" aria-label="Open scene file" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void acceptFile(file);
      }} />
      <input ref={nativeInput} type="file" accept=".barocad,.txt,.css,text/plain,text/css" hidden data-testid="native-source-file-input" aria-label="Import CAD source file" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void acceptNativeFile(file);
        else cancelNativeImport();
      }} />

      <Dialog open={nativeImport !== null} onOpenChange={open => { if (!open) cancelNativeImport(); }}>
        <DialogContent showCloseButton={false} className="max-h-[85svh] overflow-y-auto" data-testid="native-import-dialog" onCloseAutoFocus={event => { event.preventDefault(); nativeImportTrigger.current?.focus(); }}><DialogHeader>
          <DialogTitle>Import CAD source</DialogTitle>
          <DialogDescription>{nativeImport?.reading ? 'Reading the CAD source. Cancel keeps your current scene and drafts.' : 'Choose a Surface to stage. Apply updates the preview after this dialog closes.'}</DialogDescription>
        </DialogHeader>
        {nativeImport?.candidate ? <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{nativeImport.fileName} · {nativeImport.candidate.modelId}</p>
          <div><p className="mb-2 text-sm font-medium">Objects</p><ul data-testid="native-import-inventory" className="max-h-44 space-y-1 overflow-y-auto text-sm text-muted-foreground">{nativeImport.candidate.objects.map(object => <li key={object.id}>{object.id} · {object.kind}</li>)}</ul></div>
          <label className="flex flex-col gap-2 text-sm"><span>Surface</span><select aria-label="Import Surface" className="rounded-md border border-input bg-background p-2" value={importSurface} onChange={event => setImportSurface(event.currentTarget.value)}><option value="">Choose a Surface</option>{nativeImport.candidate.surfaces.map(surface => <option key={surface.id} value={surface.id}>{surface.id}</option>)}</select></label>
          {nativeReplacementRequired ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Replace native draft" checked={replaceNativeDraft} onChange={event => setReplaceNativeDraft(event.currentTarget.checked)} /><span>Replace native draft</span></label> : null}
        </div> : null}
        {error?.operation === 'importNative' ? <div role="alert" className="app-dialog-error" data-testid="app-error"><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div> : null}
        <details><summary className="cursor-pointer text-sm">Help</summary><div className="mt-3"><NativeImportHelp /></div></details>
        <DialogFooter><Button variant="ghost" onClick={cancelNativeImport} data-testid="native-import-cancel">Cancel</Button><Button disabled={!nativeImport?.candidate || nativeImport.reading || !importSurface || (nativeReplacementRequired && !replaceNativeDraft)} onClick={useImportedSurface} data-testid="native-import-use">Use Surface</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent showCloseButton={false} data-testid="draft-dialog"><DialogHeader>
          <DialogTitle>Resolve draft changes</DialogTitle>
          <DialogDescription>Apply or discard your source, camera, and display drafts before you {pending?.label}. Apply must succeed in the preview to continue. Cancel keeps the draft.</DialogDescription>
        </DialogHeader>{error ? <div role="alert" className="app-dialog-error" data-testid="app-error"><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div> : null}<DialogFooter>
          <Button variant="ghost" onClick={() => setPending(null)} data-testid="draft-cancel">Cancel</Button>
          <Button variant="secondary" onClick={discardPending} data-testid="draft-discard">Discard</Button>
          <Button onClick={applyPending} data-testid="draft-apply">Apply and continue</Button>
        </DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); helpTrigger.current?.focus(); }}><DialogHeader><DialogTitle>{helpTopic === 'native' ? 'Native source import' : helpTopic === 'position' ? 'Surface position' : 'Mixed scene editing'}</DialogTitle><DialogDescription>{helpTopic === 'native' ? 'Choose an original CAD source and a Surface, then stage it for Apply.' : helpTopic === 'position' ? 'Place the displayed Surface without changing the original CAD source.' : 'Edit either original source, the camera, or the display settings. Apply updates the complete preview together.'}</DialogDescription></DialogHeader>{helpTopic === 'native' ? <NativeImportHelp /> : helpTopic === 'position' ? <SurfacePositionHelp /> : <div className="space-y-3 text-sm text-muted-foreground"><p>This profile displays one scene Sphere and one selected native Surface with shared depth. Other native objects stay in the original source and inventory. Curves are kept in the file and are not drawn in this preview.</p><p>The native source uses millimeters. Display conversion and translation place it in scene units. Camera field of view uses degrees. Native display settings do not change the original control points, weights, or UV definition.</p><p>New starts from a valid Sphere and Surface sample. Workspace contains two source pairs. Use Source editor for the broader scene object editor and its version 0 files.</p><p>Save downloads accepted version 1 mixed JSON, including both original sources, selected model and Surface, camera, and display values. Open accepts mixed scene files up to 512 KiB, with each source no larger than 64 KiB.</p><p>Projects stay in this tab. Save a file before closing. Downloads depend on browser settings; check the downloaded file. CAD materials, Physics, precise picking, and additional mixed shapes are outside this profile.</p></div>}</DialogContent></Dialog>
    </main>
  );
}
