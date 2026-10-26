// Keep command buttons and made.command history aliases on the same semantic glyph.
// Unlisted commands retain their supplied icon, including ordinary Material Symbols.
const COMMAND_ICONS: Readonly<Record<string, string>> = {
  'internal-gear': 'cad-internal-gear',
  'bevel-gear': 'cad-bevel-gear',
  'worm-pair': 'cad-worm-pair',
  'gear-mesh': 'cad-gear-mesh',
  keyway: 'cad-keyway',
  'retaining-ring': 'cad-retaining-ring',
  pin: 'cad-pin',
  pipe: 'cad-pipe',
  'offset-face': 'cad-offset-face',
  hollow: 'cad-hollow',
  lattice: 'cad-lattice',
  'split-bed': 'cad-split-bed',
  'fit-pair': 'cad-fit-pair',
  'subd-box': 'cad-subd-box',
  'subd-tube': 'cad-subd-tube',
  'subd-torus': 'cad-subd-torus',
  'subd-edit': 'cad-subd-edit',
  mount: 'cad-mount',
  // These command IDs already have a distinct drawing under an older registry name.
  'sweep-curve': 'cad-sweep',
  'fit-class': 'cad-fit',
  'linear-pattern': 'cad-pattern-linear',
  'circular-pattern': 'cad-pattern-circular',
  'sheet-corner-relief': 'cad-sheet-corner',
  'belt-drive': 'cad-belt',
  'gear-rack': 'cad-rack',
  'oring-gland': 'cad-oring',
};

export function commandIconName(commandId: string, fallback: string): string {
  return Object.hasOwn(COMMAND_ICONS, commandId) ? COMMAND_ICONS[commandId] : fallback;
}
