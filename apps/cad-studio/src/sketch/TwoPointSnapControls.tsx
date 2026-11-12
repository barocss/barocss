import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CONTROL, FIELD } from '../ui/panelStyles';
import type { useTwoPointSnap } from './useTwoPointSnap';

export function TwoPointSnapControls({ snap }: { snap: ReturnType<typeof useTwoPointSnap> }) {
  const { visible: draft, preview } = snap;
  if (!draft) return snap.available ? <Button variant="ghost" onClick={snap.begin} onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}>Two-point snap</Button> : null;
  return <form aria-label="Two-point snap"
    onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
    onSubmit={event => { event.preventDefault(); snap.apply(); }}>
    <p role="status">{!draft.a ? 'Pick the first endpoint.' : !draft.b ? 'Pick the second endpoint.' : preview ? `Point ${preview.join(', ')} mm` : 'Enter a valid value.'}</p>
    {draft.problem && <p role="alert">{draft.problem}</p>}
    {draft.b && <>
      <label className={FIELD}><span>Measure</span><NativeSelect className={CONTROL} aria-label="Snap measure" value={draft.mode}
        onChange={event => snap.setMode(event.target.value === 'distance' ? 'distance' : 'ratio')}>
        <option value="ratio">Ratio</option><option value="distance">Distance (mm)</option>
      </NativeSelect></label>
      <label className={FIELD}><span>Value</span><Input aria-label="Snap value" inputMode="decimal" value={draft.value}
        onChange={event => snap.setValue(event.target.value)} /></label>
    </>}
    <Button type="submit" disabled={!preview}>Use point</Button>
    <Button type="button" variant="ghost" onClick={snap.cancel}>Cancel snap</Button>
  </form>;
}
