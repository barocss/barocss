// Frozen, transparent exploratory pilot contract. No generated output appears here.
import { SCENARIOS } from '../json-render-446/contract.mjs';

export const MODEL = 'gpt-6-sol';
export const REASONING = 'high';
export const CLI_VERSION = '0.156.1';
export const ARMS = Object.freeze(['variable', 'utility']);
export const SCENARIOS_ORDER = Object.freeze(['settings', 'dashboard', 'kiosk']);
export const STAGES = Object.freeze(['initial', 'scalar', 'compiled', 'absent']);
export const MAX_ATTEMPTS = 24;
export const PER_ATTEMPT_TIMEOUT_MS = 180_000;
export const WHOLE_RUN_TIMEOUT_MS = 3_600_000;
export const VIEWPORTS = Object.freeze({ desktop: { width: 1280, height: 900 }, narrow: { width: 390, height: 844 } });
export const SAFE_LAYOUT_CLASSES = Object.freeze([
  'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'p-6', 'p-3', 'p-[17.5px]', 'p-[23.75px]',
  'gap-6', 'gap-3', 'gap-[21.25px]',
]);
export const SAFE_BUTTON_CLASSES = Object.freeze(['hover:underline', 'hover:italic', 'uppercase']);
export const REQUIRED = Object.freeze({
  settings: {
    initial: { paddingPx: 24, gapPx: 24, radiusPx: 14, columns: 2, hoverUnderline: false, hoverItalic: false },
    scalar: { paddingPx: 17.5, gapPx: 24, radiusPx: 14, columns: 2, hoverUnderline: false, hoverItalic: false },
    compiled: { paddingPx: 17.5, gapPx: 24, radiusPx: 14, columns: 2, hoverUnderline: true, hoverItalic: false },
    absent: { paddingPx: 17.5, gapPx: 24, radiusPx: 14, columns: 2, hoverUnderline: true, hoverItalic: true },
  },
  dashboard: {
    initial: { paddingPx: 24, gapPx: 24, radiusPx: 14, columns: 2 },
    scalar: { paddingPx: 24, gapPx: 21.25, radiusPx: 14, columns: 2 },
    compiled: { paddingPx: 24, gapPx: 21.25, radiusPx: 14, columns: 1 },
    absent: { paddingPx: 24, gapPx: 21.25, radiusPx: 14, columns: 3 },
  },
  kiosk: {
    initial: { paddingPx: 24, gapPx: 24, radiusPx: 14, columns: 2, uppercase: false },
    scalar: { paddingPx: 23.75, gapPx: 24, radiusPx: 14, columns: 2, uppercase: false },
    compiled: { paddingPx: 23.75, gapPx: 12, radiusPx: 14, columns: 1, uppercase: false },
    absent: { paddingPx: 23.75, gapPx: 12, radiusPx: 14, columns: 1, uppercase: true },
  },
});
const REQUESTS = Object.freeze({
  settings: {
    scalar: 'Change only the layout padding to 17.5px; keep the 24px gap and two columns.',
    compiled: 'Keep the 17.5px padding. Underline the Save changes button on hover using an already compiled state rule.',
    absent: 'Keep the earlier edits. Also italicize the Save changes button on hover.',
  },
  dashboard: {
    scalar: 'Change only the layout gap to 21.25px; keep 24px padding and two columns.',
    compiled: 'Keep the 21.25px gap. Change to one stacked column.',
    absent: 'Keep the 21.25px gap. Change to three equal columns.',
  },
  kiosk: {
    scalar: 'Change only the layout padding to 23.75px; keep the 24px gap and two columns.',
    compiled: 'Keep the 23.75px padding. Use compact density for a 12px gap and one stacked column.',
    absent: 'Keep the earlier edits. Show the Add to order button text in uppercase without changing its underlying label or action.',
  },
});

