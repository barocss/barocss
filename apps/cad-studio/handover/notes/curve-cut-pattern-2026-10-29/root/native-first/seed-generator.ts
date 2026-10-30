import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part, Location } from '../../packages/barocss-cad-model/src/api/index.ts';
const seed = part('Path cut seed').box({w:60,d:40,h:10})
  .subtract(p => p.box({w:4,d:2,h:10,x:0,y:8}).moved(Location.at([8,0,0])));
assert.ok(Math.abs(seed.mass({density:1}).volume - 23920) < 1e-7);
writeFileSync(process.argv[2], JSON.stringify(seed.doc,null,2)+'\n');