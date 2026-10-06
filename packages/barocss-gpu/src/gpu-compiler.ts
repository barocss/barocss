import {SceneError} from './scene-types.js';
import type {Scene} from './scene-types.js';
import {parseSceneAst,analyzeSceneAst,freezeScene} from './scene-front.js';
import type {SceneAst,SourceRange} from './scene-front.js';
import {lowerSceneShaders} from './compiler.js';
import type {SceneShaders} from './compiler.js';
import {validatePreviewPacket,validateMeshOptions,lowerMesh} from './mesh-packet.js';
import type {PreviewPacket,MeshOptions} from './mesh-packet.js';
import {ownRecord,copyGpuData,freezeGpuData} from './gpu-data.js';
export type GpuCompileInput={kind:'scene';source:string}|{kind:'mesh';packet:PreviewPacket;options:MeshOptions};
export interface GpuDiagnostic {code:string;severity:'error';message:string;range:SourceRange|null;objectId?:string;dataPath?:string}
interface IRCommon {schema:'barocss-gpu-render-ir';schemaVersion:1;name:string;coordinateSystem:'right-handed-y-up';background:[number,number,number]}
export type GpuRenderIR=(IRCommon&{pipeline:'sdf';draws:{kind:'sphere'|'box';id:string;color:[number,number,number];translate:[number,number,number];radius:number;size:[number,number,number]}[]})|(IRCommon&{pipeline:'indexed-mesh';draws:[{kind:'indexed-mesh';id:string;packet:PreviewPacket;options:MeshOptions}]});
export type GpuExecution={kind:'sdf';scene:Scene;shaders:SceneShaders}|{kind:'indexed-mesh';mesh:ReturnType<typeof lowerMesh>};
export type GpuCompileResult={ok:true;ast:SceneAst|null;ir:GpuRenderIR;execution:GpuExecution;diagnostics:[]}|{ok:false;diagnostics:GpuDiagnostic[]};
function code(message:string):string{if(/exceeds|limit|64 KiB/.test(message))return'LIMIT';if(/Duplicate/.test(message))return'DUPLICATE';if(/Unknown object/.test(message))return'REFERENCE';if(/version/.test(message))return'VERSION';if(/Expected|Unterminated|close/.test(message))return'SYNTAX';return'VALIDATION';}
function lowerGpuIR(ir:GpuRenderIR):GpuExecution{
 if(ir.pipeline==='sdf'){
  const scene=freezeScene({version:0,name:ir.name,background:copyGpuData(ir.background),objects:ir.draws.map(d=>({id:d.id,type:d.kind,color:copyGpuData(d.color),translate:copyGpuData(d.translate),radius:d.radius,size:copyGpuData(d.size)}))});
  return{kind:'sdf',scene,shaders:lowerSceneShaders(scene)};
 }
 const draw=ir.draws[0];return{kind:'indexed-mesh',mesh:lowerMesh(freezeGpuData(copyGpuData(draw.packet)),freezeGpuData(copyGpuData(draw.options)))};
}
/** Independent original scene compiler and packet adapter; never calls WebGL. */
export function compileGpu(input:GpuCompileInput):GpuCompileResult{
 let mesh=false,stage='input';
 try{
  if(input&&typeof input==='object'){const d=Object.getOwnPropertyDescriptor(input,'kind');mesh=!!d&&'value'in d&&d.value==='mesh';}
  const tag=ownRecord(input,['kind','source','packet','options'],['kind']);mesh=tag.kind==='mesh';
  if(tag.kind==='scene'){
   const record=ownRecord(input,['kind','source']);stage='source';
   const ast=parseSceneAst(record.source as string),scene=analyzeSceneAst(ast);
   const ir:GpuRenderIR=freezeGpuData({schema:'barocss-gpu-render-ir',schemaVersion:1,pipeline:'sdf',name:scene.name,coordinateSystem:'right-handed-y-up',background:copyGpuData(scene.background),draws:scene.objects.map(o=>({kind:o.type,id:o.id,color:copyGpuData(o.color),translate:copyGpuData(o.translate),radius:o.radius,size:copyGpuData(o.size)}))});
   stage='lowering';const execution=lowerGpuIR(ir);
   return{ok:true,ast:copyGpuData(ast),ir,execution,diagnostics:[]};
  }
  if(tag.kind==='mesh'){
   const record=ownRecord(input,['kind','packet','options']);stage='packet';const packet=validatePreviewPacket(record.packet);stage='options';const options=validateMeshOptions(record.options);const intent={packet,options};
   const ir:GpuRenderIR=freezeGpuData({schema:'barocss-gpu-render-ir',schemaVersion:1,pipeline:'indexed-mesh',name:intent.packet.surfaceId,coordinateSystem:'right-handed-y-up',background:copyGpuData(intent.options.background),draws:[{kind:'indexed-mesh',id:intent.packet.surfaceId,packet:copyGpuData(intent.packet),options:copyGpuData(intent.options)}]});
   stage='lowering';const execution=lowerGpuIR(ir);
   return{ok:true,ast:null,ir,execution,diagnostics:[]};
  }
  throw new Error('Only scene or mesh compiler input is supported');
 }catch(error){const message=error instanceof Error?error.message:'Invalid compiler input';const diagnostic:GpuDiagnostic={code:stage==='lowering'?'LOWERING':code(message),severity:'error',message,range:mesh?null:{start:0,end:0,line:1,column:1}};
  if(error instanceof SceneError){const first=error.diagnostics[0];diagnostic.message=first.message;diagnostic.code=code(first.message);diagnostic.range={start:first.start,end:first.end,line:first.line,column:first.column};const id=/object ID '([^']+)'/.exec(first.message);if(id)diagnostic.objectId=id[1];}
  if(mesh)diagnostic.dataPath=stage==='lowering'?'execution.mesh':stage;return{ok:false,diagnostics:[diagnostic]};
 }
}
export function requireSceneExecution(source:string):Extract<GpuExecution,{kind:'sdf'}>{const result=compileGpu({kind:'scene',source});if(!result.ok){const d=result.diagnostics[0];if(d.range&&d.code!=='LOWERING')throw new SceneError([{message:d.message,...d.range}]);throw new Error(d.message);}if(result.execution.kind!=='sdf')throw new Error('Unexpected GPU pipeline');return result.execution;}
export function requireMeshExecution(packet:unknown,options:unknown):ReturnType<typeof lowerMesh>{const result=compileGpu({kind:'mesh',packet:packet as PreviewPacket,options:options as MeshOptions});if(!result.ok)throw new RangeError(result.diagnostics[0].message);if(result.execution.kind!=='indexed-mesh')throw new Error('Unexpected GPU pipeline');return result.execution.mesh;}
