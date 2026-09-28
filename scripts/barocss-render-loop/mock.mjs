import { INITIAL } from '../barocss-render-prototype/fixture.mjs';

const threadId = '00000000-0000-4000-8000-000000000460';

// Authored test data. This function never starts Codex or another model.
export async function generateMockScreen({ kind, input }) {
  if (kind === 'initial') return { threadId, specJson: JSON.stringify(INITIAL) };
  return { threadId, specJson: JSON.stringify({
    root: 'layout', elements: {
      layout: { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'fractional' }, children: ['card'] },
      card: { type: 'Card', props: { id: 'card', padding: 'spacious', tone: 'light' }, children: ['heading', 'summary'] },
      heading: { type: 'Text', props: { id: 'heading', text: 'Profile saved' }, children: [] },
      summary: { type: 'Text', props: { id: 'summary', text: `Name: ${input.name}` }, children: [] },
    },
  }) };
}
