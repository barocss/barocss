// A section's kind (CG5, DR-3): Full, Half (cut on one side of a centreline, the view's exterior on the other) or Offset
// (stepped: from each step's place on, the plane at another depth). Only for a principal section; its centreline and
// steps are in the section view's coordinates (model mm), their defaults through the middle of the view.
// DR-4: Removed (only the cut face, apart from the views at its own scale; dragged on the sheet to move it) and Revolved
// (the cut face turned onto the view that sees its plane edge-on); an aligned section may be Full or Removed.
import { useState } from 'react';
import type { DrawingSection, DrawingViews, SectionStep } from '@barocss/cad-model/drawing/types';
import { SCALES, scaleLabel } from '@barocss/cad-model/drawing/views';
import { Icon } from '../atoms';
import { CONTROL, FIELD } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

const round = (v: number) => Math.round(v * 100) / 100 + 0;
/** A row of several controls: wraps inside the panel rather than widening it. */
const WRAP = `${FIELD} flex-wrap justify-start`;

export function SectionKind({ section: x, views, onSet }: { section: DrawingSection; views: DrawingViews | null; onSet(next: DrawingSection): void }) {
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null);
  const kind = x.half ? 'half' : x.steps ? 'offset' : x.removed ? 'removed' : x.revolved ? 'revolved' : 'full', pr = views?.[x.view];
  const mid = (axis: 0 | 1) => pr ? round((pr.min[axis] + pr.max[axis]) / 2) : 0;
  const plain = (): DrawingSection => { const rest = { ...x }; delete rest.half; delete rest.steps; delete rest.along; delete rest.removed; delete rest.revolved; return rest; };
  const num = (key: string, value: number, label: string, set: (v: number) => void) => <Input key={key} type="number" className="w-16 text-right" step="any" aria-label={label} value={draft?.key === key ? draft.text : value}
    onChange={e => setDraft({ key, text: e.target.value })}
    onBlur={() => { const v = Number(draft?.text); if (draft?.key === key && draft.text.trim() !== '' && Number.isFinite(v)) set(v); setDraft(null); }}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
  const setSteps = (steps: SectionStep[]) => { const sorted = [...steps].sort((a, b) => a.past - b.past); if (sorted.some((s, k) => k && s.past === sorted[k - 1].past)) return; onSet({ ...x, steps: sorted }); };
  return <>
    <label className={FIELD}><span>Section {x.id} kind</span><NativeSelect className={CONTROL} aria-label={`Section ${x.id} kind`} value={kind} onChange={e => {
      const k = e.target.value;
      onSet(k === 'half' ? { ...plain(), half: { line: 'vertical', at: mid(0), cut: 'after' } } : k === 'offset' ? { ...plain(), steps: [{ past: mid(0), at: x.at }] } : k === 'removed' ? { ...plain(), removed: {} } : k === 'revolved' ? { ...plain(), revolved: true } : plain());
    }}><option value="full">Full</option>{!x.dir && <><option value="half">Half</option><option value="offset">Offset (stepped)</option></>}<option value="removed">Removed</option>{!x.dir && <option value="revolved">Revolved</option>}</NativeSelect></label>
    {x.removed && <label className={FIELD}><span>Section {x.id} scale</span><NativeSelect className={CONTROL} aria-label={`Section ${x.id} scale`} value={x.removed.scale === undefined ? 'sheet' : String(x.removed.scale)} onChange={e => { const rest = { ...x.removed! }; delete rest.scale; onSet({ ...x, removed: e.target.value === 'sheet' ? rest : { ...rest, scale: Number(e.target.value) } }); }}>
      <option value="sheet">The sheet’s</option>{SCALES.map(k => <option key={k} value={String(k)}>{scaleLabel(k)}</option>)}</NativeSelect></label>}
    {x.half && <div className={WRAP} aria-label={`Section ${x.id} centreline`}>
      <NativeSelect className={CONTROL} aria-label={`Section ${x.id} centreline direction`} value={x.half.line} onChange={e => { const line = e.target.value as 'vertical'; onSet({ ...x, half: { ...x.half!, line, at: mid(line === 'vertical' ? 0 : 1) } }); }}>
        <option value="vertical">Vertical at</option><option value="horizontal">Horizontal at</option></NativeSelect>
      {num(`h${x.id}`, x.half.at, `Section ${x.id} centreline at`, v => onSet({ ...x, half: { ...x.half!, at: v } }))}
      <NativeSelect className={CONTROL} aria-label={`Section ${x.id} cut side`} value={x.half.cut} onChange={e => onSet({ ...x, half: { ...x.half!, cut: e.target.value as 'after' } })}>
        <option value="after">{x.half.line === 'vertical' ? 'cut right' : 'cut above'}</option><option value="before">{x.half.line === 'vertical' ? 'cut left' : 'cut below'}</option></NativeSelect>
    </div>}
    {x.steps && <>
      <label className={FIELD}><span>Steps along</span><NativeSelect className={CONTROL} aria-label={`Section ${x.id} steps along`} value={x.along ?? 'horizontal'} onChange={e => { const along = e.target.value as 'vertical'; const rest = { ...x }; delete rest.along; onSet(along === 'vertical' ? { ...rest, along, steps: x.steps!.map(s => ({ ...s, past: mid(1) })).slice(0, 1) } : { ...rest, steps: x.steps!.map(s => ({ ...s, past: mid(0) })).slice(0, 1) }); }}>
        <option value="horizontal">across</option><option value="vertical">up</option></NativeSelect></label>
      {x.steps.map((st, k) => <div key={k} className={WRAP} aria-label={`Section ${x.id} step ${k + 1}`}>
        <span>from</span>{num(`p${x.id}${k}`, st.past, `Section ${x.id} step ${k + 1} from`, v => setSteps(x.steps!.map((s, i) => i === k ? { ...s, past: v } : s)))}
        <span>depth</span>{num(`a${x.id}${k}`, st.at, `Section ${x.id} step ${k + 1} depth`, v => setSteps(x.steps!.map((s, i) => i === k ? { ...s, at: v } : s)))}
        <Button variant="ghost" size="xs" aria-label={`Remove section ${x.id} step ${k + 1}`} disabled={x.steps!.length === 1} onClick={() => setSteps(x.steps!.filter((_, i) => i !== k))}><Icon name="close" small /></Button>
      </div>)}
      <Button variant="ghost" className="self-start" aria-label={`Add section ${x.id} step`} onClick={() => { const last = x.steps!.at(-1)!, end = pr ? pr.max[x.along === 'vertical' ? 1 : 0] : last.past + 10; setSteps([...x.steps!, { past: round((last.past + end) / 2), at: last.at }]); }}>Add step</Button>
    </>}
  </>;
}
