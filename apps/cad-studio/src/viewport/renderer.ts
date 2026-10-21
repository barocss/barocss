// WebGL2 renderer for the studio viewport.
// Pipeline: MSAA scene pass (background, grid, contact shadow, clay-shaded bodies, wide crease
// edges) → resolve colour + depth → screen-space ambient occlusion composite to the canvas.
// An ID pass serves face picking. Resources persist: camera moves only write uniforms and
// selection changes only rewrite small state buffers.
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { OrbitCamera } from './camera';

export interface FaceRef { body: number; face: number }
export interface EdgeRef { body: number; edge: number }
export interface ViewState {
  hoverFace: FaceRef | null; hoverEdge: EdgeRef | null;
  selectedFaces: FaceRef[]; selectedEdges: EdgeRef[]; selectedBodies: number[];
  offsets: Map<number, Vec3>;
  /** Bodies shown moved by a matrix (column-major 4 × 4) while a gizmo drags them (WebGPU; WebGL2 shows its move only). */
  transforms?: Map<number, Float64Array>;
  ghostBodies: Set<number>;
  /** Bodies' own colours (0…1 RGB) in the modelling view, by index; the rest are the theme's grey. */
  bodyColors?: Map<number, [number, number, number]>;
  /** Colours of single faces, by body and face index (WebGPU only). */
  faceColors?: Map<number, Map<number, [number, number, number]>>;
  /** Bodies hidden in the browser: not drawn, not picked. */
  hiddenBodies?: Set<number>;
  /** A body pointed at elsewhere (its row in the browser): lit a little, as a hover. */
  hoverBody?: number;
}
export type ThemeName = 'dark' | 'light';
/** A placed instance as the viewport draws it: its bodies (as placed) and the cosmetic thread rings on them (line segments). */
export interface InstanceItem { id: string; bodies: BodyResult[]; threads?: Float32Array }
/** What the viewport draws with: the WebGL2 Renderer here, or the WebGPU one (gpuRenderer.ts). */
export interface ViewRenderer {
  /** Host-driven frames (GPU viewer): its own frame requests go here instead of to its own animation frame (PERF3 A2). */
  setRequestHost?(request: () => void): void;
  aoEnabled: boolean;
  /** While the camera moves: ambient occlusion is left out (it comes back, unchanged, when the camera stops). */
  interacting: boolean;
  setTheme(name: ThemeName): void;
  setBodies(results: BodyResult[]): void;
  setState(view: ViewState): void;
  render(camera: OrbitCamera, view: ViewState): void;
  pickFace(x: number, y: number, camera: OrbitCamera, view: ViewState): FaceRef | null;
  pickEdge(x: number, y: number, camera: OrbitCamera, view: ViewState, radius?: number): EdgeRef | null;
  bounds(): { min: Vec3; max: Vec3 } | null;
  dispose?(): void;
  /** Render settings (the Render workspace; WebGPU only). */
  setRender?(settings: import('@barocss/cad-model/engine/render').RenderSettings | null): void;
  /** The frame as a PNG (WebGPU only). */
  capture?(): Promise<Blob>;
  /** Zebra stripes or the curvature map on the bodies (WebGPU only; null: off). */
  setAnalysis?(mode: import('./analysis').Analysis | null): void;
  /** Cosmetic thread rings (line segments, WebGPU only). */
  setThreads?(lines: Float32Array): void;
  /** See-through tool regions (a hole's whole cylinder) as a mesh and its rims (WebGPU only). */
  setRegions?(mesh: ReturnType<typeof import('@barocss/cad-model/app/holeRegion').regionMesh> | null): void;
  /** Direct curves and surfaces (WebGPU only), and the one under a point. */
  setDirect?(items: import('@barocss/cad-model/engine/direct').DirectDisplay[], selected: readonly string[]): void;
  pickDirect?(x: number, y: number, camera: OrbitCamera): string | null;
  /** Placed instances of other parts (WebGPU only), and the one under a point. */
  setInstances?(items: InstanceItem[], selected: readonly string[]): void;
  /** Instances shown moved by a matrix each (column-major 4 × 4; posed, exploded), the rest as placed (G1). */
  setInstanceTransforms?(transforms: ReadonlyMap<string, Float64Array> | null): void;
  pickInstance?(x: number, y: number, camera: OrbitCamera): string | null;
  pickInstanceFace?(x: number, y: number, camera: OrbitCamera): { id: string; body: number; face: number } | null;
  setInstanceFaces?(faces: readonly { id: string; body: number; face: number }[]): void;
  /** One instance shown moved by a matrix (column-major 4 × 4) while it is dragged; null: as placed. */
  setInstancePreview?(preview: { id: string; matrix: Float64Array } | null): void;
}

