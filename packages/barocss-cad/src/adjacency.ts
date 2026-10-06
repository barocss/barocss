import { validateFaceBundle } from './face.js';
import type { FaceBundle } from './face.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { Curve, Point, Surface } from './types.js';

type Six<T> = [T,T,T,T,T,T];
type Seven<T> = [T,T,T,T,T,T,T];
export interface RectangleAdjacencyIds { adjacencyId: string; faceIds: [string,string]; vertexIds: Six<string>; edgeIds: Seven<string> }
export interface QualifiedEdgeReference { faceId: string; edgeId: string; curveId: string }
export interface RectangleAdjacencyUse extends QualifiedEdgeReference { sense: 'forward' | 'reverse' }
export interface RectangleAdjacencyFace { id: string; bundle: FaceBundle }
export interface RectangleAdjacencyVertex { id: string; point: Point }
export interface RectangleAdjacencyEdge { id: string; vertexIds: [string,string]; canonical: QualifiedEdgeReference; uses: RectangleAdjacencyUse[] }
export interface RectangleAdjacency { version: 0; id: string; faces: [RectangleAdjacencyFace,RectangleAdjacencyFace]; vertices: Six<RectangleAdjacencyVertex>; edges: Seven<RectangleAdjacencyEdge> }
export interface RectangleAdjacencyValidationReport { incidenceValid: true; geometryFamily: 'exact-axis-rectangles-v0'; sharedEdges: 1; closed: false; solid: false }

