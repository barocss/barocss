// Twelve transparent authored edit requirements. Written after baseline commit c03f58e1.
import { SCENARIOS } from '../json-render-446/contract.mjs';
import { specFor as baseSpecFor, initialState } from '../json-render-446/spec.mjs';
import { CLASS_PLAN } from '../json-render-446/styles.mjs';
import { ARMS, VIEWPORTS, REPEATS } from './baseline.mjs';

export { initialState };
export const CASES = Object.freeze([
  { id: 'settings-compact', scenario: 'settings', kind: 'preset', requirement: 'Use the existing compact density preset.', target: 'layout', change: { density: 'compact' }, assertion: { paddingPx: 12, gapPx: 12 } },
  { id: 'settings-pad-17_5', scenario: 'settings', kind: 'scalar', requirement: 'Set layout padding to 17.5px, between named presets.', target: 'layout', change: { paddingPx: 17.5 }, assertion: { paddingPx: 17.5 } },
  { id: 'settings-hover-underline', scenario: 'settings', kind: 'compiled-state', requirement: 'Underline the Save button on hover using the frozen state template.', target: 'save', change: { hoverUnderline: true }, assertion: { hoverUnderline: true } },
  { id: 'settings-hover-italic', scenario: 'settings', kind: 'absent-rule', requirement: 'Italicize the Save button on hover; no frozen state template contains this selector.', target: 'save', change: { utility: 'hover:italic' }, assertion: { hoverItalic: true } },
  { id: 'dashboard-one-column', scenario: 'dashboard', kind: 'preset', requirement: 'Select the existing one-column stacked layout.', target: 'layout', change: { columns: 1, placement: 'stacked' }, assertion: { columns: 1 } },
  { id: 'dashboard-gap-21_25', scenario: 'dashboard', kind: 'scalar', requirement: 'Set the dashboard layout gap to 21.25px.', target: 'layout', change: { gapPx: 21.25 }, assertion: { gapPx: 21.25 } },
  { id: 'dashboard-radius-19_5', scenario: 'dashboard', kind: 'scalar', requirement: 'Set card corner radius to 19.5px.', target: 'layout', change: { radiusPx: 19.5 }, assertion: { radiusPx: 19.5 } },
  { id: 'dashboard-three-column', scenario: 'dashboard', kind: 'absent-rule', requirement: 'Show three grid columns, absent from the frozen one/two-column catalog.', target: 'layout', change: { utility: 'grid-cols-3' }, assertion: { columns: 3 } },
  { id: 'kiosk-compact-stacked', scenario: 'kiosk', kind: 'preset', requirement: 'Select compact density with the existing stacked layout.', target: 'layout', change: { density: 'compact', columns: 1, placement: 'stacked' }, assertion: { paddingPx: 12, gapPx: 12, columns: 1 } },
  { id: 'kiosk-pad-23_75', scenario: 'kiosk', kind: 'scalar', requirement: 'Set coffee-order padding to 23.75px.', target: 'layout', change: { paddingPx: 23.75 }, assertion: { paddingPx: 23.75 } },
  { id: 'kiosk-hover-underline', scenario: 'kiosk', kind: 'compiled-state', requirement: 'Underline Add to order on hover using the frozen state template.', target: 'add', change: { hoverUnderline: true }, assertion: { hoverUnderline: true } },
  { id: 'kiosk-uppercase-button', scenario: 'kiosk', kind: 'absent-rule', requirement: 'Uppercase Add to order; no frozen button rule or prop provides this.', target: 'add', change: { utility: 'uppercase' }, assertion: { uppercase: true } },
]);

export const PLANNED_CELLS = CASES.length * ARMS.length * Object.keys(VIEWPORTS).length * REPEATS;

export function supportFor(editCase, arm) {
  if (arm === 'build') return { supported: false, reason: 'uncompiled:later-utility-token' };
  if (arm === 'utility') return { supported: true, reason: 'runtime-class' };
  if (editCase.kind === 'scalar') return arm === 'variable'
    ? { supported: true, reason: 'typed-variable' }
    : { supported: false, reason: 'vocabulary:no-numeric-prop' };
  if (editCase.kind === 'absent-rule') return { supported: false, reason: 'vocabulary:no-frozen-rule' };
  return { supported: true, reason: editCase.kind === 'compiled-state' ? 'frozen-state-template' : 'bounded-preset' };
}

function utilityClasses(editCase) {
  const initial = CLASS_PLAN.initial.split(' ');
  const replace = (prefix, next) => [...initial.filter((token) => !token.startsWith(prefix)), next].join(' ');
  switch (editCase.id) {
    case 'settings-compact': return 'grid-cols-2 p-3 gap-3';
    case 'dashboard-one-column': return replace('grid-cols-', 'grid-cols-1');
    case 'kiosk-compact-stacked': return 'grid-cols-1 p-3 gap-3';
    case 'settings-pad-17_5': return replace('p-', 'p-[17.5px]');
    case 'dashboard-gap-21_25': return replace('gap-', 'gap-[21.25px]');
    case 'dashboard-radius-19_5': return `${CLASS_PLAN.initial} rounded-[19.5px]`;
    case 'dashboard-three-column': return replace('grid-cols-', 'grid-cols-3');
    case 'kiosk-pad-23_75': return replace('p-', 'p-[23.75px]');
    default: return CLASS_PLAN.initial;
  }
}

export function specFor(editCase, arm, edited) {
  if (!CASES.includes(editCase) || !ARMS.includes(arm)) throw new Error('unknown case or arm');
  const spec = structuredClone(baseSpecFor(editCase.scenario, arm === 'preset' || arm === 'variable' ? 'bounded' : 'utility', 'initial'));
  const layout = spec.elements.layout.props;
  if (arm === 'variable') layout.variables = {};
  if (!edited) return spec;
  const support = supportFor(editCase, arm);
  if (arm === 'utility' || arm === 'build') {
    layout.className = utilityClasses(editCase);
    if (editCase.target !== 'layout') {
      const button = spec.elements[editCase.target].props;
      button.className = editCase.kind === 'compiled-state' ? 'hover:underline' : editCase.change.utility;
    }
  } else if (support.supported) {
    if (editCase.kind === 'scalar') layout.variables = { [Object.keys(editCase.change)[0]]: Object.values(editCase.change)[0] };
    else if (editCase.kind === 'compiled-state') spec.elements[editCase.target].props.hoverUnderline = true;
    else Object.assign(layout, editCase.change);
  }
  return spec;
}

export function semanticSignature(spec) {
  return Object.entries(spec.elements).map(([id, node]) => ({ id, type: node.type, children: node.children, on: node.on,
    text: node.props.text, label: node.props.label, options: node.props.options, value: node.props.value }));
}

export function scenarioFor(editCase) { return SCENARIOS[editCase.scenario]; }