interface Theme { amb: number; bgTop: number[]; bgBottom: number[]; grid: number[]; gridAlpha: number[]; base: number[]; edge: number[]; shadow: number; ao: number }
const THEMES: Record<ThemeName, Theme> = {
  dark: { amb: 0.18, bgTop: [0.180, 0.188, 0.208], bgBottom: [0.094, 0.098, 0.106], grid: [0.55, 0.55, 0.57], gridAlpha: [0.12, 0.26], base: [0.74, 0.75, 0.78], edge: [0.05, 0.05, 0.06], shadow: 0.55, ao: 0.85 },
  light: { amb: 0.34, bgTop: [0.965, 0.972, 0.980], bgBottom: [0.780, 0.812, 0.851], grid: [0.30, 0.34, 0.40], gridAlpha: [0.10, 0.22], base: [0.70, 0.74, 0.80], edge: [0.11, 0.14, 0.19], shadow: 0.32, ao: 0.75 },
};

const MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in float aFace; layout(location=3) in float aState;
uniform mat4 uVP; uniform mat4 uView; uniform vec3 uOffset;
out vec3 vVN; out float vState; flat out float vFace;
void main(){ vec3 p=aPos+uOffset; vVN=mat3(uView)*aNor; vState=aState; vFace=aFace; gl_Position=uVP*vec4(p,1.0); }`;

const MESH_FS = `#version 300 es
precision highp float;
in vec3 vVN; in float vState; flat in float vFace;
uniform vec3 uBase; uniform float uAmb; uniform float uBodySel; uniform float uGhost; uniform float uPick; uniform float uBodyId;
out vec4 o;
void main(){
  if(uPick>0.5){ float id=uBodyId*4096.0+vFace+1.0; o=vec4(mod(id,256.0)/255.0, mod(floor(id/256.0),256.0)/255.0, floor(id/65536.0)/255.0, 1.0); return; }
  vec3 n=normalize(vVN); if(!gl_FrontFacing) n=-n;
  float hemi=0.5+0.5*n.y;
  vec3 key=normalize(vec3(-0.45,0.55,0.70)); vec3 fill=normalize(vec3(0.6,-0.2,0.5));
  float k=max(dot(n,key),0.0), f=max(dot(n,fill),0.0);
  float rim=pow(1.0-max(n.z,0.0),3.0);
  vec3 h=normalize(key+vec3(0.0,0.0,1.0)); float spec=pow(max(dot(n,h),0.0),48.0);
  vec3 c=uBase*(uAmb+0.26*hemi+0.58*k+0.10*f)+vec3(0.08)*rim+vec3(0.10)*spec;
  vec3 accent=vec3(0.910,0.761,0.353);
  c=mix(c, accent, max(uBodySel*0.22, step(1.5,vState)*0.42));
  c=mix(c, accent, step(0.5,vState)*(1.0-step(1.5,vState))*0.20);
  o=vec4(c, 1.0-uGhost*0.65);
}`;

// Wide lines: one instance per segment, expanded to a screen-space quad.
const LINE_VS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aA; layout(location=2) in vec3 aB; layout(location=3) in float aState;
uniform mat4 uVP; uniform vec3 uOffset; uniform vec2 uViewport; uniform float uWidth; out float vState;
void main(){
  vState=aState;
  vec4 a=uVP*vec4(aA+uOffset,1.0), b=uVP*vec4(aB+uOffset,1.0);
  vec2 sa=a.xy/a.w*uViewport, sb=b.xy/b.w*uViewport; vec2 d=sb-sa; float l=length(d);
  vec2 dir=l>1e-6? d/l : vec2(1.0,0.0); vec2 nrm=vec2(-dir.y,dir.x);
  float w=uWidth*(aState>1.5?2.4:(aState>0.5?1.9:1.0));
  vec4 p=mix(a,b,aCorner.x);
  p.xy+=nrm*aCorner.y*w/uViewport*p.w;
  p.z-=0.00008*p.w;
  gl_Position=p;
}`;

