import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add,sub,scale,dot,cross } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import type { SATFeatureSelection } from './sat-feature.js';
import type { ContactGeometry } from './contact-types.js';
import { basis,extents,point,WITNESS_MESSAGE,WITNESS_TOLERANCE_M } from './witness.js';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Enumerate four boundary minima plus the unconstrained interior stationary point. */
export function closestSegments(p:Vec3,p1:Vec3,q:Vec3,q1:Vec3) {
  const u=sub(p1,p),v=sub(q1,q),r=sub(q,p),uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),c=cross(u,v),den=dot(c,c);
  if(![...p,...p1,...q,...q1,uu,vv,den].every(Number.isFinite)||uu<=0||vv<=0) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const pairs=[{s:0,t:clamp(-dot(r,v)/vv)},{s:1,t:clamp((uv-dot(r,v))/vv)},
    {s:clamp(dot(r,u)/uu),t:0},{s:clamp((dot(r,u)+uv)/uu),t:1}];
  if(den>0){const s=dot(cross(r,v),c)/den,t=dot(cross(r,u),c)/den;
    if(Number.isFinite(s)&&Number.isFinite(t)&&s>=0&&s<=1&&t>=0&&t<=1) pairs.push({s,t});}
  let best=pairs[0],bestDistance=Infinity;
  for(const pair of pairs){const d=sub(add(p,scale(u,pair.s)),add(q,scale(v,pair.t))),ds=dot(d,d);
    if(ds<bestDistance){best=pair;bestDistance=ds;}}
  return {a:add(p,scale(u,best.s)),b:add(q,scale(v,best.t)),parameterA:best.s,parameterB:best.t,
    crossSquared:den,distanceSquared:bestDistance,parallel:den===0,boundary:best.s===0||best.s===1||best.t===0||best.t===1};
}
function supportEdge(body:Body,axis:number,direction:Vec3) {
  const axes=basis(body),e=extents(body),sides:Vec3=[0,0,0];let centre=[...body.positionM] as Vec3;
  for(let i=0;i<3;i++) if(i!==axis){sides[i]=dot(axes[i],direction)<0?-1:1;centre=add(centre,scale(axes[i],sides[i]*e[i]));}
  return {lo:sub(centre,scale(axes[axis],e[axis])),hi:add(centre,scale(axes[axis],e[axis])),sides};
}
export function edgeContact(a:Body,b:Body,selection:SATFeatureSelection):ContactGeometry {
  const f=selection.feature;if(f.kind!=='edge-cross') error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const n=[...selection.hit.normal] as Vec3,ea=supportEdge(a,f.axisA,n),eb=supportEdge(b,f.axisB,scale(n,-1));
  const nearest=closestSegments(ea.lo,ea.hi,eb.lo,eb.hi);
  const difference=sub(nearest.b,nearest.a),gap=dot(difference,n),tangent=sub(difference,scale(n,gap));
  if(Math.hypot(...tangent)>WITNESS_TOLERANCE_M) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const key=`edge:${a.id}:${f.axisA}:${ea.sides.join(',')}:${b.id}:${f.axisB}:${eb.sides.join(',')}`;
  return {selection:structuredClone(selection),family:'edge',planeNormalAtoB:n,
    edges:{axisA:f.axisA,axisB:f.axisB,sidesA:ea.sides,sidesB:eb.sides,parameterA:nearest.parameterA,parameterB:nearest.parameterB},
    points:[point(key,nearest.a,nearest.b,n)],conditioning:{crossSquared:nearest.crossSquared,
      rawAxisLength:selection.rawAxisLength,parallel:nearest.parallel,boundary:nearest.boundary,
      tangentDistanceM:Math.hypot(...tangent),uniquePhysicalFeatureClaimed:false}};
}
