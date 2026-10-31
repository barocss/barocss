import type { PartInstance } from '@barocss/cad-model/engine/doc';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CUT_DIRS, type CutAxis, type CutDraft } from '../app/assemblyCutDraft';
import { Icon } from './atoms';
import { FIELD } from './panelStyles';

// Roadmap 10 ⑤ (#2180): the Assembly cut's HUD — a hole or pocket across placed parts, in the assembly's frame. The primary fields are
// the profile and its size, the centre, the direction, the depth and the parts; the name is under Details, closed. The viewport shows
// the cut parts as the draft would leave them; Apply is one undo step.

const NUMBER = 'w-16 min-w-0 text-right';

export function AssemblyCutHud({ draft, instances, problem, onChange, onAddSelected, onApply, onCancel }: {
  draft: CutDraft;
  instances: readonly PartInstance[];
  /** Why the draft is not a cut yet (plain words), or undefined. */
  problem: string | undefined;
  onChange(patch: Partial<CutDraft>): void;
  /** Add the parts selected in the Browser or the view to the parts to cut (the ones already there stay). */
  onAddSelected(): void;
  onApply(): void; onCancel(): void;
}) {
  const nameOf = (id: string) => instances.find(i => i.id === id)?.name ?? id;
  const set = <K extends keyof CutDraft>(k: K, v: CutDraft[K]) => onChange({ [k]: v } as Partial<CutDraft>);
  const num = (label: string, k: 'radius' | 'w' | 'd' | 'depth') => <label className={FIELD}><span>{label}</span><input aria-label={label} className={NUMBER} type="number" step="any" value={draft[k]} onChange={e => set(k, e.target.value)} /></label>;
  return (
    <aside className="card props" aria-label="Assembly cut">
      <div className="card-title">{draft.editing ? `CUT · ${draft.editing}` : 'ASSEMBLY CUT'}</div>
      <div className="flex flex-col gap-1 p-2">
        <label className={FIELD}><span>Profile</span>
          <select aria-label="Cut profile" value={draft.profile} onChange={e => set('profile', e.target.value as CutDraft['profile'])}><option value="circle">Circle</option><option value="rectangle">Rectangle</option></select></label>
        {draft.profile === 'circle' ? num('Radius mm', 'radius') : <>{num('Width mm', 'w')}{num('Depth mm', 'd')}</>}
        <div className={FIELD}><span>Centre mm</span>
          <span className="flex gap-1">{(['X', 'Y', 'Z'] as const).map((axis, k) => <input key={axis} aria-label={`Centre ${axis}`} className="w-14 min-w-0 text-right" type="number" step="any" value={draft.at[k]}
            onChange={e => set('at', draft.at.map((v, j) => j === k ? e.target.value : v) as CutDraft['at'])} />)}</span></div>
        <label className={FIELD}><span>Direction</span>
          <select aria-label="Cut direction" value={draft.dir} onChange={e => set('dir', e.target.value as CutAxis)}>
            {draft.dir === 'Custom' && <option value="Custom">Custom (as made)</option>}
            {(Object.keys(CUT_DIRS) as CutAxis[]).map(a => <option key={a} value={a}>{a.replace('-', '−')}</option>)}</select></label>
        <div className={FIELD}><span>Depth mm</span>
          <span className="flex items-center gap-1.5"><input aria-label="Cut depth" className={NUMBER} type="number" step="any" disabled={draft.through} value={draft.depth} onChange={e => set('depth', e.target.value)} />
            <label className="flex items-center gap-0.5"><input type="checkbox" className="size-3.5" aria-label="Through" checked={draft.through} onChange={e => set('through', e.target.checked)} />Through</label></span></div>
        <div className="flex flex-col gap-0.5" role="group" aria-label="Parts to cut">
          <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Parts</span>
            <Button variant="ghost" title="Add the parts selected in the Browser or the view" onClick={onAddSelected}>Add selected</Button></div>
          <div className="flex flex-wrap gap-1">
            {draft.targets.length ? draft.targets.map(id => <span key={id} className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-px text-[11px]" data-target={id}>
              {nameOf(id)}<button className="tool tiny" aria-label={`Do not cut ${nameOf(id)}`} onClick={() => set('targets', draft.targets.filter(t => t !== id))}><Icon name="close" small /></button></span>)
              : <span className="text-[11px] text-muted-foreground">None: select a part, then Add selected.</span>}
          </div>
        </div>
        <Collapsible>
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1 bg-transparent p-0 text-left text-[11px] text-foreground hover:text-[var(--accent)] [&[data-state=open]_.ms]:rotate-90"><Icon name="chevron_right" small />Details</CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-0.5 pt-1">
            <label className={FIELD}><span>Name</span><input aria-label="Cut name" className="w-32 min-w-0" type="text" maxLength={60} value={draft.name} onChange={e => set('name', e.target.value)} /></label>
            <div className="text-[10px] text-muted-foreground">A depth cuts one way from the profile plane, along the direction; Through cuts the whole part along the direction, both ways from the plane (a part longer than 10,000 mm cannot be cut through). The rectangle's width runs along X (along Y for a cut along X). Each part's definition stays whole; mates still read its uncut faces.</div>
          </CollapsibleContent>
        </Collapsible>
        {problem && <div className="empty warn" role="alert">{problem}</div>}
        <div className="flex gap-1.5">
          <Button variant="default" disabled={!!problem} onClick={onApply}>{draft.editing ? 'Apply' : 'Cut'}</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </aside>);
}
