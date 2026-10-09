import {prepareBooleanShellBuffers} from './boolean-shell-buffers.js';
import type {PreparedBooleanShellBuffers} from './boolean-shell-buffers.js';
import type {CoplanarFaceBooleanExtrusionMeshResult} from '@barocss/cad';
import {validateMeshOptions} from './mesh-packet.js';
import type {MeshOptions} from './mesh-packet.js';
import {prepareCamera} from './camera.js';
import type {MeshCamera} from './camera.js';
import {meshLightingShaders,applyMeshLighting,MESH_SHADERS} from './mesh-shaders.js';
import {ownRecord,freezeGpuData} from './gpu-data.js';
import {GPUError} from './renderer.js';
import type {UpdateResult} from './renderer.js';

export interface BooleanShellOptions {
  mesh: MeshOptions & {camera: MeshCamera};
  edges: {color: [number,number,number]} | null;
}
/** Live owned handle counts, not physical driver memory/performance measurements. */
export interface BooleanShellResourceCounts {
  programs:number; shaders:number; vertexArrays:number; buffers:number;
  framebuffers:number; textures:number; renderbuffers:number;
}
type Kind=keyof BooleanShellResourceCounts;
const LIMITS:BooleanShellResourceCounts={programs:4,shaders:4,vertexArrays:4,buffers:10,framebuffers:2,textures:2,renderbuffers:2};
const EDGE_FRAGMENT=`#version 300 es
precision highp float;
uniform vec3 color;
out vec4 outputColor;
void main(){outputColor=vec4(color,1.0);}`;
interface Frame {
  prepared:PreparedBooleanShellBuffers; options:BooleanShellOptions; width:number; height:number;
  program:WebGLProgram|null; edgeProgram:WebGLProgram|null; vao:WebGLVertexArrayObject|null; edgeVao:WebGLVertexArrayObject|null;
  buffers:WebGLBuffer[]; framebuffer:WebGLFramebuffer|null; color:WebGLTexture|null; depth:WebGLRenderbuffer|null;
}
function admit(input:unknown):BooleanShellOptions {
  const data=ownRecord(input,['mesh','edges']);
  const mesh=validateMeshOptions(data.mesh);
  if(!mesh.camera)throw new RangeError('Shell renderer requires an explicit camera');
  let edges:BooleanShellOptions['edges']=null;
  if(data.edges!==null){
    const edge=ownRecord(data.edges,['color']),color=edge.color;
    if(!Array.isArray(color)||Object.getPrototypeOf(color)!==Array.prototype||color.length!==3||Reflect.ownKeys(color).length!==4)
      throw new RangeError('Shell edges require three own RGB values');
    const values=Array.from({length:3},(_,i)=>{
      const d=Object.getOwnPropertyDescriptor(color,String(i));
      if(!d||!('value'in d)||!d.enumerable||typeof d.value!=='number'||!Number.isFinite(d.value)||d.value<0||d.value>1)
        throw new RangeError('Shell edge RGB must be finite in [0,1]');
      return d.value;
    }) as [number,number,number];
    edges={color:values};
  }
  return freezeGpuData({mesh:mesh as BooleanShellOptions['mesh'],edges});
}
function conversion(options:BooleanShellOptions){return {mmToSceneUnit:options.mesh.mmToSceneUnit,translate:options.mesh.translate};}

