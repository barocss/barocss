import { commands, type Selection } from '@barocss/cad-model/app/commands';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import { SKETCH3D_COMMAND } from '../skeleton/useSkeletonEditor';
import type { DisplayMode } from '../viewport/renderer';
export const emptySel: Selection = { faces: [], edges: [], bodies: [] };
export const NO_INSTANCES: PartInstance[] = [];
// (The rail's groups and the shapes strip's commands, made once: the button lists compare them by identity.)
export const TOOL_GROUPS = ['create', 'modify', 'pattern', 'combine', 'inspect'] as const;
export const GROUP_COMMANDS = TOOL_GROUPS.map(g => commands.filter(c => c.group === g && !c.place));
export const PLACE_COMMANDS = commands.filter(c => c.place);
/** What a command is about to add, in its preview. */
export const PREVIEW_TINT = '#7fb2f0';
/** A history entry's time, local and short (as stored, if not a time). */
export const whenOf = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); };

/** Where the Browser mounts (G12b): the dock's top section, or the stage's left as before. */
export const BROWSER_PLACEMENT = 'dock' as 'dock' | 'left';

/** The studio's own commands in the palette, after the model's (G17's 3D sketch). */
export const PALETTE_EXTRA = [SKETCH3D_COMMAND];
export const CAD_DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'shaded-with-edges', label: 'Shaded with edges' },
  { value: 'hidden-lines-removed', label: 'Hidden lines removed' },
  { value: 'hidden-lines-dashed', label: 'Hidden lines dashed' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'x-ray', label: 'X-ray' },
];

