import { createLabSession } from './session.mjs';
const rotation = q => {
  const [x,y,z,w]=q,n=x*x+y*y+z*z+w*w;
  return [[(w*w+x*x-y*y-z*z)/n,2*(x*y-z*w)/n,2*(x*z+y*w)/n],
    [2*(x*y+z*w)/n,(w*w-x*x+y*y-z*z)/n,2*(y*z-x*w)/n],
    [2*(x*z-y*w)/n,2*(y*z+x*w)/n,(w*w-x*x-y*y+z*z)/n]];
};
const scaleGate=(a,b)=>1e-12+1e-12*Math.max(1,Math.abs(a),Math.abs(b));
function residual(actual,cell,trajectory=true){
  return {error:Math.max(...cell.map(x=>Math.abs(actual-x))),pass:cell.every(x=>Math.abs(actual-x)<=(trajectory?1e-11+1e-12*Math.abs(x):scaleGate(actual,x)))};
}
export async function compareReference(reference) {
  if(reference.format!=='physics-lab-directed-reference'||reference.targets.length!==6)throw new Error('Independent reference is unavailable');
  const results=[];
  for(const hz of [60,120,240]){
    const session=createLabSession({...reference.config,hz});
    const row={hz,steps:hz/10,matched:[],maxRotationError:0,maxOmegaError:0,maxWorkResidualJ:0,maxMomentumResidualNms:0,maxNormSquaredError:0,pass:true};
    try{
      for(let n=1;n<=hz/10;n++){
        const state=session.step(n===1?{angularImpulseNms:reference.impulseNms}:{}),body=state.bodies[0],d=session.diagnostics;
        const normError=Math.abs(body.orientationXYZW.reduce((s,x)=>s+x*x,0)-1);
        row.maxNormSquaredError=Math.max(row.maxNormSquaredError,normError);row.pass&&=normError<=1e-12;
        for(let axis=0;axis<3;axis++){
          const expected=reference.initialL[axis]+reference.impulseNms[axis]+reference.config.torqueNm[axis]*state.timeSeconds;
          const error=Math.abs(d.angularMomentumWorldNms[axis]-expected);
          row.maxMomentumResidualNms=Math.max(row.maxMomentumResidualNms,error);row.pass&&=error<=scaleGate(d.angularMomentumWorldNms[axis],expected);
        }
        if(n%(hz/60)!==0)continue;
        const target=reference.targets[n/(hz/60)-1],r=rotation(body.orientationXYZW);
        const sample={timeSeconds:state.timeSeconds,stepIndex:n,rotationError:0,omegaError:0,workResidualJ:0,pass:true,state};
        for(let i=0;i<3;i++)for(let j=0;j<3;j++){const e=residual(r[i][j],target.R[i][j]);sample.rotationError=Math.max(sample.rotationError,e.error);sample.pass&&=e.pass;}
        for(let i=0;i<3;i++){const e=residual(body.angularVelocityRadps[i],target.omega[i]);sample.omegaError=Math.max(sample.omegaError,e.error);sample.pass&&=e.pass;}
        for(const eplus of reference.energyPostImpulseJ)for(const work of target.W[0]){
          const actual=d.energyJ-eplus,error=Math.abs(actual-work);sample.workResidualJ=Math.max(sample.workResidualJ,error);sample.pass&&=error<=scaleGate(actual,work);
        }
        row.maxRotationError=Math.max(row.maxRotationError,sample.rotationError);row.maxOmegaError=Math.max(row.maxOmegaError,sample.omegaError);
        row.maxWorkResidualJ=Math.max(row.maxWorkResidualJ,sample.workResidualJ);row.pass&&=sample.pass;row.matched.push(sample);
      }
    }finally{session.dispose();}
    results.push(row);await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {pass:results.every(row=>row.pass&&row.matched.length===6),results,referenceBankSHA256:reference.bankSHA256,
    gates:{trajectory:'1e-11+1e-12*abs(reference)',normSquared:1e-12,invariant:'1e-12+1e-12*max(1,abs(actual),abs(expected))'},
    exactIndependentQualification:'See saved general-rotation Fraction audits. Browser uses outward binary64 reference enclosures.',
    refinement:'ROUNDING_FLOOR; no empirical order claim',scope:'fixed isolated box, one initial J, constant world torque, six shared physical times through0.1s'};
}
