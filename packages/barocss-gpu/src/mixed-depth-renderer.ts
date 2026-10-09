import {MixedDepthError,resolveMixedDepthFrame} from './mixed-depth-frame.js';
import type {MixedDepthFrameV0} from './mixed-depth-frame.js';
import {prepareCamera} from './camera.js';
import {MESH_SHADERS} from './mesh-shaders.js';
import type {SceneShaders} from './compiler.js';
import type {UpdateResult} from './renderer.js';
import {freezeGpuData} from './gpu-data.js';

type Prepared=ReturnType<typeof resolveMixedDepthFrame>;
type Counts={programs:number;shaders:number;vaos:number;buffers:number;framebuffers:number;textures:number;renderbuffers:number};
const LIMITS:Counts={programs:4,shaders:2,vaos:4,buffers:6,framebuffers:2,textures:2,renderbuffers:2};
interface Target {
  prepared:Prepared;width:number;height:number;
  nativeProgram:WebGLProgram|null;sdfProgram:WebGLProgram|null;
  nativeVao:WebGLVertexArrayObject|null;sdfVao:WebGLVertexArrayObject|null;buffers:WebGLBuffer[];
  framebuffer:WebGLFramebuffer|null;color:WebGLTexture|null;depth:WebGLRenderbuffer|null;
}
function gpuFailure(error:unknown):MixedDepthError {
  return error instanceof MixedDepthError?error:new MixedDepthError('GPU','Mixed depth GPU operation failed',error);
}
/** Adapt only the checked output of the existing compiler, never caller GLSL or its distance kernel. */
function depthShaders(shaders:SceneShaders):SceneShaders {
  let fragment=shaders.fragment;
  const replace=(before:string,after:string):void=>{
    if(fragment.split(before).length!==2)throw new MixedDepthError('GPU','Mixed depth generated shader seam is unavailable');
    fragment=fragment.replace(before,after);
  };
  replace('uniform vec2 resolution;',`uniform vec2 resolution;
uniform mat4 view;
uniform mat4 projection;
uniform vec3 viewEye;
uniform vec2 viewClip;`);
  replace('vec3 direction=normalize(vec3(uv*0.414213562373095, -1.0));',`vec2 ndc=(2.0*gl_FragCoord.xy-resolution)/resolution;
 vec3 right=vec3(view[0][0],view[1][0],view[2][0]);
 vec3 vertical=vec3(view[0][1],view[1][1],view[2][1]);
 vec3 backward=vec3(view[0][2],view[1][2],view[2][2]);
 vec3 direction=normalize(right*(ndc.x/projection[0][0])+vertical*(ndc.y/projection[1][1])-backward);`);
  replace('vec3 origin=vec3(0.0,0.0,6.0); float travel=0.0; bool hit=false; vec3 material;',`vec3 origin=viewEye;
 float c=-dot(backward,direction);
 float D0=-(dot(backward,origin)+view[3][2]);
 if(!(c>0.0)||isnan(c)||isinf(c)||isnan(D0)||isinf(D0))discard;
 float travel=max(0.0,(viewClip.x-D0)/c);
 float endTravel=min(100.0,(viewClip.y-D0)/c);
 if(isnan(travel)||isinf(travel)||isnan(endTravel)||isinf(endTravel)||!(travel<endTravel))discard;
 bool hit=false; vec3 material;`);
  replace('if(travel>100.0)break;','if(travel>endTravel)break;');
  replace('if(!hit){outputColor=vec4(background,1.0);return;}','if(!hit)discard;');
  replace('vec3 p=origin+direction*travel; vec3 unusedColor;',`vec3 p=origin+direction*travel;
 vec4 clip=projection*view*vec4(p,1.0);
 if(!(clip.w>0.0)||any(isnan(clip))||any(isinf(clip)))discard;
 float projectedDepth=clip.z/clip.w;
 if(isnan(projectedDepth)||isinf(projectedDepth)||projectedDepth< -1.0||projectedDepth>1.0)discard;
 gl_FragDepth=0.5*projectedDepth+0.5;
 vec3 unusedColor;`);
  if(new TextEncoder().encode(fragment).length>65536)throw new MixedDepthError('BUDGET','Mixed depth generated shader exceeds64KiB');
  return{vertex:shaders.vertex,fragment};
}

