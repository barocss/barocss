import assert from 'node:assert/strict';import path from 'node:path';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
import {prepareBoxPreview,validateBoxPreview}from'./box-preview.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
export async function runBoxExchange({index,evidence,head,cad,gpu,python}){
 const names=['box-unit','box-noncubic','box-translated','box-boundary','box-dimension-update'];assert.deepEqual(index.boxFrames.map(f=>f.name),names);const receipt=JSON.parse(await readFile(path.join(evidence,'box-consumer.json'),'utf8'));assert.deepEqual(receipt,index.boxLineage);assert(receipt.appDocumentUnchanged&&receipt.controls.retainedPixels&&receipt.lifecycle.lossRejected);
 const output=path.join(evidence,'box-exchange');await mkdir(output,{recursive:true});const boxes=[];
 for(const frame of index.boxFrames){assert.equal(frame.taskCommit,head);assert.equal(frame.integrationCommit,index.integrationCommit);assert(frame.actualReadPixels&&frame.glError===0&&frame.foreground>100);for(const[file,digest]of Object.entries(frame.hashes)){assert.equal(path.basename(file),file);assert(file.startsWith(frame.name+'.'));assert.equal(hash(await readFile(path.join(evidence,file))),digest);}
  const read=async suffix=>JSON.parse(await readFile(path.join(evidence,frame.name+'.'+suffix),'utf8'));
  const result={source:await readFile(path.join(evidence,frame.name+'.source.css'),'utf8'),sourceVersion:0,model:await read('model.json'),shell:await read('shell.json'),solidReport:await read('solid.json'),facePackets:await read('faces.json'),packet:await read('packet.json'),lineage:await read('lineage.json')},request=await read('request.json');assert.deepEqual(request,frame.request);validateBoxPreview(result,cad);assert.deepEqual(result,prepareBoxPreview(request,cad));gpu.prepareMesh(result.packet,await read('options.json'));assert.equal(result.packet.surfaceId,frame.derivedMeshId);assert.deepEqual(result.model.objects.map(o=>o.id),frame.nativeSurfaceIds);
  assert.equal(hash(await readFile(path.join(evidence,frame.name+'.rgba.bin'))),frame.readbackHash);
  const faces=[];
  for(const[i,surface]of result.model.objects.entries()){
   const exported=cad.exportIGES(result.model,[surface.id]);assert.equal(exported.report.objects.length,1);assert.equal(exported.report.objects[0].id,surface.id);assert.equal(exported.report.objects[0].entity,128);
   const prefix=frame.name+'-'+surface.id,igesFile=prefix+'.iges',nativeFile=prefix+'.native.json';await writeFile(path.join(output,igesFile),exported.iges);await writeFile(path.join(output,nativeFile),json(surface));
   const samples=[];for(let u=0;u<=16;u++)for(let v=0;v<=8;v++)samples.push({u:u/16,v:v/8,point:cad.evaluateSurface(surface,u/16,v/8)});
   const range=result.lineage.faces[i];assert.equal(range.surfaceId,surface.id);faces.push({nativeId:surface.id,wrapperId:range.faceId,faceIndex:i,range,igesFile,nativeFile,igesHash:hash(exported.iges),nativeHash:hash(json(surface)),samples,packet:result.facePackets[i].packet});
  }
  boxes.push({name:frame.name,request,solidReport:result.solidReport,lineage:result.lineage,packet:result.packet,faces});
 }
 const manifest={head,producer:'Actual retained native six-surface Model selected face exports; separate consumer evidence, not whole-solid UI IGES',boxes};await writeFile(path.join(output,'manifest.json'),json(manifest));
 const reader=path.join(import.meta.dirname,'read-box-preview-ocp.py'),run=mode=>spawnSync(python,[reader,output,...(mode?[mode]:[])],{encoding:'utf8'});const accepted=run();await writeFile(path.join(output,'reader.stdout.txt'),accepted.stdout??'');await writeFile(path.join(output,'reader.stderr.txt'),accepted.stderr??'');assert.equal(accepted.status,0,accepted.stderr+'\n'+accepted.stdout);
 const wrong=run('--wrong-face');await writeFile(path.join(output,'wrong-face.txt'),(wrong.stdout??'')+'\n'+(wrong.stderr??''));assert.notEqual(wrong.status,0);assert(wrong.stdout.includes('REACHED_GEOMETRY'));
 const originals=await readFile(path.join(output,boxes[0].faces[0].igesFile),'utf8');const lines=originals.trimEnd().split('\n'),p=lines.findIndex(s=>s[72]==='P');assert(p>=0);const tokens=lines[p].slice(0,64).split(',');tokens[0]='129';lines[p]=tokens.join(',').padEnd(64)+lines[p].slice(64);await writeFile(path.join(output,'corrupt.iges'),lines.join('\n')+'\n');const corrupt=run('--corrupt');await writeFile(path.join(output,'corrupt.txt'),(corrupt.stdout??'')+'\n'+(corrupt.stderr??''));assert.notEqual(corrupt.status,0);
 await writeFile(path.join(output,'controls.json'),json({wrongFaceStatus:wrong.status,wrongFaceReachedReadableGeometry:true,corruptStatus:corrupt.status,existingLimitsUnchanged:true}));console.log('Native box preview exchange passed: 5boxes/30 original selected face files/4590 mapped reader samples; wrong-face and corrupt controls rejected.');
}
