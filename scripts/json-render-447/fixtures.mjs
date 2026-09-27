// Frozen model inputs. No reference output specs are included in these messages.
import { SCENARIOS } from '../json-render-446/contract.mjs';

export const ARMS = Object.freeze(['fixed', 'bounded', 'utility']);
export const SCENARIO_IDS = Object.freeze(['settings', 'dashboard', 'kiosk']);
export const STAGES = Object.freeze(['initial', 'density', 'responsive', 'structure']);
export const SYSTEM = `Produce one complete json-render JSON spec per request. Return only one JSON object, with no Markdown, explanation, patch, HTML, JavaScript, or CSS source. Follow the supplied component catalog exactly. Preserve all previous content, node identities, bindings, actions, and requested layout changes unless the user explicitly changes them. The host owns state and action execution; never include state initialization in an output spec. Text is literal text. Do not add URLs, assets, scripts, event code, or components outside the catalog.`;

function checkScenario(scenario) {
  if (!SCENARIO_IDS.includes(scenario)) throw new Error(`Unknown scenario: ${scenario}`);
  return SCENARIOS[scenario];
}
export function catalogFor(arm) {
  if (!ARMS.includes(arm)) throw new Error(`Unknown arm: ${arm}`);
  const layout = arm === 'fixed'
    ? 'Layout props: id:string, variant:"regular"|"compact"|"stacked". regular means two columns with 24px padding and gap; compact means two columns with 12px padding and gap; stacked means one column with 12px padding and gap.'
    : arm === 'bounded'
      ? 'Layout props: id:string, density:"regular"|"compact", columns:1|2, placement:"side"|"stacked". regular density means 24px padding and gap; compact density means 12px padding and gap. columns controls column count; placement describes the same layout intention (side for two columns, stacked for one).'
      : 'Layout props: id:string, className:string. Use Tailwind-compatible utility tokens to control column count, padding and gap. The host runtime resolves these classes. The base font size is 16px and the spacing unit is 4px. Optional className:string is also allowed on Text, Input, Select and Button. Do not use arbitrary values, arbitrary variants, URLs or CSS source.';
  return `Catalog version: 447-v1 (json-render 0.21.0; inherited #446 semantics).
Spec shape: {root:string,elements:object}. elements maps stable node IDs to objects with type, props, children (array of child IDs), and optional on. No other spec fields are allowed. Each props.id must equal its element key. Use one Layout root named layout. Layout children must list all leaf nodes in the required order. Leaf children are empty arrays. No additional nodes or props.
${layout}
Text props: id:string, text:string. The heading ID renders as a heading; other Text nodes render as paragraphs.
Input props: id:string, label:string, value:{"$bindState":"/<field-id>"}.
Select props: id:string, label:string, options:string[], value:{"$bindState":"/<field-id>"}.
Button props: id:string, label:string. Button on is {"press":{"action":"<action-name>"}}. Allowed action names: save, refresh, add. No other event or action fields.
The host supplies grid display, border, rounded corners, semantic theme colors, and field/button typography and dimensions. Preserve these styles. Do not set colors or override them. Do not add className in fixed or bounded catalogs. The host keeps the same state store and renderer across updates; stable IDs and bindings preserve user edits.`;
}
export function initialPrompt(scenario, arm) {
  const fixture = checkScenario(scenario);
  if (!ARMS.includes(arm)) throw new Error(`Unknown arm: ${arm}`);
  const content = fixture.nodes.map((node) => {
    const details = [`ID ${node.id}`, `component ${node.type}`];
    if (node.text !== undefined) details.push(`literal text ${JSON.stringify(node.text)}`);
    if (node.label !== undefined) details.push(`label ${JSON.stringify(node.label)}`);
    if (node.options !== undefined) details.push(`options in this order ${JSON.stringify(node.options)}`);
    if (node.value !== undefined) details.push(`host initial state /${node.id} = ${JSON.stringify(node.value)}; bind value to this path`);
    if (node.action) details.push(`press action ${node.action}`);
    return details.join('; ');
  }).join('\n');
  return `Create ${fixture.title}. Viewport: 1280 by 900 pixels. Use two equal columns, 24px internal padding, and 24px gap. Use the supplied catalog. Include exactly these nodes in this order inside layout:\n${content}\nThe host will then set ${fixture.interaction.target} to ${JSON.stringify(fixture.interaction.enter)} and focus it. Future edits must preserve that value, focus, binding, and all actions. Return the complete spec.`;
}
export function editPrompt(scenario, stage) {
  const fixture = checkScenario(scenario);
  if (!STAGES.slice(1).includes(stage)) throw new Error(`Unknown edit stage: ${stage}`);
  const request = stage === 'density'
    ? 'At the same 1280 by 900 pixel viewport, make the layout compact: 12px internal padding and 12px gap. Keep two equal columns.'
    : stage === 'responsive'
      ? 'The viewport is now 390 by 844 pixels. Change to one column. Keep the compact 12px internal padding and 12px gap.'
      : `At the same 390 by 844 pixel viewport, append one Text node with ID help and literal text ${JSON.stringify(fixture.help.text)} after all existing children. Keep the one-column compact layout.`;
  return `${request} Preserve every existing node ID, content, option order, binding, and press action. Keep the host-edited ${fixture.interaction.target} value ${JSON.stringify(fixture.interaction.enter)} and its focus. Return the complete updated spec.`;
}
export function sessionMessages(scenario, arm) {
  return [{ role: 'system', content: `${SYSTEM}\n\n${catalogFor(arm)}` }, { role: 'user', content: initialPrompt(scenario, arm) }];
}
export function cases() {
  return SCENARIO_IDS.flatMap((scenario) => ARMS.flatMap((arm) => SCENARIOS[scenario].stages.map((stage) => ({
    scenario, arm, stage: stage.id, viewport: { ...stage.viewport }, expressible: true,
    expressibilityReason: 'The catalog supports the exact requested spacing, columns, fields, local action, and appended Text node.',
    expectedStyle: { ...stage.expect },
    semanticIds: [...SCENARIOS[scenario].nodes.map((node) => node.id), ...(stage.id === 'structure' ? ['help'] : [])],
  }))));
}
