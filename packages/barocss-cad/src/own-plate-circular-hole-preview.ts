import { validateOwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';
import type { OwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';
import { evaluateCurve, evaluateSurface, surfaceDomain } from './math.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Point } from './types.js';

export interface OwnPlateHolePreviewContext {
  documentId: string; bodyId: string; documentRevision: string; kernelResultRevision: string; topologyRevision: string; taskToken: string;
}
export interface OwnPlateHolePreviewOptions { context: OwnPlateHolePreviewContext; segmentsPerQuarter?: number }
export interface OwnNativeFaceMeshChunk {
  faceToken: string; nativeFaceId: string; faceOrientation: 'forward' | 'reversed';
  normalSource: 'own-tessellation' | 'native-surface-evaluation' | 'mesh-computed';
  positionsMM: number[]; normals: number[]; parametersUV: number[]; indices: number[];
}
export interface OwnNativeFaceMesh {
  format: 'barocss-native-face-mesh'; version: 0; lengthUnit: 'mm'; nativeFrame: 'part-xyz';
  context: OwnPlateHolePreviewContext; chunks: OwnNativeFaceMeshChunk[];
}
export interface OwnPlateHolePreviewFaceProvenance {
  faceToken: string; nativeFaceId: string; nativeSurfaceId: string; role: string; orientation: 'forward' | 'reverse';
  nativeLoopIds: string[]; nativeEdgeIds: string[];
  panels: { vertexRange: [number, number]; indexRange: [number, number]; normalSampleUV: [number, number]; normal: Point }[];
}
export interface OwnPlateHolePreviewReport {
  kind: 'own-plate-circular-hole-preview'; native: ReturnType<typeof validateOwnPlateCircularHoleBundle>;
  segmentsPerQuarter: number; ringParameters: number[]; faceCount: number; vertexCount: number; triangleCount: number;
  cornerRayObservations: { cornerMM: [number, number]; parameter: number; iterations: number; observedRayResidualMM: number }[];
  maximumCornerRayResidualMM: number; maximumNativeBoundaryDifferenceMM: number;
  normalMethod: 'actual-native-surface-D1-with-face-sense'; approximation: 'sampled-native-circle-ring-and-faceted-surface';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumFaces: 64; maximumVertices: 4096; maximumTriangles: 7938; maximumCornerRayIterations: 56; localBindingComparisonMM: 1e-7 };
}
export interface OwnPlateHolePreviewResult { mesh: OwnNativeFaceMesh; provenance: OwnPlateHolePreviewFaceProvenance[]; report: OwnPlateHolePreviewReport }
const LABEL = 'Own plate hole preview', TOL = 1e-7;
function check(condition: boolean, detail: string): asserts condition { if (!condition) throw new Error((LABEL + ': ' + detail).slice(0, 1024)); }
function snapshot(input: unknown, sourceStrings = false): unknown {
  let remaining = 131072;
  const copy = (v: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (sourceStrings ? 24 : 12), 'bounded own-data values/depth exceeded');
    if (typeof v === 'number') { check(Number.isFinite(v), 'finite numbers required'); return v; }
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') { check(v.length <= (sourceStrings ? 262144 : 512), 'bounded string required'); return v; }
    check(v !== null && typeof v === 'object', 'plain own data required');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign prototype');
    check(keys.length <= (array ? sourceStrings ? 1025 : 23815 : sourceStrings ? 32 : 16), 'own field/array bound');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    check(keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable === true)), 'getter/symbol/hidden data');
    if (array) {
      const n = descriptors.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= (sourceStrings ? 1024 : 23814) && keys.length === n + 1, 'dense bounded array required');
      return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), 'sparse/extra array field'); return copy(descriptors[String(i)].value, depth + 1); });
    }
    return Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(v: unknown, fields: string[]): Record<string, unknown> {
  check(v !== null && typeof v === 'object' && !Array.isArray(v), 'record required');
  const r = v as Record<string, unknown>; check(Object.keys(r).length === fields.length && fields.every(k => Object.hasOwn(r, k)), 'exact fields required: ' + fields.join(',')); return r;
}
function opaque(v: unknown, bound: number): string { check(typeof v === 'string' && v.length >= 1 && v.length <= bound && /^[\x21-\x7e]+$/.test(v), 'bounded printable opaque ASCII required'); return v; }
function admitContext(input: unknown): OwnPlateHolePreviewContext {
  const r = record(input, ['documentId','bodyId','documentRevision','kernelResultRevision','topologyRevision','taskToken']);
  return Object.fromEntries(Object.entries(r).map(([key,v]) => [key, opaque(v,48)])) as unknown as OwnPlateHolePreviewContext;
}
export function validateOwnPlateHolePreviewContext(input: unknown): asserts input is OwnPlateHolePreviewContext { admitContext(snapshot(input)); }
function cross(a: Point,b: Point): Point { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function delta(a: Point,b: Point): Point { return a.map((x,i)=>x-b[i]) as Point; }
function dot(a: Point,b: Point): number { return a.reduce((sum,x,i)=>sum+x*b[i],0); }
function normal(surface: Surface, uv: [number,number], orientation: 'forward'|'reverse'): Point {
  const d = evaluateSurfaceD1(surface,...uv), n = cross(d.du,d.dv), length = Math.hypot(...n);
  check(n.every(Number.isFinite) && Number.isFinite(length) && length > 0,'actual native D1 normal is degenerate');
  return n.map(x=>(orientation==='forward'?1:-1)*x/length) as Point;
}
function triangles(chunk: OwnNativeFaceMeshChunk, a: number,b: number,c: number): void {
  for (const rounded of [false,true]) {
    const point = (i: number) => chunk.positionsMM.slice(i*3,i*3+3).map(x=>rounded?Math.fround(x):x) as Point;
    const vector = cross(delta(point(b),point(a)),delta(point(c),point(a))), length = Math.hypot(...vector);
    check(vector.every(Number.isFinite) && Number.isFinite(length) && length>0,rounded?'Float32 triangle collapsed; native validity is separate':'native triangle collapsed');
    for(const i of [a,b,c]) { const n = chunk.normals.slice(i*3,i*3+3).map(x=>rounded?Math.fround(x):x) as Point; check(dot(vector,n)>0,rounded?'Float32 winding disagrees with native normal':'triangle winding disagrees with native normal'); }
  }
}
function addPanel(chunk: OwnNativeFaceMeshChunk, surface: Surface, orientation: 'forward'|'reverse', uvs: [number,number][], sample: [number,number], panels: OwnPlateHolePreviewFaceProvenance['panels']): void {
  check(uvs.length===4,'four panel vertices required'); const first=chunk.positionsMM.length/3,start=chunk.indices.length,n=normal(surface,sample,orientation);
  for(const uv of uvs) { chunk.positionsMM.push(...evaluateSurface(surface,...uv)); chunk.normals.push(...n); chunk.parametersUV.push(...uv); }
  for(const local of [[0,1,2],[1,3,2]]) {
    let [,b,c]=local.map(i=>first+i); const a=first+local[0]; const uv=(i:number)=>chunk.parametersUV.slice(i*2,i*2+2),A=uv(a),B=uv(b),C=uv(c),signed=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
    check(Number.isFinite(signed)&&signed!==0,'native UV triangle is degenerate');
    // First normalize the parameter triangle, then apply actual face sense once.
    if(signed<0)[b,c]=[c,b]; if(orientation==='reverse')[b,c]=[c,b]; triangles(chunk,a,b,c); chunk.indices.push(a,b,c);
  }
  panels.push({vertexRange:[first,first+4],indexRange:[start,chunk.indices.length],normalSampleUV:sample,normal:n});
}
function planeUV(surface: Surface, point: Point): [number,number] {
  const d=surfaceDomain(surface),O=evaluateSurface(surface,d.u[0],d.v[0]),A=delta(evaluateSurface(surface,d.u[1],d.v[0]),O),B=delta(evaluateSurface(surface,d.u[0],d.v[1]),O),D=delta(point,O),det=A[0]*B[1]-A[1]*B[0];
  check(Number.isFinite(det)&&det!==0,'native XY cap plane map is degenerate'); const u=(D[0]*B[1]-D[1]*B[0])/det,v=(A[0]*D[1]-A[1]*D[0])/det;
  check(Number.isFinite(u)&&Number.isFinite(v)&&u>=0&&u<=1&&v>=0&&v<=1,'native cap UV lies outside source plane');
  const uv:[number,number]=[d.u[0]+u*(d.u[1]-d.u[0]),d.v[0]+v*(d.v[1]-d.v[0])]; check(Math.hypot(...delta(evaluateSurface(surface,...uv),point))<=TOL,'native plane UV correspondence failed'); return uv;
}
function guarded(surface: Surface, axis:'u'|'v', parameter:number): boolean {
  const d=surfaceDomain(surface)[axis],knots=axis==='u'?surface.knotsU:surface.knotsV,degree=axis==='u'?surface.degreeU:surface.degreeV;
  return parameter>d[0]&&parameter<d[1]&&knots.filter(k=>k===parameter).length>=degree;
}
function cornerParameter(curve:Curve,centre:[number,number],corner:[number,number]): {parameter:number;iterations:number;observedRayResidualMM:number} {
  const D:[number,number]=[corner[0]-centre[0],corner[1]-centre[1]],length=Math.hypot(...D); check(length>0&&Number.isFinite(length),'nonzero corner ray required');
  const q=D[0]>0?(D[1]>0?0:3):(D[1]>0?1:2);
  const measure=(u:number)=>{const point=evaluateCurve(curve,u),radial:[number,number]=[point[0]-centre[0],point[1]-centre[1]],cross=radial[0]*D[1]-radial[1]*D[0];check(Number.isFinite(cross)&&radial[0]*D[0]+radial[1]*D[1]>0,'actual native circle corner ray failed');return{cross,residual:Math.abs(cross)/length};};
  let low=q,high=q+1,best=(low+high)/2,error=Infinity,iterations=0;
  for(;iterations<56;iterations++){const mid=low+(high-low)/2;if(!(mid>low&&mid<high))break;const value=measure(mid);if(value.residual<error){best=mid;error=value.residual;}if(value.cross===0){iterations++;break;}if(value.cross>0)low=mid;else high=mid;}
  check(Number.isFinite(error)&&error<=TOL,'corner-ray display binding is not representable');return{parameter:best,iterations,observedRayResidualMM:error};
}
function outerXY(point:Point,centre:[number,number],width:number,height:number): [number,number] {
  const dx=point[0]-centre[0],dy=point[1]-centre[1],tx=dx>0?(width-centre[0])/dx:dx<0?-centre[0]/dx:Infinity,ty=dy>0?(height-centre[1])/dy:dy<0?-centre[1]/dy:Infinity;
  check(Math.min(tx,ty)>1,'strict native hole/rectangle radial clearance required');
  if(tx<=ty){const x=dx>0?width:0,y=centre[1]+(x-centre[0])*(dy/dx);check(Number.isFinite(y)&&y>=0&&y<=height,'outer radial Y not representable');return[x,y];}
  const y=dy>0?height:0,x=centre[0]+(y-centre[1])*(dx/dy);check(Number.isFinite(x)&&x>=0&&x<=width,'outer radial X not representable');return[x,y];
}
export function validateOwnNativeFaceMesh(input: unknown): asserts input is OwnNativeFaceMesh {
  const r=record(snapshot(input),['format','version','lengthUnit','nativeFrame','context','chunks']);check(r.format==='barocss-native-face-mesh'&&r.version===0&&r.lengthUnit==='mm'&&r.nativeFrame==='part-xyz','own native-face-mesh v0 required');admitContext(r.context);check(Array.isArray(r.chunks)&&r.chunks.length>=1&&r.chunks.length<=64,'1..64 face chunks required');let vertices=0,faces=0;const tokens=new Set<string>();
  for(const value of r.chunks){const c=record(value,['faceToken','nativeFaceId','faceOrientation','normalSource','positionsMM','normals','parametersUV','indices']) as unknown as OwnNativeFaceMeshChunk;opaque(c.faceToken,48);opaque(c.nativeFaceId,128);check(!tokens.has(c.faceToken),'duplicate face token');tokens.add(c.faceToken);check(c.faceOrientation==='forward'||c.faceOrientation==='reversed','actual face orientation required');check(['own-tessellation','native-surface-evaluation','mesh-computed'].includes(c.normalSource),'actual normal derivation required');
    check(Array.isArray(c.positionsMM)&&Array.isArray(c.normals)&&Array.isArray(c.parametersUV)&&Array.isArray(c.indices)&&c.positionsMM.length%3===0,'flat native arrays required');const n=c.positionsMM.length/3;check(n>=3&&c.normals.length===n*3&&c.parametersUV.length===n*2&&c.indices.length>=3&&c.indices.length%3===0,'native face array ranks/counts');check(c.positionsMM.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6)&&c.parametersUV.every(x=>typeof x==='number'&&Number.isFinite(x)),'finite native XYZ/UV required');
    for(let i=0;i<n;i++){const vector=c.normals.slice(i*3,i*3+3);check(vector.every(x=>typeof x==='number'&&Number.isFinite(x))&&Math.abs(Math.hypot(...vector)-1)<=1e-5,'unit native normals required');}
    check(c.indices.every(i=>Number.isInteger(i)&&i>=0&&i<n),'local triangle indices required');for(let i=0;i<c.indices.length;i+=3){const [a,b,d]=c.indices.slice(i,i+3);check(a!==b&&a!==d&&b!==d,'distinct triangle indices required');triangles(c,a,b,d);}vertices+=n;faces+=c.indices.length/3;
  }
  check(vertices>=4&&vertices<=4096&&faces>=2&&faces<=7938,'aggregate own face mesh display budget');
}
/** Approximate actual own native cap trims and cavity wall; never a solid gate. */
export function tessellateOwnPlateCircularHole(input: OwnPlateCircularHoleBundle, inputOptions: OwnPlateHolePreviewOptions): OwnPlateHolePreviewResult {
  const owned=snapshot(input,true) as OwnPlateCircularHoleBundle,native=validateOwnPlateCircularHoleBundle(owned),opts=snapshot(inputOptions) as Record<string,unknown>;
  check(opts!==null&&typeof opts==='object'&&!Array.isArray(opts),'options required');const keys=Object.keys(opts);check(Object.hasOwn(opts,'context')&&keys.length>=1&&keys.length<=2&&keys.every(k=>k==='context'||k==='segmentsPerQuarter'),'exact context/optional segmentsPerQuarter required');const context=admitContext(opts.context),k=Object.hasOwn(opts,'segmentsPerQuarter')?opts.segmentsPerQuarter:4;check(typeof k==='number'&&Number.isInteger(k)&&k>=2&&k<=8,'segmentsPerQuarter integer2..8 required');check(context.bodyId===owned.request.bodyId,'context/native body identity mismatch');
  const request=owned.request,bottom=owned.faces.find(f=>f.role==='bottom-cap'),top=owned.faces.find(f=>f.role==='top-cap'),wall=owned.faces.find(f=>f.role==='hole-wall');check(!!bottom&&!!top&&!!wall,'actual native cap/wall faces required');
  const capLoop=(face:typeof bottom)=>{check(!!face&&face.innerLoopIds.length===1,'one original inner trim loop required');const loop=owned.topology.loops.find(l=>l.id===face.innerLoopIds[0]);check(!!loop&&loop.uses.length===1,'one actual rational circle use required');const use=loop.uses[0],edge=owned.topology.edges.find(e=>e.id===use.edgeId);check(!!edge,'original cap circle edge required');return{use,edge};};
  const bottomRing=capLoop(bottom),topRing=capLoop(top),corners:[number,number][]=[[request.widthMM,request.heightMM],[0,request.heightMM],[0,0],[request.widthMM,0]];
  const observations=corners.map(corner=>({cornerMM:corner,...cornerParameter(bottomRing.edge.curve,request.centreMM,corner)}));
  const ring=new Map<number,{corner?:[number,number]}>();for(let i=0;i<=4*k;i++)ring.set(i/k,{});for(const value of observations){check(!ring.get(value.parameter)?.corner,'two exact rectangle corners share one native parameter');ring.set(value.parameter,{corner:value.cornerMM});}const parameters=[...ring.keys()].sort((a,b)=>a-b);check(parameters[0]===0&&parameters.at(-1)===4&&parameters.length<=37,'complete bounded native circle ring required');
  const mesh:OwnNativeFaceMesh={format:'barocss-native-face-mesh',version:0,lengthUnit:'mm',nativeFrame:'part-xyz',context,chunks:[]},provenance:OwnPlateHolePreviewFaceProvenance[]=[];let maxBinding=0;
  for(const [fi,face]of owned.faces.entries()){
    const chunk:OwnNativeFaceMeshChunk={faceToken:'f_'+fi,nativeFaceId:face.id,faceOrientation:face.orientation==='forward'?'forward':'reversed',normalSource:'native-surface-evaluation',positionsMM:[],normals:[],parametersUV:[],indices:[]};const panels:OwnPlateHolePreviewFaceProvenance['panels']=[],loops=owned.topology.loops.filter(l=>l.faceId===face.id);provenance.push({faceToken:chunk.faceToken,nativeFaceId:face.id,nativeSurfaceId:face.surface.id,role:face.role,orientation:face.orientation,nativeLoopIds:loops.map(l=>l.id),nativeEdgeIds:[...new Set(loops.flatMap(l=>l.uses.map(u=>u.edgeId)))],panels});
    if(face.role==='bottom-cap'||face.role==='top-cap'){
      const source=face.role==='bottom-cap'?bottomRing:topRing,uvs=parameters.map(parameter=>{const point=evaluateCurve(source.edge.curve,parameter),pc=evaluateCurve(source.use.pcurve.curve,parameter),inner:[number,number]=[pc[0],pc[1]],actual=evaluateSurface(face.surface,...inner);maxBinding=Math.max(maxBinding,Math.hypot(...delta(actual,point)));const xy=ring.get(parameter)!.corner??outerXY(point,request.centreMM,request.widthMM,request.heightMM),outer=planeUV(face.surface,[...xy,point[2]]);return{inner,outer};});
      for(let i=0;i+1<parameters.length;i++){const panel=[uvs[i].inner,uvs[i].outer,uvs[i+1].inner,uvs[i+1].outer],sample:[number,number]=[panel.reduce((s,p)=>s+p[0],0)/4,panel.reduce((s,p)=>s+p[1],0)/4];addPanel(chunk,face.surface,face.orientation,panel,sample,panels);}
    }else if(face.role==='hole-wall'){
      const d=surfaceDomain(face.surface);check(d.u[0]===0&&d.u[1]===4,'original wall circle domain0..4 required');for(let i=0;i+1<parameters.length;i++){const u0=parameters[i],u1=parameters[i+1],u=u0+(u1-u0)/2,v=d.v[0]+(d.v[1]-d.v[0])/2;check(u>u0&&u<u1&&v>d.v[0]&&v<d.v[1]&&!guarded(face.surface,'u',u)&&!guarded(face.surface,'v',v),'strict original smooth wall midpoint required');addPanel(chunk,face.surface,face.orientation,[[u0,d.v[0]],[u1,d.v[0]],[u0,d.v[1]],[u1,d.v[1]]],[u,v],panels);for(const [curve,fixed]of [[bottomRing.edge.curve,d.v[0]],[topRing.edge.curve,d.v[1]]] as [Curve,number][])for(const t of [u0,u1])maxBinding=Math.max(maxBinding,Math.hypot(...delta(evaluateCurve(curve,t),evaluateSurface(face.surface,t,fixed))));}
    }else{const d=surfaceDomain(face.surface),u=d.u[0]+(d.u[1]-d.u[0])/2,v=d.v[0]+(d.v[1]-d.v[0])/2;check(u>d.u[0]&&u<d.u[1]&&v>d.v[0]&&v<d.v[1],'strict outer native midpoint required');addPanel(chunk,face.surface,face.orientation,[[d.u[0],d.v[0]],[d.u[1],d.v[0]],[d.u[0],d.v[1]],[d.u[1],d.v[1]]],[u,v],panels);}
    mesh.chunks.push(chunk);
  }
  check(maxBinding<=TOL,'actual native trim/wall boundary correspondence failed');validateOwnNativeFaceMesh(mesh);
  return copyCadData({mesh,provenance,report:{kind:'own-plate-circular-hole-preview',native,segmentsPerQuarter:k,ringParameters:parameters,faceCount:mesh.chunks.length,vertexCount:mesh.chunks.reduce((s,c)=>s+c.positionsMM.length/3,0),triangleCount:mesh.chunks.reduce((s,c)=>s+c.indices.length/3,0),cornerRayObservations:observations,maximumCornerRayResidualMM:Math.max(...observations.map(o=>o.observedRayResidualMM)),maximumNativeBoundaryDifferenceMM:maxBinding,normalMethod:'actual-native-surface-D1-with-face-sense',approximation:'sampled-native-circle-ring-and-faceted-surface',geometricValidity:'not-certified',topologyCertified:false,solid:false,limits:{maximumFaces:64,maximumVertices:4096,maximumTriangles:7938,maximumCornerRayIterations:56,localBindingComparisonMM:TOL}}});
}
