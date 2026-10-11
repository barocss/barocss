import { createArcControlCandidate } from './svg-arcs.mjs';
import { createDisplayTree, createDisplayTreeFromScene } from '../src/index.js';
import { createDisplayTreeFromScene as emitted } from '../dist/index.js';
import type { DisplayTree, SceneV29, PathHandle } from '../src/index.js';
const scene: SceneV29 = createDisplayTree('TypeOnly').snapshot();
const source: DisplayTree = createArcControlCandidate(scene, 2, 'C2', { x: 12, y: 4 });
for (const tree of [source, createDisplayTreeFromScene(scene), emitted(scene)]) {
  const path = tree.get('ArcPath');
  if (path?.kind === 'path') {
    const handle: PathHandle = path;
    handle.setPath({ commands: handle.data.commands, fill: handle.data.fill, stroke: handle.data.stroke });
  }
}
// @ts-expect-error unsupported control slot
createArcControlCandidate(scene, 2, 'C3', { x: 12, y: 4 });
// @ts-expect-error current editable Scene required
createArcControlCandidate({ version: 5 }, 2, 'C1', { x: 12, y: 4 });
// @ts-expect-error both coordinates required
createArcControlCandidate(scene, 2, 'C1', { x: 12 });
