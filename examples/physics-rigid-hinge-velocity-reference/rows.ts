import type {Body,Joint,Vec3} from '../../packages/barocss-physics/src/types.js';
import {sub,cross,rotate} from '../../packages/barocss-physics/src/math.js';
import type {BodyMetrics} from './diagnostics.js';
import {fail,finiteData,type StopKind,type LinearProblem} from './profile.js';

export const DOF_ORDER=['vAx','vAy','vAz','wAx','wAy','wAz','vBx','vBy','vBz','wBx','wBy','wBz'];
export const ROW_IDS=['P.x','P.y','P.z','L.x','L.y','L.z','anchor.x','anchor.y','anchor.z','transverse.x','transverse.y'];
const skew=(r:Vec3)=>[[0,-r[2],r[1]],[r[2],0,-r[0]],[-r[1],r[0],0]];
const canonical=(value:number)=>value===0?0:value;
export function makeRows(beforeBodies:Body[],finalBodies:Body[],joint:Joint,before:BodyMetrics,origin:Vec3,target:number){
 const masses=beforeBodies.map(body=>1/body.inverseMass),inertias=beforeBodies.map(body=>body.inertiaKgM2!);
 const center=[...before.centerOfMassM] as Vec3,centeredTarget=sub(before.angularMomentumVectorKgM2ps,cross(sub(center,origin),before.linearMomentumVectorKgMps));
 const physicalA=Array.from({length:11},()=>Array<number>(12).fill(0));
 const rA=rotate(finalBodies[0].orientation,joint.anchorALocalM),rB=rotate(finalBodies[1].orientation,joint.anchorBLocalM);
 const ra=skew(rA),rb=skew(rB),sa=skew(sub(finalBodies[0].positionM,center)),sb=skew(sub(finalBodies[1].positionM,center));
 for(let i=0;i<3;i++){
  physicalA[i][i]=masses[0];physicalA[i][6+i]=masses[1];
  for(let j=0;j<3;j++){physicalA[3+i][j]=masses[0]*sa[i][j];physicalA[3+i][6+j]=masses[1]*sb[i][j];physicalA[6+i][3+j]=-ra[i][j];physicalA[6+i][9+j]=rb[i][j];}
  physicalA[3+i][3+i]=inertias[0];physicalA[3+i][9+i]=inertias[1];physicalA[6+i][i]=1;physicalA[6+i][6+i]=-1;
 }
 physicalA[9][3]=-1;physicalA[9][9]=1;physicalA[10][4]=-1;physicalA[10][10]=1;
 for(const row of physicalA)for(let j=0;j<12;j++)row[j]=canonical(row[j]);
 const physicalB=[...before.linearMomentumVectorKgMps,...centeredTarget,0,0,0,0,0];
 const physicalH=[...Array(3).fill(masses[0]),...Array(3).fill(inertias[0]),...Array(3).fill(masses[1]),...Array(3).fill(inertias[1])] as number[];
 const physicalX0=beforeBodies.flatMap(body=>[...body.velocityMps,...body.angularVelocityRadps]);
 const columnScales=[1,1,1,10,10,10,1,1,1,10,10,10],rowDivisors=[1,1,1,.1,.1,.1,1,1,1,10,10];
 const dimensionlessA=physicalA.map((row,i)=>row.map((value,j)=>(value*columnScales[j])/rowDivisors[i]));
 const dimensionlessB=physicalB.map((value,i)=>value/rowDivisors[i]);
 const dimensionlessH=physicalH.map((value,j)=>(value*columnScales[j])*columnScales[j]/1);
 const dimensionlessX0=physicalX0.map((value,j)=>value/columnScales[j]);
 const stopKind:StopKind=target===joint.limitRad![1]?'upper':target===joint.limitRad![0]?'lower':'none';
 const physicalStopRow:number[]=stopKind==='none'?[]:Array(12).fill(0);
 if(stopKind!=='none'){physicalStopRow[5]=stopKind==='upper'?-1:1;physicalStopRow[11]=-physicalStopRow[5];}
 const dimensionlessStopRow=physicalStopRow.map((value,j)=>(value*columnScales[j])/10);
 const h=sub(rA,rB),d=sub(finalBodies[1].positionM,finalBodies[0].positionM);
 const rankSufficientMarginKgM2=2*inertias[0]-masses[0]*Math.hypot(...h)*Math.hypot(...sub(d,h));
 const problem:LinearProblem={a:dimensionlessA,b:dimensionlessB,h:dimensionlessH,y0:dimensionlessX0,stopKind,stopRow:dimensionlessStopRow};
 const result={dofOrder:[...DOF_ORDER],rowIds:[...ROW_IDS],physicalA,physicalB,physicalH,physicalX0,columnScales,rowDivisors,dimensionlessA,dimensionlessB,dimensionlessH,dimensionlessX0,
  centerOfMassOriginM:center,originalOriginM:[...origin],stopKind,physicalStopRow,dimensionlessStopRow,rankSufficientMarginKgM2,problem};
 if(!finiteData(result)||physicalH.some(value=>value<=0))fail('linear');
 return result;
}
