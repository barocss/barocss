import {prepareBooleanShellScene,reprepareBooleanShellScene} from './boolean-shell-scene-input.js';
import type {BooleanShellSceneInputV0,BooleanShellSceneOptions,PreparedBooleanShellScene} from './boolean-shell-scene-input.js';
import type {BooleanShellResourceCounts} from './boolean-shell-renderer.js';
import {prepareCamera} from './camera.js';
import {meshLightingShaders,applyMeshLighting,MESH_SHADERS} from './mesh-shaders.js';
import {GPUError} from './renderer.js';
import type {UpdateResult} from './renderer.js';

type Kind=keyof BooleanShellResourceCounts;
type PreparedEntry=PreparedBooleanShellScene['entries'][number];
const LIMITS:BooleanShellResourceCounts={programs:4,shaders:4,vertexArrays:16,buffers:40,framebuffers:2,textures:2,renderbuffers:2};
const EDGE_FRAGMENT=`#version 300 es
precision highp float;
uniform vec3 color;
out vec4 outputColor;
void main(){outputColor=vec4(color,1.0);}`;
interface Draw {
  entry:PreparedEntry; vao:WebGLVertexArrayObject|null; edgeVao:WebGLVertexArrayObject|null; buffers:WebGLBuffer[];
}
interface Frame {
  prepared:PreparedBooleanShellScene; width:number; height:number;
  program:WebGLProgram|null; edgeProgram:WebGLProgram|null; draws:Draw[];
  framebuffer:WebGLFramebuffer|null; color:WebGLTexture|null; depth:WebGLRenderbuffer|null;
}

