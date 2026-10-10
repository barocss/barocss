import {isPickedFacePointCurrent} from './picked-chord.js';
import {queryQualifiedFaceNormalAngle} from './normal-angle.js';

const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face picked normal angle: '+message);};
function normalPin(input){return{sourceId:input.sourceId,expectedSource:input.expectedSource,faceId:input.faceId,
  modelId:input.modelId,surfaceId:input.geometryId,u:input.u,v:input.v};}
function originalPointMatches(measured,stored){
  const point=measured.derivatives.point;
  return Array.isArray(point)&&point.length===3&&point.every((value,axis)=>Object.is(value,stored.pointMM[axis]));
}

/** Original D1 normal angle at two approximately selected, still-current native Surface parameters. */
export function measurePickedFaceNormalAngle(viewer,first,second){
  for(const point of [first,second])
    check(isPickedFacePointCurrent(viewer,point),'stored point source or complete Face content is stale');
  const [a,b]=structuredClone([first,second]);
  const measurement=queryQualifiedFaceNormalAngle(viewer.getState().qualifiedFaceScene,normalPin(a.input),normalPin(b.input));
  check(originalPointMatches(measurement.first,a)&&originalPointMatches(measurement.second,b),
    'stored native point differs from the original D1 point');
  return structuredClone({version:0,first:a,second:b,measurement,
    selection:'approximate-display-parameters',certification:'not-certified'});
}
