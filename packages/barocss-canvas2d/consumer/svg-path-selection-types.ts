import { createArcControlCandidate } from './svg-arcs.mjs';
import { createDisplayTree } from '../src/index.js';
import { createDisplayTreeFromScene } from '../dist/index.js';
import type { DisplayTree, SceneV29 } from '../src/index.js';
const scene: SceneV29 = createDisplayTree('TypesOnly').snapshot();
const legacy: DisplayTree = createArcControlCandidate(scene, 2, 'C1', { x: 2, y: 4 });
const selected: DisplayTree = createArcControlCandidate(scene, 2, 'C1', { x: 2, y: 4 }, 'Badge');
const emitted = createDisplayTreeFromScene(selected.snapshot());
const path = emitted.get('Badge');
if (path?.kind === 'path') path.setPath({ commands: path.data.commands, fill: path.data.fill, stroke: path.data.stroke });
// @ts-expect-error Path ID is a string
createArcControlCandidate(scene, 2, 'C1', { x: 2, y: 4 }, 1);
// @ts-expect-error existing C1/C2 slots only
createArcControlCandidate(scene, 2, 'C3', { x: 2, y: 4 }, 'Badge');
void legacy;
