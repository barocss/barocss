import { useEffect, useState } from 'react';
import { offsetsAt, withKey, type RenderAnimation } from '@barocss/cad-model/engine/render';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';

/**
 * The Render workspace's timeline: play, scrub, the duration and a turntable; for the selected body, its
 * offset at the current time and its keys (set one, jump to one, remove one). (G12f: its button, fields and Set key
 * shadcn's.)
 */
const NUM = 'w-14 h-6! [font-family:var(--mono)] bg-[var(--bg)]';
export function Timeline({ animation, time, playing, bodyKey, bodyLabel, onTime, onPlay, onChange, onExportVideo, exporting }: {
  animation: RenderAnimation; time: number; playing: boolean;
  bodyKey: string | null; bodyLabel: string;
  onTime(t: number): void; onPlay(on: boolean): void; onChange(next: RenderAnimation): void;
  /** A WebM of the animation over its duration — the turntable, the keyed bodies (RS2's recorder). */
  onExportVideo?(): void; exporting?: boolean;
}) {
  const keys = bodyKey ? animation.tracks[bodyKey] ?? [] : [];
  const now = bodyKey ? offsetsAt(animation, time).get(bodyKey) ?? [0, 0, 0] : [0, 0, 0];
  const [offset, setOffset] = useState<[number, number, number]>(now as [number, number, number]);
  useEffect(() => setOffset(now as [number, number, number]), [bodyKey, time, animation]);
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
      <ToolIconButton aria-label={playing ? 'Pause' : 'Play'} onClick={() => onPlay(!playing)}><Icon name={playing ? 'pause' : 'play_arrow'} /></ToolIconButton>
      <input className="scrub" type="range" aria-label="Time" min={0} max={animation.duration} step={0.01} value={time} onChange={e => onTime(Number(e.target.value))} />
      <span className="mono">{time.toFixed(2)} / </span>
      <Input className={'dur ' + NUM} type="number" aria-label="Duration" min={0.1} step={0.5} value={animation.duration}
        onChange={e => { const v = Number(e.target.value); if (v >= 0.1) onChange({ ...animation, duration: v }); }} /><span className="mono">s</span>
      <label className="check-inline"><input type="checkbox" aria-label="Turntable" checked={animation.turntable} onChange={e => onChange({ ...animation, turntable: e.target.checked })} />Turntable</label>
      {onExportVideo && <Button variant="ghost" aria-label="Export animation video" disabled={exporting} title="A WebM video of the animation over its duration (30 frames a second)" onClick={onExportVideo}>{exporting ? 'Recording…' : 'Video'}</Button>}
      <div className="sep" />
      {bodyKey ? <>
        <span className="muted small">{bodyLabel}</span>
        {(['X', 'Y', 'Z'] as const).map((a, k) => <Input key={a} className={'off ' + NUM} type="number" step="any" aria-label={`Offset ${a}`} title={`Offset ${a} (mm)`} placeholder={a} value={offset[k]}
          onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) setOffset(o => o.map((x, j) => j === k ? v : x) as [number, number, number]); }} />)}
        <Button variant="ghost" onClick={setKey}>Set key</Button>
        {keys.map(k => <span key={k.t} className="key-chip"><button className="link" title="Go to this key" onClick={() => onTime(k.t)}>{k.t}s</button>
          <button className="link" aria-label={`Remove key at ${k.t}s`} onClick={() => removeKey(k.t)}>×</button></span>)}
      </> : <span className="muted small">{animated ? `${animated} animated bod${animated > 1 ? 'ies' : 'y'} · ` : ''}Select a body to key its position.</span>}
    </div>
  );
}

const round = (t: number) => Math.round(t * 100) / 100;
