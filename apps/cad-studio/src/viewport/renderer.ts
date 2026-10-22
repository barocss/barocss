// WebGL2 renderer for the studio viewport.
// Pipeline: MSAA scene pass (background, grid, contact shadow, clay-shaded bodies, wide crease
// edges) → resolve colour + depth → screen-space ambient occlusion composite to the canvas.
// An ID pass serves face picking. Resources persist: camera moves only write uniforms and
// selection changes only rewrite small state buffers.
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { OrbitCamera } from './camera';
import { invert, multiply } from '@barocss/gpu/viewer';
import { topologyKey, movedCopy } from './instanceGeometry';
import { silhouetteLines } from './silhouette';
import { ClearanceOverlayGL } from './clearanceOverlayGL';
import type { ClearanceDisplay } from './clearanceDisplay';
import type { PrintDisplay } from './printDisplay';
import { PrintOverlayGL } from './printOverlayGL';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';

export interface FaceRef { body: number; face: number }
export interface EdgeRef { body: number; edge: number }
export type DisplayMode = 'shaded-with-edges' | 'hidden-lines-removed' | 'hidden-lines-dashed' | 'wireframe' | 'x-ray';
export interface DisplayModeStatus { requested: DisplayMode; effective: DisplayMode; supported: boolean; reason?: string }
export const lineDisplayMode = (mode: DisplayMode): boolean => mode === 'hidden-lines-removed' || mode === 'hidden-lines-dashed' || mode === 'wireframe';
/** Unsupported requests preserve the last effective appearance and leave geometry/clip state alone. */
export function displayModeStatus(view: Pick<ViewState, 'displayMode' | 'displayModeUnsupported'>, previous: DisplayMode, localReason?: string): DisplayModeStatus {
  const requested = view.displayMode ?? 'shaded-with-edges';
  const known = ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray'].includes(requested);
  const reason = !known ? 'Unknown CAD display mode.' : requested === 'shaded-with-edges' ? undefined : view.displayModeUnsupported ?? localReason;
  return { requested, effective: reason ? previous : requested, supported: !reason, ...(reason ? { reason } : {}) };
}
export interface ViewState {
  /** Appearance only: leaves document, geometry and picking authority unchanged. */
  displayMode?: DisplayMode;
  /** Scope guard from the viewport for combinations an adapter cannot observe. */
  displayModeUnsupported?: string;
  hoverFace: FaceRef | null; hoverEdge: EdgeRef | null;
  selectedFaces: FaceRef[]; selectedEdges: EdgeRef[]; selectedBodies: number[];
  offsets: Map<number, Vec3>;
  /** Bodies shown moved by a matrix (column-major 4 × 4) while a gizmo drags them (its turn too, on WebGL2 as well: G16). */
  transforms?: Map<number, Float64Array>;
  ghostBodies: Set<number>;
  /** Session-only focus: other solids fade and have no pick authority. */
  isolatedInstances?: readonly string[];
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
/**
 * A placed part's bodies (in the world, as placed) and thread rings; with its placement (column-major 4 × 4), copies of the
 * same tessellation share one geometry, drawn through the placements' difference (G10).
 */
export interface InstanceItem {
  id: string; bodies: BodyResult[]; threads?: Float32Array; placement?: Float64Array;
  /** CPU section packet provenance; absent means the original body/face/edge ordinal. */
  sourceBodies?: readonly number[];
  sourceFaces?: readonly (readonly number[])[];
  sourceEdges?: readonly (readonly number[])[];
  hatch?: SectionHatch;
}
/** The mould as the viewport shows it (G6): the loops (world polylines), the halves' bodies, the pull and the spread. */
export interface MouldShown { pull: Vec3; loops: { points: Vec3[]; closed: boolean }[]; plus: BodyResult[]; minus: BodyResult[]; spread: number }
/** A section's planes on the GPU (G2, G19): kept where dot(normal, p) ≥ offset for each; `bodies`: the part's bodies cut by them too (not yet exact). */
/** A proposal's added and removed material (G12): the view triad's green and red. */
export const PROPOSAL_ADDED = '#57b26b', PROPOSAL_REMOVED = '#e5534b';
/** World points for an overlay (G8): a colour each (sRGB 0–1, rgb) or one; size and border in CSS pixels. */
export interface OverlayPoints {
  positions: ArrayLike<number>;
  colors?: ArrayLike<number>;
  color?: string;
  size: number;
  shape?: 'circle' | 'square';
  border?: { width: number; color: string };
  opacity?: number;
  over?: boolean;
  hidden?: number;
}
/**
 * Text labels for an overlay (G15): each at a world point, sized in CSS pixels (or on a plane, in world units); one look
 * for the set — a colour, a chip behind each (fill and border), its opacity and depth rule as the overlay lines'.
 */
export interface OverlayLabels {
  labels: { text: string; at: ArrayLike<number>; size?: number; align?: readonly [number, number]; offset?: readonly [number, number]; plane?: { right: ArrayLike<number>; up: ArrayLike<number> } | null }[];
  color: string;
  chip?: { fill: string; border?: string; padding?: number } | null;
  opacity?: number;
  over?: boolean;
  hidden?: number;
}
/** World line segments for an overlay (G7): six numbers a segment; a colour (CSS, sRGB), a width and dashes in CSS pixels. */
export interface OverlayLines {
  segments: ArrayLike<number>;
  color: string;
  width: number;
  opacity?: number;
  dash?: readonly [number, number];
  /** Drawn over the scene, not hidden by surfaces (the SubD cage, the thing edited). */
  over?: boolean;
  /** Its parts behind surfaces drawn too, at this share of its opacity (0 – 1; default 0: hidden). */
  hidden?: number;
}
/** The section's planes on the GPU (G2, G19); `hatch`: the caps' hatch spacing (mm, G19.3), null for none. */
export interface SectionClip { planes: { normal: Vec3; offset: number }[]; bodies: boolean; hatch?: number | null; /** A cut-out (G20): kept on any plane's kept side. */ cutout?: boolean }
/** The hatch on the cut drawn as lines (G19.3): each body's (by its index) segments, six numbers each. */
export type SectionHatch = readonly { body: number; segments: Float32Array }[];
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
  /** Current-pose assembly analysis, separate from native bodies and picking; null clears it. */
  setClearanceDisplay?(display: ClearanceDisplay | null): void;
  /** Model print-layer output in bed coordinates, independent of native geometry and IDs. */
  setPrintDisplay?(display: PrintDisplay | null): void;
  getDisplayModeStatus?(): DisplayModeStatus;
  render(camera: OrbitCamera, view: ViewState): void;
  pickFace(x: number, y: number, camera: OrbitCamera, view: ViewState): FaceRef | null;
  pickEdge(x: number, y: number, camera: OrbitCamera, view: ViewState, radius?: number): EdgeRef | null;
  bounds(): { min: Vec3; max: Vec3 } | null;
  dispose?(): void;
  /** Render settings (the Render workspace; WebGPU only). */
  setRender?(settings: import('@barocss/cad-model/engine/render').RenderSettings | null): void;
  /** The frame as a PNG. */
  capture?(): Promise<Blob>;
  /** Zebra stripes or the curvature map on the bodies (WebGPU only; null: off). */
  setAnalysis?(mode: import('./analysis').Analysis | null): void;
  /** Cosmetic thread rings (line segments, WebGPU only). */
  setThreads?(lines: Float32Array): void;
  /** See-through tool regions (a hole's whole cylinder) as a mesh and its rims (WebGPU only). */
  setRegions?(mesh: ReturnType<typeof import('@barocss/cad-model/app/holeRegion').regionMesh> | null): void;
  /** Direct curves and surfaces, and the one under a point (WebGL2 too: G16). */
  setDirect?(items: import('@barocss/cad-model/engine/direct').DirectDisplay[], selected: readonly string[]): void;
  pickDirect?(x: number, y: number, camera: OrbitCamera): string | null;
  /** Placed instances of other parts, and the one under a point. */
  setInstances?(items: InstanceItem[], selected: readonly string[]): void;
  /** Instances shown moved by a matrix each (column-major 4 × 4; posed, exploded), the rest as placed (G1). */
  setInstanceTransforms?(transforms: ReadonlyMap<string, Float64Array> | null): void;
  /** The section's clip plane (WebGPU only, G2): the placed parts cut and capped, the part's bodies too when `bodies`. */
  setClip?(clip: SectionClip | null): void;
  /**
   * The hatch on the cut as lines (G19.3): on WebGL2 the clipped bodies' caps, on either the exact section's cut faces — a
   * line 1 CSS pixel wide, the face's colour × 0.45 under it; null none.
   */
  setSectionHatch?(hatch: SectionHatch | null): void;
  /** Analysis maps on the bodies (WebGPU only, G6): each body's scalar field in its colour map; null: the bodies' own look. */
  setScalarMaps?(maps: readonly import('./scalarMaps').ScalarMap[] | null): void;
  /** The map's value under a point (WebGPU only, G6), or null off the mapped bodies. */
  scalarAt?(x: number, y: number, camera: OrbitCamera): number | null;
  /**
   * The mould's view (WebGPU only, G6): its parting loops as lines and its halves see-through, spread apart along the pull
   * by `spread` (mm); while the halves show, picks reach only them (pickHalf), the part's bodies none.
   */
  setMould?(view: MouldShown | null): void;
  /** Isoclines (WebGPU only, G6): world polylines drawn with the draft map, or none. */
  setIsoclines?(lines: readonly { points: readonly Vec3[]; closed: boolean }[] | null): void;
  /**
   * Overlay lines drawn by the engine (WebGPU only, G7) — what were SVG paths projected every frame: world segments under a
   * key, uploaded once and depth-tested (or over the scene); null removes them. Not picked, clipped or counted in the bounds.
   */
  setOverlayLines?(key: string, lines: OverlayLines | null): void;
  /** Overlay points drawn by the engine (WebGPU only, G8): sprites at world points under a key (the overlay lines' keys apart). */
  setOverlayPoints?(key: string, points: OverlayPoints | null): void;
  /**
   * A proposal's diff (G12): the material it adds (green) and takes away (red) as see-through decals over the bodies, with
   * their edges and a volume chip each; null removes them. (Its faces' tint goes through faceColors. WebGL2, G16: the decals
   * and edges, the chips drawn by the viewport's overlay.)
   */
  setProposalOverlay?(view: import('../engine/client').ProposalOverlay | null): void;
  /** Overlay labels drawn by the engine (WebGPU only, G15) under a key — readouts, chips and drawings' texts. */
  setOverlayLabels?(key: string, labels: OverlayLabels | null): void;
  /** The overlay lines and points shown, segments or points a key (G7, G8; for the flow). */
  overlayLines?(): Record<string, number>;
  /** The overlay labels' texts, a key (G15; for the flow). */
  overlayTexts?(): Record<string, string[]>;
  pickHalf?(x: number, y: number, camera: OrbitCamera): { half: '+' | '-'; index: number } | null;
  pickInstance?(x: number, y: number, camera: OrbitCamera): string | null;
  /** Nearest kept surface: original native face, or face -1/cap true for an instance-only generated cap hit. */
  pickInstanceFace?(x: number, y: number, camera: OrbitCamera): { id: string; body: number; face: number; cap?: true } | null;
  pickInstanceEdge?(x: number, y: number, camera: OrbitCamera, radius?: number): { id: string; body: number; edge: number } | null;
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
uniform mat4 uVP; uniform mat4 uView; uniform mat4 uModel; uniform mat3 uNormal;
out vec3 vVN; out float vState; flat out float vFace;
void main(){ vVN=mat3(uView)*(uNormal*aNor); vState=aState; vFace=aFace; gl_Position=uVP*(uModel*vec4(aPos,1.0)); }`;

const MESH_FS = `#version 300 es
precision highp float;
in vec3 vVN; in float vState; flat in float vFace;
uniform vec3 uBase; uniform float uAmb; uniform float uBodySel; uniform float uGhost; uniform float uOpacity;
out vec4 o;
void main(){
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
  o=vec4(c, uOpacity*(1.0-uGhost*0.65));
}`;

// The pick pass: exact base/direct IDs plus an RGBA32 instance lookup; depth retains its existing 24-bit encoding.
const PICK_FS = `#version 300 es
precision highp float;
precision highp int;
flat in float vFace; uniform float uBodyId; uniform float uPickId; uniform uint uInstanceId;
layout(location=0) out vec4 id; layout(location=1) out vec4 depth;
vec4 bytes(float v){ return vec4(mod(v,256.0), mod(floor(v/256.0),256.0), mod(floor(v/65536.0),256.0), floor(v/16777216.0))/255.0; }
void main(){ if(uInstanceId>0u){ uint v=uInstanceId+uint(vFace); id=vec4(float(v&255u),float((v>>8u)&255u),float((v>>16u)&255u),float(v>>24u))/255.0; } else id=bytes(uPickId>0.5? uPickId : uBodyId*4096.0+vFace+1.0); depth=bytes(floor(gl_FragCoord.z*16777215.0+0.5)); }`;

// Wide lines: one instance per segment, expanded to a screen-space quad.
const LINE_VS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aA; layout(location=2) in vec3 aB; layout(location=3) in float aState;
uniform mat4 uVP; uniform mat4 uModel; uniform vec2 uViewport; uniform float uWidth; out float vState;
flat out vec2 vLineOrigin; flat out vec2 vLineDirection;
void main(){
  vState=aState;
  vec4 a=uVP*(uModel*vec4(aA,1.0)), b=uVP*(uModel*vec4(aB,1.0));
  vec2 sa=a.xy/a.w*uViewport, sb=b.xy/b.w*uViewport; vec2 d=sb-sa; float l=length(d);
  vec2 dir=l>1e-6? d/l : vec2(1.0,0.0); vec2 nrm=vec2(-dir.y,dir.x);
  vLineOrigin=sa+uViewport; vLineDirection=dir;
  float w=uWidth*(aState>1.5?2.4:(aState>0.5?1.9:1.0));
  vec4 p=mix(a,b,aCorner.x);
  p.xy+=nrm*aCorner.y*w/uViewport*p.w;
  p.z-=0.00008*p.w;
  gl_Position=p;
}`;

const LINE_FS = `#version 300 es
precision highp float; in float vState; uniform vec4 uColor; uniform vec2 uDash;
flat in vec2 vLineOrigin; flat in vec2 vLineDirection; out vec4 o;
void main(){
  if(uDash.x>0.0 && uDash.y>0.0 && mod(dot(gl_FragCoord.xy-vLineOrigin,vLineDirection),uDash.x+uDash.y)>=uDash.x) discard;
  vec3 c=uColor.rgb; float a=uColor.a; if(vState>1.5){c=vec3(1.0,0.84,0.36);a=1.0;} else if(vState>0.5){c=vec3(0.95,0.78,0.36);a=1.0;} o=vec4(c,a);
}`;

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

interface BodyGeometry {
  mesh: BodyResult['mesh'];
  pos: WebGLBuffer; nor: WebGLBuffer; face: WebGLBuffer; idx: WebGLBuffer; segs: WebGLBuffer;
  buffers: WebGLBuffer[]; vertices: number; count: number; segments: number; users: number;
}
interface InstanceShape { key: string; ref: BodyResult['mesh']; inverse: Float64Array; geometry: BodyGeometry }
interface InstanceShown {
  item: InstanceItem; bodies: { gpu: GpuBody; share: Float64Array }[];
  threads: Plain | null; hatch: { body: number; line: Plain }[];
}
interface GpuBody {
  vao: WebGLVertexArrayObject; count: number; state: WebGLBuffer; stateData: Float32Array;
  lineVao: WebGLVertexArrayObject; segments: number; lineState: WebGLBuffer; lineStateData: Float32Array;
  buffers: WebGLBuffer[]; result: BodyResult; geometry: BodyGeometry;
}
/** A mesh or a set of segments drawn in one colour (G16: direct curves and surfaces, a proposal's diff). */
interface Plain { vao: WebGLVertexArrayObject; count: number; buffers: WebGLBuffer[] }
interface DirectShown { id: string; kind: 'curve' | 'surface'; on: boolean; tri: Plain | null; line: Plain | null; segments: Float32Array | null; bounds: { min: Vec3; max: Vec3 } | null }
interface ProposalShown { color: [number, number, number]; tri: Plain; line: Plain | null }

/** Direct surfaces' ids in the pick pass start here: above any body's (a body's id is its index × 4096 + its face + 1). */
const DIRECT_ID = 15 << 20;
/** Instance surface IDs are allocated per scene, above base/direct IDs, with an exact lookup (no face-count packing). */
const INSTANCE_ID = 1 << 24;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const INSTANCE_IDENTITY = Float64Array.from(IDENTITY);
const DIRECT_LOOK = { surface: [0.561, 0.702, 0.851], surfaceOn: [0.910, 0.761, 0.353], curve: [0.369, 0.784, 0.898, 1], curveOn: [1, 0.827, 0.361, 1], isos: [0.953, 0.961, 0.969, 0.55], controls: [0.788, 0.639, 1, 1] } as const;
/** Line pick candidates tried a mesh, nearest first, before it gives up on the hidden ones (as the GPU viewer's G3). */
const HIDDEN_TRIES = 16;

export class Renderer implements ViewRenderer {
  readonly gl: WebGL2RenderingContext;
  private mesh: WebGLProgram; private pick: WebGLProgram; private line: WebGLProgram; private grid: WebGLProgram; private shadow: WebGLProgram; private bg: WebGLProgram; private ao: WebGLProgram;
  private bodies: GpuBody[] = [];
  private instances: InstanceShown[] = [];
  private instanceShapes = new Map<string, InstanceShape[]>();
  private instanceSelection: readonly string[] = [];
  private silhouettes = new WeakMap<GpuBody, { key: string; line: Plain | null }>();
  private fadedInstance(id: string): boolean { const ids = this.view?.isolatedInstances; return !!ids?.length && !ids.includes(id); }
  private instanceFaces: readonly { id: string; body: number; face: number }[] = [];
  private instanceTransforms: ReadonlyMap<string, Float64Array> | null = null;
  private instancePreview: { id: string; matrix: Float64Array } | null = null;
  private instanceIds = new Map<number, { id: string; body: number; face: number; cap?: true }>();
  private direct: DirectShown[] = []; private directExtras: { line: Plain; color: readonly number[]; width: number }[] = [];
  private proposal: ProposalShown[] = [];
  private hatch: { body: number; line: Plain }[] = [];
  private clearance: ClearanceOverlayGL | null = null;
  private print: PrintOverlayGL | null = null;
  private gridVao: WebGLVertexArrayObject; private gridCount = 0;
  private quadVao: WebGLVertexArrayObject; private corner: WebGLBuffer; private emptyVao: WebGLVertexArrayObject;
  private pickFbo: WebGLFramebuffer | null = null; private pickTex: WebGLTexture | null = null; private pickDepthTex: WebGLTexture | null = null; private pickDepth: WebGLRenderbuffer | null = null;
  private pickSize = [0, 0];
  /** What the pick pass drew last: the scene's version and the camera's matrix (a pick and an edge pick at one pointer share it). */
  private serial = 0; private pickSerial = -1; private pickVP = new Float32Array(16);
  private msFbo: WebGLFramebuffer | null = null; private msColor: WebGLRenderbuffer | null = null; private msDepth: WebGLRenderbuffer | null = null;
  private rsFbo: WebGLFramebuffer | null = null; private rsColor: WebGLTexture | null = null; private rsDepth: WebGLTexture | null = null;
  private targetSize = [0, 0]; private samples: number;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private theme: Theme = THEMES.dark;
  private model = new Float32Array(16); private normal = new Float32Array(9);
  private view: ViewState | null = null; private lastCamera: OrbitCamera | null = null;
  private displayMode: DisplayModeStatus = { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true };
  aoEnabled = true;
  interacting = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    this.mesh = this.program(MESH_VS, MESH_FS); this.pick = this.program(MESH_VS, PICK_FS); this.line = this.program(LINE_VS, LINE_FS);
    this.grid = this.program(GRID_VS, GRID_FS); this.shadow = this.program(QUAD_VS, SHADOW_FS);
    this.bg = this.program(FULL_VS, BG_FS); this.ao = this.program(FULL_VS, AO_FS);
    this.gridVao = this.buildGrid(); this.quadVao = this.buildQuad();
    this.corner = this.buffer(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
    this.emptyVao = gl.createVertexArray()!;
  }

