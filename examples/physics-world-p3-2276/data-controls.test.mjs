// DATA-only controls. No fresh World, projection, numerical derivation or atan call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authenticateOriginalBank,iterateOriginalRows} from './bank-auth.mjs';
import {qualifyReply} from '../physics-rigid-hinge-velocity-world-reference/reference-reply.mjs';
import {firstBitsDifference} from './compare.mjs';
import {instrumentP3Source} from './observe.mjs';
const samples=[];const bank=await authenticateOriginalBank();
for await(const row of iterateOriginalRows(bank))if([1,76,77,197,1200].includes(row.stepIndex))samples.push(row);
assert.equal(bank.provenance.fullDecodedAuthentication,'PASS');
test('selected five authenticated old certificates pass the original DATA gate reader',()=>{
 assert.equal(samples.length,5);for(const row of samples)assert.equal(qualifyReply(row.reply,row.request).qualified,true);
});
test('original DATA gates reject altered numerical flags and incomplete certificates',()=>{
 const row=samples[0];const bad=structuredClone(row.reply);bad.metrics.checks.sourceRawMatchesInput=false;assert.equal(qualifyReply(bad,row.request).qualified,false);
 const missing=structuredClone(row.reply);missing.reference.pairReplies[0].ok=false;assert.equal(qualifyReply(missing,row.request).qualified,false);
 const nan=structuredClone(row.reply);nan.metrics.reportErrors[0].angleRad=NaN;assert.throws(()=>qualifyReply(nan,row.request));
});
test('exact comparator retains signed zero, historical one-ULP difference and structural IDs',()=>{
 assert.ok(firstBitsDifference(-0,0));const difference=firstBitsDifference(.3020821295571869,.30208212955718694);
 assert.equal(difference.expectedBits,'a3ddc9485055d33f');assert.equal(difference.actualBits,'a4ddc9485055d33f');
 assert.ok(firstBitsDifference({id:'a'},{id:'b'}));assert.equal(firstBitsDifference({b:[-0,1],a:2},{a:2,b:[-0,1]}),null);
});
test('TESTONLY observers transform exactly frozen anchors and fail closed on missing anchors',()=>{
 for(const [name,path] of [['world.ts','candidate/src/world.ts'],['disjoint-hinge/stage.ts','candidate/src/disjoint-hinge/stage.ts'],['disjoint-hinge/measure.ts','../../packages/barocss-physics/src/disjoint-hinge/measure.ts'],['disjoint-hinge/postcontact.ts','../../packages/barocss-physics/src/disjoint-hinge/postcontact.ts']]){
  const source=readFileSync(new URL(path,import.meta.url),'utf8'),result=instrumentP3Source(name,source);assert.equal(result.changed,true);assert.notEqual(result.originalSha256,result.effectiveSha256);
 }
 assert.throws(()=>instrumentP3Source('world.ts','export const missing = true;'));
});
console.log(JSON.stringify({scope:'DATA_CONTROLS_ONLY',newWorldCalls:0,newProjectionCalls:0,newIndependentDerivationCalls:0,authenticatedRows:1200}));
