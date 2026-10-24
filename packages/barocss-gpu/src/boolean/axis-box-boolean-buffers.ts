import { BarocssError } from '../core/barocss-error.js';
import {tessellateSurface,validateAxisBoxSolidBoolean} from '@barocss/cad';
import type {AxisBoxSolidBooleanResult,Surface} from '@barocss/cad';
import {freezeGpuData,ownRecord} from '../mesh/gpu-data.js';
import {snapshotNativeMesh,nativeMeshBufferOptions,nativeBufferBounds} from '../mesh/native-mesh-buffers.js';
import type {NativeBufferBounds} from '../mesh/native-mesh-buffers.js';
import {convertMeshCoordinate,validateMeshGeometry} from '../mesh/mesh-packet.js';
import type {Vec3} from '../scene/scene.js';

export type AxisBoxBooleanBufferDiagnosticCode='INPUT'|'BUDGET'|'NATIVE'|'BINDING'|'CONVERSION';
export class AxisBoxBooleanBufferError extends BarocssError {
 readonly code:AxisBoxBooleanBufferDiagnosticCode;
 constructor(code:AxisBoxBooleanBufferDiagnosticCode,detail:string,cause?:unknown){
  super(code, ('Axis-box Boolean buffers: '+detail).slice(0,1024),cause===undefined?undefined:{cause});
  this.name='AxisBoxBooleanBufferError';this.code=code;
 }
}
export interface AxisBoxBooleanBufferOptions {
 basis:'authored-xyz-matches-rhyup';mmToSceneUnit:number;translate:Vec3;
}
export interface AxisBoxBooleanPanelRange {
 panelId:string;bodyId:string;shellId:string;sourceId:string;modelId:string;surfaceId:string;faceId:string;
 vertexOffset:number;indexOffset:number;vertexCount:4;indexCount:6;
 nativeVertexIdsInBufferOrder:readonly string[];
 lineage:AxisBoxSolidBooleanResult['panels'][number]['lineage'];
}
/** CPU data only. This is not an original Surface or an existing renderer input. */
export interface PreparedAxisBoxBooleanBuffers {
 schema:'barocss-gpu-axis-box-boolean-buffers';version:0;profile:'native-integer-axis-box-boolean-panels-v0';
 coordinateSystem:'right-handed-y-up';native:AxisBoxSolidBooleanResult;options:AxisBoxBooleanBufferOptions;
 positions:Float32Array;normals:Float32Array;indices:Uint16Array;
 panels:readonly AxisBoxBooleanPanelRange[];bounds:NativeBufferBounds;
 report:{nativeValidationCalls:1;tessellateSurfaceCalls:number;sourceCompilationCalls:0;
  vertexCount:number;triangleCount:number;geometryBytes:number;sourceBytes:number;
  maximumPanels:72;maximumGeometryBytes:7776};
}
function check(value:unknown,code:AxisBoxBooleanBufferDiagnosticCode,detail:string):asserts value {
 if(!value)throw new AxisBoxBooleanBufferError(code,detail);
}
function child<T>(code:AxisBoxBooleanBufferDiagnosticCode,detail:string,action:()=>T):T {
 try{return action();}catch(cause){throw new AxisBoxBooleanBufferError(code,detail,cause);}
}
function same(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=Object.keys(a),right=Object.keys(b);
 return left.length===right.length&&left.every(key=>Object.hasOwn(b,key)&&same((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
}
function options(input:unknown):AxisBoxBooleanBufferOptions {
 const data=child('INPUT','Exact own options required',()=>ownRecord(snapshotNativeMesh(input),['basis','mmToSceneUnit','translate']));
 check(data.basis==='authored-xyz-matches-rhyup','INPUT','Explicit authored XYZ and renderer Y-up agreement required');
 const settings=child('INPUT','Invalid scale or scene translation',()=>nativeMeshBufferOptions({mmToSceneUnit:data.mmToSceneUnit,translate:data.translate}));
 return freezeGpuData({basis:'authored-xyz-matches-rhyup',mmToSceneUnit:settings.mmToSceneUnit,translate:[...settings.translate] as Vec3});
}

/** Whole native reconstruction precedes bounded derived panel staging. No Boolean kernel is duplicated. */
export function prepareAxisBoxBooleanBuffers(input:unknown,optionsInput:AxisBoxBooleanBufferOptions):PreparedAxisBoxBooleanBuffers {
 const settings=options(optionsInput);
 const native=child('INPUT','Native own-data envelope refused',()=>snapshotNativeMesh(input)) as AxisBoxSolidBooleanResult;
 child('NATIVE','Complete native integer-box Boolean validation refused',()=>validateAxisBoxSolidBoolean(native));
 check(native.report.schema==='barocss-axis-box-solid-boolean'&&native.report.version===0&&native.report.lengthUnit==='mm'&&
  native.report.geometryFamily==='exact-integer-orthogonal-cell-solid-v0','BINDING','Unsupported validated native family');
 const count=native.panels.length;
 check(count<=72&&native.sources.length===count,'BUDGET','Complete output exceeds72 panel/source slots');
 check(native.report.panelCount===count&&native.report.sourceCount===count,'BINDING','Native panel/source counts differ');
 const encoder=new TextEncoder();let sourceBytes=0;
 for(const source of [native.a.source,native.b.source])sourceBytes+=encoder.encode(source).length;
 for(const source of native.sources){
  const bytes=encoder.encode(source.source).length;
  check(bytes<=65536,'BUDGET','Generated panel source exceeds65536 UTF8 bytes');sourceBytes+=bytes;
 }
 check(sourceBytes<=4194304,'BUDGET','Original and generated sources exceed4MiB UTF8');
 const sourceMap=new Map(native.sources.map(source=>[source.sourceId,source]));
 const vertices=new Map(native.vertices.map(vertex=>[vertex.id,vertex.pointMM]));
 const bodies=new Map(native.bodies.map(body=>[body.id,body]));
 const memberships=new Map<string,AxisBoxSolidBooleanResult['shells'][number]>();
 for(const shell of native.shells)for(const panelId of shell.panelIds){
  check(!memberships.has(panelId),'BINDING','Panel belongs to multiple native shells');memberships.set(panelId,shell);
 }
 const converted:number[]=[],normals:number[]=[],indices:number[]=[],ranges:AxisBoxBooleanPanelRange[]=[];
 let tessellateSurfaceCalls=0;
 for(const [panelIndex,panel] of native.panels.entries()){
  const source=sourceMap.get(panel.sourceId),shell=memberships.get(panel.id),body=bodies.get(panel.bodyId);
  check(source&&source.panelId===panel.id&&source.sourceVersion===0,'BINDING','Generated source does not bind its panel');
  check(shell&&shell.bodyId===panel.bodyId&&body&&body.shellIds.includes(shell.id),'BINDING','Panel/body/shell association differs');
  const face=panel.bundle.topology.face,model=source.model;
  check(same(model,panel.bundle.geometry)&&model.version===0&&model.lengthUnit==='mm'&&model.objects.length===5&&
   model.objects.filter(object=>object.kind==='surface').length===1&&model.objects.filter(object=>object.kind==='curve').length===4,
   'BINDING','Complete generated panel Model0 must match its Surface and four Curves');
  const surface=model.objects.find((object):object is Surface=>object.kind==='surface'&&object.id===face.surfaceId);
  check(surface&&face.id===panel.id&&face.orientation==='forward'&&surface.degreeU===1&&surface.degreeV===1,
   'BINDING','Panel requires its actual forward degree1 native Surface');
  const packet=child('CONVERSION','Actual native panel tessellation refused',()=>tessellateSurface(surface,{countU:2,countV:2,revision:0}).packet);
  tessellateSurfaceCalls++;
  check(packet.positions.length===12&&packet.normals.length===12&&same(packet.parameters,[0,0,0,1,1,0,1,1])&&
   same(packet.indices,[0,2,1,2,3,1]),'BINDING','Native2×2 tessellation layout differs');
  const vertexIds=[panel.vertexIds[0],panel.vertexIds[3],panel.vertexIds[1],panel.vertexIds[2]];
  for(let vertex=0;vertex<4;vertex++){
   const expected=vertices.get(vertexIds[vertex]);
   check(expected&&expected.every((value,axis)=>Object.is(value,packet.positions[vertex*3+axis])),
    'BINDING','Sampled panel corner does not bind its exact native vertex');
   for(let axis=0;axis<3;axis++){
    const index=vertex*3+axis;
    check(packet.normals[index]===(axis===panel.axis?panel.sign:0),'BINDING','Panel normal does not point toward its empty neighbor');
    converted.push(child('CONVERSION','Unsafe panel display coordinate',()=>convertMeshCoordinate(packet.positions[index],settings.mmToSceneUnit,settings.translate[axis],
     'Axis-box Boolean positions must be finite and within1000 scene units')));
    normals.push(packet.normals[index]);
   }
  }
  indices.push(...packet.indices.map(index=>index+panelIndex*4));
  ranges.push({panelId:panel.id,bodyId:panel.bodyId,shellId:shell.id,sourceId:source.sourceId,modelId:model.name,surfaceId:surface.id,faceId:face.id,
   vertexOffset:panelIndex*4,indexOffset:panelIndex*6,vertexCount:4,indexCount:6,nativeVertexIdsInBufferOrder:vertexIds,lineage:panel.lineage});
 }
 check(converted.length===count*12&&normals.length===count*12&&indices.length===count*6,'BINDING','Complete panel coverage differs');
 child('CONVERSION','Converted panel geometry refused',()=>validateMeshGeometry(converted,normals,indices,'Axis-box Boolean Number display'));
 const positions=Float32Array.from(converted),normalBuffers=Float32Array.from(normals),indexBuffers=Uint16Array.from(indices);
 child('CONVERSION','Float32 panel geometry refused',()=>validateMeshGeometry(positions,normalBuffers,indexBuffers,'Axis-box Boolean Float32 display'));
 const geometryBytes=positions.byteLength+normalBuffers.byteLength+indexBuffers.byteLength;
 check(geometryBytes===count*108&&geometryBytes<=7776,'BUDGET','Derived geometry byte budget exceeded');
 return Object.freeze({schema:'barocss-gpu-axis-box-boolean-buffers',version:0,profile:'native-integer-axis-box-boolean-panels-v0',coordinateSystem:'right-handed-y-up',
  native:freezeGpuData(native),options:settings,positions,normals:normalBuffers,indices:indexBuffers,panels:freezeGpuData(ranges),bounds:nativeBufferBounds(positions),
  report:Object.freeze({nativeValidationCalls:1,tessellateSurfaceCalls,sourceCompilationCalls:0,vertexCount:count*4,triangleCount:count*2,geometryBytes,sourceBytes,
   maximumPanels:72,maximumGeometryBytes:7776})});
}
