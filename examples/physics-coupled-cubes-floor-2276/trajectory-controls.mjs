// Data-only endpoint controls. Root executes; no World, candidate or solver import.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { numericWordsHex } from './cases.mjs';
const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===3);
const out=join(here,'evidence',id);mkdirSync(out);const deadline=Date.now()+170000;
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const bank=join(here,'evidence/trajectory-01'),oracle=join(here,'trajectory-oracle.py');
const inputs=[import.meta.filename,oracle,join(here,'oracle.py'),join(here,'cases.mjs'),join(root,'examples/physics-model-input/model.mjs'),join(bank,'native-full-states.json'),join(bank,'native-whole256.stdout'),join(bank,'result.json'),python,process.execPath];
function sha(p){const fd=openSync(p,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');}
const pins=Object.fromEntries(inputs.map(p=>[p,sha(p)]));let bytes=0;
const put=(name,value)=>{const body=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';bytes+=Buffer.byteLength(body);assert.ok(bytes<=16*1024*1024);writeFileSync(join(out,name),body,{flag:'wx'});};
put('inputs.json',pins);const controls=[];let failure=null,attempts=0;
try {
  assert.equal(JSON.parse(readFileSync(join(bank,'result.json'))).status,'COUPLED_TRAJECTORY256_SOURCE_NATIVE_RESTORE_AND_REGRESSIONS_CONFIRMED');
  const original=readFileSync(join(bank,'native-full-states.json'),'utf8'),paid=readFileSync(join(bank,'native-whole256.stdout'),'utf8');
  const raw=JSON.parse(original),words=Buffer.from(raw.numericWordsF64leHex,'hex');let offset=0;
  function restore(x){if(typeof x==='number'){assert.ok(offset+8<=words.length);const v=words.readDoubleLE(offset);offset+=8;assert.ok(Number.isFinite(v)&&v===x);return v;}if(Array.isArray(x))return x.map(restore);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,restore(v)]));return x;}
  const restored=restore(raw.data);assert.equal(offset,words.length);assert.equal(restored.states.length,257);assert.equal(numericWordsHex(restored),raw.numericWordsF64leHex);
  for(const name of ['paid-256','terminal-velocity','terminal-missing-contact','terminal-witness-1e-11']){
    const data=structuredClone(restored),last=data.states[256];
    if(name==='terminal-velocity')last.bodies.find(b=>b.id==='upper').velocityMps[1]+=.01;
    if(name==='terminal-missing-contact'){const at=last.contacts.findIndex(c=>new Set([c.colliderAId,c.colliderBId]).has('upper.shape'));assert.ok(at>=0);last.contacts.splice(at,1);}
    if(name==='terminal-witness-1e-11')last.contacts[0].pointM[1]+=1e-11;
    const wire=name==='paid-256'?original:JSON.stringify({...raw,data,numericWordsF64leHex:numericWordsHex(data)})+'\n';assert.ok(Buffer.byteLength(wire)<=2*1024*1024);
    put(name+'-request.json',wire);attempts++;const r=spawnSync(python,['-B',oracle],{cwd:root,input:wire,encoding:'utf8',timeout:Math.max(1,deadline-Date.now()),maxBuffer:2*1024*1024});put(name+'.stdout',r.stdout??'');put(name+'.stderr',r.stderr??'');assert.equal(r.status,0);assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.stderr,'');const reply=JSON.parse(r.stdout);
    if(name==='paid-256'){assert.equal(r.stdout,paid);assert.equal(reply.ok,true);}
    else {assert.equal(reply.ok,false);assert.equal(reply.resolved,true);assert.equal(reply.executionFailure,false);assert.ok(reply.violations.length>0);if(name==='terminal-witness-1e-11')assert.ok(reply.violations.some(v=>v.gate==='geometryRepresentativeFacePlaneM'));}
    assert.equal(reply.certificates.receivedTransitions,256);
    controls.push({name,status:reply.status,violations:reply.violations,receivedTransitions:reply.certificates.receivedTransitions});
  }
  assert.equal(attempts,4);
}catch(error){failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{try{for(const[p,s]of Object.entries(pins))assert.equal(sha(p),s);assert.ok(Date.now()<deadline);}catch(error){failure??={message:error.message};process.exitCode=1;}put('result.json',{status:failure?'TRAJECTORY_ENDPOINT_CONTROLS_NO_GO':'TRAJECTORY_ENDPOINT_CONTROLS_CONFIRMED',failure,controls,oracleAttempts:attempts,worlds:0,acceptedSteps:0,scope:'DATA_ONLY_PAID_256_ENDPOINT_OBSERVER_CONTROLS',gatesChanged:false,mobile:false,publication:false});}
