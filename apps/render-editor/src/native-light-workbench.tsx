import {useEffect, useRef, useState} from 'react';
import {Lightbulb, Plus, Trash2, FolderOpen, Save, Undo2, Redo2} from 'lucide-react';
import {normalizeRenderEditorError, RenderEditorError, serializeRenderNativeLightDocument,
  prepareRenderNativeLightDocument, parseRenderNativeLightDocument, serializeRenderNativeDirectionalLightDocument, upgradeRenderNativeSceneToDirectionalLights, parseRenderNativeSceneDocument, RENDER_NATIVE_SCENE_LIMITS} from '@barocss/render-editor';
import type {RenderNativeLightDocument, RenderNativeLightSession,
  RenderNativeLightSessionSnapshot} from '@barocss/render-editor';
import {createNativeLightController} from './native-light-controller';
import {createNativeLightNavigation} from './native-light-navigation';
import {deriveNativeLightFramingCamera} from './native-light-framing';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {readLightFields, applyLightFields, addLightFields,
  lightFieldsDirty, lightKind} from './native-light-fields';
import type {BodyFields, CameraFields, LightFields, LightForm, LightKind, MaterialUniformFields} from './native-light-fields';
import {Button} from './components/ui/button';

async function initialScene(signal: AbortSignal, kind: LightKind): Promise<RenderNativeLightDocument> {
  const response = await fetch('./reference-panel.barocad', {signal});
  if (!response.ok) throw new Error('Reference Surface could not be loaded.');
  return createLightStudy(await response.text(), kind);
}
/** App-owned seed using the existing native document/explicit upgrade providers. */
export function createLightStudy(source: string, kind: LightKind = 'directional'): RenderNativeLightDocument {
  const base = createNativeSceneBase(source, {
    format: 'barocss-render-editor-material', version: 0, profile: 'mesh-opaque-fragment-v0',
    documentId: 'directional-study-material', title: 'Directional study', revision: 0,
    shaderSource: '@shader #directional_study { @fragment { color: #c7d5dd; } }', uniforms: {},
  }, {eye: [0, 2.6, 4], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 50, near: .01, far: 100},
  {ambientStrength: .2, directionalStrength: .7, direction: [1, 1, 1]});
  const directional = upgradeRenderNativeSceneToDirectionalLights(createNativeSceneSeed(base));
  const document = prepareRenderNativeLightDocument({...directional, version: 2, profile: 'canonical-native-lights'}).document;
  return kind === 'directional' ? document : prepareRenderNativeLightDocument({...document,
    title: 'Point light study', lights: {format: 'barocss-gpu-native-point-lights', version: 0,
      profile: 'native-world-point-linear-v0', sourceId: document.documentId, revision: document.revision,
      ambientStrength: .2, lights: [{nodeId: 'point-1', label: 'Point 1', enabled: true,
        positionScene: [0, 1, 2], rangeScene: 10, colorLinearRGB: [1, 1, 1], intensity: .7}]}}).document;
}
const fieldStyle = {width: '100%', minWidth: 0, padding: '7px 8px', borderRadius: 4,
  border: '1px solid var(--border)', color: 'var(--foreground)', background: '#11181d'};
const sectionStyle = {padding: 16, borderBottom: '1px solid var(--border)'};

