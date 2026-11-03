import type { Body, Vec3 } from '../internal-types.js';
import { add,sub,scale,dot } from '../math.js';
import { error } from '../validation.js';
import type { SATFeatureSelection } from './sat-feature.js';
import type { ContactGeometry } from './contact-types.js';
import { basis,extents,unit,point,WITNESS_MESSAGE,WITNESS_TOLERANCE_M,DUPLICATE_TOLERANCE_M } from './witness.js';
import { StrictLineContext,StrictLineFailure,nextAfterToward,STRICT_LINE_LIMITS } from './strict-line.js';
import type { FacePlane } from './strict-line.js';
/** Exact halfspace classification; no original near-face alignment or 1e-6 separation filter. */
export function clipFace(polygon: Vec3[],centre: Vec3,axis: Vec3,limit: number): Vec3[] {
  const out: Vec3[]=[];
  for(let i=0;i<polygon.length;i++) {
    const p=polygon[i],q=polygon[(i+1)%polygon.length];
    const dp=dot(sub(p,centre),axis)-limit,dq=dot(sub(q,centre),axis)-limit;
    if(dp<=0) out.push([...p] as Vec3);
    if((dp<=0)!==(dq<=0)) out.push(add(p,scale(sub(q,p),dp/(dp-dq))));
  }
  return out;
}
export function faceContact(a: Body,b: Body,selection: SATFeatureSelection): ContactGeometry {
  const f=selection.feature;
  if(f.kind==='edge-cross') error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const isA=f.kind==='face-a',ref=isA?a:b,inc=isA?b:a;
  const axis=f.kind==='face-a'?f.axisA:f.axisB,ra=basis(ref),ia=basis(inc),re=extents(ref),ie=extents(inc);
  const outward=isA?selection.hit.normal:scale(selection.hit.normal,-1);
  const side=dot(ra[axis],outward)<0?-1:1,n=unit(scale(ra[axis],side));
  const centre=add(ref.positionM,scale(ra[axis],side*re[axis]));
  let incidentAxis=0,greatest=-Infinity;
  for(let i=0;i<3;i++){const v=Math.abs(dot(ia[i],n));if(v>greatest){greatest=v;incidentAxis=i;}}
  const incidentSide=dot(ia[incidentAxis],n)>0?-1:1;
  const incidentCentre=add(inc.positionM,scale(ia[incidentAxis],incidentSide*ie[incidentAxis]));
  const it=[0,1,2].filter(i=>i!==incidentAxis),rt=[0,1,2].filter(i=>i!==axis);
  let poly=([[-1,-1],[1,-1],[1,1],[-1,1]] as number[][]).map(([u,v])=>
    add(add(incidentCentre,scale(ia[it[0]],u*ie[it[0]])),scale(ia[it[1]],v*ie[it[1]])));
  for(const i of rt){poly=clipFace(poly,centre,ra[i],re[i]);poly=clipFace(poly,centre,scale(ra[i],-1),re[i]);}
  const planeNormalAtoB=isA?n:scale(n,-1);
  const candidates=poly.map(p=>{
    const separation=dot(sub(p,centre),n),r=sub(p,scale(n,separation));
    return {p,r,separation,u:dot(sub(r,centre),ra[rt[0]]),v:dot(sub(r,centre),ra[rt[1]])};
  }).filter(p=>p.separation<=WITNESS_TOLERANCE_M);
  if(!candidates.length) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const selected=candidates.length<=4?candidates:
    [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>candidates.reduce((best,p)=>
      u*p.u+v*p.v>u*best.u+v*best.v?p:best,candidates[0]));
  const unique=selected.filter((p,i)=>selected.findIndex(q=>Math.hypot(...sub(p.r,q.r))<=DUPLICATE_TOLERANCE_M)===i);
  unique.sort((p,q)=>p.u-q.u||p.v-q.v);
  const prefix=`face:${ref.id}:${axis}:${side}:${inc.id}:${incidentAxis}:${incidentSide}`;
  // Keep the selected rows/keys/order. Only representable final witness placement changes.
  const referencePlane:FacePlane={axis,side},incidentPlane:FacePlane={axis:incidentAxis,side:incidentSide};
  const faceA=isA?referencePlane:incidentPlane,faceB=isA?incidentPlane:referencePlane;
  const interior=scale(candidates.reduce((sum,p)=>add(sum,scale(add(p.r,p.p),.5)),[0,0,0] as Vec3),1/candidates.length);
  let movedPoints=0,maximumSteps=0;
  let exact:StrictLineContext;
  let points:ReturnType<typeof point>[];
  try {
    exact=new StrictLineContext(a,b,planeNormalAtoB);
    points=unique.map((p,i)=>{
      const original=point(`${prefix}:${i}`,isA?p.r:p.p,isA?p.p:p.r,planeNormalAtoB);
      const certified=(candidate:ReturnType<typeof point>)=>exact.check(candidate.midpointM)
        &&exact.selectedFaceBounds(candidate.midpointM,faceA,faceB)
        &&exact.onFace(0,faceA,candidate.witnessAM)&&exact.onFace(1,faceB,candidate.witnessBM);
      if(certified(original)) return original;
      let seed=[...original.midpointM] as Vec3;
      for(let step=1;step<=STRICT_LINE_LIMITS.roundingSteps;step++) {
        seed=seed.map((value,k)=>nextAfterToward(value,interior[k])) as Vec3;
        const [witnessA,witnessB]=exact.projectedPair(seed,faceA,faceB);
        const candidate=point(original.key,witnessA,witnessB,planeNormalAtoB);
        if(!exact.movementWithin(original.witnessAM,candidate.witnessAM)
          ||!exact.movementWithin(original.witnessBM,candidate.witnessBM)
          ||!exact.movementWithin(original.midpointM,candidate.midpointM)) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
        if(certified(candidate)) { movedPoints++;maximumSteps=Math.max(maximumSteps,step);return candidate; }
      }
      error('NUMERIC_LIMIT',WITNESS_MESSAGE);
    });
  } catch(caught) {
    if(caught instanceof StrictLineFailure) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
    throw caught;
  }
  const exactWork=exact.stats();
  return {selection:structuredClone(selection),family:'face',planeNormalAtoB,reference:{body:isA?'a':'b',axis,side,incidentAxis,incidentSide},points,
    conditioning:{clippedVertices:poly.length,candidates:candidates.length,retainedPoints:points.length,
      rawAxisLength:selection.rawAxisLength,uniquePhysicalFeatureClaimed:false,strictLineCertified:true,
      boundaryRoundingMovedPoints:movedPoints,boundaryRoundingMaximumSteps:maximumSteps,
      exactRationalOperations:exactWork.rationalOperations,exactIntegerOperations:exactWork.integerOperations,
      exactPeakIntegerBits:exactWork.peakIntegerBits}};
}
