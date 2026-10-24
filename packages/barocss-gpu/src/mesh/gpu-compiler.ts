import {refusalText} from '../core/barocss-error.js';
import {SceneError} from '../scene/scene-types.js';
import type {AnyScene,SceneObject,SceneObject1,SceneSourceOptions,Vec3} from '../scene/scene-types.js';
import {parseSceneAst,analyzeSceneAst,freezeScene} from '../scene/scene-front.js';
import type {SceneAst,SourceRange} from '../scene/scene-front.js';
import {lowerSceneShaders} from './compiler.js';
import type {SceneShaders} from './compiler.js';
import {validatePreviewPacket,validateMeshOptions,lowerMesh} from './mesh-packet.js';
import type {PreviewPacket,MeshOptions} from './mesh-packet.js';
import {ownRecord,copyGpuData,freezeGpuData} from './gpu-data.js';
export type GpuCompileInput={kind:'scene';source:string;sourceVersion?:1}|{kind:'mesh';packet:PreviewPacket;options:MeshOptions};
export interface GpuDiagnostic {code:string;severity:'error';message:string;range:SourceRange|null;objectId?:string;dataPath?:string}
interface IRCommon {schema:'barocss-gpu-render-ir';name:string;background:[number,number,number]}
interface SDFDraw {kind:'sphere'|'box';id:string;color:[number,number,number];translate:Vec3;radius:number;size:Vec3}
export type GpuRenderIR=(IRCommon&{schemaVersion:1;pipeline:'sdf';coordinateSystem:'right-handed-y-up';draws:SDFDraw[]})
 |(IRCommon&{schemaVersion:2;pipeline:'sdf';coordinateSystem:'right-handed-y-up';rotationOrder:'X-Y-Z';angleUnit:'deg';draws:((SDFDraw&{rotateDegrees:Vec3})|(Omit<SDFDraw,'kind'>&{kind:'cylinder';height:number;rotateDegrees:Vec3})|(Omit<SDFDraw,'kind'>&{kind:'capsule';start:Vec3;end:Vec3;rotateDegrees:Vec3})|(Omit<SDFDraw,'kind'>&{kind:'rounded-box';rotateDegrees:Vec3})|(Omit<SDFDraw,'kind'>&{kind:'torus';majorRadius:number;minorRadius:number;rotateDegrees:Vec3}))[]})
 |(IRCommon&{schemaVersion:1;pipeline:'indexed-mesh';coordinateSystem:'right-handed-z-up';draws:[{kind:'indexed-mesh';id:string;packet:PreviewPacket;options:MeshOptions}]});
