import { useEffect, useRef, useState } from 'react';
import { compileGpu, materialShader } from '@barocss/gpu';
import { APPEARANCES, MATERIAL_TEMPLATE, SCENE_TEMPLATE, anglesOf, directionFrom, validateRenderShadowLights, type Appearance, type Hex, type RenderLight, type RenderPost, type RenderSettings, FINISH_KINDS, type AppearanceFinish, type FinishKind, type StudioKind } from '@barocss/cad-model/engine/render';
import { Icon } from './atoms';
import type { RenderPathTraceSession } from '../viewport/renderer';
import { CONTROL, FIELD, NUM, SLIDER, TICK } from './panelStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

/** Validate the complete candidate before the document's undoable render change. */
export function changeRenderLights(render: RenderSettings, lights: readonly RenderLight[], onChange: (next: RenderSettings) => void): void {
  validateRenderShadowLights(lights);
  onChange({ ...render, lights: [...lights] });
}

/**
 * The Render workspace's panel: the appearance of the selected bodies (or of every body without one),
 * the lights, the environment and the saved camera. Every change is one undoable edit of the settings. O16: the
 * contents on shadcn (Button, Input, NativeSelect, FIELD / NUM / SLIDER rows); the shell (its title and Export image),
 * the tabs, the colour and range inputs and the source editors are the studio's.
 */
