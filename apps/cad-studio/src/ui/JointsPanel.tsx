import type { PartInstance } from '../engine/doc';
import { BASE } from '../assembly/mates';
import type { JointTree, JointType } from '../robot/joints';

const TYPE_LABEL: Record<JointType, string> = { fixed: 'Fixed', revolute: 'Revolute', continuous: 'Continuous', prismatic: 'Prismatic' };
const axisText = (a: readonly number[]) => { const k = a.findIndex(x => Math.abs(Math.abs(x) - 1) < 1e-9); return k >= 0 ? `${a[k] < 0 ? '−' : '+'}${'XYZ'[k]}` : `[${a.map(x => x.toFixed(3)).join(', ')}]`; };
const limitText = (l: NonNullable<JointTree['joints'][number]['limit']>, type: JointType) => [l.lower !== undefined && l.upper !== undefined ? `${l.lower} … ${l.upper} ${type === 'prismatic' ? 'mm' : 'rad'}` : '', l.effort !== undefined ? `${l.effort} ${type === 'prismatic' ? 'N' : 'N·m'}` : '', l.velocity !== undefined ? `${l.velocity} ${type === 'prismatic' ? 'mm/s' : 'rad/s'}` : ''].filter(Boolean).join(' · ');

/** The assembly as a robot (RM1): the base link, the joints the mates make, loops, gear couplings and what blocks a link. */
export function JointsPanel({ tree, instances, onBase }: { tree: JointTree; instances: PartInstance[]; onBase(base: string): void }) {
  const name = (link: string) => tree.links.find(l => l.id === link)?.name ?? (link === BASE ? 'Base part' : instances.find(i => i.id === link)?.name ?? link);
  return (
    <aside className="card props" aria-label="Joints">
      <div className="card-title">JOINTS <span className="muted">{tree.joints.length || ''}</span></div>
      <label className="field"><span>Base link</span>
        <select aria-label="Base link" value={tree.base} onChange={e => onBase(e.target.value)}>
          <option value={BASE}>Base part</option>
          {instances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select></label>
      {tree.joints.map(j => (
        <div key={j.key} className="kv" aria-label={`Joint ${j.key}`} title={`mates ${j.mates.join(', ') || 'none'}`}>
          {name(j.parent)} → {name(j.child)} <b>{TYPE_LABEL[j.type]}{j.type !== 'fixed' ? ` ${axisText(j.axis)}` : ''}{j.mimic ? ` · follows ${j.mimic.joint} ×${j.mimic.multiplier.toFixed(4)}` : ''}</b>
          {j.limit && <span className="muted"> {limitText(j.limit, j.type)}</span>}
        </div>
      ))}
      {tree.loops.map(l => <div key={l.parts.join('~')} className="kv" aria-label="Loop">Loop <b>{name(l.parts[0])} – {name(l.parts[1])}</b> <span className="muted">{l.mates.join(', ')}</span></div>)}
      {tree.problems.map((p, i) => <div key={i} className="hud-error" role="status" aria-label={`Joint problem ${p.code}`}>{p.message}</div>)}
      {!tree.joints.length && !tree.problems.length && <div className="empty">Mate parts to the base part to make joints.</div>}
    </aside>
  );
}
