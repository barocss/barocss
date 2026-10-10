import type {Body,PhysicsState,PhysicsWorldConfig,Vec3} from '../../packages/barocss-physics/src/types.js';
import {copyBody} from '../../packages/barocss-physics/src/validation.js';
import {validateResult} from '../../packages/barocss-physics/src/collision.js';
import {add,scale,sub} from '../../packages/barocss-physics/src/math.js';
import {projectCoupledHingeCandidate} from '../physics-rigid-coupled-hinge-reference/candidate.js';
import {prepareInput,bridge,finiteData,fail,DT} from './profile.js';
import {measureBodies} from './diagnostics.js';
import {makeRows} from './rows.js';
import {solveDimensionlessVelocity} from './linear-solver.js';

export function projectHingePoseVelocityReference(config:PhysicsWorldConfig,state:PhysicsState,dt:number){
 const input=prepareInput(config,state,dt),beforeBodies=input.bodies.map(copyBody);
 const originalOriginM=scale(add(input.config.bodies[0].positionM,input.config.bodies[1].positionM),.5);
 // Targets are original input metrics, not old pose output diagnostics.
 const before=measureBodies(beforeBodies,input.joint,originalOriginM);
 const pose=bridge(()=>projectCoupledHingeCandidate(input.config,input.carrier,DT));
 const bodies=pose.bodies.map(copyBody),rows=makeRows(beforeBodies,bodies,input.joint,before,originalOriginM,pose.poseReport.targetAngleRad);
 const result=solveDimensionlessVelocity(rows.problem);
 if(!result.identity){
  for(let i=0;i<2;i++){
   bodies[i].velocityMps=result.y.slice(i*6,i*6+3).map((value,j)=>value*rows.columnScales[i*6+j]) as Vec3;
   bodies[i].angularVelocityRadps=result.y.slice(i*6+3,i*6+6).map((value,j)=>value*rows.columnScales[i*6+3+j]) as Vec3;
  }
 }
 // Preserve the original canonical bounds before checking new output fields.
 validateResult(bodies,[]);
 const after=measureBodies(bodies,input.joint,originalOriginM);
 const velocityCorrections={linearMps:bodies.map((body,i)=>sub(body.velocityMps,beforeBodies[i].velocityMps)),angularRadps:bodies.map((body,i)=>sub(body.angularVelocityRadps,beforeBodies[i].angularVelocityRadps))};
 const changedComponents=bodies.map((body,i)=>[...body.velocityMps,...body.angularVelocityRadps].map((value,j)=>!Object.is(value,[...beforeBodies[i].velocityMps,...beforeBodies[i].angularVelocityRadps][j])));
 const identityVelocityBitsPreserved=result.identity&&changedComponents.every(row=>row.every(changed=>!changed));
 const finalX=bodies.flatMap(body=>[...body.velocityMps,...body.angularVelocityRadps]);
 let sum=0;for(let j=0;j<12;j++){const delta=finalX[j]-rows.physicalX0[j];sum+=rows.physicalH[j]*(delta*delta);}const objectiveJ=.5*sum;
 const physicalLambda=result.lambda.map((value,i)=>1*value/(i===11?10:rows.rowDivisors[i]));
 const projection={dofOrder:rows.dofOrder,rowIds:result.activeStop?[...rows.rowIds,`stop.${rows.stopKind}`]:rows.rowIds,
  physicalA:rows.physicalA,physicalB:rows.physicalB,physicalH:rows.physicalH,physicalX0:rows.physicalX0,columnScales:rows.columnScales,rowDivisors:rows.rowDivisors,
  dimensionlessA:rows.dimensionlessA,dimensionlessB:rows.dimensionlessB,dimensionlessH:rows.dimensionlessH,dimensionlessX0:rows.dimensionlessX0,
  centerOfMassOriginM:rows.centerOfMassOriginM,originalOriginM:rows.originalOriginM,stopKind:rows.stopKind,physicalStopRow:rows.physicalStopRow,dimensionlessStopRow:rows.dimensionlessStopRow,
  result,physicalLambda,objectiveJ,rankSufficientMarginKgM2:rows.rankSufficientMarginKgM2};
 const diagnostics={poseStage:pose.diagnostics,before,after,velocityCorrections,projection,changedComponents,identityVelocityBitsPreserved,poseLawEvaluations:1,sourceStepIndex:input.carrier.stepIndex,sourceTimeSeconds:input.carrier.timeSeconds};
 if(!finiteData(diagnostics)||!finiteData(pose.poseReport)||objectiveJ<0||result.identity&&!identityVelocityBitsPreserved)fail('result');
 return {bodies:bodies.map(copyBody),poseReport:structuredClone(pose.poseReport),diagnostics:structuredClone(diagnostics)};
}
