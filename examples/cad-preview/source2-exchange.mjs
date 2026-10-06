import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {parameterAnalytic} from '../../packages/barocss-cad/scripts/parameter-evidence.mjs';
const json=value=>JSON.stringify(value,null,2)+'\n',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function runSource2Exchange({index,evidence,head,cad,gpu,python}){
 const receipt=JSON.parse(await readFile(path.join(evidence,'source2-consumer.json'),'utf8'));assert.deepEqual(receipt,index.source2Lineage);assert(receipt.appDocumentUnchanged&&receipt.controls.failedDrawRetained&&receipt.controls.applicationSource2Rejected);assert(receipt.lifecycle.lossRejected&&receipt.lifecycle.readRejected&&receipt.lifecycle.disposedRejected);assert.equal(receipt.controls.before,receipt.controls.after);
 const names=['source2-line-100','source2-line-120','source2-curved-10','source2-curved-12'];assert.deepEqual(index.source2Frames.map(f=>f.name),names);
 const output=path.join(evidence,'source2-exchange');await mkdir(output,{recursive:true});const fixtures=[];
 for(const frame of index.source2Frames){assert.equal(frame.taskCommit,head);assert.equal(frame.integrationCommit,index.integrationCommit);assert(frame.actualReadPixels&&frame.glError===0&&frame.foreground>100);assert.equal(frame.sourceVersion,2);assert.equal(frame.irSchemaVersion,2);assert.equal(frame.nativeVersion,0);assert.equal(frame.packetVersion,0);assert.equal(frame.selectedId,'wall');
  for(const[file,digest]of Object.entries(frame.hashes)){assert.equal(path.basename(file),file);assert(file.startsWith(frame.name+'.'));assert.equal(hash(await readFile(path.join(evidence,file))),digest);}
  const bytes=await readFile(path.join(evidence,frame.name+'.rgba.bin'));assert.equal(hash(bytes),frame.readbackHash);assert.equal(bytes.length,512*384*4);
  const read=suffix=>readFile(path.join(evidence,frame.name+'.'+suffix)),readJSON=async suffix=>JSON.parse(await read(suffix));
  const source=(await read('source.css')).toString(),compiled=cad.compileCadModel(source,{sourceVersion:2});assert(compiled.ok,JSON.stringify(compiled.diagnostics));assert.equal(compiled.ir.schemaVersion,2);
  for(const key of ['ast','ir','model','constructions','diagnostics'])assert.deepEqual(JSON.parse(JSON.stringify(compiled[key])),await readJSON(key+'.json'));
  const native=compiled.model.objects.find(o=>o.id==='wall'),packet=await readJSON('packet.json'),preview=cad.tessellateSurface(native,{countU:17,countV:9,revision:packet.revision});assert.deepEqual(preview.packet,packet);assert.deepEqual(preview.report,await readJSON('report.json'));gpu.prepareMesh(packet,await readJSON('options.json'));
  const exported=cad.exportIGES(compiled.model,['wall']);assert.deepEqual(exported,await readJSON('iges.json'));assert.equal(exported.iges,(await read('selected.igs')).toString());
  const definition=frame.radius===undefined?{width:frame.width,height:frame.height}:{radius:frame.radius,height:frame.height};
  const r=definition.radius,curved=r!==undefined,literalSource=`@model oracle {version:1;length-unit:mm;@curve #profile {type:nurbs;degree:${curved?2:1};knots:${curved?'[0,0,0,1,1,1]':'[0,0,1,1]'};control-points:${JSON.stringify(curved?[[r,0,0],[r,r,0],[0,r,0]]:[[0,0,0],[definition.width,0,0]])};weights:${curved?'[1,0.7071067811865476,1]':'[1,1]'};}@extrude #wall {curve:#profile;vector:[0,0,${definition.height}];}}`;
  const literal=cad.compileCadModel(literalSource,{sourceVersion:1});assert(literal.ok);assert.deepEqual(compiled.model,literal.model);assert.deepEqual(exported,cad.exportIGES(literal.model,['wall']));
  const samples=[];for(let i=0;i<17;i++)for(let j=0;j<9;j++){const u=i/16,v=j/8,actual=cad.evaluateSurfaceD1(native,u,v),expected=parameterAnalytic(definition,u,v);for(const key of ['point','du','dv'])assert(Math.hypot(...actual[key].map((x,k)=>x-expected[key][k]))<=1e-9*(key==='point'?1:Math.max(1,Math.hypot(...expected[key]))));samples.push({u,v,...actual,analyticPoint:expected.point,analyticDu:expected.du,analyticDv:expected.dv});}
  // The reader loads copies of the actual browser's selected file and compiler
  // captures. No independent export producer substitutes for the browser bytes.
  const retained={source:await read('source.css'),ast:await read('ast.json'),ir:await read('ir.json'),model:await read('model.json'),packet:await read('packet.json'),previewReport:await read('report.json'),constructions:await read('constructions.json'),iges:await read('selected.igs'),native:json(native),samples:json(samples),literalSource,literalModel:json(literal.model)};
  const files={},hashes={};for(const[key,value]of Object.entries(retained)){const filename=frame.name+'.'+key;await writeFile(path.join(output,filename),value);files[key]=filename;hashes[key]=hash(value);}
  assert.equal(hashes.iges,frame.hashes[frame.name+'.selected.igs']);fixtures.push({name:frame.name,definition,sourceVersion:2,irSchemaVersion:2,geometryVersion:0,native,id:'wall',entity:128,domain:cad.surfaceDomain(native),samples,files,hashes,actualBrowserExportHash:hashes.iges,readbackHash:frame.readbackHash});
 }
 const manifest={base:process.env.BAROCSS_CAD_PREVIEW_BASE_SHA??head,head,integrationCommit:index.integrationCommit,producer:'Actual source2 compiler/browser native packet and selected IGES capture',fixtures,limits:{nativeMM:1e-9,readerMM:1e-7,derivative:'scaled by max(1, expected norm)'},sourceVersion:2,irSchemaVersion:2,nativeVersion:0};await writeFile(path.join(output,'manifest.json'),json(manifest));
 const reader=path.resolve(import.meta.dirname,'../../packages/barocss-cad/scripts/read-parameters-ocp.py'),controls={};
 for(const mode of ['', '--wrong-scale','--swap-partials','--changed-source-parameter']){const result=spawnSync(python,[reader,output,...(mode?[mode]:[])],{encoding:'utf8',maxBuffer:8*1024*1024});await writeFile(path.join(output,(mode?mode.slice(2):'positive')+'.txt'),(result.stdout??'')+'\n'+(result.stderr??''));assert.equal(result.status,mode?1:0,result.stderr);if(mode){assert.match(result.stderr,/Parameter derivative comparison failed/);controls[mode]={status:1,reachedActualDerivativeComparison:true};}}
 await writeFile(path.join(output,'controls.json'),json(controls));console.log('Actual source2 browser selected-file exchange passed: four frames/612 point-D1 samples; three derivative controls rejected.');
}
