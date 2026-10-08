import {GPUError} from './renderer.js';
import type {UpdateResult} from './renderer.js';
import {prepareSceneMesh} from './mesh-scene-transform.js';
import type {MeshSceneTransform,MeshSceneBounds,SceneMesh} from './mesh-scene-transform.js';
import {validateMeshOptions} from './mesh-packet.js';
import type {PreviewPacket,MeshOptions} from './mesh-packet.js';
import type {RGB,Vec3} from './scene.js';
import {prepareCamera} from './camera.js';
import {MESH_SHADERS} from './mesh-shaders.js';

export interface MeshSceneEntry {packet:PreviewPacket;color:RGB;transform?:MeshSceneTransform}
export type MeshSceneOptions=Omit<MeshOptions,'color'>;
export type {MeshSceneTransform,MeshSceneBounds} from './mesh-scene-transform.js';
type Mesh=SceneMesh;
interface Draw {mesh:Mesh;vao:WebGLVertexArrayObject|null;buffers:WebGLBuffer[]}
interface Frame {
 draws:Draw[];options:MeshSceneOptions;program:WebGLProgram|null;
 framebuffer:WebGLFramebuffer|null;color:WebGLTexture|null;depth:WebGLRenderbuffer|null;
 width:number;height:number;
}
function requireValue(condition:unknown,message:string):asserts condition {if(!condition)throw new GPUError(message);}
function record(input:unknown,keys:string[],label:string):Record<string,unknown> {
 requireValue(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,label+' must be plain JSON data');
 const actual=Reflect.ownKeys(input);requireValue(actual.length===keys.length&&actual.every(k=>typeof k==='string'&&keys.includes(k)),label+' has missing or unsupported fields');
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);requireValue(d&&'value'in d&&d.enumerable,label+'.'+key+' must be own data');result[key]=d.value;}return result;
}
function prepare(entriesInput:unknown,optionsInput:unknown):{meshes:Mesh[];options:MeshSceneOptions} {
 const keys=['mmToSceneUnit','translate','background'];if(optionsInput&&typeof optionsInput==='object'&&Object.hasOwn(optionsInput,'camera'))keys.push('camera');
 const common=record(optionsInput,keys,'Mesh scene options'),white=validateMeshOptions({...common,color:[1,1,1]});
 const options:MeshSceneOptions={mmToSceneUnit:white.mmToSceneUnit,translate:[...white.translate],background:[...white.background],...(white.camera?{camera:structuredClone(white.camera)}:{})};
 requireValue(Array.isArray(entriesInput)&&Object.getPrototypeOf(entriesInput)===Array.prototype,'Mesh scene entries must be a plain array');
 const length=Object.getOwnPropertyDescriptor(entriesInput,'length')!.value;
 requireValue(Number.isInteger(length)&&length>=1&&length<=4,'Mesh scene needs1..4 original packets');
 requireValue(Reflect.ownKeys(entriesInput).length===length+1,'Mesh scene entries must be dense without extra fields');
 const ids=new Set<string>(),meshes:Mesh[]=[];
 for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(entriesInput,String(i));requireValue(d&&'value'in d&&d.enumerable,'Mesh scene entries must be own data');const keys=['packet','color'],hasTransform=d.value!==null&&typeof d.value==='object'&&Object.hasOwn(d.value,'transform');if(hasTransform)keys.push('transform');const entry=record(d.value,keys,'Mesh scene entry'),mesh=prepareSceneMesh(entry.packet,{...options,color:entry.color},entry.transform,hasTransform);requireValue(!ids.has(mesh.packet.surfaceId),'Mesh scene original surface IDs must be distinct');ids.add(mesh.packet.surfaceId);meshes.push(mesh);}
 return{meshes,options};
}
/** Separate original packets share one canvas, context, candidate frame and depth buffer. */
export class MeshSceneRenderer {
 private readonly gl:WebGL2RenderingContext;
 private accepted:Frame|null=null;private disposed=false;private lost=false;
 private readonly onLoss=(event:Event)=>{event.preventDefault();this.lost=true;};
 constructor(private readonly canvas:HTMLCanvasElement,entries:MeshSceneEntry[],options:MeshSceneOptions){
  const prepared=prepare(entries,options);this.dimensions(canvas.width,canvas.height);
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
  if(!gl||gl.isContextLost())throw new GPUError('WebGL2 is unavailable');this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
  let candidate:Frame|null=null;try{candidate=this.create(prepared.meshes,prepared.options,canvas.width,canvas.height);this.present(candidate);this.accepted=candidate;}catch(error){if(candidate)this.release(candidate);this.dispose();throw error;}
 }
 get entries():MeshSceneEntry[]{this.live();return this.accepted!.draws.map(d=>({packet:structuredClone(d.mesh.packet),color:[...d.mesh.options.color],...(d.mesh.transform?{transform:structuredClone(d.mesh.transform)}:{})}));}
 get options():MeshSceneOptions {this.live();return structuredClone(this.accepted!.options);}
 get bounds():MeshSceneBounds {this.live();const bounds=this.accepted!.draws.map(d=>d.mesh.displayBounds);return{min:[0,1,2].map(axis=>Math.min(...bounds.map(b=>b.min[axis]))) as Vec3,max:[0,1,2].map(axis=>Math.max(...bounds.map(b=>b.max[axis]))) as Vec3};}
 private live(){if(this.disposed)throw new GPUError('Mesh scene renderer is disposed');if(this.lost||this.gl.isContextLost())throw new GPUError('WebGL2 context is lost; mount a new renderer');}
 private dimensions(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>4194304)throw new GPUError('Buffer dimensions exceed limits');}
 private check(){const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new GPUError('WebGL2 error 0x'+error.toString(16));if(this.gl.isContextLost())throw new GPUError('WebGL2 context is lost');}
 private create(meshes:Mesh[],options:MeshSceneOptions,width:number,height:number):Frame {
  this.live();this.dimensions(width,height);this.check();const gl=this.gl,camera=prepareCamera(options.camera,width/height);
  const frame:Frame={draws:[],options,program:null,framebuffer:null,color:null,depth:null,width,height},shaders:WebGLShader[]=[];
  try {
   for(const[kind,text]of[[gl.VERTEX_SHADER,MESH_SHADERS.vertex],[gl.FRAGMENT_SHADER,MESH_SHADERS.fragment]]as const){const shader=gl.createShader(kind);if(!shader)throw new GPUError('Cannot allocate mesh scene shader');shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new GPUError('Mesh scene shader compile failed: '+gl.getShaderInfoLog(shader));}
   frame.program=gl.createProgram();if(!frame.program)throw new GPUError('Cannot allocate mesh scene program');for(const shader of shaders)gl.attachShader(frame.program,shader);gl.linkProgram(frame.program);if(!gl.getProgramParameter(frame.program,gl.LINK_STATUS))throw new GPUError('Mesh scene program link failed: '+gl.getProgramInfoLog(frame.program));
   for(const mesh of meshes){const draw:Draw={mesh,vao:gl.createVertexArray(),buffers:[]};frame.draws.push(draw);if(!draw.vao)throw new GPUError('Cannot allocate mesh scene vertex array');gl.bindVertexArray(draw.vao);
    for(const[location,data]of[[0,mesh.positions],[1,mesh.normals]]as const){const buffer=gl.createBuffer();if(!buffer)throw new GPUError('Cannot allocate mesh scene vertex buffer');draw.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);}
    const index=gl.createBuffer();if(!index)throw new GPUError('Cannot allocate mesh scene index buffer');draw.buffers.push(index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
   }
   frame.framebuffer=gl.createFramebuffer();frame.color=gl.createTexture();frame.depth=gl.createRenderbuffer();if(!frame.framebuffer||!frame.color||!frame.depth)throw new GPUError('Cannot allocate mesh scene frame');
   gl.bindTexture(gl.TEXTURE_2D,frame.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
   gl.bindRenderbuffer(gl.RENDERBUFFER,frame.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,frame.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,frame.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,frame.depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new GPUError('Mesh scene frame is incomplete');
   gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);
   gl.clearColor(...options.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.useProgram(frame.program);gl.uniform1f(gl.getUniformLocation(frame.program,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(frame.program,'defaultCamera'),options.camera===undefined?1:0);gl.uniformMatrix4fv(gl.getUniformLocation(frame.program,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(frame.program,'projection'),false,camera.projection);
   for(const draw of frame.draws){gl.bindVertexArray(draw.vao);gl.uniform3fv(gl.getUniformLocation(frame.program,'color'),draw.mesh.options.color);gl.drawElements(gl.TRIANGLES,draw.mesh.indices.length,gl.UNSIGNED_SHORT,0);}
   this.check();return frame;
  }catch(error){this.release(frame);throw error;}finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 private present(frame:Frame){this.live();const gl=this.gl;gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,frame.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,frame.width,frame.height,0,0,this.canvas.width,this.canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);this.check();gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 update(entries:MeshSceneEntry[],options:MeshSceneOptions):UpdateResult {
  let candidate:Frame|null=null;try{this.live();const prepared=prepare(entries,options);candidate=this.create(prepared.meshes,prepared.options,this.canvas.width,this.canvas.height);this.present(candidate);const prior=this.accepted!;this.accepted=candidate;this.release(prior);return{ok:true};}catch(error){if(candidate)this.release(candidate);if(!this.disposed&&!this.lost&&!this.gl.isContextLost()&&this.accepted){try{this.present(this.accepted);}catch{this.lost=true;}}return{ok:false,error:error instanceof Error?error:new GPUError('Mesh scene update failed')};}
 }
 resize(width=this.canvas.width,height=this.canvas.height):void {
  this.live();this.dimensions(width,height);const prior=this.accepted!;let candidate:Frame|null=null;
  try{candidate=this.create(prior.draws.map(d=>d.mesh),prior.options,width,height);this.canvas.width=width;this.canvas.height=height;if(this.gl.drawingBufferWidth!==width||this.gl.drawingBufferHeight!==height)throw new GPUError('Requested scene buffer allocation failed');this.present(candidate);this.accepted=candidate;this.release(prior);}catch(error){if(candidate)this.release(candidate);this.canvas.width=prior.width;this.canvas.height=prior.height;if(!this.gl.isContextLost())this.present(prior);throw error;}
 }
 render():void {this.live();this.dimensions(this.canvas.width,this.canvas.height);this.present(this.accepted!);}
 readPixels():Uint8Array {this.live();this.dimensions(this.canvas.width,this.canvas.height);const gl=this.gl,pixels=new Uint8Array(this.canvas.width*this.canvas.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.readPixels(0,0,this.canvas.width,this.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.check();return pixels;}
 private release(frame:Frame){const gl=this.gl;if(!gl.isContextLost()){if(frame.program&&gl.getParameter(gl.CURRENT_PROGRAM)===frame.program)gl.useProgram(null);if(frame.draws.some(d=>d.vao&&gl.getParameter(gl.VERTEX_ARRAY_BINDING)===d.vao))gl.bindVertexArray(null);for(const[target,binding]of[[gl.READ_FRAMEBUFFER,gl.READ_FRAMEBUFFER_BINDING],[gl.DRAW_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER_BINDING]]as const)if(frame.framebuffer&&gl.getParameter(binding)===frame.framebuffer)gl.bindFramebuffer(target,null);}
  for(const draw of frame.draws){for(const buffer of draw.buffers)gl.deleteBuffer(buffer);if(draw.vao)gl.deleteVertexArray(draw.vao);}if(frame.program)gl.deleteProgram(frame.program);if(frame.framebuffer)gl.deleteFramebuffer(frame.framebuffer);if(frame.depth)gl.deleteRenderbuffer(frame.depth);if(frame.color)gl.deleteTexture(frame.color);
 }
 dispose():void {if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);if(this.accepted)this.release(this.accepted);this.accepted=null;}
}
export function mountMeshScene(canvas:HTMLCanvasElement,entries:MeshSceneEntry[],options:MeshSceneOptions):MeshSceneRenderer {return new MeshSceneRenderer(canvas,entries,options);}
