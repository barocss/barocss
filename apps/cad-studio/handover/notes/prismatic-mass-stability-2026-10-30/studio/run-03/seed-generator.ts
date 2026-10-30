import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part,Location} from '../../packages/barocss-cad-model/src/api/index.ts';
const source=part('D343 translated cylinder').cylinder({r:3,h:5.00009}).moved(Location.at([.1234567,-.2345678,.3456789])).box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.equal(source.bodies().length,2);writeFileSync(process.argv[2],JSON.stringify(source.doc,null,2));