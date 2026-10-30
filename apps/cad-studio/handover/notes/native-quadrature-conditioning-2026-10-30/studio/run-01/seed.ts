import {writeFileSync} from 'node:fs';
import {part,Location} from '../../packages/barocss-cad-model/src/api/index.ts';
const p=part('D344 target-only cylinder').cylinder({r:3,h:5.00009}).moved(Location.at([.1234567,-.2345678,.3456789]));
writeFileSync(process.argv[2],JSON.stringify(p.doc,null,2));