// Root runs this bank against authenticated Source and genuine Native closures.
// No shipping export, input mutation, expected pose, World or contact solve hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,existsSync,openSync,readSync,writeSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {privateCases,packet,budget} from './private-cases.mjs';

function hash(path) {
  const fd=openSync(path,'r'),digest=createHash('sha256'),block=Buffer.alloc(65536);
  try { let count;while((count=readSync(fd,block,0,block.length,null)))digest.update(block.subarray(0,count)); }
  finally {closeSync(fd);}
  return digest.digest('hex');
}

const modulePath=process.env.ANISOTROPIC_ISLAND_MODULE;
const moduleSHA=process.env.ANISOTROPIC_ISLAND_MODULE_SHA256;
const mathPath=process.env.ANISOTROPIC_MATH_MODULE;
const mathSHA=process.env.ANISOTROPIC_MATH_MODULE_SHA256;
const receiptsPath=process.env.ANISOTROPIC_PRIVATE_RECEIPTS;
for(const [path,sha] of [[modulePath,moduleSHA],[mathPath,mathSHA]]) {
  assert.ok(path?.startsWith('/'),'absolute authenticated module path');
  assert.match(sha??'',/^[0-9a-f]{64}$/);
  assert.equal(hash(path),sha);
}
assert.ok(receiptsPath?.startsWith('/')&&!existsSync(receiptsPath),'fresh receipts path');
const receiptFD=openSync(receiptsPath,'wx');
const api=await import(pathToFileURL(modulePath));
const math=await import(pathToFileURL(mathPath));
const cases=privateCases();
assert.equal(cases.length,budget.cases);
let calls=0,positives=0,refusals=0,receiptBytes=0;

function sameBodyWords(actual,expected) {
  assert.deepEqual(actual,expected);
  assert.equal(packet(actual).numericWordsF64leHex,packet(expected).numericWordsF64leHex);
}

for(const input of cases) test(input.caseId,()=>{
  const before=structuredClone(input.freeBodies),pairBefore=structuredClone(input.pairs);
  const contextBefore=structuredClone(input.context);
  let result=null,error=null;
  calls++;
  try {result=api.prepareFrictionlessIsland(input.freeBodies,input.pairs,input.context);}
  catch(caught) {error=caught;}
  sameBodyWords(input.freeBodies,before);
  assert.deepEqual(input.pairs,pairBefore);
  assert.deepEqual(input.context,contextBefore);
  if(input.expect==='NUMERIC_LIMIT') {
    assert.ok(error instanceof api.FrictionlessIslandFailure);
    assert.equal(error.code,'NUMERIC_LIMIT');
    assert.match(error.message,new RegExp(input.reasonPattern));
    assert.equal(result,null);
    refusals++;
    return;
  }
  assert.equal(error,null);
  assert.ok(result);
  assert.equal(result.diagnostics.normalProblem.points.length,0);
  assert.equal(result.diagnostics.applications.length,0);
  assert.equal(result.contacts.length,0);
  sameBodyWords(result.candidateBodies,before);
  for(const body of result.diagnostics.normalProblem.bodies) {
    const matrix=body.inverseInertiaWorld;
    for(let row=0;row<3;row++)for(let column=0;column<3;column++)
      assert.ok(Object.is(matrix[row][column],matrix[column][row]));
  }
  const angularLoads=[];
  for(const body of input.freeBodies) if(body.inverseMass!==0) {
    for(const torqueNms of [[1,0,0],[0,1,0],[0,0,1],[.125,-.25,.375]]) {
      const beforeSpinRadps=[...body.angularVelocityRadps];
      const inverseActionRadps=math.inverseInertia(body,torqueNms);
      const afterSpinRadps=math.add(beforeSpinRadps,inverseActionRadps);
      const inertiaRoundTripNms=math.inertia(body,inverseActionRadps);
      angularLoads.push({bodyId:body.id,torqueNms:[...torqueNms],beforeSpinRadps,
        afterSpinRadps,inverseActionRadps,inertiaRoundTripNms});
    }
  }
  sameBodyWords(input.freeBodies,before);
  const data={caseId:input.caseId,freeBodies:before,pairs:pairBefore,context:contextBefore,
    observation:{result,error:null},angularLoads};
  const line=JSON.stringify(packet(data))+'\n';
  receiptBytes+=Buffer.byteLength(line);
  assert.ok(receiptBytes<=budget.maxGraphBytes);
  writeSync(receiptFD,line);
  positives++;
});

test.after(()=>{
  closeSync(receiptFD);
  assert.equal(calls,budget.maxPrivateCalls);
  assert.equal(positives,budget.positiveCases);
  assert.equal(refusals,budget.refusals);
  assert.equal(hash(modulePath),moduleSHA);
  assert.equal(hash(mathPath),mathSHA);
});
