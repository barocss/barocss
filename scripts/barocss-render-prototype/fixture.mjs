// Authored comparison input. Neither arm receives an AI-generated result.
export const INITIAL = Object.freeze({
  root: 'layout',
  elements: {
    layout: { type: 'Layout', props: { id: 'layout', columns: 'responsive', gap: 'fractional' }, children: ['card'] },
    card: { type: 'Card', props: { id: 'card', padding: 'fractional', tone: 'light' }, children: ['heading', 'name', 'save'] },
    heading: { type: 'Text', props: { id: 'heading', text: 'Profile settings' }, children: [] },
    name: { type: 'Input', props: { id: 'name', label: 'Name', value: { $bindState: '/name' } }, children: [] },
    save: { type: 'Button', props: { id: 'save', label: 'Save profile' }, children: [], on: { press: { action: 'save' } } },
  },
});

export function editedSpec() {
  const spec = structuredClone(INITIAL);
  spec.elements.layout.props.gap = 'wide';
  spec.elements.card.props.padding = 'spacious';
  spec.elements.card.props.tone = 'dark';
  spec.elements.card.children.splice(1, 0, 'help');
  spec.elements.help = { type: 'Text', props: { id: 'help', text: 'Changes stay on this device.' }, children: [] };
  return spec;
}
