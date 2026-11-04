// Pure harness IO controls. No package/provider/reference import or invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {wire,json,wordsDigest} from './io.mjs';

test('JSON wire byte counts preserve exact short escapes and Unicode encoding',()=>{
 const controls=['\b\t\n\f\r',String.fromCharCode(...Array.from({length:32},(_,i)=>i)),
  'quote" slash\\', '\ud800','\udfff','\ud800\udfff','한글😀',-0,
  {nested:['\n',-0,'\ud800'],absent:undefined}];
 for(const value of controls){
  const expected=Buffer.from(JSON.stringify(value)+'\n');
  assert.deepEqual(wire(value),expected);
  assert.throws(()=>wire(value,expected.length-1),/preallocation bound/);
 }
 assert.notEqual(wordsDigest(-0).sha256,wordsDigest(0).sha256,'binary64 evidence retains zero sign');
});

test('failure receipt retains multiline error and both failure records',()=>{
 const directory=mkdtempSync(join(tmpdir(),'physics-stack-io-'));
 try{
  const firstFailure={stage:'initial-quality',errorClass:'Error',code:'REFERENCE_INPUT',message:'state must contain a contacts array',stack:'Error: first\n\tat campaign\n'};
  const value={status:'FIRST_FAILURE',firstFailure,secondaryFailure:{message:'wire receipt size mismatch\n1840 != 1804'},full1200:'BLOCKED_NOT_RUN'};
  const path=join(directory,'result.json');json(path,value);
  assert.deepEqual(readFileSync(path),Buffer.from(JSON.stringify(value)+'\n'));
  assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),value);
 }finally{rmSync(directory,{recursive:true});}
});
