import { CadEditorPrismFeature } from '@barocss/cad-editor/react';
import initialAuthoredText from './fixtures/affine-prism.authored.json?raw';

export function PrismFeatureApp() {
  return <div style={{ height: '100vh', overflow: 'auto' }}><nav aria-label="Workspace navigation"><a href="#/projects">← Projects</a></nav>
    <CadEditorPrismFeature initialAuthoredText={initialAuthoredText} /></div>;
}