export function supportFor(scenario, arm, stage) {
  if (!SCENARIOS_ORDER.includes(scenario) || !ARMS.includes(arm) || !STAGES.includes(stage)) throw new Error('Unknown pilot cell');
  return stage === 'absent' && arm === 'variable'
    ? { supported: false, reason: 'frozen-catalog:no-rule-or-prop' }
    : { supported: true, reason: stage === 'scalar' && arm === 'variable' ? 'typed-variable' : stage === 'compiled' && arm === 'variable' ? 'precompiled-choice' : 'frozen-capability' };
}
export function schedule() {
  const rows = [];
  for (const scenario of SCENARIOS_ORDER) for (const arm of ARMS) for (const stage of STAGES) {
    rows.push({ id: `${scenario}--${arm}--${stage}`, session: `${scenario}--${arm}`, scenario, arm, stage,
      ordinal: rows.length, support: supportFor(scenario, arm, stage), required: REQUIRED[scenario][stage] });
  }
  if (rows.length !== MAX_ATTEMPTS) throw new Error('Pilot schedule drift');
  return rows;
}
function catalogText(arm) {
  const common = `Return only the structured response envelope. specJson must contain one complete json-render JSON object with root "layout" and elements keyed by stable IDs. Each node has type, props and children; only the expected Button has on:{"press":{"action":"<expected-action>"}}. All leaf children are []. The Layout children list every leaf in the required order. No extra nodes, IDs, fields, URLs, assets, code, CSS source or arbitrary HTML. Text and labels are literal. Input/Select values bind to their own state path as {"$bindState":"/<field-id>"}. Keep content, options, bindings, actions, state, focus and earlier edits across responses. If a request is outside this catalog, set cannotExpress=true and return the complete unchanged prior specJson; do not invent a prop or class. Otherwise set cannotExpress=false.`;
  const variable = `Layout props: id, density (regular|compact), columns (1|2), placement (side|stacked), variables (optional object). side pairs with 2 columns; stacked pairs with 1. Regular defaults to 24px padding/gap; compact defaults to 12px padding/gap. variables may contain finite numeric paddingPx and gapPx in [8,32], and radiusPx in [0,24]. The renderer formats px; never place CSS text in a value. Button props: id, label, optional hoverUnderline boolean. No className on any node. Existing hoverUnderline rule is compiled.`;
  const utility = `Layout props: id and className string. Use only these layout class tokens: ${SAFE_LAYOUT_CLASSES.join(' ')}. Base Layout already supplies display:grid, border, 14px corner radius and theme colors; do not restate those. Button props: id, label, optional className from only: ${SAFE_BUTTON_CLASSES.join(' ')}. Text, Input and Select have no className in this pilot. Utility spacing is Tailwind compatible; do not use CSS source, arbitrary variants, URLs, or tokens outside the list. Existing BaroCSS preload resolves these approved class tokens.`;
  return `${common}\n${arm === 'variable' ? variable : utility}\nText props: id,text. Input props: id,label,value. Select props: id,label,options,value. Allowed actions: save, refresh, add. Host state and action execution are separate from the spec.`;
}
function initialRequest(scenario) {
  const fixture = SCENARIOS[scenario];
  const nodes = fixture.nodes.map((node) => {
    const parts = [`ID ${node.id}`, `type ${node.type}`];
    if (node.text !== undefined) parts.push(`text ${JSON.stringify(node.text)}`);
    if (node.label !== undefined) parts.push(`label ${JSON.stringify(node.label)}`);
    if (node.options !== undefined) parts.push(`options ${JSON.stringify(node.options)}`);
    if (node.value !== undefined) parts.push(`bind /${node.id}; host initial value ${JSON.stringify(node.value)}`);
    if (node.action) parts.push(`press action ${node.action}`);
    return parts.join('; ');
  }).join('\n');
  return `Create ${fixture.title} at a 1280x900 viewport. Use two equal columns, 24px padding and 24px gap. Include exactly these nodes in order:\n${nodes}\nThe host will edit ${fixture.interaction.target} to ${JSON.stringify(fixture.interaction.enter)} and focus it before the next response. Return a complete spec.`;
}
export function requestFor(scenario, stage) {
  if (!SCENARIOS_ORDER.includes(scenario) || !STAGES.includes(stage)) throw new Error('Unknown request');
  return stage === 'initial' ? initialRequest(scenario) : `${REQUESTS[scenario][stage]} Preserve every node ID, text, option order, state binding and press action. Return a complete spec.`;
}
export function promptFor(row, prior) {
  if (!Array.isArray(prior) || prior.length !== STAGES.indexOf(row.stage)) throw new Error('Incomplete session history');
  const transcript = [];
  for (let index = 0; index < prior.length; index++) {
    transcript.push({ role: 'user', content: requestFor(row.scenario, STAGES[index]) });
    transcript.push({ role: 'assistant', content: prior[index] });
  }
  transcript.push({ role: 'user', content: requestFor(row.scenario, row.stage) });
  return JSON.stringify({ instruction: catalogText(row.arm), session: row.session, transcript }, null, 2);
}