/** A distinct required-WebGPU authoring route; legacy material presentation is unchanged. */
export function NativeLightWorkbench({initialDocument}: {initialDocument?: RenderNativeLightDocument}) {
  const navigation = useRef<ReturnType<typeof createNativeLightNavigation> | null>(null), navigationBusy = useRef(false);
  const [navigating, setNavigating] = useState(false), [navigationMode, setNavigationMode] = useState<'orbit' | 'pan'>('orbit');
  const modeRef = useRef(navigationMode); modeRef.current = navigationMode;
  const [kind, setKind] = useState<LightKind | undefined>(initialDocument ? lightKind(initialDocument) : undefined);
  const canvas = useRef<HTMLCanvasElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<RenderNativeLightSession | null>(null);
  const mounted = useRef(false), epoch = useRef(0), operationEpoch = useRef(0), busyRef = useRef(false);
  const openTicket = useRef<{session: RenderNativeLightSession; snapshot: RenderNativeLightSessionSnapshot; fields: LightForm; kind: 'current' | 'legacy-v0'} | null>(null);
  const replacement = useRef<RenderNativeLightDocument | undefined>(initialDocument);
  const [attempt, setAttempt] = useState(0), [snapshot, setSnapshot] = useState<RenderNativeLightSessionSnapshot | null>(null);
  const [fields, setFields] = useState<LightForm>({kind: kind ?? 'directional', ambient: '.2', lights: [], bodies: [], materials: [],
    camera: {eye: ['', '', ''], target: ['', '', ''], up: ['', '', ''], fovYDegrees: '', near: '', far: ''}});
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [choosingFile, setChoosingFile] = useState(false);
  const framed = useRef<{document: RenderNativeLightDocument; camera: RenderNativeLightDocument['display']['camera'];
    bodyId: string | undefined; dimensions: number[]} | null>(null);
  const [status, setStatus] = useState('starting'), [notice, setNotice] = useState('Opening required WebGPU viewport…');
  const [error, setError] = useState<string | null>(null), [help, setHelp] = useState(false);
  const formRef = useRef(fields); formRef.current = fields;
  const helpRef = useRef(help); helpRef.current = help;
  const actionBusy = busy || navigating;
  const dirty = !!snapshot && (snapshot.dirty || lightFieldsDirty(fields, snapshot.accepted));
  const report = (cause: unknown, prefix = '') => {const value = normalizeRenderEditorError(cause); setError(prefix + value.code + ': ' + value.message);};
  const refresh = (session: RenderNativeLightSession, replaceFields = false) => {
    const value = session.getSnapshot(); setSnapshot(value); setStatus(session.getStatus().state);
    if (replaceFields) {
      const form = readLightFields(value.accepted); formRef.current = form; setFields(form);
      setSelected(previous => form.lights.some(light => light.nodeId === previous) ? previous : form.lights[0]?.nodeId ?? null);
      setSelectedBody(previous => form.bodies.some(body => body.bodyId === previous) ? previous : form.bodies[0]?.bodyId ?? null);
    }
  };
  useEffect(() => {
    if (!kind) return;
    mounted.current = true; const started = ++epoch.current;
    const controller = createNativeLightController(), abort = new AbortController();
    let unsubscribe: (() => void) | null = null;
    sessionRef.current = null; framed.current = null; setChoosingFile(false); setSnapshot(null); setStatus('starting'); setError(null); setNavigating(false);
    const live = () => mounted.current && epoch.current === started;
    void (async () => {
      try {
        const document = replacement.current ?? await initialScene(abort.signal, kind);
        if (!live() || !canvas.current) return;
        const session = await controller.mount(canvas.current, document, {width: 960, height: 600});
        if (!live() || !session) return;
        sessionRef.current = session; refresh(session, true);
        navigation.current = createNativeLightNavigation(canvas.current, session, {
          mode: () => modeRef.current,
          canNavigate: () => live() && sessionRef.current === session && !busyRef.current && !openTicket.current && !helpRef.current,
          onBusy: value => {navigationBusy.current = value; if (live()) setNavigating(value);},
          onError: cause => {if (live()) {refresh(session); report(cause);}},
        });
        unsubscribe = session.subscribe(() => {if (live()) refresh(session);});
        setNotice('Edit bodies, materials, lights or the scene camera, then Apply the complete scene.');
      } catch (cause) {if (live()) {setStatus('unavailable'); report(cause);}}
    })();
    // The existing session exposes live status through a getter, not a loss subscription.
    const timer = window.setInterval(() => {if (live() && sessionRef.current) {const next = sessionRef.current.getStatus().state; setStatus(next); if (next !== 'ready') navigation.current?.cancel();}}, 300);
    return () => {
      mounted.current = false; epoch.current++; operationEpoch.current++; openTicket.current = null; busyRef.current = false; abort.abort(); window.clearInterval(timer);
      navigation.current?.dispose(); navigation.current = null; navigationBusy.current = false;
      sessionRef.current = null;
      try {controller.dispose();} finally {unsubscribe?.();}
    };
  }, [attempt, kind]);
  useEffect(() => {
    const input = fileInput.current;
    const cancel = () => {if (!busyRef.current) {openTicket.current = null; setChoosingFile(false); setError(null); setNotice('File selection cancelled.');}};
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, [kind]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = sessionRef.current?.getSnapshot();
      if (busyRef.current || current && (current.dirty || current.unsaved || lightFieldsDirty(formRef.current, current.accepted))) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const run = async (action: (session: RenderNativeLightSession, stillCurrent: () => boolean) => Promise<boolean>, successNotice = 'Scene accepted.', failurePrefix = '') => {
    const session = sessionRef.current;
    if (!session || busyRef.current || navigationBusy.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const started = ++operationEpoch.current, mountEpoch = epoch.current;
    // Operation fencing is separate from the mount lifetime; the session still belongs to this canvas.
    const stillCurrent = () => mounted.current && operationEpoch.current === started && epoch.current === mountEpoch && sessionRef.current === session;
    try {const accepted = await action(session, stillCurrent); if (stillCurrent()) {refresh(session, accepted); if (accepted && successNotice) setNotice(successNotice);}}
    catch (cause) {if (stillCurrent()) {refresh(session); report(cause, failurePrefix);}}
    finally {if (stillCurrent()) {busyRef.current = false; setBusy(false);}}
  };
  const confirmReplace = (action: string) => {
    const current = sessionRef.current?.getSnapshot();
    return !current || !(current.dirty || current.unsaved || lightFieldsDirty(formRef.current, current.accepted))
      || window.confirm(action + ' will leave unsaved changes and drafts. Continue?');
  };
  const apply = () => void run(async (session, stillCurrent) => {
    const before = session.getSnapshot(), document = applyLightFields(before.accepted, formRef.current);
    const text = serializeRenderNativeLightDocument(document);
    // The real codec preserves signed zero and omitted source values; JSON.stringify would not.
    if (text === serializeRenderNativeLightDocument(before.accepted)) {
      session.discardDraft(before.version);
      if (stillCurrent()) setNotice('No authored changes. Draft formatting reset.');
      return true;
    }
    session.setDraftText(text, before.version);
    await session.commitPrepared(session.prepareDraft(session.getSnapshot().version));
    if (stillCurrent()) setNotice('Scene accepted.');
    return true;
  }, '');
  const discard = () => {
    const session = sessionRef.current; if (!session || busyRef.current || navigationBusy.current) return;
    try {session.discardDraft(session.getSnapshot().version); refresh(session, true); setError(null); setNotice('Draft discarded.');} catch (cause) {report(cause);}
  };
  const resetView = () => void run(async session => {await session.resetViewportCamera(session.getSnapshot().version); return false;}, '');
  const useView = () => void run(async session => {
    const current = session.getSnapshot();
    if (current.dirty || lightFieldsDirty(formRef.current, current.accepted) || !current.viewportCamera) return false;
    const next = {...current.accepted, display: {...current.accepted.display, camera: current.viewportCamera}};
    session.setDraftText(serializeRenderNativeLightDocument(next), current.version);
    await session.commitPrepared(session.prepareDraft(session.getSnapshot().version)); return true;
  }, 'Current view accepted as the scene camera.');
  const frameBodies = (scope: 'all' | 'selected') => {
    if (helpRef.current || openTicket.current || !canvas.current || status !== 'ready'
      || scope === 'selected' && selectedBody === null) return;
    const bodyId = scope === 'selected' ? selectedBody! : undefined;
    void run(async (session, stillCurrent) => {
      const element = canvas.current;
      if (!element || helpRef.current || openTicket.current) return false;
      const before = session.getSnapshot(), camera = before.viewportCamera ?? before.accepted.display.camera;
      const liveStatus = session.getStatus();
      if (before.disposed || before.pending !== null || liveStatus.state !== 'ready')
        throw new RenderEditorError('PRESENTATION_REFUSED', 'Framing requires an available idle viewport.');
      if (element.width !== liveStatus.width || element.height !== liveStatus.height)
        throw new RenderEditorError('PRESENTATION_REFUSED', 'Canvas backing dimensions differ from the acknowledged viewport.');
      const rect = element.getBoundingClientRect(), dimensions = [rect.width, rect.height, element.width, element.height];
      const previous = framed.current;
      // Exact observed identities prevent repeat commands from accumulating floating
      // point fitting drift. Any accepted scene/view/scope/dimension change misses.
      if (previous?.document === before.accepted && previous.camera === camera && previous.bodyId === bodyId
        && dimensions.every((value, index) => Object.is(value, previous.dimensions[index]))) {
        if (stillCurrent()) setNotice('This accepted geometry is already framed.'); return false;
      }
      const next = deriveNativeLightFramingCamera(before.accepted, camera,
        {width: rect.width, height: rect.height, backingWidth: element.width, backingHeight: element.height}, bodyId);
      await session.navigateViewportCamera(next, before.version);
      if (stillCurrent()) {
        const after = session.getSnapshot();
        framed.current = {document: after.accepted, camera: after.viewportCamera ?? after.accepted.display.camera, bodyId, dimensions};
        setNotice(scope === 'all' ? 'Visible accepted bodies framed in the local view.' : 'Selected accepted body framed in the local view.');
      }
      return false; // A local view command never refreshes/consumes corrective fields.
    }, '');
  };
  const history = (direction: 'undo' | 'redo') => void run(async session => {
    const candidate = direction === 'undo' ? session.prepareUndo(session.getSnapshot().version) : session.prepareRedo(session.getSnapshot().version);
    if (!candidate) return false; await session.commitPrepared(candidate); return true;
  });
  const open = (kind: 'current' | 'legacy-v0' = 'current') => {
    const session = sessionRef.current;
    if (session && !busyRef.current && !navigationBusy.current && confirmReplace(kind === 'current' ? 'Open' : 'Import legacy Native scene')) {
      openTicket.current = {session, snapshot: session.getSnapshot(), fields: formRef.current, kind};
      setChoosingFile(true);
      if (fileInput.current) fileInput.current.value = ''; fileInput.current?.click();
    }
  };
  const readFile = (file: File | undefined) => {
    const ticket = openTicket.current; openTicket.current = null; setChoosingFile(false);
    if (!file) return;
    if (!ticket || ticket.session !== sessionRef.current || ticket.snapshot !== ticket.session.getSnapshot() || ticket.fields !== formRef.current) {
      report(new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed while choosing the file. Choose it again.')); return;
    }
    void run(async (session, stillCurrent) => {
      const before = session.getSnapshot();
      if (file.size > RENDER_NATIVE_SCENE_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Scene file exceeds 2 MiB.');
      const bytes = await file.arrayBuffer();
      if (!stillCurrent() || session.getSnapshot() !== before) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed while reading the file.');
      if (bytes.byteLength > RENDER_NATIVE_SCENE_LIMITS.fileBytes) throw new RenderEditorError('DOCUMENT_BYTES', 'Scene file exceeds 2 MiB.');
      const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
      const authoredText = ticket.kind === 'legacy-v0'
        ? serializeRenderNativeDirectionalLightDocument(upgradeRenderNativeSceneToDirectionalLights(parseRenderNativeSceneDocument(text))) : text;
      const parsed = parseRenderNativeLightDocument(authoredText);
      const migrated = ticket.kind === 'legacy-v0' || (JSON.parse(text) as {version?: number}).version === 1;
      await session.commitPrepared(session.prepareOpen(serializeRenderNativeLightDocument(parsed), before.version));
      if (stillCurrent()) setNotice(migrated ? 'Legacy directional scene migrated. Save accepted writes the current light-scene format.' : 'Scene accepted.');
      return true;
    }, '',
    ticket.kind === 'legacy-v0' ? 'Legacy Native scene import refused: ' : '');
  };
  const save = () => {
    const session = sessionRef.current; if (!session || busyRef.current || navigationBusy.current) return;
    let requested = false;
    try {
      const payload = session.getSavePayload(), url = URL.createObjectURL(new Blob([payload.text], {type: 'application/json;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = payload.documentId + '.light-scene.json'; link.hidden = true; document.body.append(link);
      try {link.click(); requested = true;} finally {link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);}
      session.markSaved(payload); refresh(session); setError(null); setNotice('Download requested for the accepted scene. Drafts are not saved.');
    } catch (cause) {
      const value = normalizeRenderEditorError(cause);
      setError((requested ? 'Download requested; saved marker could not be acknowledged. ' : '') + value.code + ': ' + value.message);
    }
  };
  const remount = () => {
    if (busyRef.current || navigationBusy.current || !confirmReplace('Remount')) return;
    const retained = sessionRef.current?.getSnapshot().accepted ?? replacement.current;
    if (!window.confirm(retained ? 'Restart from retained authorship and clear Undo/Redo history?' : 'Retry starting this workspace?')) return;
    replacement.current = retained;
    setBusy(false); setNotice('Remounting required WebGPU viewport…'); setAttempt(value => value + 1);
  };
  const newWorkspace = (nextKind: LightKind) => {
    if (busyRef.current || navigationBusy.current || !confirmReplace('New ' + nextKind + ' workspace')) return;
    openTicket.current = null; setChoosingFile(false); replacement.current = undefined;
    setKind(nextKind); setAttempt(value => value + 1); setBusy(false);
    setNotice('Starting a new ' + nextKind + ' workspace…');
  };
  const edit = (next: LightForm) => {if (!busyRef.current && !navigationBusy.current) {formRef.current = next; setFields(next); setError(null);}};
  const light = fields.lights.find(item => item.nodeId === selected);
  const editLight = (patch: Partial<LightFields>) => {if (light) edit({...fields, lights: fields.lights.map(item => item.nodeId === light.nodeId ? {...item, ...patch} : item)});};
  const editCamera = (patch: Partial<CameraFields>) => edit({...fields, camera: {...fields.camera, ...patch}});
  const body = fields.bodies.find(item => item.bodyId === selectedBody);
  const editBody = (patch: Partial<Pick<BodyFields, 'position' | 'scale'>>) => {
    if (body) edit({...fields, bodies: fields.bodies.map(item => item.bodyId === body.bodyId ? {...item, ...patch} : item)});
  };
  const material = body && snapshot?.accepted.display.visibleBodyIds.includes(body.bodyId)
    ? fields.materials.find(item => item.target.bodyId === body.bodyId) : undefined;
  const editUniform = (name: string, patch: Partial<Pick<MaterialUniformFields, 'value' | 'override'>>) => {
    if (material) edit({...fields, materials: fields.materials.map(item => item === material
      ? {...item, uniforms: item.uniforms.map(uniform => uniform.name === name ? {...uniform, ...patch} : uniform)} : item)});
  };
  const add = () => {try {const next = addLightFields(fields); edit(next); setSelected(next.lights.at(-1)!.nodeId);} catch (cause) {report(cause);}};
  const remove = () => {if (light) {const next = {...fields, lights: fields.lights.filter(item => item !== light)}; edit(next); setSelected(next.lights[0]?.nodeId ?? null);}};
  const disabled = actionBusy || !snapshot || status !== 'ready';
  const numberInput = (label: string, value: string, change: (text: string) => void) => <label style={{display: 'grid', gap: 5}}>{label}<input aria-label={label} inputMode="decimal" value={value} disabled={disabled} style={fieldStyle} onChange={event => change(event.target.value)}/></label>;
  if (!kind) return <main className="app-shell" data-testid="light-workbench-choice"><section style={sectionStyle}>
    <h1>Light workbench</h1><p>Choose the kind for this workspace. Directional and point lights use separate renderers; mixed lighting is not supported.</p>
    <Button onClick={() => newWorkspace('directional')}>Start directional workspace</Button>{' '}
    <Button onClick={() => newWorkspace('point')}>Start point workspace</Button>
    <p><a href="./material.html">Back to materials</a></p>
  </section></main>;
  return <main className="app-shell" data-testid="light-workbench">
    <header className="app-topbar"><div className="app-brand"><Lightbulb size={18}/><strong>BaroCSS</strong><small>Light workbench · {kind}</small></div><div className="app-topbar-spacer"/>
      <Button variant="ghost" size="sm" disabled={actionBusy} onClick={() => {if (confirmReplace('Back to materials')) window.location.assign('./material.html');}}>Back to materials</Button>
      <Button variant="ghost" size="sm" disabled={actionBusy} onClick={() => newWorkspace('directional')}>New directional</Button>
      <Button variant="ghost" size="sm" disabled={actionBusy} onClick={() => newWorkspace('point')}>New point</Button>
      <Button variant="ghost" size="sm" disabled={actionBusy} onClick={() => {navigation.current?.cancel(); setHelp(value => !value);}}>Help</Button>
      <Button variant="ghost" size="sm" disabled={disabled} title="Explicitly migrate a Native scene into a directional workspace; point workspaces refuse this conversion" onClick={() => open('legacy-v0')}>Import legacy Native scene</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => open()}><FolderOpen/>Open</Button>
      <Button size="sm" disabled={actionBusy || !snapshot} onClick={save}><Save/>Save accepted</Button>
    </header>
    <div className="app-document-bar"><strong>{snapshot?.accepted.title ?? 'Native Surface light study'}</strong><span className="app-status-spacer"/>
      <span>{dirty ? 'Unapplied draft' : snapshot?.unsaved ? 'Unsaved scene' : snapshot ? 'File loaded / download requested' : 'Starting'}</span>
      <Button size="icon-xs" variant="ghost" aria-label="Undo" disabled={disabled || dirty || !snapshot?.canUndo} onClick={() => history('undo')}><Undo2/></Button>
      <Button size="icon-xs" variant="ghost" aria-label="Redo" disabled={disabled || dirty || !snapshot?.canRedo} onClick={() => history('redo')}><Redo2/></Button>
    </div>
    {help && <section style={sectionStyle} aria-label="Light help">Choose a directional or point workspace. Each admits zero to four lights plus ambient; mixed lighting and cross-kind Open are refused without replacing your scene. Directions retain raw nonzero XYZ values. Points use final-world scene coordinates and range in scene units, with the GPU's artistic finite-range lighting. Color is linear RGB; ambient/color/intensity range from zero to one. Scene camera edits are authored data: eye, target and clipping planes use scene units, up is dimensionless and vertical FOV is in degrees. Body origin positions use millimetres and scales are dimensionless. Body selection keeps each object's corrective fields; rotation, visibility and original CAD source are retained. Body, camera, light and material fields Apply together in one complete transaction and refused fields remain available. Material controls edit only the selected body’s existing embedded binding, even when another binding repeats its material ID. Override supplies a scalar value; clearing Override uses the declared shader default without changing shader source. Orbit or Pan drags, Shift-drag and wheel zoom change only the local view. Frame selected fits the current body row and Frame all fits visible accepted bodies using conservative control-hull bounds with a 1.2 margin. Framing ignores and preserves corrective drafts; it retains viewing direction and FOV while choosing local clipping planes. It does not edit geometry or guarantee tight Surface or pixel bounds. Scene camera resets that view; Set scene camera explicitly authors it once only when all fields are clean. Escape or lost capture stops queued navigation without undoing acknowledged view updates. Save keeps the accepted authored camera. Open accepts current light scenes of the same kind and migrates supported directional legacy files. Import legacy Native scene explicitly converts V0 to directional authorship; a point workspace refuses it. Save writes the accepted current format. New workspace explicitly ends the old lifetime; remount retains accepted data but clears history. Actual device and physical-file acceptance remain separate.</section>}
    <div className="app-body" style={{minHeight: 0}}>
      <aside style={{width: 210, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'auto'}} aria-label="Light outliner">
        <div style={sectionStyle}><strong>Scene lights</strong><p style={{color: 'var(--muted-foreground)'}}>{fields.lights.length} / 4 {kind}</p>
          <Button size="sm" variant="outline" disabled={disabled || fields.lights.length >= 4} onClick={add}><Plus/>Add {kind}</Button></div>
        {fields.lights.map(item => <button key={item.nodeId} aria-pressed={selected === item.nodeId} disabled={actionBusy} onClick={() => setSelected(item.nodeId)} style={{display: 'block', width: '100%', padding: 14, textAlign: 'left', border: 0, color: 'inherit', background: selected === item.nodeId ? '#243735' : 'transparent'}}>{item.label || item.nodeId}<small style={{display: 'block', opacity: .65}}>{item.nodeId}{item.enabled ? '' : ' · disabled'}</small></button>)}
        <section style={sectionStyle} aria-label="Scene bodies"><strong>Scene bodies</strong><p>Choose an object to edit its display transform and existing material.</p>
          {fields.bodies.map(item => <button key={item.bodyId} aria-label={'Edit body ' + item.bodyId} aria-pressed={selectedBody === item.bodyId} disabled={disabled}
            onClick={() => setSelectedBody(item.bodyId)} style={{display: 'block', width: '100%', padding: '10px 4px', textAlign: 'left', border: 0, color: 'inherit', background: selectedBody === item.bodyId ? '#243735' : 'transparent'}}>
            {snapshot?.accepted.nativeDocument.bodies.find(body => body.id === item.bodyId)?.name ?? item.bodyId}
            <small style={{display: 'block', opacity: .65}}>{item.bodyId}{snapshot?.accepted.display.visibleBodyIds.includes(item.bodyId) ? '' : ' · Hidden'}</small>
          </button>)}
        </section>
      </aside>
      <section style={{flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0e151b'}} aria-label="Native Surface viewport">
        <div role="toolbar" aria-label="Viewport navigation" style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8}}>
          <Button size="sm" variant="outline" aria-pressed={navigationMode === 'orbit'} disabled={disabled} onClick={() => setNavigationMode('orbit')}>Orbit</Button>
          <Button size="sm" variant="outline" aria-pressed={navigationMode === 'pan'} disabled={disabled} onClick={() => setNavigationMode('pan')}>Pan</Button>
          <Button size="sm" variant="outline" aria-label="Zoom in" disabled={disabled || help} onClick={() => navigation.current?.interact({kind: 'zoom', factor: 1.15})}>+</Button>
          <Button size="sm" variant="outline" aria-label="Zoom out" disabled={disabled || help} onClick={() => navigation.current?.interact({kind: 'zoom', factor: 1 / 1.15})}>−</Button>
          <Button size="sm" variant="outline" disabled={disabled || help || choosingFile || !selectedBody
            || !snapshot?.accepted.display.visibleBodyIds.includes(selectedBody)} onClick={() => frameBodies('selected')}>Frame selected</Button>
          <Button size="sm" variant="outline" disabled={disabled || help || choosingFile} onClick={() => frameBodies('all')}>Frame all</Button>
          <Button size="sm" variant="outline" disabled={disabled || !snapshot?.viewDirty} onClick={resetView}>Scene camera</Button>
          <Button size="sm" variant="outline" disabled={disabled || dirty || !snapshot?.viewDirty} onClick={useView}>Set scene camera</Button>
          <span role="status" aria-label="Viewport camera status">{navigating ? 'Moving view…' : snapshot?.viewDirty ? 'User view' : 'Scene view'}</span>
        </div>
        <canvas key={attempt} ref={canvas} tabIndex={0} width={960} height={600} style={{width: '100%', aspectRatio: '8 / 5', objectFit: 'contain', maxHeight: '100%', touchAction: 'none'}} aria-label="Required WebGPU light scene"/>
        {status !== 'ready' && <div role="status" style={{padding: 16, textAlign: 'center'}}>{status === 'starting' ? 'Starting WebGPU…' : 'Presentation unavailable (' + status + '). ' + (snapshot ? 'Accepted data is retained.' : replacement.current ? 'Authored data remains available for retry.' : 'No scene has been accepted in this workspace.')}{status !== 'starting' && <p><Button variant="outline" disabled={actionBusy} onClick={remount}>{snapshot ? 'Remount accepted scene' : replacement.current ? 'Retry authored scene' : 'Retry workspace'}</Button></p>}</div>}
      </section>
      <aside style={{width: 285, flexShrink: 0, borderLeft: '1px solid var(--border)', overflow: 'auto'}} aria-label="Light inspector">
        {body && <section style={{...sectionStyle, display: 'grid', gap: 14}} aria-label="Body transform">
          <strong>Body transform</strong><small>{body.bodyId}</small>
          {(['position', 'scale'] as const).map(key => <fieldset key={key} style={{border: 0, margin: 0, padding: 0, minWidth: 0}}>
            <legend style={{marginBottom: 7}}>{key === 'position' ? 'Origin position (mm)' : 'Scale (dimensionless)'}</legend>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['X', 'Y', 'Z'].map((axis, index) => <div key={axis}>
              {numberInput('Body ' + key + ' ' + axis + (key === 'position' ? ' (mm)' : ''), body[key][index], value => {
                const vector = [...body[key]] as BodyFields[typeof key]; vector[index] = value; editBody({[key]: vector});
              })}
            </div>)}</div>
          </fieldset>)}
          <small>Rotation and visibility are retained. Display transforms do not edit CAD geometry. Apply accepts every body's draft with camera and light edits.</small>
        </section>}
        {body && <section style={{...sectionStyle, display: 'grid', gap: 12}} aria-label="Body material">
          <strong>Body material</strong>
          {material ? <>
            <small>{material.documentId} · revision {material.revision} · body {body.bodyId}</small>
            <small>Only this existing body binding changes. Shader source and other bindings are retained.</small>
            {material.uniforms.length ? material.uniforms.map(uniform => <fieldset key={uniform.name} style={{border: 0, margin: 0, padding: 0, minWidth: 0, display: 'grid', gap: 6}}>
              <legend>{uniform.name}</legend>
              <small>Range {uniform.min} to {uniform.max} · shader default {uniform.defaultValue}</small>
              <label><input type="checkbox" aria-label={'Override uniform ' + uniform.name} checked={uniform.override} disabled={disabled}
                onChange={event => editUniform(uniform.name, {override: event.target.checked})}/> Override (clear to use shader default)</label>
              <input aria-label={'Uniform ' + uniform.name} inputMode="decimal" value={uniform.value} disabled={disabled || !uniform.override}
                style={fieldStyle} onChange={event => editUniform(uniform.name, {value: event.target.value})}/>
              {!uniform.override && <small>Using shader default {uniform.defaultValue}; retained text is not a supplied override.</small>}
            </fieldset>) : <small>This material declares no editable scalar uniforms.</small>}
          </> : <small>No editable material binding for this body. Select a visible Surface with an existing qualified material; no binding is created.</small>}
        </section>}
        <section style={sectionStyle}>{numberInput('Ambient strength', fields.ambient, ambient => edit({...fields, ambient}))}</section>
        {light ? <section style={{...sectionStyle, display: 'grid', gap: 14}}><strong>{kind === 'point' ? 'Point light' : 'Directional light'}</strong><small>{light.nodeId}</small>
          <label style={{display: 'grid', gap: 5}}>Label<input aria-label="Light label" value={light.label} disabled={disabled} style={fieldStyle} onChange={event => editLight({label: event.target.value})}/></label>
          <label><input type="checkbox" aria-label="Light enabled" checked={light.enabled} disabled={disabled} onChange={event => editLight({enabled: event.target.checked})}/> Enabled</label>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['X', 'Y', 'Z'].map((axis, index) => <div key={axis}>{numberInput((kind === 'point' ? 'Position ' : 'Direction ') + axis, light.vector[index], value => {const vector = [...light.vector] as LightFields['vector']; vector[index] = value; editLight({vector});})}</div>)}</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['R', 'G', 'B'].map((axis, index) => <div key={axis}>{numberInput('Linear ' + axis, light.color[index], value => {const color = [...light.color] as LightFields['color']; color[index] = value; editLight({color});})}</div>)}</div>
          {kind === 'point' && numberInput('Range', light.range, range => editLight({range}))}
          {numberInput('Intensity', light.intensity, intensity => editLight({intensity}))}
          <Button variant="outline" disabled={disabled} onClick={remove}><Trash2/>Remove light</Button>
        </section> : <section style={sectionStyle}>Select a light, or add a light of this workspace kind. Ambient remains available with no lights.</section>}
        <section style={{...sectionStyle, display: 'grid', gap: 14}} aria-label="Scene camera">
          <strong>Scene camera</strong><small>Saved with the scene. Apply accepts camera and light edits together.</small>
          {(['eye', 'target', 'up'] as const).map(key => <fieldset key={key} style={{border: 0, margin: 0, padding: 0, minWidth: 0}}>
            <legend style={{marginBottom: 7}}>{key === 'eye' ? 'Eye (scene units)' : key === 'target' ? 'Target (scene units)' : 'Up (dimensionless)'}</legend>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['X', 'Y', 'Z'].map((axis, index) => <div key={axis}>
              {numberInput('Camera ' + key + ' ' + axis, fields.camera[key][index], value => {
                const vector = [...fields.camera[key]] as CameraFields[typeof key]; vector[index] = value; editCamera({[key]: vector});
              })}
            </div>)}</div>
          </fieldset>)}
          {numberInput('Vertical FOV (degrees)', fields.camera.fovYDegrees, fovYDegrees => editCamera({fovYDegrees}))}
          {numberInput('Near clip (scene units)', fields.camera.near, near => editCamera({near}))}
          {numberInput('Far clip (scene units)', fields.camera.far, far => editCamera({far}))}
        </section>
        <section style={{...sectionStyle, display: 'flex', gap: 8}}><Button disabled={disabled || !dirty} onClick={apply}>Apply</Button><Button variant="outline" disabled={disabled || !dirty} onClick={discard}>Discard</Button></section>
      </aside>
    </div>
    <footer className="app-status"><span role={error ? 'alert' : 'status'}>{error ?? (busy ? (snapshot?.pending ?? 'Reading file') + '…' : notice)}</span><span className="app-status-spacer"/><span data-testid="light-accepted-revision">Accepted {snapshot?.accepted.revision ?? '—'}</span><span>WebGPU · {status}</span></footer>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Open light scene file" onChange={event => readFile(event.target.files?.[0])}/>
  </main>;
}