/** One exclusive candidate target for original Sphere source and one qualified Surface packet. */
export class MixedDepthRenderer {
  private readonly gl:WebGL2RenderingContext;
  private accepted:Target|null=null;
  private cpuFrame:MixedDepthFrameV0;
  private disposed=false;
  private unavailable=false;
  private readonly counts:Counts={programs:0,shaders:0,vaos:0,buffers:0,framebuffers:0,textures:0,renderbuffers:0};
  private readonly onLoss=(event:Event):void=>{event.preventDefault();this.unavailable=true;};
  constructor(private readonly canvas:HTMLCanvasElement,input:MixedDepthFrameV0){
    const prepared=resolveMixedDepthFrame(input);this.cpuFrame=prepared.frame;
    this.dimensions(canvas.width,canvas.height);
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
    if(!gl||gl.isContextLost())throw new MixedDepthError('CONTEXT','Mixed depth WebGL2 context is unavailable');
    this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
    let candidate:Target|null=null;
    try{candidate=this.create(prepared,canvas.width,canvas.height);this.present(candidate);this.accepted=candidate;}
    catch(error){if(candidate)this.release(candidate);this.dispose();throw gpuFailure(error);}
  }
  /** Authoring data remain available after context loss and disposal; every result is independent. */
  getFrame():MixedDepthFrameV0{return freezeGpuData(structuredClone(this.cpuFrame));}
  private live():void {
    if(this.disposed)throw new MixedDepthError('DISPOSED','Mixed depth renderer is disposed');
    if(this.unavailable||this.gl.isContextLost()){this.unavailable=true;throw new MixedDepthError('CONTEXT','Mixed depth presentation is unavailable; mount a new renderer');}
  }
  private dimensions(width:number,height:number):void {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1024||height>1024||width*height>1048576)
      throw new MixedDepthError('BUDGET','Mixed depth framebuffer dimensions exceed bounds');
  }
  private check():void {
    if(this.gl.isContextLost()){this.unavailable=true;throw new MixedDepthError('CONTEXT','Mixed depth WebGL2 context is lost');}
    const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new MixedDepthError('GPU',`Mixed depth WebGL2 error 0x${error.toString(16)}`);
  }
  private allocate<T>(kind:keyof Counts,create:()=>T|null):T {
    if(this.counts[kind]>=LIMITS[kind])throw new MixedDepthError('BUDGET','Mixed depth '+kind+' handle budget exceeded');
    const object=create();if(!object)throw new MixedDepthError('GPU','Cannot allocate mixed depth '+kind);
    this.counts[kind]++;return object;
  }
  private free<T>(kind:keyof Counts,object:T|null,remove:(object:T)=>void):void {if(object){remove(object);this.counts[kind]--;}}
  private program(source:SceneShaders):WebGLProgram {
    const gl=this.gl,program=this.allocate('programs',()=>gl.createProgram()),shaders:WebGLShader[]=[],attached:WebGLShader[]=[];
    let alive=true;
    try{
      for(const [kind,text]of [[gl.VERTEX_SHADER,source.vertex],[gl.FRAGMENT_SHADER,source.fragment]]as const){
        const shader=this.allocate('shaders',()=>gl.createShader(kind));shaders.push(shader);
        gl.shaderSource(shader,text);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new MixedDepthError('GPU','Mixed depth shader compile failed: '+gl.getShaderInfoLog(shader));
      }
      for(const shader of shaders){gl.attachShader(program,shader);attached.push(shader);}
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new MixedDepthError('GPU','Mixed depth program link failed: '+gl.getProgramInfoLog(program));
      return program;
    }catch(error){this.free('programs',program,value=>gl.deleteProgram(value));alive=false;throw error;}
    finally{for(const shader of shaders){if(alive&&attached.includes(shader))gl.detachShader(program,shader);this.free('shaders',shader,value=>gl.deleteShader(value));}}
  }
  private create(prepared:Prepared,width:number,height:number):Target {
    this.live();this.dimensions(width,height);
    const camera=prepareCamera(prepared.frame.camera,width/height),sdf=depthShaders(prepared.execution.shaders);
    this.check();const gl=this.gl,target:Target={prepared,width,height,nativeProgram:null,sdfProgram:null,nativeVao:null,sdfVao:null,buffers:[],framebuffer:null,color:null,depth:null};
    try{
      target.nativeProgram=this.program(MESH_SHADERS);target.sdfProgram=this.program(sdf);
      target.nativeVao=this.allocate('vaos',()=>gl.createVertexArray());gl.bindVertexArray(target.nativeVao);
      for(const [location,data]of [[0,prepared.mesh.positions],[1,prepared.mesh.normals]]as const){
        const buffer=this.allocate('buffers',()=>gl.createBuffer());target.buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
      }
      const indices=this.allocate('buffers',()=>gl.createBuffer());target.buffers.push(indices);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,prepared.mesh.indices,gl.STATIC_DRAW);
      target.sdfVao=this.allocate('vaos',()=>gl.createVertexArray());
      target.framebuffer=this.allocate('framebuffers',()=>gl.createFramebuffer());target.color=this.allocate('textures',()=>gl.createTexture());target.depth=this.allocate('renderbuffers',()=>gl.createRenderbuffer());
      gl.bindTexture(gl.TEXTURE_2D,target.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
      gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new MixedDepthError('GPU','Mixed depth candidate framebuffer is incomplete');
      gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);
      gl.clearColor(...prepared.execution.scene.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.bindVertexArray(target.nativeVao);gl.useProgram(target.nativeProgram);
      gl.uniform1f(gl.getUniformLocation(target.nativeProgram,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(target.nativeProgram,'defaultCamera'),0);
      gl.uniformMatrix4fv(gl.getUniformLocation(target.nativeProgram,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(target.nativeProgram,'projection'),false,camera.projection);
      gl.uniform3fv(gl.getUniformLocation(target.nativeProgram,'color'),prepared.frame.surface.color);
      gl.drawElements(gl.TRIANGLES,prepared.mesh.indices.length,gl.UNSIGNED_SHORT,0);
      gl.bindVertexArray(target.sdfVao);gl.useProgram(target.sdfProgram);
      gl.uniform2f(gl.getUniformLocation(target.sdfProgram,'resolution'),width,height);
      gl.uniformMatrix4fv(gl.getUniformLocation(target.sdfProgram,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(target.sdfProgram,'projection'),false,camera.projection);
      gl.uniform3fv(gl.getUniformLocation(target.sdfProgram,'viewEye'),prepared.frame.camera.eye);
      gl.uniform2f(gl.getUniformLocation(target.sdfProgram,'viewClip'),prepared.frame.camera.near,prepared.frame.camera.far);
      gl.drawArrays(gl.TRIANGLES,0,3);this.check();return target;
    }catch(error){this.release(target);throw error;}
  }
  private present(target:Target):void {
    this.live();const gl=this.gl;
    if(this.canvas.width!==target.width||this.canvas.height!==target.height||gl.drawingBufferWidth!==target.width||gl.drawingBufferHeight!==target.height)
      throw new MixedDepthError('GPU','Mixed depth canvas/drawing buffer dimensions do not match the candidate');
    gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,target.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
    gl.blitFramebuffer(0,0,target.width,target.height,0,0,target.width,target.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    this.check();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  private transact(input:MixedDepthFrameV0,width:number,height:number,resize:boolean):UpdateResult {
    const previous=this.accepted;let candidate:Target|null=null;
    try{
      this.live();this.dimensions(width,height);
      if(!resize&&previous&&(this.canvas.width!==previous.width||this.canvas.height!==previous.height))throw new MixedDepthError('INPUT','Use mixed depth resize to change canvas dimensions');
      const prepared=resolveMixedDepthFrame(input);candidate=this.create(prepared,width,height);
      if(resize){this.canvas.width=width;this.canvas.height=height;}
      this.present(candidate);this.accepted=candidate;this.cpuFrame=prepared.frame;if(previous)this.release(previous);return{ok:true};
    }catch(error){
      if(candidate)this.release(candidate);let failure=gpuFailure(error);
      if(!this.disposed&&(this.unavailable||this.gl.isContextLost())){this.unavailable=true;failure=new MixedDepthError('CONTEXT','Mixed depth presentation is unavailable',failure);}
      else if(previous&&!this.disposed){
        try{if(this.canvas.width!==previous.width)this.canvas.width=previous.width;if(this.canvas.height!==previous.height)this.canvas.height=previous.height;this.present(previous);}
        catch(recovery){this.unavailable=true;failure=new MixedDepthError('CONTEXT','Mixed depth accepted presentation could not recover',new AggregateError([failure,recovery]));}
      }
      return{ok:false,error:failure};
    }
  }
  updateFrame(frame:MixedDepthFrameV0):UpdateResult{return this.transact(frame,this.canvas.width,this.canvas.height,false);}
  resize(width:number,height:number):UpdateResult{return this.transact(this.cpuFrame,width,height,true);}
  readPixels():Uint8Array {
    this.live();const target=this.accepted!;
    if(this.canvas.width!==target.width||this.canvas.height!==target.height)throw new MixedDepthError('INPUT','Use mixed depth resize to change canvas dimensions');
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
      if([target.nativeProgram,target.sdfProgram].includes(gl.getParameter(gl.CURRENT_PROGRAM)))gl.useProgram(null);
      if([target.nativeVao,target.sdfVao].includes(gl.getParameter(gl.VERTEX_ARRAY_BINDING)))gl.bindVertexArray(null);
      for(const [binding,parameter]of [[gl.READ_FRAMEBUFFER,gl.READ_FRAMEBUFFER_BINDING],[gl.DRAW_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER_BINDING]]as const)
        if(target.framebuffer&&gl.getParameter(parameter)===target.framebuffer)gl.bindFramebuffer(binding,null);
    }
    this.free('programs',target.nativeProgram,value=>gl.deleteProgram(value));target.nativeProgram=null;
    this.free('programs',target.sdfProgram,value=>gl.deleteProgram(value));target.sdfProgram=null;
    this.free('vaos',target.nativeVao,value=>gl.deleteVertexArray(value));target.nativeVao=null;
    this.free('vaos',target.sdfVao,value=>gl.deleteVertexArray(value));target.sdfVao=null;
    for(const buffer of target.buffers)this.free('buffers',buffer,value=>gl.deleteBuffer(value));target.buffers=[];
    this.free('framebuffers',target.framebuffer,value=>gl.deleteFramebuffer(value));target.framebuffer=null;
    this.free('textures',target.color,value=>gl.deleteTexture(value));target.color=null;
    this.free('renderbuffers',target.depth,value=>gl.deleteRenderbuffer(value));target.depth=null;
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);
    if(this.accepted)this.release(this.accepted);this.accepted=null;
  }
}
export function mountMixedDepthScene(canvas:HTMLCanvasElement,frame:MixedDepthFrameV0):MixedDepthRenderer{return new MixedDepthRenderer(canvas,frame);}