export function RenderPanel({ render, selectedKeys, onChange, onSaveCamera, onUseCamera, onExport, available, fov, onFov, onPickFocus, onCreatePathTrace, imageName, onError }: {
  render: RenderSettings;
  /** Body keys the appearance edits apply to; empty: the default appearance. */
  selectedKeys: string[];
  onChange(next: RenderSettings): void;
  onSaveCamera(): void;
  onUseCamera(): void;
  onExport(): void;
  /** False when the viewport draws without WebGPU (no rendering). */
  available: boolean;
  /** The view's vertical field of view (degrees), and setting it. */
  fov: number; onFov(degrees: number): void;
  /** Arm a one-shot viewport surface pick; null cancels without changing the document. */
  onPickFocus(done: (focus: number | null) => void): (() => void) | undefined;
  onCreatePathTrace(): Promise<RenderPathTraceSession>;
  imageName: string;
  onError?(message: string): void;
}) {
  const [method, setMethod] = useState<'raster' | 'path-tracing'>('raster');
  const [traceSamples, setTraceSamples] = useState(0), [tracePreviewSamples, setTracePreviewSamples] = useState(0), [traceRunning, setTraceRunning] = useState(false), [traceBusy, setTraceBusy] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null), [denoise, setDenoise] = useState(true);
  const trace = useRef<RenderPathTraceSession | null>(null), traceEpoch = useRef(0), tracePreview = useRef<HTMLCanvasElement | null>(null);
  const queuedCapture = useRef<RenderPathTraceSession | null>(null);
  const denoiseRef = useRef(true), captureInFlight = useRef<RenderPathTraceSession | null>(null), lastPreview = useRef(0);
  const disposeTrace = () => {
    traceEpoch.current++;
    const session = trace.current; trace.current = null;
    if (session) { session.stop(); session.dispose(); }
  };
  useEffect(() => () => { disposeTrace(); }, []);
  const showTrace = async (session: RenderPathTraceSession, epoch: number) => {
    if (captureInFlight.current === session) { queuedCapture.current = session; return; }
    captureInFlight.current = session;
    try {
      const frame = await session.capture(denoiseRef.current);
      if (traceEpoch.current !== epoch || trace.current !== session || !tracePreview.current) return;
      const canvas = tracePreview.current; canvas.width = frame.width; canvas.height = frame.height;
      canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
      canvas.dataset.samples = String(frame.samples); setTracePreviewSamples(frame.samples);
    } catch (error) {
      if (traceEpoch.current === epoch && trace.current === session) setTraceError(error instanceof Error ? error.message : String(error));
    } finally {
      if (captureInFlight.current === session) captureInFlight.current = null;
      if (queuedCapture.current === session) {
        queuedCapture.current = null;
        if (traceEpoch.current === epoch && trace.current === session) void showTrace(session, epoch);
      }
    }
  };
  const startTrace = async () => {
    disposeTrace(); const epoch = traceEpoch.current;
    setTraceSamples(0); setTracePreviewSamples(0); setTraceError(null); setTraceBusy(true); setTraceRunning(false);
    if (tracePreview.current) { tracePreview.current.width = 0; delete tracePreview.current.dataset.samples; }
    try {
      const session = await onCreatePathTrace();
      if (traceEpoch.current !== epoch) { session.stop(); session.dispose(); return; }
      trace.current = session; setTraceBusy(false); setTraceRunning(true); lastPreview.current = 0;
      await session.start(samples => {
        if (traceEpoch.current !== epoch || trace.current !== session) return;
        setTraceSamples(samples);
        if (performance.now() - lastPreview.current > 500 || samples === 1) { lastPreview.current = performance.now(); void showTrace(session, epoch); }
      });
      if (traceEpoch.current === epoch && trace.current === session) { setTraceRunning(false); setTraceSamples(session.samples); if (session.samples) void showTrace(session, epoch); }
    } catch (error) {
      if (traceEpoch.current === epoch) { setTraceBusy(false); setTraceRunning(false); setTraceError(error instanceof Error ? error.message : String(error)); }
    }
  };
  const stopTrace = () => {
    if (!trace.current) { disposeTrace(); setTraceBusy(false); }
    else trace.current.stop();
    setTraceRunning(false);
  };
  const exportStill = async () => {
    const session = trace.current, epoch = traceEpoch.current;
    if (!session || !session.samples) return;
    try {
      const frame = await session.capture(denoiseRef.current);
      if (traceEpoch.current !== epoch || trace.current !== session) return;
      const canvas = new OffscreenCanvas(frame.width, frame.height);
      canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      if (traceEpoch.current !== epoch || trace.current !== session) return;
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = imageName; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (traceEpoch.current === epoch) setTraceError(error instanceof Error ? error.message : String(error)); }
  };
  const [tab, setTab] = useState<'look' | 'lights' | 'scene' | 'source'>('look');
  const [lightError, setLightError] = useState<string | null>(null);
  const [radiusDrafts, setRadiusDrafts] = useState<Record<number, string>>({});
  // Light indices can change on removal or Undo. Do not carry a draft onto another light.
  useEffect(() => { setRadiusDrafts({}); setLightError(null); }, [render.lights]);
  const current: Appearance = selectedKeys.length ? render.appearances[selectedKeys[0]] ?? render.defaultAppearance : render.defaultAppearance;
  const setLook = (patch: Partial<Appearance>) => {
    const next = { ...current, ...patch };
    if (!selectedKeys.length) onChange({ ...render, defaultAppearance: next });
    else onChange({ ...render, appearances: { ...render.appearances, ...Object.fromEntries(selectedKeys.map(k => [k, next])) } });
  };
  const clearLook = () => {
    const appearances = { ...render.appearances };
    for (const k of selectedKeys) delete appearances[k];
    onChange({ ...render, appearances });
  };
  const changeLights = (lights: readonly RenderLight[]) => {
    try { changeRenderLights(render, lights, onChange); setLightError(null); setRadiusDrafts({}); }
    catch (error) { setLightError(error instanceof Error ? error.message : String(error)); }
  };
  const setLight = (i: number, l: RenderLight) => changeLights(render.lights.map((x, k) => k === i ? l : x));
  const env = render.environment, setEnv = (patch: Partial<RenderSettings['environment']>) => onChange({ ...render, environment: { ...env, ...patch } });
  // (G15d.1: the post, neutral until set; set back to neutral, it is dropped from the settings.)
  const post: RenderPost = env.post ?? NO_POST;
  const setPost = (patch: Partial<RenderPost>) => {
    const next = { ...post, ...patch }, neutral = next.grade === 'neutral' && next.contrast === 1 && next.saturation === 1 && next.vignette === 0 && !next.bloom && !next.depthOfField;
    if (!next.bloom) delete next.bloom;
    const rest = { ...env }; delete rest.post;
    onChange({ ...render, environment: neutral ? rest : { ...rest, post: next } });
  };
  const [pickingFocus, setPickingFocus] = useState(false);
  const cancelFocus = useRef<(() => void) | undefined>(undefined);
  const latestPost = useRef({ post, setPost }); latestPost.current = { post, setPost };
  useEffect(() => () => { cancelFocus.current?.(); }, []);
  const pickFocus = () => {
    if (pickingFocus) { cancelFocus.current?.(); cancelFocus.current = undefined; setPickingFocus(false); return; }
    setPickingFocus(true);
    const cancel = onPickFocus(focus => {
      cancelFocus.current = undefined; setPickingFocus(false);
      if (focus !== null) latestPost.current.setPost({ depthOfField: { focus, blur: latestPost.current.post.depthOfField?.blur ?? 6 } });
    });
    cancelFocus.current = cancel;
    if (!cancel) setPickingFocus(false);
  };
  // (A preset is the look's material — colour, metal, roughness, opacity and G15a's finish, coat and film; a texture or
  // a shader on top leaves it chosen. Choosing one replaces all of those, so a finish never carries over to one without.)
  const preset = APPEARANCES.find(p => PRESET_KEYS.every(k => JSON.stringify(p.appearance[k]) === JSON.stringify(current[k])))?.id ?? '';

  const slider = (label: string, value: number, set: (v: number) => void, min = 0, max = 1, step = 0.01) => (
    <label className={FIELD} key={label}><span>{label}</span>
      <span className={SLIDER}><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} /><em>{Math.round(value * 100) / 100}</em></span></label>);
  const color = (label: string, value: Hex, set: (v: Hex) => void) => (
    <label className={FIELD} key={label}><span>{label}</span><input type="color" className="w-[62%]" aria-label={label} value={full(value)} onChange={e => set(e.target.value as Hex)} /></label>);
  const check = (label: string, value: boolean, set: (v: boolean) => void, name = label) => (
    <label className={FIELD} key={label}><span>{label}</span><input type="checkbox" className={TICK} aria-label={name} checked={value} onChange={e => set(e.target.checked)} /></label>);

  return (
    <aside className="card props render-panel" aria-label="Render">
      <div className="card-title">RENDER
        <button className="tool tiny" aria-label="Export image" title="Export the view as a PNG" disabled={!available || (method === 'path-tracing' && !traceSamples)} onClick={() => { if (method === 'path-tracing') void exportStill(); else onExport(); }}><Icon name="photo_camera" small /></button></div>
      {!available && <div className="empty">Rendering needs a browser with WebGPU. The view below is the modelling look.</div>}
      <label className={FIELD}><span>Render method</span><NativeSelect className={CONTROL} aria-label="Render method" value={method} onChange={event => {
        disposeTrace(); setTraceRunning(false); setTraceBusy(false); setTraceSamples(0); setTracePreviewSamples(0); setTraceError(null); setMethod(event.target.value as typeof method);
      }}><option value="raster">Raster</option><option value="path-tracing">Path tracing</option></NativeSelect></label>
      {method === 'path-tracing' && <div className="render-section" aria-label="Path tracing" data-trace-running={traceRunning}>
        {!available && <div role="status">Path tracing needs WebGPU. The WebGL2 viewport stays interactive.</div>}
        <div className="muted small">A frozen still. Camera and scene changes stay in the live view. Start again to use them.</div>
        <div className="muted small">The still includes surfaces, materials, tone mapping and colour grading. Bloom, depth of field, outlines, overlays and shadow catchers stay in the live view.</div>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" aria-label="Start path tracing" disabled={!available || traceRunning || traceBusy} onClick={() => { void startTrace(); }}>Start</Button>
          <Button variant="ghost" aria-label="Stop path tracing" disabled={!traceRunning && !traceBusy} onClick={stopTrace}>Stop</Button>
        </div>
        <output aria-label="Path trace samples">{traceBusy ? 'Preparing still…' : `${traceSamples} samples`}</output>
        <label className={FIELD}><span>Denoise still</span><input type="checkbox" className={TICK} aria-label="Denoise still" checked={denoise} onChange={event => {
          denoiseRef.current = event.target.checked; setDenoise(event.target.checked);
          if (trace.current?.samples) void showTrace(trace.current, traceEpoch.current);
        }} /></label>
        <canvas ref={tracePreview} aria-label="Path trace preview" width={0} height={0} style={{ width: '100%', height: 'auto' }} />
        {tracePreviewSamples > 0 && <div className="muted small">{trace.current?.width} × {trace.current?.height} px · preview {tracePreviewSamples} samples · frozen still</div>}
        {traceError && <div role="alert" className="diag">{traceError}</div>}
      </div>}
      <div className="tabs" role="tablist">
        {(['look', 'lights', 'scene', 'source'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'look' ? 'Appearance' : t === 'lights' ? 'Lights' : t === 'scene' ? 'Scene' : 'Source'}</button>)}
      </div>

      {tab === 'look' && <div className="render-section [&>[data-slot=button]]:self-start">
        <div className="muted small">{selectedKeys.length ? `${selectedKeys.length} selected bod${selectedKeys.length > 1 ? 'ies' : 'y'}` : 'Every body without its own appearance'}</div>
        <label className={FIELD}><span>Preset</span>
          <NativeSelect className={CONTROL} aria-label="Appearance preset" value={preset} onChange={e => { const p = APPEARANCES.find(x => x.id === e.target.value); if (p) setLook({ finish: undefined, clearcoat: undefined, film: undefined, ...p.appearance }); }}>
            <option value="">Custom</option>
            {APPEARANCES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </NativeSelect></label>
        {color('Colour', current.color, v => setLook({ color: v }))}
        {slider('Metallic', current.metallic, v => setLook({ metallic: v }))}
        {slider('Roughness', current.roughness, v => setLook({ roughness: v }))}
        {slider('Opacity', current.opacity, v => setLook({ opacity: v }), 0.05)}
        {check('Two-sided', !!current.twoSided, v => setLook({ twoSided: v || undefined }))}
        <div className={FIELD}><span>Texture</span>
          <span className="texture-row">
            {current.texture && <img className="texture-thumb" src={current.texture.image} alt="" />}
            <Button variant="ghost" asChild><label className="file-button">{current.texture ? 'Replace…' : 'Image…'}
              <input type="file" accept="image/*" aria-label="Texture image" hidden onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                try { setLook({ texture: { image: await textureImage(file), scale: current.texture?.scale ?? 20 } }); }
                catch { onError?.('That file is not an image the browser can read.'); }
              }} /></label></Button>
            {current.texture && <Button variant="ghost" size="xs" aria-label="Remove texture" onClick={() => setLook({ texture: undefined })}><Icon name="close" small /></Button>}
          </span></div>
        {current.texture && slider('Cut out below', current.cutout ?? 0, v => setLook({ cutout: v > 0 ? v : undefined }))}
        {current.texture && <label className={FIELD}><span>Repeat every</span><span className={NUM}><Input type="number" aria-label="Texture repeat" min={0.1} step="any" value={current.texture.scale}
          onChange={e => { const v = Number(e.target.value); if (v > 0) setLook({ texture: { ...current.texture!, scale: v } }); }} onKeyDown={e => e.stopPropagation()} /><em>mm</em></span></label>}
        <label className={FIELD}><span>Finish</span>
          <NativeSelect className={CONTROL} aria-label="Surface finish" value={current.finish?.kind ?? ''} onChange={e => {
            const kind = e.target.value as FinishKind | '';
            setLook({ finish: kind ? { ...(current.finish ?? FINISH_START), kind } : undefined });
          }}>
            <option value="">None</option>
            {FINISH_KINDS.map(k => <option key={k} value={k}>{FINISH_LABEL[k]}</option>)}
          </NativeSelect></label>
        {current.finish && <>
          {slider('Marks', current.finish.scale, v => setLook({ finish: { ...current.finish!, scale: v } }), 0.05, 3, 0.05)}
          {slider('Depth', current.finish.strength, v => setLook({ finish: { ...current.finish!, strength: v } }))}
          {current.finish.kind !== 'cast' && current.finish.kind !== 'sand-cast' && current.finish.kind !== 'blasted' && <label className={FIELD}><span>Along</span>
            <NativeSelect className={CONTROL} aria-label="Finish direction" value={axisName(current.finish.axis)} onChange={e => setLook({ finish: { ...current.finish!, axis: AXES[e.target.value as keyof typeof AXES] } })}>
              <option value="x">X</option><option value="y">Y</option><option value="z">Z</option></NativeSelect></label>}
        </>}
        {slider('Clear coat', current.clearcoat ?? 0, v => setLook({ clearcoat: v > 0 ? v : undefined }))}
        {slider('Oil film', current.film ?? 0, v => setLook({ film: v > 0 ? v : undefined }))}
        <label className={FIELD}><span>Shader</span>
          <NativeSelect className={CONTROL} aria-label="Shader material" value={current.shader ?? ''} onChange={e => setLook({ shader: e.target.value || undefined })}>
            <option value="">None</option>
            {Object.keys(render.materials).map(n => <option key={n} value={n}>{n}</option>)}
          </NativeSelect></label>
        {selectedKeys.some(k => render.appearances[k]) && <Button variant="ghost" onClick={clearLook}>Use the default appearance</Button>}
      </div>}

      {tab === 'lights' && <div className="render-section [&>[data-slot=button]]:self-start">
        <div className="muted small">Shadow limits: first 4 sun lights, first 4 spot lights, and one of the first 8 point lights.</div>
        {lightError && <div className="diag" role="alert">{lightError}</div>}
        {render.lights.map((l, i) => {
          const [az, el] = anglesOf(l.kind === 'point' ? [0, 0, -1] : l.direction);
          return <div className="light" key={i}>
            <div className="card-title">{l.kind === 'directional' ? 'SUN' : l.kind === 'point' ? 'POINT' : 'SPOT'} {i + 1}
              <Button variant="ghost" size="xs" aria-label={`Remove light ${i + 1}`} onClick={() => changeLights(render.lights.filter((_, k) => k !== i))}><Icon name="close" small /></Button></div>
            {l.kind !== 'point' && <>
              {slider('Azimuth', az, v => setLight(i, { ...l, direction: directionFrom(v, el) }), -180, 180, 1)}
              {slider('Elevation', el, v => setLight(i, { ...l, direction: directionFrom(az, v) }), -89, 89, 1)}
            </>}
            {l.kind !== 'directional' && ['X', 'Y', 'Z'].map((a, k) => (
              <label className={FIELD} key={a}><span>{a}</span><span className={NUM}><Input type="number" step="any" aria-label={`Light ${i + 1} ${a}`} value={l.position[k]}
                onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) { const p = [...l.position] as [number, number, number]; p[k] = v; setLight(i, { ...l, position: p }); } }} /><em>mm</em></span></label>))}
            {l.kind === 'spot' && slider('Cone', l.angle, v => setLight(i, { ...l, angle: v }), 5, 80, 1)}
            {l.kind !== 'directional' && <>{slider('Range', l.range, v => setLight(i, { ...l, range: v }), 0, 1000, 5)}<div className="muted small">{l.range ? `Fades out over ${l.range} mm` : 'Range 0: no fall-off with distance'}</div></>}
            {slider('Intensity', l.intensity, v => setLight(i, { ...l, intensity: v }), 0, 5)}
            {color('Colour', l.color, v => setLight(i, { ...l, color: v }))}
            {check('Shadow', !!l.castShadow, v => setLight(i, { ...l, castShadow: v }), `Light ${i + 1} shadow`)}
            {l.kind !== 'directional' && <>
              <label className={FIELD}><span>Shadow radius</span><span className={NUM}><Input type="number" min={0} step="any" aria-label={`Light ${i + 1} shadow radius mm`}
                aria-describedby={`light-shadow-radius-${i}`} placeholder="Default (0 mm)" value={radiusDrafts[i] ?? (l.shadowRadius === undefined ? '' : String(l.shadowRadius))}
                onChange={e => {
                  const text = e.target.value;
                  setRadiusDrafts(drafts => ({ ...drafts, [i]: text }));
                  if (!text.trim()) { setLightError(`Enter a radius for light ${i + 1} in mm, or press Esc to keep the saved value.`); return; }
                  setLight(i, { ...l, shadowRadius: Number(text) });
                }} onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Escape') { setRadiusDrafts(drafts => { const next = { ...drafts }; delete next[i]; return next; }); setLightError(null); }
                }} /><em>mm</em></span></label>
              <div className="muted small" id={`light-shadow-radius-${i}`}>{l.castShadow ? '0 mm uses the default edge. A larger radius softens the shadow.' : 'Radius is kept while shadow is off.'}</div>
            </>}
          </div>;
        })}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" onClick={() => changeLights([...render.lights, { kind: 'directional', direction: directionFrom(45, 45), color: '#ffffff', intensity: 1, castShadow: false }])}>Add sun</Button>
          <Button variant="ghost" onClick={() => changeLights([...render.lights, { kind: 'point', position: [0, 0, 80], color: '#ffffff', intensity: 1, range: 0 }])}>Add point</Button>
          <Button variant="ghost" onClick={() => changeLights([...render.lights, { kind: 'spot', position: [0, -80, 80], direction: [0, 0.7, -0.7], color: '#ffffff', intensity: 1.5, range: 0, angle: 30, penumbra: 0.3 }])}>Add spot</Button>
        </div>
      </div>}

      {tab === 'source' && <SourceTab render={render} onChange={onChange} />}

      {tab === 'scene' && <div className="render-section [&>[data-slot=button]]:self-start">
        {color('Top', env.top, v => setEnv({ top: v }))}
        {color('Bottom', env.bottom, v => setEnv({ bottom: v }))}
        {slider('Ambient', env.ambient, v => setEnv({ ambient: v }), 0, 2)}
        <label className={FIELD}><span>Studio</span>
          <NativeSelect className={CONTROL} aria-label="Studio environment" value={env.map ? 'image' : env.studio?.kind ?? ''} onChange={e => {
            const kind = e.target.value as StudioKind | '' | 'image';
            if (kind === 'image') return;
            const rest = { ...env }; delete rest.map; delete rest.studio;
            onChange({ ...render, environment: kind ? { ...rest, studio: { kind, intensity: env.studio?.intensity ?? 1 } } : rest });
          }}>
            <option value="">Sky and ground</option><option value="softbox">Softboxes</option><option value="cyclorama">Cyclorama</option>
            {env.map && <option value="image">Image</option>}
          </NativeSelect></label>
        <div className={FIELD}><span>Environment</span>
          <span className="texture-row">
            {env.map && <img className="texture-thumb" src={env.map.image} alt="" />}
            <Button variant="ghost" asChild><label className="file-button" title="An equirectangular image (its top row overhead) that lights the part in place of the sky and ground">{env.map ? 'Replace…' : 'Image…'}
              <input type="file" accept="image/*" aria-label="Environment image" hidden onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                try { const image = await textureImage(file, 2048), rest = { ...env }; delete rest.studio; onChange({ ...render, environment: { ...rest, map: { image, intensity: env.map?.intensity ?? env.studio?.intensity ?? 1 } } }); }
                catch { onError?.('That file is not an image the browser can read.'); }
              }} /></label></Button>
            {env.map && <Button variant="ghost" size="xs" aria-label="Remove environment" onClick={() => setEnv({ map: undefined })}><Icon name="close" small /></Button>}
          </span></div>
        {env.map && slider('Environment strength', env.map.intensity, v => setEnv({ map: { ...env.map!, intensity: v } }), 0, 4)}
        {!env.map && env.studio && slider('Environment strength', env.studio.intensity, v => setEnv({ studio: { ...env.studio!, intensity: v } }), 0, 4)}
        {check('Occlusion', env.occlusion, v => setEnv({ occlusion: v }))}
        {check('Ground', env.ground, v => setEnv({ ground: v }))}
        {check('Grid', env.grid, v => setEnv({ grid: v }))}
        {check('Edges', env.edges, v => setEnv({ edges: v }))}
        <div className="card-title" style={{ marginTop: 10 }}>POST</div>
        {slider('Exposure', env.exposure, v => setEnv({ exposure: v }), 0.1, 4)}
        <label className={FIELD}><span>Tone map</span>
          <NativeSelect className={CONTROL} aria-label="Tone mapping" value={env.toneMapping} onChange={e => setEnv({ toneMapping: e.target.value as RenderSettings['environment']['toneMapping'] })}>
            <option value="aces">Filmic (ACES)</option><option value="agx">Soft highlights (AgX)</option><option value="none">None</option></NativeSelect></label>
        <label className={FIELD}><span>Grade</span>
          <NativeSelect className={CONTROL} aria-label="Colour grade" value={post.grade} onChange={e => setPost({ grade: e.target.value as RenderPost['grade'] })}>
            <option value="neutral">Neutral</option><option value="warm">Warm studio</option><option value="cool">Cool daylight</option></NativeSelect></label>
        {slider('Contrast', post.contrast, v => setPost({ contrast: v }), 0.5, 1.5)}
        {slider('Saturation', post.saturation, v => setPost({ saturation: v }), 0, 2)}
        {slider('Vignette', post.vignette, v => setPost({ vignette: v }))}
        {slider('Bloom', post.bloom ?? 0, v => setPost({ bloom: v > 0 ? v : undefined }))}
        <div className="card-title" style={{ marginTop: 10 }}>CAMERA</div>
        {slider('Field of view', fov, onFov, 10, 90, 1)}
        <label className={FIELD}><span>Focus distance</span><span className={NUM}><Input type="number" aria-label="Focus distance" min={0.001} step="any" value={post.depthOfField?.focus ?? render.camera?.distance ?? 160}
          onChange={e => { const focus = Number(e.target.value); if (Number.isFinite(focus) && focus > 0) setPost({ depthOfField: { focus, blur: post.depthOfField?.blur ?? 0 } }); }} onKeyDown={e => e.stopPropagation()} /><em>mm</em></span></label>
        <label className={FIELD}><span>Blur radius</span><span className={NUM}><Input type="number" aria-label="Blur radius" min={0} max={24} step={0.5} value={post.depthOfField?.blur ?? 0}
          onChange={e => { const blur = Number(e.target.value); if (Number.isFinite(blur) && blur >= 0 && blur <= 24) setPost({ depthOfField: { focus: post.depthOfField?.focus ?? render.camera?.distance ?? 160, blur } }); }} onKeyDown={e => e.stopPropagation()} /><em>px</em></span></label>
        <Button variant="ghost" disabled={!available} aria-pressed={pickingFocus} onClick={pickFocus}>{pickingFocus ? 'Cancel focus pick' : 'Pick focus on part'}</Button>
        {pickingFocus && <div role="status" className="muted small">Click a surface to set focus. A background click cancels.</div>}
        {!available && <div role="status" className="muted small">Depth of field needs WebGPU. Your focus and blur settings are saved.</div>}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" onClick={onSaveCamera}>Save this view</Button>
          <Button variant="ghost" disabled={!render.camera} onClick={onUseCamera}>Go to saved view</Button>
        </div>
      </div>}
    </aside>
  );
}

