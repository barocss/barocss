import { useState } from 'react';
import type { PartInstance } from '../engine/doc';
import { BASE } from '../assembly/mates';
import type { JointTree, JointType } from '../robot/joints';
import { sliderRange } from '../robot/fk';
import type { LinkInertia } from '../robot/inertia';

const TYPE_LABEL: Record<JointType, string> = { fixed: 'Fixed', revolute: 'Revolute', continuous: 'Continuous', prismatic: 'Prismatic' };
const axisText = (a: readonly number[]) => { const k = a.findIndex(x => Math.abs(Math.abs(x) - 1) < 1e-9); return k >= 0 ? `${a[k] < 0 ? '−' : '+'}${'XYZ'[k]}` : `[${a.map(x => x.toFixed(3)).join(', ')}]`; };
const limitText = (l: NonNullable<JointTree['joints'][number]['limit']>, type: JointType) => [l.lower !== undefined && l.upper !== undefined ? `${l.lower} … ${l.upper} ${type === 'prismatic' ? 'mm' : 'rad'}` : '', l.effort !== undefined ? `${l.effort} ${type === 'prismatic' ? 'N' : 'N·m'}` : '', l.velocity !== undefined ? `${l.velocity} ${type === 'prismatic' ? 'mm/s' : 'rad/s'}` : ''].filter(Boolean).join(' · ');

/** A gear pair at the pose shown: its phase against home, its backlash (RM2). */
export interface GearLine { leader: string; follower: string; multiplier: number; held: boolean; backlashMM: number }
const DEG = 180 / Math.PI;
/** One decimal, a rounding of zero shown as 0.0 (not −0.0). */
/** A torque or force to 4 significant figures, a rounding of zero as 0. */
const fmtTorque = (v: number) => (Math.abs(v) < 1e-12 ? '0' : Number(v.toPrecision(4)).toString());
const mm1 = (v: number) => { const t = v.toFixed(1); return t === '-0.0' ? '0.0' : t; };

/**
 * The assembly as a robot (RM1): the base link, the joints the mates make, loops, gear couplings and what blocks a link;
 * and (RM2) a slider a moving joint to pose it — degrees for a turn, mm for a slide — Home, and one joint played back
 * and forth. A follower moves with its leader (no slider of its own). The pose is a preview: nothing is saved.
 */