const LINE_FS = `#version 300 es
precision highp float; in float vState; uniform vec4 uColor; out vec4 o;
void main(){ vec3 c=uColor.rgb; float a=uColor.a; if(vState>1.5){c=vec3(1.0,0.84,0.36);a=1.0;} else if(vState>0.5){c=vec3(0.95,0.78,0.36);a=1.0;} o=vec4(c,a); }`;

const GRID_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in float aMajor;
uniform mat4 uVP; out float vMajor; out vec3 vW;
void main(){ vMajor=aMajor; vW=aPos; gl_Position=uVP*vec4(aPos,1.0); }`;

const GRID_FS = `#version 300 es
precision highp float; in float vMajor; in vec3 vW; uniform vec3 uCenter; uniform float uFade; uniform vec3 uGrid; uniform vec2 uGridAlpha; out vec4 o;
void main(){
  float d=length(vW.xy-uCenter.xy)/uFade; float fade=clamp(1.0-d,0.0,1.0);
  vec3 c=vMajor>1.5? (vMajor>2.5? vec3(0.39,0.75,0.45) : vec3(0.88,0.36,0.33)) : uGrid;
  float a=vMajor>1.5?0.8:(vMajor>0.8?uGridAlpha.y:uGridAlpha.x);
  o=vec4(c,a*fade);
}`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aXY; uniform mat4 uVP; uniform vec4 uRect; uniform float uZ; out vec2 vUV;
void main(){ vUV=aXY; vec2 p=mix(uRect.xy,uRect.zw,aXY*0.5+0.5); gl_Position=uVP*vec4(p,uZ,1.0); }`;

