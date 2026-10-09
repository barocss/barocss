import {QualifiedFaceSceneError,resolveQualifiedFaceScene} from './qualified-face-scene.js';
import type {QualifiedFaceSceneV0} from './qualified-face-scene.js';
import {prepareCamera} from './camera.js';
import {MESH_SHADERS} from './mesh-shaders.js';
import type {UpdateResult} from './renderer.js';
import {freezeGpuData} from './gpu-data.js';

type Prepared=ReturnType<typeof resolveQualifiedFaceScene>;
type Counts={programs:number;shaders:number;vaos:number;buffers:number;framebuffers:number;textures:number;renderbuffers:number};
const LIMITS:Counts={programs:2,shaders:2,vaos:12,buffers:36,framebuffers:2,textures:2,renderbuffers:2};
interface Draw {vao:WebGLVertexArrayObject|null;buffers:WebGLBuffer[]}
interface Target {
  prepared:Prepared;width:number;height:number;program:WebGLProgram|null;draws:Draw[];
  framebuffer:WebGLFramebuffer|null;color:WebGLTexture|null;depth:WebGLRenderbuffer|null;
}
function gpuFailure(error:unknown):QualifiedFaceSceneError {
  return error instanceof QualifiedFaceSceneError?error:new QualifiedFaceSceneError('GPU','Qualified Face GPU operation failed',error);
}