export function JointsPanel({ tree, instances, onBase, values, onValue, onHome, playing, onPlay, gears, links, onExportUrdf, onExportMjcf, onCheckPath, path, ready = true, holding, waypoints = 0, onAddWaypoint, onClearWaypoints, onWorkspace, workspace, onWorkspaceDownload, onWorkspaceHide, onExportSdf, onExportUsd }: {
  tree: JointTree; instances: PartInstance[]; onBase(base: string): void;
  values: Record<string, number>; onValue(key: string, v: number): void; onHome(): void; playing: string | null; onPlay(key: string | null): void; gears: GearLine[];
  /** Each link's mass properties (RM3), in its link frame. */
  links?: LinkInertia[];
  /** Writes the robot as URDF (RM4), a zip of robot.urdf and its meshes. */
  onExportUrdf?(): void;
  /** Writes the robot as a MuJoCo MJCF model (RM5), a zip of robot.xml and its meshes. */
  onExportMjcf?(): void;
  /** Writes the robot as SDF 1.11 (RM9c), a zip of robot.sdf and its meshes; and as a USD stage (UsdPhysics), one .usda. */
  onExportSdf?(): void; onExportUsd?(): void;
  /** Sweeps the path from the solved pose through the waypoints to the sliders' (RM6, RM9a: timed, its time of impact); the result to show. */
  onCheckPath?(): void;
  /** The waypoints recorded (RM9a), and recording one at the pose shown, or clearing them. */
  waypoints?: number; onAddWaypoint?(): void; onClearWaypoints?(): void;
  /** Maps the end link's workspace (RM9b): N samples, voxels of h mm, poses in self-contact left out when asked; its summary, download and hide. */
  onWorkspace?(samples: number, h: number, contactFree: boolean): void; workspace?: string | null; onWorkspaceDownload?(): void; onWorkspaceHide?(): void;
  path?: { text: string; contact: boolean } | null;
  /** Every part evaluated: the masses, exports and the path check wait until then. */
  ready?: boolean;
  /** Each joint's static gravity torque (N·m) or force (N) at the pose shown (RD1). */
  holding?: Record<string, number>;
}) {
  const [wsN, setWsN] = useState(20000), [wsH, setWsH] = useState(10), [wsFree, setWsFree] = useState(false);
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
            {holding && j.type !== 'fixed' && <div className="kv muted" aria-label={`Joint ${j.key} holding`}>holds {fmtTorque(holding[j.key] ?? 0)} {turn ? 'N·m' : 'N'} against gravity</div>}
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
      {path && <div className={path.contact ? 'hud-error' : 'kv muted'} role="status" aria-label="Path check">{path.text}</div>}
      {onWorkspace && tree.joints.some(j => j.type !== 'fixed') && <div className="kv" aria-label="Workspace">
        <label>N <input type="number" aria-label="Workspace samples" min={100} max={200000} step={1000} value={wsN} onChange={e => setWsN(Number(e.target.value))} style={{ width: 70 }} /></label>
        <label> h <input type="number" aria-label="Workspace voxel" min={0.5} step={1} value={wsH} onChange={e => setWsH(Number(e.target.value))} style={{ width: 48 }} /> mm</label>
        <label title="Leave out poses where two links interpenetrate (RM6's exact test): slower"> <input type="checkbox" aria-label="Workspace contact-free" checked={wsFree} onChange={e => setWsFree(e.target.checked)} /> contact-free</label>
        <button className="ghost" aria-label="Map workspace" disabled={!ready || !(wsN >= 1 && wsH > 0)} title="The positions the end link's joint point reaches over the joints' ranges, coloured by manipulability" onClick={() => onWorkspace(wsN, wsH, wsFree)}>Workspace</button></div>}
      {workspace && <div className="kv muted" role="status" aria-label="Workspace summary">{workspace} {onWorkspaceDownload && <button className="ghost small" aria-label="Download workspace" onClick={onWorkspaceDownload}>JSON</button>}{onWorkspaceHide && <button className="ghost small" aria-label="Hide workspace" onClick={onWorkspaceHide}>Hide</button>}</div>}
      <div className="row-actions">{tree.joints.some(j => j.type !== 'fixed') && <button className="ghost" aria-label="Joints home" onClick={onHome}>Home</button>}
        {onAddWaypoint && Object.values(values).some(v => v !== 0) && <button className="ghost" aria-label="Add waypoint" title="Record this pose as a waypoint: Check path goes through the waypoints in order, then to the pose shown" onClick={onAddWaypoint}>Add waypoint</button>}
        {onClearWaypoints && waypoints > 0 && <button className="ghost" aria-label="Clear waypoints" onClick={onClearWaypoints}>Clear {waypoints} waypoint{waypoints === 1 ? '' : 's'}</button>}
        {onCheckPath && (waypoints > 0 || Object.values(values).some(v => v !== 0)) && <button className="ghost" aria-label="Check path" disabled={!ready} title="Sweep the timed path from the solved pose (through the waypoints) to this one for collisions between links: the time of impact, or the whole path certified" onClick={onCheckPath}>Check path</button>}
        {onExportUrdf && <button className="ghost" aria-label="Export URDF" disabled={!ready} title={ready ? undefined : 'The parts are still being evaluated'} onClick={onExportUrdf}>Export URDF</button>}
        {onExportMjcf && <button className="ghost" aria-label="Export MJCF" disabled={!ready} title={ready ? undefined : 'The parts are still being evaluated'} onClick={onExportMjcf}>Export MJCF</button>}
        {onExportSdf && <button className="ghost" aria-label="Export SDF" disabled={!ready} title={ready ? 'SDFormat 1.11 (Gazebo): links, inertia, meshes, joints, a loop as a ball joint' : 'The parts are still being evaluated'} onClick={onExportSdf}>Export SDF</button>}
        {onExportUsd && <button className="ghost" aria-label="Export USD" disabled={!ready} title={ready ? 'A USD stage (.usda) with UsdPhysics rigid bodies and joints' : 'The parts are still being evaluated'} onClick={onExportUsd}>Export USD</button>}</div>
      {links?.filter(l => l.part !== null).map(l => {
        const bad = l.issues.filter(i => i.code !== 'MATERIAL_ASSUMED'), assumed = l.issues.some(i => i.code === 'MATERIAL_ASSUMED');
        return <div key={l.link} aria-label={`Link ${l.link} mass`} title={`inertia about the centre of mass, link frame (kg·m²): ${l.principal.moments.map(m => m.toExponential(3)).join(', ')} principal`}>
          <div className="kv">{name(l.link)} <b>{mm1(l.massKg * 1000)} g</b></div>
          <div className="kv muted">CoM ({l.comM.map(v => mm1(v * 1000)).join(', ')}) mm{assumed ? ' · material assumed' : ''}</div>
          {bad.map((i, k) => <div key={k} className="hud-error" role="status">{i.message}</div>)}
        </div>;
      })}
      {tree.loops.map(l => <div key={l.parts.join('~')} className="kv" aria-label="Loop">Loop <b>{name(l.parts[0])} – {name(l.parts[1])}</b> <span className="muted">{l.mates.join(', ')}</span></div>)}
      {tree.problems.map((p, i) => <div key={i} className="hud-error" role="status" aria-label={`Joint problem ${p.code}`}>{p.message}</div>)}
      {!tree.joints.length && !tree.problems.length && <div className="empty">Mate parts to the base part to make joints.</div>}
    </aside>
  );
}