  setTheme(name: ThemeName) { this.theme = THEMES[name]; }

  setClearanceDisplay(display: ClearanceDisplay | null): void {
    if (!this.clearance && !display?.overlays.length) return;
    (this.clearance ??= new ClearanceOverlayGL(this.gl)).setDisplay(display);
  }

  setPrintDisplay(display: PrintDisplay | null): void {
    if (!this.print && !display) return;
    (this.print ??= new PrintOverlayGL(this.gl)).setDisplay(display);
  }

  dispose(): void {
    this.clearance?.dispose(); this.clearance = null;
    this.print?.dispose(); this.print = null;
  }

  getDisplayModeStatus(): DisplayModeStatus { return { ...this.displayMode }; }

  private resolveDisplayMode(view: ViewState): DisplayMode {
    const reason = this.direct.length || this.proposal.length
      ? 'Display modes currently support ordinary modelling solids; direct and proposal overlays are unsupported.' : undefined;
    this.displayMode = displayModeStatus(view, this.displayMode.effective, reason);
    return this.displayMode.effective;
  }

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

  /** A triangle mesh drawn by the mesh program in one colour: no faces, no state (G16). */
  private plainMesh(positions: Float32Array, normals: Float32Array, indices: Uint32Array): Plain {
    const gl = this.gl; const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const pos = this.buffer(positions), nor = this.buffer(normals), zero = this.buffer(new Float32Array(positions.length / 3));
    this.attr(0, pos, 3); this.attr(1, nor, 3); this.attr(2, zero, 1); this.attr(3, zero, 1);
    const idx = this.buffer(indices, gl.ELEMENT_ARRAY_BUFFER);
    gl.bindVertexArray(null); return { vao, count: indices.length, buffers: [pos, nor, zero, idx] };
  }