/** Original source-qualified Faces share one exclusive camera and depth target. */
export class QualifiedFaceSceneRenderer {
  private readonly gl:WebGL2RenderingContext;
  private accepted:Target|null=null;
  private cpuScene:QualifiedFaceSceneV0;
  private disposed=false;
  private unavailable=false;
  private readonly counts:Counts={programs:0,shaders:0,vaos:0,buffers:0,framebuffers:0,textures:0,renderbuffers:0};
  private readonly onLoss=(event:Event):void=>{event.preventDefault();this.unavailable=true;};
  constructor(private readonly canvas:HTMLCanvasElement,input:unknown){
    const prepared=resolveQualifiedFaceScene(input);this.cpuScene=prepared.scene;
    this.dimensions(canvas.width,canvas.height);
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
    if(!gl||gl.isContextLost())throw new QualifiedFaceSceneError('CONTEXT','Qualified Face WebGL2 context is unavailable');
    this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
    let candidate:Target|null=null;
    try{candidate=this.create(prepared,canvas.width,canvas.height);this.present(candidate);this.accepted=candidate;}
    catch(error){if(candidate)this.release(candidate);this.dispose();throw gpuFailure(error);}
  }
  /** Full original data remain readable after loss/disposal; each snapshot is independent. */
  getScene():QualifiedFaceSceneV0{return freezeGpuData(structuredClone(this.cpuScene));}
  private live():void {
    if(this.disposed)throw new QualifiedFaceSceneError('DISPOSED','Qualified Face renderer is disposed');
    if(this.unavailable||this.gl.isContextLost()){this.unavailable=true;throw new QualifiedFaceSceneError('CONTEXT','Qualified Face presentation is unavailable; mount a new renderer');}
  }
  private dimensions(width:number,height:number):void {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024||width*height>1048576)
      throw new QualifiedFaceSceneError('BUDGET','Qualified Face framebuffer dimensions exceed bounds');
  }
  private check():void {
    if(this.gl.isContextLost()){this.unavailable=true;throw new QualifiedFaceSceneError('CONTEXT','Qualified Face WebGL2 context is lost');}
    const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new QualifiedFaceSceneError('GPU',`Qualified Face WebGL2 error 0x${error.toString(16)}`);
  }
  private allocate<T>(kind:keyof Counts,create:()=>T|null):T {
    if(this.counts[kind]>=LIMITS[kind])throw new QualifiedFaceSceneError('BUDGET','Qualified Face '+kind+' handle budget exceeded');
    const object=create();if(!object)throw new QualifiedFaceSceneError('GPU','Cannot allocate qualified Face '+kind);
    this.counts[kind]++;return object;
  }
  private free<T>(kind:keyof Counts,object:T|null,remove:(object:T)=>void):void {if(object){remove(object);this.counts[kind]--;}}
  private program():WebGLProgram {
    const gl=this.gl,program=this.allocate('programs',()=>gl.createProgram()),shaders:WebGLShader[]=[],attached:WebGLShader[]=[];
    let alive=true;
    try{
      for(const [kind,text]of [[gl.VERTEX_SHADER,MESH_SHADERS.vertex],[gl.FRAGMENT_SHADER,MESH_SHADERS.fragment]]as const){
        const shader=this.allocate('shaders',()=>gl.createShader(kind));shaders.push(shader);
        gl.shaderSource(shader,text);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new QualifiedFaceSceneError('GPU','Qualified Face shader compile failed: '+gl.getShaderInfoLog(shader));
      }
      for(const shader of shaders){gl.attachShader(program,shader);attached.push(shader);}
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new QualifiedFaceSceneError('GPU','Qualified Face program link failed: '+gl.getProgramInfoLog(program));
      return program;
    }catch(error){this.free('programs',program,value=>gl.deleteProgram(value));alive=false;throw error;}
    finally{for(const shader of shaders){if(alive&&attached.includes(shader))gl.detachShader(program,shader);this.free('shaders',shader,value=>gl.deleteShader(value));}}
  }
  private create(prepared:Prepared,width:number,height:number):Target {
    this.live();this.dimensions(width,height);
    const bytes=prepared.meshes.reduce((sum,mesh)=>sum+mesh.positions.byteLength+mesh.normals.byteLength+mesh.indices.byteLength,0);
    if(prepared.meshes.length<2||prepared.meshes.length>6||prepared.meshes.length!==prepared.scene.assets.length||bytes>60048)
      throw new QualifiedFaceSceneError('BUDGET','Qualified Face candidate geometry exceeds bounds');
    const camera=prepareCamera(prepared.scene.camera,width/height);
    this.check();const gl=this.gl,target:Target={prepared,width,height,program:null,draws:[],framebuffer:null,color:null,depth:null};
    try{
      target.program=this.program();
      for(const mesh of prepared.meshes){
        const draw:Draw={vao:null,buffers:[]};target.draws.push(draw);
        draw.vao=this.allocate('vaos',()=>gl.createVertexArray());gl.bindVertexArray(draw.vao);
        for(const [location,data]of [[0,mesh.positions],[1,mesh.normals]]as const){
          const buffer=this.allocate('buffers',()=>gl.createBuffer());draw.buffers.push(buffer);
          gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
          gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
        }
        const indices=this.allocate('buffers',()=>gl.createBuffer());draw.buffers.push(indices);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
      }
      target.framebuffer=this.allocate('framebuffers',()=>gl.createFramebuffer());
      target.color=this.allocate('textures',()=>gl.createTexture());target.depth=this.allocate('renderbuffers',()=>gl.createRenderbuffer());
      gl.bindTexture(gl.TEXTURE_2D,target.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
      gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new QualifiedFaceSceneError('GPU','Qualified Face candidate framebuffer is incomplete');
      gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);
      gl.clearColor(...prepared.scene.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(target.program);gl.uniform1f(gl.getUniformLocation(target.program,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(target.program,'defaultCamera'),0);
      gl.uniformMatrix4fv(gl.getUniformLocation(target.program,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(target.program,'projection'),false,camera.projection);
      for(let i=0;i<target.draws.length;i++){
        gl.bindVertexArray(target.draws[i].vao);gl.uniform3fv(gl.getUniformLocation(target.program,'color'),prepared.scene.assets[i].color);
        gl.drawElements(gl.TRIANGLES,prepared.meshes[i].indices.length,gl.UNSIGNED_SHORT,0);
      }
      this.check();return target;
    }catch(error){this.release(target);throw error;}
  }
  private present(target:Target):void {
    this.live();const gl=this.gl;
    if(this.canvas.width!==target.width||this.canvas.height!==target.height||gl.drawingBufferWidth!==target.width||gl.drawingBufferHeight!==target.height)
      throw new QualifiedFaceSceneError('GPU','Qualified Face canvas/drawing buffer dimensions do not match the candidate');
    gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,target.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
    gl.blitFramebuffer(0,0,target.width,target.height,0,0,target.width,target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    this.check();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  private transact(input:unknown,width:number,height:number,resize:boolean):UpdateResult {
    const previous=this.accepted;let candidate:Target|null=null;
    try{
      this.live();this.dimensions(width,height);
      if(!resize&&previous&&(this.canvas.width!==previous.width||this.canvas.height!==previous.height))throw new QualifiedFaceSceneError('INPUT','Use qualified Face resize to change canvas dimensions');
      const prepared=resolveQualifiedFaceScene(input);candidate=this.create(prepared,width,height);
      if(resize){this.canvas.width=width;this.canvas.height=height;}
      this.present(candidate);this.accepted=candidate;this.cpuScene=prepared.scene;if(previous)this.release(previous);return{ok:true};
    }catch(error){
      if(candidate)this.release(candidate);let failure=gpuFailure(error);
      if(!this.disposed&&(this.unavailable||this.gl.isContextLost())){this.unavailable=true;failure=new QualifiedFaceSceneError('CONTEXT','Qualified Face presentation is unavailable',failure);}
      else if(previous&&!this.disposed){
        try{if(this.canvas.width!==previous.width)this.canvas.width=previous.width;if(this.canvas.height!==previous.height)this.canvas.height=previous.height;this.present(previous);}
        catch(recovery){this.unavailable=true;failure=new QualifiedFaceSceneError('CONTEXT','Qualified Face accepted presentation could not recover',new AggregateError([failure,recovery]));}
      }
      return{ok:false,error:failure};
    }
  }
  updateScene(scene:unknown):UpdateResult{return this.transact(scene,this.canvas.width,this.canvas.height,false);}
  resize(width:number,height:number):UpdateResult{return this.transact(this.cpuScene,width,height,true);}
  readPixels():Uint8Array {
    this.live();const target=this.accepted!;
    if(this.canvas.width!==target.width||this.canvas.height!==target.height)throw new QualifiedFaceSceneError('INPUT','Use qualified Face resize to change canvas dimensions');
    const gl=this.gl,pixels=new Uint8Array(target.width*target.height*4);
    try{
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,target.framebuffer);gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
      gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.check();return pixels;
    }catch(error){throw gpuFailure(error);}
    finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);}
  }
  private release(target:Target):void {
    const gl=this.gl;
    if(!gl.isContextLost()){
      if(target.program&&gl.getParameter(gl.CURRENT_PROGRAM)===target.program)gl.useProgram(null);
      if(target.draws.some(draw=>draw.vao&&draw.vao===gl.getParameter(gl.VERTEX_ARRAY_BINDING)))gl.bindVertexArray(null);
      for(const [binding,parameter]of [[gl.READ_FRAMEBUFFER,gl.READ_FRAMEBUFFER_BINDING],[gl.DRAW_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER_BINDING]]as const)
        if(target.framebuffer&&gl.getParameter(parameter)===target.framebuffer)gl.bindFramebuffer(binding,null);
    }
    this.free('programs',target.program,value=>gl.deleteProgram(value));target.program=null;
    for(const draw of target.draws){
      this.free('vaos',draw.vao,value=>gl.deleteVertexArray(value));draw.vao=null;
      for(const buffer of draw.buffers)this.free('buffers',buffer,value=>gl.deleteBuffer(value));draw.buffers=[];
    }
    target.draws=[];
    this.free('framebuffers',target.framebuffer,value=>gl.deleteFramebuffer(value));target.framebuffer=null;
    this.free('textures',target.color,value=>gl.deleteTexture(value));target.color=null;
    this.free('renderbuffers',target.depth,value=>gl.deleteRenderbuffer(value));target.depth=null;
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);
    if(this.accepted)this.release(this.accepted);this.accepted=null;
  }
}
export function mountQualifiedFaceScene(canvas:HTMLCanvasElement,scene:unknown):QualifiedFaceSceneRenderer{return new QualifiedFaceSceneRenderer(canvas,scene);}
