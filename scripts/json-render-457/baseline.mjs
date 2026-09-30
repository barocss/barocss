// Frozen before the #457 edit cases. These are app-owned vocabularies, not a model output.
import { SCENARIOS } from '../json-render-446/contract.mjs';
import { BASE_TOKENS, ALL_LAYOUT_TOKENS, INITIAL_LAYOUT_TOKENS } from '../json-render-446/styles.mjs';

export const ARMS = Object.freeze(['preset', 'variable', 'utility', 'build']);
export const VIEWPORTS = Object.freeze({ desktop: { width: 1280, height: 900 }, narrow: { width: 390, height: 844 } });
export const REPEATS = 2;
export const SCENARIO_NAMES = Object.freeze(Object.keys(SCENARIOS));
export const INITIAL = Object.freeze({ density: 'regular', columns: 2, placement: 'side' });

// Any finite number within these closed ranges becomes a CSS custom-property value. No CSS text or URL is accepted.
export const VARIABLE_FIELDS = Object.freeze({
  paddingPx: { min: 8, max: 32, finite: true, initial: 24, cssName: '--ui-pad', unit: 'px' },
  gapPx: { min: 8, max: 32, finite: true, initial: 24, cssName: '--ui-gap', unit: 'px' },
  radiusPx: { min: 0, max: 24, finite: true, initial: 14, cssName: '--ui-radius', unit: 'px' },
});

// One precompiled state template is selectable by the bounded catalogs; no arbitrary selector prop exists.
export const STATE_TEMPLATES = Object.freeze({ hoverUnderline: 'hover:underline' });
export const VARIABLE_TOKENS = Object.freeze(['p-[var(--ui-pad)]', 'gap-[var(--ui-gap)]', 'rounded-[var(--ui-radius)]']);
export const BOUNDED_LAYOUT_TOKENS = Object.freeze(['grid-cols-1', 'grid-cols-2']);
export const HOST_CSS = 'body{margin:0;font-family:system-ui,sans-serif}#host{padding:12px;border-bottom:1px solid var(--border);color:var(--foreground);background:var(--background)}#out{padding:18px}';

// The utility and build arms start with exactly the same static CSS. Only utility may add later rules.
const initialUtility = [...BASE_TOKENS, ...INITIAL_LAYOUT_TOKENS];
export const INVENTORIES = Object.freeze({
  preset: [...BASE_TOKENS, ...ALL_LAYOUT_TOKENS, ...Object.values(STATE_TEMPLATES)],
  variable: [...BASE_TOKENS, ...BOUNDED_LAYOUT_TOKENS, ...VARIABLE_TOKENS, ...Object.values(STATE_TEMPLATES)],
  utility: initialUtility,
  build: initialUtility,
});

export const CATALOG = Object.freeze({
  components: ['Layout', 'Text', 'Input', 'Select', 'Button'],
  actions: ['save', 'refresh', 'add'],
  layout: {
    preset: { density: ['regular', 'compact'], columns: [1, 2], placement: ['side', 'stacked'] },
    variable: { density: ['regular', 'compact'], columns: [1, 2], placement: ['side', 'stacked'], variables: Object.keys(VARIABLE_FIELDS), densityDefaults: { regular: { paddingPx: 24, gapPx: 24 }, compact: { paddingPx: 12, gapPx: 12 } } },
    utility: { className: 'schema-validated string; runner supplies authored local classes only' },
    build: { className: 'same validated string; only initial inventory is compiled' },
  },
  button: { presetAndVariable: ['hoverUnderline:boolean'], utilityAndBuild: ['className:string'] },
  semantics: 'The #446 scenario nodes, state paths, focus targets and actions are unchanged. Placement and columns remain coupled as in the authored #446 stages: side/2 or stacked/1.',
});
