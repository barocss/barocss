import { CadEditorPrismFeature } from '@barocss/cad-editor/react';
import serialAuthoredText from './fixtures/serial-part-v2.authored.json?raw';
import initialAuthoredText from './fixtures/affine-prism.authored.json?raw';

export function PrismFeatureApp({ version = 0 }: { version?: 0 | 2 }) {
  return <div style={{ height: '100vh', overflow: 'auto' }}><nav aria-label="Workspace navigation"><a href="#/projects">← Projects</a></nav>
    <CadEditorPrismFeature version={version} initialAuthoredText={version === 2 ? serialAuthoredText : initialAuthoredText} /></div>;
}
