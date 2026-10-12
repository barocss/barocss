import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cad } from '../dist/index.js';
import { proveBracket,work,nativeBodyHash } from '../test/modeling-union-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));assert.equal(process.argv.length,3);
const directory=resolve(process.argv[2]),file=resolve(directory,'edited.cad-model.json'),text=readFileSync(file,'utf8'),source=JSON.parse(readFileSync(resolve(directory,'source-flow.json'),'utf8'));
const hash=text=>createHash('sha256').update(text).digest('hex');
const flow={status:'running',modelCalls:0,stages:[],entrySHA256:hash(readFileSync(new URL('../dist/index.js',import.meta.url)))};
const write=()=>writeFileSync(resolve(directory,'cold-flow.json'),JSON.stringify(flow,null,2)+'\n');
const stage=(label,action)=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);assert.ok(++flow.modelCalls<=2);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,recomputation:result.recomputation});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try{
 const reopened=stage('fresh emitted cold L-bracket',()=>cad.load(text));work(reopened,[],[0,1,2,3,4]);flow.reopened=proveBracket(reopened,3072,14);
 assert.ok(Object.is(reopened.parameters.legMinX,-0)&&Object.is(reopened.parameters.legMinY,-0));assert.equal(reopened.save(),text);
 flow.reopenedBodySHA256=nativeBodyHash(reopened);assert.equal(flow.reopenedBodySHA256,source.editedBodySHA256);flow.authoredInputSHA256=hash(text);
 const edited=stage('cold leg height 8 to 16 stepped boss',()=>reopened.withParameters({legHeight:16}));work(edited,[0,1,2],[3,4],reopened);flow.reedited=proveBracket(edited,4608,20);
 assert.equal(reopened.save(),text);assert.equal(nativeBodyHash(reopened),flow.reopenedBodySHA256);assert.equal(readFileSync(file,'utf8'),text);
 flow.reeditedBodySHA256=nativeBodyHash(edited);assert.equal(flow.modelCalls,2);flow.status='passed';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
