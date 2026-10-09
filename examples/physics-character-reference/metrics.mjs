// Independent geometric checks. No Physics collision or math helpers are imported.
export function rotation(q){const [x,y,z,w]=q;return [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function endpoints(body){const r=rotation(body.orientation),axis=[r[0][1],r[1][1],r[2][1]],half=body.shape.halfLengthM;return [-1,1].map(sign=>body.positionM.map((v,i)=>v+sign*half*axis[i]));}
function local(p,box){const matrix=rotation(box.orientation),delta=p.map((v,i)=>v-box.positionM[i]);return [0,1,2].map(c=>delta.reduce((sum,v,r)=>sum+v*matrix[r][c],0));}
export function segmentBoxDistance(actor,box){const [a,b]=endpoints(actor).map(p=>local(p,box)),h=box.shape.halfExtentsM;
 const squared=t=>a.reduce((sum,v,i)=>{const d=Math.max(0,Math.abs(v+(b[i]-v)*t)-h[i]);return sum+d*d;},0);
 let lo=0,hi=1;for(let i=0;i<100;i++){const t1=(2*lo+hi)/3,t2=(lo+2*hi)/3;if(squared(t1)<=squared(t2))hi=t2;else lo=t1;}
 return Math.sqrt(Math.min(squared(0),squared(1),squared((lo+hi)/2)));
}
export function diagnostics(state,plane){const actor=state.bodies.find(b=>b.id==='actor'),r=rotation(actor.orientation),axis=[r[0][1],r[1][1],r[2][1]],n=plane.normal;
 const overlapById=state.bodies.filter(b=>b.kind==='static').map(box=>({bodyId:box.id,lowerBoundM:Math.max(0,actor.shape.radiusM-segmentBoxDistance(actor,box))}));
 const values=[...actor.positionM,...actor.velocityMps,...actor.orientation,...actor.angularVelocityRadps];
 return {finite:values.every(Number.isFinite),maxPositionM:Math.max(...actor.positionM.map(Math.abs)),maxVelocityMps:Math.max(...actor.velocityMps.map(Math.abs)),quaternionNormError:Math.abs(Math.hypot(...actor.orientation)-1),
 capsuleAxisTiltDegrees:Math.acos(Math.min(1,Math.max(0,Math.abs(axis[1]))))*180/Math.PI,
 supportPlaneGapM:dot(n,actor.positionM.map((v,i)=>v-plane.point[i]))-actor.shape.halfLengthM*Math.abs(dot(n,axis))-actor.shape.radiusM,
 maxOverlapLowerBoundM:Math.max(0,...overlapById.map(d=>d.lowerBoundM)),overlapById};
}
export function referenceControls(){const actor={id:'actor',velocityMps:[0,0,0],angularVelocityRadps:[0,0,0],positionM:[0,.5,0],orientation:[0,0,0,1],shape:{kind:'capsule',radiusM:.15,halfLengthM:.35}},box={kind:'static',id:'floor',positionM:[0,-.05,0],orientation:[0,0,0,1],shape:{kind:'box',halfExtentsM:[3,.05,1]}};
 const p={bodies:[actor,box]},angle=Math.PI/2,turned={...actor,positionM:[0,0,0],orientation:[0,0,Math.sin(angle/2),Math.cos(angle/2)]};
 const cornerActor={...actor,positionM:[.6,1,1.2]},cornerBox={...box,positionM:[.1,.2,.3],shape:{kind:'box',halfExtentsM:[.1,.2,.3]}};
 return {cornerDistance:segmentBoxDistance(cornerActor,cornerBox),rotatedBoxDistance:segmentBoxDistance(cornerActor,{...cornerBox,orientation:[0,0,Math.sin(angle/2),Math.cos(angle/2)]}),planeGap:diagnostics(p,{normal:[0,1,0],point:[0,0,0]}).supportPlaneGapM,touchDistance:segmentBoxDistance(actor,box),separatedDistance:segmentBoxDistance({...actor,positionM:[0,.6,0]},box),insideDistance:segmentBoxDistance({...actor,positionM:[0,0,0]},box),quarterTurnEnds:endpoints(turned)};}
