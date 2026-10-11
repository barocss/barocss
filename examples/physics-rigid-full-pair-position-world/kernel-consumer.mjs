import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rawBodies,sha,describeThrown} from './archive.mjs';
/** The first genuine new query is performed only by this frozen consumer. */
export async function runNineStart(m,reference,here,save){
 const recipeBytes=await readFile(here+'/start-input-recipe.json'),recipe=JSON.parse(recipeBytes),pre=structuredClone(recipe.preBodies);
 assert.equal(recipe.frameIndex.lengthBytes,936);assert.equal(sha(Buffer.from(recipe.preRawHex,'hex')),recipe.frameIndex.sha256);assert.ok(rawBodies(pre).equals(Buffer.from(recipe.preRawHex,'hex')));
 const a=pre.find(x=>x.id===recipe.ninthQuery.aId),b=pre.find(x=>x.id===recipe.ninthQuery.bId);assert.ok(a&&b);
 const fresh=m.inspectSignedBoxSAT(a,b),problem={bodies:pre.map(x=>({id:x.id,inverseMass:x.inverseMass})),rows:[...structuredClone(recipe.eightRows),{aId:a.id,bId:b.id,normal:[...fresh.normal],boundM:fresh.boundM}]};assert.equal(problem.rows.length,9);
 const before=structuredClone(problem);await save('nine-start-input',{problem,preRawHex:recipe.preRawHex,nativeFreshSelection:fresh});let result;try{result=m.solveFullPairPosition(problem);assert.deepEqual(problem,before);m.validateFullPairResult(problem,result);}catch(error){await save('nine-start-producer-failure',{problem,nativeFreshSelection:fresh,error:describeThrown(error)});throw error;}await save('nine-start-result',{problem,result,nativeFreshSelection:fresh});
 const reply=await reference.ask({op:'kernel',scope:'nine-start',problem,result});assert.equal(reply.resolved,true);assert.equal(reply.executionFailure,false);assert.ok(Array.isArray(reply.violations));
 const kernelGO=result.status==='SOLVED'&&reply.referenceStatus==='SOLVED'&&reply.ok===true&&reply.violations.length===0;
 return {id:'L03-authentic-nine-start',kernelGO,disposition:kernelGO?'DETACHED_NINE_ROW_GO':'NUMERICAL_NO_GO',inputRecipeSha256:sha(recipeBytes),preRawSha256:recipe.frameIndex.sha256,preRawHex:recipe.preRawHex,problem,result,nativeFreshSelection:fresh,reference:reply,worldCreated:false,worldStepped:false,notFullPairWorldGO:true};
}
