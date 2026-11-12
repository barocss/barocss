import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD } from '../ui/panelStyles';
import type { useCircleFromChord } from './useCircleFromChord';

export function CircleChordControls({ circle }: { circle: ReturnType<typeof useCircleFromChord> }) {
  const draft = circle.visible;
  if (!draft) return circle.available ? <Button variant="ghost" data-sketch-action onClick={circle.begin}>Circle from two points</Button> : null;
  return <div role="group" aria-label="Circle from two points">
    {!draft.second && <p role="status">{draft.first ? 'Pick the second point on the circle.' : 'Pick the first point on the circle.'}</p>}
    {draft.second && <label className={FIELD}><span>Radius (mm)</span>
      <Input aria-label="Circle radius" inputMode="decimal" value={draft.radius} onChange={event => circle.setRadius(event.target.value)} />
    </label>}
    {draft.problem && <p role="alert">{draft.problem}</p>}
    {draft.preview?.centers.map((_, index) => <Button key={index} data-sketch-action onClick={() => circle.choose(draft, index)}>
      Use circle {index + 1}
    </Button>)}
    <Button variant="ghost" data-sketch-action onClick={circle.cancel}>Cancel circle</Button>
  </div>;
}
