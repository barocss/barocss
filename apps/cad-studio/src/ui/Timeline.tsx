import { useEffect, useState } from 'react';
import { offsetsAt, withKey, type RenderAnimation } from '../engine/render';
import { Icon } from './atoms';

/**
 * The Render workspace's timeline: play, scrub, the duration and a turntable; for the selected body, its
 * offset at the current time and its keys (set one, jump to one, remove one).
 */
export function Timeline({ animation, time, playing, bodyKey, bodyLabel, onTime, onPlay, onChange }: {
  animation: RenderAnimation; time: number; playing: boolean;
  bodyKey: string | null; bodyLabel: string;
  onTime(t: number): void; onPlay(on: boolean): void; onChange(next: RenderAnimation): void;
}) {
  const keys = bodyKey ? animation.tracks[bodyKey] ?? [] : [];
  const now = bodyKey ? offsetsAt(animation, time).get(bodyKey) ?? [0, 0, 0] : [0, 0, 0];
  const [offset, setOffset] = useState<[number, number, number]>(now as [number, number, number]);
  useEffect(() => setOffset(now as [number, number, number]), [bodyKey, time, animation]); // eslint-disable-line react-hooks/exhaustive-deps
  const setKey = () => { if (bodyKey) onChange({ ...animation, tracks: { ...animation.tracks, [bodyKey]: withKey(keys, { t: round(time), offset }) } }); };
  const removeKey = (t: number) => {
    if (!bodyKey) return;
    const rest = keys.filter(k => k.t !== t), tracks = { ...animation.tracks };
    if (rest.length) tracks[bodyKey] = rest; else delete tracks[bodyKey];
    onChange({ ...animation, tracks });
  };
  const animated = Object.keys(animation.tracks).length;
  return (
    <div className="card timeline" aria-label="Timeline">
      <button className="tool" aria-label={playing ? 'Pause' : 'Play'} onClick={() => onPlay(!playing)}><Icon name={playing ? 'pause' : 'play_arrow'} /></button>
      <input className="scrub" type="range" aria-label="Time" min={0} max={animation.duration} step={0.01} value={time} onChange={e => onTime(Number(e.target.value))} />
      <span className="mono">{time.toFixed(2)} / </span>
      <input className="mono dur" type="number" aria-label="Duration" min={0.1} step={0.5} value={animation.duration}
        onChange={e => { const v = Number(e.target.value); if (v >= 0.1) onChange({ ...animation, duration: v }); }} /><span className="mono">s</span>
      <label className="check-inline"><input type="checkbox" aria-label="Turntable" checked={animation.turntable} onChange={e => onChange({ ...animation, turntable: e.target.checked })} />Turntable</label>
      <div className="sep" />
      {bodyKey ? <>
        <span className="muted small">{bodyLabel}</span>
        {(['X', 'Y', 'Z'] as const).map((a, k) => <input key={a} className="mono off" type="number" step="any" aria-label={`Offset ${a}`} title={`Offset ${a} (mm)`} placeholder={a} value={offset[k]}
          onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) setOffset(o => o.map((x, j) => j === k ? v : x) as [number, number, number]); }} />)}
        <button className="ghost" onClick={setKey}>Set key</button>
        {keys.map(k => <span key={k.t} className="key-chip"><button className="link" title="Go to this key" onClick={() => onTime(k.t)}>{k.t}s</button>
          <button className="link" aria-label={`Remove key at ${k.t}s`} onClick={() => removeKey(k.t)}>×</button></span>)}
      </> : <span className="muted small">{animated ? `${animated} animated bod${animated > 1 ? 'ies' : 'y'} · ` : ''}Select a body to key its position.</span>}
    </div>
  );
}

const round = (t: number) => Math.round(t * 100) / 100;
