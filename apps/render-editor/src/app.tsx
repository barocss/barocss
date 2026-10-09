import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, ChevronRight, FilePlus2, FolderOpen, Grid2X2, RotateCcw, Save, Undo2, Redo2 } from 'lucide-react';
import {
  createRenderEditorController, createRenderEditorSession, parseRenderEditorDocument,
  serializeRenderEditorDocument,
} from '@barocss/render-editor';
import type { RenderEditorError, RenderSceneDocumentV0 } from '@barocss/render-editor';
import { RenderEditor } from '@barocss/render-editor/react';
import { Button } from './components/ui/button';
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem,
  MenubarSeparator, MenubarShortcut,
} from './components/ui/menubar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { createEmptyDocument } from './fixtures';
import { readSceneFile, downloadSceneFile } from './files';
import { createWorkspace, readProjectRoute, replaceProjectRoute } from './workspace';
import type { WorkspaceProject } from './workspace';

type PendingAction = { label: string; execute: () => void };
type ErrorOperation = 'open' | 'save' | 'edit' | 'history' | 'restore' | 'project';
type AppErrorNotice = { error: Error; operation: ErrorOperation; copy: string };

function errorCode(error: Error): string | null {
  return 'code' in error && typeof error.code === 'string' ? error.code : null;
}

function errorCopy(error: Error, operation: ErrorOperation, presentedRevision: number | null): string {
  const code = errorCode(error);
  if (operation === 'open') {
    if (code === 'DOCUMENT_BYTES') return 'File could not open. Use a Render Editor file of 256 KiB or less. The current scene is unchanged.';
    if (code === 'PRESENTATION_REFUSED' && presentedRevision === null) return 'File could not open. The current scene is unchanged. Restore the preview, then open the file again.';
    if (code === 'PRESENTATION_REFUSED') return 'File could not open. The previous scene is still shown. The current scene is unchanged. Try Open again.';
    return 'File could not open. The current scene is unchanged. Check the Render Editor file and try again.';
  }
  if (operation === 'save') return 'File could not save. Your scene is still in this tab. Try Save again.';
  if (operation === 'project') {
    if (code === 'PRESENTATION_REFUSED' && presentedRevision === null) return 'Project could not open. The current scene is unchanged. Restore the preview, then select the project again.';
    return 'Project could not open. The current scene is unchanged. Select a project from Workspace and try again.';
  }
  if (code === 'SOURCE_REFUSED') return 'Source could not apply. Correct the source errors and try Apply again. Your draft is kept.';
  if (code === 'PRESENTATION_REFUSED') {
    if (presentedRevision === null) return 'The preview is unavailable. Your scene and draft are kept. Restore the preview, then try again.';
    return 'Update failed. The previous scene is still shown. Your draft is kept. Try the action again.';
  }
  if (operation === 'history') return 'Undo or Redo could not apply. The current scene is unchanged. Check the preview and try again.';
  if (operation === 'restore') return 'The preview could not be restored. Your scene is kept. Try Restore preview again.';
  if (code === 'HISTORY_LIMIT') return 'Changes could not apply. The edit exceeds the history limit. Reduce the edit and try again. Your draft is kept.';
  return 'Changes could not apply. Check the camera values and try Apply again. Your draft is kept.';
}

function AppErrorDetails({ notice }: { notice: AppErrorNotice }) {
  const code = errorCode(notice.error);
  return <details className="app-error-details"><summary>Details</summary><pre data-testid="app-error-details">{code ? `${code}: ` : ''}{notice.error.message}</pre></details>;
}

function createAppState() {
  const projects = createWorkspace();
  const initial = projects.find((project) => project.key === readProjectRoute()) ?? projects[0];
  const session = createRenderEditorSession(initial.document);
  return { projects, initial, controller: createRenderEditorController(session) };
}

