import { Button } from '@/components/ui/button';
import { keepsDimensionDraft } from './constraintInspection';
import { OBJECT_SNAP_KINDS, type ObjectSnapKind, type ObjectSnapKinds } from './objectSnapKinds';
import { TwoPointSnapControls } from './TwoPointSnapControls';
import type { useArcExtensionSnap } from './useArcExtensionSnap';
import type { useTwoPointSnap } from './useTwoPointSnap';

interface Props {
  twoPoint: ReturnType<typeof useTwoPointSnap>;
  extension: ReturnType<typeof useArcExtensionSnap>;
  objectKinds: ObjectSnapKinds;
  crossingToolSupported: boolean;
  placedRotationLimited?: boolean;
  onToggleObjectKind(kind: ObjectSnapKind): void;
  onExitObjectKinds?(): void;
}

export function SketchSnapControls({ twoPoint, extension, objectKinds, crossingToolSupported, placedRotationLimited, onToggleObjectKind, onExitObjectKinds }: Props) {
  return <>
    <details className="sk-object-snaps" data-sketch-dimension-focus
      onKeyDown={event => {
        if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        const details = event.currentTarget;
        details.open = false;
        details.querySelector('summary')?.focus();
      }}
      onBlur={event => { if (!keepsDimensionDraft(event.relatedTarget)) onExitObjectKinds?.(); }}>
      <summary>Object snaps · {objectKinds.size}/{OBJECT_SNAP_KINDS.length}</summary>
      <div className="sk-object-snap-kinds" role="group" aria-label="Object snap kinds">
        {OBJECT_SNAP_KINDS.map(({ kind, label }) => {
          const enabled = objectKinds.has(kind);
          return <Button key={kind} type="button" size="xs" variant={enabled ? 'default' : 'outline'} aria-pressed={enabled}
            onClick={() => onToggleObjectKind(kind)}>{label}</Button>;
        })}
      </div>
      {!crossingToolSupported && objectKinds.has('crossing') && <p>Edge crossing is unavailable for this tool.</p>}
      {placedRotationLimited && <p>Placed box End and Middle snaps support exact 90° Z rotations.</p>}
    </details>
    <TwoPointSnapControls snap={{ ...twoPoint, begin: () => { extension.cancel(); twoPoint.begin(); } }} />
    {extension.available && <Button variant="ghost" aria-pressed={!!extension.stage}
      onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
      onClick={() => { twoPoint.cancel(); extension.toggle(); }}>Arc extension snap</Button>}
    {extension.stage === 'end' && <p role="status">Pick the arc end.</p>}
  </>;
}
