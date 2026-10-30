import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part } from '../../packages/barocss-cad-model/src/api/index.ts';
import { emptyDirect, importSource } from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness = part('witness').box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.ok(Math.abs(witness.mass({density:1}).volume-420)<1e-7);
const direct = importSource(emptyDirect(), "@model d337 { version:0; length-unit:mm;\n @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }\n @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }\n @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }\n}", 'D337');
assert.ok(direct.objects.every(o => !o.trims));
writeFileSync(process.argv[2], JSON.stringify({...witness.doc,direct},null,2)+'\n');