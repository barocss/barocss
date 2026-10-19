import type { PartInstance } from '../engine/doc';
import { BASE } from '../assembly/mates';
import type { JointTree, JointType } from '../robot/joints';
import { sliderRange } from '../robot/fk';

const TYPE_LABEL: Record<JointType, string> = { fixed: 'Fixed', revolute: 'Revolute', continuous: 'Continuous', prismatic: 'Prismatic' };
const axisText = (a: readonly number[]) => { const k = a.findIndex(x => Math.abs(Math.abs(x) - 1) < 1e-9); return k >= 0 ? `${a[k] < 0 ? '−' : '+'}${'XYZ'[k]}` : `[${a.map(x => x.toFixed(3)).join(', ')}]`; };
const limitText = (l: NonNullable<JointTree['joints'][number]['limit']>, type: JointType) => [l.lower !== undefined && l.upper !== undefined ? `${l.lower} … ${l.upper} ${type === 'prismatic' ? 'mm' : 'rad'}` : '', l.effort !== undefined ? `${l.effort} ${type === 'prismatic' ? 'N' : 'N·m'}` : '', l.velocity !== undefined ? `${l.velocity} ${type === 'prismatic' ? 'mm/s' : 'rad/s'}` : ''].filter(Boolean).join(' · ');

/** A gear pair at the pose shown: its phase against home, its backlash (RM2). */
export interface GearLine { leader: string; follower: string; multiplier: number; held: boolean; backlashMM: number }
const DEG = 180 / Math.PI;

/**
 * The assembly as a robot (RM1): the base link, the joints the mates make, loops, gear couplings and what blocks a link;
 * and (RM2) a slider a moving joint to pose it — degrees for a turn, mm for a slide — Home, and one joint played back
 * and forth. A follower moves with its leader (no slider of its own). The pose is a preview: nothing is saved.
 */
export function JointsPanel({ tree, instances, onBase, values, onValue, onHome, playing, onPlay, gears }: {
  tree: JointTree; instances: PartInstance[]; onBase(base: string): void;
  values: Record<string, number>; onValue(key: string, v: number): void; onHome(): void; playing: string | null; onPlay(key: string | null): void; gears: GearLine[];
}) {
  const name = (link: string) => tree.links.find(l => l.id === link)?.name ?? (link === BASE ? 'Base part' : instances.find(i => i.id === link)?.name ?? link);
  return (
    <aside className="card props" aria-label="Joints">
      <div className="card-title">JOINTS <span className="muted">{tree.joints.length || ''}</span></div>
      <label className="field"><span>Base link</span>
        <select aria-label="Base link" value={tree.base} onChange={e => onBase(e.target.value)}>
          <option value={BASE}>Base part</option>
          {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select></label>
      {tree.joints.map(j => {
        const r = sliderRange(j), turn = j.type !== 'prismatic', v = values[j.key] ?? 0, shown = turn ? v * DEG : v;
        return (
          <div key={j.key} aria-label={`Joint ${j.key}`} title={`mates ${j.mates.join(', ') || 'none'}`}>
            <div className="kv">{name(j.parent)} → {name(j.child)} <b>{TYPE_LABEL[j.type]}{j.type !== 'fixed' ? ` ${axisText(j.axis)}` : ''}{j.mimic ? ` · follows ${j.mimic.joint} ×${j.mimic.multiplier.toFixed(4)}` : ''}</b>
              {j.limit && <span className="muted"> {limitText(j.limit, j.type)}</span>}</div>
            {j.type !== 'fixed' && !j.mimic && <div className="field" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="range" aria-label={`Joint ${j.key} value`} min={r.min} max={r.max} step="any" value={v} style={{ flex: 1 }}
                onChange={e => onValue(j.key, Number(e.target.value))} />
              <span className="muted" style={{ minWidth: 64, textAlign: 'right' }}>{shown.toFixed(1)} {turn ? '°' : 'mm'}</span>
              <button className="ghost" aria-label={`Play joint ${j.key}`} onClick={() => onPlay(playing === j.key ? null : j.key)}>{playing === j.key ? '■' : '▶'}</button>
            </div>}
            {j.mimic && <div className="kv muted">at {(turn ? (values[j.key] ?? 0) * DEG : values[j.key] ?? 0).toFixed(1)} {turn ? '°' : 'mm'}</div>}
          </div>
        );
      })}
      {gears.map(g => <div key={g.follower} className="kv" aria-label={`Gear pair ${g.follower}`}>Gears <b>{g.leader} → {g.follower} ×{g.multiplier.toFixed(4)}</b> <span className={g.held ? 'muted' : 'hud-error'}>{g.held ? 'mesh held' : 'teeth out of phase'} · backlash {g.backlashMM.toFixed(3)} mm</span></div>)}
      {tree.joints.some(j => j.type !== 'fixed') && <div className="row-actions"><button className="ghost" aria-label="Joints home" onClick={onHome}>Home</button></div>}
      {tree.loops.map(l => <div key={l.parts.join('~')} className="kv" aria-label="Loop">Loop <b>{name(l.parts[0])} – {name(l.parts[1])}</b> <span className="muted">{l.mates.join(', ')}</span></div>)}
      {tree.problems.map((p, i) => <div key={i} className="hud-error" role="status" aria-label={`Joint problem ${p.code}`}>{p.message}</div>)}
      {!tree.joints.length && !tree.problems.length && <div className="empty">Mate parts to the base part to make joints.</div>}
    </aside>
  );
}
