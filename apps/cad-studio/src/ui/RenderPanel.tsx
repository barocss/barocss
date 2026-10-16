import { useState } from 'react';
import { APPEARANCES, anglesOf, directionFrom, type Appearance, type Hex, type RenderLight, type RenderSettings } from '../engine/render';
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
  const [tab, setTab] = useState<'look' | 'lights' | 'scene'>('look');
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
        {(['look', 'lights', 'scene'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'look' ? 'Appearance' : t === 'lights' ? 'Lights' : 'Scene'}</button>)}
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