function requireValue(condition: boolean, gate: string, message: string): asserts condition {
  if (!condition) throw new Error('Rectangle adjacency '+gate+' gate: '+message);
}
function snapshot(input: unknown): unknown {
  let remaining = 32768;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= 18,'data','bounded structure exceeded');
    if (typeof value === 'number') { requireValue(Number.isFinite(value),'data','nonfinite scalar'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 128,'data','string exceeds128 characters'); return value; }
    if (typeof value === 'boolean') return value;
    requireValue(value !== null && typeof value === 'object','data','plain values required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,'data','plain data required');
    const keys = Reflect.ownKeys(value);
    requireValue(keys.length <= (array ? 129 : 16),'data','too many own fields');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)),'data','symbols, accessors or nonenumerable fields');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length <= 128 && keys.length === length+1,'data','bounded dense arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { requireValue(Object.hasOwn(descriptors,String(i)),'data','sparse or foreign array field'); result.push(copy(descriptors[String(i)].value,depth+1)); }
      return result;
    }
    const result: Record<string,unknown> = {};
    for (const key of keys as string[]) Object.defineProperty(result,key,{value:copy(descriptors[key].value,depth+1),enumerable:true,writable:true,configurable:true});
    return result;
  };
  return copy(input,0);
}
function record(value: unknown, keys: string[]): Record<string,unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value),'data','record required');
  requireValue(Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key)),'data','foreign or missing field');
  return value as Record<string,unknown>;
}
function tuple(value: unknown, length: number): unknown[] { requireValue(Array.isArray(value) && value.length === length,'data','wrong tuple length'); return value; }
function id(value: unknown): string { requireValue(typeof value === 'string' && value.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),'IDs','invalid identifier'); return value; }
const equal = (a: unknown[],b: unknown[]) => a.length === b.length && a.every((x,i)=>x===b[i]);
function rectangle(bundle: FaceBundle) {
  validateFaceBundle(bundle);
  const surface = bundle.geometry.objects[0] as Surface;
  requireValue(surface.degreeU===1 && surface.degreeV===1 && surface.controlPoints.length===2 && surface.controlPoints[0].length===2,'family','only degree1x1/2x2 rectangles supported');
  requireValue(equal(surface.knotsU,[0,0,1,1]) && equal(surface.knotsV,[0,0,1,1]) && surface.weights.flat().every(w=>w===1),'family','canonical knots and unit weights required');
  requireValue(surface.controlPoints.flat().flat().every(x=>Number.isInteger(x) && Math.abs(x)<=10000),'family','represented integer poles in [-10000,10000] required');
  const origin = surface.controlPoints[0][0], a = surface.controlPoints[1][0].map((x,k)=>x-origin[k]), b = surface.controlPoints[0][1].map((x,k)=>x-origin[k]);
  const axes = (v: number[]) => v.map((x,i)=>x!==0?i:-1).filter(i=>i>=0), aa = axes(a), bb = axes(b);
  requireValue(aa.length===1 && bb.length===1 && aa[0]!==bb[0] && [a[aa[0]],b[bb[0]]].every(x=>Math.abs(x)>=1 && Math.abs(x)<=10000),'family','two distinct signed axes with side magnitudes1..10000 required');
  requireValue(surface.controlPoints[1][1].every((x,k)=>x===origin[k]+a[k]+b[k]),'family','exact parallelogram ordering required');
  const corners = [surface.controlPoints[0][0],surface.controlPoints[1][0],surface.controlPoints[1][1],surface.controlPoints[0][1]];
  for (let i = 0; i < 4; i++) requireValue(equal(bundle.topology.vertices[i].point,corners[i]),'vertices','local vertices must exactly equal pole corners');
  return {origin,a,b,axisA:aa[0],corners};
}
function recognizedPair(left: FaceBundle, right: FaceBundle) {
  const l = rectangle(left), r = rectangle(right);
  requireValue(l.axisA===r.axisA && Math.sign(l.a[l.axisA])===Math.sign(r.a[r.axisA]) && equal(l.b,r.b),'family','same signed A axis and exact B required');
  requireValue(r.origin.every((x,k)=>x===l.origin[k]+l.a[k]),'family','right origin must exactly equal left origin plus A');
  return [l,r] as const;
}
function reference(face: RectangleAdjacencyFace, localIndex: number): QualifiedEdgeReference {
  const edge = face.bundle.topology.edges[localIndex];
  return {faceId:face.id,edgeId:edge.id,curveId:edge.curveId};
}
const canonicalIndices = [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]];
const vertexIndices = [[0,1],[1,2],[2,3],[3,0],[1,4],[4,5],[5,2]];
function sameReference(value: unknown, expected: QualifiedEdgeReference, sense?: 'forward' | 'reverse') {
  const data = record(value,sense ? ['faceId','edgeId','curveId','sense'] : ['faceId','edgeId','curveId']);
  requireValue(data.faceId===expected.faceId && data.edgeId===expected.edgeId && data.curveId===expected.curveId && (sense===undefined || data.sense===sense),'references','wrong qualified owner, local curve/edge or sense');
}

