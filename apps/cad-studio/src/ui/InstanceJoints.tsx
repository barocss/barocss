import { useEffect, useMemo, useState } from 'react';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import { jointsOfInstance, type InstanceJoint } from '@barocss/cad-model/assembly/flexible';
import { Button } from '@/components/ui/button';
import { FIELD } from './panelStyles';

// Roadmap 10 4 (RS7.4): a sub-assembly occurrence keeps its own joint values. One row per joint of its sub-assembly: the value in
// degrees for a turn and mm for a slide, applied on Enter or when the box is left (one undo step), Reset back to the saved pose.

/** What to send for the boxes as typed: the joints whose box holds a number that is not already the value (empty or unfinished boxes are left). */
export function jointsEdit(joints: readonly InstanceJoint[], drafts: Readonly<Record<string, string>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const j of joints) {
    const text = drafts[j.key];
    if (text === undefined || text.trim() === '') continue;
    const v = Number(text);
    if (Number.isFinite(v) && v !== j.value) out[j.key] = v;
  }
  return out;
}
const unit = (j: InstanceJoint) => j.type === 'prismatic' ? 'mm' : '°';
/** The limits as the panel shows them ("−90 to 90 °"), or nothing for a joint without them. */
export const limitsText = (j: InstanceJoint): string => j.lower === undefined && j.upper === undefined ? '' : `${j.lower ?? '−∞'} to ${j.upper ?? '∞'} ${unit(j)}`;

/** The joints of an occurrence of a sub-assembly (nothing when it has none), each with its own value box, and Reset. */
export function InstanceJointsControls({ inst, onSet, onReset }: { inst: PartInstance; onSet(joints: Record<string, number>): void; onReset(): void }) {
  const info = useMemo(() => jointsOfInstance(inst), [inst]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => setDrafts({}), [inst]);
  if (!info.joints.length && !(inst.joints && info.problem)) return null;
  const commit = (j: InstanceJoint) => { const edit = jointsEdit([j], drafts); if (Object.keys(edit).length) onSet(edit); };
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2" role="group" aria-label="Instance joints">
      <div className="card-title">JOINTS (THIS OCCURRENCE)</div>
      {info.joints.map(j => (
        <label key={j.key} className={FIELD} title={limitsText(j) ? `Limits ${limitsText(j)}` : 'No limits'}>
          <span>{j.key} <i className="not-italic text-[10px] text-muted-foreground">{limitsText(j) || (j.type === 'continuous' ? 'free turn' : '')}</i></span>
          <input aria-label={`Joint ${j.key}`} type="number" step="any" value={drafts[j.key] ?? String(j.value)}
            onChange={e => setDrafts(d => ({ ...d, [j.key]: e.target.value }))} onBlur={() => commit(j)} onKeyDown={e => { if (e.key === 'Enter') commit(j); }} />
          <em className="not-italic font-mono text-[10px] text-muted-foreground">{unit(j)}</em>
        </label>))}
      {info.problem && inst.joints && <div className="empty warn" role="alert">{info.problem}. It stands as saved.</div>}
      <div className="row-actions" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <Button variant="ghost" disabled={!inst.joints} title="Back to the pose the sub-assembly was saved in" onClick={onReset}>Reset</Button>
      </div>
    </div>);
}
