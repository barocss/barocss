import { CadNumericPolicy } from '../numeric-policy.js';
import { evaluateSurfaceD1 } from '../derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from '../derivatives.js';
import { validateConvexPlanarFaceWithHoles } from './own-convex-planar-face-holes.js';
import type { ConvexPlanarFaceWithHolesResult } from './own-convex-planar-face-holes.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, directedUVDeterminant } from './own-affine-plane-loop-internal.js';
import { copyCadData } from '../data-copy.js';
import type { Point } from '../types.js';

export interface ConvexHoleMeshVertex {
  index:number;nativeVertexId:string;loopId:string;loopRole:'outer'|'inner';uv:[number,number];surfaceD1:SurfaceD1Result;
  orientedNormal:Point;originalPointMM:Point;originalSurfaceDifferenceMM:number;
}
export interface ConvexHoleMeshBoundaryPath {
  loopId:string;loopRole:'outer'|'inner';edgeId:string;curveId:string;useId:string;pcurveId:string;sense:'forward'|'reverse';
  interval:[number,number];vertexIndices:[number,number];nativeVertexIds:[string,string];
  samples:{parameter:number;lineD1:CurveD1Result;pcurveD1:CurveD1Result;surfaceD1:SurfaceD1Result;pointDifferenceMM:number}[];
}
export interface ConvexHoleMeshEdgeUse {triangleId:string;from:number;to:number}
export interface ConvexHoleMeshTriangulation {
  method:'maximal-visible-native-vertex-planar-graph';
  bridges:{id:string;vertexIndices:[number,number];nativeVertexIds:[string,string]}[];
  internalEdges:{id:string;vertexIndices:[number,number];uses:ConvexHoleMeshEdgeUse[]}[];
  triangles:{id:string;vertexIndices:[number,number,number];signedAreaUV:number}[];
  boundaryIncidence:{edgeId:string;curveId:string;loopId:string;vertexIndices:[number,number];uses:ConvexHoleMeshEdgeUse[]}[];
}
export interface ConvexPlanarFaceWithHolesMeshReport {
  family:'own-native-convex-planar-hole-face-material-mesh';faceId:string;meshId:string;vertexCount:number;triangleCount:number;boundaryCount:number;
  internalEdgeCount:number;bridgeCount:number;expectedTriangleCount:number;incidenceValid:true;materialCoverageObserved:true;
  outerAreaUV:number;holeAreasUV:number[];materialAreaUV:number;triangleAreaUV:number;areaDifferenceUV:number;areaToleranceUV:number;
  surfaceJacobianMM2:number;materialAreaMM2:number;triangleAreaMM2:number;areaDifferenceMM2:number;
  geometricValidity:'not-certified';topologyCertified:false;solid:false;
  proof:{boundaryOneUse:true;internalOppositeUses:true;triangleNonoverlap:true;holeExclusion:true;exactTriangleCount:true;guardedUVArea:true;noSteinerVertices:true};
  nativeBindingResiduals:{maximumVertexSurfaceMM:number;maximumBoundaryLineSurfaceMM:number};
  numericPolicy:{predicate:'exact-zero-or-64-epsilon-uncertainty-refusal';uvArea:'128-epsilon-scaled-area-sum';relativePhysicalArea:1e-7;
    materialProof:'original-boundary-visibility-open-hole-halfspaces-and-all-vertex-separating-axes';positions:'actual-original-surface-d1-binary64'};
  limits:{maximumVertices:15;maximumBoundaries:15;maximumHoles:2;maximumTriangles:17;maximumInternalEdges:18;maximumBridges:2;
    positions:45;normals:45;parametersUV:30;indices:51;snapshotValues:131072;snapshotDepth:24;arrayElements:512;recordFields:48;sourceStringCharacters:262144};
}
export interface ConvexPlanarFaceWithHolesMeshResult {
  face:ConvexPlanarFaceWithHolesResult;
  mesh:{id:string;positionsMM:number[];normals:number[];parametersUV:number[];indices:number[];vertices:ConvexHoleMeshVertex[]};
  boundaryPaths:ConvexHoleMeshBoundaryPath[];triangulation:ConvexHoleMeshTriangulation;report:ConvexPlanarFaceWithHolesMeshReport;
}
const LABEL='Own convex planar hole-face material mesh',TOL=CadNumericPolicy.linearToleranceMM,EPS=64*Number.EPSILON;
function check(c:boolean,detail:string):asserts c {if(!c)throw new Error((LABEL+': '+detail).slice(0,1024));}
function finite(n:number):number {check(Number.isFinite(n),'finite native homogeneous/Gram arithmetic required');return n;}
function snapshot(input:unknown,results=false):unknown {
  let budget=results?131072:65536;const copy=(v:unknown,depth:number):unknown=>{check(--budget>=0&&depth<=(results?24:20),'own-data values/depth bound');if(v===null&&results)return null;if(typeof v==='number'){check(Number.isFinite(v),'finite own numbers');return v;}if(typeof v==='string'){check(v.length<=(results?262144:128),'bounded own string');return v;}if(typeof v==='boolean'&&results)return v;check(v!==null&&typeof v==='object','plain own data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'foreign own-data prototype');check(keys.length<=(array?(results?513:65):(results?48:16))&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable===true)),'getter/symbol/hidden/excess own data');if(array){const n=descriptors.length.value as number;check(Number.isInteger(n)&&n>=0&&n<=(results?512:64)&&keys.length===n+1,'dense bounded own array');return Array.from({length:n},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'sparse own array');return copy(descriptors[String(i)].value,depth+1);});}return Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));};return copy(input,0);
}
function id(v:unknown):string {check(typeof v==='string'&&v.length<=48&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(v),'ASCII ID1..48 required');return v;}
function same(a:unknown,b:unknown):boolean {if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}return Object.is(a,b);}
function delta(a:Point,b:Point):Point{return a.map((x,i)=>finite(x-b[i])) as Point;}
function dot(a:Point,b:Point):number{return finite(a.reduce((s,x,i)=>{const product=finite(x*b[i]);check(x===0||b[i]===0||product!==0,'nonzero native dot-product term underflowed to zero');return finite(s+product);},0));}

function multiply(a:number,b:number):number {const value=finite(a*b);check(a===0||b===0||value!==0,'nonzero native tangent product underflowed to zero');return value;}
function cross(a:Point,b:Point):Point{return[finite(multiply(a[1],b[2])-multiply(a[2],b[1])),finite(multiply(a[2],b[0])-multiply(a[0],b[2])),finite(multiply(a[0],b[1])-multiply(a[1],b[0]))];}
function normal(surface:SurfaceD1Result,sense:'forward'|'reverse'):Point {const value=cross(surface.du,surface.dv),length=finite(Math.hypot(...value));check(length>0,'actual native Surface D1 normal not represented');return value.map(v=>finite(v/length)*(sense==='forward'?1:-1)) as Point;}

/** Internal shared UV predicates; original convex-hole admission and numeric operations stay unchanged. */
export function createNativeUVGraphPredicates(
  uv: Point[], check: (condition: boolean, detail: string) => void,
  label: string = LABEL, tick?: () => void,
) {
  const key=(a:number,b:number):string=>a<b?a+':'+b:b+':'+a;
  const determinant = (a: Point, b: Point) => { tick?.(); return directedUVDeterminant(a, b, label); };
  const orientation=(a:number,b:number,c:number):number=>{const measure=determinant(delta(uv[b],uv[a]),delta(uv[c],uv[a]));check(measure.value===0||Math.abs(measure.value)>measure.threshold,'unsafe nonzero display orientation; native validity unchanged');return measure.value;};
  const onSegment=(a:number,b:number,p:number):boolean=>uv[p][0]>=Math.min(uv[a][0],uv[b][0])&&uv[p][0]<=Math.max(uv[a][0],uv[b][0])&&uv[p][1]>=Math.min(uv[a][1],uv[b][1])&&uv[p][1]<=Math.max(uv[a][1],uv[b][1]);
  const compatibleSegments=(a:number,b:number,c:number,d:number):boolean=>{
    if(key(a,b)===key(c,d))return true;const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);
    if((o1>0&&o2<0||o1<0&&o2>0)&&(o3>0&&o4<0||o3<0&&o4>0))return false;
    for(const [p,o]of [[c,o1],[d,o2]] as const)if(o===0&&onSegment(a,b,p)&&p!==a&&p!==b)return false;
    for(const [p,o]of [[a,o3],[b,o4]] as const)if(o===0&&onSegment(c,d,p)&&p!==c&&p!==d)return false;
    return true;
  };
  const separatedPolygons=(a:number[],b:number[]):boolean=>{
    for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
      const start=polygon[i],end=polygon[(i+1)%polygon.length],direction=delta(uv[end],uv[start]),project=(index:number)=>determinant(direction,delta(uv[index],uv[start])),pa=a.map(project),pb=b.map(project),maxA=Math.max(...pa.map(value=>value.value)),minA=Math.min(...pa.map(value=>value.value)),maxB=Math.max(...pb.map(value=>value.value)),minB=Math.min(...pb.map(value=>value.value)),gap=Math.max(finite(minB-maxA),finite(minA-maxB)),threshold=finite(EPS*finite(Math.abs(minA)+Math.abs(maxA)+Math.abs(minB)+Math.abs(maxB))+Math.max(...pa.map(value=>value.threshold))+Math.max(...pb.map(value=>value.threshold)));
      if(gap===0)return true;if(gap>threshold)return true;
    }
    return false;
  };
  return { orientation, onSegment, compatibleSegments, separatedPolygons };
}

