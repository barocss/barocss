import { validateFaceBundle } from './face.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { FaceBundle } from './face.js';
import type { Point, Surface, Curve } from './types.js';
import type { QualifiedEdgeReference, RectangleAdjacencyFace, RectangleAdjacencyVertex, RectangleAdjacencyUse } from './adjacency.js';
import { cross, sub } from './vec3.js';

type Six<T> = [T,T,T,T,T,T];
type Eight<T> = [T,T,T,T,T,T,T,T];
type Twelve<T> = [T,T,T,T,T,T,T,T,T,T,T,T];
export interface AxisBoxShellIds { shellId: string; faceIds: Six<string>; vertexIds: Eight<string>; edgeIds: Twelve<string> }
interface ShellEdge { id: string; vertexIds: [string,string]; canonical: QualifiedEdgeReference; uses: [RectangleAdjacencyUse,RectangleAdjacencyUse] }
export interface AxisBoxShell { version: 0; id: string; origin: Point; sides: Point; faces: Six<RectangleAdjacencyFace>; vertices: Eight<RectangleAdjacencyVertex>; edges: Twelve<ShellEdge> }
export interface AxisBoxShellValidationReport { incidenceValid: true; geometryFamily: 'exact-axis-box-shell-v0'; closed: true; solid: false; solidProductImplemented: false }

const faceCorners = [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const edgeCorners = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
const outward = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
function requireValue(condition: boolean, message: string): asserts condition { if (!condition) throw new Error('Axis box shell gate: '+message); }
function snapshot(input: unknown): unknown {
  let remaining = 32768;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= 18,'bounded structure exceeded');
    if (typeof value === 'number') { requireValue(Number.isFinite(value),'finite numbers required'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 128,'string exceeds128'); return value; }
    if (typeof value === 'boolean') return value;
    requireValue(value !== null && typeof value === 'object','plain values required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,'plain data required');
    const keys = Reflect.ownKeys(value);
    requireValue(keys.length <= (array ? 129 : 16),'own field bound exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key==='length' || descriptors[key].enumerable===true)),'accessors, symbols or nonenumerable fields');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length <= 128 && keys.length===length+1,'bounded dense array required');
      const result: unknown[] = [];
      for (let i=0;i<length;i++) { requireValue(Object.hasOwn(descriptors,String(i)),'sparse or foreign array field'); result.push(copy(descriptors[String(i)].value,depth+1)); }
      return result;
    }
    const result: Record<string,unknown> = {};
    for (const key of keys as string[]) Object.defineProperty(result,key,{value:copy(descriptors[key].value,depth+1),enumerable:true,writable:true,configurable:true});
    return result;
  };
  return copy(input,0);
}
function record(value: unknown, keys: string[]): Record<string,unknown> {
  requireValue(value!==null && typeof value==='object' && !Array.isArray(value),'record required');
  requireValue(Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key)),'fixed record fields required'); return value as Record<string,unknown>;
}
function tuple(value: unknown, count: number): unknown[] { requireValue(Array.isArray(value) && value.length===count,'fixed tuple length required'); return value; }
function identifier(value: unknown): string { requireValue(typeof value==='string' && value.length<=128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),'ASCII ID required'); return value; }
function same(a: unknown,b: unknown): boolean {
  if (Array.isArray(a)!==Array.isArray(b)) return false;
  if (a===null || b===null || typeof a!=='object' || typeof b!=='object') return a===b;
  const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>,keys=Object.keys(aa);
  return keys.length===Object.keys(bb).length && keys.every(key=>Object.hasOwn(bb,key) && same(aa[key],bb[key]));
}
function corners(origin: unknown,sides: unknown): Point[] {
  const o=tuple(origin,3),s=tuple(sides,3);
  requireValue(o.every(x=>typeof x==='number' && Number.isInteger(x)) && s.every(x=>typeof x==='number' && Number.isInteger(x) && x>=1 && x<=10000),'integer origin and sides1..10000 required');
  const oo=o as Point,ss=s as Point;
  const points=Array.from({length:8},(_,i)=>oo.map((x,k)=>((i>>k)&1)?x+ss[k]:x) as Point);
  requireValue(points.every(p=>p.every(x=>Number.isFinite(x) && Math.abs(x)<=10000)),'all represented corners must be within10000mm'); return points;
}
function reference(faceId: string,bundle: FaceBundle,index: number): QualifiedEdgeReference {
  const edge=bundle.topology.edges[index];return {faceId,edgeId:edge.id,curveId:edge.curveId};
}
function assemble(origin: Point,sides: Point,bundles: Six<FaceBundle>,inputIds: unknown): AxisBoxShell {
  const ids=record(inputIds,['shellId','faceIds','vertexIds','edgeIds']),id=identifier(ids.shellId),faceIds=tuple(ids.faceIds,6).map(identifier),vertexIds=tuple(ids.vertexIds,8).map(identifier),edgeIds=tuple(ids.edgeIds,12).map(identifier);
  requireValue(new Set([id,...faceIds,...vertexIds,...edgeIds]).size===27,'27distinct global IDs required');
  const points=corners(origin,sides);
  const localUses=faceCorners.flatMap((vertices,fi)=>vertices.map((start,ei)=>({start,end:vertices[(ei+1)%4],ref:reference(faceIds[fi],bundles[fi],ei)})));
  return {version:0,id,origin:[...origin],sides:[...sides],faces:faceIds.map((id,i)=>({id,bundle:bundles[i]})) as Six<RectangleAdjacencyFace>,vertices:points.map((point,i)=>({id:vertexIds[i],point})) as Eight<RectangleAdjacencyVertex>,edges:edgeCorners.map(([start,end],i)=>{
    const forward=localUses.filter(use=>use.start===start && use.end===end),reverse=localUses.filter(use=>use.start===end && use.end===start);
    requireValue(forward.length===1 && reverse.length===1,'fixed one forward/one reverse association required');
    return {id:edgeIds[i],vertexIds:[vertexIds[start],vertexIds[end]],canonical:{...forward[0].ref},uses:[{...forward[0].ref,sense:'forward'},{...reverse[0].ref,sense:'reverse'}]};
  }) as Twelve<ShellEdge>};
}
function near(actual: number[],expected: number[],derivative=false) {
  const error=Math.hypot(...sub(actual,expected)),norm=derivative?Math.hypot(...expected):1;
  requireValue(Number.isFinite(error) && Number.isFinite(norm) && error<=1e-9*Math.max(1,norm),'selected native position/D1 mapping failed');
}
function connected(adjacency: Set<number>[]): boolean {
  const seen=new Set([0]),queue=[0];
  while (queue.length) for (const next of adjacency[queue.shift()!]) if (!seen.has(next)) { seen.add(next);queue.push(next); }
  return seen.size===adjacency.length;
}

