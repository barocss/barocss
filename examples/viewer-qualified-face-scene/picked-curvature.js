import {isPickedFacePointCurrent} from './picked-chord.js';
import {queryQualifiedFaceSurfaceCurvature} from './surface-curvature.js';

const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face picked Surface curvature: '+message);};

/** Original Surface curvature at an approximately selected, still-current native parameter pin. */
export function queryPickedFaceSurfaceCurvature(viewer,point){
  check(isPickedFacePointCurrent(viewer,point),'stored point source or complete Face content is stale');
  const owned=structuredClone(point),input=owned.input;
  const pin={sourceId:input.sourceId,expectedSource:input.expectedSource,faceId:input.faceId,
    modelId:input.modelId,surfaceId:input.geometryId,u:input.u,v:input.v};
  const measurement=queryQualifiedFaceSurfaceCurvature(viewer.getState().qualifiedFaceScene,pin);
  const originalPoint=measurement.curvature.derivatives.point;
  check(Array.isArray(originalPoint)&&originalPoint.length===3
    &&originalPoint.every((value,axis)=>Object.is(value,owned.pointMM[axis])),
  'stored native point differs from the original D2 point');
  return structuredClone({version:0,point:owned,measurement,
    selection:'approximate-display-parameters',certification:'not-certified'});
}
