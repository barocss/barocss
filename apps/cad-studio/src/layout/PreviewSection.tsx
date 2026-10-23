import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DockSection } from './DockSection';

/** The viewport's previews: one at a time (G12c). */
export type PreviewMode = 'none' | 'cnc' | 'print' | 'clearance' | 'analysis';
export const PREVIEW_MODES: { id: PreviewMode; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'cnc', label: 'CNC' }, { id: 'print', label: 'Print' }, { id: 'clearance', label: 'Clearance' }, { id: 'analysis', label: 'Analysis' },
];

/**
 * The dock's Preview & analysis section (G12c): the one-at-a-time switch, then the chosen preview's panel — the others
 * show their header row alone — and the 3D annotations, an overlay with any of them.
 */
export function PreviewSection({ mode, onMode, panels, overlays }: { mode: PreviewMode; onMode(mode: PreviewMode): void; panels: ReactNode; overlays: ReactNode }) {
  const label = PREVIEW_MODES.find(m => m.id === mode)?.label ?? 'None';
  return <DockSection id="preview" title="Preview & analysis" summary={label}>
    <ToggleGroup type="single" value={mode} onValueChange={v => onMode((v || 'none') as PreviewMode)} aria-label="Preview mode" className="preview-modes">
      {PREVIEW_MODES.map(m => <ToggleGroupItem key={m.id} value={m.id} aria-label={'Preview: ' + m.label}>{m.label}</ToggleGroupItem>)}
    </ToggleGroup>
    <div className="preview-panels">{panels}</div>
    <div className="preview-overlays">{overlays}</div>
  </DockSection>;
}
