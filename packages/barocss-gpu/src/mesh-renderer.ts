import {MESH_LIGHTING as LIGHTING,MESH_SHADERS as SHADERS} from './mesh-shaders.js';
import { GPUError } from './renderer.js';
import type { UpdateResult } from './renderer.js';
import {requireMeshExecution} from './gpu-compiler.js';
import { prepareCamera } from './camera.js';
import { validateMeshOptions } from './mesh-packet.js';
import type { PreviewPacket, MeshOptions } from './mesh-packet.js';
import type { SceneShaders } from './compiler.js';
import { prepareEdgeOverlay, sameMeshPacket } from './edge-overlay.js';
import type { MeshEdgeOverlay, PreparedMeshEdges } from './edge-overlay.js';

import {prepareFaceHighlight} from './face-highlight.js';
import type {MeshFaceHighlight} from './face-highlight.js';

import {prepareObjectHighlight} from './object-highlight.js';
import type {MeshObjectHighlight} from './object-highlight.js';


type Mesh = ReturnType<typeof requireMeshExecution>;
const EMPTY_VIEWPORT = Symbol('empty mesh viewport');
interface Resources {
  highlight: MeshFaceHighlight | null;
  objectHighlight: MeshObjectHighlight | null;
  mesh: Mesh | null; options: MeshOptions; program: WebGLProgram | null; vao: WebGLVertexArrayObject | null;
  buffers: WebGLBuffer[]; framebuffer: WebGLFramebuffer | null;
  color: WebGLTexture | null; depth: WebGLRenderbuffer | null;
  width: number; height: number;
  edges: PreparedMeshEdges | null; edgeProgram: WebGLProgram | null; edgeVao: WebGLVertexArrayObject | null;
}
const EDGE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 color;
out vec4 outputColor;
void main(){outputColor=vec4(color,1.0);}`;

/** Indexed WebGL2 mesh rendering into a candidate framebuffer before acceptance. */
export class MeshRenderer {
  private readonly gl: WebGL2RenderingContext;
  private accepted: Resources | null = null;
  private disposed = false;
  private lost = false;
  private readonly onLoss = (event: Event): void => { event.preventDefault(); this.lost = true; };
  constructor(private readonly canvas: HTMLCanvasElement, packet: unknown, options: unknown, overlay?: MeshEdgeOverlay | null, highlight?:MeshFaceHighlight|null) {
    const mesh = packet === EMPTY_VIEWPORT ? null : requireMeshExecution(packet, options);
    const displayOptions = mesh ? mesh.options : validateMeshOptions(options);
    const edges = mesh ? prepareEdgeOverlay(overlay === undefined ? null : overlay, mesh.packet, mesh.options) : null;
    const face=mesh ? prepareFaceHighlight(highlight===undefined?null:highlight,mesh.packet) : null;
    this.dimensions(canvas.width, canvas.height);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, preserveDrawingBuffer: true });
    if (!gl || gl.isContextLost()) throw new GPUError('WebGL2 is unavailable');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLoss);
    let candidate: Resources | null = null;
    try {
      candidate = this.create(mesh, displayOptions, canvas.width, canvas.height, edges, face);
      this.present(candidate);
      this.accepted = candidate;
    } catch (error) { if (candidate) this.release(candidate); this.dispose(); throw error; }
  }
  get packet(): PreviewPacket { this.live(); if (!this.accepted!.mesh) throw new GPUError('Viewport is empty'); return structuredClone(this.accepted!.mesh.packet); }
  /** Internal shared lifecycle used by the additive viewport API. */
  static empty(canvas: HTMLCanvasElement, options: MeshOptions): MeshRenderer { return new MeshRenderer(canvas, EMPTY_VIEWPORT, options); }
  get empty(): boolean { this.live(); return this.accepted!.mesh === null; }
  get options(): MeshOptions { this.live(); return structuredClone(this.accepted!.options); }
  get edgeOverlay(): MeshEdgeOverlay | null { this.live(); return this.accepted!.edges ? structuredClone(this.accepted!.edges.overlay) : null; }
  get faceHighlight():MeshFaceHighlight|null {this.live();return this.accepted!.highlight&&structuredClone(this.accepted!.highlight);}
  get objectHighlight():MeshObjectHighlight|null {this.live();return this.accepted!.objectHighlight&&structuredClone(this.accepted!.objectHighlight);}
  get lighting() {return structuredClone(LIGHTING);}
  get revision(): number { this.live(); if (!this.accepted!.mesh) throw new GPUError('Viewport is empty'); return this.accepted!.mesh.packet.revision; }
  get shaders(): SceneShaders { this.live(); return { ...SHADERS }; }
  private live(): void {
    if (this.disposed) throw new GPUError('Mesh renderer is disposed');
    if (this.lost || this.gl.isContextLost()) throw new GPUError('WebGL2 context is lost; mount a new renderer');
  }
  private dimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 4194304) throw new GPUError('Buffer dimensions exceed limits');
  }
  private check(): void {
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) throw new GPUError(`WebGL2 error 0x${error.toString(16)}`);
    if (this.gl.isContextLost()) throw new GPUError('WebGL2 context is lost');
  }
  private create(mesh: Mesh | null, options: MeshOptions, width: number, height: number, edges: PreparedMeshEdges | null, highlight:MeshFaceHighlight|null,objectHighlight:MeshObjectHighlight|null=null): Resources {
    this.live(); this.check();
    const camera = prepareCamera(options.camera, width / height);
    const gl = this.gl;
    const resources: Resources = { highlight, objectHighlight, mesh, options, program: null, vao: null, buffers: [], framebuffer: null, color: null, depth: null, width, height, edges, edgeProgram: null, edgeVao: null };
    const shaders: WebGLShader[] = [];
    try {
      if (mesh) {
        for (const [kind, text] of [[gl.VERTEX_SHADER, SHADERS.vertex], [gl.FRAGMENT_SHADER, SHADERS.fragment]] as const) {
          const shader = gl.createShader(kind);
          if (!shader) throw new GPUError('Cannot allocate mesh shader');
          shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new GPUError(`Mesh shader compile failed: ${gl.getShaderInfoLog(shader)}`);
        }
        resources.program = gl.createProgram();
        if (!resources.program) throw new GPUError('Cannot allocate mesh program');
        shaders.forEach(shader => gl.attachShader(resources.program!, shader)); gl.linkProgram(resources.program);
        if (!gl.getProgramParameter(resources.program, gl.LINK_STATUS)) throw new GPUError(`Mesh program link failed: ${gl.getProgramInfoLog(resources.program)}`);
        resources.vao = gl.createVertexArray();
        if (!resources.vao) throw new GPUError('Cannot allocate mesh vertex array');
        gl.bindVertexArray(resources.vao);
        for (const [location, data] of [[0, mesh.positions], [1, mesh.normals]] as const) {
          const buffer = gl.createBuffer();
          if (!buffer) throw new GPUError('Cannot allocate vertex buffer');
          resources.buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
        }
        const indices = gl.createBuffer();
        if (!indices) throw new GPUError('Cannot allocate index buffer');
        resources.buffers.push(indices); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      }
      resources.framebuffer = gl.createFramebuffer(); resources.color = gl.createTexture(); resources.depth = gl.createRenderbuffer();
      if (!resources.framebuffer || !resources.color || !resources.depth) throw new GPUError('Cannot allocate candidate framebuffer');
      gl.bindTexture(gl.TEXTURE_2D, resources.color);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, resources.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resources.color, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, resources.depth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new GPUError('Candidate framebuffer is incomplete');
      this.check();
      gl.useProgram(resources.program); gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.colorMask(true, true, true, true);
      gl.clearColor(...options.background, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (mesh) {
        gl.uniform1f(gl.getUniformLocation(resources.program!, 'aspect'), width / height);
        gl.uniform1i(gl.getUniformLocation(resources.program!, 'defaultCamera'), options.camera === undefined ? 1 : 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(resources.program!, 'view'), false, camera.view);
        gl.uniformMatrix4fv(gl.getUniformLocation(resources.program!, 'projection'), false, camera.projection);
        gl.uniform3fv(gl.getUniformLocation(resources.program!, 'color'), options.color);
        if (edges) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); }
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
        if(objectHighlight){
          gl.uniform3fv(gl.getUniformLocation(resources.program!,'color'),objectHighlight.color);
          gl.depthFunc(gl.EQUAL);gl.depthMask(false);
          gl.drawElements(gl.TRIANGLES,objectHighlight.indexRange[1]-objectHighlight.indexRange[0],gl.UNSIGNED_SHORT,objectHighlight.indexRange[0]*2);
          gl.depthMask(true);gl.depthFunc(gl.LESS);
        }
        if(highlight){
          gl.uniform3fv(gl.getUniformLocation(resources.program!, 'color'),highlight.color);
          gl.depthFunc(gl.EQUAL);gl.depthMask(false);
          gl.drawElements(gl.TRIANGLES,highlight.indexRange[1]-highlight.indexRange[0],gl.UNSIGNED_SHORT,highlight.indexRange[0]*2);
          gl.depthMask(true);gl.depthFunc(gl.LESS);
        }
        if (edges) {
          gl.disable(gl.POLYGON_OFFSET_FILL);
          for (const [kind, text] of [[gl.VERTEX_SHADER, SHADERS.vertex], [gl.FRAGMENT_SHADER, EDGE_FRAGMENT]] as const) {
            const shader = gl.createShader(kind);
            if (!shader) throw new GPUError('Cannot allocate edge shader');
            shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new GPUError(`Edge shader compile failed: ${gl.getShaderInfoLog(shader)}`);
          }
          resources.edgeProgram = gl.createProgram();
          if (!resources.edgeProgram) throw new GPUError('Cannot allocate edge program');
          shaders.slice(-2).forEach(shader => gl.attachShader(resources.edgeProgram!, shader)); gl.linkProgram(resources.edgeProgram);
          if (!gl.getProgramParameter(resources.edgeProgram, gl.LINK_STATUS)) throw new GPUError(`Edge program link failed: ${gl.getProgramInfoLog(resources.edgeProgram)}`);
          resources.edgeVao = gl.createVertexArray();
          if (!resources.edgeVao) throw new GPUError('Cannot allocate edge vertex array');
          gl.bindVertexArray(resources.edgeVao);
          const buffer = gl.createBuffer();
          if (!buffer) throw new GPUError('Cannot allocate edge positions');
          resources.buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, edges.positions, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
          gl.useProgram(resources.edgeProgram);
          gl.uniform1f(gl.getUniformLocation(resources.edgeProgram, 'aspect'), width / height);
          gl.uniform1i(gl.getUniformLocation(resources.edgeProgram, 'defaultCamera'), options.camera === undefined ? 1 : 0);
          gl.uniformMatrix4fv(gl.getUniformLocation(resources.edgeProgram, 'view'), false, camera.view);
          gl.uniformMatrix4fv(gl.getUniformLocation(resources.edgeProgram, 'projection'), false, camera.projection);
          gl.uniform3fv(gl.getUniformLocation(resources.edgeProgram, 'color'), edges.overlay.color);
          gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.lineWidth(1);
          for (const range of edges.ranges) gl.drawArrays(gl.LINE_STRIP, range.start, range.count);
        }
      }
      this.check(); return resources;
    } catch (error) { this.release(resources); throw error; }
    finally {
      if (edges) { gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.depthFunc(gl.LESS); }
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }
  private present(resources: Resources): void {
    this.live();
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resources.framebuffer); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, resources.width, resources.height, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    this.check();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  update(packet: PreviewPacket, options: MeshOptions, overlay?: MeshEdgeOverlay | null, highlight?:MeshFaceHighlight|null, objectHighlight?:MeshObjectHighlight|null): UpdateResult {
    let candidate: Resources | null = null;
    try {
      this.live(); const mesh = requireMeshExecution(packet, options);
      const retained = overlay === undefined && this.accepted!.mesh && this.accepted!.edges && sameMeshPacket(mesh.packet, this.accepted!.mesh.packet) ? this.accepted!.edges.overlay : null;
      const edges = prepareEdgeOverlay(overlay === undefined ? retained : overlay, mesh.packet, mesh.options);
      const oldFace=highlight===undefined&&this.accepted!.mesh&&sameMeshPacket(mesh.packet,this.accepted!.mesh.packet)?this.accepted!.highlight:null;
      const face=prepareFaceHighlight(highlight===undefined?oldFace:highlight,mesh.packet);
      const retainedObject=objectHighlight===undefined&&this.accepted!.mesh&&sameMeshPacket(mesh.packet,this.accepted!.mesh.packet)?this.accepted!.objectHighlight:null;
      const object=prepareObjectHighlight(objectHighlight===undefined?retainedObject:objectHighlight,mesh.packet);
      candidate = this.create(mesh, mesh.options, this.canvas.width, this.canvas.height, edges, face, object);
      this.present(candidate);
      const previous = this.accepted!; this.accepted = candidate; this.release(previous);
      return { ok: true };
    } catch (error) {
      if (candidate) this.release(candidate);
      if (!this.disposed && !this.lost && !this.gl.isContextLost() && this.accepted) {
        try { this.present(this.accepted); } catch { this.lost = true; }
      }
      return { ok: false, error: error instanceof Error ? error : new GPUError('Mesh update failed') };
    }
  }
  clear(options?: MeshOptions): UpdateResult {
    let candidate: Resources | null = null;
    try {
      this.live();
      const prepared = validateMeshOptions(options === undefined ? this.options : options);
      candidate = this.create(null, prepared, this.canvas.width, this.canvas.height, null, null);
      this.present(candidate);
      const previous = this.accepted!; this.accepted = candidate; this.release(previous);
      return { ok: true };
    } catch (error) {
      if (candidate) this.release(candidate);
      if (!this.disposed && !this.lost && !this.gl.isContextLost() && this.accepted) {
        try { this.present(this.accepted); } catch { this.lost = true; }
      }
      return { ok: false, error: error instanceof Error ? error : new GPUError('Viewport clear failed') };
    }
  }
  render(): void { this.live(); this.present(this.accepted!); }
  setEdgeOverlay(overlay: MeshEdgeOverlay | null): UpdateResult {
    try {
      this.live();
      if (overlay === undefined) throw new GPUError('Use null to remove edge paths');
      if (!this.accepted!.mesh) throw new GPUError('Viewport is empty');
      return this.update(this.accepted!.mesh.packet, this.accepted!.options, overlay);
    } catch (error) { return { ok: false, error: error instanceof Error ? error : new GPUError('Edge update failed') }; }
  }
  setObjectHighlight(highlight:MeshObjectHighlight|null):UpdateResult {
    try{this.live();if(highlight===undefined)throw new GPUError('Use null to clear object selection');if(!this.accepted!.mesh)throw new GPUError('Viewport is empty');return this.update(this.accepted!.mesh.packet,this.accepted!.options,undefined,undefined,highlight);}
    catch(error){return{ok:false,error:error instanceof Error?error:new GPUError('Object selection failed')};}
  }
  setFaceHighlight(highlight:MeshFaceHighlight|null):UpdateResult{
    try{this.live();if(highlight===undefined)throw new GPUError('Use null to clear highlight');if(!this.accepted!.mesh)throw new GPUError('Viewport is empty');return this.update(this.accepted!.mesh.packet,this.accepted!.options,undefined,highlight);}
    catch(error){return{ok:false,error:error instanceof Error?error:new GPUError('Highlight update failed')};}
  }
  resize(width: number, height: number): void {
    this.live(); this.dimensions(width, height);
    let candidate: Resources | null = null;
    const previous = this.accepted!;
    try {
      candidate = this.create(previous.mesh, previous.options, width, height, previous.edges, previous.highlight, previous.objectHighlight);
      this.canvas.width = width; this.canvas.height = height;
      if (this.gl.drawingBufferWidth !== width || this.gl.drawingBufferHeight !== height) throw new GPUError('Requested mesh buffer allocation failed');
      this.present(candidate); this.accepted = candidate; this.release(previous);
    } catch (error) {
      if (candidate) this.release(candidate);
      this.canvas.width = previous.width; this.canvas.height = previous.height;
      if (!this.gl.isContextLost()) this.present(previous);
      throw error;
    }
  }
  readPixels(): Uint8Array {
    this.live(); const gl = this.gl;
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4); gl.pixelStorei(gl.PACK_ROW_LENGTH, 0); gl.pixelStorei(gl.PACK_SKIP_ROWS, 0); gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.check(); return pixels;
  }
  private release(resources: Resources): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      if ([resources.program, resources.edgeProgram].includes(gl.getParameter(gl.CURRENT_PROGRAM))) gl.useProgram(null);
      if ([resources.vao, resources.edgeVao].includes(gl.getParameter(gl.VERTEX_ARRAY_BINDING))) gl.bindVertexArray(null);
      for (const target of [gl.READ_FRAMEBUFFER, gl.DRAW_FRAMEBUFFER]) {
        if (resources.framebuffer && gl.getParameter(target === gl.READ_FRAMEBUFFER ? gl.READ_FRAMEBUFFER_BINDING : gl.DRAW_FRAMEBUFFER_BINDING) === resources.framebuffer) gl.bindFramebuffer(target, null);
      }
    }
    if (resources.framebuffer) gl.deleteFramebuffer(resources.framebuffer);
    if (resources.depth) gl.deleteRenderbuffer(resources.depth);
    if (resources.color) gl.deleteTexture(resources.color);
    resources.buffers.forEach(buffer => gl.deleteBuffer(buffer));
    if (resources.vao) gl.deleteVertexArray(resources.vao);
    if (resources.program) gl.deleteProgram(resources.program);
    if (resources.edgeVao) gl.deleteVertexArray(resources.edgeVao);
    if (resources.edgeProgram) gl.deleteProgram(resources.edgeProgram);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.canvas.removeEventListener('webglcontextlost', this.onLoss);
    if (this.accepted) this.release(this.accepted); this.accepted = null;
  }
}
export function mountMesh(canvas: HTMLCanvasElement, packet: PreviewPacket, options: MeshOptions, overlay?: MeshEdgeOverlay | null, highlight?:MeshFaceHighlight|null): MeshRenderer { return new MeshRenderer(canvas, packet, options, overlay, highlight); }
