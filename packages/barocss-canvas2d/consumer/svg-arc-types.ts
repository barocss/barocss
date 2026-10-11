import { importSVGArcElement as source, importSVGElement as legacy } from '../src/index.js';
import { importSVGArcElement as emitted } from '../dist/index.js';
import type { SceneV5 } from '../src/index.js';
const root = document.createElementNS('http://www.w3.org/2000/svg','svg');
const a: SceneV5 = source(root).scene;
const b = emitted(root);
const c = legacy(root);
const width: number = a.version + b.diagnostics.viewport.width + c.diagnostics.viewBox.x;
const ids: string[] = b.diagnostics.generatedIds;
// @ts-expect-error required root
source();
// @ts-expect-error synchronous result
const promise: Promise<unknown> = source(root);
// @ts-expect-error Element required
emitted('svg');
void [width,ids,promise];
