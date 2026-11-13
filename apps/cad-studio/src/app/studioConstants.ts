import { FILLET_LAUNCHER } from './filletFamily';
import { commands, type Selection } from '@barocss/cad-model/app/commands';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import { SKETCH3D_COMMAND } from '../skeleton/useSkeletonEditor';
import type { DisplayMode } from '../viewport/renderer';
import { STEPS_COMMAND } from './assemblySteps';
import { SKETCH_AT_MIDPOINT } from './midpointSketch';
import { PROJECT_TO_SKETCH } from './materialFootprint';
import { LINKED_INSET_EXTRUDE } from './roundedInsetCommand';
export const emptySel: Selection = { faces: [], edges: [], bodies: [] };
export const NO_INSTANCES: PartInstance[] = [];
/** No assembly cuts (a stable empty list for the Browser's rows). */
export const NO_CUTS: readonly import('@barocss/cad-model/engine/doc').AssemblyCut[] = [];
// (The rail's groups and the shapes strip's commands, made once: the button lists compare them by identity.)
export const TOOL_GROUPS = ['create', 'modify', 'pattern', 'combine', 'inspect'] as const;
const modelCommands = [...commands, PROJECT_TO_SKETCH, LINKED_INSET_EXTRUDE];
export const GROUP_COMMANDS = TOOL_GROUPS.map(g => modelCommands
  .filter(c => c.group === g && !c.place && c.id !== 'face-fillet' && c.id !== 'full-round')
  .map(c => c.id === 'fillet' ? FILLET_LAUNCHER : c));
export const PLACE_COMMANDS = commands.filter(c => c.place);
/** What a command is about to add, in its preview. */
export const PREVIEW_TINT = '#7fb2f0';
/** A history entry's time, local and short (as stored, if not a time). */
export const whenOf = (at: string) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); };

/** Where the Browser mounts (G12b): the dock's top section, or the stage's left as before. */
export const BROWSER_PLACEMENT = 'dock' as 'dock' | 'left';

/** The studio's own commands in the palette, after the model's (G17's 3D sketch). */
export const PALETTE_EXTRA = [SKETCH3D_COMMAND, STEPS_COMMAND, PROJECT_TO_SKETCH, SKETCH_AT_MIDPOINT, LINKED_INSET_EXTRUDE];
export const CAD_DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: 'shaded-with-edges', label: 'Shaded with edges' },
  { value: 'hidden-lines-removed', label: 'Hidden lines removed' },
  { value: 'hidden-lines-dashed', label: 'Hidden lines dashed' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'x-ray', label: 'X-ray' },
];

