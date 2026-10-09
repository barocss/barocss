export const RADIUS_M=.15, HALF_LENGTH_M=.35;
export function matrix(q){const [x,y,z,w]=q,factor=2/(x*x+y*y+z*z+w*w);return [[1-factor*(y*y+z*z),factor*(x*y-z*w),factor*(x*z+y*w)],
 [factor*(x*y+z*w),1-factor*(x*x+z*z),factor*(y*z-x*w)],[factor*(x*z-y*w),factor*(y*z+x*w),1-factor*(x*x+y*y)]];}
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function closestCandidate(center,box){
 const m=matrix(box.orientationXYZW),h=box.halfExtentsM;
 const toLocal=p=>[0,1,2].map(j=>m[0][j]*(p[0]-box.centerM[0])+m[1][j]*(p[1]-box.centerM[1])+m[2][j]*(p[2]-box.centerM[2]));
 const toWorld=p=>m.map((row,i)=>dot(row,p)+box.centerM[i]);
 const a=toLocal([center[0],center[1]-HALF_LENGTH_M,center[2]]),b=toLocal([center[0],center[1]+HALF_LENGTH_M,center[2]]),d=b.map((v,i)=>v-a[i]);
 function squared(t){let sum=0;for(let i=0;i<3;i++){const delta=Math.max(0,Math.abs(a[i]+t*d[i])-h[i]);sum+=delta*delta;}return sum;}
 let lo=0,hi=1;for(let pass=0;pass<100;pass++){const t1=(2*lo+hi)/3,t2=(lo+2*hi)/3;if(squared(t1)<=squared(t2))hi=t2;else lo=t1;}
 let u=0,best=squared(0);for(const t of [1,(lo+hi)/2]){const value=squared(t);if(value<best){best=value;u=t;}}
 const segmentLocal=a.map((v,i)=>v+u*d[i]),pointLocal=segmentLocal.map((v,i)=>Math.max(-h[i],Math.min(h[i],v)));
 const difference=segmentLocal.map((v,i)=>v-pointLocal[i]),distanceM=Math.sqrt(best);
 const normalM=distanceM>0?m.map(row=>dot(row,difference)/distanceM):null;
 return {distanceM,normalM,pointM:toWorld(pointLocal),segmentM:toWorld(segmentLocal)};
}
