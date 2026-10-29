import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part } from '../../packages/barocss-cad-model/src/api/index.ts';
const seed = part('Fill cut seed').box({w:60,d:40,h:10})
  .subtract(p => p.box({w:3,d:5,h:10,x:7,y:6}));
assert.ok(Math.abs(seed.mass({density:1}).volume - 23850) < 1e-7);
assert.ok(!seed.doc.nodes.some(n => n.kind === 'fill-feature-pattern'));
writeFileSync(process.argv[2], JSON.stringify(seed.doc,null,2)+'\n');