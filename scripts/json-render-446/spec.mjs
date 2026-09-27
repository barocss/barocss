import { ARMS, SCENARIOS } from './contract.mjs';
import { CLASS_PLAN } from './styles.mjs';

export function initialState(scenario) {
  const fixture = SCENARIOS[scenario];
  if (!fixture) throw new Error(`unknown scenario: ${scenario}`);
  return Object.fromEntries(fixture.nodes.filter((node) => node.type === 'Input' || node.type === 'Select').map((node) => [node.id, node.value]));
}

export function specFor(scenario, arm, stageId) {
  const fixture = SCENARIOS[scenario];
  if (!fixture || !ARMS[arm]) throw new Error('unknown scenario or arm');
  const stage = fixture.stages.find((item) => item.id === stageId);
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const variant = stageId === 'initial' ? 'regular' : stageId === 'density' ? 'compact' : 'stacked';
  const layoutProps = arm === 'fixed' ? { id: 'layout', variant }
    : arm === 'bounded' ? { id: 'layout', ...stage.expect }
      : { id: 'layout', className: CLASS_PLAN[stageId] };
  const nodes = [...fixture.nodes, ...(stageId === 'structure' ? [fixture.help] : [])];
  const elements = { layout: { type: 'Layout', props: layoutProps, children: nodes.map((node) => node.id) } };
  for (const node of nodes) {
    const props = { id: node.id };
    if (node.text !== undefined) props.text = node.text;
    if (node.label !== undefined) props.label = node.label;
    if (node.options !== undefined) props.options = node.options;
    if (node.type === 'Input' || node.type === 'Select') props.value = { $bindState: `/${node.id}` };
    elements[node.id] = { type: node.type, props, children: [], ...(node.action ? { on: { press: { action: node.action } } } : {}) };
  }
  return { root: 'layout', elements };
}