/** Restricted outward closed boundary only. No global solid certificate or volume report. */
export function validateAxisBoxShell(input: unknown): AxisBoxShellValidationReport {
  const d=record(snapshot(input),['version','id','origin','sides','faces','vertices','edges']);requireValue(d.version===0,'version0 required');
  const points=corners(d.origin,d.sides),origin=d.origin as Point,sides=d.sides as Point;
  const faces=tuple(d.faces,6).map(face=>record(face,['id','bundle'])),vertices=tuple(d.vertices,8).map(vertex=>record(vertex,['id','point'])),edges=tuple(d.edges,12).map(edge=>record(edge,['id','vertexIds','canonical','uses']));
  const bundles=faces.map(face=>{identifier(face.id);validateFaceBundle(face.bundle);return face.bundle as FaceBundle;}) as Six<FaceBundle>;
  const expected=assemble(origin,sides,bundles,{shellId:d.id,faceIds:faces.map(face=>face.id),vertexIds:vertices.map(v=>v.id),edgeIds:edges.map(e=>e.id)});
  requireValue(same(d,expected),'fixed global coordinates/reference/order/sense association failed');
  for (let i=0;i<6;i++) {
    const native=bundles[i].geometry.objects[0] as Surface,p=faceCorners[i].map(k=>points[k]);
    requireValue(native.kind==='surface' && native.degreeU===1 && native.degreeV===1 && same(native.knotsU,[0,0,1,1]) && same(native.knotsV,[0,0,1,1]) && same(native.weights,[[1,1],[1,1]]),'canonical degree1 unit rectangle required');
    requireValue(same(native.controlPoints,[[p[0],p[3]],[p[1],p[2]]]),'exact full min/max face planes and outward coefficients required');
    bundles[i].topology.vertices.forEach((v,j)=>requireValue(same(v.point,p[j]),'local vertices must exactly match box corners'));
    const a=sub(p[1],p[0]),b=sub(p[3],p[0]),normal=cross(a,b),area=Math.hypot(...normal),axis=Math.floor(i/2),plane=origin[axis]+(i%2)*sides[axis];
    requireValue(Number.isFinite(area) && area>0 && same(normal.map(x=>x===0?0:Math.sign(x)),outward[i]) && p.every(v=>v[axis]===plane),'six distinct outward regular half-space planes required');
    const d1=evaluateSurfaceD1(native,.5,.5);near(d1.point,p[0].map((x,k)=>x+.5*(a[k]+b[k])));near(d1.du,a,true);near(d1.dv,b,true);near(cross(d1.du,d1.dv),normal,true);
  }
  const reached=new Set<string>(),faceAdjacency=Array.from({length:6},()=>new Set<number>()),vertexAdjacency=Array.from({length:8},()=>new Set<number>());
  for (let i=0;i<12;i++) {
    const [start,end]=edgeCorners[i],direction=sub(points[end],points[start]),edge=edges[i],owners: number[]=[];record(edge.canonical,['faceId','edgeId','curveId']);
    for (const [j,value] of tuple(edge.uses,2).entries()) {
      const use=record(value,['faceId','edgeId','curveId','sense']),owner=faces.findIndex(face=>face.id===use.faceId);requireValue(owner>=0,'qualified owner required');owners.push(owner);
      const local=bundles[owner].topology.edges.find(e=>e.id===use.edgeId);requireValue(local!==undefined && local.curveId===use.curveId && use.sense===(j===0?'forward':'reverse'),'qualified local edge/curve and opposite use required');
      const curve=bundles[owner].geometry.objects.find(o=>o.id===use.curveId) as Curve;
      const poles=j===0?[points[start],points[end]]:[points[end],points[start]];
      requireValue(curve?.kind==='curve' && same(curve.controlPoints,poles) && same(curve.weights,[1,1]) && same(curve.knots,[0,0,1,1]),'actual boundary must exactly match canonical/reflected segment');
      const key=JSON.stringify([use.faceId,use.edgeId,use.curveId]);requireValue(!reached.has(key),'local use duplicated');reached.add(key);
      for (const t of [0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1]) {
        const value=evaluateCurveD1(curve,j===0?t:1-t);near(value.point,points[start].map((x,k)=>x+t*direction[k]));near(value.derivative,direction.map(x=>j===0?x:-x),true);
      }
    }
    requireValue(owners[0]!==owners[1],'two distinct incident face owners required');faceAdjacency[owners[0]].add(owners[1]);faceAdjacency[owners[1]].add(owners[0]);vertexAdjacency[start].add(end);vertexAdjacency[end].add(start);
  }
  requireValue(reached.size===24 && connected(faceAdjacency) && connected(vertexAdjacency),'all24 reachable uses and connected face/vertex graphs required');
  return {incidenceValid:true,geometryFamily:'exact-axis-box-shell-v0',closed:true,solid:false,solidProductImplemented:false};
}

export function buildAxisBoxShell(origin: Point,sides: Point,inputBundles: Six<FaceBundle>,inputIds: AxisBoxShellIds): AxisBoxShell {
  const data=tuple(snapshot([origin,sides,inputBundles,inputIds]),4),o=data[0] as Point,s=data[1] as Point,bundles=tuple(data[2],6) as Six<FaceBundle>;
  corners(o,s);bundles.forEach(bundle=>validateFaceBundle(bundle));const shell=assemble(o,s,bundles,data[3]);validateAxisBoxShell(shell);return shell;
}