export function App() {
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
  const [notice, setNotice] = useState('Select an object or edit the source. Apply changes to render.');
  const [error, setError] = useState<AppErrorNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileReadToken = useRef(0);

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
    if (errorCode(cause) === 'PRESENTATION_REFUSED' && !pending && ['edit', 'history', 'restore'].includes(operation)) return;
    setError({ error: cause, operation, copy: copy ?? errorCopy(cause, operation, controller.getSnapshot().presentedRevision) });
  }

  function runGuarded(action: PendingAction) {
    if (busy || pending) return;
    const current = session.getSnapshot();
    if (current.sourceDirty || current.cameraDirty) { setError(null); setPending(action); }
    else action.execute();
  }

  function activate(key: string) {
    const project = projectsRef.current.find((item) => item.key === key);
    if (!project || key === activeKeyRef.current) return;
    const result = controller.open(serializeRenderEditorDocument(project.document));
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

  function adopt(document: RenderSceneDocumentV0, origin: WorkspaceProject['origin']) {
    const result = controller.open(serializeRenderEditorDocument(document));
    if (!result.ok) { report(result.error, origin === 'file' ? 'open' : 'project'); return; }
    const key = `${document.documentId}-${crypto.randomUUID().slice(0, 8)}`;
    updateProjects([...projectsRef.current, { key, document, origin, savedRevision: origin === 'file' ? document.revision : null }]);
    activeKeyRef.current = key;
    setActiveKey(key);
    replaceProjectRoute(key);
    setError(null);
    setNotice(origin === 'file' ? `Opened ${document.title} from file.` : 'Created an empty scene.');
  }

  function newDocument() {
    runGuarded({ label: 'create a scene', execute: () => {
      rememberAccepted();
      adopt(createEmptyDocument(`scene_${crypto.randomUUID().slice(0, 8)}`), 'local');
    } });
  }

  function openFile() {
    runGuarded({ label: 'open a file', execute: () => fileInput.current?.click() });
  }

  async function acceptFile(file: File) {
    const token = ++fileReadToken.current;
    const readSnapshot = session.getSnapshot();
    const readProjectKey = activeKeyRef.current;
    setBusy(true);
    try {
      const text = await readSceneFile(file);
      if (token !== fileReadToken.current) return;
      if (session.getSnapshot() !== readSnapshot || activeKeyRef.current !== readProjectKey) {
        report(new Error('The scene changed while the file was being read. Open the file again. The current scene and draft are retained.'), 'open', 'The scene changed while the file was read. The current scene and draft are unchanged. Open the file again.');
        return;
      }
      const document = parseRenderEditorDocument(text);
      rememberAccepted();
      adopt(document, 'file');
    } catch (error) { if (token === fileReadToken.current) report(error, 'open'); }
    finally { if (token === fileReadToken.current) setBusy(false); }
  }

  function saveAccepted() {
    try {
      const accepted = session.getSnapshot().accepted;
      downloadSceneFile(accepted);
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
    const result = controller.apply('both');
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
      setError((notice) => notice && errorCode(notice.error) === 'PRESENTATION_REFUSED' ? null : notice);
    }
  }, [presentation.presentationError]);

  useEffect(() => {
    setError((notice) => notice && ['edit', 'history'].includes(notice.operation) ? null : notice);
  }, [snapshot.accepted]);

  useEffect(() => {
    replaceProjectRoute(activeKeyRef.current);
    const release = () => { fileReadToken.current += 1; controller.dispose(); session.dispose(); };
    window.addEventListener('pagehide', release, { once: true });
    return () => { window.removeEventListener('pagehide', release); release(); };
  }, [controller]);

  useEffect(() => {
    const routeChanged = () => {
      fileReadToken.current += 1;
      if (busy) report(new Error('Project navigation canceled the file read. The current scene and draft are retained.'), 'open', 'Project navigation canceled the file read. The current scene and draft are unchanged. Open the file again.');
      setBusy(false);
      const key = readProjectRoute();
      replaceProjectRoute(activeKeyRef.current);
      if (key && projectsRef.current.some((project) => project.key === key)) switchProject(key);
      else report(new Error('Project route is unavailable. The current scene is retained.'), 'project');
    };
    const keyPressed = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.isComposing || event.defaultPrevented || pending || busy || !(event.metaKey || event.ctrlKey)) return;
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
      if (current.sourceDirty || current.cameraDirty || unsaved) { event.preventDefault(); event.returnValue = ''; }
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
  const dirty = snapshot.sourceDirty || snapshot.cameraDirty;
  const downloaded = activeProject?.savedRevision === snapshot.accepted.revision;
  const actionDisabled = busy || pending !== null;
  const previewUnavailable = presentation.presentedRevision === null;
  const previewRefused = presentation.presentationError !== null;
  const canRestorePreview = previewUnavailable && previewRefused && !presentation.disposed;
  const previewStatus = presentation.disposed ? 'Preview closed' : previewUnavailable ? previewRefused ? 'Preview unavailable' : 'Opening preview…' : previewRefused ? 'Preview unchanged' : 'Preview ready';

  return (
    <main className="app-shell" data-testid="render-editor-app">
      <header className="app-topbar">
        <div className="app-brand"><Box size={20} strokeWidth={1.5} /><strong>BaroCSS</strong><span>Render Editor</span></div>
        <Menubar className="app-menubar" aria-label="Application menu">
          <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent>
            <MenubarItem data-testid="menu-new" disabled={actionDisabled} onSelect={newDocument}><FilePlus2 />New scene<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
            <MenubarItem data-testid="menu-open" disabled={actionDisabled} onSelect={openFile}><FolderOpen />Open file…<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
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
          <MenubarMenu><MenubarTrigger>Help</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => setHelpOpen(true)}>Scene editing</MenubarItem></MenubarContent></MenubarMenu>
        </Menubar>
        <div className="app-topbar-spacer" />
        <Button size="sm" variant="ghost" disabled={actionDisabled} onClick={openFile} data-testid="open-file"><FolderOpen />Open</Button>
        <Button size="sm" variant="secondary" disabled={actionDisabled} onClick={saveFile} data-testid="save-file"><Save />Save</Button>
      </header>

      <div className="app-body">
        <aside className="app-projects" aria-label="Workspace projects">
          <div className="app-sidebar-heading"><Grid2X2 size={14} /><span>Workspace</span><Button variant="ghost" size="icon-xs" aria-label="New scene" disabled={actionDisabled} onClick={newDocument}><FilePlus2 /></Button></div>
          <nav aria-label="Projects">
            {projects.map((project) => <button className={`app-project ${project.key === activeKey ? 'is-active' : ''}`} key={project.key} data-testid={`project-${project.document.documentId}`} disabled={actionDisabled} aria-current={project.key === activeKey ? 'page' : undefined} onClick={() => switchProject(project.key)}>
              <Box size={15} /><span>{project.document.title}</span><ChevronRight size={12} />
            </button>)}
          </nav>
          <div className="app-sidebar-note"><span>Local workspace</span><p>Projects stay in this tab. Save files to keep them after closing.</p></div>
        </aside>

        <section className="app-workspace" aria-label="Scene editor" aria-busy={busy}>
          <div className="app-document-bar"><div><span className="app-eyebrow">Scene</span><h1 data-testid="document-title">{snapshot.accepted.title}</h1></div><span className="app-document-state">{dirty ? 'Draft changes' : activeProject?.origin === 'example' && downloaded ? 'Example' : downloaded ? 'File opened / downloaded' : 'Not downloaded'}</span>
            <div className="app-history"><Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.canUndo || actionDisabled} onClick={() => history('undo')}><Undo2 /></Button><Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.canRedo || actionDisabled} onClick={() => history('redo')}><Redo2 /></Button></div>
          </div>
          {error && !pending ? <div className="app-error" role="alert" data-testid="app-error"><div><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div><button aria-label="Dismiss error" onClick={() => setError(null)}>×</button></div> : null}
          <RenderEditor controller={controller} onError={(error: RenderEditorError) => {
            if (error.code === 'PRESENTATION_REFUSED' || (error.code === 'SOURCE_REFUSED' && error.diagnostics.length > 0)) { setError(notice => notice && ['edit', 'history', 'restore'].includes(notice.operation) ? null : notice); return; }
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
        <span>{snapshot.metadata.objects.length} objects</span>
      </footer>

      <input ref={fileInput} type="file" accept=".json,.render-scene.json,application/json" hidden data-testid="scene-file-input" aria-label="Open scene file" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void acceptFile(file);
      }} />

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent showCloseButton={false} data-testid="draft-dialog"><DialogHeader>
          <DialogTitle>Resolve draft changes</DialogTitle>
          <DialogDescription>Apply or discard your source and camera drafts before you {pending?.label}. Apply must succeed in the viewport to continue. Cancel keeps the draft.</DialogDescription>
        </DialogHeader>{error ? <div role="alert" className="app-dialog-error" data-testid="app-error"><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div> : null}<DialogFooter>
          <Button variant="ghost" onClick={() => setPending(null)} data-testid="draft-cancel">Cancel</Button>
          <Button variant="secondary" onClick={discardPending} data-testid="draft-discard">Discard</Button>
          <Button onClick={applyPending} data-testid="draft-apply">Apply and continue</Button>
        </DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><DialogHeader><DialogTitle>Scene editing</DialogTitle><DialogDescription>Edit the source or camera, then Apply to update the preview. A refused change keeps the applied scene.</DialogDescription></DialogHeader><div className="space-y-3 text-sm text-muted-foreground"><p>Select an object to locate its source declaration. Positions and dimensions use scene units. Camera field of view uses degrees.</p><p>Supported objects: sphere, box, cylinder, capsule, rounded box, and torus. Each scene can contain up to 32 objects. Source can contain up to 64 KiB.</p><p>Save downloads the applied scene source and camera. Open accepts Render Editor version 0 JSON files with scene source version 1, up to 256 KiB. CAD files and material files need their own authoring tools.</p><p>Projects remain in this tab. Save a file to keep your work after closing. Downloads depend on browser settings; check the downloaded file.</p><p>Use File for New, Open, and Save. Use Edit for Undo, Redo, and Discard draft. Keyboard commands do not replace normal text editing.</p></div></DialogContent></Dialog>
    </main>
  );
}
