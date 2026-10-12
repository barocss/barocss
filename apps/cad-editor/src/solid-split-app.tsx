import { CadEditorSolidSplit } from '@barocss/cad-editor/react';
import authoredText from './fixtures/solid-split-main.authored.json?raw';

export function SolidSplitApp() {
  return <div className="solid-split-app"><nav aria-label="Workspace navigation"><a href="#/projects">← Projects</a></nav>
    <CadEditorSolidSplit initialAuthoredText={authoredText}/></div>;
}
