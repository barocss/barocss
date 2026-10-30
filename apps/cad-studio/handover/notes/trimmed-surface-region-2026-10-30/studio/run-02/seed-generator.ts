import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {emptyDirect,importSource} from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness=part('D341 witness').box({w:12,d:7,h:5,x:80,y:-3,z:1});
const direct=importSource(emptyDirect(),"@model d341 { version:0; length-unit:mm;\n @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }\n @curve #u-loop { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }\n}",'D341');assert.ok(direct.objects.every(o=>!o.trims));
writeFileSync(process.argv[2],JSON.stringify({...witness.doc,direct},null,2));