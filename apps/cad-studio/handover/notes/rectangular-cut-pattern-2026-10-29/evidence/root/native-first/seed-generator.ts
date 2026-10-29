import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part, Location } from '../../packages/barocss-cad-model/src/api/index.ts';
import { bindParameter } from '../../packages/barocss-cad-model/src/engine/parameters.ts';
const source = part('rectangular pattern seed').parameter('seedX', 8).parameter('spacing', 16).parameter('spacing2', 16).parameter('copies', 3)
  .box({ w: 60, d: 40, h: 10 })
  .subtract(p => p.box({ w: 4, d: 4, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
const doc = source.doc, translated = doc.nodes.findIndex(node => node.kind === 'translate');
assert.ok(translated >= 0);
const seed = part('bound seed', bindParameter(doc, { feature: translated, value: 'o0', parameter: 'seedX' }));
assert.equal(seed.doc.nodes.at(-1).kind, 'difference');
assert.ok(!seed.doc.nodes.some(node => node.kind === 'rectangular-feature-pattern'));
assert.ok(Math.abs(seed.mass({ density: 1 }).volume - 23840) < 1e-7);
writeFileSync(process.argv[2], JSON.stringify(seed.doc, null, 2) + '\n');
