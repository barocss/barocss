import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {solvePosition,PositionReferenceError} from './linear-solver.mjs';
import {compareSolutions,geometryAgreement} from './compare.mjs';
import {validateDiagnosticFiles} from './input.mjs';
import {controls as parentControls} from '../physics-rigid-feature-penetration-diagnostic/controls.mjs';
import {ArchiveError} from '../physics-rigid-feature-penetration-diagnostic/archive.mjs';
import {here} from './bundle.mjs';
export async function controls(m,linear,geometry,input){
 const parent=await parentControls(m,geometry,input.archive,input.freeze,resolve(here,'../physics-rigid-feature-penetration-diagnostic'));
 const cases=JSON.parse(await readFile(resolve(here,'linear-controls.json'))),rows=[];
 for(const item of cases){
  const problem=structuredClone(item.problem),before=structuredClone(problem),reference=await linear.ask(problem);let candidate;
  if(item.expectedCode){assert.throws(()=>solvePosition(problem),e=>e instanceof PositionReferenceError&&e.code===item.expectedCode);assert.equal(reference.ok,false);assert.equal(reference.code,item.expectedCode);candidate={ok:false,status:item.expectedCode};}
  else{
   candidate=solvePosition(problem);assert.equal(candidate.status,item.expectedStatus);assert.equal(reference.status,item.expectedStatus);const compared=compareSolutions(candidate,reference);assert.equal(compared.agree,true,`${item.id} exact reference agreement`);
   if(item.expectedTranslations){for(let i=0;i<item.expectedTranslations.length;i++)for(let d=0;d<3;d++){assert.ok(Math.abs(candidate.translations[i].u[d]-item.expectedTranslations[i][d])<=1e-12,`${item.id} literal displacement`);assert.ok(Math.abs(reference.translations[i].u[d]-item.expectedTranslations[i][d])<=1e-12);}}
   if(item.expectedObjective!==undefined){assert.ok(Math.abs(candidate.objectiveKgM2-item.expectedObjective)<=1e-12);assert.ok(Math.abs(reference.objectiveKgM2-item.expectedObjective)<=1e-12);}
   if(item.requireSingularMask)assert.ok(candidate.singularMasks.length>0&&reference.singularMasks.length>0);
  }
  assert.deepEqual(problem,before,'linear inputs unchanged');rows.push({id:item.id,candidate,reference});
 }
 const copyProblem={bodies:[{id:'a',inverseMass:1},{id:'b',inverseMass:1}],rows:[{aId:'a',bId:'b',normal:[1,0,0],depthM:.002}]},saved=structuredClone(copyProblem),first=solvePosition(copyProblem),expected=structuredClone(first);first.translations[0].u[0]=999;first.gram[0][0]=999;first.lambdaKgM[0]=999;assert.deepEqual(copyProblem,saved);assert.deepEqual(solvePosition(copyProblem),expected,'detached outputs');
 const ref=await linear.ask(copyProblem),changed=structuredClone(expected);changed.translations[0].u[0]+=1e-6;assert.equal(compareSolutions(changed,ref).agree,false);const badCert=structuredClone(expected);badCert.certificate.primalViolationM=1e-6;assert.equal(compareSolutions(badCert,ref).agree,false);const nonrepresentable=structuredClone(ref);nonrepresentable.translations[0].u[0]=null;assert.equal(compareSolutions(expected,nonrepresentable).agree,false,'exact nonrepresentable output is not zero');assert.equal(geometryAgreement({ok:false,code:'REFERENCE_INPUT'}),false);
 const diagnosticRefusals=[];
 for(const [name,mutate,message]of [
  ['manifest',f=>f.set('manifest.json',Buffer.from('{}')),'diagnostic manifest hash mismatch'],
  ['artifact',f=>f.set('source-ALIGNED-report.json.gz',Buffer.from('bad')),'diagnostic file hash mismatch'],
  ['file-set',f=>f.set('extra',Buffer.from('bad')),'diagnostic file set mismatch']
 ]){const files=new Map(input.diagnosticFiles);mutate(files);assert.throws(()=>validateDiagnosticFiles(files),e=>e instanceof ArchiveError&&e.message===message);diagnosticRefusals.push(name);}
 const invalidNumber=structuredClone(copyProblem);invalidNumber.rows[0].normal[0]=NaN;assert.throws(()=>solvePosition(invalidNumber),e=>e.code==='INVALID_INPUT');
 return {parentQualifiedControls:parent,linearControls:rows,linearInputOutputCopy:true,negativeSolutionComparisonControls:3,referenceFailureFlagRetained:true,diagnosticRefusals,nonfiniteCandidateRefusal:true,worldCreated:false,worldStepped:false};
}
