import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import { extractSurfaceBoundary } from './boundary.js';
import type { SurfaceBoundary } from './boundary.js';
import { evaluateSurface, surfaceDomain, validateModel, validateSurface } from './math.js';
import type { Curve, Model, Point, Surface } from './types.js';

export type Four<T> = [T, T, T, T];
export type UV = [number, number];
export interface FaceIds { faceId: string; loopId: string; vertexIds: Four<string>; edgeIds: Four<string>; curveIds: Four<string> }
export interface FaceVertex { id: string; point: Point }
export interface FaceEdge { id: string; curveId: string; vertexIds: [string, string] }
export interface FaceUse { edgeId: string; sense: 'forward'; boundary: SurfaceBoundary; pcurve: { domain: UV; uv0: UV; uv1: UV } }
export interface FaceBundle {
  geometry: Model;
  topology: { version: 0; face: { id: string; surfaceId: string; outerLoopId: string; orientation: 'forward' };
    vertices: Four<FaceVertex>; edges: Four<FaceEdge>; loop: { id: string; uses: Four<FaceUse> } };
}
export interface FaceValidationReport { incidenceValid: true; geometricValidity: 'not-certified'; solid: false }

const boundaries: Four<SurfaceBoundary> = ['v-min', 'u-max', 'v-max', 'u-min'];
const fractions = [0, .03, .07, .11, .17, .23, .29, .37, .43, .5, .57, .63, .71, .77, .83, .89, .93, .97, 1];
function requireValue(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

/** Bounded own-data snapshot: never execute accessors, and duplicate aliases. */
function snapshot(input: unknown): unknown {
  let remaining = 8192;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= 10, 'Face data exceeds the bounded structure');
    if (typeof value === 'number') { requireValue(Number.isFinite(value), 'Face numbers must be finite'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 128, 'Face strings exceed 128 characters'); return value; }
    if (typeof value === 'boolean') return value;
    requireValue(value !== null && typeof value === 'object', 'Face data must contain plain values');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'Face data must be plain');
    const keys = Reflect.ownKeys(value);
    requireValue(keys.length <= (array ? 129 : 16), 'Face data has too many own fields');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key]), 'Face data cannot contain symbols or accessors');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length <= 128 && keys.length === length + 1, 'Face arrays must be bounded and dense');
      const output: unknown[] = [];
      for (let i = 0; i < length; i++) {
        requireValue(Object.hasOwn(descriptors, String(i)), 'Face arrays must be dense without foreign fields');
        output.push(copy(descriptors[String(i)].value, depth + 1));
      }
      return output;
    }
    const output: Record<string, unknown> = {};
    for (const key of keys as string[]) Object.defineProperty(output,key,{value:copy(descriptors[key].value,depth+1),enumerable:true,writable:true,configurable:true});
    return output;
  };
  return copy(input, 0);
}
function record(value: unknown, keys: string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected a face record');
  requireValue(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'Unsupported or missing face field');
  return value as Record<string, unknown>;
}
function tuple(value: unknown, count: number): unknown[] { requireValue(Array.isArray(value) && value.length === count, 'Invalid face tuple length'); return value; }
function id(value: unknown): string { requireValue(typeof value === 'string' && value.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'Invalid face subset ID'); return value; }
function native(value: unknown, surface: boolean): Curve | Surface {
  record(value, surface ? ['kind','id','degreeU','degreeV','knotsU','knotsV','controlPoints','weights'] : ['kind','id','degree','knots','controlPoints','weights']);
  const result = value as Curve | Surface;
  requireValue(result.kind === (surface ? 'surface' : 'curve'), 'Unexpected face geometry kind');
  id(result.id);
  return result;
}
function smooth(knots: number[], degree: number, count: number) {
  for (let i = degree + 1; i < count;) {
    let end = i + 1; while (end < count && knots[end] === knots[i]) end++;
    requireValue(degree - (end - i) >= 1, 'Parametric face subset requires C1 interior knots'); i = end;
  }
}
function point(value: unknown): Point { const values = tuple(value, 3); requireValue(values.every(x => typeof x === 'number' && Number.isFinite(x)), 'Expected a finite face point'); return values as Point; }
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x,i) => same(x,b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aa = a as Record<string,unknown>, bb = b as Record<string,unknown>;
    return Object.keys(aa).length === Object.keys(bb).length && Object.keys(aa).every(key => same(aa[key],bb[key]));
  }
  return a === b;
}
function near(actual: number[], expected: number[], derivative = false) {
  const norm = derivative ? Math.hypot(...expected) : 1;
  const error = Math.hypot(...actual.map((value,i) => value - expected[i]));
  requireValue(Number.isFinite(norm) && Number.isFinite(error) && error <= 1e-9 * Math.max(1,norm), 'Face incidence geometry mapping failed');
}
function interpolate(a: number, b: number, f: number): number {
  if (a === b || f === 0) return a;
  if (f === 1) return b;
  return (1-f)*a+f*b;
}
function parameterMaps(surface: Surface) {
  const {u:[u0,u1],v:[v0,v1]} = surfaceDomain(surface);
  const corners: Four<UV> = [[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
  return corners.map((uv0,i) => ({ domain: i % 2 === 0 ? [u0,u1] as UV : [v0,v1] as UV, uv0:[...uv0] as UV, uv1:[...corners[(i+1)%4]] as UV })) as Four<FaceUse['pcurve']>;
}
function sourceSurface(value: unknown): Surface {
  const surface = native(value,true) as Surface;
  validateSurface(surface);
  smooth(surface.knotsU,surface.degreeU,surface.controlPoints.length);
  smooth(surface.knotsV,surface.degreeV,surface.controlPoints[0].length);
  return surface;
}

/** Validate incidence only. A connected parameter rectangle is not certified geometry. */
export function validateFaceBundle(input: unknown): FaceValidationReport {
  const bundle = record(snapshot(input),['geometry','topology']);
  const geometry = record(bundle.geometry,['name','version','lengthUnit','objects']);
  id(geometry.name);
  const objects = tuple(geometry.objects,5);
  const surface = sourceSurface(objects[0]);
  for (let i = 1; i < 5; i++) native(objects[i],false);
  validateModel(geometry as unknown as Model);
  const topology = record(bundle.topology,['version','face','vertices','edges','loop']);
  requireValue(topology.version === 0, 'Unsupported face topology version');
  const face = record(topology.face,['id','surfaceId','outerLoopId','orientation']);
  const loop = record(topology.loop,['id','uses']);
  const vertices = tuple(topology.vertices,4).map(v => record(v,['id','point']));
  const edges = tuple(topology.edges,4).map(e => record(e,['id','curveId','vertexIds']));
  const uses = tuple(loop.uses,4).map(u => record(u,['edgeId','sense','boundary','pcurve']));
  const identifiers = [surface.id,...objects.slice(1).map(o => id((o as Curve).id)),id(face.id),id(loop.id),...vertices.map(v=>id(v.id)),...edges.map(e=>id(e.id))];
  requireValue(new Set(identifiers).size === 15, 'Face IDs must be globally unique');
  requireValue(face.orientation === 'forward' && face.surfaceId === surface.id && face.outerLoopId === loop.id, 'Invalid face references or orientation');
  const maps = parameterMaps(surface), corners = maps.map(map => evaluateSurface(surface,...map.uv0));
  for (let i = 0; i < 4; i++) {
    near(point(vertices[i].point),corners[i]);
    for (let j = 0; j < i; j++) requireValue(Math.hypot(...corners[i].map((x,k)=>x-corners[j][k])) >= 1e-6, 'Face corners must be pairwise distinct by at least 1e-6 mm');
    const curve = objects[i+1] as Curve;
    const expected = extractSurfaceBoundary(surface,{boundary:boundaries[i],id:curve.id});
    requireValue(same(curve,expected), 'Face curve must be the intended exact boundary');
    requireValue(edges[i].curveId === curve.id && same(tuple(edges[i].vertexIds,2),[vertices[i].id,vertices[(i+1)%4].id]), 'Invalid cyclic face edge references');
    requireValue(uses[i].edgeId === edges[i].id && uses[i].sense === 'forward' && uses[i].boundary === boundaries[i], 'Invalid face use order, sense or references');
    const pcurve = record(uses[i].pcurve,['domain','uv0','uv1']);
    requireValue(same(pcurve,maps[i]), 'Invalid original-domain face pcurve');
    for (const f of fractions) {
      const [a,b] = maps[i].domain, t = interpolate(a,b,f);
      const uv = maps[i].uv0.map((x,k)=>interpolate(x,maps[i].uv1[k],f)) as UV;
      const evaluated = evaluateCurveD1(curve,t), evaluatedSurface = evaluateSurfaceD1(surface,...uv);
      near(evaluated.point,evaluatedSurface.point);
      const tangent = i%2===0 ? evaluatedSurface.du : evaluatedSurface.dv;
      near(evaluated.derivative,tangent.map(x=>i>=2?-x:x),true);
      if (f===0) near(evaluated.point,point(vertices[i].point));
      if (f===1) near(evaluated.point,point(vertices[(i+1)%4].point));
    }
  }
  return {incidenceValid:true,geometricValidity:'not-certified',solid:false};
}

/** Build the fixed one-surface/four-boundary incidence subset with explicit IDs. */
export function buildParametricFace(input: Surface, inputIds: FaceIds): FaceBundle {
  const surface = sourceSurface(snapshot(input));
  const data = record(snapshot(inputIds),['faceId','loopId','vertexIds','edgeIds','curveIds']);
  const faceId = id(data.faceId), loopId = id(data.loopId);
  const vertexIds = tuple(data.vertexIds,4).map(id), edgeIds = tuple(data.edgeIds,4).map(id), curveIds = tuple(data.curveIds,4).map(id);
  requireValue(new Set([surface.id,faceId,loopId,...vertexIds,...edgeIds,...curveIds]).size === 15, 'Face IDs must be globally unique');
  const maps = parameterMaps(surface);
  const curves = boundaries.map((boundary,i) => extractSurfaceBoundary(surface,{boundary,id:curveIds[i]}));
  const bundle: FaceBundle = {geometry:{name:'parametric_face',version:0,lengthUnit:'mm',objects:[surface,...curves]},topology:{version:0,
    face:{id:faceId,surfaceId:surface.id,outerLoopId:loopId,orientation:'forward'},
    vertices:maps.map((map,i)=>({id:vertexIds[i],point:evaluateSurface(surface,...map.uv0)})) as Four<FaceVertex>,
    edges:curves.map((curve,i)=>({id:edgeIds[i],curveId:curve.id,vertexIds:[vertexIds[i],vertexIds[(i+1)%4]]})) as Four<FaceEdge>,
    loop:{id:loopId,uses:maps.map((pcurve,i)=>({edgeId:edgeIds[i],sense:'forward',boundary:boundaries[i],pcurve})) as Four<FaceUse>}}};
  validateFaceBundle(bundle);
  return bundle;
}
