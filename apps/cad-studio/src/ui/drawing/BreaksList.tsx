// The drawing's breaks (CG5, DR-2): each a band along a model axis left out of the front, top and right views, with its
// axis and ends (model mm) and a remove button; Add break puts the middle third of the part's longest axis.
import { useState } from 'react';
import type { DrawingSettings, DrawingViews } from '@barocss/cad-model/drawing/types';
import { BREAK_AXES, breaksMeet, suggestBreak, type DrawingBreak } from '@barocss/cad-model/drawing/breaks';
import { Icon } from '../atoms';
import { CONTROL, FIELD } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

export function BreaksList({ settings, views, onChange, onRefused }: { settings: DrawingSettings; views: DrawingViews | null; onChange(next: DrawingSettings): void; onRefused(why: string): void }) {
  const list = settings.breaks ?? [], [draft, setDraft] = useState<{ k: number; end: 'from' | 'to'; text: string } | null>(null);
  const set = (next: DrawingBreak[]) => { const rest = { ...settings }; delete rest.breaks; onChange(next.length ? { ...rest, breaks: next } : rest); };
  // (A change that would reverse a break or make two on one axis meet is not made, and said.)
  const edit = (k: number, b: DrawingBreak) => {
    if (!(b.from < b.to)) { onRefused('A break runs from a smaller value to a larger one.'); return; }
    if (list.some((o, i) => i !== k && breaksMeet(o, b))) { onRefused(`It would overlap another break along ${b.axis.toUpperCase()}.`); return; }
    set(list.map((o, i) => i === k ? b : o));
  };
  const offer = views ? suggestBreak(views, list) : null;
  return <>
    <div className="card-title">BREAKS</div>
    {list.map((b, k) => <div key={k} className={`${FIELD} flex-wrap justify-start`} aria-label={`Break ${k + 1}`}>
      <NativeSelect className={CONTROL} aria-label={`Break ${k + 1} axis`} value={b.axis} onChange={e => edit(k, { ...b, axis: e.target.value as DrawingBreak['axis'] })}>
        {BREAK_AXES.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
      </NativeSelect>
      {(['from', 'to'] as const).map(end => <span key={end} className="num flex items-center gap-1"><Input type="number" className="w-16 text-right" step="any" aria-label={`Break ${k + 1} ${end}`} value={draft?.k === k && draft.end === end ? draft.text : b[end]}
        onChange={e => setDraft({ k, end, text: e.target.value })}
        onBlur={() => { const v = Number(draft?.text); if (draft?.k === k && draft.end === end && draft.text.trim() !== '' && Number.isFinite(v)) edit(k, { ...b, [end]: v }); setDraft(null); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></span>)}
      <em>mm</em>
      <Button variant="ghost" size="xs" aria-label={`Remove break ${k + 1}`} title="Remove this break" onClick={() => set(list.filter((_, i) => i !== k))}><Icon name="close" small /></Button>
    </div>)}
    <Button variant="ghost" className="self-start" aria-label="Add break" disabled={!offer} title="Leave the middle third of the part's longest axis out of the views (change its ends after)" onClick={() => { if (offer) set([...list, offer]); }}>Add break</Button>
  </>;
}