/** One native Shell scene, one depth target, and explicit qualified leaf identities. */
export class BooleanShellSceneRenderer {
  private readonly gl:WebGL2RenderingContext;
  private accepted:Frame|null=null;
  private disposed=false;
  private lost=false;
  private readonly counts:BooleanShellResourceCounts={programs:0,shaders:0,vertexArrays:0,buffers:0,framebuffers:0,textures:0,renderbuffers:0};
  private readonly onLoss=(event:Event):void=>{event.preventDefault();this.lost=true;};
  constructor(private readonly canvas:HTMLCanvasElement,scene:unknown,options:BooleanShellSceneOptions){
    const prepared=prepareBooleanShellScene(scene,options);
    this.dimensions(canvas.width,canvas.height);
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
    if(!gl||gl.isContextLost())throw new GPUError('WebGL2 is unavailable');
    this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
    let candidate:Frame|null=null;
    try{candidate=this.create(prepared,canvas.width,canvas.height);this.present(candidate);this.accepted=candidate;}
    catch(error){if(candidate)this.release(candidate);this.dispose();throw error;}
  }
  private data():Frame {if(this.disposed||!this.accepted)throw new GPUError('Shell scene renderer is disposed');return this.accepted;}
  private live():void {if(this.disposed)throw new GPUError('Shell scene renderer is disposed');if(this.lost||this.gl.isContextLost())throw new GPUError('WebGL2 context lost; mount a new renderer');}
  get scene():BooleanShellSceneInputV0{return structuredClone(this.data().prepared.scene);}
  get options():BooleanShellSceneOptions{return structuredClone(this.data().prepared.options);}
  get bounds(){return structuredClone(this.data().prepared.bounds);}
  get empty():boolean{return this.data().prepared.entries.every(entry=>entry.buffers.indices.length===0);}
  get resourceCounts():BooleanShellResourceCounts{return {...this.counts};}
  private dimensions(width:number,height:number):void {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>4194304)
      throw new GPUError('Shell scene framebuffer dimensions exceed bounds');
  }
  private check():void {
    const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new GPUError(`Shell scene WebGL2 error 0x${error.toString(16)}`);
    if(this.gl.isContextLost())throw new GPUError('WebGL2 context is lost');
  }
  private allocate<T>(kind:Kind,create:()=>T|null):T {
    if(this.counts[kind]>=LIMITS[kind])throw new GPUError('Shell scene '+kind+' budget exceeded');
    const object=create();if(!object)throw new GPUError('Cannot allocate Shell scene '+kind);
    this.counts[kind]++;return object;
  }
  private free<T>(kind:Kind,object:T|null,destroy:(value:T)=>void):void {if(object){destroy(object);this.counts[kind]--;}}
  private program(vertex:string,fragment:string):WebGLProgram {
    const gl=this.gl,program=this.allocate('programs',()=>gl.createProgram()),shaders:WebGLShader[]=[],attached:WebGLShader[]=[];
    let alive=true;
    try{
      for(const [kind,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]as const){
        const shader=this.allocate('shaders',()=>gl.createShader(kind));shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new GPUError('Shell scene shader compile failed: '+gl.getShaderInfoLog(shader));
      }
      for(const shader of shaders){gl.attachShader(program,shader);attached.push(shader);}
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new GPUError('Shell scene program link failed: '+gl.getProgramInfoLog(program));
      return program;
    }catch(error){this.free('programs',program,p=>gl.deleteProgram(p));alive=false;throw error;}
    finally{for(const shader of shaders){if(alive&&attached.includes(shader))gl.detachShader(program,shader);this.free('shaders',shader,s=>gl.deleteShader(s));}}
  }
  private geometry(draw:Draw,positions:Float32Array,normals:Float32Array|null,indices:Uint16Array):void {
    const gl=this.gl,vao=this.allocate('vertexArrays',()=>gl.createVertexArray());
    // The draw already belongs to the candidate. Own every handle before further allocation.
    if(normals)draw.vao=vao;else draw.edgeVao=vao;
    gl.bindVertexArray(vao);
    for(const [location,values]of [[0,positions],[1,normals]]as const){
      if(!values)continue;
      const buffer=this.allocate('buffers',()=>gl.createBuffer());draw.buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    }
    const index=this.allocate('buffers',()=>gl.createBuffer());draw.buffers.push(index);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  }
  private uniforms(program:WebGLProgram,options:BooleanShellSceneOptions,width:number,height:number,color:readonly number[]):void {
    const gl=this.gl,camera=prepareCamera(options.camera,width/height);
    gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);
    gl.uniform1i(gl.getUniformLocation(program,'defaultCamera'),0);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,camera.view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'projection'),false,camera.projection);
    gl.uniform3fv(gl.getUniformLocation(program,'color'),color as number[]);
  }
  private create(prepared:PreparedBooleanShellScene,width:number,height:number):Frame {
    this.live();this.check();this.dimensions(width,height);prepareCamera(prepared.options.camera,width/height);
    const gl=this.gl,options=prepared.options,frame:Frame={prepared,width,height,program:null,edgeProgram:null,draws:[],framebuffer:null,color:null,depth:null};
    try{
      const entries=prepared.entries.filter(entry=>entry.buffers.indices.length>0);
      if(entries.length){
        const source=meshLightingShaders(options.lighting);frame.program=this.program(source.vertex,source.fragment);
        if(entries.some(entry=>entry.edges&&entry.buffers.edgeIndices.length))frame.edgeProgram=this.program(MESH_SHADERS.vertex,EDGE_FRAGMENT);
        for(const entry of entries){
          const draw:Draw={entry,vao:null,edgeVao:null,buffers:[]};frame.draws.push(draw);
          this.geometry(draw,entry.buffers.positions,entry.buffers.normals,entry.buffers.indices);
          if(entry.edges&&entry.buffers.edgeIndices.length)this.geometry(draw,entry.buffers.edgePositions,null,entry.buffers.edgeIndices);
        }
      }
      frame.framebuffer=this.allocate('framebuffers',()=>gl.createFramebuffer());frame.color=this.allocate('textures',()=>gl.createTexture());frame.depth=this.allocate('renderbuffers',()=>gl.createRenderbuffer());
      gl.bindTexture(gl.TEXTURE_2D,frame.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
      gl.bindRenderbuffer(gl.RENDERBUFFER,frame.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,frame.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,frame.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new GPUError('Shell scene candidate framebuffer incomplete');
      gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);
      gl.clearColor(...options.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      // Finish every opaque leaf before any boundary line uses the same depth attachment.
      if(frame.program)for(const draw of frame.draws){
        gl.bindVertexArray(draw.vao);this.uniforms(frame.program,options,width,height,draw.entry.color);applyMeshLighting(gl,frame.program,options.lighting);
        if(draw.edgeVao){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);}else gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.drawElements(gl.TRIANGLES,draw.entry.buffers.indices.length,gl.UNSIGNED_SHORT,0);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if(frame.edgeProgram){
        gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.lineWidth(1);
        for(const draw of frame.draws)if(draw.edgeVao&&draw.entry.edges){
          gl.bindVertexArray(draw.edgeVao);this.uniforms(frame.edgeProgram,options,width,height,draw.entry.edges.color);
          gl.drawElements(gl.LINES,draw.entry.buffers.edgeIndices.length,gl.UNSIGNED_SHORT,0);
        }
      }
      this.check();return frame;
    }catch(error){this.release(frame);throw error;}
    finally{gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.depthFunc(gl.LESS);}
  }
  private present(frame:Frame):void {
    this.live();const gl=this.gl;
    if(gl.drawingBufferWidth!==this.canvas.width||gl.drawingBufferHeight!==this.canvas.height)throw new GPUError('Shell scene drawing buffer allocation refused');
    gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,frame.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
    gl.blitFramebuffer(0,0,frame.width,frame.height,0,0,this.canvas.width,this.canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);this.check();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  private transact(build:()=>PreparedBooleanShellScene,width:number,height:number,resize=false):UpdateResult {
    let candidate:Frame|null=null;const previous=this.accepted;
    try{
      this.live();this.dimensions(width,height);
      if(!resize&&previous&&(this.canvas.width!==previous.width||this.canvas.height!==previous.height))throw new GPUError('Use Shell scene resize for canvas dimensions');
      const prepared=build();candidate=this.create(prepared,width,height);
      if(resize){this.canvas.width=width;this.canvas.height=height;}
      this.present(candidate);this.accepted=candidate;if(previous)this.release(previous);return{ok:true};
    }catch(error){
      if(candidate)this.release(candidate);
      if(previous&&!this.disposed&&!this.lost&&!this.gl.isContextLost()){
        try{if(this.canvas.width!==previous.width)this.canvas.width=previous.width;if(this.canvas.height!==previous.height)this.canvas.height=previous.height;this.present(previous);}catch{this.lost=true;}
      }
      return{ok:false,error:error instanceof Error?error:new GPUError('Shell scene candidate refused')};
    }
  }
  update(scene:unknown,options:BooleanShellSceneOptions):UpdateResult {
    return this.transact(()=>prepareBooleanShellScene(scene,options),this.canvas.width,this.canvas.height);
  }
  setOptions(options:BooleanShellSceneOptions):UpdateResult {
    return this.transact(()=>reprepareBooleanShellScene(this.data().prepared,options),this.canvas.width,this.canvas.height);
  }
  resize(width:number,height:number):void {
    const result=this.transact(()=>this.data().prepared,width,height,true);if(!result.ok)throw result.error;
  }
  render():void {const frame=this.data();this.live();if(this.canvas.width!==frame.width||this.canvas.height!==frame.height)throw new GPUError('Use Shell scene resize for canvas dimensions');this.present(frame);}
  readPixels():Uint8Array {
    const frame=this.data();this.live();if(this.canvas.width!==frame.width||this.canvas.height!==frame.height)throw new GPUError('Use Shell scene resize for canvas dimensions');
    const gl=this.gl,pixels=new Uint8Array(frame.width*frame.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
    gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);
    gl.readPixels(0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.check();return pixels;
  }
  private release(frame:Frame):void {
    const gl=this.gl;
    if(!gl.isContextLost()){
      if([frame.program,frame.edgeProgram].includes(gl.getParameter(gl.CURRENT_PROGRAM)))gl.useProgram(null);
      if(frame.draws.some(draw=>draw.vao===gl.getParameter(gl.VERTEX_ARRAY_BINDING)||draw.edgeVao===gl.getParameter(gl.VERTEX_ARRAY_BINDING)))gl.bindVertexArray(null);
      for(const target of [gl.READ_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER])if(frame.framebuffer&&gl.getParameter(target===gl.READ_FRAMEBUFFER?gl.READ_FRAMEBUFFER_BINDING:gl.DRAW_FRAMEBUFFER_BINDING)===frame.framebuffer)gl.bindFramebuffer(target,null);
    }
    this.free('programs',frame.program,p=>gl.deleteProgram(p));this.free('programs',frame.edgeProgram,p=>gl.deleteProgram(p));
    for(const draw of frame.draws){
      this.free('vertexArrays',draw.vao,p=>gl.deleteVertexArray(p));this.free('vertexArrays',draw.edgeVao,p=>gl.deleteVertexArray(p));
      draw.buffers.forEach(buffer=>this.free('buffers',buffer,b=>gl.deleteBuffer(b)));
    }
    this.free('framebuffers',frame.framebuffer,f=>gl.deleteFramebuffer(f));this.free('textures',frame.color,t=>gl.deleteTexture(t));this.free('renderbuffers',frame.depth,r=>gl.deleteRenderbuffer(r));
  }
  dispose():void {if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);if(this.accepted)this.release(this.accepted);this.accepted=null;}
}
export function mountBooleanShellScene(canvas:HTMLCanvasElement,scene:unknown,options:BooleanShellSceneOptions):BooleanShellSceneRenderer{return new BooleanShellSceneRenderer(canvas,scene,options);}
