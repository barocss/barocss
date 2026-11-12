import { Button } from '@/components/ui/button';
import { TwoPointSnapControls } from './TwoPointSnapControls';
import type { useArcExtensionSnap } from './useArcExtensionSnap';
import type { useTwoPointSnap } from './useTwoPointSnap';

interface Props {
  twoPoint: ReturnType<typeof useTwoPointSnap>;
  extension: ReturnType<typeof useArcExtensionSnap>;
}

export function SketchSnapControls({ twoPoint, extension }: Props) {
  return <>
    <TwoPointSnapControls snap={{ ...twoPoint, begin: () => { extension.cancel(); twoPoint.begin(); } }} />
    {extension.available && <Button variant="ghost" aria-pressed={!!extension.stage}
      onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
      onClick={() => { twoPoint.cancel(); extension.toggle(); }}>Arc extension snap</Button>}
    {extension.stage === 'end' && <p role="status">Pick the arc end.</p>}
  </>;
}