  /** Segments (six numbers each) drawn by the line program in one colour (G16). */
  private plainLines(segments: Float32Array): Plain {
    const gl = this.gl; const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const n = segments.length / 6, segs = this.buffer(segments), zero = this.buffer(new Float32Array(n));
    this.attr(0, this.corner, 2); this.attr(1, segs, 3, 24, 0, 1); this.attr(2, segs, 3, 24, 12, 1); this.attr(3, zero, 1, 0, 0, 1);
    gl.bindVertexArray(null); return { vao, count: n, buffers: [segs, zero] };
  }

  private free(p: Plain | null) { if (!p) return; this.gl.deleteVertexArray(p.vao); for (const b of p.buffers) this.gl.deleteBuffer(b); }

  private bodyGeometry(result: BodyResult): BodyGeometry {
    const gl = this.gl, m = result.mesh;
    const pos = this.buffer(m.positions), nor = this.buffer(m.normals), face = this.buffer(m.faceOfVertex);
    const idx = this.buffer(m.indices, gl.ELEMENT_ARRAY_BUFFER), segs = this.buffer(m.edgeLines);
    return { mesh: m, pos, nor, face, idx, segs, buffers: [pos, nor, face, idx, segs], vertices: m.positions.length / 3, count: m.indices.length, segments: m.edgeLines.length / 6, users: 0 };
  }

