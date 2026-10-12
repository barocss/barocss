import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { proveFinishes,proveSuppressionPreflight,work,bodyHash } from '../test/modeling-suppression-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const directory=resolve(process.argv[2]),entry=resolve(process.argv[3]??new URL('../dist/index.js',import.meta.url).pathname);
const {cad,CadModelError}=await import(pathToFileURL(entry).href);
const flow={status:'running',modelCalls:0,stages:[],entrySHA256:createHash('sha256').update(readFileSync(entry)).digest('hex')};
const write=()=>writeFileSync(resolve(directory,'cold-flow.json'),JSON.stringify(flow,null,2)+'\n');
const stage=(label,action)=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);assert.ok(++flow.modelCalls<=2);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,recomputation:result.recomputation});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,stage:error.stage,entity:error.entity,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try{
  const source=JSON.parse(readFileSync(resolve(directory,'source-flow.json'),'utf8')),text=readFileSync(resolve(directory,'edited.cad-model.json'),'utf8');
  const reopened=stage('emitted cold named active finishes',()=>cad.load(text));
  work(reopened,[],[0,1,2,3,4]);flow.reopened=proveFinishes(reopened,false,false,3032);
  assert.equal(reopened.save(),text);assert.equal(bodyHash(reopened),source.editedBodySHA256);
  flow.preNativeControls=proveSuppressionPreflight(reopened,CadModelError);
  const edited=stage('emitted front finish disabled',()=>reopened.withSuppression({frontFinish:true}));
  work(edited,[],[0,1,2,3,4],reopened);flow.reedited=proveFinishes(edited,true,false,3040);
  assert.equal(reopened.save(),text);assert.equal(bodyHash(reopened),source.editedBodySHA256);
  assert.equal(flow.modelCalls,2);flow.status='passed';flow.authoredInputSHA256=createHash('sha256').update(text).digest('hex');flow.reopenedBodySHA256=bodyHash(reopened);flow.reeditedBodySHA256=bodyHash(edited);write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