const SHADOW_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform float uAlpha; out vec4 o;
void main(){ float r=length(vUV); float a=smoothstep(1.0,0.1,r)*uAlpha; o=vec4(0.0,0.0,0.0,a); }`;

const FULL_VS = `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0)); out vec2 vUV;
void main(){ vUV=P[gl_VertexID]*0.5+0.5; gl_Position=vec4(P[gl_VertexID],0.9999,1.0); }`;

const BG_FS = `#version 300 es
precision highp float; in vec2 vUV; uniform vec3 uTop; uniform vec3 uBottom; out vec4 o;
void main(){ vec3 c=mix(uBottom,uTop,vUV.y); float v=length(vUV-vec2(0.5,0.6)); c*=1.0-0.14*v*v; o=vec4(c,1.0); }`;

// Depth-only SSAO: samples a spiral around each pixel and darkens where nearby geometry is in front.
const AO_FS = `#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uColor; uniform sampler2D uDepth; uniform vec2 uTexel; uniform float uNear; uniform float uFar; uniform float uOrtho;
uniform float uRadius; uniform float uFocal; uniform float uStrength; out vec4 o;
float lin(float d){ if(uOrtho>0.5) return uNear+d*(uFar-uNear); float z=d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }
void main(){
  vec4 c=texture(uColor,vUV); float d0=texture(uDepth,vUV).r;
  if(d0>=0.99999){ o=c; return; }
  float z0=lin(d0); float px=clamp(uRadius*uFocal/max(z0,1e-3), 2.0, 48.0);
  // Local plane from the smaller one-sided depth difference, so flat surfaces do not self-occlude.
  float zr=lin(texture(uDepth,vUV+vec2(uTexel.x,0.0)).r), zl=lin(texture(uDepth,vUV-vec2(uTexel.x,0.0)).r);
  float zu=lin(texture(uDepth,vUV+vec2(0.0,uTexel.y)).r), zd=lin(texture(uDepth,vUV-vec2(0.0,uTexel.y)).r);
  float gx=abs(zr-z0)<abs(z0-zl)? zr-z0 : z0-zl; float gy=abs(zu-z0)<abs(z0-zd)? zu-z0 : z0-zd;
  float occ=0.0; const int N=16;
  for(int i=0;i<N;i++){
    float t=(float(i)+0.5)/float(N); float ang=float(i)*2.39996; float r=sqrt(t)*px;
    vec2 off=vec2(cos(ang),sin(ang))*r; vec2 uv=vUV+off*uTexel;
    float ds=texture(uDepth,uv).r; if(ds>=0.99999) continue;
    float zs=lin(ds); float expected=z0+gx*off.x+gy*off.y; float diff=expected-zs;
    occ+=smoothstep(0.10*uRadius,0.55*uRadius,diff)*(1.0-smoothstep(1.5*uRadius,3.0*uRadius,diff));
  }
  float ao=1.0-uStrength*occ/float(N);
  o=vec4(c.rgb*ao,1.0);
}`;

interface GpuBody {
  vao: WebGLVertexArrayObject; count: number; state: WebGLBuffer; stateData: Float32Array;
  lineVao: WebGLVertexArrayObject; segments: number; lineState: WebGLBuffer; lineStateData: Float32Array;
  buffers: WebGLBuffer[]; result: BodyResult;
}

export class Renderer implements ViewRenderer {
  readonly gl: WebGL2RenderingContext;
  private mesh: WebGLProgram; private line: WebGLProgram; private grid: WebGLProgram; private shadow: WebGLProgram; private bg: WebGLProgram; private ao: WebGLProgram;
  private bodies: GpuBody[] = [];
  private gridVao: WebGLVertexArrayObject; private gridCount = 0;
  private quadVao: WebGLVertexArrayObject; private corner: WebGLBuffer; private emptyVao: WebGLVertexArrayObject;
  private pickFbo: WebGLFramebuffer | null = null; private pickTex: WebGLTexture | null = null; private pickDepth: WebGLRenderbuffer | null = null;
  private pickSize = [0, 0];
  private msFbo: WebGLFramebuffer | null = null; private msColor: WebGLRenderbuffer | null = null; private msDepth: WebGLRenderbuffer | null = null;
  private rsFbo: WebGLFramebuffer | null = null; private rsColor: WebGLTexture | null = null; private rsDepth: WebGLTexture | null = null;
  private targetSize = [0, 0]; private samples: number;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private theme: Theme = THEMES.dark;
  aoEnabled = true;
  interacting = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    this.mesh = this.program(MESH_VS, MESH_FS); this.line = this.program(LINE_VS, LINE_FS);
    this.grid = this.program(GRID_VS, GRID_FS); this.shadow = this.program(QUAD_VS, SHADOW_FS);
    this.bg = this.program(FULL_VS, BG_FS); this.ao = this.program(FULL_VS, AO_FS);
    this.gridVao = this.buildGrid(); this.quadVao = this.buildQuad();
    this.corner = this.buffer(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
    this.emptyVao = gl.createVertexArray()!;
  }

  setTheme(name: ThemeName) { this.theme = THEMES[name]; }

  private program(vs: string, fs: string) {
    const gl = this.gl; const p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
    return p;
  }

  private u(p: WebGLProgram, name: string) {
    let m = this.uniforms.get(p); if (!m) { m = new Map(); this.uniforms.set(p, m); }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  private buffer(data: ArrayBufferView, target: number = this.gl.ARRAY_BUFFER, usage: number = this.gl.STATIC_DRAW) {
    const gl = this.gl; const b = gl.createBuffer()!; gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b;
  }

  private attr(location: number, buffer: WebGLBuffer, size: number, stride = 0, offset = 0, divisor = 0) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset); gl.vertexAttribDivisor(location, divisor);
  }

  private buildGrid() {
    const gl = this.gl; const p: number[] = [], m: number[] = []; const R = 500;
    for (let v = -R; v <= R; v += 10) {
      const major = v === 0 ? 0 : v % 50 === 0 ? 1 : 0.6;
      p.push(v, -R, 0, v, R, 0, -R, v, 0, R, v, 0); m.push(major, major, major, major);
    }
    p.push(0, 0, 0, R, 0, 0, 0, 0, 0, 0, R, 0); m.push(2, 2, 3, 3);
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    this.attr(0, this.buffer(new Float32Array(p)), 3); this.attr(1, this.buffer(new Float32Array(m)), 1);
    gl.bindVertexArray(null); this.gridCount = p.length / 3; return vao;
  }

  private buildQuad() {
    const gl = this.gl; const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    this.attr(0, this.buffer(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])), 2);
    gl.bindVertexArray(null); return vao;
  }

  setBodies(results: BodyResult[]) {
    const gl = this.gl;
    for (const b of this.bodies) { gl.deleteVertexArray(b.vao); gl.deleteVertexArray(b.lineVao); b.buffers.forEach(x => gl.deleteBuffer(x)); }
    this.bodies = results.map(result => {
      const m = result.mesh;
      const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
      const pos = this.buffer(m.positions), nor = this.buffer(m.normals), face = this.buffer(m.faceOfVertex);
      const stateData = new Float32Array(m.positions.length / 3); const state = this.buffer(stateData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      this.attr(0, pos, 3); this.attr(1, nor, 3); this.attr(2, face, 1); this.attr(3, state, 1);
      const idx = this.buffer(m.indices, gl.ELEMENT_ARRAY_BUFFER);
      const segments = m.edgeLines.length / 6;
      const lineVao = gl.createVertexArray()!; gl.bindVertexArray(lineVao);
      const segs = this.buffer(m.edgeLines); const lineStateData = new Float32Array(segments);
      const lineState = this.buffer(lineStateData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      this.attr(0, this.corner, 2);
      this.attr(1, segs, 3, 24, 0, 1); this.attr(2, segs, 3, 24, 12, 1); this.attr(3, lineState, 1, 0, 0, 1);
      gl.bindVertexArray(null);
      return { vao, count: m.indices.length, state, stateData, lineVao, segments, lineState, lineStateData, buffers: [pos, nor, face, state, idx, segs, lineState], result };
    });
  }

  /** Rewrites only the per-vertex / per-segment state buffers (hover = 1, selected = 2). */
  setState(view: ViewState) {
    const gl = this.gl;
    this.bodies.forEach((b, bi) => {
      const m = b.result.mesh; b.stateData.fill(0); b.lineStateData.fill(0);
      const faceState = new Map<number, number>();
      if (view.hoverFace?.body === bi) faceState.set(view.hoverFace.face, 1);
      for (const f of view.selectedFaces) if (f.body === bi) faceState.set(f.face, 2);
      if (faceState.size) for (let v = 0; v < b.stateData.length; v++) b.stateData[v] = faceState.get(m.faceOfVertex[v]) ?? 0;
      const edgeState = new Map<number, number>();
      if (view.hoverEdge?.body === bi) edgeState.set(view.hoverEdge.edge, 1);
      for (const e of view.selectedEdges) if (e.body === bi) edgeState.set(e.edge, 2);
      if (edgeState.size) for (let s = 0; s < b.lineStateData.length; s++) b.lineStateData[s] = edgeState.get(m.edgeOfSegment[s * 2]) ?? 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.state); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.stateData);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.lineState); gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.lineStateData);
    });
  }

  resize(): [number, number] {
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    return [w, h];
  }

  private ensureTargets(w: number, h: number) {
    const gl = this.gl;
    if (this.msFbo && this.targetSize[0] === w && this.targetSize[1] === h) return;
    if (this.msFbo) { gl.deleteFramebuffer(this.msFbo); gl.deleteRenderbuffer(this.msColor); gl.deleteRenderbuffer(this.msDepth); gl.deleteFramebuffer(this.rsFbo); gl.deleteTexture(this.rsColor); gl.deleteTexture(this.rsDepth); }
    this.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msColor); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
    this.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.msDepth); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
    this.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.msDepth);
    const tex = (internal: number, format: number, type: number) => {
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
    };
    this.rsColor = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); this.rsDepth = tex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    this.rsFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.rsFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.rsColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.rsDepth, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.targetSize = [w, h];
  }

  private sceneBounds(): { min: Vec3; max: Vec3 } | null {
    if (!this.bodies.length) return null;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const b of this.bodies) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.result.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.result.mesh.bounds.max[k]); }
    return { min, max };
  }

  render(camera: OrbitCamera, view: ViewState) {
    const gl = this.gl; const [w, h] = this.resize(); const t = this.theme;
    camera.aspect = w / h;
    this.ensureTargets(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const vp = camera.viewProjection(), viewM = camera.view();
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this.bg);
    gl.uniform3fv(this.u(this.bg, 'uTop'), t.bgTop); gl.uniform3fv(this.u(this.bg, 'uBottom'), t.bgBottom);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.grid); gl.uniformMatrix4fv(this.u(this.grid, 'uVP'), false, vp);
    gl.uniform3fv(this.u(this.grid, 'uCenter'), camera.target); gl.uniform1f(this.u(this.grid, 'uFade'), Math.max(120, camera.distance * 1.6));
    gl.uniform3fv(this.u(this.grid, 'uGrid'), t.grid); gl.uniform2fv(this.u(this.grid, 'uGridAlpha'), t.gridAlpha);
    gl.bindVertexArray(this.gridVao); gl.drawArrays(gl.LINES, 0, this.gridCount);
    const bounds = this.sceneBounds();
    if (bounds) {
      const cx = (bounds.min[0] + bounds.max[0]) / 2, cy = (bounds.min[1] + bounds.max[1]) / 2;
      const rx = (bounds.max[0] - bounds.min[0]) * 0.75 + 6, ry = (bounds.max[1] - bounds.min[1]) * 0.75 + 6;
      gl.useProgram(this.shadow); gl.uniformMatrix4fv(this.u(this.shadow, 'uVP'), false, vp); gl.uniform1f(this.u(this.shadow, 'uAlpha'), t.shadow);
      gl.uniform4f(this.u(this.shadow, 'uRect'), cx - rx, cy - ry, cx + rx, cy + ry); gl.uniform1f(this.u(this.shadow, 'uZ'), bounds.min[2] - 0.05);
      gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.depthMask(true);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.useProgram(this.mesh);
    gl.uniformMatrix4fv(this.u(this.mesh, 'uVP'), false, vp); gl.uniformMatrix4fv(this.u(this.mesh, 'uView'), false, viewM);
    gl.uniform1f(this.u(this.mesh, 'uPick'), 0); gl.uniform3fv(this.u(this.mesh, 'uBase'), t.base); gl.uniform1f(this.u(this.mesh, 'uAmb'), t.amb);
    const order = this.bodies.map((_, i) => i).sort((a, b) => Number(view.ghostBodies.has(a)) - Number(view.ghostBodies.has(b)));
    for (const bi of order) {
      if (view.hiddenBodies?.has(bi)) continue;
      const b = this.bodies[bi]; const ghost = view.ghostBodies.has(bi);
      gl.depthMask(!ghost);
      gl.uniform3fv(this.u(this.mesh, 'uOffset'), view.offsets.get(bi) ?? [0, 0, 0]);
      gl.uniform1f(this.u(this.mesh, 'uBodySel'), view.selectedBodies.includes(bi) ? 1 : view.hoverBody === bi ? 0.55 : 0);
      gl.uniform1f(this.u(this.mesh, 'uGhost'), ghost ? 1 : 0);
      gl.uniform3fv(this.u(this.mesh, 'uBase'), view.bodyColors?.get(bi) ?? t.base);
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    }
    gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL);
    const dpr = w / Math.max(1, this.canvas.clientWidth);
    gl.useProgram(this.line); gl.uniformMatrix4fv(this.u(this.line, 'uVP'), false, vp);
    gl.uniform2f(this.u(this.line, 'uViewport'), w / 2, h / 2); gl.uniform1f(this.u(this.line, 'uWidth'), 0.62 * dpr);
    for (const [bi, b] of this.bodies.entries()) {
      if (view.hiddenBodies?.has(bi)) continue;
      gl.uniform3fv(this.u(this.line, 'uOffset'), view.offsets.get(bi) ?? [0, 0, 0]);
      gl.uniform4f(this.u(this.line, 'uColor'), t.edge[0], t.edge[1], t.edge[2], view.ghostBodies.has(bi) ? 0.35 : 0.9);
      gl.bindVertexArray(b.lineVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.segments);
    }
    gl.disable(gl.BLEND);
    // Resolve MSAA colour + depth, then composite with ambient occlusion.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.rsFbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.ao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.rsColor); gl.uniform1i(this.u(this.ao, 'uColor'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.rsDepth); gl.uniform1i(this.u(this.ao, 'uDepth'), 1);
    gl.uniform2f(this.u(this.ao, 'uTexel'), 1 / w, 1 / h);
    gl.uniform1f(this.u(this.ao, 'uNear'), camera.near()); gl.uniform1f(this.u(this.ao, 'uFar'), camera.far()); gl.uniform1f(this.u(this.ao, 'uOrtho'), camera.ortho ? 1 : 0);
    const size = bounds ? Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]) : 50;
    gl.uniform1f(this.u(this.ao, 'uRadius'), Math.max(1, size * 0.045));
    gl.uniform1f(this.u(this.ao, 'uFocal'), camera.ortho ? h / (2 * camera.distance * Math.tan(camera.fovY / 2)) * camera.distance : h / (2 * Math.tan(camera.fovY / 2)));
    gl.uniform1f(this.u(this.ao, 'uStrength'), this.aoEnabled && !this.interacting ? t.ao : 0);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  }

  /** GPU face pick at CSS pixel (x, y). */
  pickFace(x: number, y: number, camera: OrbitCamera, view: ViewState): FaceRef | null {
    const gl = this.gl; const [w, h] = [this.canvas.width, this.canvas.height];
    if (!this.pickFbo || this.pickSize[0] !== w || this.pickSize[1] !== h) {
      if (this.pickFbo) { gl.deleteFramebuffer(this.pickFbo); gl.deleteTexture(this.pickTex); gl.deleteRenderbuffer(this.pickDepth); }
      this.pickTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.pickTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      this.pickDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      this.pickFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickDepth);
      this.pickSize = [w, h];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(this.mesh);
    gl.uniformMatrix4fv(this.u(this.mesh, 'uVP'), false, camera.viewProjection()); gl.uniformMatrix4fv(this.u(this.mesh, 'uView'), false, camera.view());
    gl.uniform1f(this.u(this.mesh, 'uPick'), 1);
    this.bodies.forEach((b, bi) => {
      if (view.ghostBodies.has(bi) || view.hiddenBodies?.has(bi)) return;
      gl.uniform3fv(this.u(this.mesh, 'uOffset'), view.offsets.get(bi) ?? [0, 0, 0]); gl.uniform1f(this.u(this.mesh, 'uBodyId'), bi);
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    });
    const dpr = w / this.canvas.clientWidth; const px = new Uint8Array(4);
    gl.readPixels(Math.floor(x * dpr), Math.floor(h - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
    const id = px[0] + px[1] * 256 + px[2] * 65536;
    if (!id) return null;
    return { body: Math.floor((id - 1) / 4096), face: (id - 1) % 4096 };
  }

  /** CPU edge pick: nearest crease edge within `radius` CSS px. */
  pickEdge(x: number, y: number, camera: OrbitCamera, view: ViewState, radius = 6): EdgeRef | null {
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight; let best: EdgeRef | null = null; let bestD = radius;
    this.bodies.forEach((b, bi) => {
      if (view.ghostBodies.has(bi) || view.hiddenBodies?.has(bi)) return;
      const o = view.offsets.get(bi) ?? [0, 0, 0]; const L = b.result.mesh.edgeLines; const E = b.result.mesh.edgeOfSegment;
      for (let s = 0; s < L.length; s += 6) {
        const p = camera.project([L[s] + o[0], L[s + 1] + o[1], L[s + 2] + o[2]], cw, ch);
        const q = camera.project([L[s + 3] + o[0], L[s + 4] + o[1], L[s + 5] + o[2]], cw, ch);
        const d = segDist(x, y, p[0], p[1], q[0], q[1]);
        if (d < bestD) { bestD = d; best = { body: bi, edge: E[s / 3] }; }
      }
    });
    return best;
  }

  bounds() { return this.sceneBounds(); }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
