import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const home='examples/physics-general-rotation-2276',out=home+'/evidence/general-01',python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
for(const grid of [60,120,240]){const x=spawnSync(python,['-B',home+'/reference-general.py','--audit','--input',out+'/source-grid-'+grid+'-audit-input.jsonl','--bank',home+'/bank.jsonl','--output',out+'/source-grid-'+grid+'-audit.json'],{encoding:'utf8',timeout:20000,maxBuffer:65536});console.log(x.stdout);console.error(x.stderr);assert.equal(x.status,0);}
const x=spawnSync(python,['-B',home+'/invariants-general.py','--input',out+'/source-long-audit-input.json','--output',out+'/source-long-audit.json'],{encoding:'utf8',timeout:20000,maxBuffer:65536});console.log(x.stdout);console.error(x.stderr);assert.equal(x.status,0);
