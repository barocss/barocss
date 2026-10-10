import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, ChevronRight, FilePlus2, FolderOpen, Grid2X2, RotateCcw, Save, Undo2, Redo2, Copy, FileCode2, Pencil } from 'lucide-react';
import {
  createRenderMixedController, createRenderMixedSession, parseRenderMixedDocument,
  serializeRenderMixedDocument,
  RENDER_MIXED_DOCUMENT_LIMITS,
  RenderMixedDocumentError,
  prepareRenderNativeSourceImport,
  duplicateRenderMixedDocument,
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

type PendingAction = { label: string; execute: () => void; confirmUnsaved?: boolean; returnFocus?: () => HTMLElement | null };
type ErrorOperation = 'open' | 'save' | 'edit' | 'history' | 'restore' | 'project' | 'importNative' | 'duplicate';
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
interface RenameState {
  baseline: RenderMixedSessionSnapshot;
  projectKey: string;
  fileToken: number;
  nativeToken: number;
  invalidated: boolean;
}
interface UnsavedState extends RenameState {
  action: PendingAction;
  title: string;
  downloadStarted: boolean;
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

function sphereCameraConstraint(error: Error): boolean {
  if (errorCode(error) !== 'GPU' || !(error.cause instanceof Error) || error.cause.name !== 'MixedDepthError') return false;
  const code = Object.getOwnPropertyDescriptor(error.cause, 'code');
  return Boolean(code && 'value' in code && code.value === 'CAMERA');
}

function errorCopy(error: Error, operation: ErrorOperation, presentedRevision: number | null, previewFailure: boolean): string {
  const code = errorCode(error);
  if (operation === 'edit' && !previewFailure && sphereCameraConstraint(error)) return 'The Sphere does not fit this camera view. Reduce its radius, move it, or adjust the camera, then Apply.';
  if (operation === 'duplicate') {
    if (previewFailure && presentedRevision === null) return 'The scene could not be duplicated. Your original scene is kept. Cancel, restore the preview, then try Duplicate again.';
    if (previewFailure) return 'The scene could not be duplicated. The previous scene is still shown. Try Duplicate again.';
    return 'The scene could not be duplicated. Your original scene and drafts are kept. Try Duplicate again.';
  }
  if (operation === 'importNative') {
    if (code === 'BYTES') return 'The CAD source file is too large. Choose a file of 64 KiB or less. Your scene and drafts are unchanged.';
    if (code === 'QUALIFICATION') return 'No usable Surface was selected. Choose a source file with a Surface and select it. Your scene and drafts are unchanged.';
    return 'The CAD source could not be imported. Correct the original source or choose another file. Your scene and drafts are unchanged.';
  }
  if (operation === 'open') {
    if (code === 'BYTES') return 'File could not open. Use a mixed scene file of 512 KiB or less with each source no larger than 64 KiB. The current scene is unchanged.';
    if (code === 'VERSION') return 'This file format is not supported here. Choose a version 1 mixed scene file. Use GPU Scene editor for version 0 scenes. The current scene is unchanged.';
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

function ObjectInspectorHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Choose the Sphere or Surface row to show its editing controls. The Sphere shows its current name and type. Edit Source opens the Scene source field. The Surface shows its native Surface reference, Position X/Y/Z, color, and advanced display settings. Camera controls stay in the common View section.</p><p>Choosing a row selects an editing target. It does not pick or highlight pixels, change history, or change saved document data. A row also selects the matching source tab and keeps keyboard focus on the row. Edit Source moves focus to the actual Scene source field. Source tabs can select a different editing target independently.</p><p>Surface controls keep their typed values when hidden. An incomplete or invalid position still blocks Apply and file actions. Use Edit Surface position in Diagnostics to show the controls and focus the first invalid field. Correct it or use Discard to restore the applied values.</p><p>The inspector starts on Sphere when the editor first opens. The selected target stays during Apply, Open, and project changes in this page. Names and references refresh from the current document. A fresh page starts on Sphere. A changed native Surface reference is marked Draft until Apply succeeds.</p><p>Closing Help returns focus to Help and keeps all draft text. Edit dimensions and geometry in the original source. The inspector does not infer radius, pose, or material values from the preview.</p></div>;
}

function RenameSceneHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>The title is the scene label in the header and Workspace. It does not change the original scene, model, Surface, or asset IDs. The download file name still uses the document ID.</p><p>Enter a nonblank title of up to 128 characters. Unicode and surrounding whitespace are kept as typed. Use title stages a draft. Apply accepts the complete document before the header and Workspace show the new title.</p><p>Cancel before Use title keeps all current drafts. Undo and Redo restore applied titles with the rest of the document. Discard restores the applied title. Save keeps the applied title; Open restores it from the file.</p><p>A title draft does not bypass invalid source, camera, or Surface position values. Correct those values before Apply. Help keeps the typed title and all other drafts.</p></div>;
}

function UnsavedSceneHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>This scene has applied changes without a current opened or downloaded file copy. Before New, Open, a project change, or GPU Scene editor, resolve any drafts first.</p><p>Download copy starts a download of the applied scene and keeps this dialog open. Check the downloaded file. It does not continue the pending action. Choose Continue without downloading separately when you are ready.</p><p>Continue without downloading performs only the named action. It does not mark the old scene as downloaded. Cancel keeps the current scene, route, preview, and draft text and returns focus to the action you chose.</p><p>Projects stay in this tab. The browser leave warning still applies. This dialog does not provide recovery after a crash or an operating system failure.</p></div>;
}

function SourcePointHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Choose the Surface row and open Source point. Enter U and V within the shown ranges, then Inspect. These are dimensionless knot parameters of the applied original Surface. They are not texture coordinates.</p><p>The result gives original X, Y, and Z in millimeters from the selected applied Surface. Pending native source, Surface selection, or display position is not queried. The displayed mesh is a sampled approximation. Inspect does not read pixels, pick geometry, project a point, or add a marker.</p><p>The query and its result stay local to this editor. An applied document change, including Apply, Undo, Redo, Open, or a project change, clears the previous result. Inspect does not change original source, references, history, camera, display, or saved file data.</p><p>Typing U and V does not create a scene draft or block Apply and File actions. Existing source, camera, and Surface position drafts still require their normal checks. Closing Help returns focus to Help and keeps all draft text.</p><p>Use a desktop workspace of at least 1000 × 760 CSS pixels. The right inspector has its own scroll area. Source Apply, File actions, and the Draft changes footer remain available at this size. Smaller layouts do not establish mobile support.</p></div>;
}

function DuplicateSceneHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Duplicate scene creates a separate workspace scene from the applied document. Resolve drafts with Apply, Discard, or Cancel before choosing the copy title.</p><p>The copy has its own document ID, file name, and new history. It keeps both complete original sources, native model and Surface IDs, asset revision, camera, and display settings. Native identity is retained; it is not a new CAD model.</p><p>Enter a nonblank title of up to 128 characters. Unicode and whitespace stay as typed. Duplicate opens the copy only when its complete preview is accepted. The original stays in Workspace and can be edited separately.</p><p>Cancel keeps the current scene and returns focus to Duplicate scene. Save each scene to keep its own file. An invalid preview or a changed scene during the dialog refuses the copy. Cancel and reopen after a changed scene.</p></div>;
}

function CameraControlsHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Drag the scene with the left button to Orbit. Choose Pan or hold Shift while dragging to move the view. Scroll the wheel to zoom. Click the scene to focus it, then use arrows to Orbit, Shift-arrows to Pan, and + or − to zoom.</p><p>View preview shows the applied scene from a temporary camera. Source, Surface position, and other drafts stay in place. Camera fields show the preview and cannot be edited until you finish it.</p><p>Use view restores the applied view, replaces any existing manual camera draft, and applies the complete draft once. Invalid source, camera, or hidden Surface position can refuse that application. Your drafts are kept for correction.</p><p>Cancel view or Escape on the focused scene restores the applied camera and keeps every existing draft, including a manual camera draft. File actions, history, import, and other edits stay blocked during View preview. Help keeps the temporary view and all draft text.</p><p>Cameras that enter or clip the Sphere, or exceed the admitted view limits, are refused. Try a smaller move. This is camera navigation of the same preview; it does not move geometry or pick objects. After Use view succeeds, Save keeps the applied camera and normal Unsaved scene checks apply.</p></div>;
}

function SpherePropertiesHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Select Sphere to edit Radius, Position X/Y/Z in scene units, and an opaque hexadecimal Color. Fields come from the current Scene source, including its effective defaults and style rules. Use #rgb or #rrggbb for Color.</p><p>Radius must be positive and no greater than 1000. Each position must be finite and from -1000 to 1000. Fields accept up to 256 text characters. Incomplete or refused input stays as typed. Correct it before Apply.</p><p>Values within the field limits can still be refused by the camera view. Reduce the Sphere radius, change its Position, or adjust the camera if the Sphere enters or clips the view.</p><p>Properties remain drafts until the complete Apply succeeds. A hidden invalid Sphere field still blocks Apply, file transitions, and camera Use view. Use Edit Sphere properties in Diagnostics to reveal and focus the field needing correction.</p><p>Editing Scene source explicitly replaces the Sphere field drafts. Invalid source disables these controls; Edit source remains the correction path. Discard and applied document changes refresh properties from the source. Unrelated camera, title, and native drafts do not replace field text.</p><p>Sphere Position edits original scene-source placement. Native Surface Position changes its display only. The existing object ID, native model, weights, camera, and display settings stay unchanged by Sphere edits. This profile still contains one Sphere and one Surface.</p><p>Help and selection keep drafts and the preview unchanged. Save keeps accepted source text; fresh Open reads effective properties again. An equivalent valid numeric spelling may stay after Discard if it made no authored change.</p></div>;
}

