import { useEffect, useState } from 'react';
import { compileGpu, materialShader } from '@barocss/gpu';
import { APPEARANCES, MATERIAL_TEMPLATE, SCENE_TEMPLATE, anglesOf, directionFrom, type Appearance, type Hex, type RenderLight, type RenderSettings } from '../engine/render';
import { Icon } from './atoms';

/**
 * The Render workspace's panel: the appearance of the selected bodies (or of every body without one),
 * the lights, the environment and the saved camera. Every change is one undoable edit of the settings.
 */
export function RenderPanel({ render, selectedKeys, onChange, onSaveCamera, onUseCamera, onExport, available }: {
  render: RenderSettings;
  /** Body keys the appearance edits apply to; empty: the default appearance. */
  selectedKeys: string[];
  onChange(next: RenderSettings): void;
  onSaveCamera(): void;
  onUseCamera(): void;
  onExport(): void;
  /** False when the viewport draws without WebGPU (no rendering). */
  available: boolean;
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
  const preset = APPEARANCES.find(p => JSON.stringify(p.appearance) === JSON.stringify(current))?.id ?? '';

  const slider = (label: string, value: number, set: (v: number) => void, min = 0, max = 1, step = 0.01) => (
    <label className="field" key={label}><span>{label}</span>
      <span className="slider"><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} /><em>{Math.round(value * 100) / 100}</em></span></label>);
  const color = (label: string, value: Hex, set: (v: Hex) => void) => (
    <label className="field" key={label}><span>{label}</span><input type="color" aria-label={label} value={full(value)} onChange={e => set(e.target.value as Hex)} /></label>);
  const check = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="field check-row" key={label}><span>{label}</span><input type="checkbox" aria-label={label} checked={value} onChange={e => set(e.target.checked)} /></label>);

  return (
    <aside className="card props render-panel" aria-label="Render">
      <div className="card-title">RENDER
        <button className="tool tiny" aria-label="Export image" title="Export the view as a PNG" disabled={!available} onClick={onExport}><Icon name="photo_camera" small /></button></div>
      {!available && <div className="empty">Rendering needs a browser with WebGPU. The view below is the modelling look.</div>}
      <div className="tabs" role="tablist">
        {(['look', 'lights', 'scene', 'source'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'look' ? 'Appearance' : t === 'lights' ? 'Lights' : t === 'scene' ? 'Scene' : 'Source'}</button>)}
      </div>

      {tab === 'look' && <div className="render-section">
        <div className="muted small">{selectedKeys.length ? `${selectedKeys.length} selected bod${selectedKeys.length > 1 ? 'ies' : 'y'}` : 'Every body without its own appearance'}</div>
        <label className="field"><span>Preset</span>
          <select aria-label="Appearance preset" value={preset} onChange={e => { const p = APPEARANCES.find(x => x.id === e.target.value); if (p) setLook(p.appearance); }}>
            <option value="">Custom</option>
            {APPEARANCES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></label>
        {color('Colour', current.color, v => setLook({ color: v }))}
        {slider('Metallic', current.metallic, v => setLook({ metallic: v }))}
        {slider('Roughness', current.roughness, v => setLook({ roughness: v }))}
        {slider('Opacity', current.opacity, v => setLook({ opacity: v }), 0.05)}
        <label className="field"><span>Shader</span>
          <select aria-label="Shader material" value={current.shader ?? ''} onChange={e => setLook({ shader: e.target.value || undefined })}>
            <option value="">None</option>
            {Object.keys(render.materials).map(n => <option key={n} value={n}>{n}</option>)}
          </select></label>
        {selectedKeys.some(k => render.appearances[k]) && <button className="ghost" onClick={clearLook}>Use the default appearance</button>}
      </div>}

      {tab === 'lights' && <div className="render-section">
        {render.lights.map((l, i) => {
          const [az, el] = anglesOf(l.kind === 'point' ? [0, 0, -1] : l.direction);
          return <div className="light" key={i}>
            <div className="card-title">{l.kind === 'directional' ? 'SUN' : l.kind === 'point' ? 'POINT' : 'SPOT'} {i + 1}
              <button className="tool tiny" aria-label={`Remove light ${i + 1}`} onClick={() => onChange({ ...render, lights: render.lights.filter((_, k) => k !== i) })}><Icon name="close" small /></button></div>
            {l.kind !== 'point' && <>
              {slider('Azimuth', az, v => setLight(i, { ...l, direction: directionFrom(v, el) }), -180, 180, 1)}
              {slider('Elevation', el, v => setLight(i, { ...l, direction: directionFrom(az, v) }), -89, 89, 1)}
            </>}
            {l.kind !== 'directional' && ['X', 'Y', 'Z'].map((a, k) => (
              <label className="field" key={a}><span>{a}</span><span className="num"><input type="number" step="any" aria-label={`Light ${i + 1} ${a}`} value={l.position[k]}
                onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) { const p = [...l.position] as [number, number, number]; p[k] = v; setLight(i, { ...l, position: p }); } }} /><em>mm</em></span></label>))}
            {l.kind === 'spot' && slider('Cone', l.angle, v => setLight(i, { ...l, angle: v }), 5, 80, 1)}
            {slider('Intensity', l.intensity, v => setLight(i, { ...l, intensity: v }), 0, 5)}
            {color('Colour', l.color, v => setLight(i, { ...l, color: v }))}
            {l.kind === 'directional' && check('Shadow', l.castShadow, v => onChange({ ...render, lights: render.lights.map((x, k) => x.kind === 'directional' ? { ...x, castShadow: k === i ? v : v ? false : x.castShadow } : x) }))}
          </div>;
        })}
        <div className="row-actions">
          <button className="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'directional', direction: directionFrom(45, 45), color: '#ffffff', intensity: 1, castShadow: false }] })}>Add sun</button>
          <button className="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'point', position: [0, 0, 80], color: '#ffffff', intensity: 1, range: 0 }] })}>Add point</button>
          <button className="ghost" onClick={() => onChange({ ...render, lights: [...render.lights, { kind: 'spot', position: [0, -80, 80], direction: [0, 0.7, -0.7], color: '#ffffff', intensity: 1.5, range: 0, angle: 30, penumbra: 0.3 }] })}>Add spot</button>
        </div>
      </div>}

      {tab === 'source' && <SourceTab render={render} onChange={onChange} />}

      {tab === 'scene' && <div className="render-section">
        {color('Top', env.top, v => setEnv({ top: v }))}
        {color('Bottom', env.bottom, v => setEnv({ bottom: v }))}
        {slider('Ambient', env.ambient, v => setEnv({ ambient: v }), 0, 2)}
        {slider('Exposure', env.exposure, v => setEnv({ exposure: v }), 0.1, 4)}
        <label className="field"><span>Tone map</span>
          <select aria-label="Tone mapping" value={env.toneMapping} onChange={e => setEnv({ toneMapping: e.target.value as 'none' | 'aces' })}>
            <option value="aces">Filmic (ACES)</option><option value="none">None</option></select></label>
        {check('Occlusion', env.occlusion, v => setEnv({ occlusion: v }))}
        {check('Ground', env.ground, v => setEnv({ ground: v }))}
        {check('Grid', env.grid, v => setEnv({ grid: v }))}
        {check('Edges', env.edges, v => setEnv({ edges: v }))}
        <div className="card-title" style={{ marginTop: 10 }}>CAMERA</div>
        <div className="row-actions">
          <button className="ghost" onClick={onSaveCamera}>Save this view</button>
          <button className="ghost" disabled={!render.camera} onClick={onUseCamera}>Go to saved view</button>
        </div>
      </div>}
    </aside>
  );
}

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
  return <div className="render-section">
    <div className="card-title">PROPS · CSS SCENE</div>
    <textarea className="code" aria-label="Props source" spellCheck={false} rows={7} value={scene} placeholder="@scene props { version: 0; box #plinth; }" onChange={e => setScene(e.target.value)} />
    {sceneError && <div className="diag" role="alert">{sceneError}</div>}
    <label className="field"><span>Unit</span><span className="num"><input type="number" step="any" min={0.001} aria-label="Props scale" value={render.sceneScale}
      onChange={e => { const v = Number(e.target.value); if (v > 0) onChange({ ...render, sceneScale: v }); }} /><em>mm</em></span></label>
    <div className="row-actions">
      <button className="primary" disabled={scene === render.scene} onClick={applyScene}>Apply props</button>
      {!scene && <button className="ghost" onClick={() => setScene(SCENE_TEMPLATE)}>Example</button>}
    </div>
    <div className="card-title" style={{ marginTop: 10 }}>MATERIALS · @SHADER</div>
    {Object.keys(render.materials).map(name => <div className="light" key={name}>
      <div className="card-title">{name}<button className="tool tiny" aria-label={`Remove material ${name}`} onClick={() => removeMaterial(name)}>×</button></div>
      <textarea className="code" aria-label={`Material ${name} source`} spellCheck={false} rows={5} value={drafts[name] ?? ''} onChange={e => setDrafts(d => ({ ...d, [name]: e.target.value }))} />
      {errors[name] && <div className="diag" role="alert">{errors[name]}</div>}
      <button className="ghost" disabled={drafts[name] === render.materials[name]} onClick={() => applyMaterial(name)}>Apply {name}</button>
    </div>)}
    <button className="ghost" onClick={addMaterial}>Add material</button>
  </div>;
}