export type GpuExecution={kind:'sdf';scene:AnyScene;shaders:SceneShaders}|{kind:'indexed-mesh';mesh:ReturnType<typeof lowerMesh>};
export type GpuCompileResult={ok:true;ast:SceneAst|null;ir:GpuRenderIR;execution:GpuExecution;diagnostics:[]}|{ok:false;diagnostics:GpuDiagnostic[]};
function code(message:string):string{if(/exceeds|limit|64 KiB/.test(message))return'LIMIT';if(/Duplicate/.test(message))return'DUPLICATE';if(/Unknown object/.test(message))return'REFERENCE';if(/version/.test(message))return'VERSION';if(/Expected|Unterminated|close/.test(message))return'SYNTAX';return'VALIDATION';}
function lowerGpuIR(ir:GpuRenderIR):GpuExecution{
 if(ir.pipeline==='sdf'){
  const objects=ir.draws.map(d=>({id:d.id,type:d.kind,color:copyGpuData(d.color),translate:copyGpuData(d.translate),radius:d.radius,size:copyGpuData(d.size),...('rotateDegrees'in d?{rotateDegrees:copyGpuData(d.rotateDegrees)}:{}),...('majorRadius'in d?{majorRadius:d.majorRadius,minorRadius:d.minorRadius}:{}),...('height'in d?{height:d.height}:{}),...('start'in d?{start:copyGpuData(d.start),end:copyGpuData(d.end)}:{})}));
  const scene=ir.schemaVersion===2?freezeScene({version:1,name:ir.name,background:copyGpuData(ir.background),objects:objects as SceneObject1[]}):freezeScene({version:0,name:ir.name,background:copyGpuData(ir.background),objects:objects as SceneObject[]});
  return{kind:'sdf',scene,shaders:lowerSceneShaders(scene)};
 }
 const draw=ir.draws[0];return{kind:'indexed-mesh',mesh:lowerMesh(freezeGpuData(copyGpuData(draw.packet)),freezeGpuData(copyGpuData(draw.options)))};
}
/** Independent original scene compiler and packet adapter; never calls WebGL. */
export function compileGpu(input:GpuCompileInput):GpuCompileResult{
 let mesh=false,stage='input';
 try{
  if(input&&typeof input==='object'){const d=Object.getOwnPropertyDescriptor(input,'kind');mesh=!!d&&'value'in d&&d.value==='mesh';}
  const tag=ownRecord(input,['kind','source','sourceVersion','packet','options'],['kind']);mesh=tag.kind==='mesh';
  if(tag.kind==='scene'){
   const record=ownRecord(input,['kind','source','sourceVersion'],['kind','source']);stage='source';
   if('sourceVersion'in record&&record.sourceVersion!==1)throw new Error('Only explicit sourceVersion: 1 is supported');
   const ast=parseSceneAst(record.source as string,record.sourceVersion===1?1:0),scene=analyzeSceneAst(ast);
   const common={schema:'barocss-gpu-render-ir' as const,pipeline:'sdf' as const,name:scene.name,coordinateSystem:'right-handed-y-up' as const,background:copyGpuData(scene.background)};
   const draw=(o:AnyScene['objects'][number])=>({kind:o.type,id:o.id,color:copyGpuData(o.color),translate:copyGpuData(o.translate),radius:o.radius,size:copyGpuData(o.size)});
   const ir:GpuRenderIR=freezeGpuData(scene.version===1
    ?{...common,schemaVersion:2,rotationOrder:'X-Y-Z',angleUnit:'deg',draws:scene.objects.map(o=>o.type==='torus'?{...draw(o),kind:'torus' as const,majorRadius:o.majorRadius,minorRadius:o.minorRadius,rotateDegrees:copyGpuData(o.rotateDegrees)}:o.type==='cylinder'?{...draw(o),kind:'cylinder' as const,height:o.height,rotateDegrees:copyGpuData(o.rotateDegrees)}:o.type==='capsule'?{...draw(o),kind:'capsule' as const,start:copyGpuData(o.start),end:copyGpuData(o.end),rotateDegrees:copyGpuData(o.rotateDegrees)}:{...draw(o),kind:o.type,rotateDegrees:copyGpuData(o.rotateDegrees)})}
    :{...common,schemaVersion:1,draws:scene.objects.map(o=>({...draw(o),kind:o.type}))});
   stage='lowering';const execution=lowerGpuIR(ir);
   return{ok:true,ast:scene.version===1?freezeGpuData(copyGpuData(ast)):copyGpuData(ast),ir,execution,diagnostics:[]};
  }
  if(tag.kind==='mesh'){
   const record=ownRecord(input,['kind','packet','options']);stage='packet';const packet=validatePreviewPacket(record.packet);stage='options';const options=validateMeshOptions(record.options);const intent={packet,options};
   const ir:GpuRenderIR=freezeGpuData({schema:'barocss-gpu-render-ir',schemaVersion:1,pipeline:'indexed-mesh',name:intent.packet.surfaceId,coordinateSystem:'right-handed-z-up',background:copyGpuData(intent.options.background),draws:[{kind:'indexed-mesh',id:intent.packet.surfaceId,packet:copyGpuData(intent.packet),options:copyGpuData(intent.options)}]});
   stage='lowering';const execution=lowerGpuIR(ir);
   return{ok:true,ast:null,ir,execution,diagnostics:[]};
  }
  throw new Error('Only scene or mesh compiler input is supported');
 }catch(error){const message=error instanceof Error?refusalText(error):'Invalid compiler input';const diagnostic:GpuDiagnostic={code:stage==='lowering'?'LOWERING':code(message),severity:'error',message,range:mesh?null:{start:0,end:0,line:1,column:1}};
  if(error instanceof SceneError){const first=error.diagnostics[0];diagnostic.message=first.message;diagnostic.code=code(first.message);diagnostic.range={start:first.start,end:first.end,line:first.line,column:first.column};const id=/object ID '([^']+)'/.exec(first.message);if(id)diagnostic.objectId=id[1];}
  if(mesh)diagnostic.dataPath=stage==='lowering'?'execution.mesh':stage;return{ok:false,diagnostics:[diagnostic]};
 }
}
export function requireSceneExecution(source:string,options?:SceneSourceOptions):Extract<GpuExecution,{kind:'sdf'}>{const result=compileGpu({kind:'scene',source,...(options===undefined?{}:{sourceVersion:options.sourceVersion})});if(!result.ok){const d=result.diagnostics[0];if(d.range&&d.code!=='LOWERING')throw new SceneError([{message:d.message,...d.range}]);throw new Error(d.message);}if(result.execution.kind!=='sdf')throw new Error('Unexpected GPU pipeline');return result.execution;}
export function requireMeshExecution(packet:unknown,options:unknown):ReturnType<typeof lowerMesh>{const result=compileGpu({kind:'mesh',packet:packet as PreviewPacket,options:options as MeshOptions});if(!result.ok)throw new RangeError(result.diagnostics[0].message);if(result.execution.kind!=='indexed-mesh')throw new Error('Unexpected GPU pipeline');return result.execution.mesh;}
