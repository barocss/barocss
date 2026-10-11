import {validatePreviewPacket} from '@barocss/cad';
import {BODY_IDS} from './recording-reader.mjs';
import {recordedBindings} from './frame.mjs';
export const DISPLAY_PALETTE = Object.freeze([[.14,.58,.86],[.95,.57,.22],[.36,.72,.49],[.72,.48,.87]].map(Object.freeze));
export const DISPLAY_MESH = Object.freeze({radiusMm:100,sectors:16,latitudeSegments:8,witnessTipMm:150,witnessAxis:'local-positive-y'});

/** Derived approximate sphere plus a local +Y orientation arrow, all in one Surface packet. */
function packetFor(id) {
  const positions=[0,100,0],normals=[0,1,0],parameters=[0,0],indices=[];
  const {sectors,latitudeSegments}=DISPLAY_MESH;
  for (let j=1;j<latitudeSegments;j++) for(let i=0;i<sectors;i++) {
    const theta=j*Math.PI/latitudeSegments,phi=i*2*Math.PI/sectors;
    const x=Math.sin(theta)*Math.cos(phi),y=Math.cos(theta),z=Math.sin(theta)*Math.sin(phi);
    positions.push(100*x,100*y,100*z);normals.push(x,y,z);parameters.push(i/sectors,j/latitudeSegments);
  }
  const bottom=positions.length/3;positions.push(0,-100,0);normals.push(0,-1,0);parameters.push(0,1);
  for(let i=0;i<sectors;i++) {
    const n=(i+1)%sectors;indices.push(0,1+n,1+i);
    for(let j=0;j<latitudeSegments-2;j++) {
      const a=1+j*sectors+i,c=1+j*sectors+n,b=a+sectors,d=c+sectors;
      indices.push(a,c,b,c,d,b);
    }
    indices.push(1+(latitudeSegments-2)*sectors+i,1+(latitudeSegments-2)*sectors+n,bottom);
  }
  const tri=(a,b,c)=>{
    // Rotate only the arrow Rz90: (-y,x,z); form normals after this proper rotation.
    [a,b,c]=[a,b,c].map(point=>[-point[1],point[0],point[2]]);
    const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...cross),normal=cross.map(x=>x/length),start=positions.length/3;
    for(const point of [a,b,c]){positions.push(...point);normals.push(...normal);parameters.push(0,0);}
    indices.push(start,start+1,start+2);
  };
  const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
  const x0=88,x1=132,r=4;
  quad([x0,-r,-r],[x0,-r,r],[x0,r,r],[x0,r,-r]);
  quad([x1,-r,-r],[x1,r,-r],[x1,r,r],[x1,-r,r]);
  quad([x0,-r,-r],[x1,-r,-r],[x1,-r,r],[x0,-r,r]);
  quad([x0,r,-r],[x0,r,r],[x1,r,r],[x1,r,-r]);
  quad([x0,-r,-r],[x0,r,-r],[x1,r,-r],[x1,-r,-r]);
  quad([x0,-r,r],[x1,-r,r],[x1,r,r],[x0,r,r]);
  const base=[[128,-12,-12],[128,12,-12],[128,12,12],[128,-12,12]],tip=[150,0,0];
  for(let i=0;i<4;i++)tri(base[i],base[(i+1)%4],tip);
  quad(base[3],base[2],base[1],base[0]);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],positions[i]);max[axis]=Math.max(max[axis],positions[i]);}
  const packet={version:0,surfaceId:'sphere_witness_'+id,revision:0,lengthUnit:'mm',coordinateSystem:'right-handed-y-up',
    winding:'ccw',positions,normals,indices,parameters,bounds:{min,max}};
  validatePreviewPacket(packet);
  return {modelId:'recorded_'+id,packet};
}
export function createRecordedPackets() {
  return {packets:BODY_IDS.map(packetFor),bindings:recordedBindings()};
}