const PRESET_KEYS = ['color', 'metallic', 'roughness', 'opacity', 'finish', 'clearcoat', 'film'] as const;
/** G15a: the finishes' names, a new finish's start, and its direction by axis. */
const FINISH_LABEL: Record<FinishKind, string> = { cast: 'Cast', 'sand-cast': 'Sand-cast', machined: 'Machined', turned: 'Turned', brushed: 'Brushed', knurled: 'Knurled', blasted: 'Bead-blasted' };
const FINISH_START: AppearanceFinish = { kind: 'cast', scale: 0.5, strength: 0.6 };
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } as const satisfies Record<string, [number, number, number]>;
const axisName = (a: AppearanceFinish['axis']): keyof typeof AXES => {
  if (!a) return 'z';
  const m = [Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2])];
  return m[0] >= m[1] && m[0] >= m[2] ? 'x' : m[1] >= m[2] ? 'y' : 'z';
};

const NO_POST: RenderPost = { grade: 'neutral', contrast: 1, saturation: 1, vignette: 0 };

/** #rgb as #rrggbb (the colour input wants six digits). */
const full = (h: Hex) => h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;

/** The scene's sources: props as a CSS-shaped scene, and authored @shader materials by name. Drafts apply when they compile. */
function SourceTab({ render, onChange }: { render: RenderSettings; onChange(next: RenderSettings): void }) {
  const [scene, setScene] = useState(render.scene);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(render.materials);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setScene(render.scene); setDrafts(render.materials); }, [render.scene, render.materials]);
  const applyScene = () => {
    if (!scene.trim()) { setSceneError(null); onChange({ ...render, scene: '' }); return; }
    const r = compileGpu({ kind: 'scene', source: scene, ...(/\bversion\s*:\s*1\s*;/.test(scene) ? { sourceVersion: 1 as const } : {}) });
    if (!r.ok) { setSceneError(r.diagnostics.map(d => d.message).join('\n')); return; }
    setSceneError(null); onChange({ ...render, scene });
  };
  const applyMaterial = (name: string) => {
    const r = materialShader(drafts[name] ?? '');
    if (!r.ok) { setErrors(e => ({ ...e, [name]: r.diagnostics.map(d => d.message).join('\n') })); return; }
    setErrors(e => { const n = { ...e }; delete n[name]; return n; });
    onChange({ ...render, materials: { ...render.materials, [name]: drafts[name] } });
  };
  const addMaterial = () => {
    let n = 1; while (render.materials[`material${n}`]) n++;
    onChange({ ...render, materials: { ...render.materials, [`material${n}`]: MATERIAL_TEMPLATE } });
  };
  const removeMaterial = (name: string) => {
    const materials = { ...render.materials }; delete materials[name];
    // Bodies that used it go back to no shader.
    const strip = (a: Appearance) => a.shader === name ? { ...a, shader: undefined } : a;
    onChange({ ...render, materials, defaultAppearance: strip(render.defaultAppearance), appearances: Object.fromEntries(Object.entries(render.appearances).map(([k, a]) => [k, strip(a)])) });
  };
  return <div className="render-section [&>[data-slot=button]]:self-start">
    <div className="card-title">PROPS · CSS SCENE</div>
    <textarea className="code" aria-label="Props source" spellCheck={false} rows={7} value={scene} placeholder="@scene props { version: 0; box #plinth; }" onChange={e => setScene(e.target.value)} />
    {sceneError && <div className="diag" role="alert">{sceneError}</div>}
    <label className={FIELD}><span>Unit</span><span className={NUM}><Input type="number" step="any" min={0.001} aria-label="Props scale" value={render.sceneScale}
      onChange={e => { const v = Number(e.target.value); if (v > 0) onChange({ ...render, sceneScale: v }); }} /><em>mm</em></span></label>
    <div className="flex flex-wrap gap-1">
      <Button variant="default" disabled={scene === render.scene} onClick={applyScene}>Apply props</Button>
      {!scene && <Button variant="ghost" onClick={() => setScene(SCENE_TEMPLATE)}>Example</Button>}
    </div>
    <div className="card-title" style={{ marginTop: 10 }}>MATERIALS · @SHADER</div>
    {Object.keys(render.materials).map(name => <div className="light" key={name}>
      <div className="card-title">{name}<Button variant="ghost" size="xs" aria-label={`Remove material ${name}`} onClick={() => removeMaterial(name)}>×</Button></div>
      <textarea className="code" aria-label={`Material ${name} source`} spellCheck={false} rows={5} value={drafts[name] ?? ''} onChange={e => setDrafts(d => ({ ...d, [name]: e.target.value }))} />
      {errors[name] && <div className="diag" role="alert">{errors[name]}</div>}
      <Button variant="ghost" disabled={drafts[name] === render.materials[name]} onClick={() => applyMaterial(name)}>Apply {name}</Button>
    </div>)}
    <Button variant="ghost" onClick={addMaterial}>Add material</Button>
  </div>;
}

/** An image file as a data URL for a texture, at most `most` (1024) pixels across (PNG keeps transparency; others JPEG). */
async function textureImage(file: File, most = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file), k = Math.min(1, most / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bitmap.width * k)); c.height = Math.max(1, Math.round(bitmap.height * k));
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height); bitmap.close();
  return c.toDataURL(file.type === 'image/png' || file.type === 'image/gif' ? 'image/png' : 'image/jpeg', 0.9);
}
