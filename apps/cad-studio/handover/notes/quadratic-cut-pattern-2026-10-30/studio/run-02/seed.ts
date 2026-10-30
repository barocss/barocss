import {writeFileSync} from 'node:fs';import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
const p=part('D346 curved CUT').box({w:60,d:40,h:10}).subtract(p=>p.box({w:3,d:5,h:10,x:7,y:6})).box({w:12,d:7,h:5,x:80,y:-3,z:1});
writeFileSync(process.argv[2],JSON.stringify(p.doc,null,2));