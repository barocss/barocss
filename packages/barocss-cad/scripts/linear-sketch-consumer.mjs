import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

/** Reuse the driver's actual extracted public archive; no second pack. */
export async function verifyLinearSketchConsumer({api,destination,temp,require}){
  assert.equal(typeof api.solveXYLinearSketch,'function');
  const document={format:'barocss-xy-linear-sketch',version:0,id:'packed_sketch',lengthUnit:'mm',points:[{id:'A',position:[0,1]},{id:'B',position:[4,3]}],segments:[{id:'line',startPointId:'A',endPointId:'B'}],constraints:[{id:'h',kind:'horizontal',segmentId:'line'}]};
  writeFileSync(join(temp,'linear-sketch-runtime.mjs'),`import assert from 'node:assert/strict';import {solveXYLinearSketch as solve,compileCadModel,evaluateCurveD1,exportIGES} from '@barocss/cad';
const document=${JSON.stringify(document)},free=solve(document);assert.equal(free.ok,true);assert.deepEqual(free.solution.points,[{id:'A',position:[0,2]},{id:'B',position:[4,2]}]);assert.deepEqual(free.report,{degreesOfFreedom:3,rank:1,fullyConstrained:false,redundantConstraintIds:[]});assert.equal(free.solution.sourceVersion,0);assert.equal(free.solution.model.version,0);assert.equal(free.solution.ir.schemaVersion,1);const compiled=compileCadModel(free.solution.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,free.solution.model);assert.deepEqual(evaluateCurveD1(free.solution.model.objects[0],.5).derivative,[4,0,0]);
const fixed=structuredClone(document);fixed.constraints.push({id:'fa',kind:'fixed',pointId:'A',target:[0,5]},{id:'fb',kind:'fixed',pointId:'B',target:[4,5]},{id:'fb_repeat',kind:'fixed',pointId:'B',target:[4,5]});const result=solve(fixed);assert.equal(result.ok,true);assert.deepEqual(result.report,{degreesOfFreedom:0,rank:4,fullyConstrained:true,redundantConstraintIds:['fb_repeat']});
const contradictory=structuredClone(fixed);contradictory.constraints.push({id:'bad',kind:'fixed',pointId:'A',target:[Number.EPSILON,5]});const conflict=solve(contradictory);assert.equal(conflict.ok,false);assert.equal(conflict.diagnostics[0].code,'CONFLICT');assert.ok(conflict.diagnostics[0].constraintIds.includes('fa'));assert.ok(conflict.diagnostics[0].constraintIds.includes('bad'));assert.equal(conflict.solution,undefined);assert.deepEqual(solve(document),free);
const collapsed=structuredClone(document);collapsed.constraints.push({id:'same',kind:'coincident',pointA:'A',pointB:'B'});assert.equal(solve(collapsed).diagnostics[0].code,'DEGENERATE_GEOMETRY');assert.equal(exportIGES(free.solution.model,['line']).report.objects[0].entity,126);
const signed=structuredClone(document);signed.constraints=[];signed.points[0].position=[-0,-0];assert.ok(Object.is(solve(signed).solution.points[0].position[0],-0));
`);execFileSync(process.execPath,[join(temp,'linear-sketch-runtime.mjs')],{stdio:'inherit'});
  writeFileSync(join(temp,'linear-sketch-types.ts'),`import {solveXYLinearSketch} from '@barocss/cad';import type {XYLinearSketchDocumentV0,XYLinearSketchResult} from '@barocss/cad';
const document:XYLinearSketchDocumentV0=${JSON.stringify(document)};const result:XYLinearSketchResult=solveXYLinearSketch(document);if(result.ok){const sourceVersion:0=result.solution.sourceVersion;const rank:number=result.report.rank;const dof:number=result.report.degreesOfFreedom;const pointId:string=result.solution.points[0].id;const seed:XYLinearSketchDocumentV0=result.document;void[sourceVersion,rank,dof,pointId,seed];}else{const code:string=result.diagnostics[0].code;const path:string=result.diagnostics[0].path;const constraints:string[]=result.diagnostics[0].constraintIds;void[code,path,constraints];}
// @ts-expect-error Angular constraints are outside this equality subset.
solveXYLinearSketch({...document,constraints:[{id:'angle',kind:'angle',segmentId:'line',value:90}]});
// @ts-expect-error Native sketch document versions are explicit.
solveXYLinearSketch({...document,version:2});
`);execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(temp,'linear-sketch-types.ts')],{stdio:'inherit'});
  const result=api.solveXYLinearSketch(document);assert.equal(result.ok,true);const hash=x=>createHash('sha256').update(x).digest('hex');const record={producer:'Actual extracted public @barocss/cad ESM/types archive',archiveSHA256:hash(readFileSync(join(temp,'barocss-cad-0.0.0-private-experimental.tgz'))),indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),sourceSHA256:hash(result.solution.source),report:result.report,sourceVersion:0,nativeVersion:0,selectedEntity:126};
  if(process.env.BAROCSS_CAD_LINEAR_SKETCH_EVIDENCE){const folder=resolve(process.env.BAROCSS_CAD_LINEAR_SKETCH_EVIDENCE);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');writeFileSync(join(folder,'packed-sketch-result.json'),JSON.stringify(result,null,2)+'\n');writeFileSync(join(folder,'packed-sketch.css'),result.solution.source);}
  console.log('Packed XY linear sketch ESM/types, exact rank/DOF cases, conflict and original line source passed');return record;
}