  private uploadBody(result: BodyResult, geometry = this.bodyGeometry(result)): GpuBody {
    const gl = this.gl, g = geometry; g.users++;
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const stateData = new Float32Array(g.vertices), state = this.buffer(stateData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.attr(0, g.pos, 3); this.attr(1, g.nor, 3); this.attr(2, g.face, 1); this.attr(3, state, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx);
    const lineVao = gl.createVertexArray()!; gl.bindVertexArray(lineVao);
    const lineStateData = new Float32Array(g.segments), lineState = this.buffer(lineStateData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.attr(0, this.corner, 2); this.attr(1, g.segs, 3, 24, 0, 1); this.attr(2, g.segs, 3, 24, 12, 1); this.attr(3, lineState, 1, 0, 0, 1);
    gl.bindVertexArray(null);
    return { vao, count: g.count, state, stateData, lineVao, segments: g.segments, lineState, lineStateData, buffers: [state, lineState], result, geometry: g };
  }

  private freeBody(b: GpuBody): void {
    this.free(this.silhouettes.get(b)?.line ?? null); this.silhouettes.delete(b);
    const gl = this.gl; gl.deleteVertexArray(b.vao); gl.deleteVertexArray(b.lineVao); b.buffers.forEach(x => gl.deleteBuffer(x));
    if (--b.geometry.users === 0) {
      b.geometry.buffers.forEach(x => gl.deleteBuffer(x));
      for (const [key, list] of this.instanceShapes) {
        const left = list.filter(x => x.geometry !== b.geometry);
        if (left.length) this.instanceShapes.set(key, left); else this.instanceShapes.delete(key);
      }
    }
  }

  setBodies(results: BodyResult[]) {
    this.serial++;
    for (const b of this.bodies) this.freeBody(b);
    this.bodies = results.map(result => this.uploadBody(result));
  }

  /** Original world-placed packets, with immutable geometry shared only after a full moved-copy check. */
  setInstances(items: InstanceItem[], selected: readonly string[]): void {
    const old = new Map(this.instances.map(x => [x.item.id, x]));
    this.instances = items.map(item => {
      const previous = old.get(item.id);
      if (previous && previous.item.bodies === item.bodies && previous.item.threads === item.threads && previous.item.hatch === item.hatch) {
        old.delete(item.id); previous.item = item; return previous;
      }
      const P = item.placement ?? INSTANCE_IDENTITY;
      return { item, bodies: item.bodies.map(result => {
        const key = topologyKey(result.mesh), list = this.instanceShapes.get(key) ?? [];
        let shape = list.find(x => movedCopy(x.ref, result.mesh, multiply(P, x.inverse)));
        if (!shape) {
          shape = { key, ref: result.mesh, inverse: invert(P), geometry: this.bodyGeometry(result) };
          list.push(shape); this.instanceShapes.set(key, list);
        }
        return { gpu: this.uploadBody(result, shape.geometry), share: multiply(P, shape.inverse) };
      }), threads: item.threads?.length ? this.plainLines(item.threads) : null,
      hatch: (item.hatch ?? []).map(h => ({ body: h.body, line: this.plainLines(h.segments) })) };
    });
    for (const x of old.values()) { for (const b of x.bodies) this.freeBody(b.gpu); this.free(x.threads); for (const h of x.hatch) this.free(h.line); }
    this.instanceSelection = selected; this.paintInstanceFaces(); this.serial++;
    if (this.view) this.resolveDisplayMode(this.view);
  }
  setInstanceTransforms(transforms: ReadonlyMap<string, Float64Array> | null): void { this.instanceTransforms = transforms; this.serial++; }
  setInstancePreview(preview: { id: string; matrix: Float64Array } | null): void { this.instancePreview = preview; this.serial++; }
  setInstanceFaces(faces: readonly { id: string; body: number; face: number }[]): void { this.instanceFaces = faces; this.paintInstanceFaces(); }

  private paintInstanceFaces(): void {
    for (const it of this.instances) it.bodies.forEach(({ gpu }, bi) => {
      const body = it.item.sourceBodies ? it.item.sourceBodies[bi] ?? -1 : bi;
      const picked = new Set(this.instanceFaces.filter(x => x.id === it.item.id && x.body === body).map(x => x.face));
      const m = gpu.result.mesh;
      for (let v = 0; v < gpu.stateData.length; v++) {
        const face = m.faceOfVertex[v], source = it.item.sourceFaces ? it.item.sourceFaces[bi]?.[face] ?? -1 : face;
        gpu.stateData[v] = source >= 0 && picked.has(source) ? 2 : 0;
      }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, gpu.state); this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, gpu.stateData);
    });
  }
  /** Draw geometry's reference-to-placement, then pose, then drag. Placement is never applied twice. */
  private instanceMatrix(it: InstanceShown, bi: number, shared = true): void {
    const pose = this.instanceTransforms?.get(it.item.id), drag = this.instancePreview?.id === it.item.id ? this.instancePreview.matrix : null;
    const motion = drag && pose ? multiply(drag, pose) : drag ?? pose ?? INSTANCE_IDENTITY;
    this.model.set(shared ? multiply(motion, it.bodies[bi].share) : motion);
  }
  private placeInstance(p: WebGLProgram, it: InstanceShown, bi: number, normals = true, shared = true): void {
    this.instanceMatrix(it, bi, shared);
    this.gl.uniformMatrix4fv(this.u(p, 'uModel'), false, this.model);
    if (normals) { normalMatrix(this.model, this.normal); this.gl.uniformMatrix3fv(this.u(p, 'uNormal'), false, this.normal); }
  }

