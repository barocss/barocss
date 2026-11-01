import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
assert.equal(process.argv[2],'--run-id');const id=process.argv[3];
assert.equal(process.argv.length,4);assert(/^[a-z][a-z0-9-]{0,63}$/.test(id));
const out=join(here,'evidence',id);mkdirSync(out,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex');
const put=(name,v)=>writeFileSync(join(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const contract=JSON.parse(readFileSync(join(here,'STATIC-INPUT-CONTRACT.json')));
const providers=JSON.parse(readFileSync(join(here,'STATIC-INPUT-PROVIDERS.json')));
const counts={admissionAttempts:0,admissionReturns:0,WorldCalls:0,candidateCalls:0};
const state={status:'IN_PROGRESS',counts,firstFailure:null};
const auth=()=>{for(const [path,pin]of Object.entries(providers.files)){const b=readFileSync(resolve(root,path));assert.equal(b.length,pin.bytes,path);assert.equal(sha(b),pin.sha256,path);}};
const bits=values=>values.map(v=>{const b=Buffer.alloc(8);b.writeDoubleLE(v);return b.toString('hex');});
try{
  auth();put('start.json',{counts:{...counts},providerFiles:Object.keys(providers.files).length,node:process.version});
  const entry=join(here,'evidence/baseline-emitted-01/provider/barocss-physics/dist/cad-proxy.js');
  const api=await import(pathToFileURL(entry).href);
  const source=readFileSync(join(root,'examples/physics-scene/fluid-cad-shelf.barocad'),'utf8');
  counts.admissionAttempts++;put('call-prefix.json',{counts:{...counts},request:contract.request});
  const proxy=api.admitCadSurfaceProxy(source,contract.request);counts.admissionReturns++;
  assert.deepEqual(proxy.sourceBoundsMM,contract.expected.sourceBoundsMM);
  assert.deepEqual(proxy.sourceCenterMM,contract.expected.sourceCenterMM);
  assert.deepEqual(proxy.body.initial.positionM,contract.expected.positionM);
  assert.deepEqual(proxy.collider.geometry,{kind:'box',halfExtentsM:contract.expected.halfExtentsM});
  assert.equal(proxy.body.kind,'static');assert.equal(proxy.bodyId,'fixture:fluid_shelf.shelf');
  state.operands={sourceBoundsMM:proxy.sourceBoundsMM,sourceCenterMM:proxy.sourceCenterMM,body:proxy.body,collider:proxy.collider,binding:proxy.binding,
    positionF64LE:bits(proxy.body.initial.positionM),halfExtentsF64LE:bits(proxy.collider.geometry.halfExtentsM)};
  auth();state.status='PASS_STATIC_INPUT_OPERANDS';
}catch(error){state.status='FAIL';state.firstFailure={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
put('summary.json',state);
