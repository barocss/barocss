import {useEffect, useRef, useState} from 'react';
import {Lightbulb, Plus, Trash2, FolderOpen, Save, Undo2, Redo2} from 'lucide-react';
import {normalizeRenderEditorError, RenderEditorError, serializeRenderNativeDirectionalLightDocument,
  upgradeRenderNativeSceneToDirectionalLights, parseRenderNativeSceneDocument, RENDER_NATIVE_SCENE_LIMITS} from '@barocss/render-editor';
import type {RenderNativeDirectionalLightDocumentV1, RenderNativeDirectionalLightSession,
  RenderNativeDirectionalLightSessionSnapshot} from '@barocss/render-editor';
import {createNativeDirectionalLightController} from './native-directional-light-controller';
import {createNativeSceneBase, createNativeSceneSeed} from './native-scene-seed';
import {readDirectionalLightFields, applyDirectionalLightFields, addDirectionalLightFields,
  directionalLightFieldsDirty} from './native-directional-light-fields';
import type {DirectionalLightFields, DirectionalLightForm} from './native-directional-light-fields';
import {Button} from './components/ui/button';

async function initialScene(signal: AbortSignal): Promise<RenderNativeDirectionalLightDocumentV1> {
  const response = await fetch('./reference-panel.barocad', {signal});
  if (!response.ok) throw new Error('Reference Surface could not be loaded.');
  return createDirectionalLightStudy(await response.text());
}
/** App-owned seed using the existing native document/explicit upgrade providers. */
export function createDirectionalLightStudy(source: string): RenderNativeDirectionalLightDocumentV1 {
  const base = createNativeSceneBase(source, {
    format: 'barocss-render-editor-material', version: 0, profile: 'mesh-opaque-fragment-v0',
    documentId: 'directional-study-material', title: 'Directional study', revision: 0,
    shaderSource: '@shader #directional_study { @fragment { color: #c7d5dd; } }', uniforms: {},
  }, {eye: [0, 2.6, 4], target: [0, -.55, 0], up: [0, 1, 0], fovYDegrees: 50, near: .01, far: 100},
  {ambientStrength: .2, directionalStrength: .7, direction: [1, 1, 1]});
  return upgradeRenderNativeSceneToDirectionalLights(createNativeSceneSeed(base));
}
const fieldStyle = {width: '100%', minWidth: 0, padding: '7px 8px', borderRadius: 4,
  border: '1px solid var(--border)', color: 'var(--foreground)', background: '#11181d'};
const sectionStyle = {padding: 16, borderBottom: '1px solid var(--border)'};

