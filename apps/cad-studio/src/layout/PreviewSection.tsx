import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DockSection } from './DockSection';

/** The viewport's previews: one at a time (G12c). */
export type PreviewMode = 'none' | 'cnc' | 'print' | 'clearance' | 'analysis';
export const PREVIEW_MODES: { id: PreviewMode; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'cnc', label: 'CNC' }, { id: 'print', label: 'Print' }, { id: 'clearance', label: 'Clearance' }, { id: 'analysis', label: 'Analysis' },
];

/**
 * The dock's Preview & analysis section (G12c, G12e): the one-at-a-time switch is the previews' enable; under it the chosen
 * preview's settings alone (`panel`), None a one-line hint. The 3D annotations, an overlay with any of them, are a toggle
 * at the header's right (`overlay`), their status under the panel while on (`overlayStatus`).
 */
export function PreviewSection({ mode, onMode, panel, overlay, overlayStatus }: {
  mode: PreviewMode; onMode(mode: PreviewMode): void; panel: ReactNode; overlay: ReactNode; overlayStatus: ReactNode;
}) {
  const label = PREVIEW_MODES.find(m => m.id === mode)?.label ?? 'None';
  return <DockSection id="preview" title="Preview & analysis" summary={label} actions={overlay}>
    <ToggleGroup type="single" value={mode} onValueChange={v => onMode((v || 'none') as PreviewMode)} aria-label="Preview mode" className="preview-modes">
      {PREVIEW_MODES.map(m => <ToggleGroupItem key={m.id} value={m.id} aria-label={'Preview: ' + m.label}>{m.label}</ToggleGroupItem>)}
    </ToggleGroup>
    {mode === 'none' ? <div className="muted preview-hint">Choose a preview: one shows on the model at a time.</div> : panel}
    {overlayStatus}
  </DockSection>;
}
