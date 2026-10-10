import { useEffect, useRef, useState } from 'react';
import { Box, Download, FolderOpen, Maximize, Redo2, Spline, Undo2 } from 'lucide-react';
import { DrivenMixedSketchLinesError, evaluateDrivenMixedSketchLines, parseDrivenMixedSketchLines, validateDrivenMixedSketchLines,
  type DrivenMixedSketchLinesDocumentV0, type DrivenMixedSketchLinesResult } from '@barocss/cad';
import { CadEditorError, createCadEditorDrivingSketchSession, type CadEditorDrivingSketchSnapshot } from '@barocss/cad-editor';
import { CadEditorDrivingSketchEditor, type CadEditorDrivingSketchDisplayOptions,
  type CadEditorDrivingSketchDisplayReceipt, type CadEditorDrivingSketchFrameReceipt } from '@barocss/cad-editor/react';
import fixture from '../fixtures/driving-oblique-whole.authored-sketch.json?raw';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted } from './file-actions';
import { MAXIMUM_DRIVING_FILE_BYTES, readCadDrivingSketchFile } from './driving-file-actions';

interface FileTarget { text: string; filename: string; anchor: string; navigation: number; intent: number; profileId: string }
interface ProfileChoice { target: FileTarget; profiles: { id: string; kind: string }[] }
function snapshotAnchor(snapshot: CadEditorDrivingSketchSnapshot) {
  return JSON.stringify([snapshot.accepted.document.id, snapshot.generation, snapshot.displayGeneration,
    snapshot.view, snapshot.selection, snapshot.pending, snapshot.disposed]);
}
function fileError(cause: unknown, message: string, field = 'driving-file') {
  return cause instanceof CadEditorError ? cause : new CadEditorError('FILE', message, { field }, cause);
}
function nativeDiagnostic(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error) || depth >= 6) return null;
  const value = error as Error & { code?: unknown; context?: unknown; solverDiagnostics?: unknown };
  return { name: value.name, code: value.code ?? null, message: value.message, context: value.context ?? null,
    solverDiagnostics: value.solverDiagnostics === undefined ? null : structuredClone(value.solverDiagnostics),
    cause: nativeDiagnostic(value.cause, depth + 1) };
}
function errorText(error: CadEditorError) {
  if (error.code === 'STALE') return 'The Sketch or view changed. Review the pending values.';
  if (error.code === 'BUDGET') return 'This file or change exceeds a supported limit.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The accepted Sketch is retained.';
  if (error.code === 'FILE') return 'Open a native driving Sketch file.';
  return 'Cannot apply this constraint. Review its points and values.';
}
const profileLabel = (kind: string) => (({ line: 'Line', polyline: 'Polyline', arc: 'Arc', rectangle: 'Rectangle' } as Record<string, string>)[kind] ?? kind);