  /** Rewrites only the per-vertex / per-segment state buffers (hover = 1, selected = 2). */
  setState(view: ViewState) {
    const gl = this.gl; this.view = view; this.serial++;
    this.resolveDisplayMode(view);
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

  /**
   * Direct curves and surfaces (G16, as the GPU viewer draws them): surfaces lit, two-sided, curves as lines; the selected
   * ones in the accent with their isocurves and control nets. (The GPU viewer also outlines a selected surface: not here.)
   */
  setDirect(items: DirectDisplay[], selected: readonly string[]): void {
    this.serial++;
    for (const d of this.direct) { this.free(d.tri); this.free(d.line); }
    for (const x of this.directExtras) this.free(x.line);
    this.direct = []; this.directExtras = [];
    for (const it of items) {
      const on = selected.includes(it.id), surface = it.kind === 'surface' && !!it.indices?.length;
      this.direct.push({
        id: it.id, kind: it.kind, on,
        tri: surface ? this.plainMesh(it.positions, it.normals ?? vertexNormals(it.positions, it.indices!), it.indices!) : null,
        line: !surface && it.positions.length >= 6 ? this.plainLines(it.positions) : null,
        segments: surface ? null : it.positions, bounds: boundsOf(it.positions),
      });
      if (on && it.isos?.length) this.directExtras.push({ line: this.plainLines(it.isos), color: DIRECT_LOOK.isos, width: 0.5 });
      if (on && it.controls.length >= 6) this.directExtras.push({ line: this.plainLines(it.controls), color: DIRECT_LOOK.controls, width: 0.6 });
    }
    if (this.view) this.resolveDisplayMode(this.view);
  }

  /** The hatch on the cut (G19.3): each body's segments, drawn with its edges (placed as it is), its face's colour × 0.45. */
  setSectionHatch(hatch: import('./renderer').SectionHatch | null): void {
    for (const h of this.hatch) this.free(h.line);
    this.hatch = (hatch ?? []).filter(h => h.segments.length >= 6).map(h => ({ body: h.body, line: this.plainLines(h.segments) }));
  }

  /**
   * A proposal's diff (G12 on WebGL2, G16): the material it adds (green) and takes away (red) see-through over the bodies,
   * drawn in front of the faces they lie on (a decal), with their edges (faint where hidden). The volume chips are drawn
   * by the viewport's overlay here (no text in this renderer).
   */
  setProposalOverlay(view: import('../engine/client').ProposalOverlay | null): void {
    for (const p of this.proposal) { this.free(p.tri); this.free(p.line); }
    this.proposal = [];
    if (view) for (const side of ['added', 'removed'] as const) {
      const s = view[side]; if (!s || !s.mesh.indices.length) continue;
      const m = s.mesh;
      this.proposal.push({ color: hexRgb(side === 'added' ? PROPOSAL_ADDED : PROPOSAL_REMOVED), tri: this.plainMesh(m.positions, m.normals, m.indices), line: m.edgeLines.length ? this.plainLines(m.edgeLines) : null });
    }
    if (this.view) this.resolveDisplayMode(this.view);
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
    if (!this.bodies.length && !this.direct.length && !this.instances.length) return null;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const b of this.bodies) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.result.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.result.mesh.bounds.max[k]); }
    for (const d of this.direct) if (d.bounds) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], d.bounds.min[k]); max[k] = Math.max(max[k], d.bounds.max[k]); }
    for (const it of this.instances) for (let bi = 0; bi < it.bodies.length; bi++) {
      this.instanceMatrix(it, bi, false);
      const box = it.bodies[bi].gpu.result.mesh.bounds;
      for (let corner = 0; corner < 8; corner++) {
        const p = [0, 1, 2].map(k => corner & (1 << k) ? box.max[k] : box.min[k]);
        for (let k = 0; k < 3; k++) {
          const x = this.model[k] * p[0] + this.model[4 + k] * p[1] + this.model[8 + k] * p[2] + this.model[12 + k];
          min[k] = Math.min(min[k], x); max[k] = Math.max(max[k], x);
        }
      }
    }
    return min[0] <= max[0] ? { min, max } : null;
  }

  /** The mesh program's model and normal matrices for a body: its gizmo drag's matrix (a turn too, G16), else its offset. */
  private place(p: WebGLProgram, view: ViewState, bi: number, normals = true) {
    placeBody(view, bi, this.model, this.normal);
    this.gl.uniformMatrix4fv(this.u(p, 'uModel'), false, this.model);
    if (normals) this.gl.uniformMatrix3fv(this.u(p, 'uNormal'), false, this.normal);
  }
  private unplaced(p: WebGLProgram, normals = true) {
    this.gl.uniformMatrix4fv(this.u(p, 'uModel'), false, IDENTITY);
    if (normals) this.gl.uniformMatrix3fv(this.u(p, 'uNormal'), false, IDENTITY3);
  }

  /** View-dependent display lines only: they never enter native edge/face picking. */
  private drawSilhouette(body: GpuBody, camera: OrbitCamera, mode: DisplayMode, dpr: number): void {
    const mesh = body.geometry.mesh;
    if (!mesh.faces.some(face => face.kind === 'curved' && !face.facet)) return;
    const key = JSON.stringify([camera.eye(), camera.target, camera.ortho, Array.from(this.model)]);
    let cached = this.silhouettes.get(body);
    if (!cached || cached.key !== key) {
      this.free(cached?.line ?? null);
      const segments = silhouetteLines(mesh, this.model, camera.eye(), camera.target, camera.ortho);
      cached = { key, line: segments.length ? this.plainLines(segments) : null }; this.silhouettes.set(body, cached);
    }
    if (!cached.line) return;
    const gl = this.gl; gl.bindVertexArray(cached.line.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cached.line.count);
    if (mode === 'hidden-lines-dashed') {
      gl.depthFunc(gl.GREATER); gl.uniform2f(this.u(this.line, 'uDash'), 6 * dpr, 4 * dpr);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cached.line.count);
      gl.depthFunc(gl.LESS); gl.uniform2f(this.u(this.line, 'uDash'), 0, 0);
    }
  }

  render(camera: OrbitCamera, view: ViewState) {
    const gl = this.gl; const [w, h] = this.resize(); const t = this.theme;
    const mode = this.resolveDisplayMode(view);
    const lineOnly = mode === 'hidden-lines-removed' || mode === 'hidden-lines-dashed' || mode === 'wireframe';
    this.view = view; this.lastCamera = camera; this.serial++;
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
    if (bounds && !lineOnly) {
      const cx = (bounds.min[0] + bounds.max[0]) / 2, cy = (bounds.min[1] + bounds.max[1]) / 2;
      const rx = (bounds.max[0] - bounds.min[0]) * 0.75 + 6, ry = (bounds.max[1] - bounds.min[1]) * 0.75 + 6;
      gl.useProgram(this.shadow); gl.uniformMatrix4fv(this.u(this.shadow, 'uVP'), false, vp); gl.uniform1f(this.u(this.shadow, 'uAlpha'), t.shadow);
      gl.uniform4f(this.u(this.shadow, 'uRect'), cx - rx, cy - ry, cx + rx, cy + ry); gl.uniform1f(this.u(this.shadow, 'uZ'), bounds.min[2] - 0.05);
      gl.bindVertexArray(this.quadVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.depthMask(true);
    // Keep the same front surface/cap depth, even when the appearance contains only native CAD edges.
    if (lineOnly) gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.useProgram(this.mesh);
    gl.uniformMatrix4fv(this.u(this.mesh, 'uVP'), false, vp); gl.uniformMatrix4fv(this.u(this.mesh, 'uView'), false, viewM);
    gl.uniform3fv(this.u(this.mesh, 'uBase'), t.base); gl.uniform1f(this.u(this.mesh, 'uAmb'), t.amb); gl.uniform1f(this.u(this.mesh, 'uOpacity'), 1);
    // The opaque bodies, the direct surfaces, then the ghosted bodies over them.
    for (let pass = 0; pass < 2; pass++) {
      for (let bi = 0; bi < this.bodies.length; bi++) {
        const ghost = view.ghostBodies.has(bi) || !!view.isolatedInstances?.length;
        if (view.hiddenBodies?.has(bi) || ghost !== (pass === 1)) continue;
        const b = this.bodies[bi];
        gl.depthMask(view.isolatedInstances?.length ? false : lineOnly || !ghost);
        this.place(this.mesh, view, bi);
        gl.uniform1f(this.u(this.mesh, 'uBodySel'), view.selectedBodies.includes(bi) ? 1 : view.hoverBody === bi ? 0.55 : 0);
        gl.uniform1f(this.u(this.mesh, 'uGhost'), view.ghostBodies.has(bi) ? 1 : 0);
        gl.uniform1f(this.u(this.mesh, 'uOpacity'), (mode === 'x-ray' ? 0.25 : 1) * (view.isolatedInstances?.length ? 0.15 : 1));
        gl.uniform3fv(this.u(this.mesh, 'uBase'), view.bodyColors?.get(bi) ?? t.base);
        gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
      }
      if (pass === 0 && this.direct.length) {
        this.unplaced(this.mesh); gl.uniform1f(this.u(this.mesh, 'uBodySel'), 0); gl.uniform1f(this.u(this.mesh, 'uGhost'), 0);
        for (const d of this.direct) {
          if (!d.tri) continue;
          gl.uniform3fv(this.u(this.mesh, 'uBase'), d.on ? DIRECT_LOOK.surfaceOn : DIRECT_LOOK.surface);
          gl.bindVertexArray(d.tri.vao); gl.drawElements(gl.TRIANGLES, d.tri.count, gl.UNSIGNED_INT, 0);
        }
      }
      // Instance surfaces retain nearest depth in every appearance mode, including line-only modes.
      if (this.instances.length) {
        gl.useProgram(this.mesh); gl.depthMask(pass === 0); gl.uniform1f(this.u(this.mesh, 'uGhost'), 0); gl.uniform1f(this.u(this.mesh, 'uOpacity'), (mode === 'x-ray' ? 0.25 : 1) * (pass === 1 ? 0.15 : 1));
        gl.uniform3fv(this.u(this.mesh, 'uBase'), t.base);
        for (const it of this.instances) it.bodies.forEach(({ gpu }, bi) => {
          if (this.fadedInstance(it.item.id) !== (pass === 1)) return;
          this.placeInstance(this.mesh, it, bi);
          gl.uniform1f(this.u(this.mesh, 'uBodySel'), this.instanceSelection.includes(it.item.id) ? 1 : 0);
          gl.bindVertexArray(gpu.vao); gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_INT, 0);
        });
      }
    }
    gl.colorMask(true, true, true, true);
    if (this.proposal.length) {
      // (In front of the faces they lie on: pulled toward the eye past the bodies' own offset.)
      gl.depthMask(false); gl.polygonOffset(-1, -1);
      this.unplaced(this.mesh); gl.uniform1f(this.u(this.mesh, 'uBodySel'), 0); gl.uniform1f(this.u(this.mesh, 'uGhost'), 0); gl.uniform1f(this.u(this.mesh, 'uOpacity'), 0.5);
      for (const p of this.proposal) { gl.uniform3fv(this.u(this.mesh, 'uBase'), p.color); gl.bindVertexArray(p.tri.vao); gl.drawElements(gl.TRIANGLES, p.tri.count, gl.UNSIGNED_INT, 0); }
    }
    gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL);
    const dpr = w / Math.max(1, this.canvas.clientWidth);
    gl.useProgram(this.line); gl.uniformMatrix4fv(this.u(this.line, 'uVP'), false, vp);
    gl.uniform2f(this.u(this.line, 'uViewport'), w / 2, h / 2); gl.uniform1f(this.u(this.line, 'uWidth'), 0.62 * dpr);
    gl.uniform2f(this.u(this.line, 'uDash'), 0, 0);
    // Appearance passes never replace the nearest surface depth used to classify the next edge.
    if (mode !== 'shaded-with-edges' || view.isolatedInstances?.length) gl.depthMask(false);
    if (mode === 'wireframe') gl.disable(gl.DEPTH_TEST);
    for (const [bi, b] of this.bodies.entries()) {
      if (view.hiddenBodies?.has(bi)) continue;
      this.place(this.line, view, bi, false);
      gl.uniform4f(this.u(this.line, 'uColor'), t.edge[0], t.edge[1], t.edge[2], (view.ghostBodies.has(bi) ? 0.35 : 0.9) * (view.isolatedInstances?.length ? 0.15 : 1));
      gl.bindVertexArray(b.lineVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.segments);
      this.drawSilhouette(b, camera, mode, dpr);
      gl.bindVertexArray(b.lineVao);
      if (mode === 'hidden-lines-dashed') {
        gl.depthFunc(gl.GREATER); gl.uniform2f(this.u(this.line, 'uDash'), 6 * dpr, 4 * dpr);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, b.segments);
        gl.depthFunc(gl.LESS); gl.uniform2f(this.u(this.line, 'uDash'), 0, 0);
      }
    }
    for (const it of this.instances) {
      gl.uniform4f(this.u(this.line, 'uColor'), ...t.edge as [number, number, number], 0.9 * (this.fadedInstance(it.item.id) ? 0.15 : 1));
      it.bodies.forEach(({ gpu }, bi) => {
        this.placeInstance(this.line, it, bi, false);
        gl.bindVertexArray(gpu.lineVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, gpu.segments);
        this.drawSilhouette(gpu, camera, mode, dpr);
        gl.bindVertexArray(gpu.lineVao);
        if (mode === 'hidden-lines-dashed') {
          gl.depthFunc(gl.GREATER); gl.uniform2f(this.u(this.line, 'uDash'), 6 * dpr, 4 * dpr);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, gpu.segments);
          gl.depthFunc(gl.LESS); gl.uniform2f(this.u(this.line, 'uDash'), 0, 0);
        }
      });
      if (it.bodies.length && !lineOnly) {
        this.placeInstance(this.line, it, 0, false, false);
        gl.uniform1f(this.u(this.line, 'uWidth'), 0.5 * dpr);
        if (it.threads) { gl.uniform4f(this.u(this.line, 'uColor'), ...t.edge as [number, number, number], this.fadedInstance(it.item.id) ? 0.55 * 0.15 : 0.55); gl.bindVertexArray(it.threads.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, it.threads.count); }
        for (const hatch of it.hatch) { gl.uniform4f(this.u(this.line, 'uColor'), 0, 0, 0, this.fadedInstance(it.item.id) ? 0.55 * 0.15 : 0.55); gl.bindVertexArray(hatch.line.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, hatch.line.count); }
        gl.uniform1f(this.u(this.line, 'uWidth'), 0.62 * dpr);
      }
    }
    gl.enable(gl.DEPTH_TEST); if (mode !== 'shaded-with-edges' || view.isolatedInstances?.length) gl.depthMask(true);
    if (this.hatch.length && !lineOnly) {
      // (A line 1 CSS pixel wide: the width is half of it.)
      gl.uniform1f(this.u(this.line, 'uWidth'), 0.5 * dpr);
      // (Black at 0.55 over the face: its colour × 0.45 however it is lit, as the GPU's caps.)
      for (const h of this.hatch) {
        if (h.body >= this.bodies.length || view.hiddenBodies?.has(h.body)) continue;
        this.place(this.line, view, h.body, false);
        gl.uniform4f(this.u(this.line, 'uColor'), 0, 0, 0, 0.55 * (view.ghostBodies.has(h.body) ? 0.35 : 1) * (view.isolatedInstances?.length ? 0.15 : 1));
        gl.bindVertexArray(h.line.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, h.line.count);
      }
      gl.uniform1f(this.u(this.line, 'uWidth'), 0.62 * dpr);
    }
    if (this.direct.length || this.proposal.length) {
      this.unplaced(this.line, false);
      // (Widths as the GPU viewer's, in CSS pixels: curves 2, selected 3; their nets 1.2 and isocurves 1; a proposal's edges 1.6.)
      for (const d of this.direct) {
        if (!d.line) continue;
        gl.uniform1f(this.u(this.line, 'uWidth'), (d.on ? 1.5 : 1) * dpr); gl.uniform4fv(this.u(this.line, 'uColor'), d.on ? DIRECT_LOOK.curveOn : DIRECT_LOOK.curve);
        gl.bindVertexArray(d.line.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, d.line.count);
      }
      for (const x of this.directExtras) {
        gl.uniform1f(this.u(this.line, 'uWidth'), x.width * dpr); gl.uniform4fv(this.u(this.line, 'uColor'), x.color);
        gl.bindVertexArray(x.line.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, x.line.count);
      }
      gl.uniform1f(this.u(this.line, 'uWidth'), 0.8 * dpr);
      for (const p of this.proposal) {
        if (!p.line) continue;
        gl.bindVertexArray(p.line.vao);
        // Shown at 0.9, and where a surface hides them at 0.35 of that.
        gl.uniform4f(this.u(this.line, 'uColor'), p.color[0], p.color[1], p.color[2], 0.9); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p.line.count);
        gl.depthFunc(gl.GREATER); gl.depthMask(false);
        gl.uniform4f(this.u(this.line, 'uColor'), p.color[0], p.color[1], p.color[2], 0.9 * 0.35); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p.line.count);
        gl.depthFunc(gl.LESS); gl.depthMask(true);
      }
    }
    this.clearance?.render(vp);
    this.print?.render(vp, w, h, dpr);
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
    gl.uniform1f(this.u(this.ao, 'uStrength'), this.aoEnabled && !this.interacting && !lineOnly ? t.ao : 0);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  }

  /** The frame as drawn, as a PNG (G16: drawn again and read in the same task, as the canvas keeps no frame). */
  capture(): Promise<Blob> {
    if (this.lastCamera && this.view) this.render(this.lastCamera, this.view);
    return new Promise((resolve, reject) => this.canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No frame to capture.'))), 'image/png'));
  }

  /**
   * The pick pass (G16): the opaque bodies (moved as drawn) and the direct surfaces, an id and a depth at each pixel, as
   * the frame's depth test sees them (the bodies' polygon offset too). Drawn again only when the scene or the camera changed.
   */
  private pickPass(camera: OrbitCamera, view: ViewState) {
    const gl = this.gl; const [w, h] = [this.canvas.width, this.canvas.height];
    const vp = camera.viewProjection();
    if (this.pickFbo && this.pickSize[0] === w && this.pickSize[1] === h && this.pickSerial === this.serial && sameMatrix(this.pickVP, vp)) { gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo); return; }
    if (!this.pickFbo || this.pickSize[0] !== w || this.pickSize[1] !== h) {
      if (this.pickFbo) { gl.deleteFramebuffer(this.pickFbo); gl.deleteTexture(this.pickTex); gl.deleteTexture(this.pickDepthTex); gl.deleteRenderbuffer(this.pickDepth); }
      this.pickTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.pickTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      this.pickDepthTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.pickDepthTex); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      this.pickDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      this.pickFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.pickDepthTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickDepth);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.pickSize = [w, h];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo); gl.viewport(0, 0, w, h);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [1, 1, 1, 1]); gl.clearBufferfv(gl.DEPTH, 0, [1]);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.useProgram(this.pick);
    gl.uniformMatrix4fv(this.u(this.pick, 'uVP'), false, vp); gl.uniformMatrix4fv(this.u(this.pick, 'uView'), false, camera.view());
    gl.uniform1f(this.u(this.pick, 'uPickId'), 0); gl.uniform1ui(this.u(this.pick, 'uInstanceId'), 0);
    this.bodies.forEach((b, bi) => {
      if (view.ghostBodies.has(bi) || view.hiddenBodies?.has(bi) || !!view.isolatedInstances?.length) return;
      this.place(this.pick, view, bi); gl.uniform1f(this.u(this.pick, 'uBodyId'), bi);
      gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    });
    this.unplaced(this.pick);
    this.direct.forEach((d, k) => {
      if (!d.tri) return;
      gl.uniform1f(this.u(this.pick, 'uPickId'), DIRECT_ID + k);
      gl.bindVertexArray(d.tri.vao); gl.drawElements(gl.TRIANGLES, d.tri.count, gl.UNSIGNED_INT, 0);
    });
    let next = INSTANCE_ID;
    this.instanceIds.clear();
    for (const it of this.instances) it.bodies.forEach(({ gpu }, bi) => {
      if (this.fadedInstance(it.item.id)) return;
      const m = gpu.result.mesh, count = m.faces.length;
      if (next + count > 0xffffffff) throw new Error('Instance pick ID capacity exceeded.');
      this.placeInstance(this.pick, it, bi); gl.uniform1ui(this.u(this.pick, 'uInstanceId'), next);
      for (let face = 0; face < count; face++) this.instanceIds.set(next + face, {
        id: it.item.id, body: it.item.sourceBodies ? it.item.sourceBodies[bi] ?? -1 : bi,
        face: it.item.sourceFaces ? it.item.sourceFaces[bi]?.[face] ?? -1 : (m.faces[face].id === 'section-cap' ? -1 : face),
        ...(m.faces[face].id === 'section-cap' ? { cap: true as const } : {}),
      });
      gl.bindVertexArray(gpu.vao); gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_INT, 0); next += count;
    });
    gl.uniform1ui(this.u(this.pick, 'uInstanceId'), 0);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindVertexArray(null);
    this.pickSerial = this.serial; this.pickVP.set(vp);
  }

  /** The pick pass's id at CSS pixel (x, y): 0 for none. */
  private idAt(x: number, y: number, camera: OrbitCamera, view: ViewState): number {
    const gl = this.gl; this.pickPass(camera, view);
    const h = this.canvas.height, dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth), px = new Uint8Array(4);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(Math.floor(x * dpr), Math.floor(h - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return px[0] + px[1] * 256 + px[2] * 65536 + px[3] * 16777216;
  }

  /** GPU face pick at CSS pixel (x, y): a direct surface in front of the bodies is no face (as the GPU viewer's raycast). */
  pickFace(x: number, y: number, camera: OrbitCamera, view: ViewState): FaceRef | null {
    const id = this.idAt(x, y, camera, view);
    if (!id || id >= DIRECT_ID) return null;
    return { body: Math.floor((id - 1) / 4096), face: (id - 1) % 4096 };
  }

  /**
   * The pick pass's depths round CSS pixel (x, y), `radius` and two pixels more each way: a test of whether a world point
   * there is shown (G3 on WebGL2, G16) — hidden where a surface lies in front of it by more than a pixel and a half, in world
   * units at its depth (lines lie on their faces, and the bodies' polygon offset lets them show a little behind).
   */
  private depthsAround(x: number, y: number, radius: number, camera: OrbitCamera, view: ViewState): (p: Vec3) => boolean {
    const gl = this.gl; this.pickPass(camera, view);
    const W = this.canvas.width, H = this.canvas.height, cw = Math.max(1, this.canvas.clientWidth), ch = Math.max(1, this.canvas.clientHeight), dpr = W / cw;
    const x0 = Math.max(0, Math.floor((x - radius - 2) * dpr)), x1 = Math.min(W, Math.ceil((x + radius + 2) * dpr));
    const y0 = Math.max(0, Math.floor(H - (y + radius + 2) * dpr)), y1 = Math.min(H, Math.ceil(H - (y - radius - 2) * dpr));
    const rw = Math.max(0, x1 - x0), rh = Math.max(0, y1 - y0), px = new Uint8Array(rw * rh * 4);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    if (rw && rh) gl.readPixels(x0, y0, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const vp = this.pickVP, { eye, forward } = camera.basis(), perPx = (2 * Math.tan(camera.fovY / 2)) / ch, near: Vec3 = [0, 0, 0];
    return p => {
      const cw4 = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
      const sx = ((vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / cw4 * 0.5 + 0.5) * W, sy = ((vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / cw4 * 0.5 + 0.5) * H;
      const i = Math.floor(sx) - x0, j = Math.floor(sy) - y0;
      if (i < 0 || j < 0 || i >= rw || j >= rh) return true;
      const k = (j * rw + i) * 4, stored = (px[k] + px[k + 1] * 256 + px[k + 2] * 65536) / 16777215;
      // The point a pixel and a half nearer the eye: hidden when the surface's depth there is nearer still.
      const slack = 1.5 * perPx * (camera.ortho ? camera.distance : cw4);
      if (camera.ortho) for (let a = 0; a < 3; a++) near[a] = p[a] - forward[a] * slack;
      else { const d = Math.hypot(eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]) || 1; for (let a = 0; a < 3; a++) near[a] = p[a] + (eye[a] - p[a]) / d * slack; }
      const nw = vp[3] * near[0] + vp[7] * near[1] + vp[11] * near[2] + vp[15];
      const nz = ((vp[2] * near[0] + vp[6] * near[1] + vp[10] * near[2] + vp[14]) / nw) * 0.5 + 0.5;
      return stored >= nz;
    };
  }

  /**
   * Edge pick: the nearest crease edge within `radius` CSS px that a surface does not hide (G3 on WebGL2, G16) — each
   * body's segments nearest first, up to 16 hidden ones passed over, as the GPU viewer's pickLine; bodies moved as drawn.
   */
  pickEdge(x: number, y: number, camera: OrbitCamera, view: ViewState, radius = 6): EdgeRef | null {
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight, vp = camera.viewProjection();
    let shown: ((p: Vec3) => boolean) | null = null, best: EdgeRef | null = null, bestD = radius;
    for (let bi = 0; bi < this.bodies.length; bi++) {
      if (view.ghostBodies.has(bi) || view.hiddenBodies?.has(bi) || !!view.isolatedInstances?.length) continue;
      placeBody(view, bi, this.model, this.normal);
      const L = this.bodies[bi].result.mesh.edgeLines, E = this.bodies[bi].result.mesh.edgeOfSegment;
      const near = nearSegments(L, this.model, vp, cw, ch, x, y, bestD);
      for (let k = 0; k < near.length && k < HIDDEN_TRIES; k++) {
        shown ??= this.depthsAround(x, y, radius, camera, view);
        if (!shown(near[k].at)) continue;
        bestD = near[k].d; best = { body: bi, edge: E[near[k].s * 2] }; break;
      }
    }
    return best;
  }

  /** The direct object under a point: a curve within a few pixels that a surface does not hide, else a surface (G16). */
  pickDirect(x: number, y: number, camera: OrbitCamera): string | null {
    if (!this.direct.length || !this.view) return null;
    const view = this.view, cw = this.canvas.clientWidth, ch = this.canvas.clientHeight, vp = camera.viewProjection();
    let shown: ((p: Vec3) => boolean) | null = null, best: string | null = null, bestD = 6;
    for (const d of this.direct) {
      if (!d.segments) continue;
      const near = nearSegments(d.segments, IDENTITY, vp, cw, ch, x, y, bestD);
      for (let k = 0; k < near.length && k < HIDDEN_TRIES; k++) {
        shown ??= this.depthsAround(x, y, 6, camera, view);
        if (!shown(near[k].at)) continue;
        bestD = near[k].d; best = d.id; break;
      }
    }
    if (best) return best;
    const id = this.idAt(x, y, camera, view);
    return id >= DIRECT_ID && id < INSTANCE_ID ? this.direct[id - DIRECT_ID]?.id ?? null : null;
  }

  pickInstance(x: number, y: number, camera: OrbitCamera): string | null { return this.pickInstanceFace(x, y, camera)?.id ?? null; }
  pickInstanceFace(x: number, y: number, camera: OrbitCamera): { id: string; body: number; face: number; cap?: true } | null {
    if (!this.instances.length || !this.view) return null;
    const id = this.idAt(x, y, camera, this.view), hit = this.instanceIds.get(id);
    return hit && hit.body >= 0 ? { ...hit } : null;
  }
  pickInstanceEdge(x: number, y: number, camera: OrbitCamera, radius = 6): { id: string; body: number; edge: number } | null {
    if (!this.view) return null;
    let best: { id: string; body: number; edge: number } | null = null, distance = radius;
    const shown = this.depthsAround(x, y, radius, camera, this.view);
    for (const it of this.instances) it.bodies.forEach(({ gpu }, bi) => {
      if (this.fadedInstance(it.item.id)) return;
      this.instanceMatrix(it, bi, false);
      const m = gpu.result.mesh, near = nearSegments(m.edgeLines, this.model, camera.viewProjection(), this.canvas.clientWidth, this.canvas.clientHeight, x, y, distance);
      for (const candidate of near.slice(0, HIDDEN_TRIES)) {
        const edge = m.edgeOfSegment[candidate.s * 2], source = it.item.sourceEdges ? it.item.sourceEdges[bi]?.[edge] ?? -1 : edge;
        if (source < 0 || !shown(candidate.at)) continue;
        const body = it.item.sourceBodies ? it.item.sourceBodies[bi] ?? -1 : bi;
        if (body < 0) continue;
        distance = candidate.d; best = { id: it.item.id, body, edge: source }; break;
      }
    });
    return best;
  }

  bounds() { return this.sceneBounds(); }
}

/** A body's model matrix (its gizmo drag's, else a move by its offset) and normal matrix (the inverse transpose), into `model` and `normal`. */
function placeBody(view: ViewState, bi: number, model: Float32Array, normal: Float32Array): void {
  const t = view.transforms?.get(bi);
  if (t) { model.set(t); normalMatrix(model, normal); return; }
  model.set(IDENTITY); normal.set(IDENTITY3);
  const o = view.offsets.get(bi);
  if (o) { model[12] = o[0]; model[13] = o[1]; model[14] = o[2]; }
}

/** The inverse transpose of a 4 × 4's upper 3 × 3 (column-major), for its normals. */
function normalMatrix(m: Float32Array, out: Float32Array): void {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C || 1;
  out[0] = A / det; out[1] = B / det; out[2] = C / det;
  out[3] = (c * h - b * i) / det; out[4] = (a * i - c * g) / det; out[5] = (b * g - a * h) / det;
  out[6] = (b * f - c * e) / det; out[7] = (c * d - a * f) / det; out[8] = (a * e - b * d) / det;
}

function sameMatrix(a: Float32Array, b: Float32Array): boolean {
  for (let k = 0; k < 16; k++) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * The segments (six numbers each, moved by `model`) within `radius` CSS px of (x, y), nearest first: each with its index,
 * its distance and its world point nearest the pointer (the screen's nearest point taken back through the perspective).
 */
function nearSegments(L: Float32Array, model: Float32Array, vp: Float32Array, cw: number, ch: number, x: number, y: number, radius: number): { s: number; d: number; at: Vec3 }[] {
  const out: { s: number; d: number; at: Vec3 }[] = [];
  for (let s = 0; s < L.length; s += 6) {
    const ax = model[0] * L[s] + model[4] * L[s + 1] + model[8] * L[s + 2] + model[12], ay = model[1] * L[s] + model[5] * L[s + 1] + model[9] * L[s + 2] + model[13], az = model[2] * L[s] + model[6] * L[s + 1] + model[10] * L[s + 2] + model[14];
    const bx = model[0] * L[s + 3] + model[4] * L[s + 4] + model[8] * L[s + 5] + model[12], by = model[1] * L[s + 3] + model[5] * L[s + 4] + model[9] * L[s + 5] + model[13], bz = model[2] * L[s + 3] + model[6] * L[s + 4] + model[10] * L[s + 5] + model[14];
    const wa = vp[3] * ax + vp[7] * ay + vp[11] * az + vp[15], wb = vp[3] * bx + vp[7] * by + vp[11] * bz + vp[15];
    if (wa <= 0 || wb <= 0) continue;
    const pax = ((vp[0] * ax + vp[4] * ay + vp[8] * az + vp[12]) / wa * 0.5 + 0.5) * cw, pay = (0.5 - (vp[1] * ax + vp[5] * ay + vp[9] * az + vp[13]) / wa * 0.5) * ch;
    const pbx = ((vp[0] * bx + vp[4] * by + vp[8] * bz + vp[12]) / wb * 0.5 + 0.5) * cw, pby = (0.5 - (vp[1] * bx + vp[5] * by + vp[9] * bz + vp[13]) / wb * 0.5) * ch;
    const dx = pbx - pax, dy = pby - pay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - pax) * dx + (y - pay) * dy) / l)) : 0;
    const d = Math.hypot(x - pax - t * dx, y - pay - t * dy);
    if (d >= radius) continue;
    const u = (t * wa) / (t * wa + (1 - t) * wb);
    out.push({ s: s / 6, d, at: [ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u] });
  }
  return out.sort(byDistance);
}
function byDistance(a: { d: number }, b: { d: number }) { return a.d - b.d; }

function boundsOf(P: Float32Array): { min: Vec3; max: Vec3 } | null {
  if (P.length < 3) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max };
}

/** Area-weighted vertex normals, for a surface given without them. */
function vertexNormals(P: Float32Array, I: Uint32Array): Float32Array {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
  }
  for (let v = 0; v < N.length; v += 3) { const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; }
  return N;
}

/** '#rrggbb' as 0–1 RGB (sRGB, as the theme's colours are given). */
function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