/** Exact restricted coefficient/axis association, not a sewn shell or general face certificate. */
export function validateRectangleAdjacency(input: unknown): RectangleAdjacencyValidationReport {
  const data = record(snapshot(input),['version','id','faces','vertices','edges']);
  requireValue(data.version===0,'data','unsupported descriptor version');
  const faces = tuple(data.faces,2).map(value=>{ const face=record(value,['id','bundle']); id(face.id); return face as unknown as RectangleAdjacencyFace; }) as [RectangleAdjacencyFace,RectangleAdjacencyFace];
  const [l,r] = recognizedPair(faces[0].bundle,faces[1].bundle);
  const vertices = tuple(data.vertices,6).map(value=>record(value,['id','point']));
  const edges = tuple(data.edges,7).map(value=>record(value,['id','vertexIds','canonical','uses']));
  const identifiers = [id(data.id),...faces.map(f=>f.id),...vertices.map(v=>id(v.id)),...edges.map(e=>id(e.id))];
  requireValue(new Set(identifiers).size===16,'IDs','descriptor identifiers must be distinct');
  const corners = [...l.corners,r.corners[1],r.corners[2]];
  for (let i=0;i<6;i++) requireValue(equal(tuple(vertices[i].point,3),corners[i]),'vertices','global point/order must exactly match recognized corners');
  for (let i=0;i<7;i++) {
    const [owner,localIndex] = canonicalIndices[i], expected = reference(faces[owner],localIndex);
    requireValue(equal(tuple(edges[i].vertexIds,2),vertexIndices[i].map(k=>vertices[k].id)),'references','fixed global edge endpoint/order mismatch');
    sameReference(edges[i].canonical,expected);
    const uses = tuple(edges[i].uses,i===1?2:1);
    sameReference(uses[0],expected,'forward');
    if(i===1) sameReference(uses[1],reference(faces[1],3),'reverse');
  }
  const leftCurve = faces[0].bundle.geometry.objects[2] as Curve, rightCurve = faces[1].bundle.geometry.objects[4] as Curve;
  requireValue(leftCurve.controlPoints.every((point,i)=>equal(point,rightCurve.controlPoints[rightCurve.controlPoints.length-1-i])) && equal(leftCurve.weights,rightCurve.weights.slice().reverse()) && equal(leftCurve.knots,rightCurve.knots),'shared geometry','common curves must have exact opposite poles/unit weights/canonical knots');
  for (const t of [0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1]) {
    const lc = evaluateCurveD1(leftCurve,t), rc = evaluateCurveD1(rightCurve,1-t);
    const distance = Math.hypot(...lc.point.map((x,k)=>x-rc.point[k]));
    const derivative = Math.hypot(...lc.derivative.map((x,k)=>x+rc.derivative[k]));
    const norm = Math.hypot(...lc.derivative);
    requireValue(Number.isFinite(distance) && distance<=1e-9 && Number.isFinite(derivative) && Number.isFinite(norm) && derivative<=1e-9*Math.max(1,norm),'shared geometry','selected original-domain position/D1 reversal failed');
  }
  return {incidenceValid:true,geometryFamily:'exact-axis-rectangles-v0',sharedEdges:1,closed:false,solid:false};
}

export function buildRectangleAdjacency(leftBundle: FaceBundle, rightBundle: FaceBundle, inputIds: RectangleAdjacencyIds): RectangleAdjacency {
  const left = snapshot(leftBundle) as FaceBundle, right = snapshot(rightBundle) as FaceBundle;
  const [l,r] = recognizedPair(left,right);
  const ids = record(snapshot(inputIds),['adjacencyId','faceIds','vertexIds','edgeIds']);
  const adjacencyId = id(ids.adjacencyId), faceIds = tuple(ids.faceIds,2).map(id), vertexIds = tuple(ids.vertexIds,6).map(id), edgeIds = tuple(ids.edgeIds,7).map(id);
  requireValue(new Set([adjacencyId,...faceIds,...vertexIds,...edgeIds]).size===16,'IDs','descriptor identifiers must be distinct');
  const faces: [RectangleAdjacencyFace,RectangleAdjacencyFace] = [{id:faceIds[0],bundle:left},{id:faceIds[1],bundle:right}];
  const vertices = [...l.corners,r.corners[1],r.corners[2]].map((point,i)=>({id:vertexIds[i],point:[...point] as Point})) as Six<RectangleAdjacencyVertex>;
  const edges = canonicalIndices.map(([owner,localIndex],i)=>{
    const canonical = reference(faces[owner],localIndex);
    const uses: RectangleAdjacencyUse[] = [{...canonical,sense:'forward'}];
    if(i===1) uses.push({...reference(faces[1],3),sense:'reverse'});
    return {id:edgeIds[i],vertexIds:vertexIndices[i].map(k=>vertexIds[k]) as [string,string],canonical,uses};
  }) as Seven<RectangleAdjacencyEdge>;
  const result: RectangleAdjacency = {version:0,id:adjacencyId,faces,vertices,edges};
  validateRectangleAdjacency(result);
  return result;
}
