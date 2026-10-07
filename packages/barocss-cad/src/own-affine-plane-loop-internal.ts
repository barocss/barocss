import { validateCurve, validateSurface, surfaceDomain } from './math.js';
import type { CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import type { Curve, Surface, Point } from './types.js';

export interface AffineConvexLineLoopAdmission {
  orientation:'ccw'|'cw';verticesUV:Point[];
  convexityEvidence:{edgeIndex:number;vertexIndex:number;determinant:number;unsafeThreshold:number}[];
}
const DEFAULT_LABEL='Own affine Plane/native Line loop';
function check(condition:boolean,message:string,label:string):asserts condition {if(!condition)throw new Error((label+': '+message).slice(0,1024));}
function finite(value:number,label:string):number {check(Number.isFinite(value),'finite native homogeneous/Gram arithmetic required',label);return value;}
function subtract(a:Point,b:Point,label:string):Point{return a.map((value,i)=>finite(value-b[i],label)) as Point;}
function dot(a:Point,b:Point,label:string):number{return finite(a.reduce((sum,value,i)=>{const product=finite(value*b[i],label);check(value===0||b[i]===0||product!==0,'nonzero native dot-product term underflowed to zero',label);return finite(sum+product,label);},0),label);}
function cross(a:Point,b:Point,label:string):Point{return[finite(a[1]*b[2]-a[2]*b[1],label),finite(a[2]*b[0]-a[0]*b[2],label),finite(a[0]*b[1]-a[1]*b[0],label)];}
function mapParameter(domain:[number,number],value:number,label:string):number {if(value===0)return domain[0];if(value===1)return domain[1];return finite(domain[0]+(domain[1]-domain[0])*value,label);}
/** INTERNAL trusted own input. Callers perform their descriptor/shape snapshots before this admission. */
export function buildAffinePlaneAxes(plane:Surface,label=DEFAULT_LABEL):CurveAffinePlaneAxes {
  check(plane.kind==='surface'&&plane.degreeU===1&&plane.degreeV===1,'original degree1x1 affine Plane Surface required',label);validateSurface(plane);
  check(plane.controlPoints.length===2&&plane.controlPoints.every(row=>row.length===2)&&plane.weights.every(row=>row.every(weight=>Object.is(weight,plane.weights[0][0]))),'four-pole equal represented-weight original plane required',label);
  const domains=surfaceDomain(plane);check(Number.isFinite(domains.u[1]-domains.u[0])&&domains.u[1]>domains.u[0]&&Number.isFinite(domains.v[1]-domains.v[0])&&domains.v[1]>domains.v[0],'positive represented native Plane parameter spans',label);
  const origin=plane.controlPoints[0][0],u=subtract(plane.controlPoints[1][0],origin,label),v=subtract(plane.controlPoints[0][1],origin,label),affine=origin.map((value,i)=>finite(finite(value+u[i],label)+v[i],label)) as Point;
  check(plane.controlPoints[1][1].every((value,i)=>value===affine[i]),'non-affine bilinear patch unsupported',label);
  const uu=dot(u,u,label),vv=dot(v,v,label),uv=dot(u,v,label),product=finite(uu*vv,label),squared=finite(uv*uv,label),determinant=finite(product-squared,label),unsafeThreshold=finite(64*Number.EPSILON*(Math.abs(product)+Math.abs(squared)),label),normal=cross(u,v,label),magnitude=finite(Math.hypot(...normal),label);
  check(uu>0&&vv>0&&magnitude>0&&determinant>unsafeThreshold,'independent safely represented original plane axes required',label);
  return{originMM:origin,uDirectionMM:u,vDirectionMM:v,unitNormal:normal.map(value=>finite(value/magnitude,label)) as Point,gram:{uu,uv,vv,determinant,unsafeThreshold},domains};
}
export function mapAffinePlanePointToUV(point:Point,axes:CurveAffinePlaneAxes,label=DEFAULT_LABEL):Point {
  const d=subtract(point,axes.originMM,label),du=dot(d,axes.uDirectionMM,label),dv=dot(d,axes.vDirectionMM,label),g=axes.gram;
  const u=finite(finite(du*g.vv-dv*g.uv,label)/g.determinant,label),v=finite(finite(dv*g.uu-du*g.uv,label)/g.determinant,label);
  return[mapParameter(axes.domains.u,u,label),mapParameter(axes.domains.v,v,label),0];
}
export function directedUVDeterminant(direction:Point,relative:Point,label=DEFAULT_LABEL):{value:number;threshold:number} {
  const product=(a:number,b:number)=>{const value=finite(a*b,label);check(a===0||b===0||value!==0,'nonzero determinant product underflowed to zero',label);return value;};
  const a=product(direction[0],relative[1]),b=product(direction[1],relative[0]);return{value:finite(a-b,label),threshold:finite(64*Number.EPSILON*finite(Math.abs(a)+Math.abs(b),label),label)};
}
/** Actual supplied Plane axes/native Lines only; no synthetic Curve probe or source construction. */
export function admitConvexNativeLineLoop(edges:Curve[],axes:CurveAffinePlaneAxes,label=DEFAULT_LABEL):AffineConvexLineLoopAdmission {
  check(edges.length>=3&&edges.length<=8,'3..8 ordered native Line edges required',label);
  for(const edge of edges){validateCurve(edge);check(edge.kind==='curve'&&edge.degree===1&&edge.controlPoints.length===2&&edge.knots.length===4&&Object.is(edge.weights[0],edge.weights[1]),'actual equal-weight two-pole native Line required',label);check(edge.controlPoints[0].some((value,i)=>value!==edge.controlPoints[1][i]),'nondegenerate native edge required',label);for(const point of edge.controlPoints){const distance=dot(axes.unitNormal,subtract(point,axes.originMM,label),label),coefficient=finite(distance*edge.weights[0],label);check(distance===0||coefficient!==0,'nonzero original Line coplanarity coefficient underflowed to zero',label);check(coefficient===0,'original homogeneous Line coplanarity is not proven',label);const uv=mapAffinePlanePointToUV(point,axes,label);check(uv[0]>=axes.domains.u[0]&&uv[0]<=axes.domains.u[1]&&uv[1]>=axes.domains.v[0]&&uv[1]<=axes.domains.v[1],'original Line endpoints must lie inside the finite native Plane domain',label);}}
  for(let i=0;i<edges.length;i++)check(edges[i].controlPoints[1].every((value,j)=>Object.is(value,edges[(i+1)%edges.length].controlPoints[0][j])),'original Line endpoint closure must preserve represented XYZ bits',label);
  const verticesUV=edges.map(edge=>mapAffinePlanePointToUV(edge.controlPoints[0],axes,label));
  for(let i=0;i<verticesUV.length;i++)for(let j=i+1;j<verticesUV.length;j++)check(verticesUV[i][0]!==verticesUV[j][0]||verticesUV[i][1]!==verticesUV[j][1],'repeated native UV loop vertex refused',label);
  const first=directedUVDeterminant(subtract(verticesUV[1],verticesUV[0],label),subtract(verticesUV[2],verticesUV[0],label),label);check(Math.abs(first.value)>first.threshold,'first directed determinant is uncertain or collinear',label);const sign=first.value>0?1:-1,orientation=sign===1?'ccw':'cw',convexityEvidence:AffineConvexLineLoopAdmission['convexityEvidence']=[];
  for(let i=0;i<edges.length;i++)for(let j=0;j<verticesUV.length;j++){if(j===i||j===(i+1)%verticesUV.length)continue;const observation=directedUVDeterminant(subtract(verticesUV[(i+1)%verticesUV.length],verticesUV[i],label),subtract(verticesUV[j],verticesUV[i],label),label);check(sign*observation.value>observation.threshold,'every nonadjacent vertex must lie strictly inside every directed edge; unsafe/concave/self-crossed loop refused',label);convexityEvidence.push({edgeIndex:i,vertexIndex:j,determinant:observation.value,unsafeThreshold:observation.threshold});}
  return{orientation,verticesUV,convexityEvidence};
}
