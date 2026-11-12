import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONTROL, FIELD, NUM } from '../ui/panelStyles';
import type { useArcPathGap } from './useArcPathGap';

export function ArcPathGapControls({ gap }: { gap: ReturnType<typeof useArcPathGap> }) {
  if (!gap.available) return null;
  const draft = gap.visible;
  return <>
    <Button variant="ghost" aria-pressed={!!draft} onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
      onClick={gap.toggle}>Cut arc gap</Button>
    {draft && <>
      <label className={FIELD}><span>Gap length</span><span className={NUM}><Input className={CONTROL} aria-label="Gap length" type="number" step="any" value={draft.length}
        onChange={event => gap.setLength(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); event.preventDefault(); } }} /><em>mm</em></span></label>
      {draft.notice && <p role="status">{draft.notice}</p>}
    </>}
  </>;
}