function EditorLayoutHelp() {
  return <div className="space-y-3 text-sm text-muted-foreground"><p>Scene and Projects share the left dock. Select an object in Scene, or open a project in Projects. Object and Camera share the right inspector. Hidden fields keep their text and still need correction before Apply.</p><p>Apply and Discard stay in the viewport header. Source and Problems open the bottom drawer. Edit source opens the actual source field. Problems contains errors, preview notices, and correction actions. Opening a panel does not apply edits.</p><p>Drag a divider to resize a dock or the drawer. Focus a divider and use arrow keys, Home, or End. Sizes stay within the workspace bounds and keep the viewport accessible. No layout change is saved in scene files.</p><p>The view axes show the current camera orientation. They do not pick objects or move geometry. This mixed profile still shows one Sphere and one selected native Surface. Other native objects remain in the saved source.</p><p>Use a desktop workspace of at least 1000 × 760 CSS pixels. Help keeps the source, fields, and temporary camera view. Closing Help returns focus to Help.</p></div>;
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
  const pendingRef = useRef<PendingAction | null>(null);
  const pendingReturnFocus = useRef<PendingAction['returnFocus']>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<'mixed' | 'native' | 'position' | 'inspector' | 'rename' | 'unsaved' | 'point' | 'duplicate' | 'camera' | 'sphere' | 'layout'>('mixed');
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState('Select an object or edit the source. Apply changes to render.');
  const [error, setError] = useState<AppErrorNotice | null>(null);
  const previousDirty = useRef(snapshot.dirty);
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
  const renameTrigger = useRef<HTMLButtonElement>(null);
  const [rename, setRename] = useState<RenameState | null>(null);
  const renameRef = useRef<RenameState | null>(null);
  const [rawTitle, setRawTitle] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const fileTrigger = useRef<HTMLButtonElement>(null);
  const openTrigger = useRef<HTMLButtonElement>(null);
  const newTrigger = useRef<HTMLButtonElement>(null);
  const sourceTrigger = useRef<HTMLAnchorElement>(null);
  const projectTriggers = useRef(new Map<string, HTMLButtonElement>());
  const projectFocusFrame = useRef(0);
  const [unsaved, setUnsaved] = useState<UnsavedState | null>(null);
  const unsavedRef = useRef<UnsavedState | null>(null);
  const unsavedReturnFocus = useRef<PendingAction['returnFocus']>(undefined);
  const [unsavedError, setUnsavedError] = useState<AppErrorNotice | null>(null);
  const hasCameraPreview = () => Boolean(controller.getSnapshot().cameraPreview);

  function restoreActionFocus(getTarget: PendingAction['returnFocus']) {
    if (projectFocusFrame.current) cancelAnimationFrame(projectFocusFrame.current);
    projectFocusFrame.current = 0;
    const target = getTarget?.();
    if (!target) return;
    if (target.closest('.app-projects--embedded') && target.getClientRects().length === 0) {
      target.closest('.app-shell--mixed')?.querySelector<HTMLButtonElement>('[data-testid="workbench-projects-tab"]')?.click();
      projectFocusFrame.current = requestAnimationFrame(() => {
        projectFocusFrame.current = 0;
        if (target.isConnected) target.focus();
      });
    } else target.focus();
  }

  function setPendingAction(action: PendingAction | null) {
    pendingRef.current = action;
    if (action) pendingReturnFocus.current = action.returnFocus;
    setPending(action);
  }

  function closeUnsaved() {
    unsavedRef.current = null;
    setUnsaved(null);
    setUnsavedError(null);
  }

  function unsavedFailure(input: unknown, copy: string) {
    const cause = input instanceof Error ? input : new Error('The pending action could not continue.');
    setUnsavedError({ error: cause, operation: 'save', copy, previewFailure: false });
  }

  function unsavedCurrent(state: UnsavedState): boolean {
    if (state.invalidated || hasCameraPreview() || session.getSnapshot() !== state.baseline || activeKeyRef.current !== state.projectKey || fileReadToken.current !== state.fileToken || nativeReadToken.current !== state.nativeToken || session.getSnapshot().disposed || controller.getSnapshot().disposed) {
      unsavedRef.current = { ...state, invalidated: true };
      unsavedFailure(new Error('The unsaved scene snapshot or project is stale.'), 'The scene or action changed. Cancel and choose the action again. Your current scene is kept.');
      return false;
    }
    return true;
  }

  function afterDrafts(action: PendingAction) {
    const current = session.getSnapshot();
    const project = projectsRef.current.find(item => item.key === activeKeyRef.current);
    if (action.confirmUnsaved && project?.savedRevision !== current.accepted.revision) {
      const state: UnsavedState = { baseline: current, projectKey: activeKeyRef.current, fileToken: fileReadToken.current,
        nativeToken: nativeReadToken.current, invalidated: false, action: Object.freeze({ ...action }), title: current.accepted.title, downloadStarted: false };
      unsavedReturnFocus.current = action.returnFocus;
      unsavedRef.current = state;
      setUnsaved(state);
      setUnsavedError(null);
      return;
    }
    action.execute();
  }

  function downloadUnsaved() {
    const state = unsavedRef.current;
    if (!state || !unsavedCurrent(state)) return;
    if (!saveAccepted(cause => unsavedFailure(cause, 'The copy could not be downloaded. Your scene is kept. Try Download copy again or Cancel.'))) return;
    if (unsavedRef.current !== state || session.getSnapshot().accepted !== state.baseline.accepted) return;
    const next = { ...state, baseline: session.getSnapshot(), downloadStarted: true };
    unsavedRef.current = next;
    setUnsaved(next);
    setUnsavedError(null);
  }

  function continueUnsaved() {
    const state = unsavedRef.current;
    if (!state || !unsavedCurrent(state)) return;
    closeUnsaved();
    state.action.execute();
  }

  const duplicateTrigger = useRef<HTMLButtonElement>(null);
  const [duplicate, setDuplicate] = useState<RenameState | null>(null);
  const duplicateRef = useRef<RenameState | null>(null);
  const [rawDuplicateTitle, setRawDuplicateTitle] = useState('');
  const [duplicateError, setDuplicateError] = useState<AppErrorNotice | null>(null);

  function cancelDuplicate() {
    duplicateRef.current = null;
    setDuplicate(null);
    setDuplicateError(null);
  }

  function startDuplicate() {
    runGuarded({ label: 'duplicate the scene', confirmUnsaved: true, returnFocus: () => duplicateTrigger.current ?? fileTrigger.current, execute: () => {
      const baseline = session.getSnapshot();
      if (baseline.disposed || controller.getSnapshot().disposed) return;
      const state = { baseline, projectKey: activeKeyRef.current, fileToken: fileReadToken.current, nativeToken: nativeReadToken.current, invalidated: false };
      duplicateRef.current = state;
      setDuplicate(state);
      setRawDuplicateTitle(`${baseline.accepted.title} copy`);
      setDuplicateError(null);
    } });
  }

  function duplicateFailure(input: unknown, copy?: string) {
    const cause = input instanceof Error ? input : new Error('The scene could not be duplicated.');
    setDuplicateError({ error: cause, operation: 'duplicate', previewFailure: controller.getSnapshot().presentationError === cause,
      copy: copy ?? errorCopy(cause, 'duplicate', controller.getSnapshot().presentedRevision, controller.getSnapshot().presentationError === cause) });
  }

  function confirmDuplicate() {
    if (hasCameraPreview()) return;
    const state = duplicateRef.current;
    if (!state) return;
    if (state.invalidated || controller.getSnapshot().disposed || session.getSnapshot().disposed || session.getSnapshot() !== state.baseline || activeKeyRef.current !== state.projectKey || fileReadToken.current !== state.fileToken || nativeReadToken.current !== state.nativeToken) {
      duplicateRef.current = { ...state, invalidated: true };
      duplicateFailure(new Error('The duplicate snapshot or project is stale.'), 'The scene or draft changed. Cancel and reopen Duplicate scene. Your current scene and drafts are kept.');
      return;
    }
    if (typeof rawDuplicateTitle !== 'string' || rawDuplicateTitle.trim().length === 0 || rawDuplicateTitle.length > 256 || [...rawDuplicateTitle].length > 128) return;
    try {
      const documentId = `scene_${crypto.randomUUID().replaceAll('-', '')}`;
      if (projectsRef.current.some(project => project.document.documentId === documentId)) {
        throw new RenderMixedDocumentError('INPUT', 'A workspace document already uses the new document ID.');
      }
      const copied = duplicateRenderMixedDocument(state.baseline.accepted, documentId, rawDuplicateTitle);
      rememberAccepted();
      if (!adopt(copied, 'local', cause => duplicateFailure(cause))) return;
      cancelDuplicate();
      setNotice('Scene duplicated. The original stays in Workspace. Save the copy to keep it.');
    } catch (cause) { duplicateFailure(cause); }
  }

  function cancelRename() {
    renameRef.current = null;
    setRename(null);
    setRenameError(null);
  }

  function startRename() {
    if (hasCameraPreview() || busy || pendingRef.current || nativeImportRef.current || renameRef.current || unsavedRef.current || duplicateRef.current || controller.getSnapshot().disposed || session.getSnapshot().disposed) return;
    const baseline = session.getSnapshot();
    const state = { baseline, projectKey: activeKeyRef.current, fileToken: fileReadToken.current, nativeToken: nativeReadToken.current, invalidated: false };
    renameRef.current = state;
    setRename(state);
    setRawTitle(baseline.draft.title);
    setRenameError(null);
  }

  function useTitle() {
    if (hasCameraPreview()) return;
    const state = renameRef.current;
    if (!state) return;
    if (state.invalidated || controller.getSnapshot().disposed || session.getSnapshot().disposed || session.getSnapshot() !== state.baseline || activeKeyRef.current !== state.projectKey || fileReadToken.current !== state.fileToken || nativeReadToken.current !== state.nativeToken) {
      setRenameError('The scene or draft changed. Cancel and try Rename scene again. Your current drafts are kept.');
      return;
    }
    if (rawTitle.trim().length === 0) { setRenameError('Enter a nonblank title.'); return; }
    if (rawTitle.length > 256 || [...rawTitle].length > 128) { setRenameError('Use a title of 128 characters or fewer.'); return; }
    try {
      session.setDraftTitle(rawTitle);
      cancelRename();
      setNotice('Title staged. Apply to update the scene label.');
    } catch { setRenameError('The title could not be staged. Check it and try again. Your current drafts are kept.'); }
  }

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
    if (hasCameraPreview() || busy || pendingRef.current || nativeImportRef.current || renameRef.current || unsavedRef.current || duplicateRef.current) return;
    const token = ++nativeReadToken.current;
    nativePickerBaseline.current = { token, baseline: session.getSnapshot(), projectKey: activeKeyRef.current };
    if (nativeInput.current) { nativeInput.current.value = ''; nativeInput.current.click(); }
  }

  function nativeBaselineCurrent(state: Pick<NativeImportState, 'token' | 'baseline' | 'projectKey'>): boolean {
    return !hasCameraPreview() && nativeReadToken.current === state.token && session.getSnapshot() === state.baseline && activeKeyRef.current === state.projectKey
      && !controller.getSnapshot().disposed && !session.getSnapshot().disposed;
  }

  function reportStaleNative(cause: unknown) {
    report(cause, 'importNative', 'The scene or draft changed during import. Cancel and import the file again. Your current scene and drafts are unchanged.');
  }

  async function acceptNativeFile(file: File) {
    if (hasCameraPreview() || pendingRef.current || unsavedRef.current || duplicateRef.current) return;
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
    setError({ error: cause, operation, previewFailure, copy: copy ?? (operation === 'edit' && errorCode(cause) === 'INPUT' && session.getSnapshot().sphereInputInvalid
      ? 'Sphere properties need correction. Select Sphere and correct the fields before Apply. Your draft is kept.'
      : errorCopy(cause, operation, controller.getSnapshot().presentedRevision, previewFailure)) });
  }

  function runGuarded(action: PendingAction) {
    if (hasCameraPreview() || busy || pendingRef.current || nativeImportRef.current || renameRef.current || unsavedRef.current || duplicateRef.current) return;
    const current = session.getSnapshot();
    if (current.dirty) { setError(null); setPendingAction(action); }
    else afterDrafts(action);
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
    runGuarded({ label: 'switch project', confirmUnsaved: true, returnFocus: () => projectTriggers.current.get(key) ?? fileTrigger.current, execute: () => { rememberAccepted(); activate(key); } });
  }

  function adopt(document: RenderMixedDocumentV1, origin: WorkspaceProject['origin'], onRefusal?: (error: RenderMixedDocumentError) => void): boolean {
    const result = controller.open(serializeRenderMixedDocument(document));
    if (!result.ok) { if (onRefusal) onRefusal(result.error); else report(result.error, origin === 'file' ? 'open' : 'project'); return false; }
    const key = `${document.documentId}-${crypto.randomUUID().slice(0, 8)}`;
    updateProjects([...projectsRef.current, { key, document, origin, savedRevision: origin === 'file' ? document.revision : null }]);
    activeKeyRef.current = key;
    setActiveKey(key);
    replaceProjectRoute(key);
    setError(null);
    setNotice(origin === 'file' ? `Opened ${document.title} from file.` : 'Created a mixed scene from the Sphere and Surface profile.');
    return true;
  }

  function newDocument() {
    runGuarded({ label: 'create a scene', confirmUnsaved: true, returnFocus: () => newTrigger.current ?? fileTrigger.current, execute: () => {
      rememberAccepted();
      adopt(createNewMixedDocument(`scene_${crypto.randomUUID().slice(0, 8)}`), 'local');
    } });
  }

  function openFile() {
    runGuarded({ label: 'open a file', confirmUnsaved: true, returnFocus: () => openTrigger.current ?? fileTrigger.current, execute: () => fileInput.current?.click() });
  }

  async function acceptFile(file: File) {
    if (hasCameraPreview() || pendingRef.current || unsavedRef.current || duplicateRef.current) return;
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
      if (hasCameraPreview() || session.getSnapshot() !== readSnapshot || activeKeyRef.current !== readProjectKey) {
        report(new Error('The scene changed while the file was being read. Open the file again. The current scene and draft are retained.'), 'open', 'The scene changed while the file was read. The current scene and draft are unchanged. Open the file again.');
        return;
      }
      const document = parseRenderMixedDocument(text);
      rememberAccepted();
      adopt(document, 'file');
    } catch (error) { if (token === fileReadToken.current) report(error, 'open', file.size > RENDER_MIXED_DOCUMENT_LIMITS.fileBytes ? 'The file is too large. Choose a scene file of 512 KiB or less. The current scene is unchanged.' : undefined); }
    finally { if (token === fileReadToken.current) setBusy(false); }
  }

  function saveAccepted(onFailure?: (error: unknown) => void): boolean {
    if (hasCameraPreview()) return false;
    try {
      const baseline = session.getSnapshot();
      const accepted = baseline.accepted;
      downloadMixedFile(accepted);
      if (session.getSnapshot() !== baseline) throw new Error('The scene changed during download initiation.');
      session.markSaved(accepted.revision);
      updateProjects(projectsRef.current.map((project) => project.key === activeKeyRef.current ? { ...project, document: accepted, savedRevision: accepted.revision } : project));
      setError(null);
      setNotice('Download started.');
      return true;
    } catch (error) { if (onFailure) onFailure(error); else report(error, 'save'); return false; }
  }

  function saveFile() { runGuarded({ label: 'save the file', returnFocus: () => fileTrigger.current, execute: saveAccepted }); }

  function history(direction: 'undo' | 'redo') {
    if (hasCameraPreview() || pendingRef.current || unsavedRef.current || duplicateRef.current) return;
    const result = controller[direction]();
    if (!result.ok) report(result.error, 'history');
    else { setError(null); setNotice(direction === 'undo' ? 'Undo applied to the viewport.' : 'Redo applied to the viewport.'); }
  }

  function applyPending() {
    if (hasCameraPreview()) return;
    if (!pending) return;
    const result = controller.apply();
    if (!result.ok) { report(result.error, 'edit'); return; }
    const action = pending;
    setPendingAction(null);
    afterDrafts(action);
  }

  function discardPending() {
    if (hasCameraPreview()) return;
    if (!pending) return;
    session.discardDraft();
    const action = pending;
    setPendingAction(null);
    afterDrafts(action);
  }

  useEffect(() => {
    const wasDirty = previousDirty.current;
    previousDirty.current = snapshot.dirty;
    if (wasDirty && !snapshot.dirty) setError(notice => notice?.operation === 'edit' ? null : notice);
  }, [snapshot.dirty]);

  useEffect(() => {
    if (presentation.presentationError === null) {
      setError((notice) => notice?.previewFailure ? null : notice);
    }
  }, [presentation.presentationError]);

  useEffect(() => {
    setError((notice) => notice && ['edit', 'history'].includes(notice.operation) ? null : notice);
    const accepted = snapshot.accepted;
    const cached = projectsRef.current.find(project => project.key === activeKeyRef.current);
    if (cached && cached.document !== accepted) {
      updateProjects(projectsRef.current.map(project => project.key === activeKeyRef.current ? { ...project, document: accepted } : project));
    }
  }, [snapshot.accepted]);

  useEffect(() => {
    replaceProjectRoute(activeKeyRef.current);
    const release = () => { if (projectFocusFrame.current) cancelAnimationFrame(projectFocusFrame.current); projectFocusFrame.current = 0; fileReadToken.current += 1; nativeReadToken.current += 1; nativePickerBaseline.current = null; controller.dispose(); session.dispose(); };
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
      if (unsavedRef.current) {
        unsavedRef.current = { ...unsavedRef.current, invalidated: true };
        unsavedFailure(new Error('Project navigation invalidated the unsaved action.'), 'Project navigation changed. Cancel and choose the action again. Your current scene is kept.');
      }
      if (duplicateRef.current) {
        duplicateRef.current = { ...duplicateRef.current, invalidated: true };
        duplicateFailure(new Error('Project navigation invalidated the duplicate dialog.'), 'Project navigation changed. Cancel and reopen Duplicate scene. Your current scene and drafts are kept.');
      }
      if (renameRef.current) {
        renameRef.current = { ...renameRef.current, invalidated: true };
        setRenameError('Project navigation changed during rename. Cancel and try Rename scene again. Your current drafts are kept.');
      }
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
      if (hasCameraPreview() && !event.isComposing && (event.metaKey || event.ctrlKey) && ['n', 'o', 's', 'z'].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
      if (event.isComposing || event.defaultPrevented || pendingRef.current || busy || nativeImportRef.current || renameRef.current || unsavedRef.current || duplicateRef.current || !(event.metaKey || event.ctrlKey)) return;
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
  const cameraPending = Boolean(presentation.cameraPreview);
  const actionDisabled = cameraPending || busy || pending !== null || nativeImport !== null || rename !== null || unsaved !== null || duplicate !== null;
  const duplicateTitleError = rawDuplicateTitle.trim().length === 0 ? 'Enter a nonblank title.' : rawDuplicateTitle.length > 256 || [...rawDuplicateTitle].length > 128 ? 'Use a title of 128 characters or fewer.' : null;
  const titleDirty = snapshot.draft.title !== snapshot.accepted.title;
  const titleValidationError = rawTitle.trim().length === 0 ? 'Enter a nonblank title.' : rawTitle.length > 256 || [...rawTitle].length > 128 ? 'Use a title of 128 characters or fewer.' : null;
  const titleError = renameError ?? titleValidationError;
  const nativeReplacementRequired = nativeImport !== null && (
    nativeImport.baseline.draft.asset.source !== nativeImport.baseline.accepted.asset.source
    || nativeImport.baseline.draft.asset.modelId !== nativeImport.baseline.accepted.asset.modelId
    || nativeImport.baseline.draft.asset.surfaceId !== nativeImport.baseline.accepted.asset.surfaceId
  );
  const previewUnavailable = presentation.presentedRevision === null;
  const previewRefused = presentation.presentationError !== null;
  const canRestorePreview = previewUnavailable && previewRefused && !presentation.disposed;
  const previewStatus = presentation.disposed ? 'Preview closed' : cameraPending ? 'View preview' : previewUnavailable ? previewRefused ? 'Preview unavailable' : 'Opening preview…' : previewRefused ? 'Preview unchanged' : 'Preview ready';

  const projectBrowser = (
        <aside className="app-projects app-projects--embedded" aria-label="Workspace projects">
          <div className="app-sidebar-heading"><Grid2X2 size={14} /><span>Workspace</span><Button ref={newTrigger} variant="ghost" size="icon-xs" aria-label="New mixed scene" disabled={actionDisabled} onClick={newDocument}><FilePlus2 /></Button></div>
          <nav aria-label="Projects">
            {projects.map((project) => <button ref={element => { if (element) projectTriggers.current.set(project.key, element); else projectTriggers.current.delete(project.key); }} className={`app-project ${project.key === activeKey ? 'is-active' : ''}`} key={project.key} data-testid={`project-${project.document.documentId}`} disabled={actionDisabled} aria-current={project.key === activeKey ? 'page' : undefined} onClick={() => switchProject(project.key)}>
              <FileCode2 size={14} /><span>{project.document.title}</span><ChevronRight size={12} />
            </button>)}
          </nav>
          <div className="app-sidebar-note"><span>Local workspace</span><p>Projects stay in this tab. Save files to keep them after closing.</p></div>
        </aside>
  );

  return (
    <main className="app-shell app-shell--mixed" data-testid="render-mixed-editor-app">
      <header className="app-topbar">
        <div className="app-brand"><Box size={20} strokeWidth={1.5} /><strong>BaroCSS</strong><span>Mixed Editor</span></div>
        <Menubar className="app-menubar" aria-label="Application menu">
          <MenubarMenu><MenubarTrigger ref={fileTrigger}>File</MenubarTrigger><MenubarContent>
            <MenubarItem data-testid="menu-new" disabled={actionDisabled} onSelect={newDocument}><FilePlus2 />New mixed scene<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={actionDisabled} onSelect={startDuplicate}>Duplicate scene</MenubarItem>
            <MenubarItem data-testid="menu-open" disabled={actionDisabled} onSelect={openFile}><FolderOpen />Open file…<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={actionDisabled} onSelect={startNativeImport}>Import CAD source</MenubarItem>
            <MenubarSeparator />
            <MenubarItem data-testid="menu-save" disabled={actionDisabled} onSelect={saveFile}><Save />Save file<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
            <MenubarItem disabled={actionDisabled} onSelect={startRename}>Rename scene</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled={!snapshot.canUndo || actionDisabled} onSelect={() => history('undo')}><Undo2 />Undo<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={!snapshot.canRedo || actionDisabled} onSelect={() => history('redo')}><Redo2 />Redo<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
            <MenubarSeparator /><MenubarItem disabled={!dirty || actionDisabled} onSelect={() => { session.discardDraft(); setError(notice => notice?.operation === 'edit' ? null : notice); }}>Discard draft</MenubarItem>
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger>Workspace</MenubarTrigger><MenubarContent>
            {projects.map((project) => <MenubarItem key={project.key} disabled={actionDisabled} onSelect={() => switchProject(project.key)}>{project.document.title}</MenubarItem>)}
          </MenubarContent></MenubarMenu>
          <MenubarMenu><MenubarTrigger ref={helpTrigger}>Help</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => { setHelpTopic('mixed'); setHelpOpen(true); }}>Mixed scene editing</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('native'); setHelpOpen(true); }}>Native source import</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('position'); setHelpOpen(true); }}>Surface position</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('inspector'); setHelpOpen(true); }}>Object inspector</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('rename'); setHelpOpen(true); }}>Rename scene</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('unsaved'); setHelpOpen(true); }}>Unsaved scene</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('point'); setHelpOpen(true); }}>Source point</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('duplicate'); setHelpOpen(true); }}>Duplicate scene</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('camera'); setHelpOpen(true); }}>Camera controls</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('sphere'); setHelpOpen(true); }}>Sphere properties</MenubarItem><MenubarItem onSelect={() => { setHelpTopic('layout'); setHelpOpen(true); }}>Editor layout</MenubarItem></MenubarContent></MenubarMenu>
        </Menubar>
        <div className="app-topbar-spacer" />
        <Button size="sm" variant="ghost" asChild><a ref={sourceTrigger} href="/index.html" aria-label="GPU Scene editor" title="GPU Scene editor" onClick={event => {
          if (hasCameraPreview()) { event.preventDefault(); return; }
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          runGuarded({ label: 'open GPU Scene editor', confirmUnsaved: true, returnFocus: () => sourceTrigger.current ?? fileTrigger.current, execute: () => window.location.assign('/index.html') });
        }}><Box size={14} /><span>GPU Scene editor</span></a></Button>
        <Button ref={duplicateTrigger} size="icon-sm" variant="ghost" aria-label="Duplicate scene" title="Duplicate scene" disabled={duplicate === null && (cameraPending || busy || pending !== null || nativeImport !== null || rename !== null || unsaved !== null)} onClick={startDuplicate} data-testid="duplicate-scene"><Copy size={14} /></Button>
        <Button ref={nativeImportTrigger} size="sm" variant="ghost" aria-label="Import CAD source" title="Import CAD source" disabled={cameraPending || busy || pending !== null || rename !== null || unsaved !== null || duplicate !== null} onClick={startNativeImport} data-testid="import-native-source"><FolderOpen size={14} /><span>Import CAD</span></Button>
        <Button ref={openTrigger} size="sm" variant="ghost" disabled={actionDisabled} onClick={openFile} data-testid="open-file"><FolderOpen />Open</Button>
        <Button size="sm" variant="default" disabled={actionDisabled} onClick={saveFile} data-testid="save-file"><Save />Save</Button>
      </header>

      <div className="app-body">
        <section className="app-workspace" aria-label="Mixed scene editor" aria-busy={busy}>
          <div className="app-document-bar"><div><h1 data-testid="document-title">{snapshot.accepted.title}</h1></div><span className="app-document-state" data-testid={titleDirty ? 'draft-title' : undefined}>{titleDirty ? `Title draft: ${snapshot.draft.title}` : dirty ? 'Draft changes' : activeProject?.origin === 'example' && downloaded ? 'Example' : downloaded ? 'File opened / downloaded' : 'Not downloaded'}</span>
            <Button ref={renameTrigger} size="icon-sm" variant="ghost" aria-label="Rename scene" title="Rename scene" disabled={rename === null && (cameraPending || busy || pending !== null || nativeImport !== null || unsaved !== null || duplicate !== null)} onClick={startRename} data-testid="rename-scene"><Pencil size={14} /></Button>
            <div className="app-history"><Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.canUndo || actionDisabled} onClick={() => history('undo')}><Undo2 /></Button><Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.canRedo || actionDisabled} onClick={() => history('redo')}><Redo2 /></Button></div>
          </div>
          {error && !pending && !nativeImport && !rename && !unsaved && !duplicate ? <div className="app-error" role="alert" data-testid="app-error"><div><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div><button aria-label="Dismiss error" onClick={() => setError(null)}>×</button></div> : null}
          <RenderMixedEditor controller={controller} projectBrowser={projectBrowser} onCameraHelp={() => { setHelpTopic('camera'); setHelpOpen(true); }} onSphereHelp={() => { setHelpTopic('sphere'); setHelpOpen(true); }} onError={(error: RenderMixedDocumentError) => {
            if (controller.getSnapshot().presentationError === error || session.getSnapshot().diagnostics === error) { setError(notice => notice && ['edit', 'history', 'restore'].includes(notice.operation) ? null : notice); return; }
            report(error, 'edit', error.message === 'The camera move could not be previewed.' ? 'The camera move could not be previewed. Try a smaller move. Your scene and drafts are kept.' : undefined);
          }} />
        </section>
      </div>

      <footer className="app-status" aria-live="polite">
        <span className={`app-status-dot ${previewRefused ? previewUnavailable ? 'has-error' : 'has-warning' : ''}`} />
        <span data-testid="app-status">{busy ? 'Reading file…' : cameraPending || previewRefused || previewUnavailable || presentation.disposed ? previewStatus : notice}</span>
        <span className="app-status-spacer" />
        {canRestorePreview ? <Button variant="ghost" size="xs" onClick={() => { if (hasCameraPreview() || pendingRef.current || unsavedRef.current || duplicateRef.current) return; const result = controller.recover(); if (!result.ok) report(result.error, 'restore'); }}><RotateCcw />Restore preview</Button> : null}
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

      <Dialog open={rename !== null} onOpenChange={open => { if (!open) cancelRename(); }}>
        <DialogContent showCloseButton={false} data-testid="rename-dialog" onCloseAutoFocus={event => { event.preventDefault(); renameTrigger.current?.focus(); }}><DialogHeader>
          <DialogTitle>Rename scene</DialogTitle>
          <DialogDescription>Use title stages the new label. Apply updates the scene.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-2 text-sm"><span>Title</span><input type="text" aria-label="Title" className="rounded-md border border-input bg-background p-2" value={rawTitle} aria-invalid={titleError !== null} aria-describedby={titleError ? 'rename-error' : undefined} onChange={event => { setRawTitle(event.currentTarget.value); if (!renameRef.current?.invalidated) setRenameError(null); }} /></label>
        {titleError ? <p id="rename-error" role="alert" data-testid="rename-error" className="app-dialog-error">{titleError}</p> : null}
        <details><summary className="cursor-pointer text-sm">Help</summary><div className="mt-3"><RenameSceneHelp /></div></details>
        <DialogFooter><Button variant="ghost" onClick={cancelRename} data-testid="rename-cancel">Cancel</Button><Button disabled={titleValidationError !== null || renameRef.current?.invalidated === true} onClick={useTitle} data-testid="rename-use">Use title</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicate !== null} onOpenChange={open => { if (!open) cancelDuplicate(); }}>
        <DialogContent showCloseButton={false} data-testid="duplicate-dialog" onCloseAutoFocus={event => { event.preventDefault(); duplicateTrigger.current?.focus(); }}><DialogHeader>
          <DialogTitle>Duplicate scene</DialogTitle>
          <DialogDescription>Create a separate scene from the applied document. The original stays in Workspace.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-2 text-sm"><span>Title</span><input type="text" aria-label="Title" data-testid="duplicate-title" className="rounded-md border border-input bg-background p-2" value={rawDuplicateTitle} aria-invalid={duplicateError !== null || duplicateTitleError !== null} aria-describedby={duplicateError || duplicateTitleError ? 'duplicate-error' : undefined} onChange={event => { setRawDuplicateTitle(event.currentTarget.value); if (!duplicateRef.current?.invalidated) setDuplicateError(null); }} /></label>
        {duplicateError ? <div id="duplicate-error" role="alert" data-testid="duplicate-error" className="app-dialog-error"><p>{duplicateError.copy}</p><AppErrorDetails key={duplicateError.error.message} notice={duplicateError} /></div> : duplicateTitleError ? <p id="duplicate-error" role="alert" data-testid="duplicate-error" className="app-dialog-error">{duplicateTitleError}</p> : null}
        <details><summary className="cursor-pointer text-sm">Help</summary><div className="mt-3"><DuplicateSceneHelp /></div></details>
        <DialogFooter><Button variant="ghost" onClick={cancelDuplicate} data-testid="duplicate-cancel">Cancel</Button><Button disabled={duplicateTitleError !== null || duplicateRef.current?.invalidated === true} onClick={confirmDuplicate} data-testid="duplicate-confirm">Duplicate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unsaved !== null} onOpenChange={open => { if (!open) closeUnsaved(); }}>
        <DialogContent showCloseButton={false} data-testid="unsaved-dialog" onCloseAutoFocus={event => { event.preventDefault(); restoreActionFocus(unsavedReturnFocus.current); }}><DialogHeader>
          <DialogTitle>Unsaved scene</DialogTitle>
          <DialogDescription>Choose how to keep “{unsaved?.title}” before you {unsaved?.action.label}.</DialogDescription>
        </DialogHeader>
        {unsaved?.downloadStarted ? <p role="status" data-testid="unsaved-status" className="text-sm text-muted-foreground">Download started. Check the file, then choose Continue when ready.</p> : null}
        {unsavedError ? <div role="alert" data-testid="unsaved-error" className="app-dialog-error"><p>{unsavedError.copy}</p><AppErrorDetails key={unsavedError.error.message} notice={unsavedError} /></div> : null}
        <details><summary className="cursor-pointer text-sm">Help</summary><div className="mt-3"><UnsavedSceneHelp /></div></details>
        <DialogFooter className="sm:flex-wrap"><Button variant="ghost" onClick={closeUnsaved} data-testid="unsaved-cancel">Cancel</Button><Button variant="secondary" disabled={unsavedRef.current?.invalidated === true} onClick={downloadUnsaved} data-testid="unsaved-download">Download copy</Button><Button disabled={unsavedRef.current?.invalidated === true} onClick={continueUnsaved} data-testid="unsaved-continue">{unsaved?.downloadStarted ? 'Continue' : 'Continue without downloading'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <DialogContent showCloseButton={false} data-testid="draft-dialog" onCloseAutoFocus={event => { event.preventDefault(); if (!unsavedRef.current && !duplicateRef.current) restoreActionFocus(pendingReturnFocus.current); }}><DialogHeader>
          <DialogTitle>Resolve draft changes</DialogTitle>
          <DialogDescription>Apply or discard your title, source, camera, and display drafts before you {pending?.label}. Apply must succeed in the preview to continue. Cancel keeps the draft.</DialogDescription>
        </DialogHeader>{error ? <div role="alert" className="app-dialog-error" data-testid="app-error"><p>{error.copy}</p><AppErrorDetails key={error.error.message} notice={error} /></div> : null}<DialogFooter>
          <Button variant="ghost" onClick={() => setPendingAction(null)} data-testid="draft-cancel">Cancel</Button>
          <Button variant="secondary" onClick={discardPending} data-testid="draft-discard">Discard</Button>
          <Button onClick={applyPending} data-testid="draft-apply">Apply and continue</Button>
        </DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); helpTrigger.current?.focus(); }}><DialogHeader><DialogTitle>{helpTopic === 'native' ? 'Native source import' : helpTopic === 'position' ? 'Surface position' : helpTopic === 'inspector' ? 'Object inspector' : helpTopic === 'rename' ? 'Rename scene' : helpTopic === 'unsaved' ? 'Unsaved scene' : helpTopic === 'point' ? 'Source point' : helpTopic === 'duplicate' ? 'Duplicate scene' : helpTopic === 'camera' ? 'Camera controls' : helpTopic === 'sphere' ? 'Sphere properties' : helpTopic === 'layout' ? 'Editor layout' : 'Mixed scene editing'}</DialogTitle><DialogDescription>{helpTopic === 'native' ? 'Choose an original CAD source and a Surface, then stage it for Apply.' : helpTopic === 'position' ? 'Place the displayed Surface without changing the original CAD source.' : helpTopic === 'inspector' ? 'Choose an object row to show its editing controls.' : helpTopic === 'rename' ? 'Change the scene label, then Apply the complete draft.' : helpTopic === 'unsaved' ? 'Keep a file copy before you leave the applied scene.' : helpTopic === 'point' ? 'Inspect the applied Surface at its original U and V parameters.' : helpTopic === 'duplicate' ? 'Create an independent workspace scene from the applied document.' : helpTopic === 'camera' ? 'Preview a camera move, then choose Use view or Cancel view.' : helpTopic === 'sphere' ? 'Edit the Sphere fields, then Apply the complete draft.' : helpTopic === 'layout' ? 'Arrange the workspace around the scene you are editing.' : 'Edit either original source, the camera, or the display settings. Apply updates the complete preview together.'}</DialogDescription></DialogHeader>{helpTopic === 'native' ? <NativeImportHelp /> : helpTopic === 'position' ? <SurfacePositionHelp /> : helpTopic === 'inspector' ? <ObjectInspectorHelp /> : helpTopic === 'rename' ? <RenameSceneHelp /> : helpTopic === 'unsaved' ? <UnsavedSceneHelp /> : helpTopic === 'point' ? <SourcePointHelp /> : helpTopic === 'duplicate' ? <DuplicateSceneHelp /> : helpTopic === 'camera' ? <CameraControlsHelp /> : helpTopic === 'sphere' ? <SpherePropertiesHelp /> : helpTopic === 'layout' ? <EditorLayoutHelp /> : <div className="space-y-3 text-sm text-muted-foreground"><p>This profile displays one scene Sphere and one selected native Surface with shared depth. Other native objects stay in the original source and inventory. Curves are kept in the file and are not drawn in this preview.</p><p>The native source uses millimeters. Display conversion and translation place it in scene units. Camera field of view uses degrees. Native display settings do not change the original control points, weights, or UV definition.</p><p>New starts from a valid Sphere and Surface sample. Workspace contains two source pairs. Use GPU Scene editor for the broader scene object editor and its version 0 files.</p><p>Save downloads accepted version 1 mixed JSON, including both original sources, selected model and Surface, camera, and display values. Open accepts mixed scene files up to 512 KiB, with each source no larger than 64 KiB.</p><p>Projects stay in this tab. Save a file before closing. Downloads depend on browser settings; check the downloaded file. CAD materials, Physics, precise picking, and additional mixed shapes are outside this profile.</p></div>}</DialogContent></Dialog>
    </main>
  );
}
