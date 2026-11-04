/** Example-only existing Float verifier view; no QR stats or bridge adoption. */
import type {NormalProblem} from '../../packages/barocss-physics/src/stack/normal-solver.js';
import type {StationaryResult} from '../../packages/barocss-physics/src/stack/stationary-normal.js';
export function verifierView(p:NormalProblem,r:StationaryResult){
 if(!r.ok)return {ok:false,status:r.status,bodies:r.bodies,normalImpulsesNs:null,rowResiduals:null,certificate:null,stationaryStats:r.stats};
 const ids=new Map(p.bodies.map((b,i)=>[b.id,i])),sum=p.bodies.map(()=>[0,0,0,0,0,0]),root=Math.sqrt(24);
 for(let i=0;i<p.points.length;i++){const point=p.points[i],lambda=r.normalImpulsesNs![i];for(const [id,sign]of [[point.aId,-1],[point.bId,1]] as const){const index=ids.get(id)!,b=p.bodies[index];if(b.inverseMass===0)continue;const a=point.pointM.map((v,k)=>v-b.positionM[k]),n=point.normalAtoB,t=[a[1]*n[2]-a[2]*n[1],a[2]*n[0]-a[0]*n[2],a[0]*n[1]-a[1]*n[0]];for(let k=0;k<3;k++){sum[index][k]+=(sign*n[k])*lambda;let angular=0;for(let j=0;j<3;j++)angular+=t[j]*(j===k?root:0);sum[index][k+3]+=(sign*angular)*lambda;}}}
 let stationarity=0;for(const [i,b]of p.bodies.entries())if(b.inverseMass!==0)for(let k=0;k<6;k++)stationarity=Math.max(stationarity,Math.abs(-(k<3?b.velocityMps[k]:0)-sum[i][k]));
 return {ok:true,status:'SOLVED_NORMAL_ONLY',bodies:r.bodies,normalImpulsesNs:r.normalImpulsesNs,rowResiduals:p.points.map(x=>({id:x.id,normalSpeedMps:0,negativeNormalImpulseNs:0,complementarityJ:0,tangentSpeedMps:0})),certificate:{maxClosingNormalSpeedMps:0,maxNegativeNormalImpulseNs:0,maxComplementarityJ:0,maxStationaritySqrtJ:stationarity,maxLoadedTangentSpeedMps:0,zeroTangentFeasible:true},stationaryStats:r.stats};
}
