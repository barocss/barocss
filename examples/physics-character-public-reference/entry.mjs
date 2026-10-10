import {runInNewContext} from 'node:vm';
import selected from './selected-reference.json';
import {config,command} from './campaign.mjs';
import {CASES} from './fixture.mjs';
import {runReference} from './verification.mjs';
const foreign=runInNewContext('JSON.parse(input)',{input:JSON.stringify({config:config(CASES[1]),command:command(CASES[1]),tuple:[1,0,0]})});
console.log(JSON.stringify(runReference(selected,{measure:process.env.PHYSICS_REFERENCE_COST==='1',foreign})));
