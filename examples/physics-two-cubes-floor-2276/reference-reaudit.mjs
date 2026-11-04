// Root-owned saved-packet audit. No World, candidate or fixture evaluation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,join,relative} from 'node:path';
const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];
assert.match(id??'',/^[a-z0-9-]+$/);
const out=join(here,'evidence',id);mkdirSync(out);
const paid=join(here,'evidence/api-01'),python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const inputs={},deadline=Date.now()+170000;
function pin(p){const b=readFileSync(p);return{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
function add(p){inputs[relative(root,p)]=pin(p);}
for(const p of [import.meta.filename,join(here,'oracle.py'),join(here,'baseline/oracle-classification-v1/oracle.py'),join(paid,'result.json'),join(paid,'frozen-inputs.json'),python])add(p);
const frozen=JSON.parse(readFileSync(join(paid,'frozen-inputs.json'))).frozen,referencePath=relative(root,join(here,'oracle.py'));
const original=pin(join(here,'baseline/oracle-classification-v1/oracle.py'));
assert.equal(original.sha256,frozen[referencePath]);
assert.equal(JSON.parse(readFileSync(join(paid,'result.json'))).status,'TWO_CUBES_FLOOR_NUMERICAL_SOURCE_NATIVE_CONFIRMED');
let frozenMatches=0;
for(const [name,sha]of Object.entries(frozen))if(name!==referencePath){assert.equal(pin(resolve(root,name)).sha256,sha,name);frozenMatches++;}
const checks=[];let firstFailure=null;
try{
 for(const graph of ['source','native'])for(const hz of [60,120,240]){
  const key=graph+'-separated-'+hz,packet=join(paid,key+'.json'),old=join(paid,key+'-oracle.stdout');add(packet);add(old);
  const saved=readFileSync(packet),wire=saved.at(-1)===10?saved:Buffer.concat([saved,Buffer.from('\n')]);assert.ok(wire.length<=2*1024*1024);
  const r=spawnSync(python,['-B',join(here,'oracle.py')],{cwd:root,input:wire,timeout:Math.max(1,deadline-Date.now()),maxBuffer:65536});
  writeFileSync(join(out,key+'.stdout'),r.stdout??'');writeFileSync(join(out,key+'.stderr'),r.stderr??'');
  assert.ok(r.status===0&&!r.error&&!r.signal&&r.stderr.length===0,key+' execution');
  assert.ok(Buffer.from(r.stdout).equals(readFileSync(old)),key+' full reply bytes differ');
  const reply=JSON.parse(r.stdout);assert.ok(reply.ok&&reply.resolved&&!reply.executionFailure);
  add(join(out,key+'.stdout'));checks.push({key,status:'BYTE_EQUAL_COMPLETE_ORIGINAL_REPLY',wireBytes:wire.length,replyBytes:r.stdout.length});
 }
}catch(e){firstFailure={name:e.name,message:e.message};process.exitCode=1;}
for(const [name,expected]of Object.entries(inputs))assert.deepEqual(pin(resolve(root,name)),expected,name+' changed');
const result={status:firstFailure?'REFERENCE_REAUDIT_NO_GO':'REFERENCE_REAUDIT_SIX_REPLIES_BYTE_EQUAL',firstFailure,inputs,oldReference:{path:relative(root,join(here,'baseline/oracle-classification-v1/oracle.py')),...original},newReference:{path:referencePath,...pin(join(here,'oracle.py'))},checks,unchangedFrozenInputs:frozenMatches,newWorldCalls:0,newTrajectoryCalls:0,criteriaChanged:false,productionChanged:false};
writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,checks:checks.length,newWorldCalls:0}));