/** Dedicated native Shell staging/draw path. No Surface packet, welding or geometry reconstruction here. */
export class BooleanShellRenderer {
  private readonly gl:WebGL2RenderingContext;
  private accepted:Frame|null=null;
  private disposed=false;
  private lost=false;
  private readonly counts:BooleanShellResourceCounts={programs:0,shaders:0,vertexArrays:0,buffers:0,framebuffers:0,textures:0,renderbuffers:0};
  private readonly onLoss=(event:Event):void=>{event.preventDefault();this.lost=true;};
  constructor(private readonly canvas:HTMLCanvasElement,native:unknown,optionsInput:BooleanShellOptions){
    const options=admit(optionsInput),prepared=prepareBooleanShellBuffers(native,conversion(options));
    this.dimensions(canvas.width,canvas.height);
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
    if(!gl||gl.isContextLost())throw new GPUError('WebGL2 is unavailable');
    this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
    let candidate:Frame|null=null;
    try{candidate=this.create(prepared,options,canvas.width,canvas.height);this.present(candidate);this.accepted=candidate;}
    catch(error){if(candidate)this.release(candidate);this.dispose();throw error;}
  }
  private data():Frame {if(this.disposed||!this.accepted)throw new GPUError('Shell renderer is disposed');return this.accepted;}
  private live():void {if(this.disposed)throw new GPUError('Shell renderer is disposed');if(this.lost||this.gl.isContextLost())throw new GPUError('WebGL2 context lost; mount a new renderer');}
  get native():CoplanarFaceBooleanExtrusionMeshResult{return structuredClone(this.data().prepared.native);}
  get options():BooleanShellOptions{return structuredClone(this.data().options);}
  get bounds(){return structuredClone(this.data().prepared.bounds);}
  get empty():boolean{return this.data().prepared.indices.length===0;}
  get resourceCounts():BooleanShellResourceCounts{return {...this.counts};}
  private dimensions(width:number,height:number):void {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>4194304)
      throw new GPUError('Shell framebuffer dimensions exceed bounds');
  }
  private check():void {
    const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new GPUError(`Shell WebGL2 error 0x${error.toString(16)}`);
    if(this.gl.isContextLost())throw new GPUError('WebGL2 context is lost');
  }
  private allocate<T>(kind:Kind,create:()=>T|null):T {
    if(this.counts[kind]>=LIMITS[kind])throw new GPUError('Shell '+kind+' budget exceeded');
    const object=create();if(!object)throw new GPUError('Cannot allocate Shell '+kind);
    this.counts[kind]++;return object;
  }
  private free<T>(kind:Kind,object:T|null,destroy:(value:T)=>void):void {if(object){destroy(object);this.counts[kind]--;}}
  private program(vertex:string,fragment:string):WebGLProgram {
    const gl=this.gl,program=this.allocate('programs',()=>gl.createProgram()),shaders:WebGLShader[]=[];
    let attached=false,alive=true;
    try{
      for(const [kind,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]as const){
        const shader=this.allocate('shaders',()=>gl.createShader(kind));shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new GPUError('Shell shader compile failed: '+gl.getShaderInfoLog(shader));
      }
      shaders.forEach(shader=>gl.attachShader(program,shader));attached=true;gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new GPUError('Shell program link failed: '+gl.getProgramInfoLog(program));
      return program;
    }catch(error){this.free('programs',program,p=>gl.deleteProgram(p));alive=false;throw error;}
    finally{for(const shader of shaders){if(alive&&attached)gl.detachShader(program,shader);this.free('shaders',shader,s=>gl.deleteShader(s));}}
  }
  private geometry(frame:Frame,positions:Float32Array,normals:Float32Array|null,indices:Uint16Array):WebGLVertexArrayObject {
    const gl=this.gl,vao=this.allocate('vertexArrays',()=>gl.createVertexArray());
    // Assign ownership before any following allocation can fail.
    if(normals)frame.vao=vao;else frame.edgeVao=vao;
    gl.bindVertexArray(vao);
    for(const [location,values]of [[0,positions],[1,normals]]as const){
      if(!values)continue;
      const buffer=this.allocate('buffers',()=>gl.createBuffer());frame.buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    }
    const index=this.allocate('buffers',()=>gl.createBuffer());frame.buffers.push(index);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    return vao;
  }
  private uniforms(program:WebGLProgram,options:BooleanShellOptions,width:number,height:number,color:readonly number[]):void {
    const gl=this.gl,camera=prepareCamera(options.mesh.camera,width/height);
    gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);
    gl.uniform1i(gl.getUniformLocation(program,'defaultCamera'),0);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,camera.view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'projection'),false,camera.projection);
    gl.uniform3fv(gl.getUniformLocation(program,'color'),color as number[]);
  }
  private create(prepared:PreparedBooleanShellBuffers,options:BooleanShellOptions,width:number,height:number):Frame {
    this.live();this.check();this.dimensions(width,height);prepareCamera(options.mesh.camera,width/height);
    const gl=this.gl,frame:Frame={prepared,options,width,height,program:null,edgeProgram:null,vao:null,edgeVao:null,buffers:[],framebuffer:null,color:null,depth:null};
    try{
      if(prepared.indices.length){
        const source=meshLightingShaders(options.mesh.lighting);frame.program=this.program(source.vertex,source.fragment);
        this.geometry(frame,prepared.positions,prepared.normals,prepared.indices);
        if(options.edges&&prepared.edgeIndices.length){frame.edgeProgram=this.program(MESH_SHADERS.vertex,EDGE_FRAGMENT);this.geometry(frame,prepared.edgePositions,null,prepared.edgeIndices);}
      }
      frame.framebuffer=this.allocate('framebuffers',()=>gl.createFramebuffer());frame.color=this.allocate('textures',()=>gl.createTexture());frame.depth=this.allocate('renderbuffers',()=>gl.createRenderbuffer());
      gl.bindTexture(gl.TEXTURE_2D,frame.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
      gl.bindRenderbuffer(gl.RENDERBUFFER,frame.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,frame.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,frame.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new GPUError('Shell candidate framebuffer incomplete');
      gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);
      gl.clearColor(...options.mesh.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      if(frame.program){
        gl.bindVertexArray(frame.vao);this.uniforms(frame.program,options,width,height,options.mesh.color);applyMeshLighting(gl,frame.program,options.mesh.lighting);
        if(frame.edgeProgram){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);}
        gl.drawElements(gl.TRIANGLES,prepared.indices.length,gl.UNSIGNED_SHORT,0);
        if(frame.edgeProgram&&options.edges){
          gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(frame.edgeVao);this.uniforms(frame.edgeProgram,options,width,height,options.edges.color);
          gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.lineWidth(1);gl.drawElements(gl.LINES,prepared.edgeIndices.length,gl.UNSIGNED_SHORT,0);
        }
      }
      this.check();return frame;
    }catch(error){this.release(frame);throw error;}
    finally{gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.depthFunc(gl.LESS);}
  }
  private present(frame:Frame):void {
    this.live();const gl=this.gl;
    if(gl.drawingBufferWidth!==this.canvas.width||gl.drawingBufferHeight!==this.canvas.height)throw new GPUError('Shell drawing buffer allocation refused');
    gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,frame.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
    gl.blitFramebuffer(0,0,frame.width,frame.height,0,0,this.canvas.width,this.canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);this.check();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  private transact(build:()=>{prepared:PreparedBooleanShellBuffers;options:BooleanShellOptions},width:number,height:number,resize=false):UpdateResult {
    let candidate:Frame|null=null;const previous=this.accepted;
    try{
      this.live();this.dimensions(width,height);
      if(!resize&&previous&&(this.canvas.width!==previous.width||this.canvas.height!==previous.height))throw new GPUError('Use Shell resize for canvas dimensions');
      const value=build();candidate=this.create(value.prepared,value.options,width,height);
      if(resize){this.canvas.width=width;this.canvas.height=height;}
      this.present(candidate);this.accepted=candidate;if(previous)this.release(previous);return{ok:true};
    }catch(error){
      if(candidate)this.release(candidate);
      if(previous&&!this.disposed&&!this.lost&&!this.gl.isContextLost()){
        try{if(this.canvas.width!==previous.width)this.canvas.width=previous.width;if(this.canvas.height!==previous.height)this.canvas.height=previous.height;this.present(previous);}catch{this.lost=true;}
      }
      return{ok:false,error:error instanceof Error?error:new GPUError('Shell candidate refused')};
    }
  }
  update(native:unknown,optionsInput:BooleanShellOptions):UpdateResult {
    return this.transact(()=>{const options=admit(optionsInput);return{prepared:prepareBooleanShellBuffers(native,conversion(options)),options};},this.canvas.width,this.canvas.height);
  }
  setOptions(optionsInput:BooleanShellOptions):UpdateResult {
    return this.transact(()=>{
      const previous=this.data(),options=admit(optionsInput),before=previous.options.mesh,after=options.mesh;
      const same=Object.is(before.mmToSceneUnit,after.mmToSceneUnit)&&before.translate.every((n,i)=>Object.is(n,after.translate[i]));
      return{prepared:same?previous.prepared:prepareBooleanShellBuffers(previous.prepared.native,conversion(options)),options};
    },this.canvas.width,this.canvas.height);
  }
  resize(width:number,height:number):void {
    const result=this.transact(()=>{const previous=this.data();return{prepared:previous.prepared,options:previous.options};},width,height,true);
    if(!result.ok)throw result.error;
  }
  render():void {const frame=this.data();this.live();if(this.canvas.width!==frame.width||this.canvas.height!==frame.height)throw new GPUError('Use Shell resize for canvas dimensions');this.present(frame);}
  readPixels():Uint8Array {
    const frame=this.data();this.live();if(this.canvas.width!==frame.width||this.canvas.height!==frame.height)throw new GPUError('Use Shell resize for canvas dimensions');
    const gl=this.gl,pixels=new Uint8Array(frame.width*frame.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
    gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
    gl.readPixels(0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.check();return pixels;
  }
  private release(frame:Frame):void {
    const gl=this.gl;
    if(!gl.isContextLost()){
      if([frame.program,frame.edgeProgram].includes(gl.getParameter(gl.CURRENT_PROGRAM)))gl.useProgram(null);
      if([frame.vao,frame.edgeVao].includes(gl.getParameter(gl.VERTEX_ARRAY_BINDING)))gl.bindVertexArray(null);
      for(const target of [gl.READ_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER])if(frame.framebuffer&&gl.getParameter(target===gl.READ_FRAMEBUFFER?gl.READ_FRAMEBUFFER_BINDING:gl.DRAW_FRAMEBUFFER_BINDING)===frame.framebuffer)gl.bindFramebuffer(target,null);
    }
    this.free('programs',frame.program,p=>gl.deleteProgram(p));this.free('programs',frame.edgeProgram,p=>gl.deleteProgram(p));
    this.free('vertexArrays',frame.vao,p=>gl.deleteVertexArray(p));this.free('vertexArrays',frame.edgeVao,p=>gl.deleteVertexArray(p));
    frame.buffers.forEach(buffer=>this.free('buffers',buffer,b=>gl.deleteBuffer(b)));
    this.free('framebuffers',frame.framebuffer,f=>gl.deleteFramebuffer(f));this.free('textures',frame.color,t=>gl.deleteTexture(t));this.free('renderbuffers',frame.depth,r=>gl.deleteRenderbuffer(r));
  }
  dispose():void {if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);if(this.accepted)this.release(this.accepted);this.accepted=null;}
}
export function mountBooleanShell(canvas:HTMLCanvasElement,native:unknown,options:BooleanShellOptions):BooleanShellRenderer{return new BooleanShellRenderer(canvas,native,options);}