export function DrivingSketchApp() {
  const [flowMode] = useState(() => new URLSearchParams(location.search).has('flow'));
  const [displayOptions] = useState<CadEditorDrivingSketchDisplayOptions>(() => ({
    viewer: { mmToSceneUnit: new URLSearchParams(location.search).has('flow')
      && Number(new URLSearchParams(location.search).get('drivingScale')) === 0.2 ? 0.2 : 0.01,
      background: [0.07, 0.08, 0.10] }, native: { basis: 'authored-xyz-matches-rhyup' },
  }));
  const [session] = useState(() => {
    const created = createCadEditorDrivingSketchSession(parseDrivenMixedSketchLines(fixture), { initialProfileId: 'line_profile' });
    created.selectPoint('line_profile', 'line_end'); return created;
  });
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
  const [display, setDisplay] = useState<CadEditorDrivingSketchDisplayReceipt | null>(null);
  const [frame, setFrame] = useState<CadEditorDrivingSketchFrameReceipt | null>(null);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [filename, setFilename] = useState('Driving Sketch');
  const [reading, setReading] = useState(false), [captured, setCaptured] = useState(false);
  const [replacement, setReplacement] = useState<FileTarget | null>(null);
  const [profileChoice, setProfileChoice] = useState<ProfileChoice | null>(null), [incomingProfile, setIncomingProfile] = useState('');
  const [fitRequest, setFitRequest] = useState(0), [readRequest, setReadRequest] = useState(0);
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Set<number>()), fileBusy = useRef(false);
  const decision = useRef<FileTarget | null>(null), choice = useRef<ProfileChoice | null>(null);
  const opening = useRef<{ token: string; filename: string } | null>(null);
  const navigation = useRef(0), intent = useRef(0);

  function hasCapture() {
    return [...pointers.current].some(id => [document.documentElement, ...document.querySelectorAll('*')]
      .some(element => element.hasPointerCapture(id)));
  }
  function visible() { return !!root.current?.isConnected && root.current.getClientRects().length > 0
    && location.hash.startsWith('#/sketches/'); }
  function activeSurface(allowDecision = false, allowProfile = false) {
    return [...document.querySelectorAll('[role="dialog"],[role="menu"]')].some(element => {
      if (!element.isConnected || !element.getClientRects().length || element.getAttribute('data-state') === 'closed') return false;
      const id = element.getAttribute('data-testid');
      return !((allowDecision && id === 'driving-replacement-dialog') || (allowProfile && id === 'driving-profile-dialog'));
    });
  }
  function blocked(allowDecision = false) {
    const current = session.getSnapshot();
    return !visible() || current.disposed || current.candidate !== null || fileBusy.current || hasCapture()
      || (!allowDecision && (decision.current !== null || choice.current !== null)) || activeSurface(allowDecision);
  }
  function hasDraft() { return Object.keys(session.getSnapshot().pending.fields).length > 0; }
  function fitReady() {
    const current = session.getSnapshot();
    return display !== null && display.state.status === 'ready'
      && display.generation === current.generation && display.displayGeneration === current.displayGeneration
      && display.view.profileId === current.view.profileId
      && !!root.current?.querySelector('[data-driving-ready="true"]');
  }
  function syncMarker() {
    if (fileBusy.current || decision.current || choice.current) root.current?.setAttribute('data-driving-host-busy', 'true');
    else root.current?.removeAttribute('data-driving-host-busy');
  }
  function clearDecision() { decision.current = null; choice.current = null; setReplacement(null); setProfileChoice(null); setIncomingProfile(''); syncMarker(); }
  function run(action: () => unknown, emptyDraft = false) {
    if (blocked() || emptyDraft && hasDraft()) return;
    try { setError(null); action(); } catch (cause) { setError(fileError(cause, 'The Sketch action failed.')); }
  }
  function menuAction(action: () => void) {
    // Radix closes its menu after onSelect. Native actions use the same live guard after it unmounts.
    const before = snapshotAnchor(session.getSnapshot()), epoch = navigation.current;
    let frames = 0;
    const waitForClose = () => {
      if (!visible() || epoch !== navigation.current || snapshotAnchor(session.getSnapshot()) !== before) return;
      if (document.querySelector('[role="menu"]')) { if (++frames < 8) requestAnimationFrame(waitForClose); return; }
      if (!activeSurface()) action();
    };
    requestAnimationFrame(waitForClose);
  }
  function assertFresh(target: FileTarget) {
    const current = session.getSnapshot();
    if (!visible() || target.navigation !== navigation.current || target.intent !== intent.current || current.disposed
      || current.candidate || snapshotAnchor(current) !== target.anchor || hasCapture())
      throw new CadEditorError('STALE', 'The Sketch or route changed. Open the file again.', { field: 'driving-open' });
  }
  function prepareTarget(target: FileTarget) {
    assertFresh(target);
    const candidate = session.prepareOpen(target.text, { initialProfileId: target.profileId });
    opening.current = { token: candidate.token, filename: target.filename };
  }
  function queueReplacement(target: FileTarget) {
    assertFresh(target);
    if (session.getSnapshot().dirty) { decision.current = target; setReplacement(target); syncMarker(); }
    else prepareTarget(target);
  }
  function receive(text: string, filename: string, before: string, epoch: number, fileIntent: number) {
    if (text.length > MAXIMUM_DRIVING_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAXIMUM_DRIVING_FILE_BYTES)
      throw new CadEditorError('BUDGET', 'Driving Sketch files are limited to 262144 bytes and code units.', { field: 'driving-open' });
    let document: DrivenMixedSketchLinesDocumentV0, evaluated: DrivenMixedSketchLinesResult;
    try { document = parseDrivenMixedSketchLines(text); evaluated = evaluateDrivenMixedSketchLines(document); validateDrivenMixedSketchLines(evaluated); }
    catch (cause) {
      if (cause instanceof DrivenMixedSketchLinesError) throw new CadEditorError(cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE',
        'The native driving Sketch recipe was refused.', { field: 'driving-open' }, cause);
      throw cause;
    }
    const target: FileTarget = { text, filename, anchor: before, navigation: epoch, intent: fileIntent, profileId: 'line_profile' };
    assertFresh(target);
    if (!document.seed.profiles.some(profile => profile.id === target.profileId)) {
      const pendingChoice = { target, profiles: evaluated.target.profiles.map(profile => ({ id: profile.profileId, kind: profile.kind })) };
      choice.current = pendingChoice; setProfileChoice(pendingChoice); setIncomingProfile(''); syncMarker();
    } else queueReplacement(target);
  }
  async function openFile(file: File | undefined) {
    if (!file || blocked() || hasDraft()) return;
    const before = snapshotAnchor(session.getSnapshot()), epoch = navigation.current, fileIntent = ++intent.current;
    fileBusy.current = true; syncMarker(); setReading(true); setError(null);
    try { receive(await readCadDrivingSketchFile(file), file.name, before, epoch, fileIntent); }
    catch (cause) { opening.current = null; setError(fileError(cause, 'Cannot open this driving Sketch.')); }
    finally { fileBusy.current = false; setReading(false); syncMarker(); }
  }
  function newSample() {
    run(() => receive(fixture, 'Driving Sketch', snapshotAnchor(session.getSnapshot()), navigation.current, ++intent.current), true);
  }
  function confirmProfile() {
    const current = choice.current;
    if (!current || !visible() || fileBusy.current || hasCapture() || activeSurface(false, true) || session.getSnapshot().candidate
      || !current.profiles.some(profile => profile.id === incomingProfile)) return;
    try {
      assertFresh(current.target); const target = { ...current.target, profileId: incomingProfile };
      choice.current = null; setProfileChoice(null); setIncomingProfile(''); syncMarker(); queueReplacement(target);
    } catch (cause) { setError(fileError(cause, 'Cannot select this incoming profile.')); }
  }
  function continueReplacement() {
    const target = decision.current; if (!target || blocked(true)) return;
    try { assertFresh(target); prepareTarget(target); clearDecision(); }
    catch (cause) { clearDecision(); setError(fileError(cause, 'Cannot replace this driving Sketch.')); }
  }
  function downloadBeforeReplacement() {
    if (!decision.current || blocked(true)) return;
    try { assertFresh(decision.current); downloadAccepted(session); }
    catch (cause) { setError(fileError(cause, 'Cannot download this driving Sketch.', 'driving-download')); }
  }
  const draft = Object.keys(snapshot.pending.fields).length > 0;
  const busy = snapshot.disposed || !!snapshot.candidate || reading || captured || !!replacement || !!profileChoice;

  useEffect(() => session.subscribe(setSnapshot), [session]);
  useEffect(() => () => session.dispose(), [session]);
  useEffect(() => {
    const changed = () => { navigation.current++; clearDecision(); };
    window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
  }, [session]);
  useEffect(() => {
    let live = true;
    const refresh = () => { if (live) setCaptured(hasCapture()); };
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); setTimeout(refresh, 0); };
    const release = (event: PointerEvent) => {
      if (!hasCapture()) pointers.current.delete(event.pointerId);
      refresh(); setTimeout(() => { if (!live) return; if (![document.documentElement, ...document.querySelectorAll('*')]
        .some(element => element.hasPointerCapture(event.pointerId))) pointers.current.delete(event.pointerId); refresh(); }, 0);
    };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true);
    return () => { live = false; pointers.current.clear(); window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true); };
  }, [session]);
  useEffect(() => {
    if (!flowMode) return;
    const hook = { session, snapshot: () => session.getSnapshot(), display: () => structuredClone(display), frame: () => structuredClone(frame),
      displayOptions: () => structuredClone(displayOptions), error: () => nativeDiagnostic(error), readFrame: () => setReadRequest(value => value + 1) };
    Object.assign(window, { __cadDrivingFlow: hook });
    return () => { const target = window as Window & { __cadDrivingFlow?: unknown }; if (target.__cadDrivingFlow === hook) delete target.__cadDrivingFlow; };
  }, [session, display, frame, displayOptions, error, flowMode]);

  return <div ref={root} className="cad-app" data-driving-host-busy={reading || replacement || profileChoice ? 'true' : undefined}>
    <header className="app-header"><a className="app-brand" href="#/sketches/driving_lines_document" onClick={event => { if (blocked()) event.preventDefault(); }}><Box size={20}/><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger disabled={busy}>File</MenubarTrigger><MenubarContent>
        <MenubarItem data-testid="driving-new" disabled={busy || draft} onSelect={() => menuAction(newSample)}>New driving Sketch</MenubarItem>
        <MenubarItem disabled={busy || draft} onSelect={() => menuAction(() => run(() => input.current?.click(), true))}>Open native Sketch…</MenubarItem>
        <MenubarItem disabled={busy} onSelect={() => menuAction(() => run(() => downloadAccepted(session)))}>Download accepted Sketch</MenubarItem>
        <MenubarSeparator/>{([['Surface document', '/documents/cad_editor_fixture'], ['Boolean extrusion', '/features/cad_boolean_extrusion'],
          ['NURBS loft', '/lofts/loft_supported_graph'], ['Assembly', '/assemblies/assembly_editor_fixture']] as const).map(([label, route]) =>
          <MenubarItem key={route} disabled={busy} onSelect={() => menuAction(() => run(() => { location.hash = route; }))}>{label}</MenubarItem>)}
      </MenubarContent></MenubarMenu></Menubar>
      <span className="document-title">{filename}{snapshot.dirty && <span className="dirty-dot"> •</span>}</span>
      <Button variant="outline" size="sm" data-testid="driving-open" disabled={busy || draft} onClick={() => run(() => input.current?.click(), true)}><FolderOpen/>Open</Button>
      <Button size="sm" data-testid="driving-download" disabled={busy} onClick={() => run(() => downloadAccepted(session))}><Download/>Download</Button>
      <input ref={input} type="file" accept=".json" className="file-input" aria-label="Open native driving Sketch file" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }}/>
    </header>
    <div className="app-toolbar"><span className="breadcrumb"><Spline size={13}/>Driving Sketch<span className="toolbar-divider"/>{profileLabel(snapshot.accepted.document.seed.profiles.find(profile => profile.id === snapshot.view.profileId)?.kind ?? '')}</span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" data-testid="driving-undo" aria-label="Undo" disabled={busy || draft || !snapshot.history.canUndo} onClick={() => run(() => session.prepareUndo(), true)}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="driving-redo" aria-label="Redo" disabled={busy || draft || !snapshot.history.canRedo} onClick={() => run(() => session.prepareRedo(), true)}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" data-testid="driving-fit" disabled={busy || draft || !fitReady()} onClick={() => run(() => { if (fitReady()) setFitRequest(value => value + 1); }, true)}><Maximize/>Fit</Button>
    </div></div>
    {error && <div className="app-error" role="alert">{errorText(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace"><aside className="document-tree" aria-label="Sketch profiles"><h2><Spline size={15}/>Profiles</h2>
      {snapshot.accepted.document.seed.profiles.map(profile => <button key={profile.id} type="button" data-testid={'driving-profile-' + profile.id}
        disabled={busy || draft} className={'tree-body' + (snapshot.view.profileId === profile.id ? ' selected' : '')}
        aria-pressed={snapshot.view.profileId === profile.id} onClick={() => run(() => session.prepareView(profile.id), true)}>
        <Spline size={14}/><span>{profileLabel(profile.kind)}</span>{!snapshot.selectedScopeIds.includes(profile.id) && <span className="tree-kind">Read only</span>}
      </button>)}
    </aside><main className="main-workspace"><CadEditorDrivingSketchEditor session={session} displayOptions={displayOptions} fitRequest={fitRequest}
      readRequest={flowMode ? readRequest : undefined} onFrame={flowMode ? setFrame : undefined} onDisplay={setDisplay}
      onError={failure => { opening.current = null; setError(failure); }} onAccepted={(_, candidate) => { setError(null);
        if (opening.current?.token === candidate.token && candidate.kind === 'open') { setFilename(opening.current.filename); opening.current = null; } }}/></main></div>
    <footer className="app-status"><span className="status-led"/><span>Accepted Sketch</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-divider"/>
      <span>{draft ? 'Pending constraints' : snapshot.dirty ? 'Unsaved changes' : 'No new changes'}</span><span className="status-spacer"/>
      <span>Selected scope · DOF {snapshot.accepted.report.selectedDegreesOfFreedom} · Rank {snapshot.accepted.report.selectedRank}</span><span className="status-divider"/>
      <span>History {snapshot.history.index + 1} / {snapshot.history.count}</span><span className="status-divider"/><span>Local XY · mm</span></footer>
    <Dialog open={profileChoice !== null} onOpenChange={open => { if (!open && !snapshot.candidate) clearDecision(); }}><DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="driving-profile-dialog">
      <DialogHeader><DialogTitle>Choose the incoming profile</DialogTitle><DialogDescription>This file has no default Line profile. Choose the complete profile to display.</DialogDescription></DialogHeader>
      <label htmlFor="driving-incoming-profile">Profile</label><select id="driving-incoming-profile" data-testid="driving-profile-select" value={incomingProfile} onChange={event => setIncomingProfile(event.target.value)}>
        <option value="" disabled>Choose a profile</option>{profileChoice?.profiles.map(profile => <option key={profile.id} value={profile.id}>{profileLabel(profile.kind)} · {profile.id}</option>)}
      </select><DialogFooter><Button variant="outline" data-testid="driving-profile-cancel" onClick={clearDecision}>Cancel</Button>
        <Button data-testid="driving-profile-confirm" disabled={!incomingProfile} onClick={confirmProfile}>Continue</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={replacement !== null} onOpenChange={open => { if (!open && !snapshot.candidate) clearDecision(); }}><DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="driving-replacement-dialog">
      <DialogHeader><DialogTitle>Replace this Sketch?</DialogTitle><DialogDescription>Download the accepted Sketch or continue without downloading. Pending constraints are not included in the download.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" data-testid="driving-replacement-cancel" onClick={clearDecision}>Cancel</Button>
        <Button variant="outline" data-testid="driving-replacement-download" onClick={downloadBeforeReplacement}>Download copy</Button>
        <Button data-testid="driving-replacement-continue" onClick={continueReplacement}>Continue without downloading</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
