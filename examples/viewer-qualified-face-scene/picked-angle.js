import {isPickedFacePointCurrent} from './picked-chord.js';
import {queryQualifiedFaceAngle} from './native-angle.js';

const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face picked angle: '+message);};
function originalPointMatches(measured,stored){
  return Array.isArray(measured.pointMM)&&measured.pointMM.length===3
    &&measured.pointMM.every((value,axis)=>Object.is(value,stored.pointMM[axis]));
}

/** Original angle at three approximately selected native parameter pins, with current full Face identity. */
export function measurePickedFaceAngle(viewer,first,vertex,third){
  for(const point of [first,vertex,third])
    check(isPickedFacePointCurrent(viewer,point),'stored point source or complete Face content is stale');
  const [a,b,c]=structuredClone([first,vertex,third]);
  const measurement=queryQualifiedFaceAngle(viewer,a.input,b.input,c.input);
  check(originalPointMatches(measurement.first,a)&&originalPointMatches(measurement.vertex,b)
    &&originalPointMatches(measurement.third,c),'stored native point differs from a fresh original evaluation');
  return structuredClone({version:0,first:a,vertex:b,third:c,measurement,
    selection:'approximate-display-parameters',certification:'not-certified'});
}
