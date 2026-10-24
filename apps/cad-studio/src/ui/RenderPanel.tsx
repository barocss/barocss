import { useEffect, useState } from 'react';
import { compileGpu, materialShader } from '@barocss/gpu';
import { APPEARANCES, MATERIAL_TEMPLATE, SCENE_TEMPLATE, anglesOf, directionFrom, type Appearance, type Hex, type RenderLight, type RenderPost, type RenderSettings } from '@barocss/cad-model/engine/render';
import { Icon } from './atoms';
import { CONTROL, FIELD, NUM, SLIDER, TICK } from './panelStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

/**
 * The Render workspace's panel: the appearance of the selected bodies (or of every body without one),
 * the lights, the environment and the saved camera. Every change is one undoable edit of the settings. O16: the
 * contents on shadcn (Button, Input, NativeSelect, FIELD / NUM / SLIDER rows); the shell (its title and Export image),
 * the tabs, the colour and range inputs and the source editors are the studio's.
 */
export function RenderPanel({ render, selectedKeys, onChange, onSaveCamera, onUseCamera, onExport, available, fov, onFov, onError }: {
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
  onError?(message: string): void;
}) {
  const [tab, setTab] = useState<'look' | 'lights' | 'scene' | 'source'>('look');
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
  const setLight = (i: number, l: RenderLight) => onChange({ ...render, lights: render.lights.map((x, k) => k === i ? l : x) });
  const env = render.environment, setEnv = (patch: Partial<RenderSettings['environment']>) => onChange({ ...render, environment: { ...env, ...patch } });
  // (G15d.1: the post, neutral until set; set back to neutral, it is dropped from the settings.)
  const post: RenderPost = env.post ?? NO_POST;
  const setPost = (patch: Partial<RenderPost>) => {
    const next = { ...post, ...patch }, neutral = next.grade === 'neutral' && next.contrast === 1 && next.saturation === 1 && next.vignette === 0;
    const rest = { ...env }; delete rest.post;
    onChange({ ...render, environment: neutral ? rest : { ...rest, post: next } });
  };
  const preset = APPEARANCES.find(p => JSON.stringify(p.appearance) === JSON.stringify(current))?.id ?? '';

  const slider = (label: string, value: number, set: (v: number) => void, min = 0, max = 1, step = 0.01) => (
    <label className={FIELD} key={label}><span>{label}</span>
      <span className={SLIDER}><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} /><em>{Math.round(value * 100) / 100}</em></span></label>);
  const color = (label: string, value: Hex, set: (v: Hex) => void) => (
    <label className={FIELD} key={label}><span>{label}</span><input type="color" className="w-[62%]" aria-label={label} value={full(value)} onChange={e => set(e.target.value as Hex)} /></label>);
  const check = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className={FIELD} key={label}><span>{label}</span><input type="checkbox" className={TICK} aria-label={label} checked={value} onChange={e => set(e.target.checked)} /></label>);

  return (
    <aside className="card props render-panel" aria-label="Render">
      <div className="card-title">RENDER
        <button className="tool tiny" aria-label="Export image" title="Export the view as a PNG" disabled={!available} onClick={onExport}><Icon name="photo_camera" small /></button></div>
      {!available && <div className="empty">Rendering needs a browser with WebGPU. The view below is the modelling look.</div>}
      <div className="tabs" role="tablist">
        {(['look', 'lights', 'scene', 'source'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'look' ? 'Appearance' : t === 'lights' ? 'Lights' : t === 'scene' ? 'Scene' : 'Source'}</button>)}
      </div>

      {tab === 'look' && <div className="render-section [&>[data-slot=button]]:self-start">
        <div className="muted small">{selectedKeys.length ? `${selectedKeys.length} selected bod${selectedKeys.length > 1 ? 'ies' : 'y'}` : 'Every body without its own appearance'}</div>
        <label className={FIELD}><span>Preset</span>
          <NativeSelect className={CONTROL} aria-label="Appearance preset" value={preset} onChange={e => { const p = APPEARANCES.find(x => x.id === e.target.value); if (p) setLook(p.appearance); }}>
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
        <label className={FIELD}><span>Shader</span>
          <NativeSelect className={CONTROL} aria-label="Shader material" value={current.shader ?? ''} onChange={e => setLook({ shader: e.target.value || undefined })}>
            <option value="">None</option>
            {Object.keys(render.materials).map(n => <option key={n} value={n}>{n}</option>)}
          </NativeSelect></label>
        {selectedKeys.some(k => render.appearances[k]) && <Button variant="ghost" onClick={clearLook}>Use the default appearance</Button>}
      </div>}

      {tab === 'lights' && <div className="render-section [&>[data-slot=button]]:self-start">
        {render.lights.map((l, i) => {
          const [az, el] = anglesOf(l.kind === 'point' ? [0, 0, -1] : l.direction);
          return <div className="light" key={i}>
            <div className="card-title">{l.kind === 'directional' ? 'SUN' : l.kind === 'point' ? 'POINT' : 'SPOT'} {i + 1}
              <Button variant="ghost" size="xs" aria-label={`Remove light ${i + 1}`} onClick={() => onChange({ ...render, lights: render.lights.filter((_, k) => k !== i) })}><Icon name="close" small /></Button></div>
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
            {l.kind === 'directional' && check('Shadow', l.castShadow, v => onChange({ ...render, lights: render.lights.map((x, k) => x.kind === 'directional' ? { ...x, castShadow: k === i ? v : v ? false : x.castShadow } : x) }))}
          </div>;
        })}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'directional', direction: directionFrom(45, 45), color: '#ffffff', intensity: 1, castShadow: false }] })}>Add sun</Button>
          <Button variant="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'point', position: [0, 0, 80], color: '#ffffff', intensity: 1, range: 0 }] })}>Add point</Button>
          <Button variant="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'spot', position: [0, -80, 80], direction: [0, 0.7, -0.7], color: '#ffffff', intensity: 1.5, range: 0, angle: 30, penumbra: 0.3 }] })}>Add spot</Button>
        </div>
      </div>}

      {tab === 'source' && <SourceTab render={render} onChange={onChange} />}

      {tab === 'scene' && <div className="render-section [&>[data-slot=button]]:self-start">
        {color('Top', env.top, v => setEnv({ top: v }))}
        {color('Bottom', env.bottom, v => setEnv({ bottom: v }))}
        {slider('Ambient', env.ambient, v => setEnv({ ambient: v }), 0, 2)}
        <div className={FIELD}><span>Environment</span>
          <span className="texture-row">
            {env.map && <img className="texture-thumb" src={env.map.image} alt="" />}
            <Button variant="ghost" asChild><label className="file-button" title="An equirectangular image (its top row overhead) that lights the part in place of the sky and ground">{env.map ? 'Replace…' : 'Image…'}
              <input type="file" accept="image/*" aria-label="Environment image" hidden onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                try { setEnv({ map: { image: await textureImage(file, 2048), intensity: env.map?.intensity ?? 1 } }); }
                catch { onError?.('That file is not an image the browser can read.'); }
              }} /></label></Button>
            {env.map && <Button variant="ghost" size="xs" aria-label="Remove environment" onClick={() => setEnv({ map: undefined })}><Icon name="close" small /></Button>}
          </span></div>
        {env.map && slider('Environment strength', env.map.intensity, v => setEnv({ map: { ...env.map!, intensity: v } }), 0, 4)}
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
        <div className="card-title" style={{ marginTop: 10 }}>CAMERA</div>
        {slider('Field of view', fov, onFov, 10, 90, 1)}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" onClick={onSaveCamera}>Save this view</Button>
          <Button variant="ghost" disabled={!render.camera} onClick={onUseCamera}>Go to saved view</Button>
        </div>
      </div>}
    </aside>
  );
}

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
