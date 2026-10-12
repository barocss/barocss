import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cad } from '../dist/index.js';
import { provePlate,work,nativeBodyHash } from '../test/modeling-hole-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));assert.equal(process.argv.length,3);
const directory=resolve(process.argv[2]),file=resolve(directory,'edited.cad-model.json'),text=readFileSync(file,'utf8');
const source=JSON.parse(readFileSync(resolve(directory,'source-flow.json'),'utf8'));
const flow={status:'running',modelCalls:0,stages:[],entrySHA256:createHash('sha256').update(readFileSync(new URL('../dist/index.js',import.meta.url))).digest('hex')};
const write=()=>writeFileSync(resolve(directory,'cold-flow.json'),JSON.stringify(flow,null,2)+'\n');
const stage=(label,action)=>{const disk=statfsSync(directory);assert.ok(disk.bavail*disk.bsize>=500*1024*1024);assert.ok(++flow.modelCalls<=2);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,recomputation:result.recomputation});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try {
  const reopened=stage('fresh emitted off-centre qualified hole load',()=>cad.load(text));
  work(reopened,[],[0,1,2]);flow.reopened=provePlate(reopened,[32.5,18.75],2.5,[30,45,16.25,18.75]);
  assert.equal(reopened.save(),text);flow.reopenedBodySHA256=nativeBodyHash(reopened);assert.equal(flow.reopenedBodySHA256,source.editedBodySHA256);
  flow.authoredInputSHA256=createHash('sha256').update(text).digest('hex');
  const edited=stage('cold radius 2.5 to 5',()=>reopened.withParameters({radius:5}));
  work(edited,[0,1],[2],reopened);flow.reedited=provePlate(edited,[32.5,18.75],5,[27.5,42.5,13.75,16.25]);
  assert.equal(reopened.save(),text);assert.equal(nativeBodyHash(reopened),flow.reopenedBodySHA256);assert.equal(readFileSync(file,'utf8'),text);
  flow.reeditedBodySHA256=nativeBodyHash(edited);assert.equal(flow.modelCalls,2);flow.status='passed';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