/** Native vertices only. Display predicates can refuse an otherwise admitted native face. */
export function tessellateConvexPlanarFaceWithHoles(faceInput:ConvexPlanarFaceWithHolesResult):ConvexPlanarFaceWithHolesMeshResult {
  const face=snapshot(faceInput,true) as ConvexPlanarFaceWithHolesResult;validateConvexPlanarFaceWithHoles(face);const prefix=face.options.resultIdPrefix,role=(suffix:string):string=>id(prefix+suffix),generated=[role('_mesh')];for(let i=0;i<2;i++)generated.push(role('_mesh_bridge_'+i));for(let i=0;i<18;i++)generated.push(role('_mesh_diag_'+i));for(let i=0;i<17;i++)generated.push(role('_mesh_tri_'+i));
  const originals=new Set<string>(),collect=(value:unknown):void=>{if(Array.isArray(value)){value.forEach(collect);return;}if(value!==null&&typeof value==='object')for(const[key,item]of Object.entries(value)){if(typeof item==='string'&&(key==='id'||key.endsWith('Id')||key==='name'))originals.add(item);else collect(item);}};collect(face);check(new Set(generated).size===generated.length&&generated.every(value=>!originals.has(value)),'all display roles must be distinct from actual original native face identities');
  const axes=buildAffinePlaneAxes(face.plane,LABEL),vertices:ConvexHoleMeshVertex[]=face.topology.vertices.map((vertex,index)=>{
    const uv=mapAffinePlanePointToUV(vertex.point,axes,LABEL);check(uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1],'original native vertex outside actual Surface chart');const surfaceD1=evaluateSurfaceD1(face.plane,uv[0],uv[1]),orientedNormal=normal(surfaceD1,face.options.orientation),originalSurfaceDifferenceMM=finite(Math.hypot(...delta(vertex.point,surfaceD1.point)));check(originalSurfaceDifferenceMM<=TOL,'actual native vertex/Surface D1 binding exceeds local policy');return{index,nativeVertexId:vertex.id,loopId:vertex.loopId,loopRole:vertex.loopRole,uv:[uv[0],uv[1]],surfaceD1,orientedNormal,originalPointMM:vertex.point,originalSurfaceDifferenceMM};
  });check(vertices.length<=15,'at most15 actual native mesh vertices');const uv=vertices.map(vertex=>[vertex.uv[0],vertex.uv[1],0] as Point),nativeIndex=new Map(vertices.map(vertex=>[vertex.nativeVertexId,vertex.index])),loopIndices=face.topology.loops.map(loop=>face.topology.vertices.filter(vertex=>vertex.loopId===loop.id).map(vertex=>{const index=nativeIndex.get(vertex.id);check(index!==undefined,'native vertex index association');return index;}));
  const boundaryPairs=face.topology.edges.map(edge=>{const a=nativeIndex.get(edge.vertexIds[0]),b=nativeIndex.get(edge.vertexIds[1]);check(a!==undefined&&b!==undefined,'actual native boundary endpoint association');return{edge,pair:[a,b] as [number,number]};});
  const key=(a:number,b:number):string=>a<b?a+':'+b:b+':'+a;
  const {orientation,compatibleSegments,separatedPolygons}=createNativeUVGraphPredicates(uv,check,LABEL);
  const openHolePassage=(a:number,b:number,hole:number[]):boolean=>{
    const topologyLoop=face.topology.loops.find(loop=>loop.id===vertices[hole[0]].loopId);check(topologyLoop!==undefined,'actual hole orientation association');const sign=topologyLoop.authoredOrientation==='ccw'?1:-1;let low=0,high=1;
    for(let i=0;i<hole.length;i++){
      const start=hole[i],end=hole[(i+1)%hole.length],h0=finite(sign*orientation(start,end,a)),h1=finite(sign*orientation(start,end,b)),change=finite(h1-h0);
      if(change===0){if(h0<=0)return false;continue;}const bound=finite(-h0/change);check(h0===0||bound!==0,'nonzero display visibility root underflowed');if(change>0)low=Math.max(low,bound);else high=Math.min(high,bound);
    }
    if(low===high)return false;const difference=finite(high-low),uncertainty=finite(EPS*finite(Math.abs(low)+Math.abs(high)+1));check(Math.abs(difference)>uncertainty,'display visibility open-hole interval order uncertain');return low<high;
  };
  const materialSegment=(a:number,b:number):boolean=>{
    for(const boundary of boundaryPairs)if(!compatibleSegments(a,b,boundary.pair[0],boundary.pair[1]))return false;
    for(const hole of loopIndices.slice(1))if(openHolePassage(a,b,hole))return false;return true;
  };
  const graph=new Map<string,{pair:[number,number];boundary:boolean;bridge:boolean}>();for(const boundary of boundaryPairs)graph.set(key(...boundary.pair),{pair:boundary.pair,boundary:true,bridge:false});
  const parents=vertices.map((_,i)=>i),find=(i:number):number=>{while(parents[i]!==i)i=parents[i];return i;},join=(a:number,b:number):boolean=>{const x=find(a),y=find(b);if(x===y)return false;parents[y]=x;return true;};for(const boundary of boundaryPairs)join(...boundary.pair);
  const candidates:{pair:[number,number];lengthSquared:number}[]=[];for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++){if(graph.has(key(a,b)))continue;const difference=delta(uv[a],uv[b]),lengthSquared=finite(multiply(difference[0],difference[0])+multiply(difference[1],difference[1]));check(lengthSquared>0,'distinct native mesh vertices have unrepresented UV distance');candidates.push({pair:[a,b],lengthSquared});}
  candidates.sort((a,b)=>a.lengthSquared<b.lengthSquared?-1:a.lengthSquared>b.lengthSquared?1:a.pair[0]-b.pair[0]||a.pair[1]-b.pair[1]);
  let bridgeCount=0;
  for(const candidate of candidates){const [a,b]=candidate.pair;if(!materialSegment(a,b))continue;if([...graph.values()].some(edge=>!compatibleSegments(a,b,...edge.pair)))continue;const bridge=join(a,b);if(bridge)check(++bridgeCount<=2,'at mosttwo native-vertex component bridges');graph.set(key(a,b),{pair:candidate.pair,boundary:false,bridge});}
  check(vertices.every((_,i)=>find(i)===find(0)),'native visibility graph cannot connect every admitted material loop');
  const insideTriangle=(triangle:number[],point:number):boolean=>triangle.every((a,i)=>orientation(a,triangle[(i+1)%3],point)>=0),triangles:{vertices:[number,number,number];area:number}[]=[];
  for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++)for(let c=b+1;c<vertices.length;c++){
    if(!graph.has(key(a,b))||!graph.has(key(b,c))||!graph.has(key(c,a)))continue;const value=orientation(a,b,c);if(value===0)continue;const triangle:[number,number,number]=value>0?[a,b,c]:[a,c,b];if(vertices.some((_,index)=>!triangle.includes(index)&&insideTriangle(triangle,index)))continue;if(loopIndices.slice(1).some(hole=>!separatedPolygons(triangle,hole)))continue;triangles.push({vertices:triangle,area:Math.abs(value)/2});
  }
  const expectedTriangleCount=vertices.length+2*face.holeLoops.length-2;check(expectedTriangleCount<=17&&triangles.length===expectedTriangleCount,'native constrained graph does not admit the exact material triangle count');
  for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++)check(separatedPolygons(triangles[i].vertices,triangles[j].vertices),'actual triangle interiors overlap; display refused');
  const winding=face.options.orientation==='forward'?1:-1,meshIndices=triangles.flatMap(triangle=>winding===1?triangle.vertices:[triangle.vertices[0],triangle.vertices[2],triangle.vertices[1]]),meshTriangles:ConvexHoleMeshTriangulation['triangles']=triangles.map((triangle,i)=>({id:role('_mesh_tri_'+i),vertexIndices:meshIndices.slice(3*i,3*i+3) as [number,number,number],signedAreaUV:winding*triangle.area})),uses=new Map<string,ConvexHoleMeshEdgeUse[]>();
  for(const triangle of meshTriangles)for(let i=0;i<3;i++){const from=triangle.vertexIndices[i],to=triangle.vertexIndices[(i+1)%3],k=key(from,to),list=uses.get(k)??[];list.push({triangleId:triangle.id,from,to});uses.set(k,list);}
  const boundaryIncidence:ConvexHoleMeshTriangulation['boundaryIncidence']=boundaryPairs.map(boundary=>{const edgeUses=uses.get(key(...boundary.pair));check(edgeUses!==undefined&&edgeUses.length===1,'every true original native boundary must have exactlyone mesh use');return{edgeId:boundary.edge.id,curveId:boundary.edge.curveId,loopId:boundary.edge.loopId,vertexIndices:boundary.pair,uses:edgeUses};});
  const internalEdges:ConvexHoleMeshTriangulation['internalEdges']=[],bridges:ConvexHoleMeshTriangulation['bridges']=[];let diagonalCount=0;
  for(const edge of graph.values())if(!edge.boundary){const edgeUses=uses.get(key(...edge.pair));check(edgeUses!==undefined&&edgeUses.length===2&&edgeUses[0].from===edgeUses[1].to&&edgeUses[0].to===edgeUses[1].from,'each internal indexed edge must have two opposite uses');const id=edge.bridge?role('_mesh_bridge_'+bridges.length):role('_mesh_diag_'+diagonalCount++);internalEdges.push({id,vertexIndices:edge.pair,uses:edgeUses});if(edge.bridge)bridges.push({id,vertexIndices:edge.pair,nativeVertexIds:[vertices[edge.pair[0]].nativeVertexId,vertices[edge.pair[1]].nativeVertexId]});}
  check(internalEdges.length<=18&&bridges.length===face.holeLoops.length&&internalEdges.length===vertices.length+3*face.holeLoops.length-3,'indexed hole-family Euler/internal-edge/bridge incidence mismatch');check(uses.size===graph.size,'mesh contains an unproved indexed edge');
  const loopArea=(indices:number[]):number=>{let area=0;for(let i=1;i<indices.length-1;i++)area=finite(area+orientation(indices[0],indices[i],indices[i+1])/2);return Math.abs(area);},outerAreaUV=loopArea(loopIndices[0]),holeAreasUV=loopIndices.slice(1).map(loopArea),holeAreaSum=finite(holeAreasUV.reduce((sum,area)=>finite(sum+area),0)),materialAreaUV=finite(outerAreaUV-holeAreaSum);check(materialAreaUV>EPS*finite(outerAreaUV+holeAreaSum),'native material area cancellation is unsafe');const triangleAreaUV=finite(triangles.reduce((sum,triangle)=>finite(sum+triangle.area),0)),areaDifferenceUV=Math.abs(finite(materialAreaUV-triangleAreaUV)),areaToleranceUV=finite(128*Number.EPSILON*finite(materialAreaUV+triangleAreaUV));check(areaDifferenceUV<=areaToleranceUV,'guarded native outer-minus-holes UV area differs from material triangles');
  const surfaceJacobianMM2=finite(Math.hypot(...cross(vertices[0].surfaceD1.du,vertices[0].surfaceD1.dv))),materialAreaMM2=multiply(materialAreaUV,surfaceJacobianMM2);let triangleAreaMM2=0;
  for(const triangle of meshTriangles){const [a,b,c]=triangle.vertexIndices,areaVector=cross(delta(vertices[b].surfaceD1.point,vertices[a].surfaceD1.point),delta(vertices[c].surfaceD1.point,vertices[a].surfaceD1.point)),area=finite(Math.hypot(...areaVector)/2);check(area>0&&triangle.vertexIndices.every(index=>dot(areaVector,vertices[index].orientedNormal)>0),'actual binary64 native Surface positions have degenerate or wrong-winding triangles');triangleAreaMM2=finite(triangleAreaMM2+area);}
  const areaDifferenceMM2=Math.abs(finite(materialAreaMM2-triangleAreaMM2));check(areaDifferenceMM2<=TOL*Math.max(1,materialAreaMM2),'observed native Surface area mapping exceeds local display policy');
  const boundaryPaths:ConvexHoleMeshBoundaryPath[]=face.topology.loops.flatMap(loop=>loop.uses.map(use=>{const edge=face.topology.edges.find(edge=>edge.id===use.edgeId);check(edge!==undefined,'actual original boundary edge association');const start=nativeIndex.get(use.vertexIds[0]),end=nativeIndex.get(use.vertexIds[1]);check(start!==undefined&&end!==undefined,'directed native boundary vertex association');const samples=face.bindings.filter(binding=>binding.useId===use.id).map(binding=>({parameter:binding.parameter,lineD1:binding.lineD1,pcurveD1:binding.pcurveD1,surfaceD1:binding.surfaceD1,pointDifferenceMM:binding.pointDifferenceMM}));check(samples.length===3,'actual native Line/pcurve/Surface boundary samples required');return{loopId:loop.id,loopRole:loop.role,edgeId:edge.id,curveId:edge.curveId,useId:use.id,pcurveId:use.pcurveId,sense:use.sense,interval:use.interval,vertexIndices:[start,end] as [number,number],nativeVertexIds:use.vertexIds,samples};}));
  for(const path of boundaryPaths){const incidence=boundaryIncidence.find(value=>value.edgeId===path.edgeId);check(incidence!==undefined&&incidence.uses[0].from===path.vertexIndices[0]&&incidence.uses[0].to===path.vertexIndices[1],'actual mesh boundary traversal differs from the true native face use');}
  const mesh={id:role('_mesh'),positionsMM:vertices.flatMap(vertex=>vertex.surfaceD1.point),normals:vertices.flatMap(vertex=>vertex.orientedNormal),parametersUV:vertices.flatMap(vertex=>vertex.uv),indices:meshIndices,vertices},triangulation:ConvexHoleMeshTriangulation={method:'maximal-visible-native-vertex-planar-graph',bridges,internalEdges,triangles:meshTriangles,boundaryIncidence},result:ConvexPlanarFaceWithHolesMeshResult=copyCadData({face,mesh,boundaryPaths,triangulation,report:{family:'own-native-convex-planar-hole-face-material-mesh',faceId:face.options.faceId,meshId:mesh.id,vertexCount:vertices.length,triangleCount:triangles.length,boundaryCount:boundaryPaths.length,internalEdgeCount:internalEdges.length,bridgeCount:bridges.length,expectedTriangleCount,incidenceValid:true,materialCoverageObserved:true,outerAreaUV,holeAreasUV,materialAreaUV,triangleAreaUV,areaDifferenceUV,areaToleranceUV,surfaceJacobianMM2,materialAreaMM2,triangleAreaMM2,areaDifferenceMM2,geometricValidity:'not-certified',topologyCertified:false,solid:false,proof:{boundaryOneUse:true,internalOppositeUses:true,triangleNonoverlap:true,holeExclusion:true,exactTriangleCount:true,guardedUVArea:true,noSteinerVertices:true},nativeBindingResiduals:{maximumVertexSurfaceMM:Math.max(...vertices.map(vertex=>vertex.originalSurfaceDifferenceMM)),maximumBoundaryLineSurfaceMM:Math.max(...boundaryPaths.flatMap(path=>path.samples.map(sample=>sample.pointDifferenceMM)))},numericPolicy:{predicate:'exact-zero-or-64-epsilon-uncertainty-refusal',uvArea:'128-epsilon-scaled-area-sum',relativePhysicalArea:TOL,materialProof:'original-boundary-visibility-open-hole-halfspaces-and-all-vertex-separating-axes',positions:'actual-original-surface-d1-binary64'},limits:{maximumVertices:15,maximumBoundaries:15,maximumHoles:2,maximumTriangles:17,maximumInternalEdges:18,maximumBridges:2,positions:45,normals:45,parametersUV:30,indices:51,snapshotValues:131072,snapshotDepth:24,arrayElements:512,recordFields:48,sourceStringCharacters:262144}}});return snapshot(result,true) as ConvexPlanarFaceWithHolesMeshResult;
}
/** Rebuild the real parent and every actual native material mesh/path/display role. */
export function validateConvexPlanarFaceWithHolesMesh(input:ConvexPlanarFaceWithHolesMeshResult):ConvexPlanarFaceWithHolesMeshReport {
  const owned=snapshot(input,true) as ConvexPlanarFaceWithHolesMeshResult;check(owned!==null&&typeof owned==='object'&&!Array.isArray(owned),'owned native hole-face mesh required');const expected=tessellateConvexPlanarFaceWithHoles(owned.face);check(same(owned,expected),'owned original parent/mesh/winding/UV/true path/internal role/incidence/area mismatch');return copyCadData(expected.report);
}
