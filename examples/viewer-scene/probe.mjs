import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const source = readFileSync(new URL('two-surfaces.barocad', import.meta.url), 'utf8');
const native = parseBaroCadSource(source, { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1 });
assert.equal(typeof createViewer, 'function');
assert.equal(native.source, source);
assert.deepEqual(native.surfaces.map(surface => surface.surfaceId), ['rational_panel', 'flat_panel']);
assert.equal(native.model.objects[0].weights[0][1], 0.7071067811865476);
assert.ok(Object.is(native.model.objects[0].controlPoints[0][0][0], -0));
assert.deepEqual(native.surfaces[0].packet.parameters.slice(0, 2), [2, 10]);
assert.deepEqual(native.unrenderedCurveIds, ['reference_edge']);
console.log('Compiled Viewer export and native source → two unchanged preview packets: OK');
