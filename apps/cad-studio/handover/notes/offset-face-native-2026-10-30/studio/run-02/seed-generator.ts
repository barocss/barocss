import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part,param,sketch} from '../../packages/barocss-cad-model/src/api/index.ts';
const addWitness=p=>p.box({w:12,d:7,h:5,x:80,y:-3,z:1});
const main=addWitness(part('D342 fractional cap').parameter('height',5).parameter('offsetDistance',3).box({w:20.00003,d:10,h:param('height'),x:.1234567,y:-.2345678,z:.3456789}));
const draft=addWitness(part('D342 drafted refusal').extrude(sketch().rectangle({w:20,d:10}),{h:5,draft:5}));
const cylinder=addWitness(part('D342 integer circle control').cylinder({r:3,h:5}));
for(const[file,p]of [[process.argv[2],main],[process.argv[3],draft],[process.argv[4],cylinder]]){assert.equal(p.bodies().length,2);writeFileSync(file,JSON.stringify(p.doc,null,2));}