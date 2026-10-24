import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Consume the driver's existing extracted archive; never perform a second pack. */
export async function verifyRectangleExtrusionConsumer({api,destination,temp,require,archive}) {
  assert.equal(typeof api.buildAxisRectangleExtrusion,'function');
  const request={bodyId:'packed_body',profile:{kind:'rectangle',id:'packed_profile',origin:[4,-3],width:7,height:5},distance:6};
  writeFileSync(join(temp,'rectangle-extrusion-runtime.mjs'),`import assert from 'node:assert/strict';
import {buildAxisRectangleExtrusion,compileCadModel,buildParametricFace,buildAxisBoxShell,validateAxisBoxShell,validateAxisBoxSolid,evaluateCurve,evaluateCurveD1,exportIGES} from '@barocss/cad';
const request=${JSON.stringify(request)};const result=buildAxisRectangleExtrusion(request);assert.equal(result.sourceVersion,2);assert.equal(result.model.version,0);assert.equal(result.model.objects.length,7);assert.equal(result.ir.schemaVersion,2);assert.equal(result.ir.parameters.length,5);assert.equal(result.profile.sourceVersion,0);assert.equal(result.profile.report.regionCertified,false);assert.equal(result.solidReport.volumeMM3,210);assert.equal(result.solidReport.areaMM2,214);assert.equal(validateAxisBoxShell(result.shell).solid,false);assert.equal(validateAxisBoxSolid(result.shell).solid,true);assert.equal(result.construction.outputBodyId,request.bodyId);assert.equal(result.construction.inputCurveId,request.profile.id);assert.deepEqual(result.construction.direction,[0,0,1]);assert.deepEqual(result.construction.footprintRanges.map(r=>r.sense),['forward','forward','reverse','reverse']);
const compiled=compileCadModel(result.source,{sourceVersion:2});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,result.model);assert.deepEqual(compiled.ir,result.ir);assert.notEqual(result.model.objects[0],result.profile.curve);
const edited=result.source.replace(/(@parameter\\s+#_rect_w\\s*\\{[^}]*value\\s*:\\s*)7\\s*mm\\s*;/,(_,prefix)=>prefix+'8mm;');assert.notEqual(edited,result.source);const newer=compileCadModel(edited,{sourceVersion:2});assert.equal(newer.ok,true);
const faces=newer.model.objects.slice(1).map((surface,i)=>{const t=result.faces[i].topology;return buildParametricFace(surface,{faceId:t.face.id,loopId:t.loop.id,vertexIds:t.vertices.map(v=>v.id),edgeIds:t.edges.map(e=>e.id),curveIds:t.edges.map(e=>e.curveId)});});const shell=buildAxisBoxShell([4,-3,0],[8,5,6],faces,{shellId:result.shell.id,faceIds:result.shell.faces.map(f=>f.id),vertexIds:result.shell.vertices.map(v=>v.id),edgeIds:result.shell.edges.map(e=>e.id)});const solid=validateAxisBoxSolid(shell);assert.equal(solid.volumeMM3,240);assert.equal(solid.areaMM2,236);assert.equal(result.solidReport.volumeMM3,210);
for(const knot of [1,2,3])assert.throws(()=>evaluateCurveD1(result.profile.curve,knot));assert.deepEqual(evaluateCurve(result.profile.curve,.5),[7.5,-3,0]);
assert.equal(exportIGES(result.model,[request.profile.id]).report.objects[0].entity,126);assert.deepEqual(exportIGES(result.model,result.model.objects.slice(1).map(s=>s.id)).report.objects.map(o=>o.entity),[128,128,128,128,128,128]);assert.throws(()=>buildAxisRectangleExtrusion({...request,distance:.5}));
`);
  execFileSync(process.execPath,[join(temp,'rectangle-extrusion-runtime.mjs')],{stdio:'inherit'});
  writeFileSync(join(temp,'rectangle-extrusion-types.ts'),`import {buildAxisRectangleExtrusion,compileCadModel,validateAxisBoxSolid} from '@barocss/cad';
import type {AxisRectangleExtrusionRequest,AxisRectangleExtrusionResult,AxisRectangleExtrusionConstruction,AxisBoxSolidValidationReport,XYProfileResult,CadModelIR,FaceBundle,AxisBoxShell} from '@barocss/cad';
const request:AxisRectangleExtrusionRequest={bodyId:'body',profile:{kind:'rectangle',id:'profile',origin:[4,-3],width:7,height:5},distance:6};const result:AxisRectangleExtrusionResult=buildAxisRectangleExtrusion(request);const construction:AxisRectangleExtrusionConstruction=result.construction;const operation:'axis-rectangle-extrude'=construction.operation;const sourceVersion:2=result.sourceVersion;const profile:XYProfileResult=result.profile;const solid:AxisBoxSolidValidationReport=result.solidReport;const ir:CadModelIR=result.ir;const faces:FaceBundle[]=result.faces;const shell:AxisBoxShell=result.shell;const distance:number=construction.distanceMM;const widthParameter:string=construction.parameterIds.width;const min:number=construction.footprintRanges[0].inputRange[0];void[operation,profile,solid,ir,faces,shell,distance,widthParameter,min,compileCadModel(result.source,{sourceVersion}),validateAxisBoxSolid(shell)];
// @ts-expect-error Only rectangle profiles are supported.
buildAxisRectangleExtrusion({bodyId:'body',profile:{kind:'circle',id:'profile',center:[0,0],radius:1},distance:1});
// @ts-expect-error Direction is fixed positive Z, not an input option.
buildAxisRectangleExtrusion({...request,direction:[0,0,-1]});
`);
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(temp,'rectangle-extrusion-types.ts')],{stdio:'inherit'});
  const result=api.buildAxisRectangleExtrusion(request),hash=value=>createHash('sha256').update(value).digest('hex');
  const record={producer:'Actual extracted public @barocss/cad ESM/types archive',archiveSHA256:hash(readFileSync(archive)),indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),sourceSHA256:hash(result.source),sourceBytes:Buffer.byteLength(result.source),sourceVersion:2,nativeVersion:0,solidReport:result.solidReport,construction:result.construction,selectedEntities:[126,128,128,128,128,128,128],wholeSolidInterchange:false};
  if(process.env.BAROCSS_CAD_RECTANGLE_EXTRUSION_EVIDENCE){const folder=resolve(process.env.BAROCSS_CAD_RECTANGLE_EXTRUSION_EVIDENCE);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');writeFileSync(join(folder,'packed-rectangle-extrusion.css'),result.source);writeFileSync(join(folder,'packed-rectangle-extrusion.json'),JSON.stringify(result,null,2)+'\n');}
  console.log('Packed rectangle extrusion ESM/types, actual source2, fresh edited solid and native adapters passed');return record;
}
