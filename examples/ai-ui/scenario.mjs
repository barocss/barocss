// Authored host scenario. Generated screens cannot change these permissions or transitions.
export const REQUEST_CONTRACT = Object.freeze({
  textBindings: Object.freeze(['/draft/name', '/draft/topic']),
  actions: Object.freeze(['review', 'edit', 'confirm']),
});
export const TRANSITIONS = Object.freeze({
  form: Object.freeze({ review: 'review' }),
  review: Object.freeze({ edit: 'form', confirm: 'confirmed' }),
  confirmed: Object.freeze({}),
});
const headings = { form: 'Request details', review: 'Review request', confirmed: 'Request confirmed' };

export function requestScreen(stage, input) {
  const elements = {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'wide' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'spacious', tone: 'light' }, children: ['heading'] },
    heading: { type: 'Text', props: { id: 'heading', text: headings[stage] }, children: [] },
  };
  if (stage === 'form') {
    for (const field of ['name', 'topic']) elements[field] = {
      type: 'Input', props: { id: field, label: field, value: { $bindState: `/draft/${field}` } }, children: [],
    };
  } else {
    for (const field of ['name', 'topic']) elements[`${field}-summary`] = {
      type: 'Text', props: { id: `${field}-summary`, text: `${field}: ${input.draft[field]}` }, children: [],
    };
  }
  for (const action of Object.keys(TRANSITIONS[stage])) elements[action] = {
    type: 'Button', props: { id: action, label: action }, children: [], on: { press: { action } },
  };
  elements.card.children.push(...Object.keys(elements).filter((id) => !['layout', 'card', 'heading'].includes(id)));
  return { root: 'layout', elements };
}

export function checkRequestScreen(spec, stage, input) {
  const nodes = Object.values(spec.elements);
  const actions = nodes.filter((node) => node.type === 'Button').map((node) => node.on.press.action).sort();
  if (JSON.stringify(actions) !== JSON.stringify(Object.keys(TRANSITIONS[stage]).sort()))
    throw new Error('Screen actions do not match the host transition');
  const bindings = nodes.filter((node) => node.type === 'Input').map((node) => node.props.value.$bindState).sort();
  const expectedBindings = stage === 'form' ? [...REQUEST_CONTRACT.textBindings].sort() : [];
  if (JSON.stringify(bindings) !== JSON.stringify(expectedBindings)) throw new Error('Screen fields do not match the host stage');
  const texts = nodes.filter((node) => node.type === 'Text');
  const expected = { heading: headings[stage], ...(stage === 'form' ? {} : {
    'name-summary': `name: ${input.draft.name}`, 'topic-summary': `topic: ${input.draft.topic}`,
  }) };
  if (texts.length !== Object.keys(expected).length || texts.some((node) =>
    !Object.hasOwn(expected, node.props.id) || expected[node.props.id] !== node.props.text))
    throw new Error('Screen summary does not match host input');
}