/** A distinct required-WebGPU authoring route; legacy material presentation is unchanged. */
export function NativeDirectionalLightWorkbench({initialDocument}: {initialDocument?: RenderNativeDirectionalLightDocumentV1}) {
  const canvas = useRef<HTMLCanvasElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<RenderNativeDirectionalLightSession | null>(null);
  const mounted = useRef(false), epoch = useRef(0), operationEpoch = useRef(0), busyRef = useRef(false);
  const openTicket = useRef<{session: RenderNativeDirectionalLightSession; snapshot: RenderNativeDirectionalLightSessionSnapshot; fields: DirectionalLightForm; kind: 'v1' | 'legacy-v0'} | null>(null);
  const replacement = useRef<RenderNativeDirectionalLightDocumentV1 | undefined>(initialDocument);
  const [attempt, setAttempt] = useState(0), [snapshot, setSnapshot] = useState<RenderNativeDirectionalLightSessionSnapshot | null>(null);
  const [fields, setFields] = useState<DirectionalLightForm>({ambient: '.2', lights: []});
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('starting'), [notice, setNotice] = useState('Opening required WebGPU viewport…');
  const [error, setError] = useState<string | null>(null), [help, setHelp] = useState(false);
  const formRef = useRef(fields); formRef.current = fields;
  const dirty = !!snapshot && (snapshot.dirty || directionalLightFieldsDirty(fields, snapshot.accepted));
  const report = (cause: unknown, prefix = '') => {const value = normalizeRenderEditorError(cause); setError(prefix + value.code + ': ' + value.message);};
  const refresh = (session: RenderNativeDirectionalLightSession, replaceFields = false) => {
    const value = session.getSnapshot(); setSnapshot(value); setStatus(session.getStatus().state);
    if (replaceFields) {
      const form = readDirectionalLightFields(value.accepted); formRef.current = form; setFields(form);
      setSelected(previous => form.lights.some(light => light.nodeId === previous) ? previous : form.lights[0]?.nodeId ?? null);
    }
  };
  useEffect(() => {
    mounted.current = true; const started = ++epoch.current;
    const controller = createNativeDirectionalLightController(), abort = new AbortController();
    let unsubscribe: (() => void) | null = null;
    sessionRef.current = null; setSnapshot(null); setStatus('starting'); setError(null);
    const live = () => mounted.current && epoch.current === started;
    void (async () => {
      try {
        const document = replacement.current ?? await initialScene(abort.signal);
        if (!live() || !canvas.current) return;
        const session = await controller.mount(canvas.current, document, {width: 960, height: 600});
        if (!live() || !session) return;
        sessionRef.current = session; refresh(session, true);
        unsubscribe = session.subscribe(() => {if (live()) refresh(session);});
        setNotice('Edit lights, then Apply the complete scene.');
      } catch (cause) {if (live()) {setStatus('unavailable'); report(cause);}}
    })();
    // The existing session exposes live status through a getter, not a loss subscription.
    const timer = window.setInterval(() => {if (live() && sessionRef.current) setStatus(sessionRef.current.getStatus().state);}, 300);
    return () => {
      mounted.current = false; epoch.current++; operationEpoch.current++; openTicket.current = null; busyRef.current = false; abort.abort(); window.clearInterval(timer);
      sessionRef.current = null;
      try {controller.dispose();} finally {unsubscribe?.();}
    };
  }, [attempt]);
  useEffect(() => {
    const input = fileInput.current;
    const cancel = () => {if (!busyRef.current) {openTicket.current = null; setError(null); setNotice('File selection cancelled.');}};
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = sessionRef.current?.getSnapshot();
      if (busyRef.current || current && (current.dirty || current.unsaved || directionalLightFieldsDirty(formRef.current, current.accepted))) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const run = async (action: (session: RenderNativeDirectionalLightSession, stillCurrent: () => boolean) => Promise<boolean>, successNotice = 'Scene accepted.', failurePrefix = '') => {
    const session = sessionRef.current;
    if (!session || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const started = ++operationEpoch.current, mountEpoch = epoch.current;
    // Operation fencing is separate from the mount lifetime; the session still belongs to this canvas.
    const stillCurrent = () => mounted.current && operationEpoch.current === started && epoch.current === mountEpoch && sessionRef.current === session;
    try {const accepted = await action(session, stillCurrent); if (stillCurrent()) {refresh(session, accepted); if (accepted) setNotice(successNotice);}}
    catch (cause) {if (stillCurrent()) {refresh(session); report(cause, failurePrefix);}}
    finally {if (stillCurrent()) {busyRef.current = false; setBusy(false);}}
  };
  const confirmReplace = (action: string) => {
    const current = sessionRef.current?.getSnapshot();
    return !current || !(current.dirty || current.unsaved || directionalLightFieldsDirty(formRef.current, current.accepted))
      || window.confirm(action + ' will leave unsaved changes and drafts. Continue?');
  };
  const apply = () => void run(async session => {
    const document = applyDirectionalLightFields(session.getSnapshot().accepted, formRef.current);
    session.setDraftText(serializeRenderNativeDirectionalLightDocument(document), session.getSnapshot().version);
    await session.commitPrepared(session.prepareDraft(session.getSnapshot().version)); return true;
  });
  const discard = () => {
    const session = sessionRef.current; if (!session || busyRef.current) return;
    try {session.discardDraft(session.getSnapshot().version); refresh(session, true); setError(null); setNotice('Draft discarded.');} catch (cause) {report(cause);}
  };
  const history = (direction: 'undo' | 'redo') => void run(async session => {
    const candidate = direction === 'undo' ? session.prepareUndo(session.getSnapshot().version) : session.prepareRedo(session.getSnapshot().version);
    if (!candidate) return false; await session.commitPrepared(candidate); return true;
  });
  const open = (kind: 'v1' | 'legacy-v0' = 'v1') => {
    const session = sessionRef.current;
    if (session && !busyRef.current && confirmReplace(kind === 'v1' ? 'Open' : 'Import legacy Native scene')) {
      openTicket.current = {session, snapshot: session.getSnapshot(), fields: formRef.current, kind};
      if (fileInput.current) fileInput.current.value = ''; fileInput.current?.click();
    }
  };
  const readFile = (file: File | undefined) => {
    const ticket = openTicket.current; openTicket.current = null;
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
      const directionalText = ticket.kind === 'legacy-v0'
        ? serializeRenderNativeDirectionalLightDocument(upgradeRenderNativeSceneToDirectionalLights(parseRenderNativeSceneDocument(text))) : text;
      await session.commitPrepared(session.prepareOpen(directionalText, before.version)); return true;
    }, ticket.kind === 'legacy-v0' ? 'Legacy Native scene converted to directional V1. Save accepted writes the new format.' : 'Scene accepted.',
    ticket.kind === 'legacy-v0' ? 'Legacy Native scene import refused: ' : '');
  };
  const save = () => {
    const session = sessionRef.current; if (!session || busyRef.current) return;
    let requested = false;
    try {
      const payload = session.getSavePayload(), url = URL.createObjectURL(new Blob([payload.text], {type: 'application/json;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = payload.documentId + '.directional-scene.json'; link.hidden = true; document.body.append(link);
      try {link.click(); requested = true;} finally {link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);}
      session.markSaved(payload); refresh(session); setError(null); setNotice('Download requested for the accepted scene. Drafts are not saved.');
    } catch (cause) {
      const value = normalizeRenderEditorError(cause);
      setError((requested ? 'Download requested; saved marker could not be acknowledged. ' : '') + value.code + ': ' + value.message);
    }
  };
  const remount = () => {
    if (busyRef.current || !confirmReplace('Remount')) return;
    if (!window.confirm('Remount the accepted scene and clear Undo/Redo history?')) return;
    replacement.current = sessionRef.current?.getSnapshot().accepted ?? replacement.current;
    setBusy(false); setNotice('Remounting required WebGPU viewport…'); setAttempt(value => value + 1);
  };
  const edit = (next: DirectionalLightForm) => {if (!busyRef.current) {formRef.current = next; setFields(next); setError(null);}};
  const light = fields.lights.find(item => item.nodeId === selected);
  const editLight = (patch: Partial<DirectionalLightFields>) => {if (light) edit({...fields, lights: fields.lights.map(item => item.nodeId === light.nodeId ? {...item, ...patch} : item)});};
  const add = () => {try {const next = addDirectionalLightFields(fields); edit(next); setSelected(next.lights.at(-1)!.nodeId);} catch (cause) {report(cause);}};
  const remove = () => {if (light) {const next = {...fields, lights: fields.lights.filter(item => item !== light)}; edit(next); setSelected(next.lights[0]?.nodeId ?? null);}};
  const disabled = busy || !snapshot || status !== 'ready';
  const numberInput = (label: string, value: string, change: (text: string) => void) => <label style={{display: 'grid', gap: 5}}>{label}<input aria-label={label} inputMode="decimal" value={value} disabled={disabled} style={fieldStyle} onChange={event => change(event.target.value)}/></label>;
  return <main className="app-shell" data-testid="directional-light-workbench">
    <header className="app-topbar"><div className="app-brand"><Lightbulb size={18}/><strong>BaroCSS</strong><small>Directional lights</small></div><div className="app-topbar-spacer"/>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => {if (confirmReplace('Back to materials')) window.location.assign('./material.html');}}>Back to materials</Button>
      <Button variant="ghost" size="sm" onClick={() => setHelp(value => !value)}>Help</Button>
      <Button variant="ghost" size="sm" disabled={disabled} title="Explicitly convert a Native scene V0 file to directional-scene V1" onClick={() => open('legacy-v0')}>Import legacy Native scene</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => open()}><FolderOpen/>Open</Button>
      <Button size="sm" disabled={busy || !snapshot} onClick={save}><Save/>Save accepted</Button>
    </header>
    <div className="app-document-bar"><strong>{snapshot?.accepted.title ?? 'Native Surface light study'}</strong><span className="app-status-spacer"/>
      <span>{dirty ? 'Unapplied draft' : snapshot?.unsaved ? 'Unsaved scene' : snapshot ? 'File loaded / download requested' : 'Starting'}</span>
      <Button size="icon-xs" variant="ghost" aria-label="Undo" disabled={disabled || dirty || !snapshot?.canUndo} onClick={() => history('undo')}><Undo2/></Button>
      <Button size="icon-xs" variant="ghost" aria-label="Redo" disabled={disabled || dirty || !snapshot?.canRedo} onClick={() => history('redo')}><Redo2/></Button>
    </div>
    {help && <section style={sectionStyle} aria-label="Directional light help">This opt-in workbench requires WebGPU. Directions use the scene's right-handed Y-up frame; XYZ values are retained as authored and must form a nonzero vector. Colors are linear RGB, not sRGB hex. Ambient, color and relative intensity range from 0 to 1. Up to four directional lights are supported. Apply accepts one complete scene transaction; a refusal keeps your fields and prior scene. Open reads only directional-scene V1 files. Import legacy Native scene explicitly converts a Material Editor V0 scene, retaining its original sources, materials, camera and poses. Its global light becomes one directional entity; Save writes V1. Save downloads accepted authorship only. Remount restores accepted authorship and clears history. Actual device and physical-file acceptance remain separate.</section>}
    <div className="app-body" style={{minHeight: 0}}>
      <aside style={{width: 210, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'auto'}} aria-label="Light outliner">
        <div style={sectionStyle}><strong>Scene lights</strong><p style={{color: 'var(--muted-foreground)'}}>{fields.lights.length} / 4 directional</p>
          <Button size="sm" variant="outline" disabled={disabled || fields.lights.length >= 4} onClick={add}><Plus/>Add directional</Button></div>
        {fields.lights.map(item => <button key={item.nodeId} aria-pressed={selected === item.nodeId} disabled={busy} onClick={() => setSelected(item.nodeId)} style={{display: 'block', width: '100%', padding: 14, textAlign: 'left', border: 0, color: 'inherit', background: selected === item.nodeId ? '#243735' : 'transparent'}}>{item.label || item.nodeId}<small style={{display: 'block', opacity: .65}}>{item.nodeId}{item.enabled ? '' : ' · disabled'}</small></button>)}
      </aside>
      <section style={{flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0e151b'}} aria-label="Native Surface viewport">
        <canvas key={attempt} ref={canvas} width={960} height={600} style={{width: '100%', aspectRatio: '8 / 5', objectFit: 'contain', maxHeight: '100%'}} aria-label="Required WebGPU directional-light scene"/>
        {status !== 'ready' && <div role="status" style={{padding: 16, textAlign: 'center'}}>{status === 'starting' ? 'Starting WebGPU…' : 'Presentation unavailable (' + status + '). Accepted data is retained.'}{status !== 'starting' && <p><Button variant="outline" disabled={busy} onClick={remount}>Remount accepted scene</Button></p>}</div>}
      </section>
      <aside style={{width: 285, flexShrink: 0, borderLeft: '1px solid var(--border)', overflow: 'auto'}} aria-label="Light inspector">
        <section style={sectionStyle}>{numberInput('Ambient strength', fields.ambient, ambient => edit({...fields, ambient}))}</section>
        {light ? <section style={{...sectionStyle, display: 'grid', gap: 14}}><strong>Directional light</strong><small>{light.nodeId}</small>
          <label style={{display: 'grid', gap: 5}}>Label<input aria-label="Light label" value={light.label} disabled={disabled} style={fieldStyle} onChange={event => editLight({label: event.target.value})}/></label>
          <label><input type="checkbox" aria-label="Light enabled" checked={light.enabled} disabled={disabled} onChange={event => editLight({enabled: event.target.checked})}/> Enabled</label>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['X', 'Y', 'Z'].map((axis, index) => <div key={axis}>{numberInput('Direction ' + axis, light.direction[index], value => {const direction = [...light.direction] as DirectionalLightFields['direction']; direction[index] = value; editLight({direction});})}</div>)}</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7}}>{['R', 'G', 'B'].map((axis, index) => <div key={axis}>{numberInput('Linear ' + axis, light.color[index], value => {const color = [...light.color] as DirectionalLightFields['color']; color[index] = value; editLight({color});})}</div>)}</div>
          {numberInput('Intensity', light.intensity, intensity => editLight({intensity}))}
          <Button variant="outline" disabled={disabled} onClick={remove}><Trash2/>Remove light</Button>
        </section> : <section style={sectionStyle}>Select a light, or add a directional light. Ambient remains available with no lights.</section>}
        <section style={{...sectionStyle, display: 'flex', gap: 8}}><Button disabled={disabled || !dirty} onClick={apply}>Apply</Button><Button variant="outline" disabled={disabled || !dirty} onClick={discard}>Discard</Button></section>
      </aside>
    </div>
    <footer className="app-status"><span role={error ? 'alert' : 'status'}>{error ?? (busy ? (snapshot?.pending ?? 'Reading file') + '…' : notice)}</span><span className="app-status-spacer"/><span data-testid="light-accepted-revision">Accepted {snapshot?.accepted.revision ?? '—'}</span><span>WebGPU · {status}</span></footer>
    <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Open directional scene file" onChange={event => readFile(event.target.files?.[0])}/>
  </main>;
}
