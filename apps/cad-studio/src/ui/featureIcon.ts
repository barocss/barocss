import type { ModelNode } from '@barocss/cad-model/engine/doc';
export function iconFor(n: ModelNode) {
  if ('made' in n && n.made) return 'cad-' + n.made.command;
  return ({ 'cylindrical-wrap': 'wrap_text', text: 'text_fields', 'text-relief': 'text_fields', extrude: 'cad-extrude', revolve: 'cad-revolve', shell: 'cad-shell', import: 'file_open', sweep: 'cad-sweep', loft: 'cad-loft', hole: 'cad-hole', chamfer: 'cad-chamfer', fillet: 'cad-fillet', 'full-round': 'cad-full-round', 'face-thread': 'cad-thread', 'face-fillet': 'cad-face-fillet', union: 'cad-union', difference: 'cad-subtract', intersect: 'cad-intersect',
    translate: 'cad-move', rotate: 'cad-rotate', mirror: 'cad-mirror', scale: 'cad-scale', 'linear-pattern': 'cad-pattern-linear', 'linear-feature-pattern': 'cad-pattern-linear', 'circular-pattern': 'cad-pattern-circular', split: 'cad-split', sketch: 'cad-sketch', 'sheet-base': 'cad-sheet-plate', 'sheet-contour': 'cad-sheet-profile', 'sheet-flange': 'cad-sheet-flange', 'sheet-corner-relief': 'cad-sheet-corner', 'frame-member': 'cad-frame-member', frame: 'cad-frame' } as Record<string, string>)[n.kind] ?? 'category';
}

