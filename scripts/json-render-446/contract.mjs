// Frozen, research-only replay contract. This file does not render or simulate json-render.
export const ARMS = Object.freeze({
  fixed: { styling: 'catalog-owned variants', knobs: ['variant'] },
  bounded: { styling: 'catalog-owned density and layout props', knobs: ['density', 'columns', 'placement'] },
  utility: { styling: 'model-selectable className resolved by BaroCSS', knobs: ['className'] },
  build: { styling: 'build-only class inventory control', knobs: ['className'] },
});

const stages = [
  { id: 'initial', edit: null, viewport: { width: 1280, height: 900 }, expect: { density: 'regular', columns: 2, placement: 'side' } },
  { id: 'density', edit: 'compact', viewport: { width: 1280, height: 900 }, expect: { density: 'compact', columns: 2, placement: 'side' } },
  { id: 'responsive', edit: 'narrow', viewport: { width: 390, height: 844 }, expect: { density: 'compact', columns: 1, placement: 'stacked' } },
  { id: 'structure', edit: 'add-help', viewport: { width: 390, height: 844 }, expect: { density: 'compact', columns: 1, placement: 'stacked' } },
];

export const SCENARIOS = Object.freeze({
  settings: {
    title: 'Account settings',
    nodes: [
      { id: 'heading', type: 'Text', text: 'Account settings' },
      { id: 'email', type: 'Input', label: 'Email', value: 'ada@example.test' },
      { id: 'plan', type: 'Select', label: 'Plan', options: ['Free', 'Team'], value: 'Team' },
      { id: 'save', type: 'Button', label: 'Save changes', action: 'save' },
    ],
    interaction: { target: 'email', enter: 'ada+edited@example.test', focus: 'email', action: 'save', expectedActionCount: 1 },
    help: { id: 'help', type: 'Text', text: 'Changes are saved locally.' },
    stages,
  },
  dashboard: {
    title: 'Sales dashboard',
    nodes: [
      { id: 'heading', type: 'Text', text: 'Sales dashboard' },
      { id: 'period', type: 'Select', label: 'Period', options: ['Week', 'Month'], value: 'Week' },
      { id: 'revenue', type: 'Text', text: '$48,210' },
      { id: 'orders', type: 'Text', text: '120 orders' },
      { id: 'refresh', type: 'Button', label: 'Refresh', action: 'refresh' },
    ],
    interaction: { target: 'period', enter: 'Month', focus: 'period', action: 'refresh', expectedActionCount: 1 },
    help: { id: 'help', type: 'Text', text: 'Figures use sample data.' },
    stages,
  },
  kiosk: {
    title: 'Coffee order',
    nodes: [
      { id: 'heading', type: 'Text', text: 'Coffee order' },
      { id: 'drink', type: 'Select', label: 'Drink', options: ['Espresso', 'Latte'], value: 'Latte' },
      { id: 'quantity', type: 'Input', label: 'Quantity', value: '1' },
      { id: 'price', type: 'Text', text: '$4.00' },
      { id: 'add', type: 'Button', label: 'Add to order', action: 'add' },
    ],
    interaction: { target: 'quantity', enter: '2', focus: 'quantity', action: 'add', expectedActionCount: 1 },
    help: { id: 'help', type: 'Text', text: 'Demo order. No payment.' },
    stages,
  },
});

export const MEASURES = Object.freeze([
  'specValid', 'expressible', 'domSignature', 'inputValuePreserved', 'focusPreserved',
  'actionCount', 'unstyledFrames', 'themeAdherence', 'hostStyleDelta', 'screenshot',
]);

export function fixtureCases() {
  return Object.entries(SCENARIOS).flatMap(([scenario, fixture]) =>
    Object.keys(ARMS).flatMap((arm) => fixture.stages.map((stage) => ({
      scenario, arm, stage: stage.id, viewport: stage.viewport, expectedStyle: stage.expect,
      semanticIds: [...fixture.nodes.map((node) => node.id), ...(stage.id === 'structure' ? [fixture.help.id] : [])],
    }))));
}

export function validateContract() {
  const errors = [];
  for (const [name, fixture] of Object.entries(SCENARIOS)) {
    const ids = fixture.nodes.map((node) => node.id);
    if (new Set(ids).size !== ids.length || ids.includes(fixture.help.id)) errors.push(`${name}: duplicate node id`);
    if (!ids.includes(fixture.interaction.target)) errors.push(`${name}: interaction target missing`);
    if (!fixture.nodes.some((node) => node.action === fixture.interaction.action)) errors.push(`${name}: action missing`);
    if (fixture.stages.map((stage) => stage.id).join(',') !== 'initial,density,responsive,structure') errors.push(`${name}: stage sequence changed`);
    if (fixture.stages[2].viewport.width >= fixture.stages[1].viewport.width) errors.push(`${name}: responsive viewport not narrower`);
  }
  if (fixtureCases().length !== 48) errors.push('expected 3 scenarios × 4 arms × 4 stages');
  return errors;
}
